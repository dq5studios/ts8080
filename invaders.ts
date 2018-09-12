/**
 * $2000 is the start of the program's "work ram"
 * $2400 is the start of the video memory
 */

let invaders: State8080;

/**
 * Load rom into memory
 */
function loadRom(): void {
    invaders = new State8080("invaders");
}

window.onload = loadRom;


class ConditionCodes {
    public z: number = 1;
    public s: number = 1;
    public p: number = 1;
    public cy: number = 1;
    public ac: number = 1;
    public pad: number = 3;
}

class State8080 {
    public a: number = 0; // Registers
    public b: number = 0;
    public c: number = 0;
    public d: number = 0;
    public e: number = 0;
    public h: number = 0;
    public l: number = 0;
    public pc: number = 0; // Program Counter
    public sp: number = 0; // Stack Pointer
    public memory: DataView = new DataView(new ArrayBuffer(8192));
    public cc: ConditionCodes = new ConditionCodes();
    public ops: OpCodes = new OpCodes(this);

    constructor(rom: string) {
        fetch(rom)
        .then(response => response.arrayBuffer())
        .then(buffer => { this.memory = new DataView(buffer); } );
    }

    /**
     * Start
     */
    public run() {
        try {
            while (true) {
                let opcode = this.memory.getUint8(this.pc);
                if (typeof invaders.ops[opcode] === "undefined") {
                    throw "Unimplemented OpCode";
                }
                invaders.ops[opcode]();
                this.pc++;
            }
        } catch (err) {
            let opcode = this.memory.getUint8(this.pc).toString(16);
            console.log(`Could not execute opcode ${opcode} at ${this.pc}`);
            console.log(err);
        }
    }
}

class OpCodes {
    private state: State8080; // Which 8080 are we operating on

    /**
     * No Op
     */
    public 0x00 = () => { };

    /**
     * Jump to address contained in next two bytes
     */
    public 0xc3 = () => {
        let addr = this.state.memory.getUint16(this.state.pc + 1, true);
        this.state.pc = addr;
    };

    /**
     * Creates an instance of OpCodes.
     * @param {State8080} state 8080 being used
     */
    constructor(state: State8080) {
        this.state = state;
    }
}
