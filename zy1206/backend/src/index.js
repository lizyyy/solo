const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const experimentsRouter = require('./routes/experiments');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Distributed Consistency Simulator API is running',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/experiments', experimentsRouter);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

app.listen(PORT, () => {
  console.log(`Distributed Consistency Simulator Backend running on port ${PORT}`);
  console.log(`API available at: http://localhost:${PORT}/api`);
});
