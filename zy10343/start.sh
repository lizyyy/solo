#!/bin/bash
set -e

echo "========================================"
echo "  文件病毒扫描编排 API - 启动脚本"
echo "========================================"
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# 检查 Java
if ! command -v java &> /dev/null; then
    echo "错误: 未找到 Java 命令"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -1 | cut -d'"' -f2 | cut -d'.' -f1-2)
echo "检测到 Java 版本: $JAVA_VERSION"

# 使用 Maven Wrapper 构建
echo ""
echo "正在使用 Maven Wrapper 构建项目..."
echo "首次运行会自动下载 Maven 和依赖，请稍候..."
echo ""

if [ -x "./mvnw" ]; then
    ./mvnw clean package -DskipTests -q
else
    echo "错误: mvnw 脚本不可执行"
    exit 1
fi

# 检查是否构建成功
JAR_FILE=$(ls target/*.jar 2>/dev/null | head -1)
if [ -z "$JAR_FILE" ]; then
    echo "错误: 未找到构建生成的 jar 文件"
    exit 1
fi

echo ""
echo "构建成功: $JAR_FILE"
echo ""
echo "正在启动服务..."
echo "服务地址: http://localhost:8080/api"
echo "H2 控制台: http://localhost:8080/h2-console"
echo "按 Ctrl+C 停止服务"
echo "========================================"
echo ""

java -jar "$JAR_FILE"