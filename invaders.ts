//
// $2000 is the start of the program's "work ram"
// $2400 is the start of the video memory
// 8080 is little endian
// lo.hi => 21.43 == 0x4321
//

/**
 * Log messages to the screen when enabled
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
        reg_inp.value = val.toString(16).padStart(reg_inp.maxLength, "0");
    }

    /**
     * Print out if an op code is implemented or not
     */
    public coverage() {
        let ops_pre = document.getElementById("ops");
        if (!ops_pre) {
            return;
        }

        let chunk = "";
        for (let i = 0; i <= 0xff; i++) {
            if (i % 16 === 0) {
                chunk += `\n`;
            }
            let cls = typeof invaders.ops[i] === "undefined" ? "bg-danger": "bg-success";
            if ([0x10, 0x20, 0x30, 0x08, 0x18, 0x28, 0x38, 0xcb, 0xd9, 0xdd, 0xed, 0xfd].indexOf(i) > -1) {
                cls = "bg-warning";
            }
            chunk += `<kbd class="${cls}">${i.toString(16).padStart(2, "0")}</kbd>`;
        }
        ops_pre.innerHTML = chunk + `\n`;
    }
}


let invaders: State8080;
let logging_enabled: boolean = true;
let log: Logger = new Logger();

/**
 * Load rom into memory
 */
function loadRom(): void {
    invaders = new SpaceInvaders();
    // invaders = new State8080("8080EXM.COM");
    // invaders = new State8080("cpudiag.bin");

    // If we have debug buttons up, attach handlers
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
    let cov_btn = document.getElementById("coverage");
    if (cov_btn) {
        cov_btn.addEventListener("click", (e) => { e.preventDefault(); log.coverage(); });
    }
}

window.onload = loadRom;


/**
 * 8080 condition codes
 */
class ConditionCodes {
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
        this.cy = Number(result > 0xff);
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
        log.reg("z", v);
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
        log.reg("s", v);
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
        log.reg("p", v);
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
        log.reg("cy", v);
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
        log.reg("ac", v);
    }
}

/**
 * 8080 registers
 */
class Registers {
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
        log.reg("pc", this._pc);
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
        log.reg("sp", this._sp);
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
        log.reg("a", this._a);
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
        log.reg("f", this._f);
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
        log.reg("b", this._b);
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
        log.reg("c", this._c);
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
        log.reg("d", this._d);
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
        log.reg("e", this._e);
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
        log.reg("h", this._h);
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
        log.reg("l", this._l);
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
        return (this.b << 8) + this.c;
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
        return (this.d << 8) + this.e;
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
        return (this.h << 8) + this.l;
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

/**
 * IO port of 8080
 */
class IO8080 {}
/**
 * IO ports for Space Invaders machine
 */
class SpaceInvadersIO extends IO8080 {
    private alpha = [
        "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V",
        "W", "X", "Y", "Z", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "<", ">", " "
    ];

    /**
     * Write port 6 for watchdog
     */
    public set 0x06(v: number) {
        if (typeof this.alpha[v] === "undefined") {
            console.log(v);
            return;
        }
        console.log(this.alpha[v]);
    }
}

/**
 * 8080 CPU
 */
class State8080 {
    public ready: boolean = false; // Finished loading, ready to execute
    public register = new Registers(); // Register container
    public int: boolean = false; // Interrupts enabled
    public memory!: Memory; // We don't create a memory object until we load the rom image
    public cc: ConditionCodes = new ConditionCodes(this);
    public ops: OpCodes = new OpCodes(this);
    public cycle = 0; // Number of cycles executed
    public io!: IO8080;

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
        this.register.sp = 0x2400;
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
        if (typeof this.ops[opcode] === "undefined") {
            let addr = this.register.pc;
            let opcode = this.memory.get(addr).toString(16).padStart(2, "0");
            log.ops(`Could not execute opcode ${opcode} at ${addr.toString(16).padStart(4, "0")}`, true);
            throw "Unimplemented OpCode";
        }
        this.ops[opcode]();
        this.cycle += this.ops.cycle[opcode];
        if ([0x1956, 0x191a].indexOf(this.register.pc) > -1) {
            throw "Breakpoint"
        }
        if (this.ready && cur_step < steps) {
            // new Promise(resolve => setTimeout(resolve)).then(() => { cur_step++; this.exec(cur_step, steps); });
            setTimeout(() => { cur_step++; this.exec(cur_step, steps); });
        }
    }
}

