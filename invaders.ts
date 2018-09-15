/**
 * $2000 is the start of the program's "work ram"
 * $2400 is the start of the video memory
 * 8080 is little endian
 * lo.hi => 21.43 == 0x4321
 */

let invaders: State8080;
let logging_enabled: boolean = true;
let log: Logger;

/**
 * Load rom into memory
 */
function loadRom(): void {
    log = new Logger();
    invaders = new State8080("invaders");
    let run_btn = document.getElementById("run");
    if (run_btn) {
        run_btn.addEventListener("click", (e) => { e.preventDefault(); invaders.run(); });
    }
    let pause_btn = document.getElementById("pause");
    if (pause_btn) {
        pause_btn.addEventListener("click", (e) => { e.preventDefault(); invaders.pause(); });
    }
    let step_btn = document.getElementById("step");
    if (step_btn) {
        step_btn.addEventListener("click", (e) => { e.preventDefault(); invaders.step(); });
    }
}

window.onload = loadRom;


/**
 * 8080 condition codes
 *
 * @class ConditionCodes
 */
class ConditionCodes {
    private _z: number; // Result equal to zero
    private _s: number; // bit 7 is 1
    private _p: number; // Even parity
    private _cy: number; // Carry/Borrow
    private _ac: number; // Aux carry

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
        this.cy = Number(result > 0xff);
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
                p++
            }
            x = x >> 1;
        }
        return Number((p & 0x1) == 0);
    }

    /**
     * Get z condition
     */
    public get z(): number {
        return this._z;
    }

    /**
     * Set z condition
     */
    public set z(v : number) {
        log.reg("z", v);
        this._z = v ? 1 : 0;
    }

    /**
     * Get s condition
     */
    public get s(): number {
        return this._s;
    }

    /**
     * Set s condition
     */
    public set s(v : number) {
        log.reg("s", v);
        this._s = v ? 1 : 0;
    }

    /**
     * Get p condition
     */
    public get p(): number {
        return this._p;
    }

    /**
     * Set p condition
     */
    public set p(v : number) {
        log.reg("p", v);
        this._p = v ? 1 : 0;
    }

    /**
     * Get cy condition
     */
    public get cy(): number {
        return this._cy;
    }

    /**
     * Set cy condition
     */
    public set cy(v : number) {
        log.reg("cy", v);
        this._cy = v ? 1 : 0;
    }

    /**
     * Get ac condition
     */
    public get ac(): number {
        return this._ac;
    }

    /**
     * Set ac condition
     */
    public set ac(v : number) {
        log.reg("ac", v);
        this._ac = v ? 1 : 0;
    }
}

/**
 * 8080 registers
 *
 * @class Registers
 */
class Registers {
    private _a: number;
    private _b: number;
    private _c: number;
    private _d: number;
    private _e: number;
    private _h: number;
    private _l: number;
    private _pc: number; // Program Counter
    private _sp: number; // Stack Pointer

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
        log.reg("pc", v);
        this._pc = v & 0xffff;
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
        log.reg("sp", v);
        this._sp = v & 0xffff;
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
        log.reg("a", v);
        this._a = v & 0xff;
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
        log.reg("b", v);
        this._b = v & 0xff;
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
        log.reg("c", v);
        this._c = v & 0xff;
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
        log.reg("d", v);
        this._d = v & 0xff;
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
        log.reg("e", v);
        this._e = v & 0xff;
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
        log.reg("h", v);
        this._h = v & 0xff;
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
        log.reg("l", v);
        this._l = v & 0xff;
    }

    /**
     * Read the combined B & C registers
     *
     * @return {number} BC
     */
    public get bc(): number {
        return (this.b << 8) + this.c;
    }

    /**
     * Set the combined B & C registers
     *
     * @param {number} New value
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
        return (this.d << 8) + this.e;
    }

    /**
     * Set the combined D & E registers
     *
     * @param {number} New value
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
        return (this.h << 8) + this.l;
    }

    /**
     * Set the combined H & L registers
     *
     * @param {number} New value
     */
    public set hl(hl: number) {
        this.h = (hl >> 8) & 0xff;
        this.l = hl & 0xff;
    }

}

/**
 * Control access to the 8080 memory
 *
 * @class Memory
 */
