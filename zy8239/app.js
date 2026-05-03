/**
 * 温室授粉机器人调度员 - 核心游戏逻辑
 */

// 游戏主类
class GreenhouseSchedulerGame {
    constructor() {
        this.currentLevel = null;
        this.robots = [];
        this.zones = [];
        this.actions = [];
        this.conflicts = [];
        this.gameState = 'planning'; // planning, running, completed
        this.currentTime = 0; // 分钟数，从0开始
        this.bestScores = this.loadBestScores();
        this.isRunning = false;
        
        this.init();
    }
    
    // 初始化游戏
    init() {
        this.setupEventListeners();
        this.loadAvailableLevels();
    }
    
    // 设置事件监听器
    setupEventListeners() {
        // 关卡选择和控制
        document.getElementById('load-level-btn').addEventListener('click', () => this.loadSelectedLevel());
        document.getElementById('reset-btn').addEventListener('click', () => this.resetLevel());
        document.getElementById('run-btn').addEventListener('click', () => this.runSimulation());
        document.getElementById('export-replay-btn').addEventListener('click', () => this.exportReplay());
        
        // 动作添加
        document.getElementById('add-action-btn').addEventListener('click', () => this.addAction());
        
        // 模态框
        document.querySelector('.close-modal').addEventListener('click', () => this.closeModal());
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('modal');
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }
    
