document.addEventListener('DOMContentLoaded', function() {
    console.log('黄金四分钟调度游戏初始化中...');
    
    let game = null;
    
    try {
        game = new Game();
        
        const originalUpdate = game.update.bind(game);
        let lastFrameTime = performance.now();
        
        function gameLoop(timestamp) {
            const deltaTime = timestamp - lastFrameTime;
            lastFrameTime = timestamp;
            
            if (game) {
                game.update(deltaTime);
            }
            
            requestAnimationFrame(gameLoop);
        }
        
        requestAnimationFrame(gameLoop);
        
        console.log('游戏初始化成功！');
        console.log('操作指南:');
        console.log('1. 点击"开始游戏"按钮开始');
        console.log('2. 点击地图上的AED存放点让志愿者前往取机');
        console.log('3. 取机后点击患者位置让志愿者前往除颤');
        console.log('4. 除颤完成后拖拽救护车到地图或点击救护车按钮派遣');
        console.log('5. 注意随机事件可能造成延误或故障');
        
    } catch (error) {
        console.error('游戏初始化失败:', error);
        
        const overlay = document.getElementById('overlay');
        const title = document.getElementById('overlay-title');
        const message = document.getElementById('overlay-message');
        
        if (overlay && title && message) {
            title.textContent = '游戏初始化失败';
            message.textContent = '请检查浏览器控制台获取详细错误信息';
            overlay.classList.remove('hidden');
        }
    }
    
    window.gameInstance = game;
});