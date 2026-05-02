class Renderer {
    constructor(canvasId, game) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.game = game;
        this.levelData = null;
        this.state = null;
        this.cellSize = 20;
    }

    setLevel(levelData, state) {
        this.levelData = levelData;
        this.state = state;
        this.canvas.width = levelData.mapWidth;
        this.canvas.height = levelData.mapHeight;
        this.setupEvents();
    }

    setupEvents() {
        this.canvas.onclick = (e) => this.handleClick(e);
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        for (const sw of this.state.switches) {
            const track = this.levelData.tracks.find(t => t.id === sw.trackId);
            if (track && this.isPointNear(x, y, track.x, track.y, 30)) {
                this.game.onSwitchClick(sw.id);
                return;
            }
        }

        for (const sig of this.state.signals) {
            if (this.isPointNear(x, y, sig.x, sig.y, 25)) {
                this.game.onSignalClick(sig.id);
                return;
            }
        }

        for (const train of this.state.trains) {
            const pos = this