    // 加载可用的关卡列表
    async loadAvailableLevels() {
        try {
            const response = await fetch('levels/levels.json');
            const levelList = await response.json();
            
            const select = document.getElementById('level-select');
            select.innerHTML = '<option value="">选择关卡</option>';
            
            levelList.forEach(level => {
                const option = document.createElement('option');
                option.value = level.file;
                option.textContent = `${level.name} - ${level.description}`;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('加载关卡列表失败:', error);
            this.showError('无法加载关卡列表，请确保 levels/levels.json 文件存在');
        }
    }
    
    // 加载选中的关卡
    async loadSelectedLevel() {
        const levelFile = document.getElementById('level-select').value;
        if (!levelFile) {
            this.showError('请先选择一个关卡');
            return;
        }
        
        try {
            const response = await fetch(`levels/${levelFile}`);
            const levelData = await response.json();
            
            const validationErrors = this.validateLevelData(levelData);
            if (validationErrors.length > 0) {
                this.showLevelValidationErrors(validationErrors);
                return;
            }
            
            this.currentLevel = levelData;
            this.initializeLevel();
            
        } catch (error) {
            console.error('加载关卡失败:', error);
            this.showError('加载关卡失败，请检查文件格式是否正确');
        }
    }
    
    // 验证关卡数据
    validateLevelData(levelData) {
        const errors = [];
        
        if (!levelData.name) {
            errors.push('关卡缺少名称');
        }
        
        if (!levelData.grid || !Array.isArray(levelData.grid)) {
            errors.push('关卡缺少网格数据或格式不正确');
        }
        
        if (!levelData.robots || !Array.isArray(levelData.robots)) {
            errors.push('关卡缺少机器人数据或格式不正确');
        } else {
            const robotIds = new Set();
            levelData.robots.forEach(robot => {
                if (!robot.id) {
                    errors.push('机器人缺少 ID');
                } else if (robotIds.has(robot.id)) {
                    errors.push(`重复的机器人编号: ${robot.id}`);
                } else {
                    robotIds.add(robot.id);
                }
            });
        }
        
        if (!levelData.objectives || !Array.isArray(levelData.objectives)) {
            errors.push('关卡缺少目标数据或格式不正确');
        } else {
            levelData.objectives.forEach((obj, index) => {
                if (obj.floweringWindow) {
                    const start = this.parseTimeToMinutes(obj.floweringWindow.start);
                    const end = this.parseTimeToMinutes(obj.floweringWindow.end);
                    
                    if (start > end) {
                        errors.push(`目标 ${index + 1} 存在跨午夜花期: 开始时间 ${obj.floweringWindow.start} 晚于结束时间 ${obj.floweringWindow.end}`);
                    }
                    
                    if (end > 1440) {
                        errors.push(`目标 ${index + 1} 花期结束时间超过 24:00: ${obj.floweringWindow.end}`);
                    }
                }
            });
        }
        
        if (levelData.timeLimit && levelData.timeLimit > 1440) {
            errors.push('时间限制不能超过 24 小时');
        }
        
        return errors;
    }
    
    // 显示关卡验证错误
    showLevelValidationErrors(errors) {
        let errorHtml = '<div class="error-message">';
        errorHtml += '<h3>关卡数据错误</h3>';
        errorHtml += '<ul>';
        errors.forEach(err => {
            errorHtml += `<li>${err}</li>`;
        });
        errorHtml += '</ul></div>';
        
        this.showModal('关卡加载失败', errorHtml);
    }
    
    // 初始化关卡
    initializeLevel() {
        this.robots = JSON.parse(JSON.stringify(this.currentLevel.robots));
        this.zones = this.extractZonesFromGrid();
        this.actions = [];
        this.conflicts = [];
        this.gameState = 'planning';
        this.currentTime = 0;
        
        this.updateUI();
        this.updateBestScoreDisplay();
    }
    
    // 从网格中提取区域
    extractZonesFromGrid() {
        const zones = [];
        const zoneMap = new Map();
        
        const grid = this.currentLevel.grid;
        for (let row = 0; row < grid.length; row++) {
            for (let col = 0; col < grid[row].length; col++) {
                const cell = grid[row][col];
                if (cell.zoneId) {
                    if (!zoneMap.has(cell.zoneId)) {
                        zoneMap.set(cell.zoneId, {
                            id: cell.zoneId,
                            name: cell.zoneName || `区域 ${cell.zoneId}`,
                            type: cell.type,
                            cells: [],
                            humidity: cell.humidity || 0,
                            requiresDisinfection: cell.requiresDisinfection || false
                        });
                    }
                    zoneMap.get(cell.zoneId).cells.push({ row, col });
                }
            }
        }
        
        zoneMap.forEach(zone => zones.push(zone));
        return zones;
    }
    
    // 更新UI
    updateUI() {
        this.renderGreenhouseGrid();
        this.renderTimeline();
        this.renderRobotsStatus();
        this.renderLevelInfo();
        this.updateActionSelectors();
        this.hideConflicts();
        this.hideResults();
    }
    
    // 渲染温室网格
    renderGreenhouseGrid() {
        const gridContainer = document.getElementById('greenhouse-grid');
        const grid = this.currentLevel.grid;
        
        const rows = grid.length;
        const cols = grid[0] ? grid[0].length : 0;
        
        gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        gridContainer.innerHTML = '';
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const cell = grid[row][col];
                const cellDiv = document.createElement('div');
                cellDiv.className = `grid-cell ${cell.type}`;
                cellDiv.dataset.row = row;
                cellDiv.dataset.col = col;
                
                if (cell.type === 'pollination') {
                    cellDiv.style.backgroundColor = '#27ae60';
                } else if (cell.type === 'charging') {
                    cellDiv.style.backgroundColor = '#f1c40f';
                } else if (cell.type === 'disinfection') {
                    cellDiv.style.backgroundColor = '#3498db';
                } else if (cell.type === 'humidity') {
                    cellDiv.style.backgroundColor = '#9b59b6';
                } else if (cell.type === 'path') {
                    cellDiv.style.backgroundColor = '#ecf0f1';
                } else {
                    cellDiv.style.backgroundColor = '#95a5a6';
                }
                
                const robot = this.robots.find(r => {
                    const robotPos = this.getRobotPositionAtTime(r.id, this.currentTime);
                    return robotPos.row === row && robotPos.col === col;
                });
                
                if (robot) {
                    cellDiv.innerHTML = `<span class="robot">${robot.id}</span>`;
                } else if (cell.zoneName) {
                    cellDiv.innerHTML = `<span>${cell.zoneName}</span>`;
                }
                
                gridContainer.appendChild(cellDiv);
            }
        }
    }
    
    // 获取机器人在特定时间的位置
    getRobotPositionAtTime(robotId, time) {
        const robot = this.robots.find(r => r.id === robotId);
        if (!robot) return { row: -1, col: -1 };
        
        const robotActions = this.actions
            .filter(a => a.robotId === robotId)
            .sort((a, b) => a.startTime - b.startTime);
        
        const latestActionBeforeTime = robotActions
            .filter(a => a.startTime <= time)
            .pop();
        
        if (latestActionBeforeTime) {
            const zone = this.zones.find(z => z.id === latestActionBeforeTime.zoneId);
            if (zone && zone.cells.length > 0) {
                return zone.cells[0];
            }
        }
        
        return robot.startPosition;
    }
    
