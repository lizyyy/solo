const express = require('express');
const bodyParser = require('body-parser');
const routes = require('./routes');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '服务器内部错误',
      details: err.message
    }
  });
});

async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`资源配额借用API服务已启动: http://localhost:${PORT}`);
    console.log(`API文档请参考 README.md`);
  });
}

start();
