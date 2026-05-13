const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

require('./routes/volunteerSkills')(app, db);
require('./routes/shiftSchedules')(app, db);
require('./routes/attendance')(app, db);
require('./routes/materialPackages')(app, db);
require('./routes/subsidy')(app, db);
require('./routes/exceptionList')(app, db);
require('./routes/timeline')(app, db);
require('./routes/report')(app, db);
require('./routes/initData')(app, db);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '志愿者补贴系统运行正常' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
