import express from 'express';
import { loadConfig } from './config';
import correctionRoutes from './routes/correction';
import { correctionService } from './services/correction';
import { CorrectionStatus, SourceSystem } from './types';

async function bootstrap() {
  try {
    const config = loadConfig();
    const app = express();

    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    app.use('/api', correctionRoutes);

    app.get('/health', (_req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        storage: config.storageType
      });
    });

    app.listen(config.port, config.host, async () => {
      console.log(`
╔════════════════════════════════════════════════════════════════╗
║           视频点播后台试看权限纠偏系统                           ║
╠════════════════════════════════════════════════════════════════╣
║  服务地址: http://${config.host}:${config.port}                             ║
║  健康检查: http://${config.host}:${config.port}/health                     ║
║  API文档: 请参考 README.md                                      ║
╚════════════════════════════════════════════════════════════════╝
      `);

      await initAcceptanceData();
    });
  } catch (error) {
    console.error('启动失败:', error instanceof Error ? error.message : '未知错误');
    process.exit(1);
  }
}

async function initAcceptanceData() {
  console.log('\n正在初始化验收测试数据...\n');

  const flow1 = await correctionService.createCorrection({
    video: {
      videoId: 'v001',
      videoTitle: 'Node.js 入门教程',
      videoDuration: 3600,
      videoCategory: '技术教程'
    },
    user: {
      userId: 'u001',
      userName: '张三',
      userType: 'vip',
      isPaid: true
    },
    trialRule: {
      ruleId: 'r001',
      ruleName: '标准试看规则',
      ruleVersion: 'v1',
      trialDuration: 300,
      trialCount: 3,
      effectiveTime: '2024-01-01'
    },
    sourceSystem: SourceSystem.VOD_BACKEND,
    operatorId: 'admin',
    operatorName: '系统管理员'
  });

  if (flow1.record) {
    await correctionService.updateStatus({
      recordId: flow1.record.id,
      newStatus: CorrectionStatus.CORRECTED,
      operatorId: 'admin',
      operatorName: '系统管理员',
      remark: '已完成人工复核，确认纠偏'
    });

    await correctionService.updateStatus({
      recordId: flow1.record.id,
      newStatus: CorrectionStatus.REVOKED,
      operatorId: 'admin',
      operatorName: '系统管理员',
      remark: '复核完成，撤销该纠偏记录'
    });

    console.log('✅ 完整流转记录已创建（可试看 → 已纠偏 → 已撤销）');
  }

  const conflict1 = await correctionService.createCorrection({
    video: {
      videoId: 'v002',
      videoTitle: 'React 实战开发',
      videoDuration: 7200,
      videoCategory: '技术教程'
    },
    user: {
      userId: 'u002',
      userName: '李四',
      userType: 'paid',
      isPaid: true
    },
    trialRule: {
      ruleId: 'r002',
      ruleName: '会员试看规则',
      ruleVersion: 'v2',
      trialDuration: 600,
      trialCount: 5,
      effectiveTime: '2024-01-15'
    },
    sourceSystem: SourceSystem.VOD_BACKEND,
    operatorId: 'admin',
    operatorName: '系统管理员'
  });

  const conflict2 = await correctionService.createCorrection({
    video: {
      videoId: 'v002',
      videoTitle: 'React 实战开发',
      videoDuration: 7200,
      videoCategory: '技术教程'
    },
    user: {
      userId: 'u002',
      userName: '李四',
      userType: 'paid',
      isPaid: true
    },
    trialRule: {
      ruleId: 'r002',
      ruleName: '会员试看规则',
      ruleVersion: 'v2',
      trialDuration: 600,
      trialCount: 5,
      effectiveTime: '2024-01-15'
    },
    sourceSystem: SourceSystem.USER_CENTER,
    operatorId: 'admin',
    operatorName: '系统管理员'
  });

  const conflict3 = await correctionService.createCorrection({
    video: {
      videoId: 'v002',
      videoTitle: 'React 实战开发',
      videoDuration: 7200,
      videoCategory: '技术教程'
    },
    user: {
      userId: 'u002',
      userName: '李四',
      userType: 'paid',
      isPaid: true
    },
    trialRule: {
      ruleId: 'r002',
      ruleName: '会员试看规则',
      ruleVersion: 'v2',
      trialDuration: 600,
      trialCount: 5,
      effectiveTime: '2024-01-15'
    },
    sourceSystem: SourceSystem.ORDER_SYSTEM,
    operatorId: 'admin',
    operatorName: '系统管理员'
  });

  console.log('✅ 冲突记录已创建（3个不同系统写入同类数据）');

  const badCsvContent = `videoId,videoTitle,userId,userName,userType,ruleId,ruleName,ruleVersion,effectiveTime,sourceSystem
v003,TypeScript 进阶,u003,王五,invalid_type,r003,高级试看规则,v3,2024-02-01,vod_backend
v004,Vue3 实战,u004,赵六,free,r003,高级试看规则,v3,2024-02-01,invalid_system
v005,微服务架构,u005,钱七,paid,r005,企业试看规则,v2,2024-02-10,content_management
v006,数据结构,u006,孙八,paid,2024-02-15,vod_backend`;

  const importBadRows = await import('./services/importExport');
  await importBadRows.importExportService.importFromCsv(badCsvContent);

  console.log('✅ 导入坏行数据已创建（3条导入失败记录）');

  const paid1 = await correctionService.createCorrection({
    video: {
      videoId: 'v007',
      videoTitle: '付费用户专享内容',
      videoDuration: 5400,
      videoCategory: '付费课程'
    },
    user: {
      userId: 'u007',
      userName: '周九',
      userType: 'paid',
      isPaid: true
    },
    trialRule: {
      ruleId: 'r001',
      ruleName: '旧版试看规则',
      ruleVersion: 'v1.0',
      trialDuration: 300,
      effectiveTime: '2023-06-01'
    },
    sourceSystem: SourceSystem.VOD_BACKEND,
    operatorId: 'admin',
    operatorName: '系统管理员'
  });

  console.log('✅ 付费用户被旧规则限制的场景已创建');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  验收测试数据初始化完成!');
  console.log('  可通过以下接口进行验收:');
  console.log('  - GET  /api/summary          查看数据概览');
  console.log('  - GET  /api/corrections      查看纠偏记录列表');
  console.log('  - GET  /api/corrections/:id  查看记录详情');
  console.log('  - GET  /api/corrections/:id/history  查看操作历史');
  console.log('  - GET  /api/export           导出CSV');
  console.log('  - GET  /api/bad-rows         查看导入失败记录');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

bootstrap();
