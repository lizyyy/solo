#!/bin/bash

echo "========================================"
echo "  在线考试服务补考资格恢复 API"
echo "========================================"

echo ""
echo "检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "安装npm依赖..."
    npm install
fi

echo ""
echo "初始化数据库..."
npm run init-db

echo ""
echo "运行测试..."
npm test

if [ $? -eq 0 ]; then
    echo ""
    echo "测试通过！启动服务..."
    npm start
else
    echo ""
    echo "测试失败，请检查问题后再启动"
    exit 1
fi
