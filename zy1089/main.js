const game = new GameEngine();
const ui = new GameUI(game);

document.addEventListener('DOMContentLoaded', function() {
    ui.init();
    console.log('☕ 咖啡店早高峰出杯调度游戏已加载');
});

window.addEventListener('beforeunload', function(e) {
    if (game.gameState.running) {
        game.saveState();
        e.preventDefault();
        e.returnValue = '';
    }
});

window.addEventListener('unload', function() {
    if (game.gameState.running) {
        game.saveState();
    }
});