/**
 * Space Invaders machine
 */
class SpaceInvaders extends State8080 {
    // public screen!: WebGLRenderingContext;
    public screen!: CanvasRenderingContext2D;

    /**
     * Load the invaders rom dump into the 8080
     */
    constructor() {
        super("invaders");
    }

    public init() {
        super.init();
        this.io = new SpaceInvadersIO();
        this.register.sp = 0x00;
        this.setupScreen();
        console.log("Ready machine");
    }

    public setupScreen() {
        let screen = <HTMLCanvasElement>document.getElementById("screen");
        if (!screen) {
            return;
        }
        this.screen  = screen.getContext("2d", { alpha: false })!;
        // this.screen = screen.getContext("webgl", { alpha: false })! || screen.getContext("experimental-webgl", { alpha: false })!;
        // this.screen.viewport(0, 0, this.screen.drawingBufferWidth, this.screen.drawingBufferHeight);
        // this.screen.clearColor(0, 0, 0, 1.0);
        // this.screen.clear(this.screen.COLOR_BUFFER_BIT);
    }

    public drawScreen() {
        let width = 256;
        let height = 224;
        let raw = this.screen.createImageData(width, height);
        for (let i = 0; i < raw.data.byteLength; i+=32) {
            let byte = this.memory.get(0x2400 + (i / 32));
            for (let b = 0; b < 8; b++) {
                let v = ((byte & Math.pow(2, b)) == Math.pow(2, b)) ? 0xff : 0;
                raw.data[i + b * 4] = v;
                raw.data[i + b * 4 + 1] = v;
                raw.data[i + b * 4 + 2] = v;
                raw.data[i + b * 4 + 3] = v;
            }
        }
        this.screen.putImageData(raw, 0, 0);
        // this.screen.enable(this.screen.SCISSOR_TEST);
        // this.screen.scissor(4, 2, 1, 1);
        // this.screen.clearColor(0xff, 0xff, 0xff, 1.0);
        // this.screen.clear(this.screen.COLOR_BUFFER_BIT);
    }
}


