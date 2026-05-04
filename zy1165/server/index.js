const express = require('express');
const cors = require('cors');
const path = require('path');
const experimentRoutes = require('./routes/experiments');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

app.use('/api/experiments', experimentRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.listen(PORT, () => {
  console.log(`限流实验台运行在 http://localhost:${PORT}`);
});
