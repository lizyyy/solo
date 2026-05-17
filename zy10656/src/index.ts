import app from './app';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`采购协同系统到货差异确认 API 已启动`);
  console.log(`服务端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log('');
  console.log('API 文档:');
  console.log('  GET    /api/diff              - 获取差异记录列表');
  console.log('  GET    /api/diff/:id          - 获取差异记录详情');
  console.log('  GET    /api/diff/:id/history  - 获取差异记录历史');
  console.log('  POST   /api/diff              - 创建差异记录');
  console.log('  PUT    /api/diff/:id          - 更新差异记录');
  console.log('  POST   /api/diff/import       - 批量导入差异记录');
  console.log('  GET    /api/diff/export/data  - 导出数据(JSON)');
  console.log('  GET    /api/diff/export/csv   - 导出数据(CSV)');
});
