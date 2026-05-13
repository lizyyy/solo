const express = require('express');
const morgan = require('morgan');
const config = require('config');

const app = express();
const port = process.env.PORT || 3000;

app.use(morgan('combined'));

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Service running on port ${port}`);
});
