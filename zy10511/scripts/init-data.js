const dataStore = require('../src/store/DataStore');
const { ACCOUNT_STATUS } = require('../src/models/AccountStatus');

const sampleAccounts = [
  {
    accountNumber: 'TEST-USER-001',
    description: '支付测试账号 - 微信支付',
    tags: ['payment', 'wechat']
  },
  {
    accountNumber: 'TEST-USER-002',
    description: '支付测试账号 - 支付宝',
    tags: ['payment', 'alipay']
  },
  {
    accountNumber: 'TEST-USER-003',
    description: '登录测试账号 - 管理员权限',
    tags: ['login', 'admin']
  },
  {
    accountNumber: 'TEST-USER-004',
    description: '登录测试账号 - 普通用户权限',
    tags: ['login', 'user']
  },
  {
    accountNumber: 'TEST-USER-005',
    description: '接口测试账号 - 完整权限',
    tags: ['api', 'full-access']
  }
];

function initData() {
  console.log('开始初始化测试账号数据...\n');

  let createdCount = 0;
  let skippedCount = 0;

  for (const accountData of sampleAccounts) {
    const existing = dataStore.getAccountByNumber(accountData.accountNumber);
    
    if (existing) {
      console.log(`⏭️  跳过: ${accountData.accountNumber} - 已存在`);
      skippedCount++;
    } else {
      dataStore.addAccount({
        ...accountData,
        status: ACCOUNT_STATUS.AVAILABLE,
        currentBorrowId: null,
        currentBorrower: null,
        currentDevice: null,
        leaseExpireAt: null,
        totalBorrowCount: 0,
        lastBorrowAt: null
      });
      console.log(`✅ 创建: ${accountData.accountNumber}`);
      createdCount++;
    }
  }

  console.log(`
┌─────────────────────────────────────────┐
│           初始化完成                      │
├─────────────────────────────────────────┤
│  创建账号: ${createdCount}                            │
│  跳过账号: ${skippedCount}                            │
│  总计: ${createdCount + skippedCount}                                │
└─────────────────────────────────────────┘
  `);
}

initData();
