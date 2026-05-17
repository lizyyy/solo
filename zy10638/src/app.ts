import express from 'express';
import matchRoutes from './routes/matchRoutes';
import { initDatabase } from './models/database';

const app = express();
const PORT = process.env.PORT || 3000;

initDatabase();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/matches', matchRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default app;
