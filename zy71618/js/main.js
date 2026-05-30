let game = null;
let ui = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('🏰 保险精算怪物塔 - 系统初始化中...');
    
    try {
        game = new InsuranceTowerDefense();
        ui = new GameUI(game);
        ui.init();
        
        console.log('✅ 游戏系统初始化完成');
        console.log('📋 已加载保单:', game.policies.length, '张');
        console.log('📋 已加载赔案样本:', game.availableClaims.length, '件');
        
        const dataIssues = game.policies.filter(p => 
            p.normalizationErrors.length > 0 || p.normalizationWarnings.length > 0
        );
        if (dataIssues.length > 0) {
            console.log('⚠️ 数据导入时发现', dataIssues.length, '张保单存在字段不规范问题，已自动处理');
            for (const policy of dataIssues) {
                if (policy.normalizationErrors.length > 0) {
                    console.log(`  - ${policy.name}:`, policy.normalizationErrors);
                }
                if (policy.normalizationWarnings.length > 0) {
                    console.log(`  - ${policy.name}:`, policy.normalizationWarnings);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ 游戏初始化失败:', error);
        alert('游戏初始化失败，请检查控制台获取详细信息');
    }
});

window.addEventListener('beforeunload', () => {
    if (ui) {
        ui.destroy();
    }
});
