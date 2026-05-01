const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const csv = require('csv-parser');
const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const DATA_DIR = path.join(__dirname, 'data');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const LOGS_FILE = path.join(DATA_DIR, 'task_logs.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadJSON(filePath, defaultValue = []) {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error(`Error loading ${filePath}:`, err);
    }
    return defaultValue;
}

function saveJSON(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error(`Error saving ${filePath}:`, err);
        throw err;
    }
}

const TASK_TYPES = ['checkin', 'checkout', 'cleaning', 'maintenance', 'complaint'];
const TASK_STATUSES = ['pending', 'in_progress', 'pending_review', 'completed', 'overdue'];

function getTodayRange() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    return { startOfDay, endOfDay };
}

function checkConflict(roomId, startTime, endTime, excludeTaskId = null) {
    const tasks = loadJSON(TASKS_FILE);
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    for (const task of tasks) {
        if (task.room_id !== roomId) continue;
        if (task.status === 'completed') continue;
        if (excludeTaskId && task.id === excludeTaskId) continue;
        
        const taskStart = new Date(task.start_time);
        const taskEnd = new Date(task.end_time);
        
        if (start < taskEnd && end > taskStart) {
            return { conflict: true, conflictingTask: task };
        }
    }
    
    return { conflict: false };
}

function updateOverdueTasks() {
    const tasks = loadJSON(TASKS_FILE);
    const now = new Date();
    let updated = false;
    
    for (const task of tasks) {
        if (['pending', 'in_progress', 'pending_review'].includes(task.status)) {
            const endTime = new Date(task.end_time);
            if (endTime < now) {
                task.status = 'overdue';
                task.updated_at = new Date().toISOString();
                updated = true;
            }
        }
    }
    
    if (updated) {
        saveJSON(TASKS_FILE, tasks);
    }
}

