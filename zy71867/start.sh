#!/bin/bash
# 教研讲义管理工具 - 快速启动脚本

cd "$(dirname "$0")"

echo "=============================================="
echo "  教研讲义管理工具"
echo "=============================================="
echo ""

echo "📦 检查依赖..."
if ! python3 -c "import flask, flask_cors, pandas, openpyxl, PIL" 2>/dev/null; then
    echo "   安装依赖包..."
    pip install -r requirements.txt
else
    echo "   ✓ 依赖已安装"
fi
echo ""

echo "🗄️  生成测试数据..."
if [ ! -f "teaching_research.db" ]; then
    python3 seed_test_data.py
else
    echo "   数据库已存在，跳过数据生成"
    read -p "   是否重新生成测试数据？(y/N): " regenerate
    if [[ "$regenerate" =~ ^[Yy]$ ]]; then
        rm -f teaching_research.db
        python3 seed_test_data.py
    fi
fi
echo ""

echo "✅ 验证核心证据持久化..."
python3 verify_evidence.py
echo ""

echo "🚀 启动服务..."
echo ""
echo "服务地址: http://localhost:5000"
echo "按 Ctrl+C 停止服务"
echo ""

python3 app.py
