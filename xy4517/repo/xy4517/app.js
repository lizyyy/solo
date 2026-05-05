// 铁路货场调车演练 - 主应用文件

// 存储管理类
class GameStorage {
    constructor() {
        this.STORAGE_KEY = 'railway_shunting_games';
        this.MAX_SAVES = 10;
    }

    // 保存游戏
    saveGame(gameData) {
        try {
            const saves = this.getGameList();
            
            // 限制存档数量
            if (saves.length >= this.MAX_SAVES) {
                saves.shift(); // 删除最旧的
            }
            
            const saveEntry = {
                id: gameData.levelId + '_' + Date.now(),
                levelId: gameData.levelId,
                levelName: gameData.levelName,
                timestamp: Date.now(),
                elapsedTime: gameData.elapsedTime,
                finalScore: gameData.finalScore,
                isWin: gameData.isWin,
                gameData: gameData
            };
            
            saves.push(saveEntry);
            
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(saves));
            return saveEntry.id;
        } catch (error) {
            console.error('保存游戏失败:', error);
            return null;
        }
    }

    // 加载游戏
    loadGame(gameId) {
        try {
            const saves = this.getGameList();
            const save = saves.find(s => s.id === gameId);
            
            if (!save) {
                return null;
            }
            
            return save.gameData;
        } catch (error) {
            console.error('加载游戏失败:', error);
            return null;
        }
    }

    // 获取存档列表
    getGameList() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            if (!data) {
                return [];
            }
            return JSON.parse(data);
        } catch (error) {
            console.error('获取存档列表失败:', error);
            return [];
        }
    }

    // 删除存档
    deleteGame(gameId) {
        try {
            let saves = this.getGameList();
            saves = saves.filter(s => s.id !== gameId);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(saves));
            return true;
        } catch (error) {
            console.error('删除存档失败:', error);
            return false;
        }
    }

    // 清空所有存档
    clearAllGames() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            return true;
        } catch (error) {
            console.error('清空存档失败:', error);
            return false;
        }
    }
}

// 主应用类
class App {
    constructor() {
        this.game = null;
        this.storage = new GameStorage();
        this.isInitialized = false;
    }

    // 初始化应用
    init() {
        if (this.isInitialized) return;
        
        // 创建游戏实例
        this.game = new Game('game-canvas');
        
        // 初始化关卡选择器
        this.initLevelSelector();
        
        // 绑定事件
        this.bindEvents();
        
        // 默认加载第一个关卡
        const levelList = getLevelList();
        if (levelList.length > 0) {
            this.game.loadLevel(levelList[0].id);
            document.getElementById('current-level').textContent = levelList[0].name;
        }
        
        this.isInitialized = true;
        console.log('铁路货场调车演练系统已初始化');
    }

    // 初始化关卡选择器
    initLevelSelector() {
        const selectEl = document.getElementById('level-select');
        if (!selectEl) return;
        
        const levelList = getLevelList();
        
        selectEl.innerHTML = '';
        levelList.forEach(level => {
            const option = document.createElement('option');
            option.value = level.id;
            option.textContent = `${level.name} (难度: ${'★'.repeat(level.difficulty)})`;
            option.title = level.description;
            selectEl.appendChild(option);
        });
    }

    // 绑定事件
    bindEvents() {
        // 新游戏按钮
        const btnNewGame = document.getElementById('btn-new-game');
        if (btnNewGame) {
            btnNewGame.addEventListener('click', () => this.startNewGame());
        }

        // 读取存档按钮
        const btnLoadGame = document.getElementById('btn-load-game');
        if (btnLoadGame) {
            btnLoadGame.addEventListener('click', () => this.showLoadDialog());
        }

        // 导出Markdown按钮
        const btnExportMd = document.getElementById('btn-export-md');
        if (btnExportMd) {
            btnExportMd.addEventListener('click', () => this.exportMarkdown());
        }

        // 导出JSON按钮
        const btnExportJson = document.getElementById('btn-export-json');
        if (btnExportJson) {
            btnExportJson.addEventListener('click', () => this.exportJSON());
        }

        // 关卡选择变化
        const levelSelect = document.getElementById('level-select');
        if (levelSelect) {
            levelSelect.addEventListener('change', (e) => {
                const levelId = e.target.value;
                this.game.loadLevel(levelId);
                
                const levelList = getLevelList();
                const level = levelList.find(l => l.id === levelId);
                if (level) {
                    document.getElementById('current-level').textContent = level.name;
                }
            });
        }

        // 控制按钮
        const btnPush = document.getElementById('btn-push');
        const btnPull = document.getElementById('btn-pull');
        const btnCouple = document.getElementById('btn-couple');
        const btnUncouple = document.getElementById('btn-uncouple');

        if (btnPush) {
            btnPush.addEventListener('click', () => {
                const selectedLoco = this.game.engine.getSelectedLocomotive();
                if (selectedLoco) {
                    this.game.engine.moveLocomotive(selectedLoco.id, 'forward', 50);
                    this.game.updateUI();
                    this.game.render();
                }
            });
        }

        if (btnPull) {
            btnPull.addEventListener('click', () => {
                const selectedLoco = this.game.engine.getSelectedLocomotive();
                if (selectedLoco) {
                    this.game.engine.moveLocomotive(selectedLoco.id, 'backward', 50);
                    this.game.updateUI();
                    this.game.render();
                }
            });
        }

        if (btnCouple) {
            btnCouple.addEventListener('click', () => {
                const selectedLoco = this.game.engine.getSelectedLocomotive();
                if (selectedLoco && !selectedLoco.coupledCarId) {
                    const nearbyCar = this.game.findNearbyCar(selectedLoco);
                    if (nearbyCar) {
                        const result = this.game.engine.coupleCar(selectedLoco.id, nearbyCar.id);
                        if (!result.success) {
                            this.showMessage(result.error, 'warning');
                        }
                        this.game.updateControlPanel();
                        this.game.updateCarsPanel();
                    } else {
                        this.showMessage('附近没有可连挂的车皮', 'warning');
                    }
                }
            });
        }

        if (btnUncouple) {
            btnUncouple.addEventListener('click', () => {
                const selectedLoco = this.game.engine.getSelectedLocomotive();
                if (selectedLoco && selectedLoco.coupledCarId) {
                    const result = this.game.engine.uncoupleCar(selectedLoco.id);
                    if (!result.success) {
                        this.showMessage(result.error, 'error');
                    }
                    this.game.updateControlPanel();
                    this.game.updateCarsPanel();
                    this.game.updateDestinationsPanel();
                }
            });
        }

        // 结束界面关闭按钮
        const overlayClose = document.getElementById('overlay-close');
        if (overlayClose) {
            overlayClose.addEventListener('click', () => {
                const overlay = document.getElementById('game-overlay');
                if (overlay) {
                    overlay.style.display = 'none';
                }
            });
        }
    }

