#!/bin/bash

echo "=========================================="
echo "学校实验室耗材权限追责台账服务启动脚本"
echo "=========================================="

echo ""
echo "1. 检查Python环境..."
python3 --version

echo ""
echo "2. 安装依赖..."
pip3 install -r requirements.txt

echo ""
echo "3. 启动服务..."
echo "服务将在 http://localhost:8000 启动"
echo "API文档地址: http://localhost:8000/docs"
echo ""
echo "默认测试账号（密码均为 123456）："
echo "  - 录入员: entry_user"
echo "  - 复核员: reviewer_user"
echo "  - 主管: supervisor_user"
echo "  - 只读查看: readonly_user"
echo "  - 学院秘书: secretary_user"
echo ""
echo "首次启动后请访问 GET /api/v1/auth/init-default-users 初始化测试用户"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
