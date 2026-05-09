const app = require('./app');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Points Freeze API is running on http://localhost:${PORT}`);
  console.log(`Database: ${process.env.DB_PATH || path.join(__dirname, '../data/app.db')}`);
});
