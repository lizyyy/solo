import express from 'express';
import routes from './routes';

const app = express();
const PORT = 3000;

app.use('/api', routes);

app.listen(PORT, () => {
  console.log(`专线开通管理 API 服务已启动: http://localhost:${PORT}`);
  console.log('');
  console.log('API 端点列表:');
  console.log('  POST   /api/orders                    - 创建订单');
  console.log('  POST   /api/orders/:id/bind-device    - 绑定设备');
  console.log('  POST   /api/orders/:id/construction-node - 更新施工节点');
  console.log('  POST   /api/orders/:id/activate       - 确认开通');
  console.log('  POST   /api/orders/:id/change-bandwidth - 变更带宽');
  console.log('  POST   /api/orders/:id/suspend        - 暂停计费');
  console.log('  POST   /api/orders/:id/resume         - 恢复计费');
  console.log('  GET    /api/orders/:id                - 查询订单详情');
  console.log('  GET    /api/devices/available         - 查询可用设备');
});
