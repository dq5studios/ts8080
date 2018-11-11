// import { Logger } from "./logger.js";

// let log: Logger = new Logger();

/**
 * 8080 CPU
 */
export class State8080 {
    public ready: boolean = false; // Finished loading, ready to execute
    public register: Registers = new Registers(); // Register container
    public int: boolean = true; // Interrupts enabled
    public active_int: number = 0x00; // Interrupt to run
    public memory!: Memory; // We don't create a memory object until we load the rom image
    public cc: ConditionCodes = new ConditionCodes(this);
    public ops: OpCodes = new OpCodes(this);
    public cycles = 0; // Number of cycles executed
    public io!: IO8080;
    public time: number = 0;
    public stack: string[] = [];
    // public log: Logger = new Logger();

    /**
     * Creates an instance of State8080
     *
     * @param {string} rom Filename
     */
    constructor(rom: string) {
        fetch(rom)
        .then(response => response.arrayBuffer())
        .then(buffer => this.memory = new Memory(buffer))
        .then(() => { this.init(); });
    }

    /**
     * Initialize registers
     */
    public init(): void {
        // if (cpudiag) {
        //     this.register.pc = 0x100;
        //     this.register.sp = 0x7ad;
        //     // remove when fixing aux carry
        //     this.memory.set(0x59c, 0xc3);
        //     this.memory.set(0x59d, 0xc2);
        //     this.memory.set(0x59e, 0x05);
        //     this.memory.set16(0x06, 0x1400);
        // }
        this.ready = true;
        console.log("Ready");
    }

    /**
     * Pause emulation
     */
    public pause(): void {
        this.ready = !this.ready;
    }

    /**
     * Start emulation
     */
    public run(): void {
        if (!this.ready) {
            return;
        }
        try {
            // this.time = performance.now();
            this.time = Date.now();
            this.cycle();
        } catch (err) {
            console.log(err);
            throw "Run failed";
        }
    }

    /**
     * Execute the number of cycles that should've ran since the last mark
     */
    public cycle() {
        // this.cycles += (performance.now() - this.time) * 2000;
        this.cycles += (Date.now() - this.time) * 2000;
        // this.time = performance.now();
        this.time = Date.now();
        console.log(this.cycles);
        while (this.cycles > 0) {
            if (!this.ready) {
                return;
            }
            if (this.int && this.active_int > 0x00) {
                this.int = false;
                this.ops[this.active_int]();
                this.active_int = 0x00;
            }
            let opcode = this.memory.get(this.register.pc);
            if (typeof this.ops[opcode] === "undefined") {
                let addr = this.register.pc;
                let opcode = this.memory.get(addr).toString(16).padStart(2, "0");
                throw `Unimplemented OpCode ${opcode} at ${addr.toString(16).padStart(4, "0")}`;
            }
            // Opcode JMP 0xad7 (C3 D7 0A) is a delay loop
            if (this.memory.get(this.register.pc) === 0xc3) {
                // JMP command
                if (this.memory.get16(this.register.pc + 1) === 0x0ad7) {
                    // Move to RET command of wait subroutine
                    this.register.pc = 0x0ae1;
                    // A register contains how many cycles to wait
                    let len = this.register.a / 0x40;
                    console.log(`delay for ${len} seconds`);
                    setTimeout(() => { this.time = Date.now(); /*this.time = performance.now();*/ this.cycle(); }, 1000 * len);
                    return;
                }
            }
            try {
                this.ops[opcode]();
            } catch (e) {
                console.log(`Could not execute opcode ${opcode} at ${this.register.pc.toString(16).padStart(4, "0")}`, true);
                throw "Error executing code";
            }
            this.cycles -= this.ops.cycle[opcode];
        }
        setTimeout(() => { this.cycle(); });
    }
}

/**
 * 8080 condition codes
 */
export class ConditionCodes {
    private state: State8080;

    /**
     * Creates an instance of ConditionCodes.
     * @param {State8080} state State of the 8080
     */
    constructor(state: State8080) {
        this.state = state;
    }

    /**
     * Set the S, Z and P flags
     *
     * @param {number} result Result of the previous operation
     */
    public setSZP(result: number): void {
        this.s = Number((result & 0x80) !== 0);
        this.z = Number((result & 0xff) === 0);
        this.p = this.parity(result);
        // this.ac = aux carry
    }

    /**
     * Set the CY flag
     *
     * @param {number} result Result of the previous operation
     */
    public carry(result: number): void {
        this.cy = Number(result > 0xff || result < 0x00);
    }

    /**
     * Set the CY flag
     *
     * @param {number} result Result of the previous operation
     */
    public carry16(result: number): void {
        this.cy = Number(result > 0xffff);
    }

    /**
     * Calculate the parity
     *
     * @param {number} result Result of the previous operation
     *
     * @returns {number} Parity
     */
    public parity(result: number): number {
        let p = 0;
        let x = (result & ((1 << 8) - 1));
        for (let i = 0; i < 8; i++) {
            if (x & 0x1) {
                p++;
            }
            x = x >> 1;
        }
        return Number((p & 0x1) == 0);
    }

    /**
     * Get z condition
     */
    public get z(): number {
        return Number((this.state.register.f & 0b01000000) == 0b01000000);
    }

    /**
     * Set z condition
     */
    public set z(v : number) {
        if (v) {
            this.state.register.f |= 0b01000000;
        } else {
            this.state.register.f &= 0b10111111;
        }
        // log.reg("z", v);
    }

    /**
     * Get s condition
     */
    public get s(): number {
        return Number((this.state.register.f & 0b10000000) == 0b10000000);
    }

    /**
     * Set s condition
     */
    public set s(v : number) {
        if (v) {
            this.state.register.f |= 0b10000000;
        } else {
            this.state.register.f &= 0b01111111;
        }
        // log.reg("s", v);
    }

    /**
     * Get p condition
     */
    public get p(): number {
        return Number((this.state.register.f & 0b00000100) == 0b00000100);
    }

    /**
     * Set p condition
     */
    public set p(v : number) {
        if (v) {
            this.state.register.f |= 0b00000100;
        } else {
            this.state.register.f &= 0b11111011;
        }
        // log.reg("p", v);
    }

    /**
     * Get cy condition
     */
    public get cy(): number {
        return Number((this.state.register.f & 0b00000001) == 0b00000001);
    }

    /**
     * Set cy condition
     */
    public set cy(v : number) {
        if (v) {
            this.state.register.f |= 0b00000001;
        } else {
            this.state.register.f &= 0b11111110;
        }
        // log.reg("cy", v);
    }

    /**
     * Get ac condition
     */
    public get ac(): number {
        return Number((this.state.register.f & 0b00001000) == 0b00001000);
    }

    /**
     * Set ac condition
     */
    public set ac(v : number) {
        if (v) {
            this.state.register.f |= 0b00001000;
        } else {
            this.state.register.f &= 0b11110111;
        }
        // log.reg("ac", v);
    }
}

/**
 * 8080 registers
 */
export class Registers {
    private _a!: number;
    private _f: number = 0b00000010;
    private _b!: number;
    private _c!: number;
    private _d!: number;
    private _e!: number;
    private _h!: number;
    private _l!: number;
    private _pc!: number; // Program Counter
    private _sp!: number; // Stack Pointer

    /**
     * Get program counter
     */
    public get pc(): number {
        return this._pc;
    }

    /**
     * Set program counter
     */
    public set pc(v : number) {
        this._pc = v & 0xffff;
        // log.reg("pc", this._pc);
    }

    /**
     * Get stack counter
     */
    public get sp(): number {
        return this._sp;
    }

    /**
     * Set program counter
     */
    public set sp(v : number) {
        this._sp = v & 0xffff;
        // log.reg("sp", this._sp);
    }

    /**
     * Get a register
     */
    public get a(): number {
        return this._a;
    }

    /**
     * Set a register
     */
    public set a(v : number) {
        this._a = v & 0xff;
        // log.reg("a", this._a);
    }

    /**
     * Get f register
     */
    public get f(): number {
        return this._f;
    }

    /**
     * Set f register
     */
    public set f(v : number) {
        this._f = v & 0xff;
        // log.reg("f", this._f);
    }

    /**
     * Get b register
     */
    public get b(): number {
        return this._b;
    }

    /**
     * Set b register
     */
    public set b(v : number) {
        this._b = v & 0xff;
        // log.reg("b", this._b);
    }

    /**
     * Get c register
     */
    public get c(): number {
        return this._c;
    }

    /**
     * Set c register
     */
    public set c(v : number) {
        this._c = v & 0xff;
        // log.reg("c", this._c);
    }

    /**
     * Get d register
     */
    public get d(): number {
        return this._d;
    }

    /**
     * Set d register
     */
    public set d(v : number) {
        this._d = v & 0xff;
        // log.reg("d", this._d);
    }

    /**
     * Get e register
     */
    public get e(): number {
        return this._e;
    }

