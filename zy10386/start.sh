#!/bin/bash
set -e

echo "========================================"
echo "跨境数据访问审批 API - 启动脚本"
echo "========================================"

# 检查 Java 版本
echo ""
echo "检查 Java 环境..."
if ! command -v java &> /dev/null; then
    echo "❌ 错误: 未找到 Java，请安装 Java 8 或更高版本的 JDK"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F'"' '{print $2}' | cut -d'.' -f1)
echo "✓ Java 版本: $JAVA_VERSION"

if [ "$JAVA_VERSION" -lt 8 ]; then
    echo "❌ 错误: 需要 Java 8 或更高版本，当前版本: $JAVA_VERSION"
    exit 1
fi

# 检查是否有 javac（JDK，不是 JRE）
if ! command -v javac &> /dev/null; then
    echo ""
    echo "⚠️  警告: 未检测到 javac 编译器，当前可能是 JRE 而非 JDK"
    echo "   如果已有编译好的 JAR 文件，可直接运行"
    echo "   如需编译项目，请安装完整 JDK"
    echo ""
    
    # 检查是否已有 JAR 文件
    JAR_COUNT=$(ls target/*.jar 2>/dev/null | wc -l)
    if [ "$JAR_COUNT" -gt 0 ]; then
        echo "✓ 发现已编译的 JAR 文件，将直接启动..."
    else
        echo "❌ 未发现已编译的 JAR 文件，且无法编译"
        echo "   请安装 JDK 后重新运行此脚本"
        echo "   下载地址: https://adoptium.net/"
        exit 1
    fi
else
    echo "✓ JDK 编译器已就绪"
fi

# 创建数据目录
echo ""
echo "准备数据目录..."
mkdir -p data
echo "✓ 数据目录已就绪"

# 检查是否已编译
if [ ! -d "target/classes" ]; then
    echo ""
    echo "编译项目..."
    chmod +x ./mvnw
    ./mvnw clean package -DskipTests
fi

# 查找 JAR 文件
JAR_FILE=$(ls target/*.jar 2>/dev/null | head -n 1)
if [ -z "$JAR_FILE" ] || [ ! -f "$JAR_FILE" ]; then
    echo ""
    echo "重新编译项目..."
    chmod +x ./mvnw
    ./mvnw clean package -DskipTests
    JAR_FILE=$(ls target/*.jar 2>/dev/null | head -n 1)
fi

echo ""
echo "启动应用..."
echo "========================================"
echo "服务地址: http://localhost:8080"
echo "H2控制台: http://localhost:8080/h2-console"
echo "数据库: jdbc:h2:file:./data/approvaldb"
echo "========================================"
echo ""

java -jar "$JAR_FILE"
