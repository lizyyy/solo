import pool from '../config/database';
import fs from 'fs';
import path from 'path';

async function initDatabase() {
  console.log('📦 开始初始化数据库...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sqlPath = path.join(__dirname, '../../sql/001-init.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

    await client.query(sqlContent);

    await client.query('COMMIT');
    console.log('✅ 数据库表结构初始化完成');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function seedData() {
  console.log('🌱 开始插入测试数据...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const hostGroups = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        name: '生产服务器组-A区',
        description: '北京机房生产环境服务器',
        hosts: JSON.stringify([
          { ip: '192.168.1.101', hostname: 'prod-web-01', os: 'CentOS 7' },
          { ip: '192.168.1.102', hostname: 'prod-web-02', os: 'CentOS 7' },
          { ip: '192.168.1.103', hostname: 'prod-web-03', os: 'CentOS 7' },
          { ip: '192.168.1.104', hostname: 'prod-db-01', os: 'CentOS 7' }
        ]),
        created_by: 'admin'
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        name: '测试服务器组',
        description: '测试环境服务器',
        hosts: JSON.stringify([
          { ip: '10.0.0.1', hostname: 'test-web-01', os: 'Ubuntu 20.04' },
          { ip: '10.0.0.2', hostname: 'test-db-01', os: 'Ubuntu 20.04' }
        ]),
        created_by: 'admin'
      }
    ];

    for (const group of hostGroups) {
      await client.query(
        `INSERT INTO host_groups (id, name, description, hosts, created_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [group.id, group.name, group.description, group.hosts, group.created_by]
      );
    }

    await client.query(
      `INSERT INTO approvers (user_id, user_name, email, approval_level)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO NOTHING`,
      ['approver_001', '张三', 'zhangsan@example.com', 1]
    );

    await client.query(
      `INSERT INTO approvers (user_id, user_name, email, approval_level)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO NOTHING`,
      ['approver_002', '李四', 'lisi@example.com', 1]
    );

    await client.query('COMMIT');
    console.log('✅ 测试数据插入完成');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 测试数据插入失败:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await initDatabase();
    await seedData();
    console.log('\n🎉 数据库初始化完成!');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 初始化失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { initDatabase, seedData };
