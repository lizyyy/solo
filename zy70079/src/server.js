require('dotenv').config();
const app = require('./app');
const Scheduler = require('./services/scheduler');

const PORT = process.env.PORT || 3000;

Scheduler.init();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
