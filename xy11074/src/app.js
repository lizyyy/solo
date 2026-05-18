const express = require('express');
const bodyParser = require('body-parser');
const sampleRoutes = require('./routes/samples');

const app = express();
const PORT = process.env.PORT || 3001;

console.log('========================================');
console.log('  企业礼品仓礼品定制打样 API 服务');
console.log('========================================\n');

const requiredConfigs = ['NODE_ENV'];
const missingConfigs = requiredConfigs.filter(config => !process.env[config]);
if (missingConfigs.length > 0) {
  console.log('⚠️  缺少以下配置:');
  missingConfigs.forEach(config => console.log(`   - ${config}`));
  console.log('\n💡  当前使用默认配置运行...\n');
} else {
  console.log('✅ 配置检查通过\n');
}

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use('/api/samples', sampleRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '企业礼品仓礼品定制打样 API 服务运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.use((err, req, res, next) => {
  console.error('❌ 服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    path: req.path
  });
});

app.listen(PORT, () => {
  console.log('🚀 服务启动成功！');
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`🔍 健康检查: http://localhost:${PORT}/api/health`);
  console.log('\n📋 可用接口:');
  console.log('   POST   /api/samples              - 单条创建打样记录');
  console.log('   PUT    /api/samples/:sampleId    - 更新打样记录');
  console.log('   GET    /api/samples/:sampleId    - 查询单条打样记录');
  console.log('   GET    /api/samples              - 查询打样记录列表');
  console.log('   POST   /api/samples/batch/import - 批量补录打样记录');
  console.log('   GET    /api/samples/:sampleId/check-old-design - 检查旧稿新单情况');
  console.log('   GET    /api/samples/:sampleId/check-tracker    - 检查打样轨迹一致性');
  console.log('   GET    /api/samples/:sampleId/next-steps       - 获取下一步处理建议');
  console.log('   GET    /api/samples/export/download            - 导出打样记录CSV');
  console.log('\n💡 提示: 系统已预加载3条样例数据用于测试');
  console.log('========================================\n');
});

module.exports = app;