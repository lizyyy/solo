const API_BASE = '';

let gameState = {
    session: null,
    items: [],
    members: [],
    placementDecisions: [],
    score: 100,
    timeRemaining: 600,
    congestion: 0,
    timerInterval: null,
    isPlaying: false,
    draggedItem: null,
    currentTab: 'items',
    zoneWeights: {
        'main-truck': 0,
        'backup-truck': 0,
        'waiting-area': 0,
        'rain-backup': 0
    }
};

const loadZones = {
    'main-truck': { name: '主运输车', icon: '🚚' },
    'backup-truck': { name: '备用运输车', icon: '🚐' },
    'waiting-area': { name: '候场区', icon: '🏠' },
    'rain-backup': { name: '雨天备用区', icon: '🌧️' }
};

const elements = {
    startScreen: document.getElementById('startScreen'),
    endScreen: document.getElementById('endScreen'),
    reviewScreen: document.getElementById('reviewScreen'),
    gameContainer: document.getElementById('gameContainer'),
    gameStatus: document.getElementById('gameStatus'),
    
    timer: document.getElementById('timer'),
    score: document.getElementById('score'),
    congestion: document.getElementById('congestion'),
    congestionFill: document.getElementById('congestionFill'),
    remaining: document.getElementById('remaining'),
    
    itemQueue: document.getElementById('itemQueue'),
    tabTitle: document.getElementById('tabTitle'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    
    mainTruck: document.getElementById('mainTruck'),
    backupTruck: document.getElementById('backupTruck'),
    waitingArea: document.getElementById('waitingArea'),
    rainBackup: document.getElementById('rainBackup'),
    
    mainTruckItems: document.getElementById('mainTruckItems'),
    backupTruckItems: document.getElementById('backupTruckItems'),
    waitingAreaItems: document.getElementById('waitingAreaItems'),
    rainBackupItems: document.getElementById('rainBackupItems'),
    
    mainTruckWeight: document.getElementById('mainTruckWeight'),
    backupTruckWeight: document.getElementById('backupTruckWeight'),
    waitingAreaWeight: document.getElementById('waitingAreaWeight'),
    rainBackupWeight: document.getElementById('rainBackupWeight'),
    
    newGameBtn: document.getElementById('newGameBtn'),
    continueBtn: document.getElementById('continueBtn'),
    reviewBtn: document.getElementById('reviewBtn'),
    newGameAgainBtn: document.getElementById('newGameAgainBtn'),
    
    exportMarkdownBtn: document.getElementById('exportMarkdownBtn'),
    exportJsonBtn: document.getElementById('exportJsonBtn'),
    closeReviewBtn: document.getElementById('closeReviewBtn'),
    saveNotesBtn: document.getElementById('saveNotesBtn'),
    notesTextarea: document.getElementById('notesTextarea'),
    
    itemModal: document.getElementById('itemModal'),
    modalItemName: document.getElementById('modalItemName'),
    modalItemDetails: document.getElementById('modalItemDetails'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    
    finalScoreValue: document.getElementById('finalScoreValue'),
    accuracyValue: document.getElementById('accuracyValue'),
    patientCountValue: document.getElementById('patientCountValue'),
    resultStats: document.getElementById('resultStats'),
    
    reviewDecisions: document.getElementById('reviewDecisions'),
    reviewCongestion: document.getElementById('reviewCongestion'),
    congestionEvents: document.getElementById('congestionEvents'),
    
    notification: document.getElementById('notification'),
    notificationText: document.getElementById('notificationText')
};

async function init() {
    await checkLastSession();
    setupEventListeners();
    setupDragAndDrop();
    setupTabs();
}

async function checkLastSession() {
    try {
        const response = await fetch(`${API_BASE}/api/last-session`);
        if (response.ok) {
            const session = await response.json();
            if (!session.isCompleted) {
                elements.continueBtn.style.display = 'inline-flex';
                elements.continueBtn.onclick = () => continueGame(session);
            }
        }
    } catch (error) {
        console.log('没有找到历史会话');
    }
}

function setupTabs() {
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            gameState.currentTab = tab;
            
            elements.tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            elements.tabTitle.textContent = tab === 'items' ? '待装车道具' : '队员名单';
            
            renderItemQueue();
        });
    });
}

