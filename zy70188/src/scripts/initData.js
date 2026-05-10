const { sequelize, SegmentPool } = require('../models');
const logger = require('../config/logger');

async function initTestData() {
  try {
    await sequelize.authenticate();
    logger.info('数据库连接成功');

    await sequelize.sync();
    logger.info('数据库模型同步完成');

    const existingSegments = await SegmentPool.count();
    if (existingSegments > 0) {
      logger.info('已存在号段数据，跳过初始化');
      return;
    }

    const segments = [
      {
        segment_code: 'RECEIPT_2024',
        segment_name: '2024年度收据号段',
        prefix: 'R',
        start_number: 10000001,
        end_number: 10999999,
        description: '2024年全年使用的收据号段',
        status: 'active',
        created_by: 'system',
        updated_by: 'system'
      },
      {
        segment_code: 'RECEIPT_2024_TEST',
        segment_name: '测试用号段',
        prefix: 'TEST',
        start_number: 1,
        end_number: 1000,
        description: '测试环境使用的号段',
        status: 'active',
        created_by: 'system',
        updated_by: 'system'
      }
    ];

    for (const seg of segments) {
      await SegmentPool.create({
        ...seg,
        current_number: seg.start_number - 1
      });
      logger.info(`创建号段成功: ${seg.segment_name} (${seg.start_number}-${seg.end_number})`);
    }

    logger.info('测试数据初始化完成');
    logger.info('可运行以下命令测试API:');
    logger.info('  curl http://localhost:3000/api/health');
    logger.info('  curl http://localhost:3000/api/segment-pools');

  } catch (error) {
    logger.error('初始化测试数据失败:', error);
    process.exit(1);
  }
}

initTestData().then(() => {
  process.exit(0);
});
