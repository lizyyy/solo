const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = require('./database/init');
const taskRoutes = require('./routes/tasks');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use('/api/tasks', taskRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/roles', (req, res) => {
  db.all('SELECT * FROM export_roles WHERE is_active = 1', (err, roles) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const result = [];
    let completed = 0;
    
    roles.forEach(role => {
      db.all('SELECT * FROM field_strategies WHERE role_id = ?', [role.id], (err, strategies) => {
        result.push({ ...role, strategies });
        completed++;
        if (completed === roles.length) {
          res.json(result);
        }
      });
    });
    
    if (roles.length === 0) {
      res.json([]);
    }
  });
});

app.listen(PORT, () => {
  console.log('导出脱敏策略API服务启动成功');
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});