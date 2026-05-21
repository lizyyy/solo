const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'frontend', 'app.js');
const content = fs.readFileSync(appJsPath, 'utf8');

console.log('='.repeat(70));
console.log('  前端代码验证检查');
console.log('='.repeat(70));
console.log();

let passed = 0;
let failed = 0;

const checks = [
    {
        name: '没有 const document 变量声明',
        pattern: /const\s+document\b/,
        shouldNotExist: true
    },
    {
        name: '没有 let document 变量声明',
        pattern: /let\s+document\b/,
        shouldNotExist: true
    },
    {
        name: '没有 var document 变量声明',
        pattern: /var\s+document\b/,
        shouldNotExist: true
    },
    {
        name: 'renderDocumentContent 使用 docData 参数',
        pattern: /function renderDocumentContent\(docData\)/,
        shouldExist: true
    },
    {
        name: 'renderActionButtons 使用 docData 参数',
        pattern: /function renderActionButtons\(status, docData\)/,
        shouldExist: true
    },
    {
        name: 'viewDocument 中声明 const docData',
        pattern: /const docData = await apiCall\(`\/documents\/\$\{docId\}`\)/,
        shouldExist: true
    },
    {
        name: 'viewDocument 中声明 const statusHistory',
        pattern: /const statusHistory = await apiCall\(`\/documents\/\$\{docId\}\/history`\)/,
        shouldExist: true
    },
    {
        name: 'renderHistory 使用 statusHistory 参数',
        pattern: /function renderHistory\(statusHistory\)/,
        shouldExist: true
    },
    {
        name: 'renderDocumentContent 内使用 docData.content',
        pattern: /if \(!docData\.content\)/,
        shouldExist: true
    },
    {
        name: 'renderDocumentContent 内使用 docData.masked_content',
        pattern: /\$\{docData\.masked_content\}/,
        shouldExist: true
    },
    {
        name: 'renderActionButtons 内使用 docData.content',
        pattern: /if \(docData\.content\)/g,
        shouldExist: true,
        minCount: 2
    },
    {
        name: '没有 const history 变量声明（避免与 window.history 混淆）',
        pattern: /const\s+history\b/,
        shouldNotExist: true
    },
    {
        name: 'loadDashboard 中使用 const statusHistory',
        pattern: /const statusHistory = await apiCall\(`\/documents\/\$\{doc\.id\}\/history`\)/,
        shouldExist: true
    },
    {
        name: 'viewDocument 中使用 docData.filename',
        pattern: /docData\.filename/,
        shouldExist: true
    },
    {
        name: 'viewDocument 中使用 docData.status',
        pattern: /docData\.status/g,
        shouldExist: true,
        minCount: 3
    },
    {
        name: 'viewDocument 中使用 docData.reviews',
        pattern: /docData\.reviews/,
        shouldExist: true
    },
    {
        name: 'renderDocumentContent 中使用 escapeHtml(docData.content)',
        pattern: /escapeHtml\(docData\.content\)/,
        shouldExist: true
    },
    {
        name: 'renderDocumentContent 中使用 escapeHtml(docData.masked_content)',
        pattern: /escapeHtml\(docData\.masked_content\)/,
        shouldExist: true
    }
];

checks.forEach(check => {
    const matches = content.match(check.pattern);
    const count = matches ? matches.length : 0;
    const minCount = check.minCount || 1;
    
    if (check.shouldNotExist) {
        if (count === 0) {
            console.log(`✅ ${check.name}`);
            passed++;
        } else {
            console.log(`❌ ${check.name} - 发现 ${count} 处不应该存在的匹配`);
            if (matches) {
                matches.forEach(m => console.log(`   找到: ${m}`));
            }
            failed++;
        }
    } else if (check.shouldExist) {
        if (count >= minCount) {
            console.log(`✅ ${check.name} (${count} 处匹配)`);
            passed++;
        } else {
            console.log(`❌ ${check.name} - 期望至少 ${minCount} 处，实际 ${count} 处`);
            failed++;
        }
    }
});

console.log();
console.log('='.repeat(70));
console.log(`  验证结果: ${passed} 通过, ${failed} 失败`);
console.log('='.repeat(70));

if (failed > 0) {
    console.log();
    console.log('❌ 存在问题，请修复后重试');
    process.exit(1);
} else {
    console.log();
    console.log('✅ 所有检查通过！前端变量命名冲突问题已修复');
    console.log();
    console.log('修复总结：');
    console.log('  - viewDocument() 中 const document → const docData');
    console.log('  - renderDocumentContent(document) → renderDocumentContent(docData)');
    console.log('  - renderActionButtons(status, document) → renderActionButtons(status, docData)');
    console.log('  - renderHistory(history) → renderHistory(statusHistory)');
    console.log('  - 所有函数内 document.content → docData.content');
    console.log('  - 所有函数内 document.masked_content → docData.masked_content');
    console.log('  - loadDashboard() 中 history → statusHistory');
    console.log('  - viewDocument() 中 history → statusHistory');
    console.log();
    console.log('现在可以在浏览器中打开 frontend/index.html 使用了');
    process.exit(0);
}