/**
 * Execute requested 8080 opcode
 */
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
        log.ops(`LXI B ${this.state.register.b.toString(16).padStart(2, "0")}${this.state.register.c.toString(16).padStart(2, "0")}`);
        this.state.register.pc += 3;
    }

    /**
     * (BC) <- A
     */
    public 0x02 = () => {
        let addr = this.state.register.bc;
        this.state.memory.set(addr, this.state.register.a);
        log.ops(`STAX B (${addr.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * BC <- BC + 1
     */
    public 0x03 = () => {
        this.state.register.bc++;
        log.ops(`INX B`);
        this.state.register.pc += 1;
    }

    /**
     * Increment b
     */
    public 0x04 = () => {
        this.state.cc.setSZP(++this.state.register.b);
        log.ops(`INR B`);
        this.state.register.pc += 1;
    }

    /**
     * Decrement b
     */
    public 0x05 = () => {
        this.state.cc.setSZP(--this.state.register.b);
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
     * A <- (BC)
     */
    public 0x0a = () => {
        let addr = this.state.register.bc;
        this.state.register.a = this.state.memory.get(addr);
        log.ops(`LDAX B (${addr.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * BC <- BC - 1
     */
    public 0x0b = () => {
        this.state.register.bc--;
        log.ops(`DCX B`);
        this.state.register.pc += 1;
    }

    /**
     * Increment c
     */
    public 0x0c = () => {
        this.state.cc.setSZP(++this.state.register.c);
        log.ops(`INR C`);
        this.state.register.pc += 1;
    }

    /**
     * Decrement b
     */
    public 0x0d = () => {
        this.state.cc.setSZP(--this.state.register.c);
        log.ops(`DCR C`);
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
     * A = A >> 1; bit 7 = prev bit 0; CY = prev bit 0
     */
    public 0x0f = () => {
        let a = this.state.register.a;
        this.state.register.a = ((a & 1) << 7) | (a >> 1);
        this.state.cc.cy = Number(1 == (a & 1));
        log.ops(`RRC`);
        this.state.register.pc += 1;
    }

    /**
     * D <- byte 3, E <- byte 2
     */
    public 0x11 = () => {
        this.state.register.e = this.state.memory.get(this.state.register.pc + 1);
        this.state.register.d = this.state.memory.get(this.state.register.pc + 2);
        log.ops(`LXI D ${this.state.register.de.toString(16).padStart(4, "0")}`);
        this.state.register.pc += 3;
    }

    /**
     * (DE) <- A
     */
    public 0x12 = () => {
        let addr = this.state.register.de;
        this.state.memory.set(addr, this.state.register.a);
        log.ops(`STAX D (${addr.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * DE <- DE + 1
     */
    public 0x13 = () => {
        this.state.register.de++;
        log.ops(`INX D`);
        this.state.register.pc += 1;
    }

    /**
     * Increment d
     */
    public 0x14 = () => {
        this.state.cc.setSZP(++this.state.register.d);
        log.ops(`INR D`);
        this.state.register.pc += 1;
    }

    /**
     * Decrement d
     */
    public 0x15 = () => {
        this.state.cc.setSZP(--this.state.register.d);
        log.ops(`DCR D`);
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
        let addr = this.state.register.de;
        this.state.register.a = this.state.memory.get(addr);
        log.ops(`LDAX D (${addr.toString(16)})`);
        this.state.register.pc += 1;
    }

    /**
     * DE <- DE - 1
     */
    public 0x1b = () => {
        this.state.register.de--;
        log.ops(`DCX D`);
        this.state.register.pc += 1;
    }

    /**
     * Increment e
     */
    public 0x1c = () => {
        this.state.cc.setSZP(++this.state.register.e);
        log.ops(`INR E`);
        this.state.register.pc += 1;
    }

    /**
     * Decrement e
     */
    public 0x1d = () => {
        this.state.cc.setSZP(--this.state.register.e);
        log.ops(`DCR E`);
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

    public 0x1f = () => {
        let a = this.state.register.a;
        this.state.register.a = (this.state.cc.cy << 7) | (a >> 1);
        this.state.cc.cy = Number(1 == (a & 1));
        log.ops(`RAR`);
        this.state.register.pc += 1;
    }

    /**
     * H <- byte 3, L <- byte 2
     */
    public 0x21 = () => {
        this.state.register.l = this.state.memory.get(this.state.register.pc + 1);
        this.state.register.h = this.state.memory.get(this.state.register.pc + 2);
        log.ops(`LXI H ${this.state.register.hl.toString(16).padStart(4, "0")}`);
        this.state.register.pc += 3;
    }

    /**
     * (adr) <-L; (adr+1)<-H
     */
    public 0x22 = () => {
        let addr = this.state.memory.get16(this.state.register.pc + 1);
        this.state.register.hl = this.state.memory.get16(addr);
        log.ops(`SHLD ${addr.toString(16).padStart(4, "0")}`);
        this.state.register.pc += 3;
    }

    /**
     * HL <- HL + 1
     */
    public 0x23 = () => {
        this.state.register.hl++;
        log.ops(`INX H`);
        this.state.register.pc += 1;
    }

    /**
     * Increment h
     */
    public 0x24 = () => {
        this.state.cc.setSZP(++this.state.register.h);
        log.ops(`INR H`);
        this.state.register.pc += 1;
    }

    /**
     * Decrement h
     */
    public 0x25 = () => {
        this.state.cc.setSZP(--this.state.register.h);
        log.ops(`DCR H`);
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
     * L <- (adr); H<-(adr+1)
     */
    public 0x2a = () => {
        let addr = this.state.memory.get16(this.state.register.pc + 1);
        this.state.register.hl = this.state.memory.get16(addr);
        log.ops(`LDAX ${addr.toString(16).padStart(4, "0")}`);
        this.state.register.pc += 3;
    }

    /**
     * HL <- HL - 1
     */
    public 0x2b = () => {
        this.state.register.hl--;
        log.ops(`DCX H`);
        this.state.register.pc += 1;
    }

    /**
     * Increment l
     */
    public 0x2c = () => {
        this.state.cc.setSZP(++this.state.register.l);
        log.ops(`INR L`);
        this.state.register.pc += 1;
    }

    /**
     * Decrement l
     */
    public 0x2d = () => {
        this.state.cc.setSZP(--this.state.register.l);
        log.ops(`DCR L`);
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
     * A <- !A
     */
    public 0x2f = () => {
        this.state.register.a = ~this.state.register.a;
        log.ops(`CMA`);
        this.state.register.pc += 1;
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
     * (adr) <- A
     */
    public 0x32 = () => {
        let addr = this.state.memory.get16(this.state.register.pc + 1);
        this.state.memory.set(addr, this.state.register.a);
        log.ops(`STA ${addr.toString(16).padStart(4, "0")}`);
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
     * Increment m
     */
    public 0x34 = () => {
        let m = this.state.memory.get(this.state.register.hl);
        let ans = m + 1;
        this.state.cc.setSZP(ans);
        this.state.memory.set(this.state.register.hl, ans);
        log.ops(`INR M`);
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
        log.ops(`DCR M`);
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
     * HL = HL + SP
     */
    public 0x39 = () => {
        let ans = this.state.register.hl + this.state.register.sp;
        this.state.cc.carry16(ans);
        this.state.register.hl = ans;
        log.ops(`DAD SP`);
        this.state.register.pc += 1;
    }

    /**
     * A <- (adr)
     */
    public 0x3a = () => {
        let addr = this.state.memory.get16(this.state.register.pc + 1);
        this.state.register.a = this.state.memory.get(addr);
        log.ops(`LDAX ${addr.toString(16).padStart(4, "0")}`);
        this.state.register.pc += 3;
    }

    /**
     * sp <- sp - 1
     */
    public 0x3b = () => {
        this.state.register.sp--;
        log.ops(`DCX SP`);
        this.state.register.pc += 1;
    }

    /**
     * Increment a
     */
    public 0x3c = () => {
        this.state.cc.setSZP(++this.state.register.a);
        log.ops(`INR A`);
        this.state.register.pc += 1;
    }

    /**
     * Decrement a
     */
    public 0x3d = () => {
        this.state.cc.setSZP(--this.state.register.a);
        log.ops(`DCR A`);
        this.state.register.pc += 1;
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
     * CY <- !CY
     */
    public 0x3f = () => {
        this.state.cc.cy = ~this.state.cc.cy & 0x01;
        log.ops(`CMC`);
        this.state.register.pc += 1;
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
     * A <- A + B
     */
    public 0x80 = () => {
        let ans = this.state.register.a + this.state.register.b;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        log.ops(`ADD B`);
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
        log.ops(`ADD C`);
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
        log.ops(`ADD D`);
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
        log.ops(`ADD E`);
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
        log.ops(`ADD H`);
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
        log.ops(`ADD L`);
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
        log.ops(`ADD (HL)`);
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
        log.ops(`ADD A`);
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
        log.ops(`ADC B`);
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
        log.ops(`ADC C`);
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
        log.ops(`ADC D`);
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
        log.ops(`ADC E`);
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
        log.ops(`ADC H`);
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
        log.ops(`ADC L`);
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
        log.ops(`ADC (HL)`);
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
        log.ops(`ADC A`);
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
        log.ops(`SUB B`);
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
        log.ops(`SUB C`);
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
        log.ops(`SUB D`);
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
        log.ops(`SUB E`);
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
        log.ops(`SUB H`);
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
        log.ops(`SUB L`);
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
        log.ops(`SUB (HL)`);
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
        log.ops(`SUB A`);
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
        log.ops(`SBB B`);
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
        log.ops(`SBB C`);
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
        log.ops(`SBB D`);
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
        log.ops(`SBB E`);
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
        log.ops(`SBB H`);
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
        log.ops(`SBB L`);
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
        log.ops(`SBB (HL)`);
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
        log.ops(`SBB A`);
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
        log.ops(`ANA B`);
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
        log.ops(`ANA C`);
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
        log.ops(`ANA D`);
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
        log.ops(`ANA E`);
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
        log.ops(`ANA H`);
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
        log.ops(`ANA L`);
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
        log.ops(`ANA (HL)`);
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
        log.ops(`ANA A`);
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
        log.ops(`XRA B`);
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
        log.ops(`XRA C`);
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
        log.ops(`XRA D`);
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
        log.ops(`XRA E`);
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
        log.ops(`XRA H`);
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
        log.ops(`XRA L`);
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
        log.ops(`XRA (HL)`);
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
        log.ops(`XRA A`);
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
        log.ops(`ORA B`);
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
        log.ops(`ORA C`);
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
        log.ops(`ORA D`);
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
        log.ops(`ORA E`);
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
        log.ops(`ORA H`);
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
        log.ops(`ORA L`);
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
        log.ops(`ORA (HL)`);
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
        log.ops(`ORA A`);
    }

    /**
     * A - B
     */
    public 0xb8 = () => {
        let ans = this.state.register.a ^ this.state.register.b;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.pc += 1;
        log.ops(`CMP B`);
    }

    /**
     * A - C
     */
    public 0xb9 = () => {
        let ans = this.state.register.a ^ this.state.register.c;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.pc += 1;
        log.ops(`CMP C`);
    }

    /**
     * A - D
     */
    public 0xba = () => {
        let ans = this.state.register.a ^ this.state.register.d;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.pc += 1;
        log.ops(`CMP D`);
    }

    /**
     * A - E
     */
    public 0xbb = () => {
        let ans = this.state.register.a ^ this.state.register.e;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.pc += 1;
        log.ops(`CMP E`);
    }

    /**
     * A - H
     */
    public 0xbc = () => {
        let ans = this.state.register.a ^ this.state.register.h;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.pc += 1;
        log.ops(`CMP H`);
    }

    /**
     * A - L
     */
    public 0xbd = () => {
        let ans = this.state.register.a ^ this.state.register.l;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.pc += 1;
        log.ops(`CMP L`);
    }

    /**
     * A - (HL)
     */
    public 0xbe = () => {
        let ans = this.state.register.a ^ this.state.memory.get(this.state.register.hl);
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.pc += 1;
        log.ops(`CMP (HL)`);
    }

    /**
     * A - A
     */
    public 0xbf = () => {
        let ans = this.state.register.a ^ this.state.register.a;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.pc += 1;
        log.ops(`CMP A`);
    }

    /**
     * if NZ, RET
     */
    public 0xc0 = () => {
        if (this.state.cc.z !== 0) {
            this.state.register.pc += 1;
            log.ops(`RNZ`);
            return;
        }
        this.return("RNZ");
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
     * Jump to address contained in bytes 2 and 3
     */
    private jump(type: string): void {
        let addr = this.state.memory.get16(this.state.register.pc + 1);
        this.state.register.pc = addr;
        log.ops(`${type} ${addr.toString(16)}`);
    }

    /**
     * if NZ, PC <- adr
     */
    public 0xc2 = () => {
        if (this.state.cc.z !== 0) {
            this.state.register.pc += 3;
            log.ops(`JNZ`);
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
            log.ops(`CNZ`);
            return;
        }
        this.call("CNZ");
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
     * Call address contained in bytes 2 and 3
     *
     * @param {string} type
     */
    private rst(addr: number): void {
        this.state.register.sp -= 2;
        this.state.memory.set16(this.state.register.sp, this.state.register.pc + 1);
        this.state.register.pc = addr;
        log.ops(`RST ${addr.toString(16).padStart(2, "0")}`);
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
            log.ops(`RZ`);
            return;
        }
        this.return("RZ");
    }

    /**
     * Return to the address on the stack
     *
     * @param {string} type
     */
    private return(type: string) {
        this.state.register.pc = this.state.memory.get16(this.state.register.sp);
        this.state.register.sp += 2;
        this.state.register.pc += 1;
        log.ops(`${type} ${this.state.register.pc.toString(16)}`);
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
            log.ops(`JZ`);
            return;
        }
        this.jump("JZ");
    }

    /**
     * Call address contained in bytes 2 and 3
     *
     * @param {string} type
     */
    private call(type: string): void {
        this.state.register.sp -= 2;
        let addr = this.state.memory.get16(this.state.register.pc + 1);
        this.state.memory.set16(this.state.register.sp, this.state.register.pc + 2);
        this.state.register.pc = addr;
        log.ops(`${type} ${addr.toString(16)}`);
    }

    /**
     * (SP-1)<-PC.hi;(SP-2)<-PC.lo;SP<-SP-2;PC=adr
     */
    public 0xcd = () => {
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
        this.state.register.pc += 1;
        log.ops(`ACI ${data}`);
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
            log.ops(`RNC`);
            return;
        }
        this.return("RNC");
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
        let port = this.state.memory.get(this.state.register.pc + 1);
        log.ops(`OUT ${port.toString(16)} (${this.state.register.a})`);
        try {
            this.state.io[port] = this.state.register.a;
        } catch(e) {
            throw "Unimplemented io port access";
        }
        this.state.register.pc += 2;
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
     * A <- A - data
     */
    public 0xd6 = () => {
        let data = this.state.memory.get(this.state.register.pc + 1);
        let ans = this.state.register.a - data;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        log.ops(`SUI ${data}`);
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
            log.ops(`RC`);
            return;
        }
        this.return("RC");
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
        log.ops(`SBI ${data}`);
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
            log.ops(`RPO`);
            return;
        }
        this.return("RPO");
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
     * A <- A & data
     */
    public 0xe6 = () => {
        let data = this.state.memory.get(this.state.register.pc + 1);
        let ans = this.state.register.a & data;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        log.ops(`ANI ${data}`);
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
            log.ops(`RPE`);
            return;
        }
        this.return("RPE");
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
     * A <- A ^ data
     */
    public 0xee = () => {
        let data = this.state.memory.get(this.state.register.pc + 1);
        let ans = this.state.register.a ^ data;
        this.state.cc.setSZP(ans);
        this.state.cc.carry(ans);
        this.state.register.a = ans;
        this.state.register.pc += 1;
        log.ops(`XRI ${data}`);
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
            log.ops(`RP`);
            return;
        }
        this.return("RP");
    }

    /**
     * flags <- (sp); A <- (sp+1); sp <- sp+2
     */
    public 0xf1 = () => {
        this.state.register.psw = this.state.memory.get16(this.state.register.sp);
        this.state.register.sp += 2;
        this.state.register.pc += 1;
        log.ops(`POP H`);
    }

    /**
     * Disable Interrupts
     */
    public 0xf3 = () => {
        this.state.int = false;
        this.state.register.pc += 1;
        log.ops(`DI`);
    }

    /**
     * (sp-2)<-flags; (sp-1)<-A; sp <- sp - 2
     */
    public 0xf5 = () => {
        let sp = this.state.register.sp;
        this.state.memory.set16(sp - 2, this.state.register.psw);
        this.state.register.sp -= 2;
        this.state.register.pc += 1;
        log.ops(`PUSH PSW`);
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
        this.state.register.pc += 1;
        log.ops(`SBI ${data}`);
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
            log.ops(`RM`);
            return;
        }
        this.return("RM");
    }

    /**
     * Enable Interrupts
     */
    public 0xfb = () => {
        this.state.int = true;
        this.state.register.pc += 1;
        log.ops(`EI`);
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
     * CALL $38
     */
    public 0xff = () => {
        this.rst(0x38);
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
        var sourceView = new Uint8Array(source),
            destView = new Uint8Array(new ArrayBuffer(length));
        destView.set(sourceView);
        return destView.buffer;
    };
}
