const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const ioModels = require('./models/io-models');
const experimentManager = require('./models/experiment-manager');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 12345;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api', routes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`I/O 模型对比实验台运行在 http://localhost:${PORT}`);
  console.log('按 Ctrl+C 停止服务器');
});
