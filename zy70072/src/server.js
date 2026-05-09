const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const initSqlJs = require('sql.js');

const app = express();
app.use(express.json());

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'meeting-archive.db');

let db;

const now = () => new Date().toISOString();

const saveDb = () => {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
};

const initDatabase = async () => {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT,
      scheduled_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      archived_at TEXT,
      is_archived INTEGER DEFAULT 0,
      UNIQUE(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      assignee TEXT,
      due_date TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      confirmed_at TEXT,
      completed_at TEXT,
      exported_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS status_changes (
      id TEXT PRIMARY KEY,
      todo_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      system_name TEXT,
      reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      todo_id TEXT NOT NULL,
      reminder_type TEXT,
      sent_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      resource_id TEXT,
      request_hash TEXT,
      response_data TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  saveDb();
};

const getOne = (sql, params = []) => {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const result = stmt.getAsObject();
    stmt.free();
    return result;
  }
  stmt.free();
  return null;
};

const getAll = (sql, params = []) => {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
};

const runSql = (sql, params = []) => {
  db.run(sql, params);
  saveDb();
};

const generateRequestHash = (data) => {
  return require('crypto').createHash('md5').update(JSON.stringify(data)).digest('hex');
};

const checkIdempotency = (action, resourceId, requestData) => {
  const hash = generateRequestHash(requestData);
  const existing = getOne(
    'SELECT * FROM idempotency_keys WHERE action = ? AND resource_id = ? AND request_hash = ?',
    [action, resourceId || '', hash]
  );
  return existing ? JSON.parse(existing.response_data) : null;
};

const recordIdempotency = (action, resourceId, requestData, responseData) => {
  const hash = generateRequestHash(requestData);
  runSql(
    'INSERT OR IGNORE INTO idempotency_keys (id, action, resource_id, request_hash, response_data) VALUES (?, ?, ?, ?, ?)',
    [uuidv4(), action, resourceId || null, hash, JSON.stringify(responseData)]
  );
};

app.post('/api/meetings', (req, res) => {
  const { title, content, scheduled_at } = req.body;
  
  if (!title) {
    return res.status(400).json({
      success: false,
      error: '会议标题不能为空',
      timestamp: now()
    });
  }

  const meetingId = uuidv4();
  runSql(
    'INSERT INTO meetings (id, title, content, scheduled_at) VALUES (?, ?, ?, ?)',
    [meetingId, title, content || '', scheduled_at || null]
  );

  const meeting = getOne('SELECT * FROM meetings WHERE id = ?', [meetingId]);

  res.status(201).json({
    success: true,
    message: '会议记录已创建',
    data: meeting,
    timestamp: now()
  });
});

app.get('/api/meetings/:id', (req, res) => {
  const meeting = getOne('SELECT * FROM meetings WHERE id = ?', [req.params.id]);
  
  if (!meeting) {
    return res.status(404).json({
      success: false,
      error: '会议不存在',
      timestamp: now()
    });
  }

  const todos = getAll('SELECT * FROM todos WHERE meeting_id = ?', [req.params.id]);
  
  res.json({
    success: true,
    data: {
      ...meeting,
      todos
    },
    timestamp: now()
  });
});

app.post('/api/meetings/:id/todos', (req, res) => {
  const meeting = getOne('SELECT * FROM meetings WHERE id = ?', [req.params.id]);
  
  if (!meeting) {
    return res.status(404).json({
      success: false,
      error: '会议不存在，无法拆分待办',
      timestamp: now()
    });
  }

  if (meeting.is_archived === 1) {
    return res.status(400).json({
      success: false,
      error: '会议已归档，不能再添加待办',
      timestamp: now()
    });
  }

  const todos = req.body.todos;
  
  if (!Array.isArray(todos) || todos.length === 0) {
    return res.status(400).json({
      success: false,
      error: '待办列表不能为空',
      timestamp: now()
    });
  }

  const invalidTodos = todos.filter(t => !t.title);
  if (invalidTodos.length > 0) {
    return res.status(400).json({
      success: false,
      error: '存在没有标题的待办项',
      invalid_count: invalidTodos.length,
      timestamp: now()
    });
  }

  const existingTitles = todos.map(t => t.title);
  const placeholders = existingTitles.map(() => '?').join(', ');
  const existingTitlesList = getAll(
    `SELECT title FROM todos WHERE meeting_id = ? AND title IN (${placeholders})`,
    [req.params.id, ...existingTitles]
  ).map(t => t.title);

  if (existingTitlesList.length > 0) {
    return res.status(409).json({
      success: false,
      error: '会议中已存在相同标题的待办',
      duplicate_titles: existingTitlesList,
      timestamp: now()
    });
  }

  const createdTodos = [];

  todos.forEach(todo => {
    const todoId = uuidv4();
    runSql(
      'INSERT INTO todos (id, meeting_id, title, content, assignee, due_date) VALUES (?, ?, ?, ?, ?, ?)',
      [todoId, req.params.id, todo.title, todo.content || '', todo.assignee || null, todo.due_date || null]
    );
    createdTodos.push(getOne('SELECT * FROM todos WHERE id = ?', [todoId]));
  });

  res.status(201).json({
    success: true,
    message: `已拆分 ${createdTodos.length} 个待办项`,
    data: createdTodos,
    timestamp: now()
  });
});

app.post('/api/todos/:id/confirm', (req, res) => {
  const todo = getOne('SELECT * FROM todos WHERE id = ?', [req.params.id]);
  
  if (!todo) {
    return res.status(404).json({
      success: false,
      error: '待办不存在',
      timestamp: now()
    });
  }

  if (todo.confirmed_at) {
    return res.status(200).json({
      success: true,
      message: '待办已确认，无需重复确认',
      data: todo,
      is_duplicate: true,
      timestamp: now()
    });
  }

  const { assignee } = req.body;
  if (!assignee && !todo.assignee) {
    return res.status(400).json({
      success: false,
      error: '确认时需要指定负责人',
      timestamp: now()
    });
  }

  const finalAssignee = assignee || todo.assignee;
  
  runSql(
    'UPDATE todos SET assignee = ?, confirmed_at = ?, status = ? WHERE id = ?',
    [finalAssignee, now(), 'confirmed', req.params.id]
  );

  runSql(
    'INSERT INTO status_changes (id, todo_id, from_status, to_status, reason) VALUES (?, ?, ?, ?, ?)',
    [uuidv4(), req.params.id, 'pending', 'confirmed', '负责人确认']
  );

  const updatedTodo = getOne('SELECT * FROM todos WHERE id = ?', [req.params.id]);

  res.status(200).json({
    success: true,
    message: '负责人已确认',
    data: updatedTodo,
    timestamp: now()
  });
});

app.post('/api/todos/:id/status', (req, res) => {
  const { status, system_name, reason } = req.body;
  
  if (!status) {
    return res.status(400).json({
      success: false,
      error: '状态不能为空',
      timestamp: now()
    });
  }

  const validStatuses = ['pending', 'confirmed', 'in_progress', 'blocked', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `无效的状态值，有效值: ${validStatuses.join(', ')}`,
      timestamp: now()
    });
  }

  const todo = getOne('SELECT * FROM todos WHERE id = ?', [req.params.id]);
  
  if (!todo) {
    return res.status(404).json({
      success: false,
      error: '待办不存在',
      timestamp: now()
    });
  }

  if (todo.status === status) {
    return res.status(200).json({
      success: true,
      message: '状态已为目标状态，无需更新',
      data: todo,
      is_duplicate: true,
      timestamp: now()
    });
  }

  const idempotentKey = { action: 'status_update', todo_id: req.params.id, status, system_name };
  const cached = checkIdempotency('status_update', req.params.id, idempotentKey);
  if (cached) {
    return res.status(200).json({
      ...cached,
      is_duplicate: true,
      message: '相同状态更新已处理过'
    });
  }

  const fromStatus = todo.status;
  
  runSql('UPDATE todos SET status = ? WHERE id = ?', [status, req.params.id]);

  if (status === 'completed') {
    runSql('UPDATE todos SET completed_at = ? WHERE id = ?', [now(), req.params.id]);
  }

  runSql(
    'INSERT INTO status_changes (id, todo_id, from_status, to_status, system_name, reason) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), req.params.id, fromStatus, status, system_name || 'manual', reason || null]
  );

  const updatedTodo = getOne('SELECT * FROM todos WHERE id = ?', [req.params.id]);

  const response = {
    success: true,
    message: `状态已从「${fromStatus}」更新为「${status}」`,
    data: updatedTodo,
    timestamp: now()
  };

  recordIdempotency('status_update', req.params.id, idempotentKey, response);

  res.status(200).json(response);
});

