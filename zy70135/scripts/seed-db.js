require('dotenv').config();
const db = require('../src/models');
const logger = require('../src/utils/logger');
const { ROLES, BLACKLIST_STATUS, EXEMPTION_TYPE, EXEMPTION_STATUS } = require('../src/core/constants');

async function seedDatabase() {
  try {
    logger.info('Starting database seeding...');

    await db.sequelize.authenticate();

    const t = await db.sequelize.transaction();

    try {
      const businessLines = await db.BusinessLine.bulkCreate([
        { code: 'ecommerce', name: '电商业务线', description: '在线电商业务' },
        { code: 'fintech', name: '金融业务线', description: '金融科技业务' },
        { code: 'insurance', name: '保险业务线', description: '保险业务' },
      ], { transaction: t });

      logger.info('Business lines created');

      const users = await db.User.bulkCreate([
        {
          username: 'admin',
          displayName: '系统管理员',
          email: 'admin@example.com',
          password: 'Admin@123',
          role: ROLES.ADMIN,
          isActive: true,
        },
        {
          username: 'operator_ecom',
          displayName: '电商操作员',
          email: 'operator_ecom@example.com',
          password: 'Operator@123',
          role: ROLES.OPERATOR,
          businessLineId: businessLines[0].id,
          isActive: true,
        },
        {
          username: 'approver_fin',
          displayName: '金融审批员',
          email: 'approver_fin@example.com',
          password: 'Approver@123',
          role: ROLES.APPROVER,
          businessLineId: businessLines[1].id,
          isActive: true,
        },
        {
          username: 'viewer_ins',
          displayName: '保险查看员',
          email: 'viewer_ins@example.com',
          password: 'Viewer@123',
          role: ROLES.VIEWER,
          businessLineId: businessLines[2].id,
          isActive: true,
        },
      ], { transaction: t });

      logger.info('Users created');

      const blacklists = await db.Blacklist.bulkCreate([
        {
          memberIdentifier: '13800138001',
          identifierType: 'phone',
          memberName: '张三',
          status: BLACKLIST_STATUS.ACTIVE,
          reason: '恶意退款超过10次',
          sourceType: 'manual',
          businessLineId: businessLines[0].id,
          isShared: true,
          hitCount: 15,
        },
        {
          memberIdentifier: '13800138002',
          identifierType: 'phone',
          memberName: '李四',
          status: BLACKLIST_STATUS.ACTIVE,
          reason: '金融欺诈风险',
          sourceType: 'risk_detection',
          businessLineId: businessLines[1].id,
          isShared: true,
          hitCount: 8,
        },
        {
          memberIdentifier: '13800138003',
          identifierType: 'phone',
          memberName: '王五',
          status: BLACKLIST_STATUS.INACTIVE,
          reason: '历史违规记录',
          sourceType: 'legacy_sync',
          businessLineId: businessLines[0].id,
          isShared: false,
          hitCount: 0,
        },
      ], { transaction: t });

      logger.info('Blacklist records created');

      await db.Exemption.create({
        blacklistId: blacklists[0].id,
        memberIdentifier: blacklists[0].memberIdentifier,
        identifierType: blacklists[0].identifierType,
        type: EXEMPTION_TYPE.TEMPORARY,
        status: EXEMPTION_STATUS.APPROVED,
        reason: '已补交货款，临时豁免',
        durationDays: 30,
        startDate: new Date(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        businessLineId: businessLines[0].id,
        requesterId: users[1].id,
        requesterComment: '用户有特殊情况',
        approverId: users[0].id,
        approvedAt: new Date(),
      }, { transaction: t });

      logger.info('Exemption records created');

      await t.commit();
      logger.info('Database seeding completed successfully');
      logger.info('Default users created:');
      logger.info('  - admin / Admin@123 (管理员)');
      logger.info('  - operator_ecom / Operator@123 (电商操作员)');
      logger.info('  - approver_fin / Approver@123 (金融审批员)');
      logger.info('  - viewer_ins / Viewer@123 (保险查看员)');

      process.exit(0);
    } catch (error) {
      await t.rollback();
      throw error;
    }
  } catch (error) {
    logger.error('Database seeding failed:', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

seedDatabase();
