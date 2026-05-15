#!/bin/bash
set -e

echo "========================================"
echo "  文件病毒扫描编排 API - 测试脚本"
echo "========================================"
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# 检查 Java
if ! command -v java &> /dev/null; then
    echo "错误: 未找到 Java 命令"
    exit 1
fi

echo "正在运行单元测试..."
echo "首次运行会自动下载依赖，请稍候..."
echo ""

if [ -x "./mvnw" ]; then
    ./mvnw test
else
    echo "错误: mvnw 脚本不可执行"
    exit 1
fi

echo ""
echo "========================================"
echo "  测试完成"
echo "========================================"