app.get('/api/rooms', (req, res) => {
    try {
        const rooms = loadJSON(ROOMS_FILE);
        rooms.sort((a, b) => a.room_number.localeCompare(b.room_number));
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/rooms', (req, res) => {
    try {
        const { room_number, floor, type, capacity, status } = req.body;
        const rooms = loadJSON(ROOMS_FILE);
        
        const existing = rooms.find(r => r.room_number === room_number);
        if (existing) {
            return res.status(400).json({ error: '房间号已存在' });
        }
        
        const newRoom = {
            id: rooms.length > 0 ? Math.max(...rooms.map(r => r.id)) + 1 : 1,
            room_number,
            floor: floor ? parseInt(floor) : null,
            type: type || null,
            capacity: capacity ? parseInt(capacity) : null,
            status: status || 'available',
            created_at: new Date().toISOString()
        };
        
        rooms.push(newRoom);
        saveJSON(ROOMS_FILE, rooms);
        
        res.json({ id: newRoom.id, room_number: newRoom.room_number });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/rooms/:id', (req, res) => {
    try {
        const { room_number, floor, type, capacity, status } = req.body;
        const { id } = req.params;
        const rooms = loadJSON(ROOMS_FILE);
        
        const index = rooms.findIndex(r => r.id === parseInt(id));
        if (index === -1) {
            return res.status(404).json({ error: '房间不存在' });
        }
        
        const existing = rooms.find(r => r.room_number === room_number && r.id !== parseInt(id));
        if (existing) {
            return res.status(400).json({ error: '房间号已存在' });
        }
        
        rooms[index] = {
            ...rooms[index],
            room_number,
            floor: floor ? parseInt(floor) : null,
            type: type || null,
            capacity: capacity ? parseInt(capacity) : null,
            status: status || 'available'
        };
        
        saveJSON(ROOMS_FILE, rooms);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/rooms/:id', (req, res) => {
    try {
        const { id } = req.params;
        const rooms = loadJSON(ROOMS_FILE);
        const tasks = loadJSON(TASKS_FILE);
        
        const taskCount = tasks.filter(t => t.room_id === parseInt(id)).length;
        if (taskCount > 0) {
            return res.status(400).json({ error: '该房间有关联任务，无法删除' });
        }
        
        const index = rooms.findIndex(r => r.id === parseInt(id));
        if (index === -1) {
            return res.status(404).json({ error: '房间不存在' });
        }
        
        rooms.splice(index, 1);
        saveJSON(ROOMS_FILE, rooms);
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/tasks', (req, res) => {
    try {
        updateOverdueTasks();
        
        const { room_id, task_type, status, date, assignee } = req.query;
        let tasks = loadJSON(TASKS_FILE);
        const rooms = loadJSON(ROOMS_FILE);
        
        if (room_id) {
            tasks = tasks.filter(t => t.room_id === parseInt(room_id));
        }
        
        if (task_type) {
            const types = task_type.split(',');
            tasks = tasks.filter(t => types.includes(t.task_type));
        }
        
        if (status) {
            const statuses = status.split(',');
            tasks = tasks.filter(t => statuses.includes(t.status));
        }
        
        if (date) {
            const dateObj = new Date(date);
            const startOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0);
            const endOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59);
            tasks = tasks.filter(t => {
                const startTime = new Date(t.start_time);
                return startTime >= startOfDay && startTime <= endOfDay;
            });
        }
        
        if (assignee) {
            tasks = tasks.filter(t => t.assignee === assignee);
        }
        
        tasks.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        
        const result = tasks.map(task => {
            const room = rooms.find(r => r.id === task.room_id);
            return {
                ...task,
                room_number: room ? room.room_number : '未知',
                floor: room ? room.floor : null,
                room_type: room ? room.type : null
            };
        });
        
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/tasks/today', (req, res) => {
    try {
        updateOverdueTasks();
        
        const { startOfDay, endOfDay } = getTodayRange();
        let tasks = loadJSON(TASKS_FILE);
        const rooms = loadJSON(ROOMS_FILE);
        
        tasks = tasks.filter(t => {
            const startTime = new Date(t.start_time);
            return startTime >= startOfDay && startTime <= endOfDay;
        });
        
        tasks.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        
        const result = tasks.map(task => {
            const room = rooms.find(r => r.id === task.room_id);
            return {
                ...task,
                room_number: room ? room.room_number : '未知',
                floor: room ? room.floor : null,
                room_type: room ? room.type : null
            };
        });
        
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/tasks/:id', (req, res) => {
    try {
        const { id } = req.params;
        const tasks = loadJSON(TASKS_FILE);
        const rooms = loadJSON(ROOMS_FILE);
        
        const task = tasks.find(t => t.id === parseInt(id));
        if (!task) {
            return res.status(404).json({ error: '任务不存在' });
        }
        
        const room = rooms.find(r => r.id === task.room_id);
        const result = {
            ...task,
            room_number: room ? room.room_number : '未知',
            floor: room ? room.floor : null,
            room_type: room ? room.type : null
        };
        
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/tasks', (req, res) => {
    try {
        const { room_id, task_type, title, description, assignee, start_time, end_time, priority } = req.body;
        
        if (!TASK_TYPES.includes(task_type)) {
            return res.status(400).json({ error: '无效的任务类型' });
        }
        
        const rooms = loadJSON(ROOMS_FILE);
        const room = rooms.find(r => r.id === room_id);
        if (!room) {
            return res.status(400).json({ error: '房间不存在' });
        }
        
        const conflict = checkConflict(room_id, start_time, end_time);
        if (conflict.conflict) {
            return res.status(400).json({ 
                error: '时间冲突', 
                conflictingTask: conflict.conflictingTask 
            });
        }
        
        const tasks = loadJSON(TASKS_FILE);
        const logs = loadJSON(LOGS_FILE);
        
        const newTask = {
            id: tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1,
            room_id,
            task_type,
            title,
            description: description || null,
            status: 'pending',
            assignee: assignee || null,
            start_time,
            end_time,
            priority: priority || 'normal',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        tasks.push(newTask);
        saveJSON(TASKS_FILE, tasks);
        
        const newLog = {
            id: logs.length > 0 ? Math.max(...logs.map(l => l.id)) + 1 : 1,
            task_id: newTask.id,
            action: 'created',
            previous_status: null,
            new_status: 'pending',
            assignee: assignee || null,
            created_at: new Date().toISOString()
        };
        
        logs.push(newLog);
        saveJSON(LOGS_FILE, logs);
        
        res.json({ id: newTask.id, title: newTask.title, room_number: room.room_number });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/tasks/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { room_id, task_type, title, description, assignee, start_time, end_time, priority, status } = req.body;
        
        const tasks = loadJSON(TASKS_FILE);
        const logs = loadJSON(LOGS_FILE);
        const rooms = loadJSON(ROOMS_FILE);
        
        const index = tasks.findIndex(t => t.id === parseInt(id));
        if (index === -1) {
            return res.status(404).json({ error: '任务不存在' });
        }
        
        const existingTask = tasks[index];
        
        if (task_type && !TASK_TYPES.includes(task_type)) {
            return res.status(400).json({ error: '无效的任务类型' });
        }
        
        if (room_id !== undefined) {
            const room = rooms.find(r => r.id === room_id);
            if (!room) {
                return res.status(400).json({ error: '房间不存在' });
            }
        }
        
        const checkRoomId = room_id !== undefined ? room_id : existingTask.room_id;
        const checkStartTime = start_time || existingTask.start_time;
        const checkEndTime = end_time || existingTask.end_time;
        
        const conflict = checkConflict(checkRoomId, checkStartTime, checkEndTime, parseInt(id));
        if (conflict.conflict) {
            return res.status(400).json({ 
                error: '时间冲突', 
                conflictingTask: conflict.conflictingTask 
            });
        }
        
        let hasChanges = false;
        
        if (room_id !== undefined && room_id !== existingTask.room_id) {
            existingTask.room_id = room_id;
            hasChanges = true;
        }
        
        if (task_type !== undefined && task_type !== existingTask.task_type) {
            existingTask.task_type = task_type;
            hasChanges = true;
        }
        
        if (title !== undefined && title !== existingTask.title) {
            existingTask.title = title;
            hasChanges = true;
        }
        
        if (description !== undefined && description !== existingTask.description) {
            existingTask.description = description || null;
            hasChanges = true;
        }
        
        if (assignee !== undefined && assignee !== existingTask.assignee) {
            existingTask.assignee = assignee || null;
            hasChanges = true;
        }
        
        if (start_time !== undefined && start_time !== existingTask.start_time) {
            existingTask.start_time = start_time;
            hasChanges = true;
        }
        
        if (end_time !== undefined && end_time !== existingTask.end_time) {
            existingTask.end_time = end_time;
            hasChanges = true;
        }
        
        if (priority !== undefined && priority !== existingTask.priority) {
            existingTask.priority = priority;
            hasChanges = true;
        }
        
        if (status !== undefined && status !== existingTask.status) {
            const newLog = {
                id: logs.length > 0 ? Math.max(...logs.map(l => l.id)) + 1 : 1,
                task_id: parseInt(id),
                action: 'status_changed',
                previous_status: existingTask.status,
                new_status: status,
                assignee: assignee || existingTask.assignee,
                created_at: new Date().toISOString()
            };
            
            logs.push(newLog);
            saveJSON(LOGS_FILE, logs);
            
            existingTask.status = status;
            hasChanges = true;
        }
        
        if (!hasChanges) {
            return res.status(400).json({ error: '没有要更新的字段' });
        }
        
        existingTask.updated_at = new Date().toISOString();
        tasks[index] = existingTask;
        saveJSON(TASKS_FILE, tasks);
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/tasks/:id', (req, res) => {
    try {
        const { id } = req.params;
        const tasks = loadJSON(TASKS_FILE);
        const logs = loadJSON(LOGS_FILE);
        
        const filteredLogs = logs.filter(l => l.task_id !== parseInt(id));
        saveJSON(LOGS_FILE, filteredLogs);
        
        const index = tasks.findIndex(t => t.id === parseInt(id));
        if (index === -1) {
            return res.status(404).json({ error: '任务不存在' });
        }
        
        tasks.splice(index, 1);
        saveJSON(TASKS_FILE, tasks);
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/tasks/:id/logs', (req, res) => {
    try {
        const { id } = req.params;
        const logs = loadJSON(LOGS_FILE);
        
        const taskLogs = logs.filter(l => l.task_id === parseInt(id));
        taskLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        res.json(taskLogs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/import/csv', async (req, res) => {
    try {
        const { csv_content } = req.body;
        
        if (!csv_content) {
            return res.status(400).json({ error: 'CSV内容不能为空' });
        }
        
        const results = [];
        const stream = Readable.from(csv_content);
        
        await new Promise((resolve, reject) => {
            stream
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', resolve)
                .on('error', reject);
        });
        
        let roomsCount = 0;
        let tasksCount = 0;
        let errors = [];
        
        const rooms = loadJSON(ROOMS_FILE);
        const tasks = loadJSON(TASKS_FILE);
        const logs = loadJSON(LOGS_FILE);
        
        for (const row of results) {
            try {
                if (row.room_number) {
                    let room = rooms.find(r => r.room_number === row.room_number);
                    
                    if (!room) {
                        const newRoom = {
                            id: rooms.length > 0 ? Math.max(...rooms.map(r => r.id)) + 1 : 1,
                            room_number: row.room_number,
                            floor: row.floor ? parseInt(row.floor) : null,
                            type: row.room_type || row.type || null,
                            capacity: row.capacity ? parseInt(row.capacity) : null,
                            status: row.room_status || 'available',
                            created_at: new Date().toISOString()
                        };
                        
                        rooms.push(newRoom);
                        roomsCount++;
                        room = { ...newRoom };
                    }
                    
                    if (row.task_type || row.title) {
                        const taskType = row.task_type || 'cleaning';
                        const today = new Date();
                        const startTime = row.start_time ? new Date(row.start_time) : new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0);
                        const endTime = row.end_time ? new Date(row.end_time) : new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 0, 0);
                        
                        const conflict = checkConflict(room.id, startTime.toISOString(), endTime.toISOString());
                        
                        if (!conflict.conflict) {
                            const newTask = {
                                id: tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1,
                                room_id: room.id,
                                task_type: taskType,
                                title: row.title || `${row.room_number} ${taskType}`,
                                description: row.description || null,
                                status: row.status || 'pending',
                                assignee: row.assignee || null,
                                start_time: startTime.toISOString(),
                                end_time: endTime.toISOString(),
                                priority: row.priority || 'normal',
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            };
                            
                            tasks.push(newTask);
                            tasksCount++;
                            
                            const newLog = {
                                id: logs.length > 0 ? Math.max(...logs.map(l => l.id)) + 1 : 1,
                                task_id: newTask.id,
                                action: 'created',
                                previous_status: null,
                                new_status: newTask.status,
                                assignee: newTask.assignee,
                                created_at: new Date().toISOString()
                            };
                            
                            logs.push(newLog);
                        }
                    }
                }
            } catch (rowErr) {
                errors.push({ row: results.indexOf(row) + 1, error: rowErr.message });
            }
        }
        
        saveJSON(ROOMS_FILE, rooms);
        saveJSON(TASKS_FILE, tasks);
        saveJSON(LOGS_FILE, logs);
        
        res.json({
            success: true,
            rooms_imported: roomsCount,
            tasks_imported: tasksCount,
            errors: errors
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/export/csv', (req, res) => {
    try {
        updateOverdueTasks();
        
        const { room_id, task_type, status, date, assignee } = req.query;
        let tasks = loadJSON(TASKS_FILE);
        const rooms = loadJSON(ROOMS_FILE);
        
        if (room_id) {
            tasks = tasks.filter(t => t.room_id === parseInt(room_id));
        }
        
        if (task_type) {
            const types = task_type.split(',');
            tasks = tasks.filter(t => types.includes(t.task_type));
        }
        
        if (status) {
            const statuses = status.split(',');
            tasks = tasks.filter(t => statuses.includes(t.status));
        }
        
        if (date) {
            const dateObj = new Date(date);
            const startOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0);
            const endOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59);
            tasks = tasks.filter(t => {
                const startTime = new Date(t.start_time);
                return startTime >= startOfDay && startTime <= endOfDay;
            });
        }
        
        if (assignee) {
            tasks = tasks.filter(t => t.assignee === assignee);
        }
        
        tasks.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        
        const result = tasks.map(task => {
            const room = rooms.find(r => r.id === task.room_id);
            return {
                ...task,
                room_number: room ? room.room_number : '未知',
                floor: room ? room.floor : null,
                room_type: room ? room.type : null,
                capacity: room ? room.capacity : null
            };
        });
        
        const headers = [
            'room_number', 'floor', 'room_type', 'capacity',
            'task_type', 'title', 'description', 'status',
            'assignee', 'start_time', 'end_time', 'priority', 'created_at'
        ];
        
        let csvContent = headers.join(',') + '\n';
        
        for (const task of result) {
            const row = headers.map(header => {
                const value = task[header] || '';
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            });
            csvContent += row.join(',') + '\n';
        }
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=tasks.csv');
        res.send('\uFEFF' + csvContent);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/dashboard/stats', (req, res) => {
    try {
        updateOverdueTasks();
        
        const { startOfDay, endOfDay } = getTodayRange();
        const rooms = loadJSON(ROOMS_FILE);
        const tasks = loadJSON(TASKS_FILE);
        
        const todayTasks = tasks.filter(t => {
            const startTime = new Date(t.start_time);
            return startTime >= startOfDay && startTime <= endOfDay;
        });
        
        const assigneeStats = {};
        tasks.forEach(t => {
            if (t.assignee && t.status !== 'completed') {
                assigneeStats[t.assignee] = (assigneeStats[t.assignee] || 0) + 1;
            }
        });
        
        const stats = {
            total_rooms: rooms.length,
            today_tasks: todayTasks.length,
            pending_tasks: tasks.filter(t => t.status === 'pending').length,
            in_progress_tasks: tasks.filter(t => t.status === 'in_progress').length,
            pending_review_tasks: tasks.filter(t => t.status === 'pending_review').length,
            completed_tasks: tasks.filter(t => t.status === 'completed').length,
            overdue_tasks: tasks.filter(t => t.status === 'overdue').length,
            task_types: {},
            assignees: Object.entries(assigneeStats).map(([assignee, count]) => ({ assignee, count })).sort((a, b) => b.count - a.count)
        };
        
        for (const type of TASK_TYPES) {
            stats.task_types[type] = tasks.filter(t => t.task_type === type && t.status !== 'completed').length;
        }
        
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`民宿房态管理系统运行在 http://localhost:${PORT}`);
});
