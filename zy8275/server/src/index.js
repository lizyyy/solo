import express from 'express';
import cors from 'cors';
import { initSchema } from './schema.js';
import { seedData } from './seed.js';
import routes from './routes.js';
import { initDatabase } from './database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function startServer() {
  try {
    await initDatabase();
    initSchema();
    seedData();
    
    app.use('/api', routes);

    app.get('/', (req, res) => {
      res.json({ 
        message: '商场夜间施工申请管理系统 API',
        endpoints: {
          health: 'GET /api/health',
          applications: 'GET /api/applications',
          dashboard: 'GET /api/dashboard/stats',
          export_csv: 'GET /api/export/csv',
          export_md: 'GET /api/export/markdown'
        }
      });
    });

    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();
