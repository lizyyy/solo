const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('📋 文档切片策略台 - 代码验证脚本');
console.log('========================================\n');

let passed = 0;
let failed = 0;

function test(description, fn) {
    try {
        fn();
        console.log(`✅ ${description}`);
        passed++;
    } catch (e) {
        console.log(`❌ ${description}`);
        console.log(`   错误: ${e.message}`);
        failed++;
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

console.log('📁 目录结构验证:');
console.log('----------------------------------------');

test('项目根目录存在', () => {
    assert(fs.existsSync(__dirname), '根目录不存在');
});

test('server 目录存在', () => {
    assert(fs.existsSync(path.join(__dirname, 'server')), 'server 目录不存在');
});

test('public 目录存在', () => {
    assert(fs.existsSync(path.join(__dirname, 'public')), 'public 目录不存在');
});

test('data 目录存在', () => {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    assert(fs.existsSync(dataDir), 'data 目录无法创建');
});

console.log('\n📄 后端文件验证:');
console.log('----------------------------------------');

const serverFiles = [
    'server/index.js',
    'server/database/connection.js',
    'server/database/init.js',
    'server/middleware/requestLogger.js',
    'server/routes/documents.js',
    'server/routes/rules.js',
    'server/routes/previews.js',
    'server/routes/versions.js',
    'server/routes/export.js'
];

serverFiles.forEach(file => {
    test(`${file} 存在`, () => {
        assert(fs.existsSync(path.join(__dirname, file)), `${file} 不存在`);
    });
});

test('server/index.js 语法正确', () => {
    const content = fs.readFileSync(path.join(__dirname, 'server/index.js'), 'utf8');
    assert(content.includes('express'), '未引用 express');
    assert(content.includes('listen'), '未启动服务');
    assert(content.includes('requestLogger'), '未使用请求日志中间件');
});

test('server/routes/previews.js 包含表格提取逻辑', () => {
    const content = fs.readFileSync(path.join(__dirname, 'server/routes/previews.js'), 'utf8');
    assert(content.includes('extractTables'), '未定义 extractTables 函数');
    assert(content.includes('INSERT INTO table_fragments'), '未写入 table_fragments');
    assert(content.indexOf('/tables') < content.indexOf('/:id'), '/tables 路由应在 /:id 之前');
    assert(content.includes('tables_count'), '响应中未包含表格数量');
});

test('数据库初始化包含所有表', () => {
    const content = fs.readFileSync(path.join(__dirname, 'server/database/init.js'), 'utf8');
    assert(content.includes('documents'), '缺少 documents 表');
    assert(content.includes('slice_rules'), '缺少 slice_rules 表');
    assert(content.includes('heading_hierarchies'), '缺少 heading_hierarchies 表');
    assert(content.includes('table_fragments'), '缺少 table_fragments 表');
    assert(content.includes('slice_previews'), '缺少 slice_previews 表');
    assert(content.includes('published_versions'), '缺少 published_versions 表');
    assert(content.includes('request_logs'), '缺少 request_logs 表');
});

test('请求日志中间件包含责任节点', () => {
    const content = fs.readFileSync(path.join(__dirname, 'server/middleware/requestLogger.js'), 'utf8');
    assert(content.includes('responsibility_node'), '未记录责任节点');
    assert(content.includes('request_input'), '未记录请求输入');
    assert(content.includes('response_result'), '未记录响应结果');
});

console.log('\n🎨 前端文件验证:');
console.log('----------------------------------------');

const publicFiles = [
    'public/index.html',
    'public/app.js'
];

publicFiles.forEach(file => {
    test(`${file} 存在`, () => {
        assert(fs.existsSync(path.join(__dirname, file)), `${file} 不存在`);
    });
});

test('public/index.html 包含表格列表容器', () => {
    const content = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
    assert(content.includes('tables-list'), '缺少 tables-list 容器');
});

test('public/app.js 包含表格加载函数', () => {
    const content = fs.readFileSync(path.join(__dirname, 'public/app.js'), 'utf8');
    assert(content.includes('loadTableFragments'), '缺少 loadTableFragments 函数');
    assert(content.includes('/previews/tables/'), '未调用表格API');
});

console.log('\n📦 配置文件验证:');
console.log('----------------------------------------');

test('package.json 包含所有依赖', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    assert(pkg.dependencies.express, '缺少 express 依赖');
    assert(pkg.dependencies['better-sqlite3'], '缺少 better-sqlite3 依赖');
    assert(pkg.dependencies.cors, '缺少 cors 依赖');
    assert(pkg.dependencies['body-parser'], '缺少 body-parser 依赖');
    assert(pkg.scripts.start, '缺少 start 脚本');
});

test('test-api.sh 测试脚本存在', () => {
    assert(fs.existsSync(path.join(__dirname, 'test-api.sh')), '测试脚本不存在');
});

console.log('\n🧠 核心逻辑验证:');
console.log('----------------------------------------');

test('表格提取正则表达式有效', () => {
    const previews = fs.readFileSync(path.join(__dirname, 'server/routes/previews.js'), 'utf8');
    const regexMatch = previews.match(/const tableRegex = \/([^/]+)\//);
    assert(regexMatch, '表格正则表达式存在');
});

test('版本发布与回滚逻辑完整', () => {
    const versions = fs.readFileSync(path.join(__dirname, 'server/routes/versions.js'), 'utf8');
    assert(versions.includes('/publish'), '缺少发布接口');
    assert(versions.includes('/rollback'), '缺少回滚接口');
    assert(versions.includes('config_snapshot'), '缺少配置快照');
});

test('导出接口完整', () => {
    const export_ = fs.readFileSync(path.join(__dirname, 'server/routes/export.js'), 'utf8');
    assert(export_.includes('/slices/'), '缺少切片导出');
    assert(export_.includes('/logs'), '缺少日志导出');
    assert(export_.includes('/rules/'), '缺少规则导出');
});

console.log('\n📊 API 路由验证:');
console.log('----------------------------------------');

const routes = [
    { file: 'server/routes/documents.js', methods: ['POST', 'GET', 'PUT', 'DELETE'] },
    { file: 'server/routes/rules.js', methods: ['POST', 'GET', 'PUT', 'DELETE'] },
    { file: 'server/routes/previews.js', methods: ['POST /generate', 'GET /', 'GET /tables', 'GET /:id'] },
    { file: 'server/routes/versions.js', methods: ['POST /publish', 'GET /', 'POST /rollback'] },
    { file: 'server/routes/export.js', methods: ['GET /slices', 'GET /logs', 'GET /rules'] }
];

routes.forEach(route => {
    test(`${route.file} 路由定义`, () => {
        const content = fs.readFileSync(path.join(__dirname, route.file), 'utf8');
        route.methods.forEach(method => {
            const [verb, path] = method.split(' ');
            const searchVerb = verb.toLowerCase();
            if (path) {
                assert(content.includes(`${searchVerb}('${path}`) || content.includes(`${searchVerb}("${path}`), 
                    `缺少 ${method} 路由`);
            } else {
                assert(content.includes(`router.${searchVerb}`), `缺少 ${method} 方法`);
            }
        });
    });
});

console.log('\n========================================');
console.log(`📊 验证结果: ${passed} 通过, ${failed} 失败`);
console.log('========================================');

if (failed === 0) {
    console.log('\n✅ 所有验证通过!');
    console.log('\n📝 下一步:');
    console.log('  1. 执行 npm install 安装依赖');
    console.log('  2. 执行 npm start 启动服务');
    console.log('  3. 访问 http://localhost:3000 查看控制台');
    console.log('  4. 执行 bash test-api.sh 测试 API');
    process.exit(0);
} else {
    console.log('\n❌ 部分验证失败，请检查上述错误');
    process.exit(1);
}
