const signatureService = require('../src/services/signature');

function generateTestData() {
  const normalItems = [
    {
      itemNo: 'OUT-2026-001',
      projectName: '客户服务系统迭代开发项目',
      outsourcingVendor: '北京信息技术有限公司',
      workContent: '前端页面开发-用户管理模块',
      quantity: 12,
      unitPrice: 850,
      subtotal: 10200,
      signAlgorithm: 'SHA256'
    },
    {
      itemNo: 'OUT-2026-002',
      projectName: '客户服务系统迭代开发项目',
      outsourcingVendor: '北京信息技术有限公司',
      workContent: '后端接口开发-订单查询',
      quantity: 8,
      unitPrice: 1200,
      subtotal: 9600,
      signAlgorithm: 'SHA256'
    },
    {
      itemNo: 'OUT-2026-003',
      projectName: '数据中心运维服务项目',
      outsourcingVendor: '上海系统集成有限公司',
      workContent: '服务器日常巡检服务',
      quantity: 30,
      unitPrice: 500,
      subtotal: 15000,
      signAlgorithm: 'SHA256'
    },
    {
      itemNo: 'OUT-2026-004',
      projectName: '数据中心运维服务项目',
      outsourcingVendor: '上海系统集成有限公司',
      workContent: '数据库性能优化',
      quantity: 5,
      unitPrice: 3000,
      subtotal: 15000,
      signAlgorithm: 'SHA256'
    },
    {
      itemNo: 'OUT-2026-005',
      projectName: '移动APP开发项目',
      outsourcingVendor: '深圳软件开发有限公司',
      workContent: 'IOS端用户界面设计开发',
      quantity: 15,
      unitPrice: 1800,
      subtotal: 27000,
      signAlgorithm: 'SHA256'
    }
  ];

  const badItem = {
    itemNo: 'OUT-2026-006',
    projectName: '移动APP开发项目',
    outsourcingVendor: '深圳软件开发有限公司',
    workContent: 'Android端支付接口对接',
    quantity: 6,
    unitPrice: 2000,
    subtotal: 12000,
    signAlgorithm: 'MD5'
  };

  normalItems.forEach(item => {
    const signContent = signatureService.getSignContent(item);
    item.signature = signatureService.generateSignature(signContent, item.signAlgorithm);
  });

  const badSignContent = signatureService.getSignContent(badItem);
  badItem.signature = signatureService.generateSignature(badSignContent, badItem.signAlgorithm);

  return {
    formData: {
      department: '信息技术部',
      submitter: '王建国',
      totalAmount: normalItems.reduce((sum, item) => sum + item.subtotal, 0) + badItem.subtotal
    },
    normalItems,
    badItem
  };
}

module.exports = generateTestData;