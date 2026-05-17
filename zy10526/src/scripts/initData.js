const sequelize = require('../config/database');
const {
  Customer,
  WhitelistType,
  WhitelistRule,
  ApplicationSource
} = require('../models');

async function initData() {
  try {
    console.log('开始同步数据库...');
    await sequelize.sync({ force: true });
    console.log('数据库同步完成');

    console.log('\n开始创建基础数据...');

    const customers = await Customer.bulkCreate([
      {
        accountId: 'CUST001',
        customerName: '张三科技有限公司',
        customerLevel: 'vip',
        status: 'active'
      },
      {
        accountId: 'CUST002',
        customerName: '李四贸易有限公司',
        customerLevel: 'normal',
        status: 'active'
      },
      {
        accountId: 'CUST003',
        customerName: '王五集团股份有限公司',
        customerLevel: 'svip',
        status: 'active'
      }
    ]);
    console.log('创建客户数据完成:', customers.length, '条');

    const whitelistTypes = await WhitelistType.bulkCreate([
      {
        typeCode: 'RISK_EXEMPTION',
        typeName: '风控豁免',
        description: '免除特定风控规则检查',
        priority: 100,
        isEnabled: true
      },
      {
        typeCode: 'RATE_LIMIT_EXEMPTION',
        typeName: '限流豁免',
        description: '免除接口限流限制',
        priority: 80,
        isEnabled: true
      },
      {
        typeCode: 'FEE_DISCOUNT',
        typeName: '手续费减免',
        description: '交易手续费减免优惠',
        priority: 60,
        isEnabled: true
      }
    ]);
    console.log('创建白名单类型完成:', whitelistTypes.length, '条');

    const whitelistRules = await WhitelistRule.bulkCreate([
      {
        ruleCode: 'RULE_RISK_VIP',
        ruleName: 'VIP客户风控豁免规则',
        whitelistTypeId: whitelistTypes[0].id,
        matchConditions: {
          customerLevels: ['vip', 'svip'],
          regions: ['华东', '华南'],
          channels: ['web', 'mobile']
        },
        effectScope: 'specific',
        effectiveDate: new Date('2024-01-01'),
        expiryDate: new Date('2024-12-31'),
        status: 'active',
        createdBy: 'system'
      },
      {
        ruleCode: 'RULE_RATE_SVIP',
        ruleName: 'SVIP客户限流豁免规则',
        whitelistTypeId: whitelistTypes[1].id,
        matchConditions: {
          customerLevels: ['svip'],
          regions: ['华东', '华南', '华北', '西南']
        },
        effectScope: 'all',
        effectiveDate: new Date('2024-01-01'),
        expiryDate: null,
        status: 'active',
        createdBy: 'system'
      },
      {
        ruleCode: 'RULE_FEE_DISCOUNT',
        ruleName: '手续费减免通用规则',
        whitelistTypeId: whitelistTypes[2].id,
        matchConditions: {
          customerLevels: ['normal', 'vip', 'svip']
        },
        effectScope: 'all',
        effectiveDate: new Date('2024-01-01'),
        expiryDate: new Date('2024-06-30'),
        status: 'active',
        createdBy: 'system'
      }
    ]);
    console.log('创建白名单规则完成:', whitelistRules.length, '条');

    const applicationSources = await ApplicationSource.bulkCreate([
      {
        sourceCode: 'SALES_APPLY',
        sourceName: '销售申请',
        sourceType: 'sales',
        applicant: '销售部',
        applicantDept: '销售部-大客户组',
        remark: '销售主动申请的白名单'
      },
      {
        sourceCode: 'CS_COMPLAINT',
        sourceName: '客诉处理',
        sourceType: 'customer_service',
        applicant: '客服部',
        applicantDept: '客服部-投诉处理组',
        remark: '客户投诉后追加的豁免'
      },
      {
        sourceCode: 'SYSTEM_AUTO',
        sourceName: '系统自动',
        sourceType: 'system',
        applicant: '系统',
        applicantDept: '技术部-风控系统组',
        remark: '系统自动判定添加'
      },
      {
        sourceCode: 'API_CALL',
        sourceName: 'API调用',
        sourceType: 'api',
        applicant: '开放平台',
        applicantDept: '技术部-开放平台组',
        remark: '通过开放API申请添加'
      }
    ]);
    console.log('创建申请来源完成:', applicationSources.length, '条');

    console.log('\n=== 初始化数据汇总 ===');
    console.log('客户账号示例:');
    console.log('  - CUST001: 张三科技有限公司 (VIP)');
    console.log('  - CUST002: 李四贸易有限公司 (Normal)');
    console.log('  - CUST003: 王五集团股份有限公司 (SVIP)');
    console.log('\n白名单类型示例:');
    console.log('  - RISK_EXEMPTION: 风控豁免');
    console.log('  - RATE_LIMIT_EXEMPTION: 限流豁免');
    console.log('  - FEE_DISCOUNT: 手续费减免');
    console.log('\n白名单规则示例:');
    console.log('  - RULE_RISK_VIP: VIP客户风控豁免规则');
    console.log('  - RULE_RATE_SVIP: SVIP客户限流豁免规则');
    console.log('  - RULE_FEE_DISCOUNT: 手续费减免通用规则');
    console.log('\n申请来源示例:');
    console.log('  - SALES_APPLY: 销售申请');
    console.log('  - CS_COMPLAINT: 客诉处理');
    console.log('  - SYSTEM_AUTO: 系统自动');
    console.log('  - API_CALL: API调用');

    console.log('\n数据初始化完成!');
    process.exit(0);

  } catch (error) {
    console.error('数据初始化失败:', error);
    process.exit(1);
  }
}

initData();
