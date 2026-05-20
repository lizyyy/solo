const express = require('express');
const cors = require('cors');
const { eventRoutes, userRoutes, syncRoutes } = require('./routes');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sync', syncRoutes);

app.listen(PORT, () => {
  console.log(`订阅权益同步服务运行在 http://localhost:${PORT}`);
});
