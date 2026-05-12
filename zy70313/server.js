import express from 'express';
import bodyParser from 'body-parser';
import idempotencyRoutes from './routes/idempotency.js';
import config from './config.js';
import { idempotencyService } from './services/IdempotencyService.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    config: {
      defaultTTL: config.idempotency.defaultTTL,
      allowReuseAfterExpiry: config.idempotency.allowReuseAfterExpiry,
      cleanupInterval: config.idempotency.cleanupInterval,
    },
  });
});

app.use('/api/idempotent', idempotencyRoutes);

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: err.message,
  });
});

const scheduledCleanup = setInterval(() => {
  const result = idempotencyService.cleanupExpired();
  if (result.count > 0) {
    console.log(`[定时清理] 清理了 ${result.count} 个过期幂等键: ${result.keys.join(', ')}`);
  }
}, config.idempotency.cleanupInterval * 1000);

process.on('SIGINT', () => {
  console.log('正在关闭服务器...');
  clearInterval(scheduledCleanup);
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`幂等键冲突排查 API 服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`配置: TTL=${config.idempotency.defaultTTL}s, 过期复用=${config.idempotency.allowReuseAfterExpiry}`);
  console.log('');
  console.log('可用接口:');
  console.log('  POST /api/idempotent/business/{payment|refund|coupon}  - 幂等请求');
  console.log('  GET  /api/idempotent/{idempotencyKey}                   - 查询幂等键详情');
  console.log('  GET  /api/idempotent/{key}/diff/{idx1}/{idx2}           - 比较请求差异');
  console.log('  GET  /api/idempotent/{key}/advice                       - 获取调用方建议');
  console.log('  POST /api/idempotent/cleanup                            - 手动触发过期清理');
  console.log('');
  console.log('测试示例:');
  console.log('  1. 支付成功重试: 先发起支付，再用相同参数重试');
  console.log('  2. 退款参数冲突: 先发起退款，再用不同参数重试');
  console.log('  3. 发券处理中重试: 发券处理中立即重试');
  console.log('  4. 过期清理: 修改配置缩短TTL，验证清理和审计保留');
});

export default app;
