import re

with open('/Users/mac/pro/solo/workspaces/xy10892/frontend/app.js', 'r') as f:
    content = f.read()

print('=' * 70)
print('  前端代码验证检查')
print('=' * 70)
print()

passed = 0
failed = 0

checks = [
    ('没有 const document 变量声明', r'const\s+document\b', False),
    ('没有 let document 变量声明', r'let\s+document\b', False),
    ('没有 var document 变量声明', r'var\s+document\b', False),
    ('renderDocumentContent 使用 docData 参数', r'function renderDocumentContent\(docData\)', True),
    ('renderActionButtons 使用 docData 参数', r'function renderActionButtons\(status, docData\)', True),
    ('viewDocument 中声明 const docData', r'const docData = await apiCall\(`/documents/\$\{docId\}`\)', True),
    ('viewDocument 中声明 const statusHistory', r'const statusHistory = await apiCall\(`/documents/\$\{docId\}/history`\)', True),
    ('renderHistory 使用 statusHistory 参数', r'function renderHistory\(statusHistory\)', True),
    ('renderDocumentContent 内使用 docData.content', r'if \(!docData\.content\)', True),
    ('renderDocumentContent 内使用 docData.masked_content', r'\$\{docData\.masked_content\}', True),
    ('renderActionButtons 内使用 docData.content (2处)', r'if \(docData\.content\)', True, 2),
    ('没有 const history 变量声明', r'const\s+history\b', False),
    ('loadDashboard 中使用 statusHistory', r'const statusHistory = await apiCall\(`/documents/\$\{doc\.id\}/history`\)', True),
    ('viewDocument 中使用 docData.filename', r'docData\.filename', True),
    ('viewDocument 中使用 docData.status (3处)', r'docData\.status', True, 3),
    ('viewDocument 中使用 docData.reviews', r'docData\.reviews', True),
    ('使用 escapeHtml(docData.content)', r'escapeHtml\(docData\.content\)', True),
    ('使用 escapeHtml(docData.masked_content)', r'escapeHtml\(docData\.masked_content\)', True),
]

for check in checks:
    name, pattern, should_exist = check[0], check[1], check[2]
    min_count = check[3] if len(check) > 3 else 1
    
    matches = re.findall(pattern, content)
    count = len(matches)
    
    if not should_exist:
        if count == 0:
            print(f'✅ {name}')
            passed += 1
        else:
            print(f'❌ {name} - 发现 {count} 处不应该存在的匹配')
            for m in matches[:3]:
                print(f'   找到: {m[:80]}')
            failed += 1
    else:
        if count >= min_count:
            print(f'✅ {name} ({count} 处匹配)')
            passed += 1
        else:
            print(f'❌ {name} - 期望至少 {min_count} 处，实际 {count} 处')
            failed += 1

print()
print('=' * 70)
print(f'  验证结果: {passed} 通过, {failed} 失败')
print('=' * 70)

if failed > 0:
    print()
    print('❌ 存在问题，请修复后重试')
    exit(1)
else:
    print()
    print('✅ 所有检查通过！前端变量命名冲突问题已修复')
    print()
    print('修复总结：')
    print('  - viewDocument() 中 const document → const docData')
    print('  - renderDocumentContent(document) → renderDocumentContent(docData)')
    print('  - renderActionButtons(status, document) → renderActionButtons(status, docData)')
    print('  - renderHistory(history) → renderHistory(statusHistory)')
    print('  - 所有函数内 document.content → docData.content')
    print('  - 所有函数内 document.masked_content → docData.masked_content')
    print('  - loadDashboard() 中 history → statusHistory')
    print('  - viewDocument() 中 history → statusHistory')
    print()
    print('现在可以在浏览器中打开 frontend/index.html 使用了')
    exit(0)
