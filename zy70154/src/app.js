const express = require('express');
require('dotenv').config();

const servicesRouter = require('./routes/services');
const dependenciesRouter = require('./routes/dependencies');
const changeNoticesRouter = require('./routes/changeNotices');
const subscriptionsRouter = require('./routes/subscriptions');
const reportsRouter = require('./routes/reports');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
});

app.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'service-dependency-subscription-api',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

app.use('/api/services', servicesRouter);
app.use('/api/dependencies', dependenciesRouter);
app.use('/api/change-notices', changeNoticesRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/reports', reportsRouter);

app.get('/api', (req, res) => {
    res.json({
        success: true,
        api_version: '1.0.0',
        endpoints: {
            services: {
                'GET /api/services': 'List all services',
                'GET /api/services/:id': 'Get service details with dependencies',
                'POST /api/services': 'Create a new service',
                'PUT /api/services/:id': 'Update service'
            },
            dependencies: {
                'GET /api/dependencies/graph': 'Get dependency graph',
                'POST /api/dependencies': 'Create dependency',
                'PUT /api/dependencies/:id': 'Update dependency',
                'DELETE /api/dependencies/:id': 'Deactivate dependency'
            },
            changeNotices: {
                'GET /api/change-notices': 'List change notices',
                'GET /api/change-notices/preview-calculation': 'Preview compatibility/rollback calculation',
                'POST /api/change-notices': 'Create change notice draft',
                'POST /api/change-notices/:id/publish': 'Publish notice',
                'GET /api/change-notices/:id': 'Get notice details'
            },
            subscriptions: {
                'GET /api/subscriptions': 'List subscriptions',
                'GET /api/subscriptions/my-subscriptions/:serviceId': 'Get service subscriptions',
                'POST /api/subscriptions/:id/confirm': 'Confirm subscription',
                'GET /api/subscriptions/:id': 'Get subscription details'
            },
            reports: {
                'GET /api/reports/impact-analysis': 'Impact analysis report',
                'GET /api/reports/compatibility-status': 'Compatibility status',
                'GET /api/reports/change-report': 'Change report',
                'GET /api/reports/export/subscriptions': 'Export subscriptions (CSV/JSON)',
                'GET /api/reports/export/change-report': 'Export change report (CSV)',
                'GET /api/reports/snapshots/:id': 'Get report snapshot'
            }
        }
    });
});

app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    const statusCode = err.statusCode || 500;
    
    res.status(statusCode).json({
        success: false,
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