class Memory {
    private memory: DataView;
    constructor(buffer: ArrayBuffer) {
        let tmp = ArrayBuffer.transfer(buffer, 0x4000);
        this.memory = new DataView(tmp);
        log.drawMemory(this.memory);
    }

    /**
     * Get a byte from memory
     *
     * @param {number} addr Memory address
     *
     * @returns {number} Byte
     */
    public get(addr: number): number {
        if (addr > 0x4000) {
            log.ops(`Memory read request to out of bounds address ${addr}`, true);
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
        if (addr > 0x4000) {
            log.ops(`Memory read request to out of bounds address ${addr}`, true);
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
        if (addr < 0x2000) {
            log.ops(`Memory write request to read only memory address ${addr}`, true);
            return;
        }
        if (addr > 0x4000) {
            log.ops(`Memory write request to out of bounds address ${addr}`, true);
            return;
        }
        this.memory.setUint8(addr, value);
        log.updateMemory(addr, value);
    }

    /**
     * Set two bytes in memory
     *
     * @param {number} addr  Memory address
     * @param {number} value Bytes to set
     */
    public set16(addr: number, value: number): void {
        if (addr < 0x2000) {
            log.ops(`Memory write request to read only memory address ${addr}`, true);
            return;
        }
        if (addr > 0x4000) {
            log.ops(`Memory write request to out of bounds address ${addr}`, true);
            return;
        }
        this.memory.setUint16(addr, value, true);
        log.updateMemory(addr, value);
    }
}

class State8080 {
    public ready: boolean = false; // Finished loading, ready to execute
    public register = new Registers(); // Register container
    // public pc: DataView = new DataView(new ArrayBuffer(2)); // Program Counter
    public int: boolean = true; // Interrupts enabled
    public memory: Memory;
    public cc: ConditionCodes = new ConditionCodes();
    public ops: OpCodes = new OpCodes(this);
    public cycle = 0; // Number of cycles executed

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
        this.register.pc = 0;
        this.ready = true;
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
            this.exec(1, Infinity);
        } catch (err) {
            console.log(err);
            throw "Run failed";
        }
    }

    /**
     * Step the processor one instruction
     */
    public step(): void {
        let steps = 1;
        let step_inp = <HTMLInputElement>document.getElementById("step_cnt");
        if (step_inp) {
            steps = Number.parseInt(step_inp.value);
        }
        try {
            this.exec(1, steps);
        } catch (err) {
            console.log(err);
            throw "Step failed";
        }
    }

    private exec(cur_step: number = 1, steps: number = 1): void {
        log.step();
        let opcode = this.memory.get(this.register.pc);
        if (typeof invaders.ops[opcode] === "undefined") {
            let addr = this.register.pc.toString(16);
            let opcode = this.memory.get(Number(`0x${addr}`)).toString(16);
            log.ops(`Could not execute opcode ${opcode} at ${addr}`, true);
            throw "Unimplemented OpCode";
        }
        invaders.ops[opcode]();
        this.cycle += invaders.ops.cycle[opcode];
        if (this.ready && cur_step < steps) {
            new Promise(resolve => setTimeout(resolve)).then(() => { cur_step++; this.exec(cur_step, steps); });
        }
    }
}

