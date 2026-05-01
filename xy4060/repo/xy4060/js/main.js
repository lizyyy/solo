var gameController = null;

document.addEventListener('DOMContentLoaded', function() {
    var canvas = document.getElementById('game-canvas');
    
    gameController = new GameController({
        canvas: canvas
    });
    
    console.log('🤖 线路巡检机器人训练场已启动！');
    
    window.gameController = gameController;
});
