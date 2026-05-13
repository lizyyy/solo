const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const uuid = require('uuid');
const moment = require('moment');
const Database = require('./database');

const app = express();
const db = new Database();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const api = require('./api')(db);
app.use('/api', api);

const PORT = process.env.PORT || 8888;

app.listen(PORT, () => {
  console.log(`维修外包工时结算系统已启动: http://localhost:${PORT}`);
});
