const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');

const sampleCsv = `datasetName,datasetCode,fieldName,fieldAlias,fieldPath,exemptionReason,approver,approverEmail,expireDate,createdBy,isNestedJson,metadata
营销活动数据集,MKT_ACT_001,用户邮箱,user_email,profile.email,营销活动需要发送邮件通知用户活动信息,李明,liming@company.com,2025-06-30,王华,true,{}
客户服务数据集,CS_SERVICE_002,联系电话,contact_phone,contact.tel,客服人员需要联系客户处理售后问题,张华,zhanghua@company.com,2025-07-15,李娜,true,{}
财务对账数据集,FINANCE_003,银行卡号,bank_card,finance.bankCards[0].number,财务部门需要进行银行对账操作,王强,wangqiang@company.com,2025-08-01,赵敏,true,{}
订单物流数据集,LOGISTICS_004,收货地址,shipping_address,delivery.address.full,物流部门需要准确地址进行配送,刘洋,liuyang@company.com,2025-05-20,陈静,true,{}
会员认证数据集,MEMBER_AUTH_005,真实姓名,real_name,,会员实名认证审核需要真实姓名,周磊,zhoulei@company.com,2025-09-01,吴芳,false,{}`;

const samplePath = path.join(__dirname, '../../sample_import.csv');
fs.writeFileSync(samplePath, '\ufeff' + sampleCsv, 'utf8');

console.log('✅ 已创建示例导入CSV文件:', samplePath);
console.log('\n📋 文件内容预览:');
console.log(sampleCsv);
console.log('\n💡 使用方法:');
console.log('   POST /api/batch/import');
console.log('   form-data: file=sample_import.csv, importedBy=your_name');