app.get('/api/todos/:id/history', (req, res) => {
  const todo = getOne('SELECT * FROM todos WHERE id = ?', [req.params.id]);
  
  if (!todo) {
    return res.status(404).json({
      success: false,
      error: '待办不存在',
      timestamp: now()
    });
  }

  const history = getAll(
    'SELECT * FROM status_changes WHERE todo_id = ? ORDER BY created_at ASC',
    [req.params.id]
  );

  const reminders = getAll(
    'SELECT * FROM reminders WHERE todo_id = ? ORDER BY sent_at ASC',
    [req.params.id]
  );

  res.json({
    success: true,
    data: {
      todo,
      status_history: history,
      reminders
    },
    timestamp: now()
  });
});

app.post('/api/reminders/check', (req, res) => {
  const { dueThreshold = 24 * 60 * 60 * 1000 } = req.body;
  const nowDate = new Date();
  const tomorrow = new Date(nowDate.getTime() + dueThreshold);
  
  const dueTodos = getAll(`
    SELECT t.*, m.title as meeting_title 
    FROM todos t 
    LEFT JOIN meetings m ON t.meeting_id = m.id
    WHERE t.status NOT IN ('completed', 'cancelled')
    AND t.due_date IS NOT NULL
    AND t.due_date <= ?
    AND t.due_date >= ?
  `, [tomorrow.toISOString().split('T')[0], nowDate.toISOString().split('T')[0]]);

  const overdueTodos = getAll(`
    SELECT t.*, m.title as meeting_title 
    FROM todos t 
    LEFT JOIN meetings m ON t.meeting_id = m.id
    WHERE t.status NOT IN ('completed', 'cancelled')
    AND t.due_date IS NOT NULL
    AND t.due_date < ?
  `, [nowDate.toISOString().split('T')[0]]);

  dueTodos.forEach(todo => {
    runSql(
      'INSERT INTO reminders (id, todo_id, reminder_type) VALUES (?, ?, ?)',
      [uuidv4(), todo.id, 'due_soon']
    );
  });

  overdueTodos.forEach(todo => {
    runSql(
      'INSERT INTO reminders (id, todo_id, reminder_type) VALUES (?, ?, ?)',
      [uuidv4(), todo.id, 'overdue']
    );
  });

  res.json({
    success: true,
    message: '检查完成',
    data: {
      due_soon: dueTodos,
      overdue: overdueTodos,
      total_reminders_sent: dueTodos.length + overdueTodos.length
    },
    timestamp: now()
  });
});

