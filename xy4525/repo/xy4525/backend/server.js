const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const batchRoutes = require('./routes/batch');
const analysisRoutes = require('./routes/analysis');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

app.use('/api/batch', batchRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/export', exportRoutes);

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ 
    success: true, 
    filePath: `/uploads/${req.file.filename}`,
    originalName: req.file.originalname
  });
});

app.post('/api/upload-multiple', upload.array('files', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  const fileInfos = req.files.map(file => ({
    filePath: `/uploads/${file.filename}`,
    originalName: file.originalname,
    fieldname: file.fieldname
  }));
  res.json({ success: true, files: fileInfos });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`县粮库质检工具运行在 http://localhost:${PORT}`);
});
