const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');

function runSeed() {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        const apiGroup1Id = uuidv4();
        const apiGroup2Id = uuidv4();
        
        db.run(`
          INSERT OR IGNORE INTO api_groups (id, name, description)
          VALUES (?, ?, ?)
        `, [apiGroup1Id, '支付接口', '支付相关API接口']);
        
        db.run(`
          INSERT OR IGNORE INTO api_groups (id, name, description)
          VALUES (?, ?, ?)
        `, [apiGroup2Id, '用户接口', '用户管理相关API']);

        const tenant1Id = uuidv4();
        const tenant2Id = uuidv4();
        
        db.run(`
          INSERT OR IGNORE INTO tenants (id, name, contact_email, status)
          VALUES (?, ?, ?, ?)
        `, [tenant1Id, '客户A科技有限公司', 'contact@companya.com', 'active']);
        
        db.run(`
          INSERT OR IGNORE INTO tenants (id, name, contact_email, status)
          VALUES (?, ?, ?, ?)
        `, [tenant2Id, '客户B电商平台', 'admin@companyb.com', 'active']);

        const quota1Id = uuidv4();
        const quota2Id = uuidv4();
        
        db.run(`
          INSERT OR IGNORE INTO tenant_quotas (id, tenant_id, api_group_id, daily_quota, monthly_quota, remaining_daily, remaining_monthly)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [quota1Id, tenant1Id, apiGroup1Id, 100, 3000, 100, 3000]);
        
        db.run(`
          INSERT OR IGNORE INTO tenant_quotas (id, tenant_id, api_group_id, daily_quota, monthly_quota, remaining_daily, remaining_monthly)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [quota2Id, tenant2Id, apiGroup1Id, 50, 1500, 50, 1500]);

        console.log('初始化数据完成!');
        console.log('租户ID:', tenant1Id, tenant2Id);
        console.log('接口分组ID:', apiGroup1Id, apiGroup2Id);
        
        resolve({ tenant1Id, tenant2Id, apiGroup1Id, apiGroup2Id });
      } catch (err) {
        reject(err);
      }
    });
  });
}

if (require.main === module) {
  runSeed().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = runSeed;
