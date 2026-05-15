#!/bin/bash

echo "====================================="
echo "  敏感操作双人确认API - 启动脚本"
echo "====================================="
echo ""

# 检查Java版本
echo "检查Java环境..."
if ! command -v java &> /dev/null; then
    echo "❌ 错误: 未找到Java命令，请先安装JDK 8或更高版本"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1-2)
echo "✅ Java版本: $JAVA_VERSION"
echo ""

# 检查是否有预编译的JAR包
if [ -f "target/dual-confirmation-api-1.0.0.jar" ]; then
    echo "找到预编译的JAR包，直接启动..."
    java -jar target/dual-confirmation-api-1.0.0.jar
    exit 0
fi

# 检查Maven Wrapper
if [ -f "./mvnw" ]; then
    echo "使用Maven Wrapper编译并启动..."
    chmod +x ./mvnw
    ./mvnw clean package -DskipTests
    if [ $? -eq 0 ]; then
        echo ""
        echo "编译成功，启动应用..."
        java -jar target/dual-confirmation-api-1.0.0.jar
    else
        echo "❌ 编译失败，请检查错误信息"
        exit 1
    fi
else
    echo "❌ 未找到mvnw脚本，请确保项目完整"
    exit 1
fi