    /**
     * Set e register
     */
    public set e(v : number) {
        this._e = v & 0xff;
        // log.reg("e", this._e);
    }

    /**
     * Get h register
     */
    public get h(): number {
        return this._h;
    }

    /**
     * Set h register
     */
    public set h(v : number) {
        this._h = v & 0xff;
        // log.reg("h", this._h);
    }

    /**
     * Get l register
     */
    public get l(): number {
        return this._l;
    }

    /**
     * Set l register
     */
    public set l(v : number) {
        this._l = v & 0xff;
        // log.reg("l", this._l);
    }

    /**
     * Read the combined A & F registers
     *
     * @return {number} BC
     */
    public get psw(): number {
        return (this.a << 8) + this.f;
    }

    /**
     * Set the combined A & F registers
     *
     * @param {number} af New value
     */
    public set psw(af: number) {
        this.a = (af >> 8) & 0xff;
        this.f = af & 0xff;
    }

    /**
     * Read the combined B & C registers
     *
     * @return {number} BC
     */
    public get bc(): number {
        return (this._b << 8) + this._c;
    }

    /**
     * Set the combined B & C registers
     *
     * @param {number} bc New value
     */
    public set bc(bc: number) {
        this.b = (bc >> 8) & 0xff;
        this.c = bc & 0xff;
    }

    /**
     * Read the combined D & E registers
     *
     * @return {number} DE
     */
    public get de(): number {
        return (this._d << 8) + this._e;
    }

    /**
     * Set the combined D & E registers
     *
     * @param {number} de New value
     */
    public set de(de: number) {
        this.d = (de >> 8) & 0xff;
        this.e = de & 0xff;
    }

    /**
     * Read the combined H & L registers
     *
     * @return {number} HL
     */
    public get hl(): number {
        return (this._h << 8) + this._l;
    }

    /**
     * Set the combined H & L registers
     *
     * @param {number} hl New value
     */
    public set hl(hl: number) {
        this.h = (hl >> 8) & 0xff;
        this.l = hl & 0xff;
    }

}

/**
 * Control access to the 8080 memory
 */
export class Memory {
    private memory: DataView;
    constructor(buffer: ArrayBuffer) {
        let tmp = ArrayBuffer.transfer(buffer, 0x4000);
        this.memory = new DataView(tmp);
        // log.drawMemory(this.memory);
    }

    /**
     * Get a byte from memory
     *
     * @param {number} addr Memory address
     *
     * @returns {number} Byte
     */
    public get(addr: number): number {
        if (addr >= 0x4000) {
            // invaders.pause();
            // console.log(invaders.register.pc.toString(16), `Memory read request to out of bounds address ${addr.toString(16)}`);
            return 0;
        }
        return this.memory.getUint8(addr);
    }

    /**
     * Get two bytes from memory
     *
     * @param {number} addr Memory address
     *
     * @returns {number} Byte
     */
    public get16(addr: number): number {
        if (addr >= 0x4000) {
            // invaders.pause();
            // console.log(invaders.register.pc.toString(16), `Memory read request to out of bounds address ${addr.toString(16)}`);
            return 0;
        }
        return this.memory.getUint16(addr, true);
    }

    /**
     * Set a byte in memory
     *
     * @param {number} addr  Memory address
     * @param {number} value Byte to set
     */
    public set(addr: number, value: number): void {
        if (addr < 0x2000/* && !cpudiag*/) {
            // invaders.pause();
            // console.log(invaders.register.pc.toString(16), `Memory write request to read only memory address ${addr.toString(16)}`);
            return;
        }
        if (addr >= 0x4000) {
            // invaders.pause();
            // console.log(invaders.register.pc.toString(16), `Memory write request to out of bounds address ${addr.toString(16)}`, true);
            return;
        }
        this.memory.setUint8(addr, value);
        // log.updateMemory(addr, value);
    }

    /**
     * Set two bytes in memory
     *
     * @param {number} addr  Memory address
     * @param {number} value Bytes to set
     */
    public set16(addr: number, value: number): void {
        if (addr < 0x2000/* && !cpudiag*/) {
            // invaders.pause();
            // console.log(invaders.register.pc.toString(16), `Memory write request to read only memory address ${addr.toString(16)}`);
            return;
        }
        if (addr >= 0x4000) {
            // invaders.pause();
            // console.log(invaders.register.pc.toString(16), `Memory write request to out of bounds address ${addr.toString(16)}`);
            return;
        }
        try {
            this.memory.setUint16(addr, value, true);
        } catch(e) {
            console.log(addr.toString(16).padStart(4, "0"), value.toString(16).padStart(4, "0"), e);
            throw e;
        }
        // log.updateMemory(addr, value);
    }
}

/**
 * IO port of 8080
 */
export class IO8080 {
    [index: number]: number;
}

/**
 * Execute requested 8080 opcode
 */
export class OpCodes {

    // Numeric index is the opcode list
    [index: number]: Function;

    // Reference to the state of the 8080 we're executing on
    private state: State8080;

    // How many cycles do each op code take
    public cycle = [
        4, 10, 7, 5, 5, 5, 7, 4, 4, 10, 7, 5, 5, 5, 7, 4,             // 0x00
        4, 10, 7, 5, 5, 5, 7, 4, 4, 10, 7, 5, 5, 5, 7, 4,             // 0x10
        4, 10, 16, 5, 5, 5, 7, 4, 4, 10, 16, 5, 5, 5, 7, 4,           // 0x20
        4, 10, 13, 5, 10, 10, 10, 4, 4, 10, 13, 5, 5, 5, 7, 4,        // 0x30
        5, 5, 5, 5, 5, 5, 7, 5, 5, 5, 5, 5, 5, 5, 7, 5,               // 0x40
        5, 5, 5, 5, 5, 5, 7, 5, 5, 5, 5, 5, 5, 5, 7, 5,               // 0x50
        5, 5, 5, 5, 5, 5, 7, 5, 5, 5, 5, 5, 5, 5, 7, 5,               // 0x60
        7, 7, 7, 7, 7, 7, 7, 7, 5, 5, 5, 5, 5, 5, 7, 5,               // 0x70
        4, 4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 4, 4, 7, 4,               // 0x80
        4, 4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 4, 4, 7, 4,               // 0x90
        4, 4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 4, 4, 7, 4,               // 0xa0
        4, 4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 4, 4, 7, 4,               // 0xb0
        11, 10, 10, 10, 17, 11, 7, 11, 11, 10, 10, 10, 10, 17, 7, 11, // 0xc0
        11, 10, 10, 10, 17, 11, 7, 11, 11, 10, 10, 10, 10, 17, 7, 11, // 0xd0
        11, 10, 10, 18, 17, 11, 7, 11, 11, 5, 10, 5, 17, 17, 7, 11,   // 0xe0
        11, 10, 10, 4, 17, 11, 7, 11, 11, 5, 10, 4, 17, 17, 7, 11     // 0xf0
    ];

    /**
     * No Op
     */
    public 0x00 = () => {
        // log.ops(`NOP`);
        this.state.register.pc += 1;
    }
    public 0x08 = this[0x00];
    public 0x10 = this[0x00];
    public 0x18 = this[0x00];
    public 0x20 = this[0x00];
    public 0x28 = this[0x00];
    public 0x30 = this[0x00];
    public 0x38 = this[0x00];

    /**
     * B <- byte 3,C <- byte 2
     */
    public 0x01 = () => {
        this.state.register.c = this.state.memory.get(this.state.register.pc + 1);
        this.state.register.b = this.state.memory.get(this.state.register.pc + 2);
        // log.ops(`LXI B ${this.state.register.b.toString(16).padStart(2, "0")}${this.state.register.c.toString(16).padStart(2, "0")}`);
        this.state.register.pc += 3;
    }

