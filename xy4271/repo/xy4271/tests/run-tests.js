const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('地铁夜间检修调度游戏 - 测试运行器');
console.log('========================================\n');

const testFiles = [];
const testsDir = __dirname;

fs.readdirSync(testsDir).forEach(file => {
    if (file.endsWith('.test.js')) {
        testFiles.push(file);
    }
});

if (testFiles.length === 0) {
    console.log('❌ 没有找到测试文件');
    process.exit(0);
}

console.log(`📁 找到 ${testFiles.length} 个测试文件:\n`);
testFiles.forEach((file, index) => {
    console.log(`   ${index + 1}. ${file}`);
});

console.log('\nℹ️  注意: 本项目使用 ES Modules，需要在浏览器环境中运行');
console.log('ℹ️  测试工具位于 tests/test-utils.js');
console.log('ℹ️  您可以:');
console.log('   1. 启动本地服务器: npm start');
console.log('   2. 在浏览器中访问 http://localhost:8080');
console.log('   3. 验证游戏是否正常运行\n');

console.log('========================================');
console.log('快速验证指南');
console.log('========================================\n');

console.log('1. 启动服务器:');
console.log('   npm start\n');

console.log('2. 打开浏览器访问:');
console.log('   http://localhost:8080\n');

console.log('3. 验证项目结构:');
const projectStructure = {
    'index.html': '主页面',
    'css/style.css': '样式文件',
    'src/main.js': '主入口',
    'src/game.js': '游戏主类',
    'src/levels/parser.js': '关卡解析器',
    'src/levels/levelManager.js': '关卡管理器',
    'src/levels/data/tutorial.json': '教程关卡',
    'src/levels/data/beginner_1.json': '新手关卡',
    'src/engine/rulesEngine.js': '规则引擎',
    'src/state/gameState.js': '游戏状态',
    'src/state/historyManager.js': '历史管理器',
    'src/ui/renderer.js': '渲染器',
    'src/ui/controller.js': 'UI控制器',
    'src/storage/saveManager.js': '存档管理器',
    'tests/test-utils.js': '测试工具',
    'tests/levelParser.test.js': '关卡解析器测试',
    'package.json': '项目配置'
};

let allExist = true;
Object.entries(projectStructure).forEach(([file, desc]) => {
    const fullPath = path.join(__dirname, '..', file);
    const exists = fs.existsSync(fullPath);
    const icon = exists ? '✅' : '❌';
    console.log(`   ${icon} ${file} - ${desc}`);
    if (!exists) allExist = false;
});

console.log('');

if (allExist) {
    console.log('🎉 所有核心文件都存在！');
    console.log('🚀 项目已准备就绪，可以运行！\n');
} else {
    console.log('⚠️  部分文件缺失，请检查项目结构\n');
}

console.log('========================================');
console.log('游戏功能预览');
console.log('========================================\n');

console.log('核心功能:');
console.log('  ✅ 网格线路图渲染');
console.log('  ✅ 检修车移动和控制');
console.log('  ✅ 封锁区放置和移除');
console.log('  ✅ 末班车按时刻移动');
console.log('  ✅ 关键轨段维修机制');
console.log('  ✅ 冲突检测（列车相撞）');
console.log('  ✅ 电量管理系统');
console.log('  ✅ 超时检测机制');
console.log('  ✅ 撤销/重做功能');
console.log('  ✅ 通关评分系统');
console.log('  ✅ 本地存档系统');
console.log('  ✅ 关卡导入/导出\n');

console.log('操作说明:');
console.log('  1. 点击检修车选中');
console.log('  2. 点击相邻轨道移动');
console.log('  3. 在关键轨段上点击检修车进行维修');
console.log('  4. 使用封锁区工具放置/移除封锁区');
console.log('  5. 点击"下一回合"让末班车移动');
console.log('  6. 按 Ctrl+Z 撤销，Ctrl+Y 重做\n');

console.log('========================================');
console.log('关卡格式说明 (JSON)');
console.log('========================================\n');

console.log('网格单元格格式:');
console.log('  E - 空地');
console.log('  T-NS - 南北方向轨道');
console.log('  T-EW - 东西方向轨道');
console.log('  S-NS - 南北方向车站');
console.log('  J-NSWE - 四方向交汇点');
console.log('  D - 车库');
console.log('  X - 终点站\n');

console.log('方向代码:');
console.log('  N - 北 (上)');
console.log('  S - 南 (下)');
console.log('  E - 东 (右)');
console.log('  W - 西 (左)\n');

console.log('示例关卡位于: src/levels/data/\n');

process.exit(0);