function setupEventListeners() {
    elements.newGameBtn.onclick = startNewGame;
    elements.newGameAgainBtn.onclick = startNewGame;
    elements.reviewBtn.onclick = showReview;
    elements.closeReviewBtn.onclick = hideReview;
    elements.saveNotesBtn.onclick = saveNotes;
    elements.exportMarkdownBtn.onclick = exportMarkdown;
    elements.exportJsonBtn.onclick = exportJson;
    elements.closeModalBtn.onclick = closeItemModal;
    elements.modalCloseBtn.onclick = closeItemModal;
    
    elements.itemModal.onclick = (e) => {
        if (e.target === elements.itemModal) {
            closeItemModal();
        }
    };
}

function setupDragAndDrop() {
    const zones = [
        elements.mainTruck, 
        elements.backupTruck, 
        elements.waitingArea, 
        elements.rainBackup
    ];
    
    zones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });
        
        zone.addEventListener('dragleave', (e) => {
            if (!zone.contains(e.relatedTarget)) {
                zone.classList.remove('drag-over');
            }
        });
        
        zone.addEventListener('drop', async (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            
            if (gameState.draggedItem) {
                const placementZone = zone.dataset.zone;
                await handlePlacement(gameState.draggedItem, placementZone);
                gameState.draggedItem = null;
            }
        });
    });
}

