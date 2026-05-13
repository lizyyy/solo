const express = require('express');
const cron = require('node-cron');
const attachmentsRouter = require('./routes/attachments');
const { cleanupExpiredAttachments } = require('./services/cleanup');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/attachments', attachmentsRouter);

cron.schedule('0 * * * *', () => {
  console.log('[Cleanup] Running expired attachment cleanup...');
  const deleted = cleanupExpiredAttachments();
  console.log(`[Cleanup] Deleted ${deleted} expired attachments`);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
