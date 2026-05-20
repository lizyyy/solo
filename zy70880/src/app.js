const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const batchRoutes = require('./routes/batches');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/batches', batchRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '冷库园区财务后端服务运行正常' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`冷库园区财务后端服务已启动，运行在 http://localhost:${PORT}`);
});
