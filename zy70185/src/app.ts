import express from 'express';
import router from './routes';
import { config } from './config';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(router);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: '请求的接口不存在',
    timestamp: new Date().toISOString()
  });
});

export default app;
