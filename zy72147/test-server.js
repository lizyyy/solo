const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

console.log('Starting test server...');
console.log('__dirname:', __dirname);
console.log('cwd:', process.cwd());

try {
  const app = express();
  const PORT = 3001;

  app.use(cors());
  app.use(express.json());
  
  const clientPath = path.join(__dirname, 'client/dist');
  console.log('Serving static files from:', clientPath);
  console.log('Path exists:', fs.existsSync(clientPath));
  
  app.use(express.static(clientPath));

  app.get('/api/test', (req, res) => {
    res.json({ message: 'Server is working!' });
  });

  app.get('*', (req, res) => {
    const indexPath = path.join(clientPath, 'index.html');
    console.log('Sending index from:', indexPath);
    res.sendFile(indexPath);
  });

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
} catch (e) {
  console.error('Error:', e);
}
