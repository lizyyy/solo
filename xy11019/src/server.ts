import express from 'express';
import cors from 'cors';
import routes from './routes';
import { seedDatabase } from './scripts/seedData';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({
    name: '儿童托管班接送授权API',
    version: '1.0.0',
    description: '完整的儿童托管班接送授权管理系统',
    endpoints: {
      health: 'GET /api/health',
      authorizations: {
        list: 'GET /api/authorizations',
        get: 'GET /api/authorizations/:id',
        create: 'POST /api/authorizations',
        updateStatus: 'PUT /api/authorizations/:id/status',
        checkConsistency: 'GET /api/authorizations/:id/consistency',
        validatePickup: 'GET /api/authorizations/validate/pickup?guardianId=:gid&childId=:cid',
        delete: 'DELETE /api/authorizations/:id'
      },
      children: {
        list: 'GET /api/children',
        get: 'GET /api/children/:id',
        create: 'POST /api/children'
      },
      guardians: {
        list: 'GET /api/guardians',
        get: 'GET /api/guardians/:id',
        create: 'POST /api/guardians'
      },
      export: {
        json: 'POST /api/export/json',
        csv: 'POST /api/export/csv',
        listFiles: 'GET /api/export/files',
        download: 'GET /api/export/download/:filename'
      }
    },
    statusCodes: {
      draft: '草稿',
      pending_review: '待审批',
      approved: '已批准',
      rejected: '已拒绝',
      expired: '已过期',
      revoked: '已撤销',
      suspended: '已暂停'
    }
  });
});

seedDatabase();

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║          儿童托管班接送授权API 服务已启动                        ║
╠═══════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                             ║
║  API文档:  http://localhost:${PORT}/                            ║
║  健康检查:  http://localhost:${PORT}/api/health                 ║
╠═══════════════════════════════════════════════════════════════╣
║  状态流转说明:                                                  ║
║    draft → pending_review → approved/rejected                 ║
║    approved → revoked/suspended/expired                        ║
║    suspended → approved/revoked                                ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

export default app;
