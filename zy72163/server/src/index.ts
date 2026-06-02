import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDatabase } from './database';
import { seedDatabase } from './seed';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

initDatabase();
seedDatabase();

app.use('/api', routes);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 树木修剪排程API服务已启动: http://localhost:${PORT}`);
  console.log(`📊 API文档: http://localhost:${PORT}/api/health`);
});
