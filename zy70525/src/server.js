const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { requestLogger, logger } = require('./middleware/logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.use('/api', routes);

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`Event Sourcing Correction API running on port ${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/api/health`);
});
