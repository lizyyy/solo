require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const projectsRouter = require('./routes/projects');
const migrationsRouter = require('./routes/migrations');
const executionRouter = require('./routes/execution');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.set('json spaces', 2);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'SQLite Migration Manager API',
      version: '1.0.0',
      description: 'A local backend API service for managing SQLite migration scripts',
      endpoints: {
        projects: {
          list: 'GET /api/projects',
          create: 'POST /api/projects',
          get: 'GET /api/projects/:id',
          update: 'PUT /api/projects/:id',
          delete: 'DELETE /api/projects/:id',
          migrations: 'GET /api/projects/:id/migrations',
          history: 'GET /api/projects/:id/history'
        },
        migrations: {
          list: 'GET /api/migrations/:projectId',
          create: 'POST /api/migrations/:projectId',
          get: 'GET /api/migrations/:projectId/:migrationId',
          update: 'PUT /api/migrations/:projectId/:migrationId',
          delete: 'DELETE /api/migrations/:projectId/:migrationId',
          import: 'POST /api/migrations/:projectId/import',
          parse: 'POST /api/migrations/:projectId/parse',
          validate: 'POST /api/migrations/:projectId/validate'
        },
        execution: {
          plan: 'POST /api/execution/:projectId/plan',
          apply: 'POST /api/execution/:projectId/apply',
          rollback: 'POST /api/execution/:projectId/rollback',
          check: 'GET /api/execution/:projectId/check',
          export: 'GET /api/execution/:projectId/export',
          preview_export: 'GET /api/execution/:projectId/preview-export'
        }
      }
    }
  });
});

app.use('/api/projects', projectsRouter);
app.use('/api/migrations', migrationsRouter);
app.use('/api/execution', executionRouter);

app.use(notFoundHandler);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║    SQLite Migration Manager API                           ║
║    Version: 1.0.0                                         ║
║                                                           ║
║    Server is running on http://localhost:${PORT}             ║
║    Environment: ${process.env.NODE_ENV || 'development'}                        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
  
  console.log('Available endpoints:');
  console.log('  GET    /health                       - Health check');
  console.log('  GET    /                             - API info');
  console.log('  GET    /api/projects                 - List projects');
  console.log('  POST   /api/projects                 - Create project');
  console.log('  GET    /api/projects/:id             - Get project details');
  console.log('  PUT    /api/projects/:id             - Update project');
  console.log('  DELETE /api/projects/:id             - Delete project');
  console.log('');
  console.log('  POST   /api/execution/:projectId/plan     - Generate execution plan');
  console.log('  POST   /api/execution/:projectId/apply    - Apply migrations (with dry-run)');
  console.log('  POST   /api/execution/:projectId/rollback - Rollback migrations (with dry-run)');
  console.log('  GET    /api/execution/:projectId/check    - Health check database');
  console.log('  GET    /api/execution/:projectId/export   - Export migration report');
  console.log('');
});

module.exports = app;
