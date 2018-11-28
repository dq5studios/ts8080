### A basic 8080 emulator

Loads a local file called `invaders` that is the files `invaders.h`, `invaders.g`, `invaders.f` and `invaders.e` concatenated in that order.

### Emulator Limitations

Only emulates Space Invaders hardware.  Video hardware isn't accurately emulated as it currently copies the entire memory buffer and draws the entire screen.  Dip switches are hard coded but honored.  Sound is not emulated.

#### Controls

    1 Insert coin
    S Start
    W Fire
    A Move ship left
    D Move ship right
