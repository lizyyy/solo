const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 8080;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const LEVELS_DIR = path.join(DATA_DIR, 'levels');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(LEVELS_DIR)) fs.mkdirSync(LEVELS_DIR);
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR);

function readJSON(filePath, defaultValue = []) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
        return defaultValue;
    } catch (e) {
        return defaultValue;
    }
}

function writeJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

const defaultLevels = [
    {
        id: 'level1',
        name: '初级演练',
        description: '博物馆夜间基础安防事件处理',
        difficulty: 1,
        timeLimit: 180,
        mapConfig: {
            width: 800,
            height: 600,
            rooms: [
                { id: 'r1', name: '主展厅', x: 100, y: 100, width: 200, height: 150, type: 'exhibition' },
                { id: 'r2', name: '古画展厅', x: 350, y: 100, width: 180, height: 150, type: 'exhibition' },
                { id: 'r3', name: '雕塑展厅', x: 100, y: 300, width: 200, height: 150, type: 'exhibition' },
                { id: 'r4', name: '控制室', x: 350, y: 300, width: 150, height: 120, type: 'control' },
                { id: 'r5', name: '休息室', x: 550, y: 100, width: 150, height: 120, type: 'staff' },
                { id: 'r6', name: '走廊', x: 320, y: 260, width: 280, height: 30, type: 'corridor' }
            ],
            doors: [
                { id: 'd1', name: '主展厅东门', x: 290, y: 175, width: 10, height: 50, roomA: 'r1', roomB: 'r2', status: 'closed' },
                { id: 'd2', name: '古画展厅南门', x: 430, y: 250, width: 60, height: 10, roomA: 'r2', roomB: 'r6', status: 'closed' },
                { id: 'd3', name: '主展厅南门', x: 180, y: 250, width: 60, height: 10, roomA: 'r1', roomB: 'r3', status: 'closed' },
                { id: 'd4', name: '雕塑展厅东门', x: 300, y: 375, width: 10, height: 50, roomA: 'r3', roomB: 'r4', status: 'closed' },
                { id: 'd5', name: '休息室南门', x: 620, y: 220, width: 60, height: 10, roomA: 'r5', roomB: 'r6', status: 'closed' }
            ],
            cameras: [
                { id: 'c1', name: '主展厅摄像头', x: 200, y: 175, room: 'r1', status: 'online' },
                { id: 'c2', name: '古画展厅摄像头', x: 440, y: 175, room: 'r2', status: 'online' },
                { id: 'c3', name: '雕塑展厅摄像头', x: 200, y: 375, room: 'r3', status: 'online' },
                { id: 'c4', name: '走廊摄像头', x: 460, y: 275, room: 'r6', status: 'online' },
                { id: 'c5', name: '休息室摄像头', x: 625, y: 160, room: 'r5', status: 'online' }
            ],
            sensors: [
                { id: 's1', name: '主展厅温湿度', x: 150, y: 140, room: 'r1', type: 'temp_humidity', status: 'normal' },
                { id: 's2', name: '古画展厅温湿度', x: 400, y: 140, room: 'r2', type: 'temp_humidity', status: 'normal' },
                { id: 's3', name: '雕塑展厅温湿度', x: 150, y: 340, room: 'r3', type: 'temp_humidity', status: 'normal' }
            ],
            guards: [
                { id: 'g1', name: '保安小张', x: 425, y: 360, room: 'r4', status: 'idle' },
                { id: 'g2', name: '保安小李', x: 625, y: 160, room: 'r5', status: 'idle' }
            ]
        },
        events: [
            {
                id: 'e1',
                time: 10,
                type: 'door_alarm',
                title: '门磁报警',
                description: '古画展厅东门门磁异常触发',
                location: { room: 'r2', door: 'd1' },
                severity: 'high',
                isMisleading: false,
                requiredAction: 'dispatch_guard',
                deadline: 30
            },
            {
                id: 'e2',
                time: 25,
                type: 'temp_alarm',
                title: '温度异常',
                description: '主展厅温度传感器检测到异常升高',
                location: { room: 'r1', sensor: 's1' },
                severity: 'medium',
                isMisleading: false,
                requiredAction: 'check_sensor',
                deadline: 45
            },
            {
                id: 'e3',
                time: 40,
                type: 'camera_offline',
                title: '摄像头离线',
                description: '走廊摄像头显示离线状态',
                location: { room: 'r6', camera: 'c4' },
                severity: 'high',
                isMisleading: true,
                requiredAction: 'ignore',
                deadline: 60,
                misleadingReason: '摄像头临时维护，系统自动恢复'
            },
            {
                id: 'e4',
                time: 60,
                type: 'intruder',
                title: '人员闯入',
                description: '雕塑展厅检测到非法入侵人员',
                location: { room: 'r3' },
                severity: 'critical',
                isMisleading: false,
                requiredAction: 'dispatch_guard',
                deadline: 75
            },
            {
                id: 'e5',
                time: 90,
                type: 'door_alarm',
                title: '门磁报警',
                description: '休息室南门门磁异常触发',
                location: { room: 'r5', door: 'd5' },
                severity: 'high',
                isMisleading: true,
                requiredAction: 'ignore',
                deadline: 110,
                misleadingReason: '保洁人员忘带钥匙，申请临时开门'
            },
            {
                id: 'e6',
                time: 120,
                type: 'humidity_alarm',
                title: '湿度异常',
                description: '古画展厅湿度超出警戒范围',
                location: { room: 'r2', sensor: 's2' },
                severity: 'high',
                isMisleading: false,
                requiredAction: 'check_sensor',
                deadline: 140
            },
            {
                id: 'e7',
                time: 150,
                type: 'intruder',
                title: '人员闯入',
                description: '主展厅检测到非法入侵人员',
                location: { room: 'r1' },
                severity: 'critical',
                isMisleading: false,
                requiredAction: 'dispatch_guard',
                deadline: 165
            }
        ]
    }
];

