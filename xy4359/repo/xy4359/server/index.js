const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

const dataRouter = require('./api/data');
const levelsRouter = require('./api/levels');
const rehearsalsRouter = require('./api/rehearsals');
const exportRouter = require('./api/export');

app.use('/api/data', dataRouter);
app.use('/api/levels', levelsRouter);
app.use('/api/rehearsals', rehearsalsRouter);
app.use('/api/export', exportRouter);

app.use(express.static(path.join(__dirname, '../client/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`舞台监督后端服务器运行在 http://localhost:${PORT}`);
});
