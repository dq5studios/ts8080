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

class State8080 {
    public ready: boolean = false; // Finished loading, ready to execute
    public a: number = 0; // Registers
    public b: number = 0;
    public c: number = 0;
    public d: number = 0;
    public e: number = 0;
    public h: number = 0;
    public l: number = 0;
    public pc: DataView = new DataView(new ArrayBuffer(2)); // Program Counter
    public sp: DataView = new DataView(new ArrayBuffer(2)); // Stack Pointer
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
        .then(() => { this.ready = true; })
        .then(() => { log.drawMemory(this.memory); });
        this.pc.setUint16(0, 0);
        this.sp.setUint16(0, 0xff);
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
            let opcode = this.memory.getUint8(this.pc.getUint16(0));
            if (typeof invaders.ops[opcode] === "undefined") {
                throw "Unimplemented OpCode";
            }
            invaders.ops[opcode]();
            this.pc.setUint16(0, this.pc.getUint16(0) + 1);
        } catch (err) {
            let addr = this.pc.getUint16(0).toString(16);
            let opcode = this.memory.getUint8(Number(`0x${addr}`)).toString(16);
            log.ops(`Could not execute opcode ${opcode} at ${addr}`);
            log.ops(err);
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
    }

    /**
     * Move byte 2 to b
     */
    public 0x06 = () => {
        let byte = this.state.memory.getUint8(this.state.pc.getUint16(0) + 1);
        this.state.b = byte;
        this.state.pc.setUint16(0, this.state.pc.getUint16(0) + 1);
        let b = byte.toString(16);
        log.ops(`MVI B ${b}`);
    }

    /**
     * Increment h
     */
    public 0x24 = () => {
        let h = this.state.h;
        let ans = h + 1;
        this.state.cc.z = ((ans & 0xff) === 0) ? 1 : 0;
        this.state.cc.s = ((ans & 0x80) !== 0) ? 1 : 0;
        // this.state.cc.p = this.parity(n & 0xff);
        this.state.h = ans & 0xff;
        log.ops(`INR H`);
    }

    /**
     * Jump to address contained in bytes 2 and 3 if z is 0
     */
    public 0xc2 = () => {
        if (this.state.cc.z !== 0) {
            this.state.pc.setUint16(0, this.state.pc.getUint16(0) + 2);
            log.ops(`JNZ`);
            return;
        }
        let addr = this.state.memory.getUint16(this.state.pc.getUint16(0) + 1, true);
        this.state.pc.setUint16(0, addr);
        let a = addr.toString(16);
        log.ops(`JNZ ${a}`);
    }

    /**
     * Jump to address contained in bytes 2 and 3
     */
    public 0xc3 = () => {
        let addr = this.state.memory.getUint16(this.state.pc.getUint16(0) + 1, true);
        this.state.pc.setUint16(0, addr);
        let a = addr.toString(16);
        log.ops(`JMP ${a}`);
    }

    /**
     * Call address contained in bytes 2 and 3
     */
    public 0xcd = () => {
        let pc = this.state.pc.getUint16(0);
        let sp = this.state.sp.getUint16(0);
        let addr = this.state.memory.getUint16(pc + 1, true);
        this.state.memory.setUint8(sp - 1, this.state.pc.getUint8(1));
        this.state.memory.setUint8(sp - 2, this.state.pc.getUint8(0));
        this.state.sp.setUint16(0, this.state.sp.getUint16(0) - 2);
        this.state.pc.setUint16(0, addr);
        let a = addr.toString(16);
        log.ops(`CALL ${a}`);
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
}
