import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { initDatabase } from './database';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(process.cwd(), 'public')));

app.use('/api', routes);

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

initDatabase()
  .then(() => {
    console.log('Database initialized successfully');
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
