import express from 'express';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '企业培训平台证书撤销系统运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/certificate', routes);

app.listen(PORT, () => {
  console.log(`
=============================================
企业培训平台证书撤销系统
=============================================
服务已启动: http://localhost:${PORT}
健康检查: http://localhost:${PORT}/health

API 接口说明:

证书撤销相关:
  POST /api/certificate/revoke          - 撤销证书
  POST /api/certificate/review          - 人工复核
  POST /api/certificate/reject          - 驳回撤销
  POST /api/certificate/restore         - 恢复证书

查询相关:
  GET  /api/certificate/revocations     - 撤销记录列表
  GET  /api/certificate/revocations/:id - 撤销记录详情
  GET  /api/certificate/certificates    - 证书列表
  GET  /api/certificate/certificates/:id - 证书详情
  GET  /api/certificate/certificates/:certificateId/history - 证书操作历史
  GET  /api/certificate/verify/:certificateNo - 外部证书验证

导入导出相关:
  POST /api/certificate/import           - 批量导入撤销
  GET  /api/certificate/export/revocations - 导出撤销记录
  GET  /api/certificate/export/certificates - 导出证书列表
  GET  /api/certificate/import-records   - 查询导入记录
=============================================
  `);
});
