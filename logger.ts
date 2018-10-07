let logging_enabled = false;

/**
 * Log messages to the screen when enabled
 */
export class Logger {
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
    public step(pc: number): void {
        if (!logging_enabled) {
            return;
        }
        let ops_pre = document.getElementById("ops");
        if (ops_pre) {
            let kbd = document.createElement("kbd");
            kbd.innerText = pc.toString(16).padStart(4, "0");
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

    public refreshRegisters(): void {
        // this.reg("a", invaders.register.a);
        // this.reg("b", invaders.register.b);
        // this.reg("c", invaders.register.c);
        // this.reg("d", invaders.register.d);
        // this.reg("e", invaders.register.e);
        // this.reg("h", invaders.register.h);
        // this.reg("l", invaders.register.l);
        // this.reg("pc", invaders.register.pc);
        // this.reg("sp", invaders.register.sp);
        // this.reg("z", invaders.cc.z);
        // this.reg("s", invaders.cc.s);
        // this.reg("p", invaders.cc.p);
        // this.reg("cy", invaders.cc.cy);
        // this.reg("ac", invaders.cc.ac);
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
            let cls = /*typeof invaders.ops[i] === "undefined" ? "bg-danger":*/ "bg-success";
            // if ([0x10, 0x20, 0x30, 0x08, 0x18, 0x28, 0x38, 0xcb, 0xd9, 0xdd, 0xed, 0xfd].indexOf(i) > -1) {
            //     cls = "bg-warning";
            // }
            chunk += `<kbd class="${cls}">${i.toString(16).padStart(2, "0")}</kbd>`;
        }
        ops_pre.innerHTML = chunk + `\n`;
    }
}
