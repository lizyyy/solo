const bcrypt = require('bcryptjs');
const pool = require('./pool');

async function seedDatabase() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('开始数据库初始化...');
    
    const adminPassword = await bcrypt.hash('admin123', 10);
    const operatorPassword = await bcrypt.hash('operator123', 10);
    const supervisorPassword = await bcrypt.hash('supervisor123', 10);

    await client.query(`
      INSERT INTO operators (username, password_hash, real_name, department, phone, role)
      VALUES 
        ('admin', $1, '系统管理员', '信息科', '13800138000', 'admin'),
        ('operator', $2, '普通操作员', '执法一大队', '13800138001', 'operator'),
        ('supervisor', $3, '审批主管', '执法一大队', '13800138002', 'supervisor')
      ON CONFLICT (username) DO NOTHING
    `, [adminPassword, operatorPassword, supervisorPassword]);

    console.log('✓ 初始用户已创建');
    console.log('  - admin / admin123 (管理员)');
    console.log('  - operator / operator123 (操作员)');
    console.log('  - supervisor / supervisor123 (审批主管)');

    await client.query('COMMIT');
    console.log('数据库初始化完成!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('数据库初始化失败:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('数据库种子数据创建成功');
      process.exit(0);
    })
    .catch((error) => {
      console.error('数据库种子数据创建失败:', error);
      process.exit(1);
    });
}

module.exports = seedDatabase;
