import express from 'express';
import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  format: format.json(),
  level: 'info',
  transports: [new transports.Console()]
});

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', version: '1.0.0' });
});

app.listen(PORT, () => {
  logger.info('Server started', { port: PORT });
});
