const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const projectRoutes = require('./routes/projectRoutes');
const proposalRoutes = require('./routes/proposalRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/proposals', proposalRoutes);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '售前方案版本台服务运行正常' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});
