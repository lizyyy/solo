// 月面滑翔补给局 - 核心游戏逻辑
(function() {
    'use strict';

    // ========== 游戏状态常量 ==========
    const GameState = {
        STANDBY: 'standby',
        FLYING: 'flying',
        SUCCESS: 'success',
        FAILED: 'failed',
        REPLAY: 'replay'
    };

    const FailureType = {
        HIGH_SPEED: 'high_speed',
        OUT_OF_FUEL: 'out_of_fuel',
        OUT_OF_BOUNDS: 'out_of_bounds',
        CRATER_HIT: 'crater_hit',
        WRONG_ZONE: 'wrong_zone'
    };

    // ========== 默认配置 ==========
    const DEFAULT_CONFIG = {
        capsule: {
            mass: 100,
            maxThrust: 1500,
            dragCoeff: 0.02,
            width: 30,
            height: 40
        },
        fuel: {
            initialFuel: 100,
            consumptionRate: 0.5,
            landingZone: { x: 700, width: 120 }
        },
        crater: {
            craters: [
                { x: 200, y: 550, radius: 40, depth: 20 },
                { x: 450, y: 550, radius: 55, depth: 28 },
                { x: 600, y: 550, radius: 35, depth: 18 }
            ]
        },
        physics: {
            gravity: 1.62,
            maxSafeSpeed: 5,
            groundY: 550
        }
    };

    // ========== 游戏状态 ==========
    let game = {
        state: GameState.STANDBY,
        frameCount: 0,
        startTime: 0,
        
        capsule: {
            x: 80,
            y: 100,
            vx: 0,
            vy: 0,
            angle: 0,
            mass: DEFAULT_CONFIG.capsule.mass,
            maxThrust: DEFAULT_CONFIG.capsule.maxThrust,
            dragCoeff: DEFAULT_CONFIG.capsule.dragCoeff,
            width: DEFAULT_CONFIG.capsule.width,
            height: DEFAULT_CONFIG.capsule.height
        },
        
        fuel: {
            current: DEFAULT_CONFIG.fuel.initialFuel,
            initial: DEFAULT_CONFIG.fuel.initialFuel,
            consumptionRate: DEFAULT_CONFIG.fuel.consumptionRate
        },
        
        landingZone: { ...DEFAULT_CONFIG.fuel.landingZone },
        
        craters: JSON.parse(JSON.stringify(DEFAULT_CONFIG.crater.craters)),
        
        physics: { ...DEFAULT_CONFIG.physics },
        
        keys: {
            up: false,
            left: false,
            right: false,
            space: false
        },
        
        replay: {
            frames: [],
            currentFrame: 0,
            playing: false
        },
        
        materials: {
            raw: {
                capsule: null,
                crater: null,
                fuel: null
            },
            processed: {
                capsule: null,
                crater: null,
                fuel: null
            }
        },
        
        lastFailure: null
    };

    // ========== DOM 元素 ==========
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    const elements = {
        missionStatus: document.getElementById('missionStatus'),
        vxDisplay: document.getElementById('vxDisplay'),
        vyDisplay: document.getElementById('vyDisplay'),
        speedDisplay: document.getElementById('speedDisplay'),
        altitudeDisplay: document.getElementById('altitudeDisplay'),
        fuelBar: document.getElementById('fuelBar'),
        fuelDisplay: document.getElementById('fuelDisplay'),
        flightLog: document.getElementById('flightLog'),
        overlay: document.getElementById('overlay'),
        overlayTitle: document.getElementById('overlayTitle'),
        failureAnalysis: document.getElementById('failureAnalysis'),
        retryBtn: document.getElementById('retryBtn'),
        replayBtn: document.getElementById('replayBtn'),
        replayOverlay: document.getElementById('replayOverlay'),
        playPauseBtn: document.getElementById('playPauseBtn'),
        stepBackBtn: document.getElementById('stepBackBtn'),
        stepFwdBtn: document.getElementById('stepFwdBtn'),
        closeReplayBtn: document.getElementById('closeReplayBtn'),
        replayFrame: document.getElementById('replayFrame'),
        replayTotal: document.getElementById('replayTotal'),
        materialStatus: document.getElementById('materialStatus'),
        rawMaterials: document.getElementById('rawMaterials'),
        processedResults: document.getElementById('processedResults'),
        defaultConfigBtn: document.getElementById('defaultConfigBtn'),
        showHelpBtn: document.getElementById('showHelpBtn'),
        closeHelpBtn: document.getElementById('closeHelpBtn'),
        helpModal: document.getElementById('helpModal'),
        capsuleImport: document.getElementById('capsuleImport'),
        craterImport: document.getElementById('craterImport'),
        fuelImport: document.getElementById('fuelImport')
    };

    // ========== 工具函数 ==========
    function formatNumber(num, decimals = 1) {
        return num.toFixed(decimals);
    }

    function getSpeed() {
        return Math.sqrt(game.capsule.vx ** 2 + game.capsule.vy ** 2);
    }

    function getAltitude() {
        return Math.max(0, game.physics.groundY - game.capsule.y);
    }

    function addLog(message, type = 'info') {
        const entry = document.createElement('p');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${formatNumber(game.frameCount / 60, 1)}s] ${message}`;
        elements.flightLog.appendChild(entry);
        elements.flightLog.scrollTop = elements.flightLog.scrollHeight;
    }

    function updateMissionStatus(status) {
        game.state = status;
        elements.missionStatus.className = `mission-status ${status}`;
        const statusText = {
            [GameState.STANDBY]: '待命',
            [GameState.FLYING]: '飞行中',
            [GameState.SUCCESS]: '任务成功',
            [GameState.FAILED]: '任务失败',
            [GameState.REPLAY]: '回放中'
        };
        elements.missionStatus.textContent = statusText[status] || status;
    }

    // ========== 材料导入系统 ==========
    function processMaterial(type, rawData, source) {
        game.materials.raw[type] = {
            data: JSON.parse(JSON.stringify(rawData)),
            source: source,
            timestamp: Date.now()
        };

        let processed = null;
        let validation = { valid: true, errors: [], warnings: [] };

        switch (type) {
            case 'capsule':
                processed = processCapsuleData(rawData, validation);
                break;
            case 'crater':
                processed = processCraterData(rawData, validation);
                break;
            case 'fuel':
                processed = processFuelData(rawData, validation);
                break;
        }

        if (validation.valid) {
            game.materials.processed[type] = {
                data: processed,
                validation: validation,
                timestamp: Date.now()
            };
            applyProcessedMaterial(type, processed);
            addLog(`✓ ${getMaterialName(type)}导入成功`, 'success');
        } else {
            addLog(`✗ ${getMaterialName(type)}导入失败: ${validation.errors[0]}`, 'error');
        }

        updateMaterialDisplay();
        return validation;
    }

    function getMaterialName(type) {
        const names = {
            capsule: '补给舱参数',
            crater: '月坑分布',
            fuel: '燃料配置'
        };
        return names[type] || type;
    }

    function processCapsuleData(data, validation) {
        const defaults = DEFAULT_CONFIG.capsule;
        const result = { ...defaults };

        if (data.mass !== undefined) {
            if (data.mass > 0 && data.mass < 1000) {
                result.mass = data.mass;
            } else {
                validation.errors.push('质量必须在0-1000之间');
                validation.valid = false;
            }
        }

        if (data.maxThrust !== undefined) {
            if (data.maxThrust > 0 && data.maxThrust < 10000) {
                result.maxThrust = data.maxThrust;
            } else {
                validation.errors.push('推力必须在0-10000之间');
                validation.valid = false;
            }
        }

        if (data.dragCoeff !== undefined) {
            if (data.dragCoeff >= 0 && data.dragCoeff < 1) {
                result.dragCoeff = data.dragCoeff;
            } else {
                validation.errors.push('阻力系数必须在0-1之间');
                validation.valid = false;
            }
        }

        return result;
    }

    function processCraterData(data, validation) {
        const result = { craters: [] };

        if (!data.craters || !Array.isArray(data.craters)) {
            validation.errors.push('月坑数据格式错误');
            validation.valid = false;
            return result;
        }

        data.craters.forEach((crater, index) => {
            if (crater.x === undefined || crater.radius === undefined) {
                validation.errors.push(`月坑${index + 1}缺少必要参数`);
                validation.valid = false;
                return;
            }

            const processedCrater = {
                x: Math.max(0, Math.min(900, crater.x)),
                y: DEFAULT_CONFIG.physics.groundY,
                radius: Math.max(10, Math.min(100, crater.radius)),
                depth: Math.max(5, Math.min(50, crater.depth || 20))
            };

            if (crater.x < 0 || crater.x > 900) {
                validation.warnings.push(`月坑${index + 1}X坐标已修正到范围内`);
            }

            result.craters.push(processedCrater);
        });

        return result;
    }

    function processFuelData(data, validation) {
        const defaults = DEFAULT_CONFIG.fuel;
        const result = { ...defaults };

        if (data.initialFuel !== undefined) {
            if (data.initialFuel > 0 && data.initialFuel <= 200) {
                result.initialFuel = data.initialFuel;
            } else {
                validation.errors.push('初始燃料必须在0-200之间');
                validation.valid = false;
            }
        }

        if (data.consumptionRate !== undefined) {
            if (data.consumptionRate > 0 && data.consumptionRate < 5) {
                result.consumptionRate = data.consumptionRate;
            } else {
                validation.errors.push('消耗率必须在0-5之间');
                validation.valid = false;
            }
        }

        if (data.landingZone !== undefined) {
            const lz = data.landingZone;
            if (lz.x !== undefined && lz.width !== undefined) {
                const x = Math.max(100, Math.min(800, lz.x));
                const width = Math.max(60, Math.min(200, lz.width));
                
                if (x !== lz.x || width !== lz.width) {
                    validation.warnings.push('着陆区参数已修正到合理范围');
                }
                
                result.landingZone = { x, width };
            } else {
                validation.errors.push('着陆区缺少必要参数');
                validation.valid = false;
            }
        }

        return result;
    }

    function applyProcessedMaterial(type, processed) {
        switch (type) {
            case 'capsule':
                game.capsule.mass = processed.mass;
                game.capsule.maxThrust = processed.maxThrust;
                game.capsule.dragCoeff = processed.dragCoeff;
                break;
            case 'crater':
                game.craters = processed.craters;
                break;
            case 'fuel':
                game.fuel.initial = processed.initialFuel;
                game.fuel.current = processed.initialFuel;
                game.fuel.consumptionRate = processed.consumptionRate;
                game.landingZone = { ...processed.landingZone };
                break;
        }
    }

    function updateMaterialDisplay() {
        const rawParts = [];
        const processedParts = [];

        ['capsule', 'crater', 'fuel'].forEach(type => {
            const raw = game.materials.raw[type];
            const processed = game.materials.processed[type];

            if (raw) {
                rawParts.push(`<div class="material-item">${getMaterialName(type)}: ${raw.source}</div>`);
            }

            if (processed) {
                const validClass = processed.validation.valid ? '' : 'invalid';
                const warnings = processed.validation.warnings.length > 0 
                    ? ` (${processed.validation.warnings.length}条警告)` 
                    : '';
                processedParts.push(`<div class="result-item ${validClass}">${getMaterialName(type)}: 已应用${warnings}</div>`);
            }
        });

        elements.rawMaterials.innerHTML = rawParts.length > 0 
            ? rawParts.join('') 
            : '<p class="empty">无</p>';
        
        elements.processedResults.innerHTML = processedParts.length > 0 
            ? processedParts.join('') 
            : '<p class="empty">无</p>';

        const statusParts = [];
        ['capsule', 'crater', 'fuel'].forEach(type => {
            if (game.materials.processed[type]) {
                statusParts.push(`<p class="loaded">✓ ${getMaterialName(type)} 已加载</p>`);
            }
        });

        elements.materialStatus.innerHTML = statusParts.length > 0 
            ? statusParts.join('') 
            : '<p>未导入自定义材料</p>';
    }

    function handleFileImport(file, type) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                processMaterial(type, data, file.name);
            } catch (err) {
                addLog(`✗ JSON解析失败: ${err.message}`, 'error');
            }
        };
        reader.readAsText(file);
    }

    function loadDefaultConfig() {
        addLog('加载默认配置...', 'info');
        
        processMaterial('capsule', DEFAULT_CONFIG.capsule, '系统默认');
        processMaterial('crater', DEFAULT_CONFIG.crater, '系统默认');
        processMaterial('fuel', DEFAULT_CONFIG.fuel, '系统默认');
        
        resetGame();
        addLog('默认配置加载完成', 'success');
    }

    // ========== 物理引擎 ==========
    function updatePhysics(dt) {
        if (game.state !== GameState.FLYING) return;

        const capsule = game.capsule;
        const keys = game.keys;

        let thrustX = 0;
        let thrustY = 0;
        let fuelUsed = 0;

        const thrustPerUnit = game.fuel.consumptionRate * dt * 60;

        if (game.fuel.current > 0) {
            if (keys.up) {
                thrustY = -capsule.maxThrust / capsule.mass * dt;
                fuelUsed += thrustPerUnit;
            }
            if (keys.left) {
                thrustX = -capsule.maxThrust * 0.5 / capsule.mass * dt;
                fuelUsed += thrustPerUnit * 0.5;
            }
            if (keys.right) {
                thrustX = capsule.maxThrust * 0.5 / capsule.mass * dt;
                fuelUsed += thrustPerUnit * 0.5;
            }
            if (keys.space) {
                const brakeForce = Math.min(getSpeed(), capsule.maxThrust * 0.8 / capsule.mass * dt);
                const speed = getSpeed();
                if (speed > 0) {
                    thrustX -= (capsule.vx / speed) * brakeForce;
                    thrustY -= (capsule.vy / speed) * brakeForce;
                }
                fuelUsed += thrustPerUnit * 0.8;
            }
        } else if (game.fuel.current <= 0 && !game.fuelDepletionLogged) {
            game.fuelDepletionLogged = true;
            addLog('⚠ 燃料耗尽！推进系统离线', 'warning');
        }

        game.fuel.current = Math.max(0, game.fuel.current - fuelUsed);

        const gravity = game.physics.gravity * dt;
        const dragX = -capsule.vx * capsule.dragCoeff * dt;
        const dragY = -capsule.vy * capsule.dragCoeff * dt;

        capsule.vx += thrustX + dragX;
        capsule.vy += thrustY + gravity + dragY;

        capsule.x += capsule.vx * dt * 60;
        capsule.y += capsule.vy * dt * 60;

        capsule.angle = Math.atan2(capsule.vy, capsule.vx) * 180 / Math.PI;

        checkCollisions();
    }

    // ========== 碰撞检测 ==========
    function checkCollisions() {
        const capsule = game.capsule;
        const speed = getSpeed();

        if (capsule.x < -50 || capsule.x > canvas.width + 50) {
            failMission(FailureType.OUT_OF_BOUNDS, {
                position: { x: capsule.x, y: capsule.y },
                speed: speed,
                fuel: game.fuel.current
            });
            return;
        }

        if (capsule.y < -100) {
            failMission(FailureType.OUT_OF_BOUNDS, {
                position: { x: capsule.x, y: capsule.y },
                speed: speed,
                fuel: game.fuel.current,
                reason: '飞出大气层'
            });
            return;
        }

        for (let i = 0; i < game.craters.length; i++) {
            const crater = game.craters[i];
            const dist = Math.sqrt(
                (capsule.x - crater.x) ** 2 + 
                (capsule.y - crater.y) ** 2
            );

            if (dist < crater.radius) {
                if (capsule.y >= game.physics.groundY - 5) {
                    failMission(FailureType.WRONG_ZONE, {
                        position: { x: capsule.x, y: capsule.y },
                        speed: speed,
                        fuel: game.fuel.current,
                        craterIndex: i,
                        crater: crater
                    });
                    return;
                } else if (dist < crater.radius * 0.7) {
                    failMission(FailureType.CRATER_HIT, {
                        position: { x: capsule.x, y: capsule.y },
                        speed: speed,
                        fuel: game.fuel.current,
                        craterIndex: i,
                        crater: crater
                    });
                    return;
                }
            }
        }

        if (capsule.y >= game.physics.groundY) {
            capsule.y = game.physics.groundY;
            
            const lz = game.landingZone;
            const inLandingZone = capsule.x >= lz.x && capsule.x <= lz.x + lz.width;

            if (speed > game.physics.maxSafeSpeed) {
                failMission(FailureType.HIGH_SPEED, {
                    position: { x: capsule.x, y: capsule.y },
                    speed: speed,
                    fuel: game.fuel.current,
                    inLandingZone: inLandingZone
                });
            } else if (!inLandingZone) {
                failMission(FailureType.WRONG_ZONE, {
                    position: { x: capsule.x, y: capsule.y },
                    speed: speed,
                    fuel: game.fuel.current,
                    inLandingZone: false
                });
            } else {
                successMission({
                    position: { x: capsule.x, y: capsule.y },
                    speed: speed,
                    fuel: game.fuel.current
                });
            }
        }
    }

    // ========== 任务结果处理 ==========
    function failMission(type, data) {
        if (game.state !== GameState.FLYING) return;
        
        updateMissionStatus(GameState.FAILED);
        
        const analysis = analyzeFailure(type, data);
        game.lastFailure = { type, data, analysis };
        
        addLog(`✗ 任务失败: ${analysis.title}`, 'error');
        
        showFailureOverlay(analysis);
    }

    function successMission(data) {
        if (game.state !== GameState.FLYING) return;
        
        updateMissionStatus(GameState.SUCCESS);
        
        addLog(`✓ 任务成功！着陆速度: ${formatNumber(data.speed)} m/s`, 'success');
        addLog(`剩余燃料: ${formatNumber(data.fuel)}%`, 'success');
        
        showSuccessOverlay(data);
    }

    function analyzeFailure(type, data) {
        const analysis = {
            title: '',
            triggerMaterial: '',
            position: data.position,
            speed: data.speed,
            fuel: data.fuel,
            stuckPoint: '',
            suggestion: ''
        };

        const lz = game.landingZone;
        const distToLZ = data.position.x - (lz.x + lz.width / 2);

        switch (type) {
            case FailureType.HIGH_SPEED:
                analysis.title = '速度过高 - 补给舱损毁';
                analysis.triggerMaterial = identifyTriggerMaterial('speed', data);
                analysis.stuckPoint = `着陆时速度 ${formatNumber(data.speed)} m/s，超过安全值 ${game.physics.maxSafeSpeed} m/s`;
                analysis.suggestion = generateSuggestion('speed', data);
                break;
                
            case FailureType.OUT_OF_FUEL:
                analysis.title = '燃料耗尽 - 自由坠毁';
                analysis.triggerMaterial = identifyTriggerMaterial('fuel', data);
                analysis.stuckPoint = `在坐标 (${formatNumber(data.position.x)}, ${formatNumber(data.position.y)}) 燃料耗尽`;
                analysis.suggestion = generateSuggestion('fuel', data);
                break;
                
            case FailureType.OUT_OF_BOUNDS:
                analysis.title = '落点越界 - 偏离航线';
                analysis.triggerMaterial = identifyTriggerMaterial('trajectory', data);
                analysis.stuckPoint = `在坐标 (${formatNumber(data.position.x)}, ${formatNumber(data.position.y)}) 飞出边界`;
                analysis.suggestion = generateSuggestion('trajectory', data);
                break;
                
            case FailureType.CRATER_HIT:
                analysis.title = '撞击月坑 - 飞行事故';
                analysis.triggerMaterial = identifyTriggerMaterial('crater', data);
                analysis.stuckPoint = `在坐标 (${formatNumber(data.position.x)}, ${formatNumber(data.position.y)}) 撞击月坑 #${data.craterIndex + 1}`;
                analysis.suggestion = generateSuggestion('crater', data);
                break;
                
            case FailureType.WRONG_ZONE:
                analysis.title = '落点错误 - 偏离着陆区';
                analysis.triggerMaterial = identifyTriggerMaterial('zone', data);
                const zoneDesc = data.craterIndex !== undefined 
                    ? `降落在月坑 #${data.craterIndex + 1} 中` 
                    : `距离着陆区中心 ${formatNumber(Math.abs(distToLZ))} m`;
                analysis.stuckPoint = zoneDesc;
                analysis.suggestion = generateSuggestion('zone', data);
                break;
        }

        return analysis;
    }

    function identifyTriggerMaterial(failureMode, data) {
        const materials = [];
        
        const fuelConfig = game.materials.processed.fuel;
        const capsuleConfig = game.materials.processed.capsule;
        const craterConfig = game.materials.processed.crater;

        switch (failureMode) {
            case 'speed':
                if (capsuleConfig && capsuleConfig.data.maxThrust < 800) {
                    materials.push('补给舱参数 (推力不足)');
                }
                if (fuelConfig && fuelConfig.data.consumptionRate > 1) {
                    materials.push('燃料配置 (消耗过快导致后期无法减速)');
                }
                if (materials.length === 0) {
                    materials.push('操作控制 (减速时机过晚)');
                }
                break;
                
            case 'fuel':
                if (fuelConfig && fuelConfig.data.initialFuel < 60) {
                    materials.push('燃料配置 (初始燃料不足)');
                }
                if (fuelConfig && fuelConfig.data.consumptionRate > 1.5) {
                    materials.push('燃料配置 (消耗率过高)');
                }
                if (capsuleConfig && capsuleConfig.data.dragCoeff < 0.01) {
                    materials.push('补给舱参数 (阻力过小，需要频繁推进)');
                }
                if (materials.length === 0) {
                    materials.push('操作控制 (推进器使用过度)');
                }
                break;
                
            case 'trajectory':
                if (capsuleConfig && capsuleConfig.data.maxThrust > 2000) {
                    materials.push('补给舱参数 (推力过大，难以控制)');
                }
                if (materials.length === 0) {
                    materials.push('操作控制 (方向调整不当)');
                }
                break;
                
            case 'crater':
                if (craterConfig && craterConfig.data.craters.length > 5) {
                    materials.push('月坑分布 (障碍物过于密集)');
                }
                if (craterConfig && data.craterIndex !== undefined) {
                    const crater = craterConfig.data.craters[data.craterIndex];
                    if (crater && crater.radius > 60) {
                        materials.push(`月坑分布 (月坑 #${data.craterIndex + 1} 半径过大)`);
                    }
                }
                if (materials.length === 0) {
                    materials.push('操作控制 (未避开月坑)');
                }
                break;
                
            case 'zone':
                if (fuelConfig && fuelConfig.data.landingZone.width < 80) {
                    materials.push('燃料配置 (着陆区过窄)');
                }
                if (fuelConfig && fuelConfig.data.landingZone.x < 400) {
                    materials.push('燃料配置 (着陆区位置过远)');
                }
                if (materials.length === 0) {
                    materials.push('操作控制 (水平位置偏差)');
                }
                break;
        }

        return materials.join('、') || '未知';
    }

    function generateSuggestion(failureMode, data) {
        const suggestions = [];
        
        const lz = game.landingZone;
        const distToLZ = data.position.x - (lz.x + lz.width / 2);

        switch (failureMode) {
            case 'speed':
                suggestions.push('更早开启减速，在高度50m以上就开始控制下降速度');
                suggestions.push('使用空格键进行悬停制动，快速降低速度');
                if (data.inLandingZone) {
                    suggestions.push('位置正确，只需优化减速时机');
                }
                break;
                
            case 'fuel':
                suggestions.push('减少推进器使用时间，利用重力滑翔');
                suggestions.push('避免频繁调整方向，每次转向都消耗燃料');
                suggestions.push(`当前燃料 ${game.fuel.initial}%，建议增加到 120-150%`);
                break;
                
            case 'trajectory':
                suggestions.push('飞行中保持水平速度稳定，不要过大');
                if (data.position.x < 0) {
                    suggestions.push('向右调整轨迹，不要向左飞行');
                } else {
                    suggestions.push('控制推进力度，避免飞出右边界');
                }
                break;
                
            case 'crater':
                suggestions.push(`在月坑 #${data.craterIndex + 1} 之前提前变轨`);
                suggestions.push('保持高度在月坑上方，不要低空飞行');
                suggestions.push(`月坑位置 X=${data.crater.x}，建议从 X=${data.crater.x - 80} 开始爬升`);
                break;
                
            case 'zone':
                if (distToLZ < 0) {
                    suggestions.push(`向右调整 ${formatNumber(Math.abs(distToLZ))} m，增加推进时间`);
                } else {
                    suggestions.push(`向左调整 ${formatNumber(Math.abs(distToLZ))} m，减少推进或提前反向制动`);
                }
                suggestions.push('着陆区中心位置: X=' + (lz.x + lz.width / 2));
                break;
        }

        return suggestions.join('；') + '。按 P 查看回放分析飞行轨迹。';
    }

    function showFailureOverlay(analysis) {
        elements.overlayTitle.textContent = '任务失败';
        elements.overlayTitle.style.color = '#f44336';
        
        elements.failureAnalysis.innerHTML = `
            <div class="analysis-section">
                <h4>❌ 失败原因</h4>
                <p>${analysis.title}</p>
            </div>
            <div class="analysis-section">
                <h4>🔗 触发材料</h4>
                <p><span class="trigger-material">${analysis.triggerMaterial}</span></p>
            </div>
            <div class="analysis-section">
                <h4>📍 卡点位置</h4>
                <p>坐标: <span class="position">(${formatNumber(analysis.position.x)}, ${formatNumber(analysis.position.y)})</span></p>
                <p>速度: <span class="position">${formatNumber(analysis.speed)} m/s</span></p>
                <p>剩余燃料: <span class="position">${formatNumber(analysis.fuel)}%</span></p>
                <p>${analysis.stuckPoint}</p>
            </div>
            <div class="analysis-section">
                <h4>💡 下一步建议</h4>
                <p class="suggestion">${analysis.suggestion}</p>
            </div>
        `;
        
        elements.overlay.classList.remove('hidden');
    }

    function showSuccessOverlay(data) {
        elements.overlayTitle.textContent = '任务成功！';
        elements.overlayTitle.style.color = '#4caf50';
        
        const fuelEfficiency = formatNumber((game.fuel.initial - data.fuel) / game.frameCount * 60, 2);
        
        elements.failureAnalysis.innerHTML = `
            <div class="analysis-section">
                <h4>✓ 任务完成</h4>
                <p>补给舱已安全送达着陆区</p>
            </div>
            <div class="analysis-section">
                <h4>📊 飞行数据</h4>
                <p>着陆速度: <span class="position">${formatNumber(data.speed)} m/s</span></p>
                <p>剩余燃料: <span class="position">${formatNumber(data.fuel)}%</span></p>
                <p>飞行时间: <span class="position">${formatNumber(game.frameCount / 60, 1)} s</span></p>
                <p>燃料效率: <span class="position">${fuelEfficiency} %/s</span></p>
            </div>
            <div class="analysis-section">
                <h4>🎯 材料验证</h4>
                <p class="suggestion">所有材料参数匹配良好，配置合理。</p>
                <p class="suggestion">可以尝试调整材料挑战更高难度！</p>
            </div>
        `;
        
        elements.overlay.classList.remove('hidden');
    }

    // ========== 回放系统 ==========
    function saveReplayFrame() {
        if (game.state !== GameState.FLYING) return;
        
        game.replay.frames.push({
            frame: game.frameCount,
            capsule: { ...game.capsule },
            fuel: game.fuel.current,
            keys: { ...game.keys }
        });
    }

    function startReplay() {
        if (game.replay.frames.length === 0) {
            addLog('没有可回放的飞行记录', 'warning');
            return;
        }
        
        game.state = GameState.REPLAY;
        game.replay.currentFrame = 0;
        game.replay.playing = false;
        
        elements.replayTotal.textContent = game.replay.frames.length;
        elements.replayFrame.textContent = '0';
        elements.playPauseBtn.textContent = '播放';
        
        elements.replayOverlay.classList.remove('hidden');
        renderReplayFrame();
    }

    function stopReplay() {
        elements.replayOverlay.classList.add('hidden');
        resetGame();
    }

    function renderReplayFrame() {
        if (game.replay.currentFrame < 0 || game.replay.currentFrame >= game.replay.frames.length) {
            return;
        }
        
        const frame = game.replay.frames[game.replay.currentFrame];
        game.capsule = { ...frame.capsule };
        game.fuel.current = frame.fuel;
        game.frameCount = frame.frame;
        
        elements.replayFrame.textContent = game.replay.currentFrame;
        updateDisplay();
        render();
    }

    function replayStep(direction) {
        const newFrame = game.replay.currentFrame + direction;
        if (newFrame >= 0 && newFrame < game.replay.frames.length) {
            game.replay.currentFrame = newFrame;
            renderReplayFrame();
        }
    }

    function toggleReplayPlay() {
        game.replay.playing = !game.replay.playing;
        elements.playPauseBtn.textContent = game.replay.playing ? '暂停' : '播放';
        
        if (game.replay.playing) {
            playReplay();
        }
    }

    function playReplay() {
        if (!game.replay.playing || game.state !== GameState.REPLAY) return;
        
        if (game.replay.currentFrame < game.replay.frames.length - 1) {
            game.replay.currentFrame++;
            renderReplayFrame();
            setTimeout(playReplay, 1000 / 60);
        } else {
            game.replay.playing = false;
            elements.playPauseBtn.textContent = '播放';
        }
    }

    // ========== 渲染 ==========
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        drawBackground();
        drawGround();
        drawCraters();
        drawLandingZone();
        drawTrajectory();
        drawCapsule();
    }

    function drawBackground() {
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#0a0a20');
        gradient.addColorStop(0.5, '#151535');
        gradient.addColorStop(1, '#202040');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 100; i++) {
            const x = (i * 73) % canvas.width;
            const y = (i * 47) % (game.physics.groundY - 50);
            const size = (i % 3) * 0.5 + 0.5;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.fillStyle = '#444466';
        ctx.beginPath();
        ctx.arc(canvas.width - 100, 80, 40, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#666688';
        ctx.beginPath();
        ctx.arc(canvas.width - 110, 70, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(canvas.width - 90, 85, 8, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawGround() {
        const gradient = ctx.createLinearGradient(0, game.physics.groundY, 0, canvas.height);
        gradient.addColorStop(0, '#8b7355');
        gradient.addColorStop(0.3, '#6b5344');
        gradient.addColorStop(1, '#4a3728');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, game.physics.groundY, canvas.width, canvas.height - game.physics.groundY);
        
        ctx.strokeStyle = '#a08060';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, game.physics.groundY);
        
        for (let x = 0; x <= canvas.width; x += 20) {
            const noise = Math.sin(x * 0.05) * 2 + Math.sin(x * 0.13) * 1;
            ctx.lineTo(x, game.physics.groundY + noise);
        }
        ctx.stroke();
    }

    function drawCraters() {
        game.craters.forEach((crater, index) => {
            const gradient = ctx.createRadialGradient(
                crater.x, crater.y + crater.depth, 0,
                crater.x, crater.y, crater.radius
            );
            gradient.addColorStop(0, '#2a1a10');
            gradient.addColorStop(0.6, '#4a3728');
            gradient.addColorStop(1, '#6b5344');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.ellipse(crater.x, crater.y + crater.depth * 0.5, crater.radius, crater.depth, 0, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = '#8b7355';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(crater.x, crater.y, crater.radius, crater.depth * 0.3, 0, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.fillStyle = '#f44336';
            ctx.font = 'bold 12px Consolas';
            ctx.textAlign = 'center';
            ctx.fillText(`⚠${index + 1}`, crater.x, crater.y - crater.radius - 5);
        });
    }

    function drawLandingZone() {
        const lz = game.landingZone;
        
        ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
        ctx.fillRect(lz.x, game.physics.groundY - 5, lz.width, 10);
        
        ctx.fillStyle = '#4caf50';
        for (let i = 0; i < 5; i++) {
            const markX = lz.x + (lz.width / 4) * i;
            ctx.fillRect(markX - 2, game.physics.groundY - 15, 4, 15);
        }
        
        ctx.fillStyle = '#4caf50';
        ctx.font = 'bold 14px Consolas';
        ctx.textAlign = 'center';
        ctx.fillText('▼ 着陆区 ▼', lz.x + lz.width / 2, game.physics.groundY - 25);
        
        ctx.strokeStyle = '#4caf50';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(lz.x, game.physics.groundY - 40, lz.width, 45);
        ctx.setLineDash([]);
    }

    function drawTrajectory() {
        if (game.state !== GameState.FLYING && game.state !== GameState.REPLAY) return;
        if (game.replay.frames.length < 2 && game.state === GameState.FLYING) return;
        
        const frames = game.state === GameState.REPLAY 
            ? game.replay.frames.slice(0, game.replay.currentFrame + 1)
            : game.replay.frames;
        
        if (frames.length < 2) return;
        
        ctx.strokeStyle = 'rgba(79, 172, 254, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(frames[0].capsule.x, frames[0].capsule.y);
        
        for (let i = 1; i < frames.length; i += 3) {
            ctx.lineTo(frames[i].capsule.x, frames[i].capsule.y);
        }
        ctx.stroke();
        
        const predictSteps = 60;
        let px = game.capsule.x;
        let py = game.capsule.y;
        let pvx = game.capsule.vx;
        let pvy = game.capsule.vy;
        
        ctx.strokeStyle = 'rgba(255, 152, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(px, py);
        
        for (let i = 0; i < predictSteps; i++) {
            pvy += game.physics.gravity * (1/60);
            px += pvx;
            py += pvy;
            
            if (py > game.physics.groundY) break;
            ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function drawCapsule() {
        const capsule = game.capsule;
        
        ctx.save();
        ctx.translate(capsule.x, capsule.y);
        ctx.rotate((capsule.angle + 90) * Math.PI / 180);
        
        if (game.state === GameState.FLYING && game.keys.up && game.fuel.current > 0) {
            const flameGradient = ctx.createLinearGradient(0, capsule.height / 2, 0, capsule.height / 2 + 25);
            flameGradient.addColorStop(0, '#fff');
            flameGradient.addColorStop(0.3, '#ffc107');
            flameGradient.addColorStop(0.7, '#ff5722');
            flameGradient.addColorStop(1, 'rgba(255, 87, 34, 0)');
            
            ctx.fillStyle = flameGradient;
            ctx.beginPath();
            ctx.moveTo(-8, capsule.height / 2);
            ctx.lineTo(8, capsule.height / 2);
            ctx.lineTo(0, capsule.height / 2 + 20 + Math.random() * 10);
            ctx.closePath();
            ctx.fill();
        }
        
        if (game.state === GameState.FLYING && game.fuel.current > 0) {
            if (game.keys.left) {
                ctx.fillStyle = '#ff9800';
                ctx.beginPath();
                ctx.arc(capsule.width / 2 + 5, 0, 5, 0, Math.PI * 2);
                ctx.fill();
            }
            if (game.keys.right) {
                ctx.fillStyle = '#ff9800';
                ctx.beginPath();
                ctx.arc(-capsule.width / 2 - 5, 0, 5, 0, Math.PI * 2);
                ctx.fill();
            }
            if (game.keys.space) {
                ctx.fillStyle = '#2196f3';
                ctx.beginPath();
                ctx.arc(0, 0, 15, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        const bodyGradient = ctx.createLinearGradient(-capsule.width / 2, 0, capsule.width / 2, 0);
        bodyGradient.addColorStop(0, '#c0c0c0');
        bodyGradient.addColorStop(0.5, '#ffffff');
        bodyGradient.addColorStop(1, '#a0a0a0');
        
        ctx.fillStyle = bodyGradient;
        ctx.beginPath();
        ctx.moveTo(0, -capsule.height / 2);
        ctx.lineTo(capsule.width / 2, capsule.height / 2 - 5);
        ctx.lineTo(capsule.width / 3, capsule.height / 2);
        ctx.lineTo(-capsule.width / 3, capsule.height / 2);
        ctx.lineTo(-capsule.width / 2, capsule.height / 2 - 5);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.fillStyle = '#4facfe';
        ctx.beginPath();
        ctx.ellipse(0, -capsule.height / 4, capsule.width / 4, capsule.height / 6, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#f44336';
        ctx.fillRect(-capsule.width / 2 - 3, -5, 6, 15);
        ctx.fillRect(capsule.width / 2 - 3, -5, 6, 15);
        
        ctx.restore();
    }

    // ========== 显示更新 ==========
    function updateDisplay() {
        const speed = getSpeed();
        const altitude = getAltitude();
        
        elements.vxDisplay.textContent = `${formatNumber(game.capsule.vx)} m/s`;
        elements.vyDisplay.textContent = `${formatNumber(game.capsule.vy)} m/s`;
        elements.speedDisplay.textContent = `${formatNumber(speed)} m/s`;
        elements.altitudeDisplay.textContent = `${Math.round(altitude)} m`;
        
        const fuelPercent = (game.fuel.current / game.fuel.initial) * 100;
        elements.fuelBar.style.width = `${fuelPercent}%`;
        elements.fuelDisplay.textContent = `${formatNumber(fuelPercent)}%`;
        
        elements.fuelBar.classList.remove('warning', 'danger');
        if (fuelPercent < 20) {
            elements.fuelBar.classList.add('danger');
        } else if (fuelPercent < 50) {
            elements.fuelBar.classList.add('warning');
        }
        
        if (speed > game.physics.maxSafeSpeed * 1.5 && game.state === GameState.FLYING) {
            elements.speedDisplay.style.color = '#f44336';
        } else if (speed > game.physics.maxSafeSpeed) {
            elements.speedDisplay.style.color = '#ff9800';
        } else {
            elements.speedDisplay.style.color = '#fff';
        }
    }

    // ========== 游戏控制 ==========
    function resetGame() {
        game.state = GameState.STANDBY;
        game.frameCount = 0;
        game.fuelDepletionLogged = false;
        
        game.capsule.x = 80;
        game.capsule.y = 100;
        game.capsule.vx = 0;
        game.capsule.vy = 0;
        game.capsule.angle = 0;
        
        if (game.materials.processed.fuel) {
            game.fuel.initial = game.materials.processed.fuel.data.initialFuel;
        } else {
            game.fuel.initial = DEFAULT_CONFIG.fuel.initialFuel;
        }
        game.fuel.current = game.fuel.initial;
        
        if (game.materials.processed.capsule) {
            const cap = game.materials.processed.capsule.data;
            game.capsule.mass = cap.mass;
            game.capsule.maxThrust = cap.maxThrust;
            game.capsule.dragCoeff = cap.dragCoeff;
        }
        
        if (game.materials.processed.crater) {
            game.craters = game.materials.processed.crater.data.craters;
        }
        
        if (game.materials.processed.fuel) {
            game.landingZone = { ...game.materials.processed.fuel.data.landingZone };
        }
        
        game.keys = {
            up: false,
            left: false,
            right: false,
            space: false
        };
        
        game.replay = {
            frames: [],
            currentFrame: 0,
            playing: false
        };
        
        game.lastFailure = null;
        
        elements.overlay.classList.add('hidden');
        elements.flightLog.innerHTML = '<p class="log-entry info">系统就绪，等待发射...</p>';
        
        updateMissionStatus(GameState.STANDBY);
        updateDisplay();
        updateMaterialDisplay();
        render();
    }

    function startGame() {
        if (game.state !== GameState.STANDBY) return;
        
        game.startTime = Date.now();
        updateMissionStatus(GameState.FLYING);
        addLog('🚀 发射！补给舱开始滑翔', 'info');
    }

    // ========== 输入处理 ==========
    function handleKeyDown(e) {
        if (e.repeat) return;
        
        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                game.keys.up = true;
                if (game.state === GameState.STANDBY) {
                    startGame();
                }
                break;
            case 'ArrowLeft':
                e.preventDefault();
                game.keys.left = true;
                break;
            case 'ArrowRight':
                e.preventDefault();
                game.keys.right = true;
                break;
            case ' ':
                e.preventDefault();
                game.keys.space = true;
                break;
            case 'r':
            case 'R':
                resetGame();
                break;
            case 'p':
            case 'P':
                if (game.state === GameState.SUCCESS || game.state === GameState.FAILED) {
                    startReplay();
                }
                break;
        }
    }

    function handleKeyUp(e) {
        switch (e.key) {
            case 'ArrowUp':
                game.keys.up = false;
                break;
            case 'ArrowLeft':
                game.keys.left = false;
                break;
            case 'ArrowRight':
                game.keys.right = false;
                break;
            case ' ':
                game.keys.space = false;
                break;
        }
    }

    // ========== 游戏循环 ==========
    let lastTime = 0;
    
    function gameLoop(timestamp) {
        const dt = Math.min((timestamp - lastTime) / 1000, 1/30);
        lastTime = timestamp;
        
        if (game.state === GameState.FLYING) {
            game.frameCount++;
            updatePhysics(dt);
            saveReplayFrame();
            updateDisplay();
        }
        
        if (game.state !== GameState.REPLAY) {
            render();
        }
        
        requestAnimationFrame(gameLoop);
    }

    // ========== 事件绑定 ==========
    function bindEvents() {
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        
        elements.retryBtn.addEventListener('click', resetGame);
        elements.replayBtn.addEventListener('click', () => {
            elements.overlay.classList.add('hidden');
            startReplay();
        });
        
        elements.playPauseBtn.addEventListener('click', toggleReplayPlay);
        elements.stepBackBtn.addEventListener('click', () => replayStep(-5));
        elements.stepFwdBtn.addEventListener('click', () => replayStep(5));
        elements.closeReplayBtn.addEventListener('click', stopReplay);
        
        elements.defaultConfigBtn.addEventListener('click', loadDefaultConfig);
        
        elements.showHelpBtn.addEventListener('click', () => {
            elements.helpModal.classList.remove('hidden');
        });
        elements.closeHelpBtn.addEventListener('click', () => {
            elements.helpModal.classList.add('hidden');
        });
        elements.helpModal.addEventListener('click', (e) => {
            if (e.target === elements.helpModal) {
                elements.helpModal.classList.add('hidden');
            }
        });
        
        elements.capsuleImport.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                handleFileImport(e.target.files[0], 'capsule');
            }
        });
        
        elements.craterImport.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                handleFileImport(e.target.files[0], 'crater');
            }
        });
        
        elements.fuelImport.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                handleFileImport(e.target.files[0], 'fuel');
            }
        });
    }

    // ========== 初始化 ==========
    function init() {
        bindEvents();
        loadDefaultConfig();
        requestAnimationFrame(gameLoop);
        addLog('按 ↑ 键发射补给舱，开始任务！', 'info');
    }

    // 启动游戏
    init();

})();
