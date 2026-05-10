import db from '../src/lib/db';
import ensureSeedData from '../src/lib/seed';

console.log('正在初始化数据库...');

try {
  const seeded = ensureSeedData();
  
  if (seeded) {
    console.log('✓ 数据库初始化成功');
    console.log('✓ 已插入示例数据：');
    console.log('  - 3 个课题组');
    console.log('  - 6 个用户');
    console.log('  - 4 台显微镜');
    console.log('  - 22 个附件（倍率模块 + 样品台）');
  } else {
    console.log('✓ 数据库已存在，跳过初始化');
  }
} catch (error) {
  console.error('数据库初始化失败:', error);
  process.exit(1);
}

db.close();
