//
// $2000 is the start of the program's "work ram"
// $2400 is the start of the video memory
// 8080 is little endian
// lo.hi => 21.43 == 0x4321
//

import { State8080, IO8080 } from "cpu8080";

let invaders: SpaceInvaders;
// let log: Logger = new Logger();
// let pc_buffer: string[] = [];

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
    let off_btn = document.getElementById("off");
    if (off_btn) {
        off_btn.addEventListener("click", (e) => { e.preventDefault(); invaders.off(); });
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
    window.addEventListener("keydown", keydownDispatch);
    window.addEventListener("keyup", keyupDispatch);
}

function keydownDispatch(ev: KeyboardEvent) {
    if (!invaders.io) {
        return;
    }
    switch (ev.key.toLowerCase()) {
        case "1":
            invaders.io.downCredit();
            break;
        case "s":
            invaders.io.downP1Start();
            break;
        case "a":
            invaders.io.downP1Left();
            break;
        case "w":
            invaders.io.downP1Shot();
            break;
        case "d":
            invaders.io.downP1Right();
            break;
    }
}
function keyupDispatch(ev: KeyboardEvent) {
    if (!invaders.io) {
        return;
    }
    switch (ev.key.toLowerCase()) {
        case "1":
            invaders.io.upCredit();
            break;
        case "s":
            invaders.io.upP1Start();
            break;
        case "a":
            invaders.io.upP1Left();
            break;
        case "w":
            invaders.io.upP1Shot();
            break;
        case "d":
            invaders.io.upP1Right();
            break;
    }
}

window.onload = loadRom;



/**
 * IO ports for Space Invaders machine
 */
class SpaceInvadersIO extends IO8080 {
    [index: number]: number;

    private alpha = [
        "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V",
        "W", "X", "Y", "Z", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "<", ">", " ", "=", "*"
    ];
    private port: number[];
    private shift: number = 0; // Internal shift register for 16 bit shifting

    /**
     * Write the initial state of the IO ports
     */
    constructor() {
        super();
        this.port = [];
        this.port[0] = 0b00001110;
        this.port[1] = 0b00001000;
        this.port[2] = 0b00000000;
        this.port[3] = 0b00000000;
    }

    public downCredit(): void {
        this.port[1] |= 0b00000001;
    }

    public upCredit(): void {
        this.port[1] &= 0b11111110;
    }

    public downP2Start(): void {
        this.port[1] |= 0b00000010;
    }

    public upP2Start(): void {
        this.port[1] &= 0b11111101;
    }

    public downP1Start(): void {
        this.port[1] |= 0b00000100;
    }

    public upP1Start(): void {
        this.port[1] &= 0b11111011;
    }

    public downP1Shot(): void {
        this.port[1] |= 0b00010000;
    }

    public upP1Shot(): void {
        this.port[1] &= 0b11101111;
    }

    public downP1Left(): void {
        this.port[1] |= 0b00100000;
    }

    public upP1Left(): void {
        this.port[1] &= 0b11011111;
    }

    public downP1Right(): void {
        this.port[1] |= 0b01000000;
    }

    public upP1Right(): void {
        this.port[1] &= 0b10111111;
    }

    public downP2Shot(): void {
        this.port[2] |= 0b00010000;
    }

    public upP2Shot(): void {
        this.port[2] &= 0b11101111;
    }

    public downP2Left(): void {
        this.port[2] |= 0b00100000;
    }

    public upP2Left(): void {
        this.port[2] &= 0b11011111;
    }

    public downP2Right(): void {
        this.port[2] |= 0b01000000;
    }

    public upP2Right(): void {
        this.port[2] &= 0b10111111;
    }

    /**
     * Read port 0, not used
     * bit 0 DIP4 (Seems to be self-test-request read at power up)
     * bit 1 Always 1
     * bit 2 Always 1
     * bit 3 Always 1
     * bit 4 Fire
     * bit 5 Left
     * bit 6 Right
     * bit 7 ? tied to demux port 7 ?
     */
    public get 0x00() {
        return this.port[0];
    }

    /**
     * Read port 1, Player one controls
     * bit 0 = CREDIT (1 if deposit)
     * bit 1 = 2P start (1 if pressed)
     * bit 2 = 1P start (1 if pressed)
     * bit 3 = Always 1
     * bit 4 = 1P shot (1 if pressed)
     * bit 5 = 1P left (1 if pressed)
     * bit 6 = 1P right (1 if pressed)
     * bit 7 = Not connected
     */
    public get 0x01() {
        return this.port[1];
    }

    /**
     * Read port 2, Player two controls
     * bit 0 = DIP3 00 = 3 ships  10 = 5 ships
     * bit 1 = DIP5 01 = 4 ships  11 = 6 ships
     * bit 2 = Tilt
     * bit 3 = DIP6 0 = extra ship at 1500, 1 = extra ship at 1000
     * bit 4 = P2 shot (1 if pressed)
     * bit 5 = P2 left (1 if pressed)
     * bit 6 = P2 right (1 if pressed)
     * bit 7 = DIP7 Coin info displayed in demo screen 0=ON
     */
    public get 0x02() {
        return this.port[2];
    }

