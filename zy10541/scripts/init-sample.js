const ContractService = require('../src/services/ContractService');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');

function clearData() {
  if (fs.existsSync(DATA_DIR)) {
    const contractsFile = path.join(DATA_DIR, 'contracts.json');
    const exceptionsFile = path.join(DATA_DIR, 'exceptions.json');
    
    if (fs.existsSync(contractsFile)) {
      fs.unlinkSync(contractsFile);
    }
    if (fs.existsSync(exceptionsFile)) {
      fs.unlinkSync(exceptionsFile);
    }
  }
}

function initSampleData() {
  console.log('开始初始化样例数据...\n');
  
  clearData();
  
  const contractService = new ContractService();
  
  const sampleContracts = [
    {
      contractNo: 'HT202405001',
      customerName: '云科技有限公司',
      contractType: 'SERVICE',
      version: 'v1.0',
      effectiveDate: '2024-06-01',
      price: 128000,
      serviceScope: ['云服务器', '对象存储', 'CDN加速'],
      createdBy: 'admin'
    },
    {
      contractNo: 'HT202405002',
      customerName: '数据智能科技集团',
      contractType: 'PLATFORM',
      version: 'v2.1',
      effectiveDate: '2024-07-15',
      price: 256000,
      serviceScope: ['数据库服务', '负载均衡', '安全防护', '容器服务'],
      createdBy: 'manager'
    },
    {
      contractNo: 'HT202405003',
      customerName: '智慧生活服务平台',
      contractType: 'SERVICE',
      version: 'v1.5',
      effectiveDate: '2024-08-01',
      price: 89000,
      serviceScope: ['消息队列', '大数据服务', '微服务引擎'],
      createdBy: 'admin'
    }
  ];

  sampleContracts.forEach((data, index) => {
    try {
      const contract = contractService.createContract(data);
      console.log(`✓ 创建合同: ${contract.contractNo} - ${contract.customerName}`);
      
      if (index === 0) {
        contractService.transitionStatus(data.contractNo, 'SUBMIT', 'manager', '合同条款核对无误，提交审核');
        console.log(`  → 状态流转: DRAFT → SUBMITTED`);
        
        contractService.transitionStatus(data.contractNo, 'REVIEW', 'director', '法务审核通过');
        console.log(`  → 状态流转: SUBMITTED → REVIEWED`);
        
        contractService.transitionStatus(data.contractNo, 'START_SYNC', 'system', '开始同步至业务系统');
        console.log(`  → 状态流转: REVIEWED → SYNCING`);
        
        contractService.syncToBusinessSystem(data.contractNo, 'BUSINESS_CENTER', 'system');
        console.log(`  → 同步业务系统完成`);
      }
      
      if (index === 1) {
        contractService.transitionStatus(data.contractNo, 'SUBMIT', 'manager', '补充条款确认');
        console.log(`  → 状态流转: DRAFT → SUBMITTED`);
      }
      
    } catch (error) {
      console.log(`✗ 创建合同失败: ${data.contractNo} - ${error.message}`);
    }
    console.log('');
  });

  console.log('\n========================================');
  console.log('  样例数据初始化完成');
  console.log('========================================');
  console.log(`  已创建 ${sampleContracts.length} 份合同`);
  console.log('  数据存储位置: ./data/');
  console.log('  启动服务: npm start');
  console.log('========================================\n');
}

initSampleData();