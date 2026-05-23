const multer = require('multer');
const path = require('path');

const storage = multer.dis{Storage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../data/uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.mimetype === 'text/csv' || ext === '.csv') {
    cb(null, true);
  } else if (file.mimetype === 'application/json' || ext === '.json') {
    cb(null, true);
  } else {
    cb(new Error('叧敇个作 CSV 和 JSON 文件'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

module.exports = upload;
