const express = require('express');
const routes = require('./routes');
const { initializeDemoData } = require('./bootstrap');

const app = express();
const PORT = process.env.PORT || 3000;

initializeDemoData();

app.use(express.json());
app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
