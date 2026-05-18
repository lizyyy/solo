import express from 'express';
import { initDatabase } from './scripts/init-db';
import certificateReissueRoutes from './routes/certificate-reissue.routes';
import exportRoutes from './routes/export.routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/', (req, res) => {
  res.json({
    服务名称: '职业培训班学员证书补办 API',
    版本: '1.0.0',
    状态: '运行中',
    说明: '职业培训班学员证书补办管理系统API接口',
    接口列表: {
      补办申请管理: {
        提交补办申请: 'POST /api/certificate-reissue/applications',
        审核补办申请: 'PUT /api/certificate-reissue/applications/review',
        查询申请列表: 'GET /api/certificate-reissue/applications',
        查询申请详情: 'GET /api/certificate-reissue/applications/:申请编号'
      },
      数据导出: {
        导出补办申请数据: 'GET /api/export/applications?format=json|csv',
        导出学员证书记录: 'GET /api/export/student/:学员编号/certificates?format=json|csv'
      }
    },
    测试用数据说明: {
      学员编号: ['XY001', 'XY002', 'XY003', 'XY004', 'XY005'],
      原始证书编号: ['ZS00120230001', 'ZS00220230002', 'ZS00320230003', 'ZS00120230004', 'ZS00420230005'],
      校区编号: ['XQ001', 'XQ002', 'XQ003', 'XQ004'],
      申请状态: ['待审核', '待处理', '已通过', '已驳回'],
      补办原因: ['遗失', '损毁', '信息变更', '其他']
    }
  });
});

app.use('/api/certificate-reissue', certificateReissueRoutes);
app.use('/api/export', exportRoutes);

app.use((req, res) => {
  res.status(404).json({
    成功: false,
    错误: {
      错误代码: 'NOT_FOUND',
      错误消息: '接口不存在',
      错误详情: `请求路径 ${req.method} ${req.path} 不存在`,
      建议操作: '请检查接口地址是否正确'
    }
  });
});

async function startServer() {
  try {
    await initDatabase();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`  职业培训班学员证书补办 API 服务已启动`);
      console.log(`  服务地址: http://localhost:${PORT}`);
      console.log(`========================================\n`);
      console.log(`快速测试接口:`);
      console.log(`  查看服务信息: curl http://localhost:${PORT}`);
      console.log(`  查询申请列表: curl http://localhost:${PORT}/api/certificate-reissue/applications`);
      console.log(`  导出CSV数据: curl http://localhost:${PORT}/api/export/applications?format=csv`);
      console.log(`\n如需导入种子数据，请运行: npm run seed`);
    });
  } catch (error) {
    console.error('服务启动失败:', error);
    process.exit(1);
  }
}

startServer();
