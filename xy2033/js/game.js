
// 吐槽人大战僵尸小游戏

const Game = {
    isRunning: false,
    isPaused: false,
    score: 0,
    lives: 3,
    level: 1,
    sunCount: 200,
    selectedPeashooterType: 'green',
    gameLoopInterval: null,
    zombieSpawnInterval: null,
    sunSpawnInterval: null,
    
    grid: [],
    peashooters: [],
    zombies: [],
    peas: [],
    suns: [],
    
    GRID_ROWS: 5,
    GRID_COLS: 10,
    
    peashooterTypes: {
        green: {
            emoji: '🌱',
            damage: 20,
            cost: 100,
            shootInterval: 1500,
            color: 'green'
        },
        red: {
            emoji: '🌶️',
            damage: 40,
            cost: 175,
            shootInterval: 1200,
            color: 'red'
        },
        blue: {
            emoji: '🧊',
            damage: 30,
            cost: 200,
            shootInterval: 1000,
            color: 'blue',
            slowEffect: true
        }
    },
    
    zombieTypes: {
        normal: {
            emoji: '🧟',
            health: 100,
            speed: 0.5,
            damage: 10
        },
        fast: {
            emoji: '🏃',
            health: 60,
            speed: 1,
            damage: 8
        },
        strong: {
            emoji: '💪',
            health: 200,
            speed: 0.3,
            damage: 20
        },
        boss: {
            emoji: '👹',
            health: 500,
            speed: 0.2,
            damage: 30
        }
    },

    // 初始化游戏
    init: function() {
        this.bindEvents();
        this.reset();
    },

    // 绑定游戏事件
    bindEvents: function() {
        // 开始游戏
        document.getElementById('start-game-btn').addEventListener('click', () => {
            this.start();
        });

        // 暂停游戏
        document.getElementById('pause-game-btn').addEventListener('click', () => {
            this.togglePause();
        });

        // 重新开始
        document.getElementById('restart-game-btn').addEventListener('click', () => {
            this.restart();
        });

        // 选择射手类型
        document.querySelectorAll('.peashooter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectPeashooterType(btn.dataset.type);
            });
        });
    },

    // 选择射手类型
    selectPeashooterType: function(type) {
        this.selectedPeashooterType = type;
        
        document.querySelectorAll('.peashooter-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.type === type);
        });
    },

    // 重置游戏状态
    reset: function() {
        this.isRunning = false;
        this.isPaused = false;
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.sunCount = 200;
        this.peashooters = [];
        this.zombies = [];
        this.peas = [];
        this.suns = [];
        
        // 初始化网格
        this.grid = [];
        for (let row = 0; row < this.GRID_ROWS; row++) {
            this.grid[row] = [];
            for (let col = 0; col < this.GRID_COLS; col++) {
                this.grid[row][col] = null;
            }
        }
        
        this.updateUI();
        this.renderGameArea();
    },

    // 开始游戏
    start: function() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.isPaused = false;
        
        document.getElementById('start-game-btn').disabled = true;
        document.getElementById('pause-game-btn').disabled = false;
        
        // 渲染游戏区域
        this.renderGameArea();
        
        // 绑定点击事件
        this.bindGridClickEvents();
        
        // 开始游戏循环
        this.gameLoopInterval = setInterval(() => {
            if (!this.isPaused) {
                this.gameLoop();
            }
        }, 50);
        
        // 定时生成僵尸
        this.zombieSpawnInterval = setInterval(() => {
            if (!this.isPaused && this.isRunning) {
                this.spawnZombie();
            }
        }, 3000);
        
        // 定时生成阳光
        this.sunSpawnInterval = setInterval(() => {
            if (!this.isPaused && this.isRunning) {
                this.spawnSun();
            }
        }, 5000);
        
        // 初始生成一个僵尸
        setTimeout(() => this.spawnZombie(), 1000);
        
        App.showToast('游戏开始！放置射手来抵御僵尸！');
    },

    // 切换暂停
    togglePause: function() {
        this.isPaused = !this.isPaused;
        document.getElementById('pause-game-btn').textContent = this.isPaused ? '继续' : '暂停';
        
        App.showToast(this.isPaused ? '游戏已暂停' : '游戏继续');
    },

    // 重新开始
    restart: function() {
        this.stop();
        this.reset();
        App.showToast('游戏已重置，点击开始按钮开始游戏！');
    },

    // 停止游戏
    stop: function() {
        this.isRunning = false;
        
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
        }
        
        if (this.zombieSpawnInterval) {
            clearInterval(this.zombieSpawnInterval);
            this.zombieSpawnInterval = null;
        }
        
        if (this.sunSpawnInterval) {
            clearInterval(this.sunSpawnInterval);
            this.sunSpawnInterval = null;
        }
        
        document.getElementById('start-game-btn').disabled = false;
        document.getElementById('pause-game-btn').disabled = true;
        document.getElementById('pause-game-btn').textContent = '暂停';
    },

    // 渲染游戏区域
    renderGameArea: function() {
        const gameArea = document.getElementById('game-area');
        
        let html = '<div class="game-grid">';
        
        for (let row = 0; row < this.GRID_ROWS; row++) {
            for (let col = 0; col < this.GRID_COLS; col++) {
                const isRoad = (row === 1 || row === 3);
                const hasPeashooter = this.grid[row][col] !== null;
                
                html += `
                    <div class="game-cell ${isRoad ? 'road' : ''}" 
                         data-row="${row}" 
                         data-col="${col}">
                        ${hasPeashooter ? `<span class="peashooter">${this.grid[row][col].emoji}</span>` : ''}
                    </div>
                `;
            }
        }
        
        html += '</div>';
        gameArea.innerHTML = html;
    },

    // 绑定网格点击事件
    bindGridClickEvents: function() {
        const cells = document.querySelectorAll('.game-cell');
        
        cells.forEach(cell => {
            cell.addEventListener('click', (e) => {
                if (!this.isRunning || this.isPaused) return;
                
                const row = parseInt(cell.dataset.row);
                const col = parseInt(cell.dataset.col);
                
                this.placePeashooter(row, col);
            });
        });
    },

    // 放置射手
    placePeashooter: function(row, col) {
        // 检查该位置是否已有射手
        if (this.grid[row][col] !== null) {
            App.showToast('该位置已有射手！');
            return;
        }
        
        // 不能放在最右边两列（僵尸出现的地方）
        if (col >= this.GRID_COLS - 2) {
            App.showToast('不能放在这里！');
            return;
        }
        
        const peashooterType = this.peashooterTypes[this.selectedPeashooterType];
        
        // 检查阳光是否足够
        if (this.sunCount < peashooterType.cost) {
            App.showToast(`阳光不足！需要 ${peashooterType.cost} 阳光`);
            return;
        }
        
        // 扣除阳光
        this.sunCount -= peashooterType.cost;
        this.updateUI();
        
        // 创建射手
        const peashooter = {
            id: `peashooter_${Date.now()}`,
            row: row,
            col: col,
            type: this.selectedPeashooterType,
            emoji: peashooterType.emoji,
            damage: peashooterType.damage,
            shootInterval: peashooterType.shootInterval,
            lastShootTime: 0,
            color: peashooterType.color,
            slowEffect: peashooterType.slowEffect || false
        };
        
        this.grid[row][col] = peashooter;
        this.peashooters.push(peashooter);
        
        // 重新渲染
        this.renderGameArea();
        this.bindGridClickEvents();
    },

    // 生成僵尸
    spawnZombie: function() {
        const row = Math.floor(Math.random() * this.GRID_ROWS);
        
        // 根据关卡选择僵尸类型
        let zombieTypeKey;
        const rand = Math.random();
        
        if (this.level >= 3 && rand < 0.1) {
            zombieTypeKey = 'boss';
        } else if (this.level >= 2 && rand < 0.3) {
            zombieTypeKey = 'strong';
        } else if (rand < 0.5) {
            zombieTypeKey = 'fast';
        } else {
            zombieTypeKey = 'normal';
        }
        
        const zombieType = this.zombieTypes[zombieTypeKey];
        
        const zombie = {
            id: `zombie_${Date.now()}_${Math.random()}`,
            row: row,
            x: this.GRID_COLS,  // 从最右边开始
            type: zombieTypeKey,
            emoji: zombieType.emoji,
            health: zombieType.health,
            maxHealth: zombieType.health,
            speed: zombieType.speed,
            baseSpeed: zombieType.speed,
            damage: zombieType.damage,
            slowed: false,
            slowTimer: 0
        };
        
        this.zombies.push(zombie);
    },

    // 生成阳光
    spawnSun: function() {
        const sun = {
            id: `sun_${Date.now()}`,
            x: Math.random() * (this.GRID_COLS - 2) + 1,
            y: -1,
            targetY: Math.random() * this.GRID_ROWS,
            collected: false
        };
        
        this.suns.push(sun);
    },

    // 游戏主循环
    gameLoop: function() {
        const currentTime = Date.now();
        
        // 射手发射豌豆
        this.peashooters.forEach(peashooter => {
            if (currentTime - peashooter.lastShootTime >= peashooter.shootInterval) {
                // 检查该行是否有僵尸
                const hasZombieInRow = this.zombies.some(z => z.row === peashooter.row && z.x > peashooter.col);
                
                if (hasZombieInRow) {
                    this.shootPea(peashooter);
                    peashooter.lastShootTime = currentTime;
                }
            }
        });
        
        // 移动豌豆
        this.peas.forEach(pea => {
            pea.x += 0.15;
        });
        
        // 移除超出屏幕的豌豆
        this.peas = this.peas.filter(pea => pea.x < this.GRID_COLS + 1);
        
        // 移动僵尸
        this.zombies.forEach(zombie => {
            // 减速效果处理
            if (zombie.slowed) {
                zombie.slowTimer--;
                if (zombie.slowTimer <= 0) {
                    zombie.slowed = false;
                    zombie.speed = zombie.baseSpeed;
                }
            }
            
            // 检查是否被射手阻挡
            const blockingPeashooter = this.peashooters.find(p => 
                p.row === zombie.row && 
                Math.abs(p.col - zombie.x) < 0.5
            );
            
            if (blockingPeashooter) {
                // 攻击射手
                this.attackPeashooter(zombie, blockingPeashooter);
            } else {
                // 移动
                zombie.x -= zombie.speed * 0.02;
            }
        });
        
        // 检查豌豆和僵尸的碰撞
        this.peas.forEach(pea => {
            this.zombies.forEach(zombie => {
                if (zombie.row === pea.row && 
                    Math.abs(zombie.x - pea.x) < 0.5) {
                    
                    // 造成伤害
                    zombie.health -= pea.damage;
                    pea.hit = true;
                    
                    // 蓝豌豆有减速效果
                    if (pea.slowEffect) {
                        zombie.slowed = true;
                        zombie.slowTimer = 60;  // 约3秒
                        zombie.speed = zombie.baseSpeed * 0.5;
                    }
                    
                    // 检查僵尸是否死亡
                    if (zombie.health <= 0) {
                        zombie.dead = true;
                        this.score += 10;
                        this.sunCount += 25;
                    }
                }
            });
        });
        
        // 移除被击中的豌豆和死亡的僵尸
        this.peas = this.peas.filter(pea => !pea.hit);
        this.zombies = this.zombies.filter(zombie => {
            if (zombie.dead) {
                return false;
            }
            // 检查是否到达最左边（吃掉大脑）
            if (zombie.x <= 0) {
                this.lives--;
                this.updateUI();
                
                if (this.lives <= 0) {
                    this.gameOver();
                }
                return false;
            }
            return true;
        });
        
        // 阳光下落
        this.suns.forEach(sun => {
            if (sun.y < sun.targetY) {
                sun.y += 0.05;
            }
        });
        
        // 检查升级
        if (this.score >= this.level * 100) {
            this.level++;
            App.showToast(`升级！当前关卡：${this.level}`);
        }
        
        this.updateUI();
        this.renderGameObjects();
    },

    // 射手发射豌豆
    shootPea: function(peashooter) {
        const peaEmojis = {
            green: '🟢',
            red: '🔴',
            blue: '🔵'
        };
        
        const pea = {
            id: `pea_${Date.now()}_${Math.random()}`,
            row: peashooter.row,
            x: peashooter.col + 1,
            damage: peashooter.damage,
            color: peashooter.color,
            emoji: peaEmojis[peashooter.color],
            slowEffect: peashooter.slowEffect
        };
        
        this.peas.push(pea);
    },

    // 僵尸攻击射手
    attackPeashooter: function(zombie, peashooter) {
        // 简单处理：移除射手
        this.grid[peashooter.row][peashooter.col] = null;
        this.peashooters = this.peashooters.filter(p => p.id !== peashooter.id);
    },

    // 渲染游戏对象（射手、僵尸、豌豆）
    renderGameObjects: function() {
        const cells = document.querySelectorAll('.game-cell');
        
        // 清除所有动态对象
        cells.forEach(cell => {
            // 保留射手
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            
            // 移除所有动态元素
            const dynamicElements = cell.querySelectorAll('.zombie, .pea, .sun');
            dynamicElements.forEach(el => el.remove());
        });
        
        // 渲染僵尸
        this.zombies.forEach(zombie => {
            const colIndex = Math.floor(zombie.x);
            if (colIndex >= 0 && colIndex < this.GRID_COLS) {
                const cellIndex = zombie.row * this.GRID_COLS + colIndex;
                const cell = cells[cellIndex];
                
                if (cell) {
                    const zombieEl = document.createElement('span');
                    zombieEl.className = 'zombie';
                    zombieEl.textContent = zombie.emoji;
                    zombieEl.style.right = `${(zombie.x - colIndex) * 100}%`;
                    
                    // 添加血条
                    const healthPercent = zombie.health / zombie.maxHealth * 100;
                    const healthBar = document.createElement('div');
                    healthBar.style.cssText = `
                        position: absolute;
                        top: 2px;
                        left: 5%;
                        width: 90%;
                        height: 4px;
                        background-color: #333;
                        border-radius: 2px;
                        z-index: 20;
                    `;
                    const healthFill = document.createElement('div');
                    healthFill.style.cssText = `
                        width: ${healthPercent}%;
                        height: 100%;
                        background-color: ${zombie.slowed ? '#00bfff' : '#ff4444'};
                        border-radius: 2px;
                        transition: width 0.2s;
                    `;
                    healthBar.appendChild(healthFill);
                    zombieEl.appendChild(healthBar);
                    
                    cell.appendChild(zombieEl);
                }
            }
        });
        
        // 渲染豌豆
        this.peas.forEach(pea => {
            const colIndex = Math.floor(pea.x);
            if (colIndex >= 0 && colIndex < this.GRID_COLS) {
                const cellIndex = pea.row * this.GRID_COLS + colIndex;
                const cell = cells[cellIndex];
                
                if (cell) {
                    const peaEl = document.createElement('span');
                    peaEl.className = 'pea';
                    peaEl.textContent = pea.emoji;
                    peaEl.style.left = `${(pea.x - colIndex) * 100}%`;
                    peaEl.style.top = '50%';
                    peaEl.style.transform = 'translateY(-50%)';
                    
                    cell.appendChild(peaEl);
                }
            }
        });
        
        // 渲染阳光（点击收集）
        this.suns.forEach(sun => {
            if (sun.collected) return;
            
            const colIndex = Math.floor(sun.x);
            const rowIndex = Math.floor(sun.y);
            
            if (rowIndex >= 0 && rowIndex < this.GRID_ROWS && 
                colIndex >= 0 && colIndex < this.GRID_COLS) {
                const cellIndex = rowIndex * this.GRID_COLS + colIndex;
                const cell = cells[cellIndex];
                
                if (cell) {
                    const sunEl = document.createElement('span');
                    sunEl.className = 'sun';
                    sunEl.textContent = '☀️';
                    sunEl.style.fontSize = '24px';
                    sunEl.style.cursor = 'pointer';
                    sunEl.style.position = 'absolute';
                    sunEl.style.zIndex = '30';
                    sunEl.style.left = `${(sun.x - colIndex) * 100}%`;
                    sunEl.style.top = `${(sun.y - rowIndex) * 100}%`;
                    
                    sunEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        sun.collected = true;
                        this.sunCount += 25;
                        this.updateUI();
                        sunEl.remove();
                        App.showToast('+25 阳光！');
                    });
                    
                    cell.appendChild(sunEl);
                }
            }
        });
        
        // 重新绑定点击事件（用于收集阳光）
        this.bindGridClickEvents();
    },

    // 更新UI
    updateUI: function() {
        document.getElementById('game-score').textContent = this.score;
        document.getElementById('game-lives').textContent = this.lives;
        document.getElementById('game-level').textContent = this.level;
        document.getElementById('sun-count').textContent = this.sunCount;
    },

    // 游戏结束
    gameOver: function() {
        this.stop();
        App.showToast(`游戏结束！最终得分：${this.score}`);
        
        // 奖励积分（每10分得1积分）
        const bonusScore = Math.floor(this.score / 10);
        if (bonusScore > 0) {
            Storage.addScore(bonusScore);
            App.renderUserInfo();
            App.showToast(`获得 ${bonusScore} 积分奖励！`);
        }
    }
};

// 页面加载后初始化游戏
document.addEventListener('DOMContentLoaded', function() {
    Game.init();
});
