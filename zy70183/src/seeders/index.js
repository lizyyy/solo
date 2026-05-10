const mongoose = require('mongoose');
const Enterprise = require('../models/Enterprise');
const TaxPeriod = require('../models/TaxPeriod');
const ValidationRule = require('../models/ValidationRule');
const connectDB = require('../config/database');

const seedData = async () => {
  await connectDB();

  console.log('开始初始化测试数据...');

  try {
    await Enterprise.deleteMany({});
    await TaxPeriod.deleteMany({});
    await ValidationRule.deleteMany({});

    const enterprises = await Enterprise.create([
      {
        enterpriseCode: 'ENT001',
        enterpriseName: '测试企业有限公司',
        taxRegistrationNumber: '91310000MA1K333333',
        industry: '制造业',
        status: 'ACTIVE',
        contactPerson: '张三',
        contactPhone: '13800138000',
        contactEmail: 'zhangsan@test.com'
      },
      {
        enterpriseCode: 'ENT002',
        enterpriseName: '科技发展有限公司',
        taxRegistrationNumber: '91310000MA1K444444',
        industry: '信息技术',
        status: 'ACTIVE',
        contactPerson: '李四',
        contactPhone: '13900139000',
        contactEmail: 'lisi@tech.com'
      }
    ]);
    console.log('✓ 企业数据创建完成', enterprises.length);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const periods = await TaxPeriod.create([
      {
        periodCode: `${year}${String(month).padStart(2, '0')}`,
        periodType: 'MONTHLY',
        year,
        month,
        startDate: new Date(year, month - 1, 1),
        endDate: new Date(year, month, 0),
        declarationDeadline: new Date(year, month, 15),
        status: 'ACTIVE',
        description: `${year}年${month}月月度申报`
      },
      {
        periodCode: `${year}${String(month - 1).padStart(2, '0')}`,
        periodType: 'MONTHLY',
        year,
        month: month - 1,
        startDate: new Date(year, month - 2, 1),
        endDate: new Date(year, month - 1, 0),
        declarationDeadline: new Date(year, month - 1, 15),
        status: 'ACTIVE',
        description: `${year}年${month - 1}月月度申报`
      },
      {
        periodCode: `${year}Q${Math.ceil(month / 3)}`,
        periodType: 'QUARTERLY',
        year,
        quarter: Math.ceil(month / 3),
        startDate: new Date(year, Math.ceil(month / 3) * 3 - 3, 1),
        endDate: new Date(year, Math.ceil(month / 3) * 3, 0),
        declarationDeadline: new Date(year, Math.ceil(month / 3) * 3, 15),
        status: 'ACTIVE',
        description: `${year}年第${Math.ceil(month / 3)}季度申报`
      }
    ]);
    console.log('✓ 申报期数据创建完成', periods.length);

    const rules = await ValidationRule.create([
      {
        ruleCode: 'RULE001',
        ruleName: '通用月度申报规则',
        periodType: 'MONTHLY',
        applicableIndustries: [],
        priority: 100,
        status: 'ACTIVE',
        requiredAttachments: [
          {
            attachmentType: 'INVOICE_SUMMARY',
            attachmentName: '发票汇总表',
            isRequired: true,
            allowedFormats: ['pdf', 'xls', 'xlsx'],
            description: '增值税发票汇总表',
            maxSize: 10 * 1024 * 1024
          },
          {
            attachmentType: 'FINANCIAL_STATEMENT',
            attachmentName: '财务报表',
            isRequired: true,
            allowedFormats: ['pdf', 'xls', 'xlsx'],
            description: '资产负债表、利润表',
            maxSize: 10 * 1024 * 1024
          }
        ]
      },
      {
        ruleCode: 'RULE002',
        ruleName: '通用季度申报规则',
        periodType: 'QUARTERLY',
        applicableIndustries: [],
        priority: 100,
        status: 'ACTIVE',
        requiredAttachments: [
          {
            attachmentType: 'QUARTERLY_REPORT',
            attachmentName: '季度财务报告',
            isRequired: true,
            allowedFormats: ['pdf', 'xls', 'xlsx'],
            description: '季度综合财务报告',
            maxSize: 20 * 1024 * 1024
          }
        ]
      }
    ]);
    console.log('✓ 校验规则创建完成', rules.length);

    console.log('\n测试数据初始化完成！');
    console.log('\n测试数据概要：');
    console.log('企业代码：ENT001, ENT002');
    console.log('企业名称：测试企业有限公司, 科技发展有限公司');
    console.log('申报期代码：', periods.map(p => p.periodCode).join(', '));

    process.exit(0);
  } catch (error) {
    console.error('初始化失败：', error);
    process.exit(1);
  }
};

seedData();
