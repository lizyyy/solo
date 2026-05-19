import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { AppDataSource } from './database';
import { ContentController } from './controllers/ContentController';
import { ContentService } from './services/ContentService';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

AppDataSource.initialize()
  .then(() => {
    console.log('Database connected successfully');
    
    const contentController = new ContentController();
    const contentService = new ContentService();

    app.post('/api/content', contentController.createContent);
    app.get('/api/content', contentController.getContentList);
    app.get('/api/content/:id', contentController.getContent);
    app.put('/api/content/:id', contentController.updateContent);
    app.post('/api/content/:id/submit-review', contentController.submitForReview);
    app.post('/api/content/:id/review', contentController.reviewContent);
    app.post('/api/content/:id/retry', contentController.retryPublish);
    app.post('/api/content/:id/publish-now', contentController.publishNow);
    app.post('/api/channels/:channelId/retry', contentController.retryChannelSync);
    app.post('/api/channels/:channelId/fix', contentController.fixChannelSync);
    app.get('/api/dashboard/stats', contentController.getDashboardStats);
    app.get('/api/content/:contentId/timeline', contentController.getTimeline);
    app.get('/api/calendar', contentController.getCalendar);
    app.get('/api/calendar/export', contentController.exportCalendar);

    cron.schedule('* * * * *', async () => {
      console.log('Processing scheduled content...');
      await contentService.processScheduledContent();
    });

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Database connection failed:', error);
    process.exit(1);
  });
