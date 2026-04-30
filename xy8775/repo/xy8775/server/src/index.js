const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

require('./models/database');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const eventDatesRouter = require('./routes/eventDates');
const positionsRouter = require('./routes/positions');
const skillsRouter = require('./routes/skills');
const volunteersRouter = require('./routes/volunteers');
const schedulesRouter = require('./routes/schedules');
const importExportRouter = require('./routes/importExport');
const conflictsRouter = require('./routes/conflicts');
const schedulingRouter = require('./routes/scheduling');

app.use('/api/event-dates', eventDatesRouter);
app.use('/api/positions', positionsRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/volunteers', volunteersRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/import-export', importExportRouter);
app.use('/api/conflicts', conflictsRouter);
app.use('/api/scheduling', schedulingRouter);

app.use('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`Volunteer Scheduling Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});
