import app from './app';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   配电柜温升工单回放后端服务已启动                           ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║   服务地址: http://localhost:${PORT}                           ║`);
  console.log('║   健康检查: GET /health                                      ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║   核心能力:                                                  ║');
  console.log('║   ✓ 每次改判都能查到来源（verdict_histories + audit_logs）   ║');
  console.log('║   ✓ 传感器日志原始保留（raw_sensor_logs，含脏数据标记）      ║');
  console.log('║   ✓ 设备编号重复自动挂起（宁可挂起也不假结论）               ║');
  console.log('║   ✓ 补录后结论变化留痕（旧材料+新备注+改判原因）             ║');
  console.log('║   ✓ 撤回记录完整保留（is_rescinded + 审计）                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
});
