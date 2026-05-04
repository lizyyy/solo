// 屏幕切换函数
function showScreen(screenId) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
    });
    
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
    
    // 根据屏幕执行相应操作
    switch (screenId) {
        case 'level-select':
            loadLevels();
            break;
        case 'history':
            loadHistory();
            break;
    }
}

// 加载关卡列表
async function loadLevels() {
    const levelList = document.getElementById('level-list');
    levelList.innerHTML = '<div class="loading">加载中...</div>';
    
    try {
        const levels = await API.levels.getAll();
        
        if (levels.length === 0) {
            levelList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #a0a0a0;">
                    <p>暂无关卡数据</p>
                    <p style="margin-top: 10px; font-size: 0.9rem;">
                        请先导入展厅JSON创建关卡
                    </p>
                </div>
            `;
            return;
        }
        
        levelList.innerHTML = levels.map(level => `
            <div class="level-card" onclick="startGame(${level.id})">
                <h3>${level.name}</h3>
                <p>${level.description || '暂无描述'}</p>
                <div class="meta">
                    <span>时间限制: ${level.time_limit}秒</span>
                    <span>${formatDate(level.created_at)}</span>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        levelList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ff6b6b;">
                <p>加载失败: ${error.message}</p>
            </div>
        `;
    }
}

// 加载历史记录
async function loadHistory() {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '<div class="loading">加载中...</div>';
    
    try {
        const sessions = await API.sessions.getAll();
        
        if (sessions.length === 0) {
            historyList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #a0a0a0;">
                    <p>暂无历史记录</p>
                    <p style="margin-top: 10px; font-size: 0.9rem;">
                        完成游戏后将显示在这里
                    </p>
                </div>
            `;
            return;
        }
        
        historyList.innerHTML = sessions.map(session => {
            const scoreClass = session.score >= 90 ? 'excellent' : 
                              session.score >= 70 ? 'good' : 
                              session.score >= 50 ? 'average' : 'poor';
            
            return `
                <div class="history-card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h3>${session.level_name || '未知关卡'}</h3>
                        <span class="score ${scoreClass}">${session.score}分</span>
                    </div>
                    <p>巡查员: ${session.player_name}</p>
                    <p>检查点: ${session.checkpoints_visited.length}/${JSON.parse(session.checkpoints_missed).length + session.checkpoints_visited.length}</p>
                    <div class="meta">
                        <span>用时: ${session.time_used}秒</span>
                        <span>${formatDate(session.start_time)}</span>
                    </div>
                    <div style="margin-top: 10px; display: flex; gap: 10px;">
                        <button class="btn btn-small" onclick="viewSessionDetails('${session.id}')">查看详情</button>
                        <button class="btn btn-small" onclick="exportSessionMarkdown('${session.id}')">导出复盘</button>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        historyList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ff6b6b;">
                <p>加载失败: ${error.message}</p>
            </div>
        `;
    }
}

// 开始游戏
function startGame(levelId) {
    game.start(levelId);
}

// 查看会话详情
async function viewSessionDetails(sessionId) {
    try {
        const session = await API.sessions.get(sessionId);
        alert(`会话详情:\n巡查员: ${session.player_name}\n分数: ${session.score}分\n用时: ${session.time_used}秒\n已检查: ${session.checkpoints_visited.length}个\n漏检: ${session.checkpoints_missed.length}个`);
    } catch (error) {
        alert('获取详情失败: ' + error.message);
    }
}

// 从历史记录导出Markdown
async function exportSessionMarkdown(sessionId) {
    try {
        const result = await API.exports.markdown(sessionId);
        downloadFile(result.content, result.filename, 'text/markdown');
        alert('Markdown复盘报告已下载');
    } catch (error) {
        alert('导出失败: ' + error.message);
    }
}

// 导入关卡
async function importLevel() {
    const nameInput = document.getElementById('level-name');
    const descInput = document.getElementById('level-description');
    const timeLimitInput = document.getElementById('time-limit');
    const jsonPreview = document.getElementById('json-preview');
    
    // 验证输入
    if (!nameInput.value.trim()) {
        alert('请输入关卡名称');
        return;
    }
    
    if (!window.importedFloorPlan) {
        alert('请选择并验证展厅JSON文件');
        return;
    }
    
    // 解析JSON
    let floorPlanData;
    try {
        floorPlanData = JSON.parse(jsonPreview.value);
    } catch (error) {
        alert('JSON解析失败: ' + error.message);
        return;
    }
    
    // 验证必需字段
    if (!floorPlanData.floor_plan || !floorPlanData.checkpoints) {
        alert('JSON格式错误：需要包含 floor_plan 和 checkpoints 字段');
        return;
    }
    
    try {
        const result = await API.levels.create({
            name: nameInput.value.trim(),
            description: descInput.value.trim(),
            floor_plan: floorPlanData.floor_plan,
            checkpoints: floorPlanData.checkpoints,
            time_limit: parseInt(timeLimitInput.value) || 120
        });
        
        alert('关卡导入成功！');
        
        // 清空表单
        nameInput.value = '';
        descInput.value = '';
        timeLimitInput.value = '120';
        jsonPreview.value = '';
        window.importedFloorPlan = null;
        document.getElementById('file-name').textContent = '未选择文件';
        
        // 切换到关卡选择页面
        showScreen('level-select');
        
    } catch (error) {
        alert('导入失败: ' + error.message);
    }
}

// 文件上传处理
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('floor-plan-file');
    const jsonPreview = document.getElementById('json-preview');
    const fileNameSpan = document.getElementById('file-name');
    
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            fileNameSpan.textContent = file.name;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const json = JSON.parse(event.target.result);
                    jsonPreview.value = JSON.stringify(json, null, 2);
                    window.importedFloorPlan = json;
                } catch (error) {
                    alert('JSON格式错误: ' + error.message);
                    jsonPreview.value = '';
                    window.importedFloorPlan = null;
                }
            };
            reader.readAsText(file);
        });
    }
});

// 格式化日期
function formatDate(dateString) {
    if (!dateString) return '未知';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}