    /**
     * (BC) <- A
     */
    public 0x02 = () => {
        let addr = this.state.register.bc;
        this.state.memory.set(addr, this.state.register.a);
        // log.ops(`STAX B (${addr.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * BC <- BC + 1
     */
    public 0x03 = () => {
        this.state.register.bc++;
        // log.ops(`INX B`);
        this.state.register.pc += 1;
    }

    /**
     * Increment b
     */
    public 0x04 = () => {
        this.state.cc.setSZP(++this.state.register.b);
        // log.ops(`INR B`);
        this.state.register.pc += 1;
    }

    /**
     * Decrement b
     */
    public 0x05 = () => {
        this.state.cc.setSZP(--this.state.register.b);
        // log.ops(`DCR B`);
        this.state.register.pc += 1;
    }

    /**
     * B <- byte 2
     */
    public 0x06 = () => {
        let byte = this.state.memory.get(this.state.register.pc + 1);
        this.state.register.b = byte;
        // log.ops(`MVI B ${byte.toString(16)}`);
        this.state.register.pc += 2;
    }

    /**
     * A = A << 1; bit 0 = prev bit 7; CY = prev bit 7
     */
    public 0x07 = () => {
        let cy = this.state.register.a & 0x80;
        this.state.register.a = this.state.register.a << 1 | cy >> 7;
        this.state.cc.cy = Number(cy == 0x80);
        // log.ops(`RLC`);
        this.state.register.pc += 1;
    }

    /**
     * HL = HL + BC
     */
    public 0x09 = () => {
        let ans = this.state.register.hl + this.state.register.bc;
        this.state.cc.carry(ans);
        this.state.register.hl = ans;
        // log.ops(`DAD B`);
        this.state.register.pc += 1;
    }

    /**
     * A <- (BC)
     */
    public 0x0a = () => {
        let addr = this.state.register.bc;
        this.state.register.a = this.state.memory.get(addr);
        // log.ops(`LDAX B (${addr.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * BC <- BC - 1
     */
    public 0x0b = () => {
        this.state.register.bc--;
        // log.ops(`DCX B`);
        this.state.register.pc += 1;
    }

    /**
     * Increment c
     */
    public 0x0c = () => {
        this.state.cc.setSZP(++this.state.register.c);
        // log.ops(`INR C`);
        this.state.register.pc += 1;
    }

    /**
     * Decrement b
     */
    public 0x0d = () => {
        this.state.cc.setSZP(--this.state.register.c);
        // log.ops(`DCR C`);
        this.state.register.pc += 1;
    }

    /**
     * C <- byte 2
     */
    public 0x0e = () => {
        let byte = this.state.memory.get(this.state.register.pc + 1);
        this.state.register.c = byte;
        // log.ops(`MVI C ${byte.toString(16)}`);
        this.state.register.pc += 2;
    }

    /**
     * A = A >> 1; bit 7 = prev bit 0; CY = prev bit 0
     */
    public 0x0f = () => {
        let a = this.state.register.a;
        this.state.register.a = ((a & 1) << 7) | (a >> 1);
        this.state.cc.cy = Number(1 == (a & 1));
        // log.ops(`RRC`);
        this.state.register.pc += 1;
    }

    /**
     * D <- byte 3, E <- byte 2
     */
    public 0x11 = () => {
        this.state.register.e = this.state.memory.get(this.state.register.pc + 1);
        this.state.register.d = this.state.memory.get(this.state.register.pc + 2);
        // log.ops(`LXI D ${this.state.register.de.toString(16).padStart(4, "0")}`);
        this.state.register.pc += 3;
    }

    /**
     * (DE) <- A
     */
    public 0x12 = () => {
        let addr = this.state.register.de;
        this.state.memory.set(addr, this.state.register.a);
        // log.ops(`STAX D (${addr.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * DE <- DE + 1
     */
    public 0x13 = () => {
        this.state.register.de++;
        // log.ops(`INX D`);
        this.state.register.pc += 1;
    }

    /**
     * Increment d
     */
    public 0x14 = () => {
        this.state.cc.setSZP(++this.state.register.d);
        // log.ops(`INR D`);
        this.state.register.pc += 1;
    }

    /**
     * Decrement d
     */
    public 0x15 = () => {
        this.state.cc.setSZP(--this.state.register.d);
        // log.ops(`DCR D`);
        this.state.register.pc += 1;
    }

    /**
     * D <- byte 2
     */
    public 0x16 = () => {
        let byte = this.state.memory.get(this.state.register.pc + 1);
        this.state.register.d = byte;
        // log.ops(`MVI D ${byte.toString(16)}`);
        this.state.register.pc += 2;
    }

    /**
     * A = A << 1; bit 0 = prev CY; CY = prev bit 7
     */
    public 0x17 = () => {
        let cy = this.state.register.a & 0x80;
        this.state.register.a = this.state.register.a << 1 | this.state.cc.cy;
        this.state.cc.cy = cy;
        // log.ops(`RAL`);
        this.state.register.pc += 1;
    }

    /**
     * HL = HL + DE
     */
    public 0x19 = () => {
        let ans = this.state.register.hl + this.state.register.de;
        this.state.cc.carry(ans);
        this.state.register.hl = ans;
        // log.ops(`DAD D`);
        this.state.register.pc += 1;
    }

    /**
     * A <- (DE)
     */
    public 0x1a = () => {
        let addr = this.state.register.de;
        this.state.register.a = this.state.memory.get(addr);
        // log.ops(`LDAX D (${addr.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * DE <- DE - 1
     */
    public 0x1b = () => {
        this.state.register.de--;
        // log.ops(`DCX D`);
        this.state.register.pc += 1;
    }

    /**
     * Increment e
     */
    public 0x1c = () => {
        this.state.cc.setSZP(++this.state.register.e);
        // log.ops(`INR E`);
        this.state.register.pc += 1;
    }

    /**
     * Decrement e
     */
    public 0x1d = () => {
        this.state.cc.setSZP(--this.state.register.e);
        // log.ops(`DCR E`);
        this.state.register.pc += 1;
    }

    /**
     * E <- byte 2
     */
    public 0x1e = () => {
        let byte = this.state.memory.get(this.state.register.pc + 1);
        this.state.register.e = byte;
        // log.ops(`MVI E ${byte.toString(16)}`);
        this.state.register.pc += 2;
    }

    public 0x1f = () => {
        let a = this.state.register.a;
        this.state.register.a = (this.state.cc.cy << 7) | (a >> 1);
        this.state.cc.cy = Number(1 == (a & 1));
        // log.ops(`RAR`);
        this.state.register.pc += 1;
    }

    /**
     * H <- byte 3, L <- byte 2
     */
    public 0x21 = () => {
        this.state.register.l = this.state.memory.get(this.state.register.pc + 1);
        this.state.register.h = this.state.memory.get(this.state.register.pc + 2);
        // log.ops(`LXI H ${this.state.register.hl.toString(16).padStart(4, "0")}`);
        this.state.register.pc += 3;
    }

    /**
     * (adr) <-L; (adr+1)<-H
     */
    public 0x22 = () => {
        let addr = this.state.memory.get16(this.state.register.pc + 1);
        this.state.memory.set16(addr, this.state.register.hl);
        // log.ops(`SHLD ${addr.toString(16).padStart(4, "0")}`);
        this.state.register.pc += 3;
    }

    /**
     * HL <- HL + 1
     */
    public 0x23 = () => {
        this.state.register.hl++;
        // log.ops(`INX H`);
        this.state.register.pc += 1;
    }

    /**
     * Increment h
     */
    public 0x24 = () => {
        this.state.cc.setSZP(++this.state.register.h);
        // log.ops(`INR H`);
        this.state.register.pc += 1;
    }

    /**
     * Decrement h
     */
    public 0x25 = () => {
        this.state.cc.setSZP(--this.state.register.h);
        // log.ops(`DCR H`);
        this.state.register.pc += 1;
    }

    /**
     * H <- byte 2
     */
    public 0x26 = () => {
        let byte = this.state.memory.get(this.state.register.pc + 1);
        this.state.register.h = byte;
        // log.ops(`MVI H ${byte.toString(16)}`);
        this.state.register.pc += 2;
    }

    /**
     * Decimal Adjust Accumulator
     * Treats the A register as if it was two decimal digits
     */
    public 0x27 = () => {
        if ((this.state.register.a & 0x0f) > 0x09) {
            this.state.register.a += 6;
        }
        if ((this.state.register.a & 0xf0) > 0x90) {
            let ans = this.state.register.a + 0x60
            this.state.cc.carry(ans);
            this.state.register.a = ans;
        }
        this.state.cc.setSZP(this.state.register.a);
        // log.ops(`DAA`);
        this.state.register.pc += 1;
    }

    /**
     * HL = HL + HL
     */
    public 0x29 = () => {
        let ans = this.state.register.hl + this.state.register.hl;
        this.state.cc.carry(ans);
        this.state.register.hl = ans;
        // log.ops(`DAD H`);
        this.state.register.pc += 1;
    }

    /**
     * L <- (adr); H<-(adr+1)
     */
    public 0x2a = () => {
        let addr = this.state.memory.get16(this.state.register.pc + 1);
        this.state.register.hl = this.state.memory.get16(addr);
        // log.ops(`LHLD ${addr.toString(16).padStart(4, "0")}`);
        this.state.register.pc += 3;
    }

    /**
     * HL <- HL - 1
     */
    public 0x2b = () => {
        this.state.register.hl--;
        // log.ops(`DCX H`);
        this.state.register.pc += 1;
    }

    /**
     * Increment l
     */
    public 0x2c = () => {
        this.state.cc.setSZP(++this.state.register.l);
        // log.ops(`INR L`);
        this.state.register.pc += 1;
    }

    /**
     * Decrement l
     */
    public 0x2d = () => {
        this.state.cc.setSZP(--this.state.register.l);
        // log.ops(`DCR L`);
        this.state.register.pc += 1;
    }

    /**
     * L <- byte 2
     */
    public 0x2e = () => {
        let byte = this.state.memory.get(this.state.register.pc + 1);
        this.state.register.l = byte;
        // log.ops(`MVI L ${byte.toString(16)}`);
        this.state.register.pc += 2;
    }

    /**
     * A <- !A
     */
    public 0x2f = () => {
        this.state.register.a = ~this.state.register.a;
        // log.ops(`CMA`);
        this.state.register.pc += 1;
    }

    /**
     * SP.hi <- byte 3, SP.lo <- byte 2
     */
    public 0x31 = () => {
        let sp = this.state.memory.get16(this.state.register.pc + 1);
        this.state.register.sp = sp;
        // log.ops(`LXI SP ${sp.toString(16)}`);
        this.state.register.pc += 3;
    }

    /**
     * (adr) <- A
     */
    public 0x32 = () => {
        let addr = this.state.memory.get16(this.state.register.pc + 1);
        this.state.memory.set(addr, this.state.register.a);
        // log.ops(`STA ${addr.toString(16).padStart(4, "0")}`);
        this.state.register.pc += 3;
    }

    /**
     * SP <- SP + 1
     */
    public 0x33 = () => {
        this.state.register.sp++;
        // log.ops(`INX SP`);
        this.state.register.pc += 1;
    }

    /**
     * Increment m
     */
    public 0x34 = () => {
        let m = this.state.memory.get(this.state.register.hl);
        let ans = m + 1;
        this.state.cc.setSZP(ans);
        this.state.memory.set(this.state.register.hl, ans);
        // log.ops(`INR M`);
        this.state.register.pc += 1;
    }

    /**
     * Decrement m
     */
    public 0x35 = () => {
        let m = this.state.memory.get(this.state.register.hl);
        let ans = m - 1;
        this.state.cc.setSZP(ans);
        this.state.memory.set(this.state.register.hl, ans);
        // log.ops(`DCR M`);
        this.state.register.pc += 1;
    }

    /**
     * M <- byte 2
     */
    public 0x36 = () => {
        let byte = this.state.memory.get(this.state.register.pc + 1);
        this.state.memory.set(this.state.register.hl, byte);
        // log.ops(`MVI M ${byte.toString(16)}`);
        this.state.register.pc += 2;
    }

    /**
     * CY = 1
     */
    public 0x37 = () => {
        this.state.cc.cy = 1;
        // log.ops(`STC`);
        this.state.register.pc += 1;
    }

    /**
     * HL = HL + SP
     */
    public 0x39 = () => {
        let ans = this.state.register.hl + this.state.register.sp;
        this.state.cc.carry16(ans);
        this.state.register.hl = ans;
        // log.ops(`DAD SP`);
        this.state.register.pc += 1;
    }

    /**
     * A <- (adr)
     */
    public 0x3a = () => {
        let addr = this.state.memory.get16(this.state.register.pc + 1);
        this.state.register.a = this.state.memory.get(addr);
        // log.ops(`LDAX A ${addr.toString(16).padStart(4, "0")}`);
        this.state.register.pc += 3;
    }

    /**
     * sp <- sp - 1
     */
    public 0x3b = () => {
        this.state.register.sp--;
        // log.ops(`DCX SP`);
        this.state.register.pc += 1;
    }

    /**
     * Increment a
     */
    public 0x3c = () => {
        this.state.cc.setSZP(++this.state.register.a);
        // log.ops(`INR A`);
        this.state.register.pc += 1;
    }

    /**
     * Decrement a
     */
    public 0x3d = () => {
        this.state.cc.setSZP(--this.state.register.a);
        // log.ops(`DCR A`);
        this.state.register.pc += 1;
    }

    /**
     * A <- byte 2
     */
    public 0x3e = () => {
        let byte = this.state.memory.get(this.state.register.pc + 1);
        this.state.register.a = byte;
        // log.ops(`MVI A ${byte.toString(16)}`);
        this.state.register.pc += 2;
    }

    /**
     * CY <- !CY
     */
    public 0x3f = () => {
        this.state.cc.cy = ~this.state.cc.cy & 0x01;
        // log.ops(`CMC`);
        this.state.register.pc += 1;
    }

    /**
     * Move B into B
     */
    public 0x40 = () => {
        this.state.register.b = this.state.register.b;
        // log.ops(`MOV B,B`);
        this.state.register.pc += 1;
    }

    /**
     * Move C into B
     */
    public 0x41 = () => {
        this.state.register.b = this.state.register.c;
        // log.ops(`MOV B,C`);
        this.state.register.pc += 1;
    }

    /**
     * Move D into B
     */
    public 0x42 = () => {
        this.state.register.b = this.state.register.d;
        // log.ops(`MOV B,D`);
        this.state.register.pc += 1;
    }

    /**
     * Move E into B
     */
    public 0x43 = () => {
        this.state.register.b = this.state.register.e;
        // log.ops(`MOV B,E`);
        this.state.register.pc += 1;
    }

    /**
     * Move H into B
     */
    public 0x44 = () => {
        this.state.register.b = this.state.register.h;
        // log.ops(`MOV B,H`);
        this.state.register.pc += 1;
    }

    /**
     * Move L into B
     */
    public 0x45 = () => {
        this.state.register.b = this.state.register.l;
        // log.ops(`MOV B,L`);
        this.state.register.pc += 1;
    }

    /**
     * Move (HL) into B
     */
    public 0x46 = () => {
        let addr = this.state.register.hl;
        this.state.register.b = this.state.memory.get(addr);
        // log.ops(`MOV B,M (${addr.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move A into B
     */
    public 0x47 = () => {
        this.state.register.b = this.state.register.a;
        // log.ops(`MOV B,A`);
        this.state.register.pc += 1;
    }

    /**
     * Move B into C
     */
    public 0x48 = () => {
        this.state.register.c = this.state.register.b;
        // log.ops(`MOV C,B`);
        this.state.register.pc += 1;
    }

    /**
     * Move C into C
     */
    public 0x49 = () => {
        this.state.register.c = this.state.register.c;
        // log.ops(`MOV C,C`);
        this.state.register.pc += 1;
    }

    /**
     * Move D into C
     */
    public 0x4a = () => {
        this.state.register.c = this.state.register.d;
        // log.ops(`MOV C,D`);
        this.state.register.pc += 1;
    }

    /**
     * Move E into C
     */
    public 0x4b = () => {
        this.state.register.c = this.state.register.e;
        // log.ops(`MOV C,E`);
        this.state.register.pc += 1;
    }

    /**
     * Move H into C
     */
    public 0x4c = () => {
        this.state.register.c = this.state.register.h;
        // log.ops(`MOV C,H`);
        this.state.register.pc += 1;
    }

    /**
     * Move L into C
     */
    public 0x4d = () => {
        this.state.register.c = this.state.register.l;
        // log.ops(`MOV C,L`);
        this.state.register.pc += 1;
    }

    /**
     * Move (HL) into C
     */
    public 0x4e = () => {
        let addr = this.state.register.hl;
        this.state.register.c = this.state.memory.get(addr);
        // log.ops(`MOV C,M (${addr.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move A into C
     */
    public 0x4f = () => {
        this.state.register.c = this.state.register.a;
        // log.ops(`MOV C,A`);
        this.state.register.pc += 1;
    }

    /**
     * Move B into D
     */
    public 0x50 = () => {
        this.state.register.d = this.state.register.b;
        // log.ops(`MOV D,B`);
        this.state.register.pc += 1;
    }

    /**
     * Move C into D
     */
    public 0x51 = () => {
        this.state.register.d = this.state.register.c;
        // log.ops(`MOV D,C`);
        this.state.register.pc += 1;
    }

    /**
     * Move D into D
     */
    public 0x52 = () => {
        this.state.register.d = this.state.register.d;
        // log.ops(`MOV D,D`);
        this.state.register.pc += 1;
    }

    /**
     * Move E into D
     */
    public 0x53 = () => {
        this.state.register.d = this.state.register.e;
        // log.ops(`MOV D,E`);
        this.state.register.pc += 1;
    }

    /**
     * Move H into D
     */
    public 0x54 = () => {
        this.state.register.d = this.state.register.h;
        // log.ops(`MOV D,H`);
        this.state.register.pc += 1;
    }

    /**
     * Move L into D
     */
    public 0x55 = () => {
        this.state.register.d = this.state.register.l;
        // log.ops(`MOV D,L`);
        this.state.register.pc += 1;
    }

    /**
     * Move (HL) into D
     */
    public 0x56 = () => {
        let addr = this.state.register.hl;
        this.state.register.d = this.state.memory.get(addr);
        // log.ops(`MOV D,M (${addr.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move A into D
     */
    public 0x57 = () => {
        this.state.register.d = this.state.register.a;
        // log.ops(`MOV D,A`);
        this.state.register.pc += 1;
    }

    /**
     * Move B into E
     */
    public 0x58 = () => {
        this.state.register.e = this.state.register.b;
        // log.ops(`MOV E,B`);
        this.state.register.pc += 1;
    }

    /**
     * Move C into E
     */
    public 0x59 = () => {
        this.state.register.e = this.state.register.c;
        // log.ops(`MOV E,C`);
        this.state.register.pc += 1;
    }

    /**
     * Move D into E
     */
    public 0x5a = () => {
        this.state.register.e = this.state.register.d;
        // log.ops(`MOV E,D`);
        this.state.register.pc += 1;
    }

    /**
     * Move E into E
     */
    public 0x5b = () => {
        this.state.register.e = this.state.register.e;
        // log.ops(`MOV E,E`);
        this.state.register.pc += 1;
    }

    /**
     * Move H into E
     */
    public 0x5c = () => {
        this.state.register.e = this.state.register.h;
        // log.ops(`MOV E,H`);
        this.state.register.pc += 1;
    }

    /**
     * Move L into E
     */
    public 0x5d = () => {
        this.state.register.e = this.state.register.l;
        // log.ops(`MOV E,L`);
        this.state.register.pc += 1;
    }

    /**
     * Move (HL) into E
     */
    public 0x5e = () => {
        let addr = this.state.register.hl;
        this.state.register.e = this.state.memory.get(addr);
        // log.ops(`MOV E,M (${addr.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move A into E
     */
    public 0x5f = () => {
        this.state.register.e = this.state.register.a;
        // log.ops(`MOV E,A`);
        this.state.register.pc += 1;
    }

    /**
     * Move B into H
     */
    public 0x60 = () => {
        this.state.register.h = this.state.register.b;
        // log.ops(`MOV H,B`);
        this.state.register.pc += 1;
    }

    /**
     * Move C into H
     */
    public 0x61 = () => {
        this.state.register.h = this.state.register.c;
        // log.ops(`MOV H,C`);
        this.state.register.pc += 1;
    }

    /**
     * Move D into H
     */
    public 0x62 = () => {
        this.state.register.h = this.state.register.d;
        // log.ops(`MOV H,D`);
        this.state.register.pc += 1;
    }

    /**
     * Move E into H
     */
    public 0x63 = () => {
        this.state.register.h = this.state.register.e;
        // log.ops(`MOV H,E`);
        this.state.register.pc += 1;
    }

    /**
     * Move H into H
     */
    public 0x64 = () => {
        this.state.register.h = this.state.register.h;
        // log.ops(`MOV H,H`);
        this.state.register.pc += 1;
    }

    /**
     * Move L into H
     */
    public 0x65 = () => {
        this.state.register.h = this.state.register.l;
        // log.ops(`MOV H,L`);
        this.state.register.pc += 1;
    }

    /**
     * Move (HL) into H
     */
    public 0x66 = () => {
        let addr = this.state.register.hl;
        this.state.register.h = this.state.memory.get(addr);
        // log.ops(`MOV H,M (${addr.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move A into H
     */
    public 0x67 = () => {
        this.state.register.h = this.state.register.a;
        // log.ops(`MOV H,A`);
        this.state.register.pc += 1;
    }

    /**
     * Move B into L
     */
    public 0x68 = () => {
        this.state.register.l = this.state.register.b;
        // log.ops(`MOV L,B`);
        this.state.register.pc += 1;
    }

    /**
     * Move C into L
     */
    public 0x69 = () => {
        this.state.register.l = this.state.register.c;
        // log.ops(`MOV L,C`);
        this.state.register.pc += 1;
    }

    /**
     * Move D into L
     */
    public 0x6a = () => {
        this.state.register.l = this.state.register.d;
        // log.ops(`MOV L,D`);
        this.state.register.pc += 1;
    }

    /**
     * Move E into L
     */
    public 0x6b = () => {
        this.state.register.l = this.state.register.e;
        // log.ops(`MOV L,E`);
        this.state.register.pc += 1;
    }

    /**
     * Move H into L
     */
    public 0x6c = () => {
        this.state.register.l = this.state.register.h;
        // log.ops(`MOV L,H`);
        this.state.register.pc += 1;
    }

    /**
     * Move L into L
     */
    public 0x6d = () => {
        this.state.register.l = this.state.register.l;
        // log.ops(`MOV L,L`);
        this.state.register.pc += 1;
    }

    /**
     * Move (HL) into L
     */
    public 0x6e = () => {
        let addr = this.state.register.hl;
        this.state.register.l = this.state.memory.get(addr);
        // log.ops(`MOV L,M (${addr.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move A into L
     */
    public 0x6f = () => {
        this.state.register.l = this.state.register.a;
        // log.ops(`MOV L,A`);
        this.state.register.pc += 1;
    }

    /**
     * Move B into M
     */
    public 0x70 = () => {
        let m = this.state.register.hl;
        this.state.memory.set(m, this.state.register.b);
        // log.ops(`MOV M,B (${m.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move C into M
     */
    public 0x71 = () => {
        let m = this.state.register.hl;
        this.state.memory.set(m, this.state.register.c);
        // log.ops(`MOV M,C (${m.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move D into M
     */
    public 0x72 = () => {
        let m = this.state.register.hl;
        this.state.memory.set(m, this.state.register.d);
        // log.ops(`MOV M,D (${m.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move E into M
     */
    public 0x73 = () => {
        let m = this.state.register.hl;
        this.state.memory.set(m, this.state.register.e);
        // log.ops(`MOV M,E (${m.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move H into M
     */
    public 0x74 = () => {
        let m = this.state.register.hl;
        this.state.memory.set(m, this.state.register.h);
        // log.ops(`MOV M,H (${m.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move L into M
     */
    public 0x75 = () => {
        let m = this.state.register.hl;
        this.state.memory.set(m, this.state.register.l);
        // log.ops(`MOV M,L (${m.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * HALT
     */
    public 0x76 = () => {
        this.state.register.pc += 1;
        this.state.pause();
        console.log("HALT");
        // log.ops("HLT");
    }

    /**
     * Move A into M
     */
    public 0x77 = () => {
        let m = this.state.register.hl;
        this.state.memory.set(m, this.state.register.a);
        // log.ops(`MOV M,A (${m.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move B into A
     */
    public 0x78 = () => {
        this.state.register.a = this.state.register.b;
        // log.ops(`MOV A,B`);
        this.state.register.pc += 1;
    }

    /**
     * Move C into A
     */
    public 0x79 = () => {
        this.state.register.a = this.state.register.c;
        // log.ops(`MOV A,C`);
        this.state.register.pc += 1;
    }

    /**
     * Move D into A
     */
    public 0x7a = () => {
        this.state.register.a = this.state.register.d;
        // log.ops(`MOV A,D`);
        this.state.register.pc += 1;
    }

    /**
     * Move E into A
     */
    public 0x7b = () => {
        this.state.register.a = this.state.register.e;
        // log.ops(`MOV A,E`);
        this.state.register.pc += 1;
    }

    /**
     * Move H into A
     */
    public 0x7c = () => {
        this.state.register.a = this.state.register.h;
        // log.ops(`MOV A,H`);
        this.state.register.pc += 1;
    }

    /**
     * Move L into A
     */
    public 0x7d = () => {
        this.state.register.a = this.state.register.l;
        // log.ops(`MOV A,L`);
        this.state.register.pc += 1;
    }

    /**
     * Move (HL) into A
     */
    public 0x7e = () => {
        let addr = this.state.register.hl;
        this.state.register.a = this.state.memory.get(addr);
        // log.ops(`MOV A,M (${addr.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move A into A
     */
    public 0x7f = () => {
        this.state.register.a = this.state.register.a;
        // log.ops(`MOV A,A`);
        this.state.register.pc += 1;
    }

    /**
     * A <- A + B
     */
    public 0x80 = () => {
        let ans = this.state.register.a + this.state.register.b;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ADD B`);
    }

    /**
     * A <- A + C
     */
    public 0x81 = () => {
        let ans = this.state.register.a + this.state.register.c;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ADD C`);
    }

    /**
     * A <- A + D
     */
    public 0x82 = () => {
        let ans = this.state.register.a + this.state.register.d;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ADD D`);
    }

    /**
     * A <- A + E
     */
    public 0x83 = () => {
        let ans = this.state.register.a + this.state.register.e;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ADD E`);
    }

    /**
     * A <- A + H
     */
    public 0x84 = () => {
        let ans = this.state.register.a + this.state.register.h;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ADD H`);
    }

    /**
     * A <- A + L
     */
    public 0x85 = () => {
        let ans = this.state.register.a + this.state.register.l;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ADD L`);
    }

    /**
     * A <- A + (HL)
     */
    public 0x86 = () => {
        let ans = this.state.register.a + this.state.memory.get(this.state.register.hl);
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ADD (HL)`);
    }

    /**
     * A <- A + A
     */
    public 0x87 = () => {
        let ans = this.state.register.a + this.state.register.a;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ADD A`);
    }

    /**
     * A <- A + B + CY
     */
    public 0x88 = () => {
        let ans = this.state.register.a + this.state.register.b + this.state.cc.cy;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ADC B`);
    }

    /**
     * A <- A + C + CY
     */
    public 0x89 = () => {
        let ans = this.state.register.a + this.state.register.c + this.state.cc.cy;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ADC C`);
    }

    /**
     * A <- A + D + CY
     */
    public 0x8a = () => {
        let ans = this.state.register.a + this.state.register.d + this.state.cc.cy;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ADC D`);
    }

    /**
     * A <- A + E + CY
     */
    public 0x8b = () => {
        let ans = this.state.register.a + this.state.register.e + this.state.cc.cy;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ADC E`);
    }

    /**
     * A <- A + H + CY
     */
    public 0x8c = () => {
        let ans = this.state.register.a + this.state.register.h + this.state.cc.cy;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ADC H`);
    }

    /**
     * A <- A + L + CY
     */
    public 0x8d = () => {
        let ans = this.state.register.a + this.state.register.l + this.state.cc.cy;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ADC L`);
    }

    /**
     * A <- A + (HL) + CY
     */
    public 0x8e = () => {
        let ans = this.state.register.a + this.state.memory.get(this.state.register.hl) + this.state.cc.cy;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ADC (HL)`);
    }

    /**
     * A <- A + A + CY
     */
    public 0x8f = () => {
        let ans = this.state.register.a + this.state.register.a + this.state.cc.cy;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ADC A`);
    }

    /**
     * A <- A - B
     */
    public 0x90 = () => {
        let ans = this.state.register.a - this.state.register.b;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`SUB B`);
    }

    /**
     * A <- A - C
     */
    public 0x91 = () => {
        let ans = this.state.register.a - this.state.register.c;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`SUB C`);
    }

    /**
     * A <- A - D
     */
    public 0x92 = () => {
        let ans = this.state.register.a - this.state.register.d;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`SUB D`);
    }

    /**
     * A <- A - E
     */
    public 0x93 = () => {
        let ans = this.state.register.a - this.state.register.e;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`SUB E`);
    }

    /**
     * A <- A - H
     */
    public 0x94 = () => {
        let ans = this.state.register.a - this.state.register.h;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`SUB H`);
    }

    /**
     * A <- A - L
     */
    public 0x95 = () => {
        let ans = this.state.register.a - this.state.register.l;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`SUB L`);
    }

    /**
     * A <- A - (HL)
     */
    public 0x96 = () => {
        let ans = this.state.register.a - this.state.memory.get(this.state.register.hl);
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`SUB (HL)`);
    }

    /**
     * A <- A - A
     */
    public 0x97 = () => {
        let ans = this.state.register.a - this.state.register.a;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`SUB A`);
    }

    /**
     * A <- A - B - CY
     */
    public 0x98 = () => {
        let ans = this.state.register.a - this.state.register.b - this.state.cc.cy;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`SBB B`);
    }

    /**
     * A <- A - C - CY
     */
    public 0x99 = () => {
        let ans = this.state.register.a - this.state.register.c - this.state.cc.cy;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`SBB C`);
    }

