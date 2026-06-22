const express = require('express');
const app = express();
const PORT = parseInt(process.env.BACKEND_PORT || 3002);

console.log('Starting server...');

app.get('/api/test', (req, res) => {
  res.json({ code: 0, data: 'hello' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Keep alive
setInterval(() => {
  console.log('server alive');
}, 5000);
