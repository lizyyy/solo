#!/bin/bash

echo "========================================"
echo "  提示词模板审批台 - 配置验证"
echo "========================================"
echo ""

ERRORS=0

# 验证 package.json
echo "🔍 检查前端 package.json..."
python3 -c "import json; json.load(open('frontend/package.json'))" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "   ✅ package.json 格式正确"
else
    echo "   ❌ package.json 格式错误"
    ERRORS=$((ERRORS + 1))
fi

# 验证后端Python代码语法
echo ""
echo "🔍 检查后端Python代码语法..."
python3 -m py_compile backend/models.py 2>/dev/null
if [ $? -eq 0 ]; then
    echo "   ✅ models.py 语法正确"
else
    echo "   ❌ models.py 语法错误"
    ERRORS=$((ERRORS + 1))
fi

python3 -m py_compile backend/app.py 2>/dev/null
if [ $? -eq 0 ]; then
    echo "   ✅ app.py 语法正确"
else
    echo "   ❌ app.py 语法错误"
    ERRORS=$((ERRORS + 1))
fi

# 检查必要的目录
echo ""
echo "🔍 检查必要目录..."
mkdir -p backend/data
mkdir -p backend/exports
echo "   ✅ 数据目录已创建"

echo ""
echo "========================================"
if [ $ERRORS -eq 0 ]; then
    echo "  ✅ 所有验证通过！"
    echo ""
    echo "  启动方式："
    echo "  1. 方式一：./start.sh (推荐)"
    echo "  2. 方式二：分别启动前后端"
    echo "     - 后端: cd backend && python3 app.py"
    echo "     - 前端: cd frontend && npm install && npm run dev"
    echo ""
    echo "  访问地址: http://localhost:3000"
else
    echo "  ❌ 发现 $ERRORS 个错误，请修复后重试"
    exit 1
fi
echo "========================================"
