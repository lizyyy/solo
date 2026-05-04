const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'src/public')));

const apiRouter = require('./src/server/routes/api');
app.use('/api', apiRouter);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Band Rehearsal Review 服务已启动: http://localhost:${PORT}`);
  console.log('按 Ctrl+C 停止服务');
});
