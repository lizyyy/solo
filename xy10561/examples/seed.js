const { initDB } = require('../src/models/database');
const { createTables } = require('../src/models/schema');
const donationService = require('../src/services/donationService');

const SAMPLE_PROJECTS = [
  {
    name: '希望工程 - 山区小学建设',
    description: '为山区贫困地区建设希望小学，改善教育环境'
  },
  {
    name: '温暖冬日 - 老人关爱计划',
    description: '为孤寡老人提供冬季取暖物资和生活照料'
  },
  {
    name: '绿色地球 - 植树造林项目',
    description: '在荒漠化地区植树造林，改善生态环境'
  }
];

async function seed() {
  console.log('========================================');
  console.log('  公益捐赠票据系统 - 样例数据初始化');
  console.log('========================================\n');

  try {
    console.log('1. 初始化数据库...');
    await initDB();
    
    console.log('2. 创建数据库表...');
    createTables();
    
    console.log('3. 创建样例项目...\n');
    const projects = [];
    for (const p of SAMPLE_PROJECTS) {
      const project = donationService.createProject(p.name, p.description);
      projects.push(project);
      console.log(`   ✓ 项目: ${project.name} (ID: ${project.id.substring(0, 8)}...)`);
    }

    console.log('\n========================================');
    console.log('  样例数据初始化完成!');
    console.log('========================================\n');
    console.log('已创建项目:');
    projects.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.name}`);
      console.log(`     ID: ${p.id}`);
      console.log();
    });

    return projects;
  } catch (error) {
    console.error('初始化失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed, SAMPLE_PROJECTS };
