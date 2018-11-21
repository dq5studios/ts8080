/**
 * Interact with 8080 emulator
 */


class Invaders {
    public cpu8080: Worker;
    public screen: CanvasRenderingContext2D;
    public screen_interval: number = 0; // Set interval
    public screen_cycle: number = 0;
    public memory: DataView;

    /**
     * Set listeners
     */
    constructor() {
        this.cpu8080 = new Worker("cpu8080.js");
        this.cpu8080.postMessage({"action": "init"});

        let start_btn = document.getElementById("start");
        if (start_btn) {
            start_btn.addEventListener("click", this.start);
        }
        let stop_btn = document.getElementById("stop");
        if (stop_btn) {
            stop_btn.addEventListener("click", this.stop);
        }
        window.addEventListener("keydown", this.keydownDispatch);
        window.addEventListener("keyup", this.keyupDispatch);

        let screen = <HTMLCanvasElement>document.getElementById("screen");
        this.screen = screen.getContext("2d", { alpha: false })!;

        let empty = new ArrayBuffer(0x4000);
        this.memory = new DataView(empty);
        this.cpu8080.onmessage = this.receiveMemory;
    }

    /**
     * Map keyboard to IO commands
     *
     * @param {KeyboardEvent} ev Keyboard
     */
    public keydownDispatch(ev: KeyboardEvent): void {
        switch (ev.key.toLowerCase()) {
            case "1":
                invaders.cpu8080.postMessage({"action": "down_credit"});
                break;
            case "s":
                invaders.cpu8080.postMessage({"action": "down_p1_start"});
                break;
            case "a":
                invaders.cpu8080.postMessage({"action": "down_p1_left"});
                break;
            case "w":
                invaders.cpu8080.postMessage({"action": "down_p1_shot"});
                break;
            case "d":
                invaders.cpu8080.postMessage({"action": "down_p1_right"});
                break;
        }
    }

    /**
     * Map keyboard to IO commands
     *
     * @param {KeyboardEvent} ev Keyboard
     */
    public keyupDispatch(ev: KeyboardEvent): void {
        switch (ev.key.toLowerCase()) {
            case "1":
                invaders.cpu8080.postMessage({"action": "up_credit"});
                break;
            case "s":
                invaders.cpu8080.postMessage({"action": "up_p1_start"});
                break;
            case "a":
                invaders.cpu8080.postMessage({"action": "up_p1_left"});
                break;
            case "w":
                invaders.cpu8080.postMessage({"action": "up_p1_shot"});
                break;
            case "d":
                invaders.cpu8080.postMessage({"action": "up_p1_right"});
                break;
        }
    }

    /**
     * Turn on the timers and start execution
     *
     * @param {Event} e Click event
     */
    public start(e: Event) {
        e.preventDefault();
        invaders.cpu8080.postMessage({"action": "start"});
        // Start up the "monitor" that operates at 60Hz
        invaders.screen_interval = setInterval(() => { invaders.drawScreenToggle(); }, 1000 / 60);
    }

    /**
     * Turn off the timers
     *
     * @param {Event} e Click event
     */
    public stop(e: Event) {
        e.preventDefault();
        invaders.cpu8080.postMessage({"action": "stop"});
        clearInterval(invaders.screen_interval);
        console.log("off");
        invaders.cpu8080.terminate();
    }

    /**
     * Draw the screen and send alternating interrupts.  Not exactly how the original hardware worked
     */
    public drawScreenToggle() {
        invaders.cpu8080.postMessage({"action": "memory"});
        invaders.drawScreen();
        if (invaders.screen_cycle === 0) {
            invaders.cpu8080.postMessage({"action": "interrupt", "int": 0xcf});
        } else {
            invaders.cpu8080.postMessage({"action": "interrupt", "int": 0xd7});
        }
        invaders.screen_cycle ^= 1;
    }

    /**
     * Write the vram to a canvas element
     */
    public drawScreen() {
        let width = 256;
        let height = 224;
        let raw = invaders.screen.createImageData(width, height);
        for (let i = 0; i < raw.data.byteLength; i += 32) {
            let byte = invaders.memory.getUint8(0x2400 + (i / 32));
            for (let b = 0; b < 8; b++) {
                let v = ((byte & Math.pow(2, b)) == Math.pow(2, b)) ? 0xff : 0;
                raw.data[i + b * 4] = v;
                raw.data[i + b * 4 + 1] = v;
                raw.data[i + b * 4 + 2] = v;
                raw.data[i + b * 4 + 3] = v;
            }
        }
        invaders.screen.putImageData(raw, 0, 0);
    }

    /**
     * Receives the vram from the 8080 web worker and assigns it to a local dataview
     *
     * @param {MessageEvent} event
     */
    public receiveMemory(event: MessageEvent) {
        invaders.memory = new DataView(event.data[0]);
    }
}

let invaders: Invaders;
window.onload = () => { invaders = new Invaders(); };
