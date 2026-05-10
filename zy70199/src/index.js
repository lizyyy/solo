const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const logger = require('./utils/logger');
const employeeRoutes = require('./routes/employee.routes');
const documentRoutes = require('./routes/document.routes');
const remediationRoutes = require('./routes/remediation.routes');
const contractRoutes = require('./routes/contract.routes');
const accountRoutes = require('./routes/account.routes');
const salaryRoutes = require('./routes/salary.routes');
const reportRoutes = require('./routes/report.routes');
const auditRoutes = require('./routes/audit.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.use('/api/employees', employeeRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/remediations', remediationRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'onboarding-document-service' });
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

module.exports = app;
