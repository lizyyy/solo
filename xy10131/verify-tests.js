// 简单的Node.js测试验证脚本
// 用于验证 game.js 和 game-tests.js 的语法和基础结构

console.log('开始验证游戏文件...\n');

// 检查文件是否存在
const fs = require('fs');

const files = [
    'index.html',
    'styles.css', 
    'game.js',
    'game-tests.js'
];

console.log('📁 文件存在性检查:');
files.forEach(file => {
    const exists = fs.existsSync(file);
    const status = exists ? '✅' : '❌';
    console.log(`${status} ${file}`);
    if (!exists) {
        console.error(`错误: ${file} 不存在!`);
        process.exit(1);
    }
});

console.log('\n🔍 语法检查:');

// 检查 game.js 语法
try {
    const gameCode = fs.readFileSync('game.js', 'utf-8');
    new Function(gameCode);
    console.log('✅ game.js 语法有效');
} catch (error) {
    console.log('❌ game.js 语法错误:');
    console.error(error.message);
    process.exit(1);
}

// 检查 game-tests.js 语法
try {
    const testCode = fs.readFileSync('game-tests.js', 'utf-8');
    new Function(testCode);
    console.log('✅ game-tests.js 语法有效');
} catch (error) {
    console.log('❌ game-tests.js 语法错误:');
    console.error(error.message);
    process.exit(1);
}

console.log('\n📋 关键API检查:');

// 提取 game.js 中的API
const gameCode = fs.readFileSync('game.js', 'utf-8');

// 检查关键函数是否存在
const requiredAPIs = [
    'selectPatientForTriage',
    'addTestPatient',
    'triagePatient',
    'startGame',
    'resetGame',
    'getState'
];

requiredAPIs.forEach(api => {
    const regex = new RegExp(api + '\\s*[:=]');
    const found = regex.test(gameCode);
    const status = found ? '✅' : '❌';
    console.log(`${status} API: ${api}`);
    if (!found) {
        console.error(`错误: 必需的API ${api} 未找到!`);
        process.exit(1);
    }
});

console.log('\n🧪 测试用例统计:');

// 检查 game-tests.js 中的测试用例
const testCode = fs.readFileSync('game-tests.js', 'utf-8');
const addTestMatches = testCode.match(/addTest\(['"]/g);
const testCount = addTestMatches ? addTestMatches.length : 0;

console.log(`✅ 共定义 ${testCount} 个测试用例`);

// 列出所有测试名称
const testNameRegex = /addTest\(['"](.+?)['"]/g;
let match;
const testNames = [];
while ((match = testNameRegex.exec(testCode)) !== null) {
    testNames.push(match[1]);
}

testNames.forEach((name, index) => {
    console.log(`   ${index + 1}. ${name}`);
});

console.log('\n' + '='.repeat(50));
console.log('✅ 所有验证通过!');
console.log('='.repeat(50));
console.log('\n使用说明:');
console.log('1. 在浏览器中打开 index.html');
console.log('2. 打开开发者工具 (F12)');
console.log('3. 在 Console 中输入: GameTests.runTests()');
console.log('4. 查看测试结果');
console.log('\n或运行: python3 -m http.server 8000');
console.log('然后访问: http://localhost:8000/');