function initDefaultLevels() {
    const levelsFile = path.join(LEVELS_DIR, 'levels.json');
    if (!fs.existsSync(levelsFile)) {
        writeJSON(levelsFile, defaultLevels);
    }
}

initDefaultLevels();

app.get('/api/levels', (req, res) => {
    const levels = readJSON(path.join(LEVELS_DIR, 'levels.json'), []);
    res.json({ success: true, data: levels });
});

app.get('/api/levels/:id', (req, res) => {
    const levels = readJSON(path.join(LEVELS_DIR, 'levels.json'), []);
    const level = levels.find(l => l.id === req.params.id);
    if (!level) {
        return res.status(404).json({ success: false, message: '关卡不存在' });
    }
    res.json({ success: true, data: level });
});

app.post('/api/sessions', (req, res) => {
    const { levelId, playerName } = req.body;
    const sessionId = uuidv4();
    const session = {
        id: sessionId,
        levelId,
        playerName: playerName || '匿名玩家',
        startTime: Date.now(),
        status: 'playing',
        currentTime: 0,
        isPaused: false,
        playbackSpeed: 1,
        actions: [],
        eventStatus: {},
        scores: null,
        replayData: null
    };
    writeJSON(path.join(SESSIONS_DIR, `${sessionId}.json`), session);
    res.json({ success: true, data: session });
});

app.get('/api/sessions/:id', (req, res) => {
    const sessionFile = path.join(SESSIONS_DIR, `${req.params.id}.json`);
    if (!fs.existsSync(sessionFile)) {
        return res.status(404).json({ success: false, message: '会话不存在' });
    }
    const session = readJSON(sessionFile, null);
    res.json({ success: true, data: session });
});

app.put('/api/sessions/:id', (req, res) => {
    const sessionFile = path.join(SESSIONS_DIR, `${req.params.id}.json`);
    if (!fs.existsSync(sessionFile)) {
        return res.status(404).json({ success: false, message: '会话不存在' });
    }
    const session = readJSON(sessionFile, null);
    const updates = req.body;
    
    if (updates.currentTime !== undefined) session.currentTime = updates.currentTime;
    if (updates.isPaused !== undefined) session.isPaused = updates.isPaused;
    if (updates.playbackSpeed !== undefined) session.playbackSpeed = updates.playbackSpeed;
    if (updates.status !== undefined) session.status = updates.status;
    if (updates.eventStatus) {
        session.eventStatus = { ...session.eventStatus, ...updates.eventStatus };
    }
    
    writeJSON(sessionFile, session);
    res.json({ success: true, data: session });
});

app.post('/api/sessions/:id/actions', (req, res) => {
    const sessionFile = path.join(SESSIONS_DIR, `${req.params.id}.json`);
    if (!fs.existsSync(sessionFile)) {
        return res.status(404).json({ success: false, message: '会话不存在' });
    }
    const session = readJSON(sessionFile, null);
    const action = {
        id: uuidv4(),
        timestamp: session.currentTime,
        ...req.body
    };
    session.actions.push(action);
    writeJSON(sessionFile, session);
    res.json({ success: true, data: action });
});

