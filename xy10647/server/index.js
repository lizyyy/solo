const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = require('./database');
const inspectionRoutes = require('./routes/inspection');
const problemRoutes = require('./routes/problem');
const rectificationRoutes = require('./routes/rectification');
const reviewRoutes = require('./routes/review');
const storeRoutes = require('./routes/store');
const exportRoutes = require('./routes/export');
const importRoutes = require('./routes/import');

app.use('/api/inspections', inspectionRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/rectifications', rectificationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/import', importRoutes);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});

module.exports = app;
