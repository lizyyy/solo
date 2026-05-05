import express from 'express';
import cors from 'cors';
import { DatabaseService } from './services/databaseService.js';
import { HydraulicCalculator } from './services/hydraulicCalculator.js';
import { DataImporter } from './services/dataImporter.js';
import { ExportService } from './services/exportService.js';
import { ProjectController } from './controllers/projectController.js';
import { createProjectRoutes } from './routes/projectRoutes.js';

const PORT = process.env.PORT || 3001;

async function startServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const dbService = new DatabaseService();
  await dbService.initialize();

  const calculator = new HydraulicCalculator();
  const importer = new DataImporter();
  const exporter = new ExportService();

  const projectController = new ProjectController(
    dbService,
    calculator,
    importer,
    exporter
  );

  const projectRoutes = createProjectRoutes(projectController);
  app.use('/api/projects', projectRoutes);

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  app.listen(PORT, () => {
    console.log(`水力平衡试算工具后端服务已启动`);
    console.log(`服务地址: http://localhost:${PORT}`);
    console.log(`API文档: /api/projects`);
  });
}

startServer().catch((error) => {
  console.error('启动服务失败:', error);
  process.exit(1);
});