    /**
     * A <- A - D - CY
     */
    public 0x9a = () => {
        let ans = this.state.register.a - this.state.register.d - this.state.cc.cy;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`SBB D`);
    }

    /**
     * A <- A - E - CY
     */
    public 0x9b = () => {
        let ans = this.state.register.a - this.state.register.e - this.state.cc.cy;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`SBB E`);
    }

    /**
     * A <- A - H - CY
     */
    public 0x9c = () => {
        let ans = this.state.register.a - this.state.register.h - this.state.cc.cy;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`SBB H`);
    }

    /**
     * A <- A - L - CY
     */
    public 0x9d = () => {
        let ans = this.state.register.a - this.state.register.l - this.state.cc.cy;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`SBB L`);
    }

    /**
     * A <- A - (HL) - CY
     */
    public 0x9e = () => {
        let ans = this.state.register.a - this.state.memory.get(this.state.register.hl) - this.state.cc.cy;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`SBB (HL)`);
    }

    /**
     * A <- A - A - CY
     */
    public 0x9f = () => {
        let ans = this.state.register.a - this.state.register.a - this.state.cc.cy;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`SBB A`);
    }

    /**
     * A <- A & B
     */
    public 0xa0 = () => {
        let ans = this.state.register.a & this.state.register.b;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ANA B`);
    }

    /**
     * A <- A & C
     */
    public 0xa1 = () => {
        let ans = this.state.register.a & this.state.register.c;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ANA C`);
    }

    /**
     * A <- A & D
     */
    public 0xa2 = () => {
        let ans = this.state.register.a & this.state.register.d;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ANA D`);
    }

    /**
     * A <- A & E
     */
    public 0xa3 = () => {
        let ans = this.state.register.a & this.state.register.e;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ANA E`);
    }

    /**
     * A <- A & H
     */
    public 0xa4 = () => {
        let ans = this.state.register.a & this.state.register.h;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ANA H`);
    }

    /**
     * A <- A & L
     */
    public 0xa5 = () => {
        let ans = this.state.register.a & this.state.register.l;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ANA L`);
    }

    /**
     * A <- A & (HL)
     */
    public 0xa6 = () => {
        let ans = this.state.register.a & this.state.memory.get(this.state.register.hl);
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ANA (HL)`);
    }

    /**
     * A <- A & A
     */
    public 0xa7 = () => {
        let ans = this.state.register.a & this.state.register.a;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ANA A`);
    }

    /**
     * A <- A ^ B
     */
    public 0xa8 = () => {
        let ans = this.state.register.a ^ this.state.register.b;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`XRA B`);
    }

    /**
     * A <- A ^ C
     */
    public 0xa9 = () => {
        let ans = this.state.register.a ^ this.state.register.c;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`XRA C`);
    }

    /**
     * A <- A ^ D
     */
    public 0xaa = () => {
        let ans = this.state.register.a ^ this.state.register.d;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`XRA D`);
    }

    /**
     * A <- A ^ E
     */
    public 0xab = () => {
        let ans = this.state.register.a ^ this.state.register.e;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`XRA E`);
    }

    /**
     * A <- A ^ H
     */
    public 0xac = () => {
        let ans = this.state.register.a ^ this.state.register.h;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`XRA H`);
    }

    /**
     * A <- A ^ L
     */
    public 0xad = () => {
        let ans = this.state.register.a ^ this.state.register.l;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`XRA L`);
    }

    /**
     * A <- A ^ (HL)
     */
    public 0xae = () => {
        let ans = this.state.register.a ^ this.state.memory.get(this.state.register.hl);
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`XRA (HL)`);
    }

    /**
     * A <- A ^ A
     */
    public 0xaf = () => {
        let ans = this.state.register.a ^ this.state.register.a;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`XRA A`);
    }

    /**
     * A <- A | B
     */
    public 0xb0 = () => {
        let ans = this.state.register.a | this.state.register.b;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ORA B`);
    }

    /**
     * A <- A | C
     */
    public 0xb1 = () => {
        let ans = this.state.register.a | this.state.register.c;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ORA C`);
    }

    /**
     * A <- A | D
     */
    public 0xb2 = () => {
        let ans = this.state.register.a | this.state.register.d;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ORA D`);
    }

    /**
     * A <- A | E
     */
    public 0xb3 = () => {
        let ans = this.state.register.a | this.state.register.e;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ORA E`);
    }

    /**
     * A <- A | H
     */
    public 0xb4 = () => {
        let ans = this.state.register.a | this.state.register.h;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ORA H`);
    }

    /**
     * A <- A | L
     */
    public 0xb5 = () => {
        let ans = this.state.register.a | this.state.register.l;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ORA L`);
    }

    /**
     * A <- A | (HL)
     */
    public 0xb6 = () => {
        let ans = this.state.register.a | this.state.memory.get(this.state.register.hl);
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ORA (HL)`);
    }

    /**
     * A <- A | A
     */
    public 0xb7 = () => {
        let ans = this.state.register.a | this.state.register.a;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        // log.ops(`ORA A`);
    }

    /**
     * A - B
     */
    public 0xb8 = () => {
        let ans = this.state.register.a - this.state.register.b;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.pc += 1;
        // log.ops(`CMP B`);
    }

    /**
     * A - C
     */
    public 0xb9 = () => {
        let ans = this.state.register.a - this.state.register.c;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.pc += 1;
        // log.ops(`CMP C`);
    }

    /**
     * A - D
     */
    public 0xba = () => {
        let ans = this.state.register.a - this.state.register.d;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.pc += 1;
        // log.ops(`CMP D`);
    }

    /**
     * A - E
     */
    public 0xbb = () => {
        let ans = this.state.register.a - this.state.register.e;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.pc += 1;
        // log.ops(`CMP E`);
    }

    /**
     * A - H
     */
    public 0xbc = () => {
        let ans = this.state.register.a - this.state.register.h;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.pc += 1;
        // log.ops(`CMP H`);
    }

    /**
     * A - L
     */
    public 0xbd = () => {
        let ans = this.state.register.a - this.state.register.l;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.pc += 1;
        // log.ops(`CMP L`);
    }

    /**
     * A - (HL)
     */
    public 0xbe = () => {
        let ans = this.state.register.a - this.state.memory.get(this.state.register.hl);
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.pc += 1;
        // log.ops(`CMP (HL)`);
    }

    /**
     * A - A
     */
    public 0xbf = () => {
        let ans = this.state.register.a - this.state.register.a;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.pc += 1;
        // log.ops(`CMP A`);
    }

    /**
     * if NZ, RET
     */
    public 0xc0 = () => {
        if (this.state.cc.z !== 0) {
            this.state.register.pc += 1;
            // log.ops(`RNZ`);
            return;
        }
        this.return("RNZ");
    }

    /**
     * C <- (sp); B <- (sp+1); sp <- sp+2
     */
    public 0xc1 = () => {
        this.state.register.bc = this.pop();
        this.state.register.pc += 1;
        // log.ops(`POP B`);
    }

    /**
     * if NZ, PC <- adr
     */
    public 0xc2 = () => {
        if (this.state.cc.z !== 0) {
            this.state.register.pc += 3;
            // log.ops(`JNZ`);
            return;
        }
        this.jump("JNZ");
    }

    /**
     * PC <= adr
     */
    public 0xc3 = () => {
        this.jump("JMP");
    }

    /**
     * if NZ, CALL adr
     */
    public 0xc4 = () => {
        if (this.state.cc.z !== 0) {
            this.state.register.pc += 3;
            // log.ops(`CNZ`);
            return;
        }
        this.call("CNZ");
    }

    /**
     * (sp-2)<-C; (sp-1)<-B; sp <- sp - 2
     */
    public 0xc5 = () => {
        this.push(this.state.register.bc);
        this.state.register.pc += 1;
        // log.ops(`PUSH B`);
    }

    /**
     * A <- A + byte
     */
    public 0xc6 = () => {
        let byte = this.state.memory.get(this.state.register.pc + 1);
        let ans = this.state.register.a + byte;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 2;
        // log.ops(`ADI ${byte.toString(16)}`);
    }

    /**
     * CALL $0
     */
    public 0xc7 = () => {
        this.rst(0x00);
    }

    /**
     * if Z, RET
     */
    public 0xc8 = () => {
        if (this.state.cc.z === 0) {
            this.state.register.pc += 1;
            // log.ops(`RZ`);
            return;
        }
        this.return("RZ");
    }

    /**
     * Return to the address on the stack
     * PC.lo <- (sp); PC.hi<-(sp+1); SP <- SP+2
     */
    public 0xc9 = () => {
        this.return("RET");
    }

    /**
     * Jump to address contained in bytes 2 and 3 if z is 1
     */
    public 0xca = () => {
        if (this.state.cc.z === 0) {
            this.state.register.pc += 3;
            // log.ops(`JZ`);
            return;
        }
        this.jump("JZ");
    }

    /**
     * if Z, CALL adr
     */
    public 0xcc = () => {
        if (this.state.cc.z === 0) {
            this.state.register.pc += 3;
            // log.ops(`CZ`);
            return;
        }
        this.call("CZ");
    }

    /**
     * (SP-1)<-PC.hi;(SP-2)<-PC.lo;SP<-SP-2;PC=adr
     */
    public 0xcd = () => {
        // if (cpudiag) {
        //     if (this.state.memory.get16(this.state.register.pc + 1) == 0x05) {
        //         // log.ops(`CALL ${this.state.memory.get16(this.state.register.pc + 1)}`);
        //         if (this.state.register.c === 0x09) {
        //             let addr = this.state.register.de;
        //             let chr = String.fromCharCode(this.state.memory.get(addr));
        //             let str = "";
        //             while (chr !== "$") {
        //                 str += chr;
        //                 chr = String.fromCharCode(this.state.memory.get(++addr));
        //             }
        //             console.log(str);
        //             this.state.ready = false;
        //             this.state.register.pc += 3;
        //             return;
        //         } else if (this.state.register.c === 0x02) {
        //             console.log("print routine called");
        //             this.state.ready = false;
        //             this.state.register.pc += 3;
        //             return;
        //         }
        //     } else if (this.state.memory.get16(this.state.register.pc + 1) === 0x00) {
        //         // log.ops(`CALL ${this.state.memory.get16(this.state.register.pc + 1)}`);
        //         this.state.ready = false;
        //         console.log("other print routine called");
        //         this.state.register.pc += 3;
        //         return;
        //     }
        // }
        this.call("CALL");
    }

    /**
     * A <- A + data + CY
     */
    public 0xce = () => {
        let data = this.state.memory.get(this.state.register.pc + 1);
        let ans = this.state.register.a + data + this.state.cc.cy;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 2;
        // log.ops(`ACI ${data}`);
    }

    /**
     * CALL $8
     */
    public 0xcf = () => {
        this.rst(0x08);
    }

    /**
     * if NCY, RET
     */
    public 0xd0 = () => {
        if (this.state.cc.cy !== 0) {
            this.state.register.pc += 1;
            // log.ops(`RNC`);
            return;
        }
        this.return("RNC");
    }

    /**
     * E <- (sp); D <- (sp+1); sp <- sp+2
     */
    public 0xd1 = () => {
        this.state.register.de = this.pop();
        this.state.register.pc += 1;
        // log.ops(`POP D`);
    }

    /**
     * if CY, PC <- adr
     */
    public 0xd2 = () => {
        if (this.state.cc.cy !== 0) {
            this.state.register.pc += 3;
            // log.ops(`JNC`);
            return;
        }
        this.jump("JNC");
    }

    /**
     * Write to the I/O port
     */
    public 0xd3 = () => {
        let port = this.state.memory.get(this.state.register.pc + 1);
        // log.ops(`OUT ${port.toString(16)} (${this.state.register.a})`);
        try {
            this.state.io[port] = this.state.register.a;
        } catch(e) {
            throw "Unimplemented io port access";
        }
        this.state.register.pc += 2;
    }

    /**
     * if CY, CALL adr
     */
    public 0xd4 = () => {
        if (this.state.cc.cy !== 0) {
            this.state.register.pc += 3;
            // log.ops(`CNC`);
            return;
        }
        this.call("CNC");
    }

    /**
     * (sp-2)<-E; (sp-1)<-D; sp <- sp - 2
     */
    public 0xd5 = () => {
        this.push(this.state.register.de);
        this.state.register.pc += 1;
        // log.ops(`PUSH D`);
    }

    /**
     * A <- A - data
     */
    public 0xd6 = () => {
        let data = this.state.memory.get(this.state.register.pc + 1);
        let ans = this.state.register.a - data;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 2;
        // log.ops(`SUI ${data}`);
    }

    /**
     * CALL $10
     */
    public 0xd7 = () => {
        this.rst(0x10);
    }

    /**
     * if CY, RET
     */
    public 0xd8 = () => {
        if (this.state.cc.cy === 0) {
            this.state.register.pc += 1;
            // log.ops(`RC`);
            return;
        }
        this.return("RC");
    }

    /**
     * if CY, PC<-adr
     */
    public 0xda = () => {
        if (this.state.cc.cy === 0) {
            this.state.register.pc += 3;
            // log.ops(`JC`);
            return;
        }
        this.jump("JC");
    }

    /**
     * Read from the I/O port
     */
    public 0xdb = () => {
        let port = this.state.memory.get(this.state.register.pc + 1);
        try {
            this.state.register.a = this.state.io[port];
        } catch(e) {
            throw "Unimplemented io port access";
        }
        // log.ops(`IN ${port.toString(16)} (${this.state.register.a})`);
        this.state.register.pc += 2;
    }

    /**
     * if CY, CALL adr
     */
    public 0xdc = () => {
        if (this.state.cc.cy === 0) {
            this.state.register.pc += 3;
            // log.ops(`CC`);
            return;
        }
        this.call("CC");
    }

    /**
     * A <- A - data - CY
     */
    public 0xde = () => {
        let data = this.state.memory.get(this.state.register.pc + 1);
        let ans = this.state.register.a - data - this.state.cc.cy;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 2;
        // log.ops(`SBI ${data}`);
    }

    /**
     * CALL $18
     */
    public 0xdf = () => {
        this.rst(0x18);
    }

    /**
     * if Parity Odd, RET
     */
    public 0xe0 = () => {
        if (this.state.cc.p !== 0) {
            this.state.register.pc += 1;
            // log.ops(`RPO`);
            return;
        }
        this.return("RPO");
    }

    /**
     * L <- (sp); H <- (sp+1); sp <- sp+2
     */
    public 0xe1 = () => {
        this.state.register.hl = this.pop();
        this.state.register.pc += 1;
        // log.ops(`POP H`);
    }

    /**
     * if PO, PC <- adr
     */
    public 0xe2 = () => {
        if (this.state.cc.p !== 0) {
            this.state.register.pc += 3;
            // log.ops(`JPO`);
            return;
        }
        this.jump("JPO");
    }

    /**
     * L <-> (SP); H <-> (SP+1)
     */
    public 0xe3 = () => {
        let hl = this.state.register.hl;
        this.state.register.hl = this.state.memory.get16(this.state.register.sp);
        this.state.memory.set16(this.state.register.sp, hl);
        this.state.register.pc += 1;
        this.pop();
        this.push(hl);
        // log.ops(`XTHL`);
    }

    /**
     * if PO, CALL adr
     */
    public 0xe4 = () => {
        if (this.state.cc.p !== 0) {
            this.state.register.pc += 3;
            // log.ops(`CPO`);
            return;
        }
        this.call("CPO");
    }

    /**
     * (sp-2)<-L; (sp-1)<-H; sp <- sp - 2
     */
    public 0xe5 = () => {
        this.push(this.state.register.hl);
        this.state.register.pc += 1;
        // log.ops(`PUSH H`);
    }

    /**
     * A <- A & data
     */
    public 0xe6 = () => {
        let data = this.state.memory.get(this.state.register.pc + 1);
        let ans = this.state.register.a & data;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 2;
        // log.ops(`ANI ${data}`);
    }

    /**
     * CALL $20
     */
    public 0xe7 = () => {
        this.rst(0x20);
    }

    /**
     * if Parity Even, RET
     */
    public 0xe8 = () => {
        if (this.state.cc.p === 0) {
            this.state.register.pc += 1;
            // log.ops(`RPE`);
            return;
        }
        this.return("RPE");
    }

    /**
     * PC.hi <- H; PC.lo <- L
     */
    public 0xe9 = () => {
        this.state.register.pc = this.state.register.hl;
        // log.ops(`PCHL`);
    }

    /**
     * if PE, PC<-adr
     */
    public 0xea = () => {
        if (this.state.cc.p === 0) {
            this.state.register.pc += 3;
            // log.ops(`JPE`);
            return;
        }
        this.jump("JPE");
    }

    /**
     * H <-> D; L <-> E
     */
    public 0xeb = () => {
        [this.state.register.de, this.state.register.hl] = [this.state.register.hl, this.state.register.de];
        this.state.register.pc += 1;
        // log.ops(`XCHG`);
    }

    /**
     * if PE, CALL adr
     */
    public 0xec = () => {
        if (this.state.cc.p === 0) {
            this.state.register.pc += 3;
            // log.ops(`CPE`);
            return;
        }
        this.call("CPE");
    }

    /**
     * A <- A ^ data
     */
    public 0xee = () => {
        let data = this.state.memory.get(this.state.register.pc + 1);
        let ans = this.state.register.a ^ data;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 2;
        // log.ops(`XRI ${data}`);
    }

    /**
     * CALL $28
     */
    public 0xef = () => {
        this.rst(0x28);
    }

    /**
     * if positive, RET
     */
    public 0xf0 = () => {
        if (this.state.cc.s !== 0) {
            this.state.register.pc += 1;
            // log.ops(`RP`);
            return;
        }
        this.return("RP");
    }

    /**
     * flags <- (sp); A <- (sp+1); sp <- sp+2
     */
    public 0xf1 = () => {
        this.state.register.psw = this.pop();
        this.state.register.pc += 1;
        // log.ops(`POP H`);
    }

    /**
     * if P, PC <- adr
     */
    public 0xf2 = () => {
        if (this.state.cc.s !== 0) {
            this.state.register.pc += 3;
            // log.ops(`JP`);
            return;
        }
        this.jump("JP");
    }

    /**
     * Disable Interrupts
     */
    public 0xf3 = () => {
        this.state.int = false;
        this.state.register.pc += 1;
        // log.ops(`DI`);
    }

    /**
     * if P, CALL adr
     */
    public 0xf4 = () => {
        if (this.state.cc.s !== 0) {
            this.state.register.pc += 3;
            // log.ops(`CP`);
            return;
        }
        this.call("CP");
    }

    /**
     * (sp-2)<-flags; (sp-1)<-A; sp <- sp - 2
     */
    public 0xf5 = () => {
        this.push(this.state.register.psw);
        this.state.register.pc += 1;
        // log.ops(`PUSH PSW`);
    }

    /**
     * A <- A | data
     */
    public 0xf6 = () => {
        let data = this.state.memory.get(this.state.register.pc + 1);
        let ans = this.state.register.a | data;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 2;
        // log.ops(`SBI ${data}`);
    }

    /**
     * CALL $30
     */
    public 0xf7 = () => {
        this.rst(0x30);
    }

    /**
     * if negative, RET
     */
    public 0xf8 = () => {
        if (this.state.cc.s === 0) {
            this.state.register.pc += 1;
            // log.ops(`RM`);
            return;
        }
        this.return("RM");
    }

    /**
     * SP=HL
     */
    public 0xf9 = () => {
        this.state.register.sp = this.state.register.hl;
        this.state.register.pc += 1;
        // log.ops(`SPHL`);
    }

    /**
     * if N, PC<-adr
     */
    public 0xfa = () => {
        if (this.state.cc.s === 0) {
            this.state.register.pc += 3;
            // log.ops(`JM`);
            return;
        }
        this.jump("JM");
    }

    /**
     * Enable Interrupts
     */
    public 0xfb = () => {
        this.state.int = true;
        this.state.register.pc += 1;
        // log.ops(`EI`);
    }

    /**
     * if M, CALL adr
     */
    public 0xfc = () => {
        if (this.state.cc.s === 0) {
            this.state.register.pc += 3;
            // log.ops(`CM`);
            return;
        }
        this.call("CM");
    }

    /**
     * A - data
     */
    public 0xfe = () => {
        let byte = this.state.memory.get(this.state.register.pc + 1);
        let ans = this.state.register.a - byte;
        this.state.cc.setSZP(ans);
        this.state.cc.cy = Number(this.state.register.a < byte);
        this.state.register.pc += 2;
        // log.ops(`CPI ${byte.toString(16)}`);
    }

    /**
     * CALL $38
     */
    public 0xff = () => {
        this.rst(0x38);
    }

    /**
     * Call address contained in bytes 2 and 3
     *
     * @param {string} type
     */
    private call(type: string): void {
        this.push(this.state.register.pc + 3);
        this.state.register.pc = this.state.memory.get16(this.state.register.pc + 1);
        // log.ops(`${type} ${this.state.register.pc.toString(16)}`);
    }

    /**
     * Jump to address contained in bytes 2 and 3
     */
    private jump(type: string): void {
        let addr = this.state.memory.get16(this.state.register.pc + 1);
        this.state.register.pc = addr;
        // log.ops(`${type} ${addr.toString(16)}`);
    }

    /**
     * Pop a value off the stack
     */
    private pop(): number {
        let val = this.state.memory.get16(this.state.register.sp);
        this.state.register.sp += 2;
        this.state.stack.pop();
        return val;
    }

    /**
     * Push a value onto the stack
     *
     * @param {number} val Value to store
     */
    private push(val: number): void {
        this.state.register.sp -= 2;
        this.state.memory.set16(this.state.register.sp, val);
        this.state.stack.push(val.toString(16).padStart(4, "0"));
    }

    /**
     * Return to the address on the stack
     *
     * @param {string} type
     */
    private return(type: string): void {
        this.state.register.pc = this.pop();
        // this.state.register.pc += 1;
        // log.ops(`${type} ${this.state.register.pc.toString(16)}`);
    }

    /**
     * Call address contained in bytes 2 and 3
     *
     * @param {string} type
     */
    private rst(addr: number): void {
        this.push(this.state.register.pc);
        this.state.register.pc = addr;
        // log.ops(`RST ${addr.toString(16).padStart(2, "0")}`);
    }

    /**
     * Creates an instance of OpCodes.
     * @param {State8080} state 8080 being used
     */
    constructor(state: State8080) {
        this.state = state;
    }
}

/**
 * Polyfill for ArrayBuffer transfer ability
 */
if (typeof ArrayBuffer.transfer === "undefined") {
    ArrayBuffer.transfer = function(source: ArrayBuffer, length: number) {
        if (!(source instanceof ArrayBuffer))
            throw new TypeError('Source must be an instance of ArrayBuffer');
        if (length <= source.byteLength)
            return source.slice(0, length);
        let sourceView = new Uint8Array(source);
        let destView = new Uint8Array(new ArrayBuffer(length));
        let offset = 0;//cpudiag ? 0x100 : 0;
        destView.set(sourceView, offset);
        return destView.buffer;
    };
}