    // 渲染时间轴
    renderTimeline() {
        const timeLimit = this.currentLevel.timeLimit || 1440;
        const hours = Math.ceil(timeLimit / 60);
        
        const scaleContainer = document.getElementById('timeline-scale');
        scaleContainer.innerHTML = '';
        
        for (let i = 0; i < hours; i++) {
            const hourDiv = document.createElement('div');
            hourDiv.className = 'timeline-scale-hour';
            hourDiv.textContent = `${String(i).padStart(2, '0')}:00`;
            scaleContainer.appendChild(hourDiv);
        }
        
        const bodyContainer = document.getElementById('timeline-body');
        bodyContainer.innerHTML = '';
        
        this.robots.forEach(robot => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'timeline-row';
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'timeline-robot-name';
            nameDiv.textContent = `机器人 ${robot.id}`;
            rowDiv.appendChild(nameDiv);
            
            const slotsDiv = document.createElement('div');
            slotsDiv.className = 'timeline-slots';
            
            for (let i = 0; i < hours; i++) {
                const hourSlotDiv = document.createElement('div');
                hourSlotDiv.className = 'timeline-hour-slot';
                slotsDiv.appendChild(hourSlotDiv);
            }
            
            const robotActions = this.actions
                .filter(a => a.robotId === robot.id)
                .sort((a, b) => a.startTime - b.startTime);
            
            robotActions.forEach(action => {
                const actionDiv = document.createElement('div');
                actionDiv.className = `timeline-action ${action.type}`;
                
                const hasConflict = this.conflicts.some(c => 
                    c.actionIds && c.actionIds.includes(action.id)
                );
                if (hasConflict) {
                    actionDiv.classList.add('conflict');
                }
                
                const startPercent = (action.startTime / timeLimit) * 100;
                const durationPercent = (action.duration / timeLimit) * 100;
                
                actionDiv.style.left = `${startPercent}%`;
                actionDiv.style.width = `${durationPercent}%`;
                
                const actionNames = {
                    pollination: '授粉',
                    charging: '充电',
                    disinfection: '消毒',
                    move: '移动'
                };
                
                const zone = this.zones.find(z => z.id === action.zoneId);
                actionDiv.innerHTML = `<span>${actionNames[action.type]}<br>${zone ? zone.name : ''}</span>`;
                
                actionDiv.dataset.actionId = action.id;
                actionDiv.addEventListener('click', () => this.showActionDetails(action));
                
                slotsDiv.appendChild(actionDiv);
            });
            
            rowDiv.appendChild(slotsDiv);
            bodyContainer.appendChild(rowDiv);
        });
    }
    
    // 渲染机器人状态
    renderRobotsStatus() {
        const container = document.getElementById('robots-status');
        container.innerHTML = '';
        
        this.robots.forEach(robot => {
            const statusDiv = document.createElement('div');
            statusDiv.className = 'robot-status';
            
            const batteryPercent = Math.round((robot.battery / robot.maxBattery) * 100);
            const batteryColor = batteryPercent > 50 ? '#27ae60' : batteryPercent > 20 ? '#f1c40f' : '#e74c3c';
            
            statusDiv.innerHTML = `
                <h4>机器人 ${robot.id}</h4>
                <p>电量: <span style="color: ${batteryColor}">${robot.battery}/${robot.maxBattery}</span></p>
                <p>位置: 行 ${robot.startPosition.row}, 列 ${robot.startPosition.col}</p>
                <p>状态: ${this.getRobotStatus(robot.id)}</p>
            `;
            
            container.appendChild(statusDiv);
        });
    }
    
    // 获取机器人状态
    getRobotStatus(robotId) {
        const currentAction = this.actions.find(a => 
            a.robotId === robotId && 
            a.startTime <= this.currentTime && 
            a.startTime + a.duration > this.currentTime
        );
        
        if (currentAction) {
            const statusNames = {
                pollination: '授粉中',
                charging: '充电中',
                disinfection: '消毒中',
                move: '移动中'
            };
            return statusNames[currentAction.type];
        }
        
        return '待机';
    }
    
    // 渲染关卡信息
    renderLevelInfo() {
        const container = document.getElementById('level-info');
        if (!this.currentLevel) {
            container.innerHTML = '<p>请先加载关卡</p>';
            return;
        }
        
        const timeLimit = this.currentLevel.timeLimit || 1440;
        const hours = Math.floor(timeLimit / 60);
        const minutes = timeLimit % 60;
        
        container.innerHTML = `
            <p><strong>名称:</strong> ${this.currentLevel.name}</p>
            <p><strong>描述:</strong> ${this.currentLevel.description || '无'}</p>
            <p><strong>时间限制:</strong> ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}</p>
            <p><strong>目标数:</strong> ${this.currentLevel.objectives.length}</p>
            <p><strong>机器人数:</strong> ${this.robots.length}</p>
        `;
    }
    
    // 更新动作选择器
    updateActionSelectors() {
        const robotSelect = document.getElementById('robot-select');
        const zoneSelect = document.getElementById('zone-select');
        
        robotSelect.innerHTML = '';
        this.robots.forEach(robot => {
            const option = document.createElement('option');
            option.value = robot.id;
            option.textContent = `机器人 ${robot.id}`;
            robotSelect.appendChild(option);
        });
        
        zoneSelect.innerHTML = '';
        this.zones.forEach(zone => {
            const option = document.createElement('option');
            option.value = zone.id;
            option.textContent = zone.name;
            zoneSelect.appendChild(option);
        });
    }
    
    // 添加动作
    addAction() {
        if (!this.currentLevel || this.gameState !== 'planning') {
            this.showError('请先加载关卡并处于规划状态');
            return;
        }
        
        const actionType = document.getElementById('action-type').value;
        const robotId = document.getElementById('robot-select').value;
        const zoneId = document.getElementById('zone-select').value;
        const startTimeStr = document.getElementById('start-time').value;
        const duration = parseInt(document.getElementById('duration').value);
        
        const startTime = this.parseTimeToMinutes(startTimeStr);
        
        const action = {
            id: `action_${Date.now()}`,
            type: actionType,
            robotId: robotId,
            zoneId: zoneId,
            startTime: startTime,
            duration: duration
        };
        
        const validationErrors = this.validateAction(action);
        if (validationErrors.length > 0) {
            this.showError(validationErrors.join('\n'));
            return;
        }
        
        this.actions.push(action);
        this.checkAllConflicts();
        this.renderTimeline();
        this.showConflicts();
    }
    
    // 验证动作
    validateAction(action) {
        const errors = [];
        const timeLimit = this.currentLevel.timeLimit || 1440;
        
        if (action.startTime < 0) {
            errors.push('开始时间不能早于 00:00');
        }
        
        if (action.startTime + action.duration > timeLimit) {
            errors.push('动作结束时间超过关卡时间限制');
        }
        
        const zone = this.zones.find(z => z.id === action.zoneId);
        if (!zone) {
            errors.push('目标区域不存在');
        } else {
            if (action.type === 'pollination' && zone.type !== 'pollination') {
                errors.push('授粉动作只能在授粉区执行');
            }
            
            if (action.type === 'charging' && zone.type !== 'charging') {
                errors.push('充电动作只能在充电区执行');
            }
            
            if (action.type === 'disinfection' && zone.type !== 'disinfection') {
                errors.push('消毒动作只能在消毒区执行');
            }
        }
        
        const robot = this.robots.find(r => r.id === action.robotId);
        if (robot) {
            const robotActions = this.actions
                .filter(a => a.robotId === action.robotId && a.id !== action.id)
                .sort((a, b) => a.startTime - b.startTime);
            
            for (const existingAction of robotActions) {
                if (this.timeRangesOverlap(
                    action.startTime, action.startTime + action.duration,
                    existingAction.startTime, existingAction.startTime + existingAction.duration
                )) {
                    errors.push(`与机器人 ${action.robotId} 的现有动作时间重叠`);
                    break;
                }
            }
        }
        
        return errors;
    }
    
    // 检查时间范围是否重叠
    timeRangesOverlap(start1, end1, start2, end2) {
        return start1 < end2 && start2 < end1;
    }
    
    // 检查所有冲突
    checkAllConflicts() {
        this.conflicts = [];
        
        this.checkLowBatteryConflicts();
        this.checkHumidityConflicts();
        this.checkPathCollisionConflicts();
        this.checkCrossContaminationConflicts();
        this.checkPollinationWindowConflicts();
    }
    
    // 检查低电量冲突
    checkLowBatteryConflicts() {
        this.robots.forEach(robot => {
            let currentBattery = robot.battery;
            let currentPosition = { ...robot.startPosition };
            const timeLimit = this.currentLevel.timeLimit || 1440;
            
            const robotActions = this.actions
                .filter(a => a.robotId === robot.id)
                .sort((a, b) => a.startTime - b.startTime);
            
            let currentTime = 0;
            for (const action of robotActions) {
                if (action.startTime > currentTime) {
                    const idleDuration = action.startTime - currentTime;
                    currentBattery -= this.calculateIdlePowerConsumption(idleDuration);
                }
                
                if (currentBattery < 0) {
                    this.conflicts.push({
                        id: `battery_${robot.id}_${Date.now()}`,
                        type: 'low_battery',
                        message: `机器人 ${robot.id} 在 ${this.minutesToTime(action.startTime)} 前电量耗尽`,
                        actionIds: robotActions.filter(a => a.startTime <= action.startTime).map(a => a.id),
                        severity: 'critical'
                    });
                    break;
                }
                
                if (action.type === 'charging') {
                    currentBattery = Math.min(
                        robot.maxBattery,
                        currentBattery + this.calculateChargingPower(action.duration, robot.chargeRate)
                    );
                } else {
                    const powerConsumption = this.calculateActionPowerConsumption(action);
                    currentBattery -= powerConsumption;
                }
                
                currentTime = action.startTime + action.duration;
                currentPosition = this.getZonePosition(action.zoneId);
            }
            
            if (currentBattery < 0 && this.conflicts.length === 0) {
                this.conflicts.push({
                    id: `battery_${robot.id}_${Date.now()}`,
                    type: 'low_battery',
                    message: `机器人 ${robot.id} 在规划周期内电量耗尽`,
                    actionIds: robotActions.map(a => a.id),
                    severity: 'critical'
                });
            }
        });
    }
    
    // 检查湿度冲突
    checkHumidityConflicts() {
        this.actions.forEach(action => {
            if (action.type === 'move') return;
            
            const zone = this.zones.find(z => z.id === action.zoneId);
            if (zone && zone.type === 'humidity') {
                this.conflicts.push({
                    id: `humidity_${action.id}`,
                    type: 'humidity_violation',
                    message: `机器人 ${action.robotId} 在 ${this.minutesToTime(action.startTime)} 进入高湿禁入区 ${zone.name}`,
                    actionIds: [action.id],
                    severity: 'critical'
                });
            }
        });
    }
    
    // 检查路径相撞冲突
    checkPathCollisionConflicts() {
        const timeLimit = this.currentLevel.timeLimit || 1440;
        const timeStep = 5;
        
        for (let time = 0; time < timeLimit; time += timeStep) {
            const positions = new Map();
            
            this.robots.forEach(robot => {
                const pos = this.getRobotPositionAtTime(robot.id, time);
                const posKey = `${pos.row},${pos.col}`;
                
                if (positions.has(posKey)) {
                    const otherRobotId = positions.get(posKey);
                    
                    const existingConflict = this.conflicts.find(c => 
                        c.type === 'collision' && 
                        c.robots && 
                        c.robots.includes(robot.id) && 
                        c.robots.includes(otherRobotId)
                    );
                    
                    if (!existingConflict) {
                        this.conflicts.push({
                            id: `collision_${Date.now()}_${Math.random()}`,
                            type: 'collision',
                            message: `机器人 ${robot.id} 和 ${otherRobotId} 在 ${this.minutesToTime(time)} 发生路径相撞`,
                            robots: [robot.id, otherRobotId],
                            time: time,
                            severity: 'critical'
                        });
                    }
                } else {
                    positions.set(posKey, robot.id);
                }
            });
        }
    }
    
    // 检查交叉污染冲突
    checkCrossContaminationConflicts() {
        const pollinationZones = this.zones.filter(z => z.type === 'pollination');
        
        for (const zone of pollinationZones) {
            if (zone.requiresDisinfection) {
                const zoneActions = this.actions
                    .filter(a => a.zoneId === zone.id && a.type === 'pollination')
                    .sort((a, b) => a.startTime - b.startTime);
                
                for (let i = 1; i < zoneActions.length; i++) {
                    const prevAction = zoneActions[i - 1];
                    const currentAction = zoneActions[i];
                    
                    const hasDisinfection = this.actions.some(a => 
                        a.robotId === currentAction.robotId &&
                        a.type === 'disinfection' &&
                        a.startTime > prevAction.startTime + prevAction.duration &&
                        a.startTime + a.duration < currentAction.startTime
                    );
                    
                    if (!hasDisinfection) {
                        this.conflicts.push({
                            id: `contamination_${zone.id}_${i}`,
                            type: 'cross_contamination',
                            message: `机器人 ${currentAction.robotId} 在区域 ${zone.name} 的连续授粉之间未进行消毒`,
                            actionIds: [prevAction.id, currentAction.id],
                            severity: 'high'
                        });
                    }
                }
            }
        }
    }
    
    // 检查花期窗口冲突
    checkPollinationWindowConflicts() {
        this.currentLevel.objectives.forEach((objective, index) => {
            if (!objective.floweringWindow) return;
            
            const windowStart = this.parseTimeToMinutes(objective.floweringWindow.start);
            const windowEnd = this.parseTimeToMinutes(objective.floweringWindow.end);
            
            const pollinationActions = this.actions.filter(a => 
                a.type === 'pollination' && 
                a.zoneId === objective.zoneId
            );
            
            const hasValidPollination = pollinationActions.some(action => {
                const actionEnd = action.startTime + action.duration;
                return action.startTime >= windowStart && actionEnd <= windowEnd;
            });
            
            if (pollinationActions.length > 0 && !hasValidPollination) {
                this.conflicts.push({
                    id: `window_${index}`,
                    type: 'flowering_window',
                    message: `区域 ${objective.zoneId} 的授粉动作未在开花窗口内 (${objective.floweringWindow.start} - ${objective.floweringWindow.end})`,
                    actionIds: pollinationActions.map(a => a.id),
                    severity: 'high'
                });
            }
        });
    }
    
    // 计算待机功耗
    calculateIdlePowerConsumption(duration) {
        return duration * 0.1;
    }
    
    // 计算动作功耗
    calculateActionPowerConsumption(action) {
        const powerRates = {
            pollination: 2.0,
            charging: -5.0,
            disinfection: 1.5,
            move: 1.0
        };
        
        const rate = powerRates[action.type] || 1.0;
        return action.duration * rate;
    }
    
    // 计算充电量
    calculateChargingPower(duration, chargeRate) {
        return duration * (chargeRate || 5.0);
    }
    
    // 获取区域位置
    getZonePosition(zoneId) {
        const zone = this.zones.find(z => z.id === zoneId);
        if (zone && zone.cells.length > 0) {
            return zone.cells[0];
        }
        return { row: -1, col: -1 };
    }
    
    // 显示冲突
    showConflicts() {
        const section = document.getElementById('conflict-section');
        const list = document.getElementById('conflict-list');
        
        if (this.conflicts.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        section.style.display = 'block';
        list.innerHTML = '';
        
        const severityColors = {
            critical: '#e74c3c',
            high: '#e67e22',
            medium: '#f1c40f',
            low: '#3498db'
        };
        
        const typeNames = {
            low_battery: '低电量',
            humidity_violation: '湿度禁入',
            collision: '路径相撞',
            cross_contamination: '交叉污染',
            flowering_window: '花期窗口'
        };
        
        this.conflicts.forEach(conflict => {
            const item = document.createElement('div');
            item.className = 'conflict-item';
            item.style.borderLeftColor = severityColors[conflict.severity] || '#95a5a6';
            
            item.innerHTML = `
                <h4>${typeNames[conflict.type] || '冲突'}</h4>
                <p>${conflict.message}</p>
            `;
            
            list.appendChild(item);
        });
    }
    
    // 隐藏冲突
    hideConflicts() {
        document.getElementById('conflict-section').style.display = 'none';
    }
    
    // 运行模拟
    async runSimulation() {
        if (!this.currentLevel) {
            this.showError('请先加载关卡');
            return;
        }
        
        if (this.conflicts.filter(c => c.severity === 'critical').length > 0) {
            this.showError('存在严重冲突，无法运行模拟。请先解决所有红色冲突警告。');
            return;
        }
        
        this.gameState = 'running';
        this.isRunning = true;
        document.getElementById('run-btn').textContent = '暂停';
        
        const timeLimit = this.currentLevel.timeLimit || 1440;
        const speed = 100;
        
        for (let time = 0; time <= timeLimit && this.isRunning; time += 5) {
            this.currentTime = time;
            this.updateTimeDisplay();
            this.renderGreenhouseGrid();
            this.updateRobotBatteries();
            this.renderRobotsStatus();
            
            await this.sleep(speed);
        }
        
        this.isRunning = false;
        this.gameState = 'completed';
        document.getElementById('run-btn').textContent = '运行';
        
        this.evaluateResults();
    }
    
    // 暂停模拟
    pauseSimulation() {
        this.isRunning = false;
        this.gameState = 'planning';
        document.getElementById('run-btn').textContent = '运行';
    }
    
    // 更新机器人电量
    updateRobotBatteries() {
        this.robots.forEach(robot => {
            let currentBattery = robot.battery;
            const robotActions = this.actions
                .filter(a => a.robotId === robot.id)
                .sort((a, b) => a.startTime - b.startTime);
            
            let currentTime = 0;
            for (const action of robotActions) {
                if (action.startTime > currentTime && action.startTime <= this.currentTime) {
                    const idleDuration = Math.min(action.startTime - currentTime, this.currentTime - currentTime);
                    currentBattery -= this.calculateIdlePowerConsumption(idleDuration);
                }
                
                if (action.startTime <= this.currentTime) {
                    const actionEnd = action.startTime + action.duration;
                    const actionProgress = Math.min(this.currentTime, actionEnd) - action.startTime;
                    
                    if (action.type === 'charging') {
                        currentBattery = Math.min(
                            robot.maxBattery,
                            currentBattery + this.calculateChargingPower(actionProgress, robot.chargeRate)
                        );
                    } else if (actionProgress > 0) {
                        const powerRates = {
                            pollination: 2.0,
                            disinfection: 1.5,
                            move: 1.0
                        };
                        const rate = powerRates[action.type] || 1.0;
                        currentBattery -= actionProgress * rate;
                    }
                }
                
                if (action.startTime + action.duration <= this.currentTime) {
                    currentTime = action.startTime + action.duration;
                }
            }
            
            if (currentTime < this.currentTime) {
                const idleDuration = this.currentTime - currentTime;
                currentBattery -= this.calculateIdlePowerConsumption(idleDuration);
            }
            
            robot.currentBattery = Math.max(0, currentBattery);
        });
    }
    
    // 更新时间显示
    updateTimeDisplay() {
        document.getElementById('current-time').textContent = this.minutesToTime(this.currentTime);
    }
    
    // 评估结果
    evaluateResults() {
        const results = {
            success: true,
            score: 0,
            completedObjectives: 0,
            totalObjectives: this.currentLevel.objectives.length,
            robotsWithBattery: 0,
            conflicts: this.conflicts.length,
            details: []
        };
        
        this.currentLevel.objectives.forEach((objective, index) => {
            const isCompleted = this.checkObjectiveCompletion(objective);
            if (isCompleted) {
                results.completedObjectives++;
                results.score += objective.points || 100;
                results.details.push({
                    objective: index + 1,
                    status: 'completed',
                    message: `目标 ${index + 1} 完成`
                });
            } else {
                results.success = false;
                results.details.push({
                    objective: index + 1,
                    status: 'failed',
                    message: `目标 ${index + 1} 未完成`
                });
            }
        });
        
        this.robots.forEach(robot => {
            const finalBattery = robot.currentBattery !== undefined ? robot.currentBattery : robot.battery;
            if (finalBattery > 0) {
                results.robotsWithBattery++;
            } else {
                results.success = false;
            }
        });
        
        if (this.conflicts.length > 0) {
            results.score -= this.conflicts.length * 50;
        }
        
        results.score = Math.max(0, results.score);
        
        this.updateBestScore(results.score);
        
        this.showResults(results);
    }
    
    // 检查目标是否完成
    checkObjectiveCompletion(objective) {
        const pollinationActions = this.actions.filter(a => 
            a.type === 'pollination' && 
            a.zoneId === objective.zoneId
        );
        
        if (pollinationActions.length === 0) return false;
        
        if (objective.floweringWindow) {
            const windowStart = this.parseTimeToMinutes(objective.floweringWindow.start);
            const windowEnd = this.parseTimeToMinutes(objective.floweringWindow.end);
            
            const hasValidPollination = pollinationActions.some(action => {
                const actionEnd = action.startTime + action.duration;
                return action.startTime >= windowStart && actionEnd <= windowEnd;
            });
            
            if (!hasValidPollination) return false;
        }
        
        if (objective.minPollinationTime) {
            const totalTime = pollinationActions.reduce((sum, a) => sum + a.duration, 0);
            if (totalTime < objective.minPollinationTime) return false;
        }
        
        return true;
    }
    
    // 显示结果
    showResults(results) {
        const section = document.getElementById('result-section');
        const content = document.getElementById('result-content');
        
        section.style.display = 'block';
        
        const summaryClass = results.success ? 'success' : 'failure';
        const summaryText = results.success ? '关卡完成！' : '关卡失败';
        
        let detailsHtml = '';
        results.details.forEach(detail => {
            const statusClass = detail.status === 'completed' ? 'success' : 'failure';
            detailsHtml += `
                <div class="result-detail-item">
                    <h4>目标 ${detail.objective}</h4>
                    <div class="value" style="color: ${detail.status === 'completed' ? '#27ae60' : '#e74c3c'}">
                        ${detail.status === 'completed' ? '完成' : '未完成'}
                    </div>
                </div>
            `;
        });
        
        content.innerHTML = `
            <div class="result-summary ${summaryClass}">
                ${summaryText}
            </div>
            <div class="result-details">
                <div class="result-detail-item">
                    <h4>总得分</h4>
                    <div class="value">${results.score}</div>
                </div>
                <div class="result-detail-item">
                    <h4>完成目标</h4>
                    <div class="value">${results.completedObjectives}/${results.totalObjectives}</div>
                </div>
                <div class="result-detail-item">
                    <h4>机器人存活</h4>
                    <div class="value">${results.robotsWithBattery}/${this.robots.length}</div>
                </div>
                <div class="result-detail-item">
                    <h4>冲突数</h4>
                    <div class="value" style="color: ${results.conflicts > 0 ? '#e74c3c' : '#27ae60'}">${results.conflicts}</div>
                </div>
            </div>
            <div class="result-details">
                ${detailsHtml}
            </div>
        `;
    }
    
    // 隐藏结果
    hideResults() {
        document.getElementById('result-section').style.display = 'none';
    }
    
    // 重置关卡
    resetLevel() {
        if (this.currentLevel) {
            this.initializeLevel();
            this.updateTimeDisplay();
        }
    }
    
    // 导出复盘
    exportReplay() {
        if (!this.currentLevel) {
            this.showError('请先加载关卡');
            return;
        }
        
        const replayData = {
            levelId: this.currentLevel.id,
            levelName: this.currentLevel.name,
            exportTime: new Date().toISOString(),
            actions: this.actions,
            finalScore: this.gameState === 'completed' ? this.calculateFinalScore() : null,
            conflicts: this.conflicts,
            gameState: this.gameState
        };
        
        const jsonString = JSON.stringify(replayData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `replay_${this.currentLevel.id}_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // 计算最终得分
    calculateFinalScore() {
        let score = 0;
        
        this.currentLevel.objectives.forEach(objective => {
            if (this.checkObjectiveCompletion(objective)) {
                score += objective.points || 100;
            }
        });
        
        score -= this.conflicts.length * 50;
        
        return Math.max(0, score);
    }
    
    // 加载最佳成绩
    loadBestScores() {
        try {
            const saved = localStorage.getItem('greenhouse_scheduler_best_scores');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    }
    
    // 更新最佳成绩
    updateBestScore(score) {
        if (!this.currentLevel) return;
        
        const levelId = this.currentLevel.id;
        if (!this.bestScores[levelId] || score > this.bestScores[levelId]) {
            this.bestScores[levelId] = score;
            localStorage.setItem('greenhouse_scheduler_best_scores', JSON.stringify(this.bestScores));
            this.updateBestScoreDisplay();
        }
    }
    
    // 更新最佳成绩显示
    updateBestScoreDisplay() {
        const display = document.getElementById('best-score');
        if (!this.currentLevel) {
            display.textContent = '--';
            return;
        }
        
        const levelId = this.currentLevel.id;
        const bestScore = this.bestScores[levelId];
        display.textContent = bestScore !== undefined ? bestScore : '--';
    }
    
    // 显示动作详情
    showActionDetails(action) {
        const actionNames = {
            pollination: '授粉',
            charging: '充电',
            disinfection: '消毒',
            move: '移动'
        };
        
        const zone = this.zones.find(z => z.id === action.zoneId);
        
        const content = `
            <h3>动作详情</h3>
            <p><strong>类型:</strong> ${actionNames[action.type]}</p>
            <p><strong>机器人:</strong> ${action.robotId}</p>
            <p><strong>区域:</strong> ${zone ? zone.name : action.zoneId}</p>
            <p><strong>开始时间:</strong> ${this.minutesToTime(action.startTime)}</p>
            <p><strong>结束时间:</strong> ${this.minutesToTime(action.startTime + action.duration)}</p>
            <p><strong>时长:</strong> ${action.duration} 分钟</p>
            <div style="margin-top: 20px;">
                <button id="delete-action-btn" style="padding: 8px 15px; background-color: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    删除动作
                </button>
            </div>
        `;
        
        this.showModal('动作详情', content);
        
        setTimeout(() => {
            const deleteBtn = document.getElementById('delete-action-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    this.deleteAction(action.id);
                    this.closeModal();
                });
            }
        }, 0);
    }
    
    // 删除动作
    deleteAction(actionId) {
        this.actions = this.actions.filter(a => a.id !== actionId);
        this.checkAllConflicts();
        this.renderTimeline();
        this.showConflicts();
    }
    
    // 显示错误
    showError(message) {
        this.showModal('错误', `<div class="error-message"><p>${message}</p></div>`);
    }
    
    // 显示模态框
    showModal(title, content) {
        const modal = document.getElementById('modal');
        const modalBody = document.getElementById('modal-body');
        
        modalBody.innerHTML = `<h2>${title}</h2>${content}`;
        modal.style.display = 'block';
    }
    
    // 关闭模态框
    closeModal() {
        document.getElementById('modal').style.display = 'none';
    }
    
    // 解析时间为分钟
    parseTimeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }
    
    // 分钟转换为时间字符串
    minutesToTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }
    
    // 睡眠函数
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 页面加载完成后初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    window.game = new GreenhouseSchedulerGame();
});
