const express = require('express');
const cors = require('cors');
const path = require('path');

const leaseRoutes = require('./routes/leaseRoutes');
const renewalRoutes = require('./routes/renewalRoutes');
const depositRoutes = require('./routes/depositRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const checkoutRoutes = require('./routes/checkoutRoutes');
const pendingRoutes = require('./routes/pendingRoutes');
const logRoutes = require('./routes/logRoutes');
const exportRoutes = require('./routes/exportRoutes');
const sampleDataRoutes = require('./routes/sampleDataRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/leases', leaseRoutes);
app.use('/api/renewals', renewalRoutes);
app.use('/api/deposits', depositRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/pending', pendingRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/sample', sampleDataRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Apartment Lease API is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
