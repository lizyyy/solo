import express from 'express';
import cors from 'cors';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 38765;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({
    name: 'PR Review Evidence Folder Server',
    version: '0.1.0',
    endpoints: {
      health: 'GET /api/health',
      prs: 'GET/POST /api/prs',
      pr: 'GET/DELETE /api/prs/:id',
      importDiff: 'POST /api/prs/import-diff',
      cards: 'GET /api/prs/:prId/cards, POST /api/cards',
      card: 'GET/PATCH/DELETE /api/cards/:id',
      locations: 'POST /api/cards/:id/locations',
      attachments: 'POST /api/cards/:id/attachments',
      exportMarkdown: 'GET /api/prs/:prId/export/markdown',
      exportJson: 'GET /api/prs/:prId/export/json'
    }
  });
});

app.listen(PORT, () => {
  console.log(`PR Review Evidence Folder Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