    // 开始新游戏
    startNewGame() {
        const levelSelect = document.getElementById('level-select');
        const levelId = levelSelect ? levelSelect.value : 'level-1';
        
        this.game.loadLevel(levelId);
        this.game.start();
        
        const levelList = getLevelList();
        const level = levelList.find(l => l.id === levelId);
        if (level) {
            document.getElementById('current-level').textContent = level.name;
        }
        
        this.showMessage('游戏开始！', 'success');
    }

    // 显示读取存档对话框
    showLoadDialog() {
        const saves = this.storage.getGameList();
        
        if (saves.length === 0) {
            this.showMessage('没有找到任何存档', 'info');
            return;
        }

        // 构建存档列表
        let message = '选择要加载的存档：\n\n';
        saves.forEach((save, index) => {
            const date = new Date(save.timestamp);
            const timeStr = this.formatTime(save.elapsedTime);
            message += `${index + 1}. ${save.levelName}\n`;
            message += `   时间: ${timeStr} | 得分: ${save.finalScore}\n`;
            message += `   结果: ${save.isWin ? '✓ 胜利' : '✗ 失败'}\n`;
            message += `   日期: ${date.toLocaleString('zh-CN')}\n\n`;
        });

        // 简单的prompt选择（实际项目中应该使用模态框）
        const choice = prompt(message + '请输入序号（1-' + saves.length + '）：');
        if (choice) {
            const index = parseInt(choice) - 1;
            if (index >= 0 && index < saves.length) {
                const success = this.game.loadGame(saves[index].id);
                if (success) {
                    this.showMessage('存档加载成功', 'success');
                    // 显示复盘按钮
                    const btnReplay = document.getElementById('btn-replay');
                    if (btnReplay) {
                        btnReplay.style.display = 'inline-block';
                        btnReplay.onclick = () => this.startReplay(saves[index].id);
                    }
                } else {
                    this.showMessage('存档加载失败', 'error');
                }
            } else {
                this.showMessage('无效的选择', 'warning');
            }
        }
    }

    // 开始复盘模式
    startReplay(gameId) {
        this.showMessage('复盘功能开发中...', 'info');
    }

    // 导出Markdown
    exportMarkdown() {
        if (!this.game.engine) {
            this.showMessage('没有可导出的游戏数据', 'warning');
            return;
        }

        const markdown = this.game.exportMarkdown();
        if (!markdown) {
            this.showMessage('导出失败', 'error');
            return;
        }

        // 创建下载
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `调车复盘_${new Date().toISOString().slice(0, 10)}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showMessage('Markdown复盘报告已导出', 'success');
    }

    // 导出JSON
    exportJSON() {
        if (!this.game.engine) {
            this.showMessage('没有可导出的游戏数据', 'warning');
            return;
        }

        const jsonData = this.game.exportJSON();
        if (!jsonData) {
            this.showMessage('导出失败', 'error');
            return;
        }

        const jsonString = JSON.stringify(jsonData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `调车数据_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showMessage('JSON数据已导出', 'success');
    }

    // 显示消息
    showMessage(message, type = 'info') {
        // 控制台输出
        const styles = {
            success: 'color: #4caf50; font-weight: bold;',
            error: 'color: #e94560; font-weight: bold;',
            warning: 'color: #ff9800; font-weight: bold;',
            info: 'color: #00a8cc; font-weight: bold;'
        };
        console.log(`%c[${type.toUpperCase()}] ${message}`, styles[type] || styles.info);

        // 简单的页面提示
        this.createToast(message, type);
    }

    // 创建Toast提示
    createToast(message, type = 'info') {
        // 检查是否已存在toast容器
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(container);
        }

        // 创建toast
        const toast = document.createElement('div');
        const colors = {
            success: '#4caf50',
            error: '#e94560',
            warning: '#ff9800',
            info: '#00a8cc'
        };
        const bgColor = colors[type] || colors.info;

        toast.style.cssText = `
            background: ${bgColor};
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            font-size: 14px;
            font-weight: bold;
            animation: slideIn 0.3s ease-out;
            max-width: 300px;
            word-wrap: break-word;
        `;
        toast.textContent = message;

        // 添加动画样式
        if (!document.getElementById('toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        container.appendChild(toast);

        // 自动移除
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // 格式化时间
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.init();
});
