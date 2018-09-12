let rom: DataView;

/**
 * Load rom into memory
 */
function loadRom(): void {
    fetch("invaders")
    .then((response) => { return response.arrayBuffer(); })
    .then((buffer) => { rom = new DataView(buffer); } );
}

window.onload = loadRom;
