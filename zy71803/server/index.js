const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║      多账户资金水位管理系统已启动                              ║
║                                                              ║
║      访问地址: http://localhost:${PORT}                        ║
║      API文档:  http://localhost:${PORT}/api/health             ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
