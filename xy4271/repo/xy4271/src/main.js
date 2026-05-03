import { Game } from './game.js';
import { Renderer } from './ui/renderer.js';
import { UIController } from './ui/controller.js';

class App {
    constructor() {
        this.game = null;
        this.renderer = null;
        this.controller = null;
    }

    async initialize() {
        try {
            this.game = new Game();
            await this.game.initialize();

            const canvas = document.getElementById('game-board');
            this.setupCanvas(canvas);

            const gameState = this.game.getGameState();
            this.renderer = new Renderer(canvas, gameState);
            this.renderer.resize(canvas.width, canvas.height);

            this.controller = new UIController(this.game, this.renderer);

            this.game.setRenderCallback(() => {
                this.renderer.render();
            });

            this.renderer.render();
            this.controller.updateUI();
            this.controller.setTool('maintenance-car');

            window.addEventListener('resize', () => {
                this.handleResize();
            });

            console.log('地铁夜间检修调度游戏初始化完成');
        } catch (error) {
            console.error('初始化失败:', error);
            this.showError(error.message);
        }
    }

    setupCanvas(canvas) {
        const container = canvas.parentElement;
        const style = getComputedStyle(container);
        
        const padding = parseInt(style.paddingLeft) + parseInt(style.paddingRight);
        const availableWidth = container.clientWidth - padding;
        const availableHeight = 500;

        canvas.width = Math.min(availableWidth, 600);
        canvas.height = availableHeight;
    }

    handleResize() {
        const canvas = document.getElementById('game-board');
        this.setupCanvas(canvas);
        this.renderer.resize(canvas.width, canvas.height);
        this.renderer.render();
    }

    showError(message) {
        const messageEl = document.getElementById('game-message');
        messageEl.textContent = `错误: ${message}`;
        messageEl.className = 'error';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const app = new App();
    await app.initialize();
});
