#!/bin/bash
# 县域防汛安置物资 API 启动脚本

echo "========================================"
echo "  县域防汛安置物资 API - 启动脚本"
echo "========================================"
echo ""

# 检查 Java
if ! command -v java >/dev/null 2>&1; then
    echo "❌ 未找到 Java，请安装 JDK 17+"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F'"' '{print $2}' | cut -d'.' -f1)
echo "✅ Java 版本: $JAVA_VERSION"

# 检查 Maven
if command -v mvn >/dev/null 2>&1; then
    echo "✅ Maven 已安装"
    echo ""
    echo "正在编译并启动服务..."
    echo "  API 地址: http://localhost:8080/api"
    echo "  H2 控制台: http://localhost:8080/api/h2-console"
    echo ""
    mvn clean spring-boot:run
else
    echo ""
    echo "⚠️  未找到 Maven，请先安装:"
    echo "   macOS: brew install maven"
    echo "   下载: https://maven.apache.org/download.cgi"
    echo ""
    echo "安装后执行:"
    echo "   mvn clean spring-boot:run"
    exit 1
fi
