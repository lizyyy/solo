const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, '../data');
const UPLOADS_DIR = path.join(__dirname, '../uploads');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

fs.mkdirSync(DATA_DIR, { recursive: true });

const router = require('./routes');
app.use('/api', router);

app.listen(PORT, () => {
  console.log(`夜骑队长工具已启动: http://localhost:${PORT}`);
});
