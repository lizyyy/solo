import express from 'express';
import usersRoute from './routes/users';
import collectionsRoute from './routes/collections';
import transfersRoute from './routes/transfers';
import adminRoute from './routes/admin';

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use('/users', usersRoute);
app.use('/collections', collectionsRoute);
app.use('/transfers', transfersRoute);
app.use('/admin', adminRoute);

export default app;
