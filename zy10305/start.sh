#!/bin/bash

set -e

echo "========================================"
echo "分布式缓存失效编排 API - 启动脚本"
echo "========================================"
echo ""

APP_JAR="target/cache-invalidation-orchestrator-1.0.0.jar"
MAIN_CLASS="com.cache.orchestrator.CacheInvalidationApplication"

mkdir -p data

if command -v mvn &> /dev/null; then
    echo "检测到 Maven, 正在编译项目..."
    mvn clean package -DskipTests -q
    echo "编译完成!"
    echo ""
else
    echo "[警告] 未检测到 Maven, 尝试使用预编译模式..."
    echo ""
fi

if [ -f "$APP_JAR" ]; then
    echo "启动应用..."
    echo ""
    java -jar "$APP_JAR"
else
    echo "========================================"
    echo "错误: 找不到可执行的 jar 文件"
    echo "========================================"
    echo ""
    echo "请安装 Maven 后重新运行:"
    echo "  1. 安装 Maven: https://maven.apache.org/install.html"
    echo "  2. 确保 'mvn' 命令在 PATH 中"
    echo "  3. 再次运行: ./start.sh"
    echo ""
    echo "或者, 如果您在 IDE 中:"
    echo "  1. 打开项目"
    echo "  2. 运行主类: com.cache.orchestrator.CacheInvalidationApplication"
    echo ""
    exit 1
fi
