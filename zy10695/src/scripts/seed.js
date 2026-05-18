const sequelize = require('../config/database');
const Exemption = require('../models/Exemption');
const ExportLog = require('../models/ExportLog');
const ImportLog = require('../models/ImportLog');
const moment = require('moment');

const seedData = async () => {
  console.log('开始创建数据库表...');
  await sequelize.sync({ force: true });
  console.log('数据库表创建完成');

  const seedExemptions = [
    {
      datasetName: '用户核心数据集',
      datasetCode: 'USER_CORE_001',
      fieldName: '身份证号',
      fieldAlias: 'id_number',
      fieldPath: null,
      exemptionReason: '财务对账需要，需匹配用户真实身份证信息',
      approver: '张三',
      approverEmail: 'zhangsan@company.com',
      expireDate: moment().add(30, 'days').toDate(),
      status: 'active',
      createdBy: '李四',
      isNestedJson: false,
      metadata: { approvalLevel: 'L2', department: '财务部' }
    },
    {
      datasetName: '用户核心数据集',
      datasetCode: 'USER_CORE_001',
      fieldName: '手机号',
      fieldAlias: 'mobile',
      fieldPath: 'profile.contact.mobile',
      exemptionReason: '客户服务需要发送短信通知',
      approver: '张三',
      approverEmail: 'zhangsan@company.com',
      expireDate: moment().add(15, 'days').toDate(),
      status: 'active',
      createdBy: '李四',
      isNestedJson: true,
      metadata: { approvalLevel: 'L1', department: '客服部' }
    },
    {
      datasetName: '用户核心数据集',
      datasetCode: 'USER_CORE_001',
      fieldName: '银行卡号',
      fieldAlias: 'bank_card',
      fieldPath: 'profile.finance.bankCards[0].number',
      exemptionReason: '退款业务需要准确银行卡信息',
      approver: '王五',
      approverEmail: 'wangwu@company.com',
      expireDate: moment().add(7, 'days').toDate(),
      status: 'active',
      createdBy: '赵六',
      isNestedJson: true,
      metadata: { approvalLevel: 'L3', department: '支付部' }
    },
    {
      datasetName: '交易数据集',
      datasetCode: 'TRADE_001',
      fieldName: '收款人姓名',
      fieldAlias: 'payee_name',
      fieldPath: null,
      exemptionReason: '审计核查需要真实收款人信息',
      approver: '王五',
      approverEmail: 'wangwu@company.com',
      expireDate: moment().subtract(5, 'days').toDate(),
      status: 'expired',
      createdBy: '赵六',
      isNestedJson: false,
      metadata: { approvalLevel: 'L2', department: '审计部' }
    },
    {
      datasetName: '交易数据集',
      datasetCode: 'TRADE_001',
      fieldName: '交易金额',
      fieldAlias: 'trade_amount',
      fieldPath: 'amount.value',
      exemptionReason: '财务报表需要精确金额数据',
      approver: '张三',
      approverEmail: 'zhangsan@company.com',
      expireDate: moment().subtract(1, 'days').toDate(),
      status: 'expired',
      createdBy: '李四',
      isNestedJson: true,
      metadata: { approvalLevel: 'L1', department: '财务部' }
    },
    {
      datasetName: '订单数据集',
      datasetCode: 'ORDER_001',
      fieldName: '收货地址',
      fieldAlias: 'shipping_address',
      fieldPath: 'delivery.address.full',
      exemptionReason: '物流对账需要完整地址信息',
      approver: '王五',
      approverEmail: 'wangwu@company.com',
      expireDate: moment().add(60, 'days').toDate(),
      status: 'active',
      createdBy: '钱七',
      isNestedJson: true,
      metadata: { approvalLevel: 'L2', department: '物流部' }
    },
    {
      datasetName: '订单数据集',
      datasetCode: 'ORDER_001',
      fieldName: '联系人电话',
      fieldAlias: 'contact_phone',
      fieldPath: 'delivery.contact.phone',
      exemptionReason: '异常订单联系客户需要',
      approver: '张三',
      approverEmail: 'zhangsan@company.com',
      expireDate: moment().add(3, 'days').toDate(),
      status: 'active',
      createdBy: '钱七',
      isNestedJson: true,
      metadata: { approvalLevel: 'L1', department: '运营部' }
    },
    {
      datasetName: '会员数据集',
      datasetCode: 'MEMBER_001',
      fieldName: '真实姓名',
      fieldAlias: 'real_name',
      fieldPath: null,
      exemptionReason: '会员实名认证审核需要',
      approver: '王五',
      approverEmail: 'wangwu@company.com',
      expireDate: moment().subtract(10, 'days').toDate(),
      status: 'expired',
      createdBy: '孙八',
      isNestedJson: false,
      metadata: { approvalLevel: 'L3', department: '风控部' }
    }
  ];

  console.log('开始插入种子数据...');
  await Exemption.bulkCreate(seedExemptions);
  console.log(`成功插入 ${seedExemptions.length} 条豁免审批记录`);
  console.log('\n种子数据分类统计:');
  console.log('- 嵌套JSON字段: 4条');
  console.log('- 字段别名: 8条（全部记录）');
  console.log('- 审批过期: 3条');
  console.log('- 生效中: 5条');

  process.exit(0);
};

seedData().catch(err => {
  console.error('种子数据初始化失败:', err);
  process.exit(1);
});
