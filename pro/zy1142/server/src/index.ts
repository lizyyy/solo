import express from 'express';
import cors from 'cors';
import problemsRouter from './routes/problems';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/problems', problemsRouter);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err instanceof Error ? err.message : 'Unknown error',
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  Physics Solver Server`);
  console.log(`========================================`);
  console.log(`  Server running on port ${PORT}`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`========================================\n`);
  console.log(`Available API endpoints:`);
  console.log(`  GET  /api/health                    - Health check`);
  console.log(`  GET  /api/problems/types            - Get all problem types`);
  console.log(`  GET  /api/problems/types/:type/defaults - Get default params`);
  console.log(`  GET  /api/problems                  - Get all problems`);
  console.log(`  GET  /api/problems/:id              - Get problem by id`);
  console.log(`  POST /api/problems                  - Create new problem`);
  console.log(`  PUT  /api/problems/:id              - Update problem`);
  console.log(`  DELETE /api/problems/:id            - Delete problem`);
  console.log(`  POST /api/problems/:id/solve        - Solve a problem`);
  console.log(`  POST /api/problems/solve            - Solve without saving`);
  console.log(`  POST /api/problems/:id/export       - Export problem solution`);
  console.log(`  POST /api/problems/reset            - Reset to seed problems`);
  console.log(`\n========================================\n`);
});