async function startNewGame() {
    try {
        const response = await fetch(`${API_BASE}/api/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            const session = await response.json();
            gameState.session = session;
            gameState.items = [...session.items];
            gameState.members = [...session.members];
            gameState.placementDecisions = [];
            gameState.score = 100;
            gameState.timeRemaining = 600;
            gameState.congestion = 0;
            gameState.isPlaying = true;
            gameState.currentTab = 'items';
            gameState.zoneWeights = {
                'main-truck': 0,
                'backup-truck': 0,
                'waiting-area': 0,
                'rain-backup': 0
            };
            
            startGame();
        }
    } catch (error) {
        showNotification('启动游戏失败', 'error');
        console.error(error);
    }
}

async function continueGame(session) {
    gameState.session = session;
    gameState.items = session.items.filter(item => 
        !session.placementDecisions.find(d => d.itemId === item.id)
    );
    gameState.members = session.members.filter(member => 
        !session.placementDecisions.find(d => d.itemId === member.id)
    );
    gameState.placementDecisions = [...session.placementDecisions];
    gameState.score = session.score;
    gameState.timeRemaining = session.timeRemaining;
    gameState.congestion = session.congestion;
    gameState.isPlaying = true;
    gameState.currentTab = 'items';
    
    gameState.zoneWeights = {
        'main-truck': 0,
        'backup-truck': 0,
        'waiting-area': 0,
        'rain-backup': 0
    };
    
    session.placementDecisions.forEach(decision => {
        gameState.zoneWeights[decision.zone] += decision.weight || 0;
    });
    
    startGame();
}

function startGame() {
    elements.startScreen.style.display = 'none';
    elements.endScreen.style.display = 'none';
    elements.reviewScreen.style.display = 'none';
    elements.gameContainer.style.display = 'flex';
    elements.gameStatus.style.display = 'flex';
    
    gameState.currentTab = 'items';
    elements.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === 'items');
    });
    elements.tabTitle.textContent = '待装车道具';
    
    renderItemQueue();
    updateGameUI();
    updateZoneWeights();
    startTimer();
}

function renderItemQueue() {
    elements.itemQueue.innerHTML = '';
    
    const items = gameState.currentTab === 'items' ? gameState.items : gameState.members;
    
    items.forEach(item => {
        if (!gameState.placementDecisions.find(d => d.itemId === item.id)) {
            const card = createItemCard(item, gameState.currentTab === 'members');
            elements.itemQueue.appendChild(card);
        }
    });
    
    updateRemainingCount();
}

function createItemCard(item, isMember) {
    const card = document.createElement('div');
    card.className = 'item-card' + (isMember && item.isAbsent ? ' absent' : '');
    card.draggable = true;
    card.dataset.itemId = item.id;
    
    card.innerHTML = `
        <div class="item-card-header">
            <span class="item-name">
                <span class="item-icon">${item.icon || '📦'}</span>
                ${item.name}
            </span>
            ${isMember ? `<span class="item-role">${item.role}</span>` : ''}
            ${isMember && item.isAbsent ? '<span class="item-absent">缺席</span>' : ''}
        </div>
        <div class="item-desc">${item.description}</div>
        <div class="item-tags">
            ${isMember ? '' : `<span class="tag weight">${item.weight}kg</span>`}
            ${!isMember && item.isBackup ? '<span class="tag backup">备用</span>' : ''}
            ${!isMember && item.isRainGear ? '<span class="tag rain">雨具</span>' : ''}
            ${isMember && item.isAbsent ? '<span class="tag absent-tag">缺席提醒</span>' : ''}
            ${!isMember && item.usageOrder > 0 ? `<span class="tag">使用顺序: ${item.usageOrder}</span>` : ''}
        </div>
    `;
    
    card.addEventListener('dragstart', (e) => {
        gameState.draggedItem = { ...item, isMember };
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });
    
    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
    });
    
    card.addEventListener('click', () => {
        showItemDetails(item, isMember);
    });
    
    return card;
}

function showItemDetails(item, isMember) {
    elements.modalItemName.textContent = `${item.name} ${item.role ? `(${item.role})` : ''}`;
    
    let detailsHtml = `
        <div class="detail-section">
            <h4>基本信息</h4>
            <div class="detail-item">
                <span class="detail-label">名称</span>
                <span class="detail-value">${item.name}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">描述</span>
                <span class="detail-value">${item.description}</span>
            </div>
    `;
    
    if (isMember) {
        detailsHtml += `
            <div class="detail-item">
                <span class="detail-label">角色</span>
                <span class="detail-value">${item.role}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">技术水平</span>
                <span class="detail-value">${item.skillLevel === 'expert' ? '专家' : item.skillLevel === 'intermediate' ? '中级' : '初级'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">出勤状态</span>
                <span class="detail-value ${item.isAbsent ? 'critical' : ''}">${item.isAbsent ? '缺席' : '正常'}</span>
            </div>
        `;
    } else {
        detailsHtml += `
            <div class="detail-item">
                <span class="detail-label">类型</span>
                <span class="detail-value">${item.type}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">重量</span>
                <span class="detail-value">${item.weight}kg</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">使用顺序</span>
                <span class="detail-value">${item.usageOrder > 0 ? item.usageOrder : '无'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">是否备用</span>
                <span class="detail-value">${item.isBackup ? '是' : '否'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">是否雨具</span>
                <span class="detail-value">${item.isRainGear ? '是' : '否'}</span>
            </div>
        `;
    }
    
    detailsHtml += `
        </div>
        <div class="detail-section">
            <h4>正确存放区域</h4>
            <div class="detail-item">
                <span class="detail-label">建议区域</span>
                <span class="detail-value">${loadZones[item.correctZone].icon} ${loadZones[item.correctZone].name}</span>
            </div>
        </div>
    `;
    
    elements.modalItemDetails.innerHTML = detailsHtml;
    elements.itemModal.style.display = 'flex';
}

function closeItemModal() {
    elements.itemModal.style.display = 'none';
}

async function handlePlacement(item, placementZone) {
    if (!gameState.session) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/sessions/${gameState.session.id}/place`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                itemId: item.id,
                zone: placementZone,
                timestamp: Date.now()
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            
            gameState.placementDecisions.push(result.decision);
            gameState.score = result.newScore;
            gameState.congestion = result.congestion;
            
            gameState.zoneWeights[placementZone] += (item.weight || 0);
            
            if (result.events && result.events.length > 0) {
                result.events.forEach(event => {
                    showNotification(event.message, 'warning');
                });
            }
            
            const itemName = item.name;
            if (result.decision.isCorrect) {
                showNotification(`${itemName} 放置正确！`, 'success');
            } else {
                showNotification(`${itemName} 放置错误，扣除 ${result.decision.penalty} 分`, 'error');
            }
            
            gameState.session = {
                ...gameState.session,
                placementDecisions: gameState.placementDecisions,
                score: gameState.score,
                congestion: gameState.congestion
            };
            
            await saveSessionState();
            
            updateGameUI();
            updateZoneWeights();
            renderItemQueue();
            renderZonedItems();
            
            const totalItems = gameState.items.length + gameState.members.length;
            if (gameState.placementDecisions.length >= totalItems) {
                endGame();
            }
        }
    } catch (error) {
        showNotification('放置处理失败', 'error');
        console.error(error);
    }
}

function renderZonedItems() {
    const zoneElements = {
        'main-truck': elements.mainTruckItems,
        'backup-truck': elements.backupTruckItems,
        'waiting-area': elements.waitingAreaItems,
        'rain-backup': elements.rainBackupItems
    };
    
    Object.values(zoneElements).forEach(el => el.innerHTML = '');
    
    gameState.placementDecisions.forEach(decision => {
        const zoneEl = zoneElements[decision.zone];
        if (zoneEl) {
            const itemEl = document.createElement('div');
            itemEl.className = `zone-item ${decision.isCorrect ? 'correct' : 'incorrect'}`;
            itemEl.innerHTML = `
                <span>${loadZones[decision.zone].icon}</span>
                <span>${decision.itemName}</span>
                <span style="font-size: 10px; opacity: 0.7;">${decision.isCorrect ? '✓' : '✗'}</span>
            `;
            
            const item = [...gameState.items, ...gameState.members].find(i => i.id === decision.itemId);
            if (item) {
                itemEl.onclick = () => showItemDetails(item, decision.itemType === 'member');
            }
            
            zoneEl.appendChild(itemEl);
        }
    });
}

function updateZoneWeights() {
    elements.mainTruckWeight.textContent = gameState.zoneWeights['main-truck'];
    elements.backupTruckWeight.textContent = gameState.zoneWeights['backup-truck'];
    elements.waitingAreaWeight.textContent = gameState.zoneWeights['waiting-area'];
    elements.rainBackupWeight.textContent = gameState.zoneWeights['rain-backup'];
}

async function saveSessionState() {
    if (!gameState.session) return;
    
    try {
        await fetch(`${API_BASE}/api/sessions/${gameState.session.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                placementDecisions: gameState.placementDecisions,
                score: gameState.score,
                timeRemaining: gameState.timeRemaining,
                congestion: gameState.congestion
            })
        });
    } catch (error) {
        console.error('保存会话状态失败:', error);
    }
}

function updateGameUI() {
    elements.score.textContent = gameState.score;
    elements.score.className = `status-value ${gameState.score >= 60 ? 'score-positive' : 'score-negative'}`;
    
    const totalItems = gameState.items.length + gameState.members.length;
    const progress = Math.round((gameState.placementDecisions.length / totalItems) * 100);
    
    elements.congestion.textContent = `${progress}%`;
    elements.congestionFill.style.width = `${progress}%`;
}

function updateRemainingCount() {
    const totalItems = gameState.items.length + gameState.members.length;
    const remaining = totalItems - gameState.placementDecisions.length;
    elements.remaining.textContent = remaining;
}

function startTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
    
    updateTimerDisplay();
    
    gameState.timerInterval = setInterval(async () => {
        if (!gameState.isPlaying) return;
        
        gameState.timeRemaining--;
        updateTimerDisplay();
        
        if (gameState.timeRemaining % 30 === 0) {
            await saveSessionState();
        }
        
        if (gameState.timeRemaining <= 0) {
            endGame();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(gameState.timeRemaining / 60);
    const seconds = gameState.timeRemaining % 60;
    elements.timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    if (gameState.timeRemaining <= 60) {
        elements.timer.style.color = '#ef4444';
    } else if (gameState.timeRemaining <= 180) {
        elements.timer.style.color = '#f59e0b';
    } else {
        elements.timer.style.color = '#333';
    }
}

async function endGame() {
    gameState.isPlaying = false;
    
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
    
    if (gameState.session) {
        gameState.session.isCompleted = true;
        gameState.session.timeRemaining = gameState.timeRemaining;
        await saveSessionState();
    }
    
    elements.gameContainer.style.display = 'none';
    elements.gameStatus.style.display = 'none';
    elements.endScreen.style.display = 'flex';
    
    showResults();
}

function showResults() {
    elements.finalScoreValue.textContent = gameState.score;
    
    const correctCount = gameState.placementDecisions.filter(d => d.isCorrect).length;
    const totalCount = gameState.placementDecisions.length;
    const accuracy = totalCount > 0 ? ((correctCount / totalCount) * 100).toFixed(1) : 0;
    
    elements.accuracyValue.textContent = `${accuracy}%`;
    const totalItems = gameState.items.length + gameState.members.length;
    elements.patientCountValue.textContent = `${totalCount}/${totalItems}`;
    
    const zoneCounts = { 
        'main-truck': 0, 
        'backup-truck': 0, 
        'waiting-area': 0, 
        'rain-backup': 0 
    };
    gameState.placementDecisions.forEach(d => zoneCounts[d.zone]++);
    
    elements.resultStats.innerHTML = `
        <div class="stat-item">
            <span class="stat-label">放置正确</span>
            <span class="stat-value" style="color: #10b981;">${correctCount}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">放置错误</span>
            <span class="stat-value" style="color: #ef4444;">${totalCount - correctCount}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">主运输车</span>
            <span class="stat-value" style="color: #dc2626;">${zoneCounts['main-truck']}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">备用运输车</span>
            <span class="stat-value" style="color: #f59e0b;">${zoneCounts['backup-truck']}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">候场区</span>
            <span class="stat-value" style="color: #10b981;">${zoneCounts['waiting-area']}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">雨天备用区</span>
            <span class="stat-value" style="color: #3b82f6;">${zoneCounts['rain-backup']}</span>
        </div>
    `;
}

function showReview() {
    if (!gameState.session) return;
    
    elements.endScreen.style.display = 'none';
    elements.reviewScreen.style.display = 'flex';
    
    elements.notesTextarea.value = gameState.session.notes || '';
    
    elements.reviewDecisions.innerHTML = `
        <h3>放置决策详情</h3>
        ${gameState.placementDecisions.map((decision, index) => `
            <div class="decision-item ${decision.isCorrect ? 'correct' : 'incorrect'}">
                <div class="decision-header">
                    <span class="decision-item-name">#${index + 1} ${loadZones[decision.zone].icon} ${decision.itemName}</span>
                    <div class="decision-result">
                        <span class="result-badge ${decision.isCorrect ? 'correct' : 'incorrect'}">
                            ${decision.isCorrect ? '放置正确' : '放置错误'}
                        </span>
                        ${decision.penalty > 0 ? `<span class="penalty-badge">-${decision.penalty}分</span>` : ''}
                    </div>
                </div>
                <div class="decision-details">
                    <p><strong>放置区域:</strong> ${loadZones[decision.zone].icon} ${loadZones[decision.zone].name}</p>
                    <p><strong>正确区域:</strong> ${loadZones[decision.correctZone].icon} ${loadZones[decision.correctZone].name}</p>
                    <p><strong>原因:</strong> ${decision.reason}</p>
                    <p><strong>重量:</strong> ${decision.weight}kg</p>
                    ${decision.isAbsent ? '<p><strong>状态:</strong> 队员缺席</p>' : ''}
                </div>
            </div>
        `).join('')}
    `;
    
    if (gameState.session.congestionEvents && gameState.session.congestionEvents.length > 0) {
        elements.reviewCongestion.style.display = 'block';
        elements.congestionEvents.innerHTML = gameState.session.congestionEvents.map(event => `
            <div class="congestion-event">${event.message}</div>
        `).join('');
    } else {
        elements.reviewCongestion.style.display = 'none';
    }
}

function hideReview() {
    elements.reviewScreen.style.display = 'none';
    elements.endScreen.style.display = 'flex';
}

async function saveNotes() {
    if (!gameState.session) return;
    
    const notes = elements.notesTextarea.value;
    
    try {
        await fetch(`${API_BASE}/api/sessions/${gameState.session.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes })
        });
        
        gameState.session.notes = notes;
        showNotification('备注已保存', 'success');
    } catch (error) {
        showNotification('保存备注失败', 'error');
        console.error(error);
    }
}

function exportMarkdown() {
    if (!gameState.session) return;
    window.open(`${API_BASE}/api/sessions/${gameState.session.id}/export/markdown`, '_blank');
}

function exportJson() {
    if (!gameState.session) return;
    window.open(`${API_BASE}/api/sessions/${gameState.session.id}/export/json`, '_blank');
}

function showNotification(message, type = 'info') {
    elements.notification.className = `notification ${type}`;
    elements.notificationText.textContent = message;
    elements.notification.style.display = 'block';
    
    setTimeout(() => {
        elements.notification.style.display = 'none';
    }, 3000);
}

document.addEventListener('DOMContentLoaded', init);
