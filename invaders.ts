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
    let step_btn = document.getElementById("step");
    if (step_btn) {
        step_btn.addEventListener("click", (e) => { e.preventDefault(); invaders.step(); });
    }
}

window.onload = loadRom;


class ConditionCodes {
    public z: number = 1; // Result equal to zero
    public s: number = 1; // bit 7 is 1
    public p: number = 1; // Even parity
    public cy: number = 1; // Carry/Borrow
    public ac: number = 1; // Aux carry
    public pad: number = 3;
}

class Registers {
    private _a: number = 0;
    private _b: number = 0;
    private _c: number = 0;
    private _d: number = 0;
    private _e: number = 0;
    private _h: number = 0;
    private _l: number = 0;
    private _pc: number = 0; // Program Counter
    private _sp: number = 0; // Stack Pointer


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
        this._pc = v;
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
        this._sp = v;
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
        this._a = v;
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
        this._b = v;
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
        this._c = v;
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
        this._d = v;
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
        this._e = v;
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
        this._h = v;
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
        this._l = v;
    }
}

class State8080 {
    public ready: boolean = false; // Finished loading, ready to execute
    public register = new Registers(); // Register container
    // public pc: DataView = new DataView(new ArrayBuffer(2)); // Program Counter
    public int: boolean = true; // Interrupts enabled
    public memory: DataView = new DataView(new ArrayBuffer(8192));
    public cc: ConditionCodes = new ConditionCodes();
    public ops: OpCodes = new OpCodes(this);

    /**
     * Creates an instance of State8080.
     * @param {string} rom Filename
     */
    constructor(rom: string) {
        fetch(rom)
        .then(response => response.arrayBuffer())
        .then(buffer => { this.memory = new DataView(buffer); } )
        .then(() => { this.init(); })
        .then(() => { log.drawMemory(this.memory); });
        // this.pc.setUint16(0, 0);
        // this.sp.setUint16(0, 0xff);
    }

    /**
     * Initialize registers
     */
    public init(): void {
        this.register.a = 0;
        this.register.b = 0;
        this.register.c = 0;
        this.register.d = 0;
        this.register.e = 0;
        this.register.h = 0;
        this.register.l = 0;
        this.register.pc = 0;
        this.register.sp = 0;
        this.ready = true;
    }

    /**
     * Start emulation
     */
    public run() {
        try {
            while (true) {
                this.step()
            }
        } catch (err) {
            // Do something?
        }
    }

    /**
     * Step the processor one instruction
     */
    public step() {
        try {
            let opcode = this.memory.getUint8(this.register.pc);
            if (typeof invaders.ops[opcode] === "undefined") {
                let addr = this.register.pc.toString(16);
                let opcode = this.memory.getUint8(Number(`0x${addr}`)).toString(16);
                log.ops(`Could not execute opcode ${opcode} at ${addr}`);
                throw "Unimplemented OpCode";
            }
            let advance = invaders.ops[opcode]();
            this.register.pc += advance;
        } catch (err) {
            console.log(err);
            throw "Step failed";
        }
    }
}

class OpCodes {
    private state: State8080; // Which 8080 are we operating on

    /**
     * No Op
     */
    public 0x00 = () => {
        log.ops(`NOP`);
        return 1;
    }

    /**
     * Move byte 2 to b
     */
    public 0x06 = () => {
        let byte = this.state.memory.getUint8(this.state.register.pc + 1);
        this.state.register.b = byte;
        let b = byte.toString(16);
        log.ops(`MVI B ${b}`);
        return 2;
    }

    /**
     * Increment h
     */
    public 0x24 = () => {
        let h = this.state.register.h;
        let ans = h + 1;
        this.state.cc.z = ((ans & 0xff) === 0) ? 1 : 0;
        this.state.cc.s = ((ans & 0x80) !== 0) ? 1 : 0;
        // this.state.cc.p = this.parity(n & 0xff);
        this.state.register.h = ans & 0xff;
        log.ops(`INR H`);
        return 1;
    }

    /**
     * SP.hi <- byte 3, SP.lo <- byte 2
     */
    public 0x31 = () => {
        let sp = this.state.memory.getInt16(this.state.register.pc + 1, true);
        this.state.register.sp = sp;
        let b = sp.toString(16);
        log.ops(`LXI SP ${b}`);
        return 3;
    }

    /**
     * Jump to address contained in bytes 2 and 3 if z is 0
     */
    public 0xc2 = () => {
        if (this.state.cc.z !== 0) {
            this.state.register.pc += 2;
            log.ops(`JNZ`);
            return 1;
        }
        let addr = this.state.memory.getUint16(this.state.register.pc + 1, true);
        this.state.register.pc = addr;
        let a = addr.toString(16);
        log.ops(`JNZ ${a}`);
        return 0;
    }

    /**
     * Jump to address contained in bytes 2 and 3
     */
    public 0xc3 = () => {
        let addr = this.state.memory.getUint16(this.state.register.pc + 1, true);
        this.state.register.pc = addr;
        let a = addr.toString(16);
        log.ops(`JMP ${a}`);
        return 0;
    }

    /**
     * Call address contained in bytes 2 and 3
     * (SP-1)<-PC.hi;(SP-2)<-PC.lo;SP<-SP-2;PC=adr
     */
    public 0xcd = () => {
        let ret = this.state.register.pc;
        let ret_hi = (ret >> 8) & 0xff;
        let ret_lo = ret & 0xff;
        let sp = this.state.register.sp;
        let addr = this.state.memory.getUint16(this.state.register.pc + 1, true);
        this.state.memory.setUint8(sp - 1, ret_hi);
        this.state.memory.setUint8(sp - 2, ret_lo);
        this.state.register.sp -= 2;
        this.state.register.pc = addr;
        let a = addr.toString(16);
        log.ops(`CALL ${a}`);
        return 0;
    }

    /**
     * Creates an instance of OpCodes.
     * @param {State8080} state 8080 being used
     */
    constructor(state: State8080) {
        this.state = state;
    }
}


class Logger {
    /**
     * Log a msg to the ops box
     */
    public ops(msg: string) {
        if (!logging_enabled) {
            return;
        }
        let ops_pre = document.getElementById("ops");
        if (ops_pre) {
            ops_pre.innerHTML += msg + "\n";
        }
    }

    /**
     * Draw memory into memory box
     */
    public drawMemory(mem: DataView) {
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
            chunk += `${addr} `;
        }
        mem_pre.innerHTML = chunk;
    }

    /**
     * Update register
     */
    public reg(reg: string, val: number) {
        if (!logging_enabled) {
            return;
        }
        let reg_inp = <HTMLInputElement>document.getElementById(reg);
        if (!reg_inp) {
            return;
        }
        reg_inp.value = val.toString(16);
    }
}