class OpCodes {
    private state: State8080; // Which 8080 are we operating on
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
        log.ops(`NOP`);
        this.state.register.pc += 1;
    }

    /**
     * B <- byte 3,C <- byte 2
     */
    public 0x01 = () => {
        this.state.register.c = this.state.memory.get(this.state.register.pc + 1);
        this.state.register.b = this.state.memory.get(this.state.register.pc + 2);
        log.ops(`LXI B ${this.state.register.b.toString(16).padStart(2, "0")}${this.state.register.c.toString(16).padStart(2, "0")}`);
        this.state.register.pc += 3;
    }

    /**
     * BC <- BC + 1
     */
    public 0x03 = () => {
        let bc = this.state.register.bc;
        bc++;
        this.state.register.bc = bc;
        log.ops(`INX B`);
        this.state.register.pc += 1;
    }

    /**
     * Increment b
     */
    public 0x04 = () => {
        let b = this.state.register.b;
        let ans = b + 1;
        this.state.cc.setSZP(ans);
        this.state.register.b = ans;
        log.ops(`INR B`);
        this.state.register.pc += 1;
    }

    /**
     * Decrement b
     */
    public 0x05 = () => {
        let b = this.state.register.b;
        let ans = b - 1;
        this.state.cc.setSZP(ans);
        this.state.register.b = ans;
        log.ops(`DCR B`);
        this.state.register.pc += 1;
    }

    /**
     * B <- byte 2
     */
    public 0x06 = () => {
        let byte = this.state.memory.get(this.state.register.pc + 1);
        this.state.register.b = byte;
        log.ops(`MVI B ${byte.toString(16)}`);
        this.state.register.pc += 2;
    }

    /**
     * HL = HL + BC
     */
    public 0x09 = () => {
        let ans = this.state.register.hl + this.state.register.bc;
        this.state.cc.carry(ans);
        this.state.register.hl = ans;
        log.ops(`DAD B`);
        this.state.register.pc += 1;
    }

    /**
     * C <- byte 2
     */
    public 0x0e = () => {
        let byte = this.state.memory.get(this.state.register.pc + 1);
        this.state.register.c = byte;
        log.ops(`MVI C ${byte.toString(16)}`);
        this.state.register.pc += 2;
    }

    /**
     * D <- byte 3, E <- byte 2
     */
    public 0x11 = () => {
        this.state.register.e = this.state.memory.get(this.state.register.pc + 1);
        this.state.register.d = this.state.memory.get(this.state.register.pc + 2);
        log.ops(`LXI D ${this.state.register.d.toString(16).padStart(2, "0")}${this.state.register.e.toString(16).padStart(2, "0")}`);
        this.state.register.pc += 3;
    }

    /**
     * DE <- DE + 1
     */
    public 0x13 = () => {
        let de = (this.state.register.d << 8) + this.state.register.e;
        de++;
        this.state.register.d = (de >> 8) & 0xff;
        this.state.register.e = de & 0xff;
        log.ops(`INX D`);
        this.state.register.pc += 1;
    }

    /**
     * D <- byte 2
     */
    public 0x16 = () => {
        let byte = this.state.memory.get(this.state.register.pc + 1);
        this.state.register.d = byte;
        log.ops(`MVI D ${byte.toString(16)}`);
        this.state.register.pc += 2;
    }

    /**
     * HL = HL + DE
     */
    public 0x19 = () => {
        let ans = this.state.register.hl + this.state.register.de;
        this.state.cc.carry(ans);
        this.state.register.hl = ans;
        log.ops(`DAD D`);
        this.state.register.pc += 1;
    }

    /**
     * A <- (DE)
     */
    public 0x1a = () => {
        let addr = (this.state.register.d << 8) + this.state.register.e;
        this.state.register.a = this.state.memory.get(addr);
        log.ops(`LDAX D (${addr.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * E <- byte 2
     */
    public 0x1e = () => {
        let byte = this.state.memory.get(this.state.register.pc + 1);
        this.state.register.e = byte;
        log.ops(`MVI E ${byte.toString(16)}`);
        this.state.register.pc += 2;
    }

    /**
     * H <- byte 3, L <- byte 2
     */
    public 0x21 = () => {
        this.state.register.l = this.state.memory.get(this.state.register.pc + 1);
        this.state.register.h = this.state.memory.get(this.state.register.pc + 2);
        log.ops(`LXI H ${this.state.register.h.toString(16).padStart(2, "0")}${this.state.register.l.toString(16).padStart(2, "0")}`);
        this.state.register.pc += 3;
    }

    /**
     * HL <- HL + 1
     */
    public 0x23 = () => {
        let hl = this.state.register.hl;
        hl++;
        this.state.register.hl = hl;
        log.ops(`INX H`);
        this.state.register.pc += 1;
    }

    /**
     * Increment h
     */
    public 0x24 = () => {
        let h = this.state.register.h;
        let ans = h + 1;
        this.state.cc.setSZP(ans);
        this.state.register.h = ans;
        log.ops(`INR H`);
        this.state.register.pc += 1;
    }

    /**
     * H <- byte 2
     */
    public 0x26 = () => {
        let byte = this.state.memory.get(this.state.register.pc + 1);
        this.state.register.h = byte;
        log.ops(`MVI H ${byte.toString(16)}`);
        this.state.register.pc += 2;
    }

    /**
     * HL = HL + HL
     */
    public 0x29 = () => {
        let ans = this.state.register.hl + this.state.register.hl;
        this.state.cc.carry(ans);
        this.state.register.hl = ans;
        log.ops(`DAD H`);
        this.state.register.pc += 1;
    }

    /**
     * L <- byte 2
     */
    public 0x2e = () => {
        let byte = this.state.memory.get(this.state.register.pc + 1);
        this.state.register.l = byte;
        log.ops(`MVI L ${byte.toString(16)}`);
        this.state.register.pc += 2;
    }

    /**
     * SP.hi <- byte 3, SP.lo <- byte 2
     */
    public 0x31 = () => {
        let sp = this.state.memory.get16(this.state.register.pc + 1);
        this.state.register.sp = sp;
        log.ops(`LXI SP ${sp.toString(16)}`);
        this.state.register.pc += 3;
    }

    /**
     * SP <- SP + 1
     */
    public 0x33 = () => {
        this.state.register.sp++;
        log.ops(`INX SP`);
        this.state.register.pc += 1;
    }

    /**
     * M <- byte 2
     */
    public 0x36 = () => {
        let byte = this.state.memory.get(this.state.register.pc + 1);
        this.state.memory.set(this.state.register.hl, byte);
        log.ops(`MVI M ${byte.toString(16)}`);
        this.state.register.pc += 2;
    }

    /**
     * A <- byte 2
     */
    public 0x3e = () => {
        let byte = this.state.memory.get(this.state.register.pc + 1);
        this.state.register.a = byte;
        log.ops(`MVI A ${byte.toString(16)}`);
        this.state.register.pc += 2;
    }

    /**
     * Move B into B
     */
    public 0x40 = () => {
        this.state.register.b = this.state.register.b;
        log.ops(`MOV B,B`);
        this.state.register.pc += 1;
    }

    /**
     * Move C into B
     */
    public 0x41 = () => {
        this.state.register.b = this.state.register.c;
        log.ops(`MOV B,C`);
        this.state.register.pc += 1;
    }

    /**
     * Move D into B
     */
    public 0x42 = () => {
        this.state.register.b = this.state.register.d;
        log.ops(`MOV B,D`);
        this.state.register.pc += 1;
    }

    /**
     * Move E into B
     */
    public 0x43 = () => {
        this.state.register.b = this.state.register.e;
        log.ops(`MOV B,E`);
        this.state.register.pc += 1;
    }

    /**
     * Move H into B
     */
    public 0x44 = () => {
        this.state.register.b = this.state.register.h;
        log.ops(`MOV B,H`);
        this.state.register.pc += 1;
    }

    /**
     * Move L into B
     */
    public 0x45 = () => {
        this.state.register.b = this.state.register.l;
        log.ops(`MOV B,L`);
        this.state.register.pc += 1;
    }

    /**
     * Move (HL) into B
     */
    public 0x46 = () => {
        let addr = this.state.register.hl;
        this.state.register.b = this.state.memory.get(addr);
        log.ops(`MOV B,M (${addr.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move A into B
     */
    public 0x47 = () => {
        this.state.register.b = this.state.register.a;
        log.ops(`MOV B,A`);
        this.state.register.pc += 1;
    }

    /**
     * Move B into C
     */
    public 0x48 = () => {
        this.state.register.c = this.state.register.b;
        log.ops(`MOV C,B`);
        this.state.register.pc += 1;
    }

    /**
     * Move C into C
     */
    public 0x49 = () => {
        this.state.register.c = this.state.register.c;
        log.ops(`MOV C,C`);
        this.state.register.pc += 1;
    }

    /**
     * Move D into C
     */
    public 0x4a = () => {
        this.state.register.c = this.state.register.d;
        log.ops(`MOV C,D`);
        this.state.register.pc += 1;
    }

    /**
     * Move E into C
     */
    public 0x4b = () => {
        this.state.register.c = this.state.register.e;
        log.ops(`MOV C,E`);
        this.state.register.pc += 1;
    }

    /**
     * Move H into C
     */
    public 0x4c = () => {
        this.state.register.c = this.state.register.h;
        log.ops(`MOV C,H`);
        this.state.register.pc += 1;
    }

    /**
     * Move L into C
     */
    public 0x4d = () => {
        this.state.register.c = this.state.register.l;
        log.ops(`MOV C,L`);
        this.state.register.pc += 1;
    }

    /**
     * Move (HL) into C
     */
    public 0x4e = () => {
        let addr = this.state.register.hl;
        this.state.register.c = this.state.memory.get(addr);
        log.ops(`MOV C,M (${addr.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move A into C
     */
    public 0x4f = () => {
        this.state.register.c = this.state.register.a;
        log.ops(`MOV C,A`);
        this.state.register.pc += 1;
    }

    /**
     * Move B into D
     */
    public 0x50 = () => {
        this.state.register.d = this.state.register.b;
        log.ops(`MOV D,B`);
        this.state.register.pc += 1;
    }

    /**
     * Move C into D
     */
    public 0x51 = () => {
        this.state.register.d = this.state.register.c;
        log.ops(`MOV D,C`);
        this.state.register.pc += 1;
    }

    /**
     * Move D into D
     */
    public 0x52 = () => {
        this.state.register.d = this.state.register.d;
        log.ops(`MOV D,D`);
        this.state.register.pc += 1;
    }

    /**
     * Move E into D
     */
    public 0x53 = () => {
        this.state.register.d = this.state.register.e;
        log.ops(`MOV D,E`);
        this.state.register.pc += 1;
    }

    /**
     * Move H into D
     */
    public 0x54 = () => {
        this.state.register.d = this.state.register.h;
        log.ops(`MOV D,H`);
        this.state.register.pc += 1;
    }

    /**
     * Move L into D
     */
    public 0x55 = () => {
        this.state.register.d = this.state.register.l;
        log.ops(`MOV D,L`);
        this.state.register.pc += 1;
    }

    /**
     * Move (HL) into D
     */
    public 0x56 = () => {
        let addr = this.state.register.hl;
        this.state.register.d = this.state.memory.get(addr);
        log.ops(`MOV D,M (${addr.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move A into D
     */
    public 0x57 = () => {
        this.state.register.d = this.state.register.a;
        log.ops(`MOV D,A`);
        this.state.register.pc += 1;
    }

    /**
     * Move B into E
     */
    public 0x58 = () => {
        this.state.register.e = this.state.register.b;
        log.ops(`MOV E,B`);
        this.state.register.pc += 1;
    }

    /**
     * Move C into E
     */
    public 0x59 = () => {
        this.state.register.e = this.state.register.c;
        log.ops(`MOV E,C`);
        this.state.register.pc += 1;
    }

    /**
     * Move D into E
     */
    public 0x5a = () => {
        this.state.register.e = this.state.register.d;
        log.ops(`MOV E,D`);
        this.state.register.pc += 1;
    }

    /**
     * Move E into E
     */
    public 0x5b = () => {
        this.state.register.e = this.state.register.e;
        log.ops(`MOV E,E`);
        this.state.register.pc += 1;
    }

    /**
     * Move H into E
     */
    public 0x5c = () => {
        this.state.register.e = this.state.register.h;
        log.ops(`MOV E,H`);
        this.state.register.pc += 1;
    }

    /**
     * Move L into E
     */
    public 0x5d = () => {
        this.state.register.e = this.state.register.l;
        log.ops(`MOV E,L`);
        this.state.register.pc += 1;
    }

    /**
     * Move (HL) into E
     */
    public 0x5e = () => {
        let addr = this.state.register.hl;
        this.state.register.e = this.state.memory.get(addr);
        log.ops(`MOV E,M (${addr.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move A into E
     */
    public 0x5f = () => {
        this.state.register.e = this.state.register.a;
        log.ops(`MOV E,A`);
        this.state.register.pc += 1;
    }

    /**
     * Move B into H
     */
    public 0x60 = () => {
        this.state.register.h = this.state.register.b;
        log.ops(`MOV H,B`);
        this.state.register.pc += 1;
    }

    /**
     * Move C into H
     */
    public 0x61 = () => {
        this.state.register.h = this.state.register.c;
        log.ops(`MOV H,C`);
        this.state.register.pc += 1;
    }

    /**
     * Move D into H
     */
    public 0x62 = () => {
        this.state.register.h = this.state.register.d;
        log.ops(`MOV H,D`);
        this.state.register.pc += 1;
    }

    /**
     * Move E into H
     */
    public 0x63 = () => {
        this.state.register.h = this.state.register.e;
        log.ops(`MOV H,E`);
        this.state.register.pc += 1;
    }

    /**
     * Move H into H
     */
    public 0x64 = () => {
        this.state.register.h = this.state.register.h;
        log.ops(`MOV H,H`);
        this.state.register.pc += 1;
    }

    /**
     * Move L into H
     */
    public 0x65 = () => {
        this.state.register.h = this.state.register.l;
        log.ops(`MOV H,L`);
        this.state.register.pc += 1;
    }

    /**
     * Move (HL) into H
     */
    public 0x66 = () => {
        let addr = this.state.register.hl;
        this.state.register.h = this.state.memory.get(addr);
        log.ops(`MOV H,M (${addr.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move A into H
     */
    public 0x67 = () => {
        this.state.register.h = this.state.register.a;
        log.ops(`MOV H,A`);
        this.state.register.pc += 1;
    }

    /**
     * Move B into L
     */
    public 0x68 = () => {
        this.state.register.l = this.state.register.b;
        log.ops(`MOV L,B`);
        this.state.register.pc += 1;
    }

    /**
     * Move C into L
     */
    public 0x69 = () => {
        this.state.register.l = this.state.register.c;
        log.ops(`MOV L,C`);
        this.state.register.pc += 1;
    }

    /**
     * Move D into L
     */
    public 0x6a = () => {
        this.state.register.l = this.state.register.d;
        log.ops(`MOV L,D`);
        this.state.register.pc += 1;
    }

    /**
     * Move E into L
     */
    public 0x6b = () => {
        this.state.register.l = this.state.register.e;
        log.ops(`MOV L,E`);
        this.state.register.pc += 1;
    }

    /**
     * Move H into L
     */
    public 0x6c = () => {
        this.state.register.l = this.state.register.h;
        log.ops(`MOV L,H`);
        this.state.register.pc += 1;
    }

    /**
     * Move L into L
     */
    public 0x6d = () => {
        this.state.register.l = this.state.register.l;
        log.ops(`MOV L,L`);
        this.state.register.pc += 1;
    }

    /**
     * Move (HL) into L
     */
    public 0x6e = () => {
        let addr = this.state.register.hl;
        this.state.register.l = this.state.memory.get(addr);
        log.ops(`MOV L,M (${addr.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move A into L
     */
    public 0x6f = () => {
        this.state.register.l = this.state.register.a;
        log.ops(`MOV L,A`);
        this.state.register.pc += 1;
    }

    /**
     * Move B into M
     */
    public 0x70 = () => {
        let m = this.state.register.hl;
        this.state.memory.set(m, this.state.register.b);
        log.ops(`MOV M,B (${m.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move C into M
     */
    public 0x71 = () => {
        let m = this.state.register.hl;
        this.state.memory.set(m, this.state.register.c);
        log.ops(`MOV M,C (${m.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move D into M
     */
    public 0x72 = () => {
        let m = this.state.register.hl;
        this.state.memory.set(m, this.state.register.d);
        log.ops(`MOV M,D (${m.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move E into M
     */
    public 0x73 = () => {
        let m = this.state.register.hl;
        this.state.memory.set(m, this.state.register.e);
        log.ops(`MOV M,E (${m.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move H into M
     */
    public 0x74 = () => {
        let m = this.state.register.hl;
        this.state.memory.set(m, this.state.register.h);
        log.ops(`MOV M,H (${m.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move L into M
     */
    public 0x75 = () => {
        let m = this.state.register.hl;
        this.state.memory.set(m, this.state.register.l);
        log.ops(`MOV M,L (${m.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move A into M
     */
    public 0x77 = () => {
        let m = this.state.register.hl;
        this.state.memory.set(m, this.state.register.a);
        log.ops(`MOV M,A (${m.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move B into A
     */
    public 0x78 = () => {
        this.state.register.a = this.state.register.b;
        log.ops(`MOV A,B`);
        this.state.register.pc += 1;
    }

    /**
     * Move C into A
     */
    public 0x79 = () => {
        this.state.register.a = this.state.register.c;
        log.ops(`MOV A,C`);
        this.state.register.pc += 1;
    }

    /**
     * Move D into A
     */
    public 0x7a = () => {
        this.state.register.a = this.state.register.d;
        log.ops(`MOV A,D`);
        this.state.register.pc += 1;
    }

    /**
     * Move E into A
     */
    public 0x7b = () => {
        this.state.register.a = this.state.register.e;
        log.ops(`MOV A,E`);
        this.state.register.pc += 1;
    }

    /**
     * Move H into A
     */
    public 0x7c = () => {
        this.state.register.a = this.state.register.h;
        log.ops(`MOV A,H`);
        this.state.register.pc += 1;
    }

    /**
     * Move L into A
     */
    public 0x7d = () => {
        this.state.register.a = this.state.register.l;
        log.ops(`MOV A,L`);
        this.state.register.pc += 1;
    }

    /**
     * Move (HL) into A
     */
    public 0x7e = () => {
        let addr = this.state.register.hl;
        this.state.register.a = this.state.memory.get(addr);
        log.ops(`MOV A,M (${addr.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * Move A into A
     */
    public 0x7f = () => {
        this.state.register.a = this.state.register.a;
        log.ops(`MOV A,A`);
        this.state.register.pc += 1;
    }

    /**
     * C <- (sp); B <- (sp+1); sp <- sp+2
     */
    public 0xc1 = () => {
        this.state.register.bc = this.state.memory.get16(this.state.register.sp);
        this.state.register.sp += 2;
        this.state.register.pc += 1;
        log.ops(`POP B`);
    }

    /**
     * Jump to address contained in bytes 2 and 3 if z is 0
     */
    public 0xc2 = () => {
        if (this.state.cc.z !== 0) {
            this.state.register.pc += 3;
            log.ops(`JNZ`);
            return;
        }
        let addr = this.state.memory.get16(this.state.register.pc + 1);
        this.state.register.pc = addr;
        log.ops(`JNZ ${addr.toString(16)}`);
    }

    /**
     * Jump to address contained in bytes 2 and 3
     */
    public 0xc3 = () => {
        let addr = this.state.memory.get16(this.state.register.pc + 1);
        this.state.register.pc = addr;
        log.ops(`JMP ${addr.toString(16)}`);
    }

    /**
     * (sp-2)<-C; (sp-1)<-B; sp <- sp - 2
     */
    public 0xc5 = () => {
        let sp = this.state.register.sp;
        this.state.memory.set16(sp - 2, this.state.register.bc);
        this.state.register.sp -= 2;
        this.state.register.pc += 1;
        log.ops(`PUSH B`);
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
        this.state.register.pc += 1;
        log.ops(`ADI ${byte.toString(16)}`);
    }

    /**
     * Return to the address on the stack
     * PC.lo <- (sp); PC.hi<-(sp+1); SP <- SP+2
     */
    public 0xc9 = () => {
        this.state.register.pc = this.state.memory.get16(this.state.register.sp);
        this.state.register.sp += 2;
        this.state.register.pc += 1;
        log.ops(`RET ${this.state.register.pc.toString(16)}`);
    }

    /**
     * Call address contained in bytes 2 and 3
     * (SP-1)<-PC.hi;(SP-2)<-PC.lo;SP<-SP-2;PC=adr
     */
    public 0xcd = () => {
        let ret = this.state.register.pc + 2;
        let sp = this.state.register.sp;
        let addr = this.state.memory.get16(this.state.register.pc + 1);
        this.state.memory.set16(sp - 2, ret);
        this.state.register.sp -= 2;
        this.state.register.pc = addr;
        log.ops(`CALL ${addr.toString(16)}`);
    }

    /**
     * E <- (sp); D <- (sp+1); sp <- sp+2
     */
    public 0xd1 = () => {
        this.state.register.de = this.state.memory.get16(this.state.register.sp);
        this.state.register.sp += 2;
        this.state.register.pc += 1;
        log.ops(`POP D`);
    }

    /**
     * Write to the I/O port
     */
    public 0xd3 = () => {
        let byte = this.state.memory.get(this.state.register.pc + 1);
        log.ops(`OUT ${byte.toString(16)}`);
        this.state.register.pc += 1;
        throw "Not finished implementing";
    }

    /**
     * (sp-2)<-E; (sp-1)<-D; sp <- sp - 2
     */
    public 0xd5 = () => {
        let sp = this.state.register.sp;
        this.state.memory.set16(sp - 2, this.state.register.de);
        this.state.register.sp -= 2;
        this.state.register.pc += 1;
        log.ops(`PUSH D`);
    }

    /**
     * L <- (sp); H <- (sp+1); sp <- sp+2
     */
    public 0xe1 = () => {
        this.state.register.hl = this.state.memory.get16(this.state.register.sp);
        this.state.register.sp += 2;
        this.state.register.pc += 1;
        log.ops(`POP H`);
    }

    /**
     * (sp-2)<-L; (sp-1)<-H; sp <- sp - 2
     */
    public 0xe5 = () => {
        let sp = this.state.register.sp;
        this.state.memory.set16(sp - 2, this.state.register.hl);
        this.state.register.sp -= 2;
        this.state.register.pc += 1;
        log.ops(`PUSH H`);
    }

    /**
     * H <-> D; L <-> E
     */
    public 0xeb = () => {
        [this.state.register.d, this.state.register.h] = [this.state.register.h, this.state.register.d];
        [this.state.register.e, this.state.register.l] = [this.state.register.l, this.state.register.e];
        this.state.register.pc += 1;
        log.ops(`XCHG`);
    }

    /**
     * A - data
     */
    public 0xfe = () => {
        let byte = this.state.memory.get(this.state.register.pc + 1);
        let ans = this.state.register.a - byte;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.pc += 1;
        log.ops(`CPI ${byte.toString(16)}`);
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
 * Log messages to the screen when enabled
 *
 * @class Logger
 */
class Logger {
    /**
     * Log a msg to the ops box
     *
     * @param {string}  msg   Text to log
     * @param {boolean} error Flag it as an error
     */
    public ops(msg: string, error: boolean = false): void {
        if (!logging_enabled) {
            return;
        }
        let ops_pre = document.getElementById("ops");
        if (ops_pre) {
            let op = document.createElement("span");
            if (error) {
                op.classList.add("text-danger");
            }
            op.innerText += ` ${msg}\n`;
            ops_pre.appendChild(op);
            ops_pre.scrollTop = ops_pre.scrollHeight;
        }
    }

    /**
     * Log the pc to the ops box
     */
    public step(): void {
        if (!logging_enabled) {
            return;
        }
        let ops_pre = document.getElementById("ops");
        if (ops_pre) {
            let kbd = document.createElement("kbd");
            kbd.innerText = invaders.register.pc.toString(16).padStart(4, "0");
            ops_pre.appendChild(kbd);
        }
    }

    /**
     * Draw memory into memory box
     *
     * @param {DataView} mem System memory
     */
    public drawMemory(mem: DataView): void {
        if (!logging_enabled) {
            return;
        }
        let mem_pre = document.getElementById("memory");
        if (!mem_pre) {
            return;
        }
        let chunk = "";
        for (let i = 0; i < mem.byteLength; i++) {
            if (i % 16 === 0) {
                let sect = i.toString(16).padStart(4, "0");
                chunk += `\n<kbd>${sect}</kbd> `;
            }
            let addr = mem.getUint8(i).toString(16).padStart(2, "0");
            chunk += `<span id="m${i}">${addr}</span> `;
        }
        mem_pre.innerHTML = chunk;
    }

    /**
     * Highlight memory that's been written to
     *
     * @param {number} addr
     */
    public updateMemory(addr: number, val: number): void {
        if (!logging_enabled) {
            return;
        }
        if (val > 0xff) {
            let lo = val & 0xff;
            let cell = document.getElementById(`m${addr}`);
            if (cell) {
                cell.classList.add("text-danger");
                cell.innerText = lo.toString(16).padStart(2, "0");
                cell.scrollIntoView();
            }
            val = (val >> 8) & 0xff;
            addr++;
        }
        let cell = document.getElementById(`m${addr}`);
        if (cell) {
            cell.classList.add("text-danger");
            cell.innerText = val.toString(16).padStart(2, "0");
            cell.scrollIntoView();
        }
    }

    /**
     * Update register
     *
     * @param {string} reg Register to update
     * @param {number} val Value to set
     */
    public reg(reg: string, val: number): void {
        if (!logging_enabled) {
            return;
        }
        let reg_inp = <HTMLInputElement>document.getElementById(reg);
        if (!reg_inp) {
            return;
        }
        reg_inp.value = val.toString(16).padStart(2, "0");
    }
}

/**
 * Polyfill for ArrayBuffer transfer ability
 */
if (typeof ArrayBuffer.transfer === "undefined") {
    ArrayBuffer.transfer = function(source, length) {
        if (!(source instanceof ArrayBuffer))
            throw new TypeError('Source must be an instance of ArrayBuffer');
        if (length <= source.byteLength)
            return source.slice(0, length);
        var sourceView = new Uint8Array(source),
            destView = new Uint8Array(new ArrayBuffer(length));
        destView.set(sourceView);
        return destView.buffer;
    };
}
