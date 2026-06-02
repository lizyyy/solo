const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./database');
const uploadRoutes = require('./routes/upload');
const validationRoutes = require('./routes/validation');
const exportRoutes = require('./routes/export');
const notesRoutes = require('./routes/notes');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

initDB();

app.use('/api/upload', uploadRoutes);
app.use('/api/validation', validationRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/notes', notesRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`管弦乐谱页码校验系统运行在 http://localhost:${PORT}`);
});
