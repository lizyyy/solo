const { prepare, initDatabase, getSchemaVersion, saveDatabase } = require('./database');
const { v4: uuidv4 } = require('uuid');

async function initDb() {
  await initDatabase();

  const sampleDrafts = [
    {
      id: uuidv4(),
      title: '办公电脑采购申请',
      current_step: 2,
      data: JSON.stringify({
        applicationInfo: {
          applicant: '张三',
          department: '行政部',
          applicationDate: '2026-04-15',
          projectName: 'Q2季度办公设备更新',
          projectDescription: '为新入职员工和现有员工更新办公电脑，提升工作效率',
          totalAmount: 80000
        },
        supplierComparison: [
          {
            supplierName: '联想科技有限公司',
            contactPerson: '李经理',
            contactPhone: '13800138001',
            productName: 'ThinkPad X1 Carbon',
            unitPrice: 10000,
            quantity: 8,
            totalPrice: 80000,
            deliveryDays: 7,
            warranty: '3年'
          }
        ],
        budgetItems: [],
        attachments: []
      }),
      schema_version: getSchemaVersion(),
      version: 1
    },
    {
      id: uuidv4(),
      title: '打印机采购申请',
      current_step: 3,
      data: JSON.stringify({
        applicationInfo: {
          applicant: '李四',
          department: '财务部',
          applicationDate: '2026-04-10',
          projectName: '财务部门打印机更新',
          projectDescription: '财务部现有打印机老化，需要更换高速打印机',
          totalAmount: 25000
        },
        supplierComparison: [
          {
            supplierName: '惠普办公设备',
            contactPerson: '王经理',
            contactPhone: '13800138002',
            productName: 'HP LaserJet Pro MFP',
            unitPrice: 12000,
            quantity: 2,
            totalPrice: 24000,
            deliveryDays: 5,
            warranty: '2年'
          },
          {
            supplierName: '佳能办公',
            contactPerson: '赵经理',
            contactPhone: '13800138003',
            productName: 'Canon imageCLASS',
            unitPrice: 13000,
            quantity: 2,
            totalPrice: 26000,
            deliveryDays: 3,
            warranty: '3年'
          }
        ],
        budgetItems: [
          {
            subjectCode: '660201',
            subjectName: '办公设备购置费',
            amount: 25000,
            remark: '2台打印机'
          }
        ],
        attachments: []
      }),
      schema_version: getSchemaVersion(),
      version: 2
    },
    {
      id: uuidv4(),
      title: '会议系统设备采购',
      current_step: 1,
      data: JSON.stringify({
        applicationInfo: {
          applicant: '王五',
          department: 'IT部',
          applicationDate: '2026-04-20',
          projectName: '大会议室会议系统升级',
          projectDescription: '升级大会议室的会议系统，支持远程会议、屏幕共享等功能',
          totalAmount: 50000
        },
        supplierComparison: [],
        budgetItems: [],
        attachments: []
      }),
      schema_version: getSchemaVersion(),
      version: 1
    }
  ];

  const insertDraft = prepare(`
    INSERT OR IGNORE INTO drafts (id, title, current_step, data, schema_version, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  sampleDrafts.forEach(draft => {
    const result = insertDraft.run(
      draft.id,
      draft.title,
      draft.current_step,
      draft.data,
      draft.schema_version,
      draft.version
    );
    console.log(`已添加示例草稿: ${draft.title}`);
  });

  saveDatabase();
  console.log('示例数据初始化完成');
  process.exit(0);
}

initDb().catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
