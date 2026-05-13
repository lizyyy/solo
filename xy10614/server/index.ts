import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import visitorRoutes from './routes/visitorRoutes';
import exportRoutes from './routes/exportRoutes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

app.use('/api', visitorRoutes);
app.use('/api', exportRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '访客管理系统服务运行正常' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
