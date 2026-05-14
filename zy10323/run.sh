#!/bin/bash
# 多版本响应适配器 - 启动脚本

set -e

PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$PROJECT_DIR"

echo "=========================================="
echo "  多版本响应适配器 - 启动脚本"
echo "=========================================="
echo ""

# 检查 Java 版本
JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f 2 | cut -d'.' -f1-2)
echo "检测到 Java 版本: $JAVA_VERSION"

# 检查是否有 Maven
if command -v mvn &> /dev/null; then
    echo "使用系统 Maven"
    MVN_CMD="mvn"
elif [ -f "$PROJECT_DIR/mvnw" ]; then
    echo "使用 Maven Wrapper"
    MVN_CMD="$PROJECT_DIR/mvnw"
else
    echo ""
    echo "错误: 未找到 Maven!"
    echo "请安装 Maven 或确保 mvnw 可用"
    exit 1
fi

echo ""
echo "编译并打包项目..."
$MVN_CMD clean package -DskipTests -q

if [ $? -eq 0 ]; then
    echo ""
    echo "构建成功!"
    echo ""
    echo "启动应用..."
    echo "=========================================="
    echo "  API 端点:"
    echo "    - 主入口: http://localhost:8080"
    echo "    - H2 控制台: http://localhost:8080/h2-console"
    echo "    - 适配接口: POST http://localhost:8080/api/versions/adapt"
    echo "=========================================="
    echo ""
    
    java -jar target/version-response-adapter-1.0.0.jar
else
    echo ""
    echo "构建失败!"
    exit 1
fi