app.post('/api/meetings/:id/archive', (req, res) => {
  const meeting = getOne('SELECT * FROM meetings WHERE id = ?', [req.params.id]);
  
  if (!meeting) {
    return res.status(404).json({
      success: false,
      error: '会议不存在',
      timestamp: now()
    });
  }

  if (meeting.is_archived === 1) {
    return res.status(200).json({
      success: true,
      message: '会议已归档',
      data: meeting,
      is_duplicate: true,
      timestamp: now()
    });
  }

  const pendingTodos = getAll(
    'SELECT * FROM todos WHERE meeting_id = ? AND status NOT IN (?, ?)',
    [req.params.id, 'completed', 'cancelled']
  );

  if (pendingTodos.length > 0) {
    return res.status(400).json({
      success: false,
      error: '存在未完成的待办，无法归档',
      pending_todos: pendingTodos.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status
      })),
      timestamp: now()
    });
  }

  runSql('UPDATE meetings SET is_archived = 1, archived_at = ? WHERE id = ?', [now(), req.params.id]);

  const updatedMeeting = getOne('SELECT * FROM meetings WHERE id = ?', [req.params.id]);

  res.status(200).json({
    success: true,
    message: '会议已归档',
    data: updatedMeeting,
    timestamp: now()
  });
});

app.get('/api/meetings/:id/export', (req, res) => {
  const meeting = getOne('SELECT * FROM meetings WHERE id = ?', [req.params.id]);
  
  if (!meeting) {
    return res.status(404).json({
      success: false,
      error: '会议不存在',
      timestamp: now()
    });
  }

  const todos = getAll('SELECT * FROM todos WHERE meeting_id = ?', [req.params.id]);

  const todosWithHistory = todos.map(todo => {
    const history = getAll(
      'SELECT * FROM status_changes WHERE todo_id = ? ORDER BY created_at ASC',
      [todo.id]
    );
    
    return {
      ...todo,
      history
    };
  });

  const summary = {
    total: todos.length,
    completed: todos.filter(t => t.status === 'completed').length,
    cancelled: todos.filter(t => t.status === 'cancelled').length,
    pending: todos.filter(t => ['pending', 'confirmed', 'in_progress', 'blocked'].includes(t.status)).length
  };

  const exportData = {
    meeting,
    todos: todosWithHistory,
    summary,
    exported_at: now()
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="meeting-${req.params.id}-archive.json"`);
  
  res.json({
    success: true,
    message: '归档数据导出成功',
    data: exportData,
    timestamp: now()
  });
});

app.get('/api/meetings', (req, res) => {
  const { status = 'all' } = req.query;
  
  let meetings = getAll('SELECT * FROM meetings ORDER BY created_at DESC');
  
  if (status === 'archived') {
    meetings = meetings.filter(m => m.is_archived === 1);
  } else if (status === 'active') {
    meetings = meetings.filter(m => m.is_archived === 0);
  }

  const meetingsWithStats = meetings.map(meeting => {
    const todos = getAll('SELECT * FROM todos WHERE meeting_id = ?', [meeting.id]);
    return {
      ...meeting,
      todo_stats: {
        total: todos.length,
        completed: todos.filter(t => t.status === 'completed').length,
        pending: todos.filter(t => ['pending', 'confirmed', 'in_progress', 'blocked'].includes(t.status)).length
      }
    };
  });

  res.json({
    success: true,
    data: meetingsWithStats,
    timestamp: now()
  });
});

const PORT = process.env.PORT || 3000;

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`会议待办归档 API 服务已启动: http://localhost:${PORT}`);
    console.log(`数据库位置: ${dbPath}`);
  });
});

module.exports = app;
