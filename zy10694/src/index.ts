import express from 'express';
import cron from 'node-cron';
import { router } from './routes';
import { extensionService } from './service';

const app = express();
const PORT = process.env.PORT || 3000;

app.use('/api/v1/deprecation-extension', router);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'deprecation-extension-api',
    timestamp: new Date().toISOString()
  });
});

cron.schedule('0 9 * * *', async () => {
  console.log('Running daily expiration reminder check...');
  try {
    const expiring = await extensionService.getExpiringExtensions(7);
    if (expiring.length > 0) {
      console.log(`Found ${expiring.length} extensions expiring in 7 days`);
      expiring.forEach(ext => {
        console.log(`  - ${ext.apiPath} (${ext.caller}) expires on ${ext.extendedDeprecationDate}`);
      });
    }
  } catch (error) {
    console.error('Error checking expiring extensions:', error);
  }
});

cron.schedule('0 * * * *', async () => {
  console.log('Running hourly sync check...');
  try {
    const unsynced = await extensionService.getUnsyncedExtensions();
    if (unsynced.length > 0) {
      console.log(`Found ${unsynced.length} unsynced extensions`);
      unsynced.forEach(ext => {
        console.log(`  - ${ext.apiPath} (${ext.caller}) sync status: ${ext.syncStatus}`);
      });
    }
  } catch (error) {
    console.error('Error checking unsynced extensions:', error);
  }
});

app.listen(PORT, () => {
  console.log(`Deprecation Extension API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API base: http://localhost:${PORT}/api/v1/deprecation-extension`);
});
