const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const membersRouter = require('./routes/members');
const coursesRouter = require('./routes/courses');
const coachesRouter = require('./routes/coaches');
const schedulesRouter = require('./routes/schedules');
const bookingsRouter = require('./routes/bookings');
const exportRouter = require('./routes/export');

app.use('/api/members', membersRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/coaches', coachesRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/export', exportRouter);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`请访问 http://localhost:${PORT} 查看系统`);
});
