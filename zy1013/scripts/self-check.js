#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

console.log('========================================');
console.log('  Photo Listing Desk - 自检程序');
console.log('========================================\n');

let passed = 0;
let failed = 0;
let warnings = 0;

function check(description, test, isWarning = false) {
  try {
    const result = test();
    if (result) {
      console.log(`✅ ${description}`);
      passed++;
      return true;
    } else {
      if (isWarning) {
        console.log(`⚠️ ${description}`);
        warnings++;
      } else {
        console.log(`❌ ${description}`);
        failed++;
      }
      return false;
    }
  } catch (e) {
    console.log(`❌ ${description} - ${e.message}`);
    failed++;
    return false;
  }
}

console.log('📂 检查项目结构...\n');

check('package.json 存在', () => fs.existsSync(path.join(__dirname, '..', 'package.json')));
check('main.js 存在', () => fs.existsSync(path.join(__dirname, '..', 'main.js')));
check('preload.js 存在', () => fs.existsSync(path.join(__dirname, '..', 'preload.js')));

const srcDir = path.join(__dirname, '..', 'src');
check('src 目录存在', () => fs.existsSync(srcDir));
check('fileScanner.js 存在', () => fs.existsSync(path.join(srcDir, 'fileScanner.js')));
check('duplicateChecker.js 存在', () => fs.existsSync(path.join(srcDir, 'duplicateChecker.js')));
check('dataManager.js 存在', () => fs.existsSync(path.join(srcDir, 'dataManager.js')));
check('exporter.js 存在', () => fs.existsSync(path.join(srcDir, 'exporter.js')));

const rendererDir = path.join(__dirname, '..', 'renderer');
check('renderer 目录存在', () => fs.existsSync(rendererDir));
check('index.html 存在', () => fs.existsSync(path.join(rendererDir, 'index.html')));
check('style.css 存在', () => fs.existsSync(path.join(rendererDir, 'style.css')));
check('app.js 存在', () => fs.existsSync(path.join(rendererDir, 'app.js')));

const samplesDir = path.join(__dirname, '..', 'samples');
check('samples 目录存在', () => fs.existsSync(samplesDir), true);
check('示例项目文件存在', () => fs.existsSync(path.join(samplesDir, 'sample-project.json')), true);

console.log('\n📋 检查 package.json 配置...\n');

let pkg;
try {
  pkg = fs.readJsonSync(path.join(__dirname, '..', 'package.json'));
  check('package.json 可解析', () => true);
  check('项目名称正确', () => pkg.name === 'photo-listing-desk');
  check('main 入口正确', () => pkg.main === 'main.js');
  check('包含 electron 依赖', () => pkg.devDependencies && pkg.devDependencies.electron);
  check('包含 sharp 依赖', () => pkg.dependencies && pkg.dependencies.sharp);
  check('包含 fs-extra 依赖', () => pkg.dependencies && pkg.dependencies['fs-extra']);
  check('包含 csv-writer 依赖', () => pkg.dependencies && pkg.dependencies['csv-writer']);
  check('start 脚本存在', () => pkg.scripts && pkg.scripts.start === 'electron .');
  check('test 脚本存在', () => pkg.scripts && pkg.scripts.test);
} catch (e) {
  check('package.json 可解析', () => false);
}

console.log('\n🧪 测试核心模块...\n');

try {
  const DataManager = require(path.join(srcDir, 'dataManager'));
  
  check('DataManager.createEmptyProject 可用', () => {
    const project = DataManager.createEmptyProject();
    return project && project.version === '1.0' && Array.isArray(project.photos) && Array.isArray(project.products);
  });
  
  check('DataManager.createProduct 可用', () => {
    const product = DataManager.createProduct('test_id');
    return product && product.id === 'test_id' && product.status === 'draft';
  });
  
  check('DataManager.validateProject 可用', () => {
    const project = DataManager.createEmptyProject();
    const issues = DataManager.validateProject(project);
    return Array.isArray(issues);
  });
  
  check('DataManager.getStatistics 可用', () => {
    const project = DataManager.createEmptyProject();
    const stats = DataManager.getStatistics(project);
    return stats && typeof stats.totalPhotos === 'number';
  });
  
} catch (e) {
  check('DataManager 模块可加载', () => { throw e; });
}

try {
  const DuplicateChecker = require(path.join(srcDir, 'duplicateChecker'));
  
  check('DuplicateChecker.removeDuplicateEntries 可用', () => {
    const testData = [
      { type: 'exact', photos: [{ id: '1' }, { id: '2' }] },
      { type: 'exact', photos: [{ id: '2' }, { id: '1' }] }
    ];
    const result = DuplicateChecker.removeDuplicateEntries(testData);
    return result.length === 1;
  });
  
} catch (e) {
  check('DuplicateChecker 模块可加载', () => { throw e; });
}

console.log('\n📝 检查示例项目数据...\n');

try {
  const sampleProject = fs.readJsonSync(path.join(samplesDir, 'sample-project.json'));
  
  check('示例项目版本正确', () => sampleProject.version === '1.0');
  check('示例项目包含照片', () => sampleProject.photos && sampleProject.photos.length > 0);
  check('示例项目包含商品', () => sampleProject.products && sampleProject.products.length > 0);
  check('示例项目有未分组照片', () => sampleProject.photos.some(p => !p.groupId), true);
  check('示例项目有瑕疵照片', () => sampleProject.photos.some(p => p.isDefect), true);
  
} catch (e) {
  check('示例项目可加载', () => { throw e; }, true);
}

console.log('\n========================================');
console.log('  自检完成');
console.log('========================================');
console.log(`\n通过: ${passed} 项`);
console.log(`警告: ${warnings} 项`);
console.log(`失败: ${failed} 项`);

if (failed > 0) {
  console.log('\n❌ 存在问题，请检查上述失败项');
  process.exit(1);
} else if (warnings > 0) {
  console.log('\n⚠️ 部分可选项目未完成，但核心功能已就绪');
  console.log('\n🚀 可以运行以下命令启动应用:');
  console.log('   npm install');
  console.log('   npm start');
  process.exit(0);
} else {
  console.log('\n✅ 所有检查通过！');
  console.log('\n🚀 可以运行以下命令启动应用:');
  console.log('   npm install');
  console.log('   npm start');
  console.log('\n🧪 运行自检:');
  console.log('   npm test');
  process.exit(0);
}
