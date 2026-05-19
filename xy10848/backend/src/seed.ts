import { v4 as uuidv4 } from 'uuid';
import { getDb } from './database';

async function seed() {
  const db = await getDb();
  const now = Date.now();
  const oneYear = 365 * 24 * 60 * 60 * 1000;

  console.log('正在创建测试成员...');
  const members = [
    { id: uuidv4(), name: '张三', email: 'zhangsan@example.com' },
    { id: uuidv4(), name: '李四', email: 'lisi@example.com' },
    { id: uuidv4(), name: '王五', email: 'wangwu@example.com' }
  ];

  for (const member of members) {
    await db.run(
      'INSERT OR IGNORE INTO members (id, name, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [member.id, member.name, member.email, now, now]
    );
    console.log(`  - ${member.name} (ID: ${member.id})`);
  }

  console.log('\n正在创建测试项目...');
  const projects = [
    { id: uuidv4(), name: 'UI设计项目', memberId: members[0].id },
    { id: uuidv4(), name: '营销素材', memberId: members[0].id },
    { id: uuidv4(), name: '产品配图', memberId: members[1].id },
    { id: uuidv4(), name: '品牌视觉', memberId: members[2].id }
  ];

  for (const project of projects) {
    await db.run(
      'INSERT OR IGNORE INTO projects (id, name, member_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [project.id, project.name, project.memberId, now, now]
    );
    console.log(`  - ${project.name} (成员: ${members.find(m => m.id === project.memberId)?.name})`);
  }

  console.log('\n正在创建测试额度包...');
  const quotaPackages = [
    { id: uuidv4(), name: '团队共享额度包', memberId: members[0].id, total: 1000, remaining: 1000 },
    { id: uuidv4(), name: 'UI设计专用', memberId: members[0].id, projectId: projects[0].id, total: 500, remaining: 500 },
    { id: uuidv4(), name: '个人基础包', memberId: members[1].id, total: 300, remaining: 300 },
    { id: uuidv4(), name: '高级会员包', memberId: members[2].id, total: 800, remaining: 800 }
  ];

  for (const pkg of quotaPackages) {
    await db.run(
      `INSERT OR IGNORE INTO quota_packages 
      (id, name, total_quota, remaining_quota, member_id, project_id, valid_from, valid_to, status, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [pkg.id, pkg.name, pkg.total, pkg.remaining, pkg.memberId, (pkg as any).projectId || null, now, now + oneYear, 'active', now, now]
    );
    const projectName = (pkg as any).projectId 
      ? ` (项目: ${projects.find(p => p.id === (pkg as any).projectId)?.name})`
      : '';
    console.log(`  - ${pkg.name}: ${pkg.remaining}/${pkg.total} 额度${projectName}`);
  }

  console.log('\n✅ 种子数据初始化完成!');
  console.log('\n💡 测试提示:');
  console.log('   1. 张三有两个额度包共1500额度');
  console.log('   2. 李四有300额度（可测试超额拦截）');
  console.log('   3. 王五有800额度');
  process.exit(0);
}

seed().catch(console.error);
