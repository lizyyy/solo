const Game = (function() {
    'use strict';

    const levels = {
        1: {
            id: 1,
            name: '新手金库',
            contractName: 'VulnerableVault.sol',
            description: '一个简单的存款合约，存在经典的重入漏洞',
            risks: ['reentrancy'],
            initialBalances: {
                user: 100,
                contract: 500,
                attacker: 0
            },
            permissions: {
                owner: true,
                transfer: true,
                selfdestruct: false
            },
            objectives: [
                { id: 'obj1', text: '识别重入风险', completed: false, type: 'reentrancy' },
                { id: 'obj4', text: '成功阻止攻击', completed: false, type: 'defense' }
            ],
            code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

contract VulnerableVault {
    mapping(address => uint256) public balances;
    
    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }
    
    function withdraw(uint256 _amount) public {
        require(balances[msg.sender] >= _amount, "Insufficient balance");
        
        (bool success, ) = msg.sender.call{value: _amount}("");
        require(success, "Transfer failed");
        
        balances[msg.sender] -= _amount;
    }
    
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
}`,
            riskLines: {
                reentrancy: [12, 13, 14, 15, 16]
            },
            attackScenario: {
                type: 'reentrancy',
                steps: [
                    { action: '攻击者存入 1 ETH', balanceChange: { user: -1, contract: 1, attacker: 0 } },
                    { action: '攻击者调用 withdraw(1 ETH)', balanceChange: { user: 0, contract: -1, attacker: 1 } },
                    { action: 'fallback函数触发重入', balanceChange: { user: 0, contract: -1, attacker: 1 } },
                    { action: '再次调用 withdraw(1 ETH)', balanceChange: { user: 0, contract: -1, attacker: 1 } },
                    { action: '重复执行...', balanceChange: { user: 0, contract: -497, attacker: 497 } }
                ]
            },
            defense: {
                type: 'checks-effects-interactions',
                description: '使用 Checks-Effects-Interactions 模式，在转账前更新余额',
                fixedCode: `function withdraw(uint256 _amount) public {
    require(balances[msg.sender] >= _amount, "Insufficient balance");
    
    balances[msg.sender] -= _amount;
    
    (bool success, ) = msg.sender.call{value: _amount}("");
    require(success, "Transfer failed");
}`
            },
            hints: [
                '注意查看 withdraw 函数中转账和余额更新的顺序',
                '在 Solidity 中，外部调用可能触发未知代码执行',
                '遵循 Checks-Effects-Interactions 模式可以防止重入'
            ]
        },
        2: {
            id: 2,
            name: '授权交易所',
            contractName: 'BadExchange.sol',
            description: '一个存在授权问题的代币交易所',
            risks: ['authorization'],
            initialBalances: {
                user: 500,
                contract: 1000,
                attacker: 0
            },
            permissions: {
                owner: true,
                transfer: true,
                selfdestruct: false
            },
            objectives: [
                { id: 'obj2', text: '识别授权风险', completed: false, type: 'authorization' },
                { id: 'obj4', text: '成功阻止攻击', completed: false, type: 'defense' }
            ],
            code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract BadExchange {
    address public owner;
    mapping(address => uint256) public balances;
    mapping(address => mapping(address => uint256)) public allowed;
    
    constructor() {
        owner = msg.sender;
    }
    
    function approve(address _spender, uint256 _amount) public {
        allowed[msg.sender][_spender] = _amount;
    }
    
    function transferFrom(address _from, address _to, uint256 _amount) public {
        require(allowed[_from][msg.sender] >= _amount);
        
        balances[_from] -= _amount;
        balances[_to] += _amount;
        allowed[_from][msg.sender] -= _amount;
    }
    
    function emergencyWithdraw() public {
        payable(owner).transfer(address(this).balance);
    }
    
    function setOwner(address _newOwner) public {
        owner = _newOwner;
    }
}`,
            riskLines: {
                authorization: [26, 27, 28, 29, 30]
            },
            attackScenario: {
                type: 'authorization',
                steps: [
                    { action: '攻击者调用 setOwner()', balanceChange: { user: 0, contract: 0, attacker: 0 } },
                    { action: '攻击者成为新 owner', balanceChange: { user: 0, contract: 0, attacker: 0 } },
                    { action: '攻击者调用 emergencyWithdraw()', balanceChange: { user: 0, contract: -1000, attacker: 1000 } }
                ]
            },
            defense: {
                type: 'access-control',
                description: '添加 onlyOwner 修饰符到敏感函数',
                fixedCode: `modifier onlyOwner() {
    require(msg.sender == owner, "Not owner");
    _;
}

function emergencyWithdraw() public onlyOwner {
    payable(owner).transfer(address(this).balance);
}

function setOwner(address _newOwner) public onlyOwner {
    owner = _newOwner;
}`
            },
            hints: [
                '查看哪些函数可以修改合约的关键状态',
                'setOwner 函数缺少访问控制检查',
                '使用 modifier 可以统一管理权限控制'
            ]
        },
        3: {
            id: 3,
            name: 'DeFi协议',
            contractName: 'RiskyDeFi.sol',
            description: '一个综合DeFi协议，包含多种安全漏洞',
            risks: ['reentrancy', 'authorization', 'overflow'],
            initialBalances: {
                user: 1000,
                contract: 5000,
                attacker: 0
            },
            permissions: {
                owner: true,
                transfer: true,
                selfdestruct: false
            },
            objectives: [
                { id: 'obj1', text: '识别重入风险', completed: false, type: 'reentrancy' },
                { id: 'obj2', text: '识别授权风险', completed: false, type: 'authorization' },
                { id: 'obj3', text: '识别溢出风险', completed: false, type: 'overflow' },
                { id: 'obj4', text: '成功阻止攻击', completed: false, type: 'defense' }
            ],
            code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

contract RiskyDeFi {
    address public owner;
    mapping(address => uint256) public balances;
    uint256 public totalSupply;
    uint256 public rewardRate = 100;
    
    constructor() public {
        owner = msg.sender;
        totalSupply = 0;
    }
    
    function deposit() public payable {
        balances[msg.sender] += msg.value;
        totalSupply += msg.value;
    }
    
    function withdraw(uint256 _amount) public {
        require(balances[msg.sender] >= _amount);
        
        (bool success, ) = msg.sender.call{value: _amount}("");
        require(success);
        
        balances[msg.sender] -= _amount;
        totalSupply -= _amount;
    }
    
    function calculateReward(address _user) public view returns (uint256) {
        return balances[_user] * rewardRate / 100;
    }
    
    function transfer(address _to, uint256 _amount) public {
        uint256 oldFrom = balances[msg.sender];
        uint256 oldTo = balances[_to];
        
        balances[msg.sender] -= _amount;
        balances[_to] += _amount;
        
        assert(balances[msg.sender] + balances[_to] == oldFrom + oldTo);
    }
    
    function emergencyStop() public {
        selfdestruct(payable(owner));
    }
}`,
            riskLines: {
                reentrancy: [20, 21, 22, 23, 24, 25, 26],
                authorization: [42, 43, 44],
                overflow: [33]
            },
            attackScenario: {
                type: 'reentrancy',
                steps: [
                    { action: '攻击者存入 100 ETH', balanceChange: { user: -100, contract: 100, attacker: 0 } },
                    { action: '检测到 withdraw 函数重入漏洞', balanceChange: { user: 0, contract: 0, attacker: 0 } },
                    { action: '攻击者执行重入攻击', balanceChange: { user: 0, contract: -5000, attacker: 5000 } },
                    { action: '利用溢出绕过余额检查', balanceChange: { user: 0, contract: 0, attacker: 100 } },
                    { action: '调用 emergencyStop 销毁合约', balanceChange: { user: 0, contract: 0, attacker: 0 } }
                ]
            },
            defense: {
                type: 'comprehensive',
                description: '综合修复：CEI模式 + 访问控制 + SafeMath',
                fixedCode: `// 使用 SafeMath 防止溢出
using SafeMath for uint256;

// 重入防护
bool internal _notEntered = true;
modifier nonReentrant() {
    require(_notEntered);
    _notEntered = false;
    _;
    _notEntered = true;
}

function withdraw(uint256 _amount) public nonReentrant {
    require(balances[msg.sender] >= _amount);
    
    // Checks-Effects-Interactions
    balances[msg.sender] = balances[msg.sender].sub(_amount);
    totalSupply = totalSupply.sub(_amount);
    
    (bool success, ) = msg.sender.call{value: _amount}("");
    require(success);
}

function emergencyStop() public onlyOwner {
    selfdestruct(payable(owner));
}`
            },
            hints: [
                '这个合约有多个漏洞，仔细检查每个函数',
                'Solidity 0.6.0 没有内置的溢出检查',
                'selfdestruct 可以销毁合约并转移所有资金',
                '使用重入防护锁可以防止重入攻击'
            ]
        }
    };

    const demoData = {
        smooth: {
            name: '顺利流程演示',
            levelId: 1,
            actions: [
                { type: 'markRisk', riskType: 'reentrancy', expected: true },
                { type: 'selectAttack', attackType: 'reentrancy', expected: true },
                { type: 'defend', expected: true },
                { type: 'complete', expected: true }
            ]
        },
        boundary: {
            name: '边界情况演示',
            levelId: 2,
            actions: [
                { type: 'markRisk', riskType: 'reentrancy', expected: false, reason: '此关卡不存在重入风险' },
                { type: 'markRisk', riskType: 'authorization', expected: true },
                { type: 'markRisk', riskType: 'overflow', expected: false, reason: '此关卡使用 Solidity 0.8+，内置溢出检查' },
                { type: 'selectAttack', attackType: 'authorization', expected: true },
                { type: 'defend', expected: true }
            ]
        },
        exception: {
            name: '例外情况演示',
            levelId: 3,
            actions: [
                { type: 'markRisk', riskType: 'reentrancy', expected: true },
                { type: 'markRisk', riskType: 'authorization', expected: true },
                { type: 'executeAttack', attackType: 'reentrancy', expected: true, result: 'attack_success' },
                { type: 'rollback', expected: true },
                { type: 'markRisk', riskType: 'overflow', expected: true },
                { type: 'selectAttack', attackType: 'overflow', expected: true },
                { type: 'defend', expected: false, reason: '权限漏洞未修复，防御不完整' }
            ]
        }
    };

    let state = {
        currentLevel: 1,
        gameStatus: 'playing',
        selectedAttack: null,
        markedRisks: [],
        balances: { user: 100, contract: 500, attacker: 0 },
        permissions: {},
        objectives: [],
        scores: {
            total: 0,
            risk: 0,
            defense: 0,
            time: 0
        },
        levelProgress: {
            1: { completed: false, score: 0, errors: [] },
            2: { completed: false, score: 0, errors: [] },
            3: { completed: false, score: 0, errors: [] }
        },
        auditLog: [],
        attackHistory: [],
        replayData: [],
        startTime: Date.now(),
        currentHintIndex: 0,
        processingBatch: false,
        batchErrors: []
    };

    function init() {
        loadLevel(1);
        addLog('系统', '欢迎来到合约审计闯关室！你的任务是找出合约中的安全漏洞。', 'info');
        addLog('提示', '选择攻击卡片可以模拟攻击，部署防御可以修复漏洞。', 'info');
    }

    function loadLevel(levelId) {
        try {
            const level = levels[levelId];
            if (!level) {
                throw new Error(`关卡 ${levelId} 不存在`);
            }

            state.currentLevel = levelId;
            state.selectedAttack = null;
            state.markedRisks = [];
            state.balances = { ...level.initialBalances };
            state.permissions = { ...level.permissions };
            state.objectives = level.objectives.map(obj => ({ ...obj }));
            state.currentHintIndex = 0;
            state.replayData = [];

            updateLevelUI();
            updateBalancesUI();
            updatePermissionsUI();
            updateCodeUI();
            updateObjectivesUI();
            updateAttackCardsUI();
            updateScoreUI();
            updateLevelBadge();

            addLog('系统', `已加载关卡 ${levelId}: ${level.name}`, 'info');
            addLog('合约', `${level.contractName} - ${level.description}`, 'info');

        } catch (error) {
            handleError('loadLevel', error, { levelId });
            showToast('关卡加载失败: ' + error.message, 'error');
        }
    }

    function pauseGame() {
        if (state.gameStatus !== 'playing') return;
        
        state.gameStatus = 'paused';
        document.getElementById('pauseModal').classList.remove('hidden');
        document.getElementById('statusText').textContent = '游戏已暂停';
        document.querySelector('.status-dot').className = 'status-dot status-paused';
        document.getElementById('pauseBtn').textContent = '▶️ 继续';
        document.getElementById('pauseBtn').onclick = resumeGame;
        
        addLog('系统', '游戏已暂停，进度已保存', 'warning');
    }

    function resumeGame() {
        if (state.gameStatus !== 'paused') return;
        
        state.gameStatus = 'playing';
        document.getElementById('pauseModal').classList.add('hidden');
        document.getElementById('statusText').textContent = '游戏进行中';
        document.querySelector('.status-dot').className = 'status-dot status-active';
        document.getElementById('pauseBtn').textContent = '⏸ 暂停';
        document.getElementById('pauseBtn').onclick = pauseGame;
        
        addLog('系统', '游戏继续进行', 'success');
    }

    function restartLevel() {
        loadLevel(state.currentLevel);
        addLog('系统', '关卡已重置', 'info');
    }

    function restartGame() {
        state.levelProgress = {
            1: { completed: false, score: 0, errors: [] },
            2: { completed: false, score: 0, errors: [] },
            3: { completed: false, score: 0, errors: [] }
        };
        state.scores = { total: 0, risk: 0, defense: 0, time: 0 };
        state.startTime = Date.now();
        state.auditLog = [];
        state.attackHistory = [];
        
        document.getElementById('pauseModal').classList.add('hidden');
        loadLevel(1);
        updateLevelSelectorUI();
        addLog('系统', '游戏已重新开始', 'info');
    }

    function markRisk(riskType) {
        try {
            const level = levels[state.currentLevel];
            const isCorrectRisk = level.risks.includes(riskType);
            const alreadyMarked = state.markedRisks.includes(riskType);

            if (alreadyMarked) {
                state.markedRisks = state.markedRisks.filter(r => r !== riskType);
                showToast(`已取消标记 ${getRiskName(riskType)}`, 'warning');
                addLog('操作', `取消标记风险: ${getRiskName(riskType)}`, 'info');
            } else {
                state.markedRisks.push(riskType);
                
                if (isCorrectRisk) {
                    state.scores.risk += 100;
                    state.scores.total += 100;
                    showToast(`✓ 正确识别了 ${getRiskName(riskType)} 风险！+100分`, 'success');
                    addLog('发现', `正确识别风险: ${getRiskName(riskType)} (+100分)`, 'success');
                    
                    const objective = state.objectives.find(o => o.type === riskType);
                    if (objective) {
                        objective.completed = true;
                    }
                } else {
                    state.levelProgress[state.currentLevel].errors.push({
                        type: 'false_positive',
                        riskType: riskType,
                        message: `误判风险: ${getRiskName(riskType)} 在此合约中不存在`
                    });
                    showToast(`⚠ ${getRiskName(riskType)} 在此合约中不存在`, 'warning');
                    addLog('错误', `误判风险: ${getRiskName(riskType)} 不存在于此合约`, 'warning');
                }
            }

            updateRiskMarkersUI();
            updateCodeUI();
            updateObjectivesUI();
            updateScoreUI();
            checkAttackButtonState();

        } catch (error) {
            handleError('markRisk', error, { riskType });
        }
    }

    function selectAttack(attackType) {
        try {
            state.selectedAttack = attackType;
            updateAttackCardsUI();
            checkAttackButtonState();
            
            const attackNames = {
                reentrancy: '重入攻击',
                authorization: '权限绕过',
                overflow: '整数溢出'
            };
            
            addLog('选择', `准备攻击类型: ${attackNames[attackType]}`, 'info');
            
        } catch (error) {
            handleError('selectAttack', error, { attackType });
        }
    }

    function executeAttack() {
        if (!state.selectedAttack) return;

        try {
            const level = levels[state.currentLevel];
            const attackScenario = level.attackScenario;
            
            if (!attackScenario || attackScenario.type !== state.selectedAttack) {
                showToast('此攻击类型不适用于当前关卡', 'warning');
                return;
            }

            document.getElementById('attackPhase').textContent = '攻击阶段: 执行中...';
            
            state.replayData = [];
            let currentBalances = { ...state.balances };
            
            for (let i = 0; i < attackScenario.steps.length; i++) {
                const step = attackScenario.steps[i];
                const newBalances = {
                    user: currentBalances.user + (step.balanceChange.user || 0),
                    contract: currentBalances.contract + (step.balanceChange.contract || 0),
                    attacker: currentBalances.attacker + (step.balanceChange.attacker || 0)
                };
                
                state.replayData.push({
                    step: i + 1,
                    action: step.action,
                    beforeBalances: { ...currentBalances },
                    afterBalances: { ...newBalances },
                    change: step.balanceChange
                });
                
                currentBalances = newBalances;
            }

            state.balances = { ...currentBalances };
            state.attackHistory.push({
                levelId: state.currentLevel,
                attackType: state.selectedAttack,
                success: true,
                replayData: [...state.replayData],
                timestamp: Date.now()
            });

            updateBalancesUI();
            
            showToast(`💥 攻击成功！合约损失了 ${level.initialBalances.contract - currentBalances.contract} ETH`, 'error');
            addLog('攻击', `${getRiskName(state.selectedAttack)}攻击成功！合约被窃取 ${level.initialBalances.contract - currentBalances.contract} ETH`, 'error');
            
            document.getElementById('attackPhase').textContent = '攻击阶段: 攻击成功';

            const defenseObjective = state.objectives.find(o => o.type === 'defense');
            if (defenseObjective) {
                defenseObjective.completed = false;
            }

            state.levelProgress[state.currentLevel].errors.push({
                type: 'attack_success',
                attackType: state.selectedAttack,
                message: `攻击成功: ${getRiskName(state.selectedAttack)}漏洞被利用，损失 ${level.initialBalances.contract - currentBalances.contract} ETH`
            });

            updateObjectivesUI();
            
            setTimeout(() => {
                showReplay();
            }, 500);

        } catch (error) {
            handleError('executeAttack', error, { attackType: state.selectedAttack });
            document.getElementById('attackPhase').textContent = '攻击阶段: 准备中';
        }
    }

    function defend() {
        if (!state.selectedAttack) return;

        try {
            const level = levels[state.currentLevel];
            const defense = level.defense;
            
            const allRisksIdentified = level.risks.every(risk => state.markedRisks.includes(risk));
            
            if (!allRisksIdentified) {
                const missingRisks = level.risks.filter(risk => !state.markedRisks.includes(risk));
                state.levelProgress[state.currentLevel].errors.push({
                    type: 'incomplete_defense',
                    missingRisks: missingRisks,
                    message: `防御不完整，未识别的风险: ${missingRisks.map(r => getRiskName(r)).join(', ')}`
                });
                
                showToast(`⚠ 还有风险未识别: ${missingRisks.map(r => getRiskName(r)).join(', ')}`, 'warning');
                addLog('防御', `防御失败，还有 ${missingRisks.length} 个风险未识别`, 'warning');
                return;
            }

            state.balances = { ...level.initialBalances };
            state.scores.defense += 200;
            state.scores.total += 200;

            const timeBonus = Math.max(0, 100 - Math.floor((Date.now() - state.startTime) / 10000));
            state.scores.time += timeBonus;
            state.scores.total += timeBonus;

            const defenseObjective = state.objectives.find(o => o.type === 'defense');
            if (defenseObjective) {
                defenseObjective.completed = true;
            }

            state.levelProgress[state.currentLevel].completed = true;
            state.levelProgress[state.currentLevel].score = state.scores.total;

            updateBalancesUI();
            updateScoreUI();
            updateObjectivesUI();
            updateLevelSelectorUI();

            showToast(`🛡️ 防御成功！+200分，时间奖励 +${timeBonus}分`, 'success');
            addLog('防御', `成功部署 ${defense.type} 防御，余额已恢复`, 'success');
            addLog('系统', `关卡 ${state.currentLevel} 完成！总分: ${state.scores.total}`, 'success');

            document.getElementById('attackPhase').textContent = '攻击阶段: 已防御';

            if (state.currentLevel < 3) {
                setTimeout(() => {
                    showToast('💡 可以选择下一关继续挑战', 'info');
                }, 1500);
            } else {
                setTimeout(() => {
                    showReport();
                }, 1000);
            }

        } catch (error) {
            handleError('defend', error, {});
        }
    }

    function showHint() {
        const level = levels[state.currentLevel];
        const hints = level.hints;
        
        if (state.currentHintIndex < hints.length) {
            const hint = hints[state.currentHintIndex];
            showToast(`💡 提示 ${state.currentHintIndex + 1}/${hints.length}: ${hint}`, 'info');
            addLog('提示', hint, 'info');
            state.currentHintIndex++;
        } else {
            showToast('已经没有更多提示了', 'warning');
        }
    }

    function showReplay() {
        const modal = document.getElementById('replayModal');
        const content = document.getElementById('replayContent');
        
        if (state.replayData.length === 0) {
            content.innerHTML = '<p style="color: var(--text-secondary);">暂无回放数据</p>';
            modal.classList.remove('hidden');
            return;
        }

        let html = '';
        state.replayData.forEach((step, index) => {
            const isLast = index === state.replayData.length - 1;
            html += `
                <div class="replay-step ${isLast ? 'active' : ''}">
                    <div class="replay-step-header">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span class="step-number">${step.step}</span>
                            <span class="step-action">${step.action}</span>
                        </div>
                        <span class="step-balance">
                            合约: ${step.afterBalances.contract} ETH | 
                            攻击者: ${step.afterBalances.attacker} ETH
                        </span>
                    </div>
                    <div class="step-description">
                        <strong>余额变化:</strong> 
                        用户 ${formatChange(step.change.user)} | 
                        合约 ${formatChange(step.change.contract)} | 
                        攻击者 ${formatChange(step.change.attacker)}
                    </div>
                </div>
            `;
        });

        const level = levels[state.currentLevel];
        html += `
            <div class="report-section" style="margin-top: 20px;">
                <h3>🔧 修复方案</h3>
                <p style="color: var(--text-secondary); margin-bottom: 12px;">${level.defense.description}</p>
                <pre style="background: var(--bg-primary); padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 12px; color: var(--text-secondary);">${level.defense.fixedCode}</pre>
            </div>
        `;

        content.innerHTML = html;
        modal.classList.remove('hidden');
    }

    function closeReplay() {
        document.getElementById('replayModal').classList.add('hidden');
    }

    function showReport() {
        const modal = document.getElementById('reportModal');
        const content = document.getElementById('reportContent');
        
        let html = '';
        
        html += `
            <div class="report-section">
                <h3>📊 总体评分</h3>
                <div class="report-summary">
                    <div class="summary-card">
                        <div class="label">总分</div>
                        <div class="value">${state.scores.total}</div>
                    </div>
                    <div class="summary-card">
                        <div class="label">风险识别</div>
                        <div class="value">${state.scores.risk}</div>
                    </div>
                    <div class="summary-card">
                        <div class="label">防御得分</div>
                        <div class="value">${state.scores.defense}</div>
                    </div>
                </div>
            </div>
        `;

        html += `<div class="report-section"><h3>🎮 关卡进度</h3>`;
        for (let i = 1; i <= 3; i++) {
            const progress = state.levelProgress[i];
            const level = levels[i];
            const statusClass = progress.completed ? 'resolved' : '';
            const statusText = progress.completed ? '✓ 已完成' : '○ 未完成';
            
            html += `
                <div class="risk-finding ${statusClass}">
                    <div class="finding-header">
                        <span class="finding-title">关卡 ${i}: ${level.name}</span>
                        <span class="finding-severity ${progress.completed ? 'severity-high' : ''}">
                            ${statusText} | ${progress.score}分
                        </span>
                    </div>
                    <div class="finding-description">
                        目标风险: ${level.risks.map(r => getRiskName(r)).join(', ')}
                    </div>
            `;
            
            if (progress.errors.length > 0) {
                progress.errors.forEach(error => {
                    html += `
                        <div class="error-analysis">
                            <div class="error-type">${getErrorTypeName(error.type)}</div>
                            <div class="error-details">${error.message}</div>
                        </div>
                    `;
                });
            }
            
            html += `</div>`;
        }
        html += `</div>`;

        html += `<div class="report-section"><h3>🔍 风险判定分析</h3>`;
        if (state.attackHistory.length > 0) {
            state.attackHistory.forEach((attack, index) => {
                const level = levels[attack.levelId];
                html += `
                    <div class="risk-finding medium">
                        <div class="finding-header">
                            <span class="finding-title">攻击 #${index + 1}: ${getRiskName(attack.attackType)}</span>
                            <span class="finding-severity severity-medium">
                                ${attack.success ? '攻击成功' : '攻击失败'}
                            </span>
                        </div>
                        <div class="finding-description">
                            关卡: ${level.name} | 
                            时间: ${new Date(attack.timestamp).toLocaleString()}
                        </div>
                        <button class="btn btn-small" style="margin-top: 8px;" onclick="Game.showReplayFromHistory(${index})">
                            🎬 查看回放
                        </button>
                    </div>
                `;
            });
        } else {
            html += '<p style="color: var(--text-secondary);">暂无攻击记录</p>';
        }
        html += `</div>`;

        html += `<div class="report-section"><h3>📝 审计日志摘要</h3>`;
        const recentLogs = state.auditLog.slice(-20);
        recentLogs.forEach(log => {
            html += `
                <div style="padding: 8px 0; border-bottom: 1px solid var(--border-color); font-size: 13px;">
                    <span style="color: var(--text-muted);">[${log.time}]</span>
                    <span style="margin-left: 8px;">${log.message}</span>
                </div>
            `;
        });
        html += `</div>`;

        const allErrors = [];
        for (let i = 1; i <= 3; i++) {
            state.levelProgress[i].errors.forEach(err => {
                allErrors.push({ level: i, ...err });
            });
        }

        if (allErrors.length > 0) {
            html += `<div class="report-section"><h3>❌ 错因分析与学习建议</h3>`;
            
            const errorTypes = {};
            allErrors.forEach(err => {
                if (!errorTypes[err.type]) {
                    errorTypes[err.type] = [];
                }
                errorTypes[err.type].push(err);
            });

            for (const [errorType, errors] of Object.entries(errorTypes)) {
                html += `
                    <div class="risk-finding">
                        <div class="finding-header">
                            <span class="finding-title">${getErrorTypeName(errorType)}</span>
                            <span class="finding-severity severity-high">
                                ${errors.length} 次
                            </span>
                        </div>
                        <div class="finding-description">
                            ${getLearningAdvice(errorType)}
                        </div>
                    </div>
                `;
            }
            html += `</div>`;
        }

        content.innerHTML = html;
        modal.classList.remove('hidden');
    }

    function showReplayFromHistory(index) {
        if (state.attackHistory[index]) {
            state.replayData = state.attackHistory[index].replayData;
            closeReport();
            showReplay();
        }
    }

    function closeReport() {
        document.getElementById('reportModal').classList.add('hidden');
    }

    function exportReport() {
        const report = generateReportData();
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-report-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        showToast('✅ 报告已导出', 'success');
        addLog('系统', '审计报告已导出为 JSON 文件', 'success');
    }

    function generateReportData() {
        return {
            generatedAt: new Date().toISOString(),
            totalScore: state.scores.total,
            scoreBreakdown: { ...state.scores },
            timeSpent: Math.floor((Date.now() - state.startTime) / 1000) + '秒',
            levelProgress: JSON.parse(JSON.stringify(state.levelProgress)),
            attackHistory: JSON.parse(JSON.stringify(state.attackHistory)),
            markedRisks: [...state.markedRisks],
            errorAnalysis: analyzeErrors()
        };
    }

    function analyzeErrors() {
        const errors = [];
        for (let i = 1; i <= 3; i++) {
            state.levelProgress[i].errors.forEach(err => {
                errors.push({
                    level: i,
                    levelName: levels[i].name,
                    ...err,
                    advice: getLearningAdvice(err.type)
                });
            });
        }
        return errors;
    }

    function runDemo(demoType) {
        const demo = demoData[demoType];
        if (!demo) return;

        state.processingBatch = true;
        state.batchErrors = [];
        
        addLog('演示', `开始执行「${demo.name}」`, 'info');
        loadLevel(demo.levelId);

        processDemoActions(demo.actions, 0);
    }

    function processDemoActions(actions, index) {
        if (index >= actions.length) {
            state.processingBatch = false;
            
            if (state.batchErrors.length > 0) {
                addLog('演示', `演示完成，有 ${state.batchErrors.length} 个问题`, 'warning');
                state.batchErrors.forEach(err => {
                    addLog('问题', err, 'warning');
                });
            } else {
                addLog('演示', '演示流程顺利完成', 'success');
            }
            
            showToast(`「${demoData[actions[0]?.demoType || 'smooth'].name}」演示完成`, 'success');
            return;
        }

        const action = actions[index];
        
        try {
            switch (action.type) {
                case 'markRisk':
                    markRisk(action.riskType);
                    if (action.expected === false && action.reason) {
                        state.batchErrors.push(`动作 ${index + 1}: ${action.reason}`);
                    }
                    break;
                    
                case 'selectAttack':
                    selectAttack(action.attackType);
                    break;
                    
                case 'executeAttack':
                    executeAttack();
                    break;
                    
                case 'defend':
                    defend();
                    if (action.expected === false && action.reason) {
                        state.batchErrors.push(`动作 ${index + 1}: ${action.reason}`);
                    }
                    break;
                    
                case 'rollback':
                    state.balances = { ...levels[state.currentLevel].initialBalances };
                    updateBalancesUI();
                    addLog('回滚', '余额已回滚到初始状态', 'info');
                    showToast('🔄 余额已回滚', 'info');
                    break;
                    
                case 'complete':
                    addLog('完成', '关卡顺利完成', 'success');
                    break;
            }
        } catch (error) {
            state.batchErrors.push(`动作 ${index + 1} 异常: ${error.message}`);
            addLog('异常', `动作 ${index + 1}: ${error.message}，继续执行后续任务`, 'error');
        }

        setTimeout(() => {
            processDemoActions(actions, index + 1);
        }, 1200);
    }

    function handleError(context, error, details) {
        console.error(`[Game Error] ${context}:`, error, details);
        
        const errorLog = {
            context,
            message: error.message,
            details,
            timestamp: Date.now()
        };
        
        state.levelProgress[state.currentLevel].errors.push({
            type: 'system_error',
            message: `[${context}] ${error.message}`,
            details: JSON.stringify(details)
        });

        if (!state.processingBatch) {
            addLog('错误', `系统错误: ${error.message}`, 'error');
        }
    }

    function getRiskName(riskType) {
        const names = {
            reentrancy: '重入',
            authorization: '授权',
            overflow: '溢出'
        };
        return names[riskType] || riskType;
    }

    function getErrorTypeName(errorType) {
        const names = {
            false_positive: '误判风险',
            attack_success: '攻击成功',
            incomplete_defense: '防御不完整',
            system_error: '系统错误'
        };
        return names[errorType] || errorType;
    }

    function getLearningAdvice(errorType) {
        const advice = {
            false_positive: '建议：仔细分析合约代码，区分真实漏洞和误报。注意每个漏洞的特征和适用场景。',
            attack_success: '建议：深入理解攻击原理，在编写合约时遵循安全最佳实践。使用 Checks-Effects-Interactions 模式。',
            incomplete_defense: '建议：系统性地审计合约，不要遗漏任何潜在风险。建立完整的风险检查清单。',
            system_error: '建议：刷新页面重试，如果问题持续请联系技术支持。'
        };
        return advice[errorType] || '继续学习，加强练习。';
    }

    function formatChange(value) {
        if (value > 0) return `+${value}`;
        return value.toString();
    }

    function addLog(tag, message, type = 'info') {
        const time = new Date().toLocaleTimeString();
        const logEntry = { time, tag, message, type };
        state.auditLog.push(logEntry);
        
        const logContainer = document.getElementById('auditLog');
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        entry.innerHTML = `
            <span class="log-time">[${tag}]</span>
            <span class="log-message">${message}</span>
        `;
        logContainer.appendChild(entry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    function showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 4000);
    }

    function updateLevelUI() {
        document.querySelectorAll('.level-item').forEach(item => {
            const levelId = parseInt(item.dataset.level);
            item.classList.toggle('active', levelId === state.currentLevel);
            
            const statusEl = document.getElementById(`level${levelId}Status`);
            if (statusEl) {
                if (state.levelProgress[levelId].completed) {
                    statusEl.className = 'level-status completed';
                } else if (levelId === state.currentLevel) {
                    statusEl.className = 'level-status current';
                } else {
                    statusEl.className = 'level-status locked';
                }
            }
        });
    }

    function updateLevelBadge() {
        document.getElementById('levelBadge').textContent = `关卡 ${state.currentLevel}/3`;
    }

    function updateBalancesUI() {
        document.getElementById('userBalance').textContent = `${state.balances.user} ETH`;
        document.getElementById('contractBalance').textContent = `${state.balances.contract} ETH`;
        document.getElementById('attackerBalance').textContent = `${state.balances.attacker} ETH`;
    }

    function updatePermissionsUI() {
        const permList = document.getElementById('permissionList');
        permList.innerHTML = `
            <div class="permission-item">
                <span>owner 权限</span>
                <span class="perm-status ${state.permissions.owner ? 'perm-granted' : 'perm-denied'}">
                    ${state.permissions.owner ? '✓ 已授权' : '✗ 未授权'}
                </span>
            </div>
            <div class="permission-item">
                <span>transfer 权限</span>
                <span class="perm-status ${state.permissions.transfer ? 'perm-granted' : 'perm-denied'}">
                    ${state.permissions.transfer ? '✓ 已授权' : '✗ 未授权'}
                </span>
            </div>
            <div class="permission-item">
                <span>selfdestruct 权限</span>
                <span class="perm-status ${state.permissions.selfdestruct ? 'perm-granted' : 'perm-denied'}">
                    ${state.permissions.selfdestruct ? '✓ 已授权' : '✗ 未授权'}
                </span>
            </div>
        `;
    }

    function updateCodeUI() {
        const level = levels[state.currentLevel];
        document.getElementById('contractName').textContent = level.contractName;
        
        let code = level.code;
        let highlightedCode = highlightCode(code);
        
        state.markedRisks.forEach(riskType => {
            if (level.riskLines[riskType]) {
                const lines = highlightedCode.split('\n');
                level.riskLines[riskType].forEach(lineNum => {
                    if (lines[lineNum - 1]) {
                        lines[lineNum - 1] = `<span class="risk-highlight">${lines[lineNum - 1]}</span>`;
                    }
                });
                highlightedCode = lines.join('\n');
            }
        });
        
        document.getElementById('codeDisplay').innerHTML = highlightedCode;
    }

    function highlightCode(code) {
        return code
            .replace(/\b(pragma|solidity|contract|function|mapping|address|uint256|bool|string|public|private|external|internal|view|pure|payable|returns|require|modifier|constructor|using|for|if|else|while|for|do|return|emit|event|struct|enum|interface|library|is|new|delete|this|super|selfdestruct|revert|assert|try|catch)\b/g, '<span class="keyword">$1</span>')
            .replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, '<span class="function">$1</span>(')
            .replace(/"([^"]*)"/g, '<span class="string">"$1"</span>')
            .replace(/\b(\d+)\b/g, '<span class="number">$1</span>')
            .replace(/(\/\/.*$)/gm, '<span class="comment">$1</span>')
            .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="comment">$1</span>');
    }

    function updateObjectivesUI() {
        const container = document.getElementById('objectives');
        container.innerHTML = '';
        
        state.objectives.forEach(obj => {
            const item = document.createElement('div');
            item.className = 'objective-item';
            item.innerHTML = `
                <input type="checkbox" id="${obj.id}" ${obj.completed ? 'checked' : ''} disabled>
                <label for="${obj.id}">${obj.text}</label>
            `;
            container.appendChild(item);
        });
    }

    function updateAttackCardsUI() {
        document.querySelectorAll('.attack-card').forEach(card => {
            const attackType = card.dataset.attack;
            card.classList.toggle('selected', state.selectedAttack === attackType);
        });
    }

    function updateRiskMarkersUI() {
        document.querySelectorAll('.risk-marker').forEach(marker => {
            let riskType = null;
            if (marker.classList.contains('risk-reentrancy')) riskType = 'reentrancy';
            if (marker.classList.contains('risk-authorization')) riskType = 'authorization';
            if (marker.classList.contains('risk-overflow')) riskType = 'overflow';
            
            if (riskType) {
                marker.classList.toggle('active', state.markedRisks.includes(riskType));
            }
        });
    }

    function updateScoreUI() {
        document.getElementById('currentScore').textContent = state.scores.total;
        document.getElementById('riskScore').textContent = state.scores.risk;
        document.getElementById('defenseScore').textContent = state.scores.defense;
        document.getElementById('timeScore').textContent = state.scores.time;
    }

    function updateLevelSelectorUI() {
        document.querySelectorAll('.level-item').forEach(item => {
            const levelId = parseInt(item.dataset.level);
            const statusEl = document.getElementById(`level${levelId}Status`);
            if (statusEl) {
                if (state.levelProgress[levelId].completed) {
                    statusEl.className = 'level-status completed';
                    statusEl.textContent = '✓';
                }
            }
        });
    }

    function checkAttackButtonState() {
        const hasSelectedAttack = state.selectedAttack !== null;
        const hasMarkedRisks = state.markedRisks.length > 0;
        
        document.getElementById('executeAttackBtn').disabled = !hasSelectedAttack;
        document.getElementById('defendBtn').disabled = !(hasSelectedAttack && hasMarkedRisks);
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        loadLevel,
        pauseGame,
        resumeGame,
        restartLevel,
        restartGame,
        markRisk,
        selectAttack,
        executeAttack,
        defend,
        showHint,
        showReplay,
        closeReplay,
        showReport,
        closeReport,
        showReplayFromHistory,
        exportReport,
        runDemo,
        generateReportData
    };
})();
