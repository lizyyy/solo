import express from 'express';
import cors from 'cors';
import { dataStore } from './store/dataStore';
import checkRoutes from './routes/checkRoutes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/checks', checkRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

dataStore.generateMockData();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
