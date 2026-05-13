import express from 'express';
import cors from 'cors';
import sequelize from './database';
import waitlistRoutes from './routes/waitlist';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api/waitlist', waitlistRoutes);

app.get('/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

sequelize.sync({ alter: true }).then(() => {
  console.log('Database synchronized');
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}).catch((error) => {
  console.error('Database synchronization error:', error);
});
