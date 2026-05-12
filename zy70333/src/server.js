const express = require('express');
const mongoose = require('mongoose');
const formRoutes = require('./routes/formRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const exportRoutes = require('./routes/exportRoutes');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lowcode_form';

app.use(express.json());

app.use('/api/forms', formRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/export', exportRoutes);

app.get('/', (req, res) => {
  res.json({
    name: 'Low-Code Form Version API',
    version: '1.0.0',
    endpoints: {
      forms: '/api/forms',
      submissions: '/api/submissions',
      export: '/api/export'
    }
  });
});

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
    console.log('Starting server with in-memory data store...');
    
    const { initializeInMemoryStore } = require('./utils/inMemoryStore');
    initializeInMemoryStore();
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} (in-memory mode)`);
    });
  });

module.exports = app;