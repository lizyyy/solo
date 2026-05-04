document.addEventListener('DOMContentLoaded', async () => {
    UI.init();
    
    try {
        const levels = await Game.loadLevels();
        UI.renderLevels(levels);
        
        if (levels.length > 0) {
            Game.selectLevel(levels[0].id);
            document.querySelector('.level-card')?.classList.add('selected');
        }
    } catch (error) {
        UI.showToast('无法加载关卡列表: ' + error.message, 'error');
    }
});
