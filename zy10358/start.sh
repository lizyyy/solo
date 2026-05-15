#!/bin/bash

echo "======================================"
echo "  费用试算 API 启动脚本"
echo "======================================"
echo ""

# 检查Java版本
if ! command -v java &> /dev/null; then
    echo "❌ 错误: 未找到Java，请先安装JDK 11或更高版本"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)
echo "✅ Java版本: $JAVA_VERSION"

# 检查Maven
if command -v mvn &> /dev/null; then
    echo "✅ 使用系统Maven"
    MVN_CMD="mvn"
else
    echo "⚠️  系统未安装Maven，尝试使用内嵌方式..."
    # 尝试使用内嵌的Maven wrapper
    if [ -f "./mvnw" ]; then
        MVN_CMD="./mvnw"
        chmod +x ./mvnw
        echo "✅ 使用Maven Wrapper"
    else
        echo "❌ 错误: 未找到Maven，请先安装Maven或使用预编译的jar包"
        echo ""
        echo "备选方案:"
        echo "  1. 安装Maven: brew install maven 或下载 https://maven.apache.org/"
        echo "  2. 使用IDE直接运行: 打开项目，运行 FeeCalculationApplication.java"
        exit 1
    fi
fi

echo ""
echo "🚀 开始启动服务..."
echo ""
echo "   访问地址:"
echo "   - 管理控制台: http://localhost:8080"
echo "   - H2数据库控制台: http://localhost:8080/h2-console"
echo ""
echo "   按 Ctrl+C 停止服务"
echo ""
echo "======================================"
echo ""

$MVN_CMD spring-boot:run
