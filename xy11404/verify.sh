#!/bin/bash

echo "=== 冷链中转权限追责台账 API - 项目验证 ==="
echo ""
echo "项目结构:"
tree -I 'node_modules' -L 3 2>/dev/null || find . -not -path '*/node_modules/*' -type f | head -30
echo ""
echo "核心文件检查:"
for file in package.json tsconfig.json prisma/schema.prisma src/index.ts \
            src/services/ledgerService.ts src/services/stateMachine.ts \
            src/routes/ledgerRoutes.ts tests/ledger.test.ts README.md
do
    if [ -f "$file" ]; then
        echo "✓ $file 存在"
    else
        echo "✗ $file 缺失"
    fi
done
echo ""
echo "=== 安装依赖并初始化数据库 ==="
echo "运行以下命令:"
echo "  npm install"
echo "  npm run prisma:generate"
echo "  npm run prisma:migrate --name init"
echo ""
echo "=== 运行测试 ==="
echo "  npm test"
echo ""
echo "=== 启动开发服务 ==="
echo "  npm run seed  # 可选，播种样例数据"
echo "  npm run dev"
echo ""
echo "详细使用说明请查看 README.md"
