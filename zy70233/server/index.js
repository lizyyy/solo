const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database');
const routes = require('./routes');
const seedData = require('./seedData');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api', routes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

async function startServer() {
  await db.init();
  await seedData.loadSeedData();
  
  app.listen(PORT, () => {
    console.log(`🏨 酒店布草污渍分拣台已启动`);
    console.log(`📱 访问地址: http://localhost:${PORT}`);
    console.log(`💾 数据库: ${db.getDbPath()}`);
  });
}

startServer();

module.exports = app;