    /**
     * Shift amount
     */
    public set 0x02(v: number) {
        this.shift = (((this.shift << v) & 0xffff) >> 8);
    }

    /**
     * Shift results
     */
    public get 0x03() {
        return this.shift;
    }

    /**
     * Sound clips
     * bit 0= UFO (repeats)        SX0 0.raw
     * bit 1= Shot                 SX1 1.raw
     * bit 2= Flash (player die)   SX2 2.raw
     * bit 3= Invader die          SX3 3.raw
     * bit 4= Extended play        SX4
     * bit 5= AMP enable           SX5
     * bit 6= NC (not wired)
     * bit 7= NC (not wired)
     */
    public set 0x03(v: number) {}

    /**
     * Shift data
     */
    public set 0x04(v: number) {
        this.shift = this.shift >> 8;
        this.shift += (v << 8);
        this.shift = this.shift & 0xffff;
    }

    /**
     * Sound clips
     * bit 0= Fleet movement 1     SX6 4.raw
     * bit 1= Fleet movement 2     SX7 5.raw
     * bit 2= Fleet movement 3     SX8 6.raw
     * bit 3= Fleet movement 4     SX9 7.raw
     * bit 4= UFO Hit              SX10 8.raw
     * bit 5= NC (Cocktail mode control ... to flip screen)
     * bit 6= NC (not wired)
     * bit 7= NC (not wired)
     */
    public set 0x05(v: number) {}

    /**
     * Write to watchdog
     */
    public set 0x06(v: number) {
        if (typeof this.alpha[v] === "undefined") {
            // console.log(v);
            return;
        }
        // console.log(this.alpha[v]);
    }
}

/**
 * Space Invaders machine
 */
class SpaceInvaders extends State8080 {
    public screen!: CanvasRenderingContext2D;
    public screen_interval: number = 0; // Set interval
    public screen_interval_l: number = 0; // Set interval
    public screen_interval_r: number = 0; // Set interval
    public io!: SpaceInvadersIO;
    public screen_cycle: number = 0;

    /**
     * Load the invaders rom dump into the 8080
     */
    constructor() {
        super("invaders");
    }

    public init() {
        super.init();
        this.io = new SpaceInvadersIO();
        this.register.pc = 0;
        this.register.sp = 0x00;
        // this.register.sp = 0x2400;
        this.setupScreen();
        console.log("Ready machine");
    }

    /**
     * Turn on the timers and start execution
     */
    public run() {
        // Start up the "monitor" that operates at 60Hz
        // this.screen_interval = setInterval(() => { this.drawScreen(); }, 1000 / 60);
        this.screen_interval = setInterval(() => { this.drawScreenToggle(); }, 1000 / 60);
        // Half vblank
        // End vblank
        setTimeout(() => { super.run(); });
    }

    /**
     * Turn off the timers
     */
    public off() {
        super.pause();
        clearInterval(this.screen_interval);
        clearInterval(this.screen_interval_l);
        clearInterval(this.screen_interval_r);
        console.log("off");
    }

    public setupScreen() {
        let screen = <HTMLCanvasElement>document.getElementById("screen");
        if (!screen) {
            return;
        }
        this.screen  = screen.getContext("2d", { alpha: false })!;
    }

    public drawScreen() {
        let width = 256;
        let height = 224;
        let raw = this.screen.createImageData(width, height);
        for (let i = 0; i < raw.data.byteLength; i += 32) {
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
    }

    public drawScreenToggle() {
        this.drawScreen();
        // if (this.int && this.active_int == 0x00) {
        //     this.active_int = 0xd7;
        // }
        if (this.screen_cycle === 0) {
            // this.drawScreenLeft();
            if (this.int && this.active_int == 0x00) {
                this.active_int = 0xcf;
            }
        } else {
            // this.drawScreenRight();
            if (this.int && this.active_int == 0x00) {
                this.active_int = 0xd7;
            }
        }
        this.screen_cycle ^= 1;
    }

    public drawScreenLeft() {
        let width = 256;
        let height = 96;
        let raw = this.screen.createImageData(width, height);
        for (let i = 0; i < raw.data.byteLength; i += 32) {
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
        if (this.int && this.active_int == 0x00) {
            this.active_int = 0xcf;
        }
    }

    public drawScreenRight() {
        let width = 256;
        let height = 224 - 96;
        let raw = this.screen.createImageData(width, height);
        for (let i = 0; i < raw.data.byteLength; i += 32) {
            let byte = this.memory.get(0x2400 + ((96 / 8) * 256) + (i / 32));
            for (let b = 0; b < 8; b++) {
                let v = ((byte & Math.pow(2, b)) == Math.pow(2, b)) ? 0xff : 0;
                raw.data[i + b * 4] = v;
                raw.data[i + b * 4 + 1] = v;
                raw.data[i + b * 4 + 2] = v;
                raw.data[i + b * 4 + 3] = v;
            }
        }
        this.screen.putImageData(raw, 0, 96);
        if (this.int && this.active_int == 0x00) {
            this.active_int = 0xd7;
        }
    }

    public cycle() {
        super.cycle();
    }
}