app.post('/api/sessions/:id/finish', (req, res) => {
    const sessionFile = path.join(SESSIONS_DIR, `${req.params.id}.json`);
    if (!fs.existsSync(sessionFile)) {
        return res.status(404).json({ success: false, message: '会话不存在' });
    }
    const session = readJSON(sessionFile, null);
    const levels = readJSON(path.join(LEVELS_DIR, 'levels.json'), []);
    const level = levels.find(l => l.id === session.levelId);
    
    if (!level) {
        return res.status(404).json({ success: false, message: '关卡数据不存在' });
    }
    
    session.status = 'finished';
    session.endTime = Date.now();
    
    let correctActions = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    let missedDeadlines = 0;
    let reactionTimeTotal = 0;
    let reactionTimeCount = 0;
    
    const eventAnalysis = [];
    
    level.events.forEach(event => {
        const eventActions = session.actions.filter(a => a.eventId === event.id);
        const eventStatus = session.eventStatus[event.id];
        
        const analysis = {
            eventId: event.id,
            eventTitle: event.title,
            eventTime: event.time,
            isMisleading: event.isMisleading,
            requiredAction: event.requiredAction,
            actionsTaken: eventActions.length,
            result: ''
        };
        
        if (event.isMisleading) {
            if (eventActions.length === 0 || (eventStatus && eventStatus === 'ignored')) {
                correctActions++;
                analysis.result = 'correct_ignored';
            } else {
                falsePositives++;
                analysis.result = 'false_positive';
                analysis.falsePositiveReason = '对误报事件采取了不必要的行动';
            }
        } else {
            if (eventActions.length > 0) {
                const firstAction = eventActions.reduce((min, a) => 
                    a.timestamp < min.timestamp ? a : min, eventActions[0]);
                const reactionTime = firstAction.timestamp - event.time;
                
                if (reactionTime <= event.deadline - event.time) {
                    correctActions++;
                    analysis.result = 'correct_handled';
                    analysis.reactionTime = reactionTime;
                    reactionTimeTotal += reactionTime;
                    reactionTimeCount++;
                } else {
                    missedDeadlines++;
                    analysis.result = 'missed_deadline';
                    analysis.actualTime = reactionTime;
                    analysis.deadline = event.deadline - event.time;
                }
            } else {
                falseNegatives++;
                analysis.result = 'false_negative';
                analysis.falseNegativeReason = '未对真实事件采取任何行动';
            }
        }
        
        eventAnalysis.push(analysis);
    });
    
    const totalEvents = level.events.length;
    const accuracy = totalEvents > 0 ? (correctActions / totalEvents) * 100 : 0;
    const avgReactionTime = reactionTimeCount > 0 ? reactionTimeTotal / reactionTimeCount : 0;
    
    let score = 100;
    score -= falsePositives * 15;
    score -= falseNegatives * 25;
    score -= missedDeadlines * 10;
    score = Math.max(0, Math.min(100, score));
    
    let grade = 'F';
    if (score >= 90) grade = 'S';
    else if (score >= 80) grade = 'A';
    else if (score >= 70) grade = 'B';
    else if (score >= 60) grade = 'C';
    else if (score >= 50) grade = 'D';
    
    session.scores = {
        totalScore: Math.round(score),
        grade,
        accuracy: Math.round(accuracy),
        correctActions,
        falsePositives,
        falseNegatives,
        missedDeadlines,
        avgReactionTime: Math.round(avgReactionTime * 10) / 10,
        totalEvents,
        eventAnalysis
    };
    
    session.replayData = {
        levelId: level.id,
        levelName: level.name,
        startTime: session.startTime,
        endTime: session.endTime,
        playerName: session.playerName,
        events: level.events,
        actions: session.actions,
        eventStatus: session.eventStatus,
        scores: session.scores
    };
    
    writeJSON(sessionFile, session);
    res.json({ success: true, data: session });
});

