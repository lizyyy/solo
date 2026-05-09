const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDataFiles } = require('./storage');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

initDataFiles();

app.use('/api', routes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`社区共享车位结算台运行在 http://localhost:${PORT}`);
});