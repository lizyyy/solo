const express = require('express');
const multer = require('multer');
const scheduleRoutes = require('./routes/scheduleRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use('/api/schedule', scheduleRoutes(upload));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '产后康复排程API运行正常' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`产后康复排程API运行在 http://localhost:${PORT}`);
  });
}

module.exports = app;
