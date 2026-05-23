const express = require('express');
const cors = require('cors');
const reconciliationRoutes = require('./routes/reconciliationRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Chain Store Reconciliation API',
    version: '1.0.0',
    endpoints: {
      import: '/api/recon/import',
      run: '/api/recon/run',
      list: '/api/recon/li',
      report: '/api/recon/report',
      summary: '/api/recon/summary'
    }
  });
});

reconciliationRoutes(app);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
