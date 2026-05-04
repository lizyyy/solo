/**
 * 主入口文件
 */

(function() {
    // 游戏实例
    let gameInstance = null;
    
    // 初始化游戏
    function initGame() {
        // 获取画布
        const canvas = document.getElementById('game-canvas');
        if (!canvas) {
            console.error('找不到游戏画布');
            return;
        }
        
        // 创建游戏实例
        const Game = window.game.Game;
        gameInstance = new Game(canvas);
        
        // 绑定UI事件
        bindUIEvents();
        
        // 加载示例关卡
        loadSampleLevel();
        
        // 开始渲染（即使游戏未开始）
        requestAnimationFrame(renderLoop);
    }
    
    // 渲染循环（用于在游戏未开始时也能显示场景）
    function renderLoop() {
        if (gameInstance) {
            gameInstance.render();
        }
        requestAnimationFrame(renderLoop);
    }
    
    // 绑定UI事件
    function bindUIEvents() {
        // 导入关卡按钮
        const importLevelBtn = document.getElementById('import-level-btn');
        const levelFileInput = document.getElementById('level-file-input');
        
        importLevelBtn.addEventListener('click', () => {
            levelFileInput.click();
        });
        
        levelFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                loadLevelFromFile(file);
            }
            levelFileInput.value = '';
        });
        
        // 保存游戏按钮
        const saveGameBtn = document.getElementById('save-game-btn');
        saveGameBtn.addEventListener('click', saveGame);
        
        // 加载游戏按钮
        const loadGameBtn = document.getElementById('load-game-btn');
        const saveFileInput = document.getElementById('save-file-input');
        
        loadGameBtn.addEventListener('click', () => {
            saveFileInput.click();
        });
        
        saveFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                loadGameFromFile(file);
            }
            saveFileInput.value = '';
        });
        
        // 导出Markdown报告按钮
        const exportMarkdownBtn = document.getElementById('export-markdown-btn');
        exportMarkdownBtn.addEventListener('click', exportMarkdownReport);
        
        // 导出JSON回放包按钮
        const exportJsonBtn = document.getElementById('export-json-btn');
        exportJsonBtn.addEventListener('click', exportReplayJSON);
        
        // 回合控制按钮
        const startTurnBtn = document.getElementById('start-turn-btn');
        const endTurnBtn = document.getElementById('end-turn-btn');
        const resetTurnBtn = document.getElementById('reset-turn-btn');
        
        startTurnBtn.addEventListener('click', () => {
            if (gameInstance) {
                if (!gameInstance.isRunning) {
                    gameInstance.start();
                }
                gameInstance.startTurn();
            }
        });
        
        endTurnBtn.addEventListener('click', () => {
            if (gameInstance) {
                gameInstance.endTurn();
            }
        });
        
        resetTurnBtn.addEventListener('click', () => {
            if (gameInstance) {
                gameInstance.resetTurn();
            }
        });
        
        // 游戏事件监听
        if (gameInstance) {
            gameInstance.on('gameStarted', () => {
                console.log('游戏开始');
            });
            
            gameInstance.on('gameEnded', (gameState) => {
                console.log('游戏结束', gameState);
                showGameEndDialog(gameState);
            });
            
            gameInstance.on('studentRescued', (student) => {
                console.log(`学员 ${student.name} 被救援`);
            });
            
            gameInstance.on('turnStarted', (turnNumber) => {
                console.log(`回合 ${turnNumber} 开始`);
            });
            
            gameInstance.on('turnEnded', (turnNumber) => {
                console.log(`回合 ${turnNumber} 结束`);
            });
        }
    }
    
    // 加载示例关卡
    function loadSampleLevel() {
        if (gameInstance && gameInstance.levelManager) {
            try {
                gameInstance.levelManager.createSampleLevel();
                console.log('示例关卡加载成功');
                
                // 更新UI
                if (gameInstance.inputManager) {
                    gameInstance.inputManager.updateSelectedObjectInfo();
                }
            } catch (error) {
                console.error('加载示例关卡失败:', error);
            }
        }
    }
    
    // 从文件加载关卡
    function loadLevelFromFile(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const jsonData = JSON.parse(e.target.result);
                
                if (gameInstance && gameInstance.levelManager) {
                    // 重置游戏
                    gameInstance.reset();
                    
                    // 加载新关卡
                    gameInstance.levelManager.loadFromJSON(jsonData);
                    
                    console.log('关卡加载成功:', file.name);
                    alert('关卡加载成功！');
                }
            } catch (error) {
                console.error('解析关卡文件失败:', error);
                alert('关卡文件格式错误，请检查JSON格式');
            }
        };
        
        reader.onerror = () => {
            console.error('读取文件失败');
            alert('读取文件失败');
        };
        
        reader.readAsText(file);
    }
    
    // 保存游戏
    function saveGame() {
        if (!gameInstance) {
            alert('游戏未初始化');
            return;
        }
        
        try {
            const gameState = gameInstance.getGameState();
            const levelData = gameInstance.levelManager.getCurrentLevelData();
            
            const saveData = {
                version: '1.0.0',
                savedAt: new Date().toISOString(),
                gameState: gameState,
                levelData: levelData,
                replayData: gameInstance.replayData,
                reviewNotes: gameInstance.reviewNotes
            };
            
            // 下载文件
            downloadFile(
                JSON.stringify(saveData, null, 2),
                `kayak_rescue_save_${Date.now()}.json`,
                'application/json'
            );
            
            console.log('游戏保存成功');
        } catch (error) {
            console.error('保存游戏失败:', error);
            alert('保存游戏失败');
        }
    }
    
    // 从文件加载游戏
    function loadGameFromFile(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const saveData = JSON.parse(e.target.result);
                
                if (!gameInstance) {
                    alert('游戏未初始化');
                    return;
                }
                
                // 重置游戏
                gameInstance.reset();
                
                // 加载关卡
                if (saveData.levelData) {
                    gameInstance.levelManager.loadFromJSON(saveData.levelData);
                }
                
                // 恢复游戏状态
                if (saveData.gameState) {
                    // 这里可以更详细地恢复游戏状态
                    gameInstance.currentTurn = saveData.gameState.currentTurn || 1;
                    gameInstance.gameTime = saveData.gameState.gameTime || 0;
                    gameInstance.score = saveData.gameState.score || 0;
                    gameInstance.rescuedCount = saveData.gameState.rescuedCount || 0;
                    gameInstance.pendingCount = saveData.gameState.pendingCount || 0;
                }
                
                // 恢复回放数据
                if (saveData.replayData) {
                    gameInstance.replayData = saveData.replayData;
                }
                
                // 恢复复盘笔记
                if (saveData.reviewNotes) {
                    gameInstance.reviewNotes = saveData.reviewNotes;
                }
                
                console.log('游戏加载成功:', file.name);
                alert('游戏加载成功！');
            } catch (error) {
                console.error('解析存档文件失败:', error);
                alert('存档文件格式错误');
            }
        };
        
        reader.onerror = () => {
            console.error('读取文件失败');
            alert('读取文件失败');
        };
        
        reader.readAsText(file);
    }
    
    // 导出Markdown复盘报告
    function exportMarkdownReport() {
        if (!gameInstance) {
            alert('游戏未初始化');
            return;
        }
        
        try {
            const markdown = gameInstance.generateMarkdownReport();
            
            // 下载文件
            downloadFile(
                markdown,
                `kayak_rescue_report_${Date.now()}.md`,
                'text/markdown'
            );
            
            console.log('Markdown报告导出成功');
        } catch (error) {
            console.error('导出Markdown报告失败:', error);
            alert('导出报告失败');
        }
    }
    
    // 导出JSON回放包
    function exportReplayJSON() {
        if (!gameInstance) {
            alert('游戏未初始化');
            return;
        }
        
        try {
            const replayJSON = gameInstance.generateReplayJSON();
            
            // 下载文件
            downloadFile(
                replayJSON,
                `kayak_rescue_replay_${Date.now()}.json`,
                'application/json'
            );
            
            console.log('JSON回放包导出成功');
        } catch (error) {
            console.error('导出JSON回放包失败:', error);
            alert('导出回放包失败');
        }
    }
    
    // 下载文件工具函数
    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // 清理
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // 显示游戏结束对话框
    function showGameEndDialog(gameState) {
        // 简单的提示
        const result = confirm(
            `游戏结束！\n\n` +
            `得分: ${gameState.score}\n` +
            `救援成功: ${gameState.rescuedCount}\n` +
            `待救援: ${gameState.pendingCount}\n\n` +
            `是否导出复盘报告？`
        );
        
        if (result) {
            exportMarkdownReport();
        }
    }
    
    // 页面加载完成后初始化
    window.addEventListener('DOMContentLoaded', () => {
        console.log('皮划艇救援训练模拟器初始化...');
        initGame();
        console.log('初始化完成！');
    });
    
    // 页面关闭前保存数据
    window.addEventListener('beforeunload', (e) => {
        if (gameInstance && gameInstance.isRunning) {
            // 可以在这里自动保存
            console.log('游戏运行中，页面即将关闭...');
        }
    });
})();