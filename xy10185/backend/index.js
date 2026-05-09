const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const { initDatabase } = require('./db/init');
const projectsRouter = require('./src/routes/projects');
const milestonesRouter = require('./src/routes/milestones');
const deliverablesRouter = require('./src/routes/deliverables');
const reworksRouter = require('./src/routes/reworks');
const reportsRouter = require('./src/routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await initDatabase();
    
    app.use(cors());
    app.use(express.json());
    app.use(morgan('combined'));

    app.use('/api/projects', projectsRouter);
    app.use('/api/milestones', milestonesRouter);
    app.use('/api/deliverables', deliverablesRouter);
    app.use('/api/reworks', reworksRouter);
    app.use('/api/reports', reportsRouter);

    const frontendDist = path.join(__dirname, '../frontend/dist');
    if (fs.existsSync(frontendDist)) {
      app.use(express.static(frontendDist));
      
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api/')) {
          return next();
        }
        res.sendFile(path.join(frontendDist, 'index.html'));
      });
    }

    app.use((err, req, res, next) => {
      console.error('Server Error:', err);
      res.status(500).json({
        code: 500,
        success: false,
        message: err.message || '服务器内部错误',
        data: null
      });
    });

    app.listen(PORT, () => {
      console.log(`外包交付验收门户服务已启动`);
      console.log(`服务地址: http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
}

startServer();