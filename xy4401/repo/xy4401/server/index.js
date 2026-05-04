const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const uploadsRouter = require('./routes/uploads');
const schedulingRouter = require('./routes/scheduling');
const exportRouter = require('./routes/export');

app.use('/api/uploads', uploadsRouter);
app.use('/api/scheduling', schedulingRouter);
app.use('/api/export', exportRouter);

app.use(express.static(path.join(__dirname, '../client/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`潮汐排程服务运行在端口 ${PORT}`);
  console.log(`访问 http://localhost:${PORT} 使用应用`);
});

module.exports = app;
