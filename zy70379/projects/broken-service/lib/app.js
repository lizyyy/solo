const express = require('express');

const app = express();
const port = 8080;

app.get('/status', (req, res) => {
  console.log('Health check called');
  res.send('OK');
});

app.listen(port, () => {
  console.log(`Service running on port ${port}`);
});