app.get('/api/sessions/:id/export/markdown', (req, res) => {
    const sessionFile = path.join(SESSIONS_DIR, `${req.params.id}.json`);
    if (!fs.existsSync(sessionFile)) {
        return res.status(404).json({ success: false, message: '会话不存在' });
    }
    const session = readJSON(sessionFile, null);
    const levels = readJSON(path.join(LEVELS_DIR, 'levels.json'), []);
    const level = levels.find(l => l.id === session.levelId);
    
    if (!session.scores) {
        return res.status(400).json({ success: false, message: '游戏未完成，无法导出复盘报告' });
    }
    
    const startDate = new Date(session.startTime).toLocaleString('zh-CN');
    
    let md = `# 博物馆安防演练复盘报告\n\n`;
    md += `## 基本信息\n\n`;
    md += `- **关卡名称**: ${level ? level.name : '未知'}\n`;
    md += `- **玩家名称**: ${session.playerName}\n`;
    md += `- **开始时间**: ${startDate}\n`;
    md += `- **游戏时长**: ${session.currentTime} 秒\n\n`;
    
    md += `## 评分结果\n\n`;
    md += `| 指标 | 数值 |\n`;
    md += `|------|------|\n`;
    md += `| **总分** | ${session.scores.totalScore} / 100 |\n`;
    md += `| **评级** | ${session.scores.grade} |\n`;
    md += `| **准确率** | ${session.scores.accuracy}% |\n`;
    md += `| **正确处理** | ${session.scores.correctActions} 个事件 |\n`;
    md += `| **误报** | ${session.scores.falsePositives} 次 |\n`;
    md += `| **漏报** | ${session.scores.falseNegatives} 次 |\n`;
    md += `| **超时** | ${session.scores.missedDeadlines} 次 |\n`;
    md += `| **平均反应时间** | ${session.scores.avgReactionTime} 秒 |\n\n`;
    
    md += `## 事件详细分析\n\n`;
    
    session.scores.eventAnalysis.forEach((analysis, index) => {
        md += `### ${index + 1}. ${analysis.eventTitle}\n\n`;
        md += `- **发生时间**: 第 ${analysis.eventTime} 秒\n`;
        md += `- **事件类型**: ${analysis.isMisleading ? '误报事件' : '真实事件'}\n`;
        md += `- **期望行为**: ${analysis.requiredAction === 'dispatch_guard' ? '派遣保安' : 
            analysis.requiredAction === 'check_sensor' ? '检查传感器' : '忽略（误报）'}\n`;
        md += `- **采取行动**: ${analysis.actionsTaken} 次\n`;
        
        let resultDesc = '';
        if (analysis.result === 'correct_handled') {
            resultDesc = `✅ **正确处理** - 反应时间: ${analysis.reactionTime} 秒`;
        } else if (analysis.result === 'correct_ignored') {
            resultDesc = `✅ **正确忽略** - 识别为误报`;
        } else if (analysis.result === 'false_positive') {
            resultDesc = `❌ **误报处理** - ${analysis.falsePositiveReason}`;
        } else if (analysis.result === 'false_negative') {
            resultDesc = `❌ **漏报** - ${analysis.falseNegativeReason}`;
        } else if (analysis.result === 'missed_deadline') {
            resultDesc = `⚠️ **超时处理** - 实际用时 ${analysis.actualTime} 秒，时限 ${analysis.deadline} 秒`;
        }
        md += `- **处理结果**: ${resultDesc}\n\n`;
    });
    
    md += `## 操作日志\n\n`;
    if (session.actions.length > 0) {
        md += `| 时间 | 操作类型 | 目标 | 说明 |\n`;
        md += `|------|----------|------|------|\n`;
        session.actions.forEach(action => {
            const event = level ? level.events.find(e => e.id === action.eventId) : null;
            const actionType = action.type === 'dispatch_guard' ? '派遣保安' :
                action.type === 'check_sensor' ? '检查传感器' :
                action.type === 'ignore' ? '标记忽略' : action.type;
            const target = action.guardId || action.sensorId || action.eventId || '-';
            md += `| ${action.timestamp}s | ${actionType} | ${target} | ${event ? event.title : '-'} |\n`;
        });
    } else {
        md += `无操作记录。\n`;
    }
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="replay-${session.id}.md"`);
    res.send(md);
});

app.get('/api/sessions/:id/export/json', (req, res) => {
    const sessionFile = path.join(SESSIONS_DIR, `${req.params.id}.json`);
    if (!fs.existsSync(sessionFile)) {
        return res.status(404).json({ success: false, message: '会话不存在' });
    }
    const session = readJSON(sessionFile, null);
    const levels = readJSON(path.join(LEVELS_DIR, 'levels.json'), []);
    const level = levels.find(l => l.id === session.levelId);
    
    const exportData = {
        version: '1.0',
        exportTime: new Date().toISOString(),
        session: {
            id: session.id,
            levelId: session.levelId,
            levelName: level ? level.name : 'Unknown',
            playerName: session.playerName,
            startTime: session.startTime,
            endTime: session.endTime,
            totalTime: session.currentTime,
            status: session.status
        },
        levelConfig: level,
        actions: session.actions,
        eventStatus: session.eventStatus,
        scores: session.scores
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="replay-${session.id}.json"`);
    res.json(exportData);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`博物馆安防演练游戏服务器已启动`);
    console.log(`访问地址: http://localhost:${PORT}`);
});
