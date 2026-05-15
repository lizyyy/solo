#!/bin/bash

echo "======================================"
echo "  费用试算 API 启动脚本"
echo "======================================"
echo ""

# 检查Java版本
if ! command -v java &> /dev/null; then
    echo "❌ 错误: 未找到Java，请先安装JDK 8或更高版本"
    echo ""
    echo "安装建议:"
    echo "  Mac: brew install openjdk@11"
    echo "  Linux: sudo apt install openjdk-11-jdk"
    echo "  下载: https://adoptium.net/"
    exit 1
fi

# 正确解析Java版本 (支持 1.8, 11, 17 等格式)
JAVA_FULL_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2)
echo "✅ Java版本: $JAVA_FULL_VERSION"

# 提取主版本号
JAVA_MAJOR=$(echo "$JAVA_FULL_VERSION" | cut -d'.' -f1)
if [ "$JAVA_MAJOR" = "1" ]; then
    JAVA_MAJOR=$(echo "$JAVA_FULL_VERSION" | cut -d'.' -f2)
fi
echo "   主版本号: $JAVA_MAJOR"

if [ "$JAVA_MAJOR" -lt 8 ]; then
    echo "❌ 错误: 需要Java 8或更高版本"
    exit 1
fi

echo ""

# 查找Maven命令
find_maven() {
    # 1. 系统Maven
    if command -v mvn &> /dev/null; then
        echo "mvn"
        return 0
    fi
    
    # 2. 已有的Maven Wrapper
    if [ -f "./mvnw" ]; then
        chmod +x ./mvnw
        echo "./mvnw"
        return 0
    fi
    
    # 3. 尝试安装Maven Wrapper
    echo ""
    echo "📦 未找到Maven，正在安装Maven Wrapper..."
    chmod +x ./install-mvnw.sh
    if ./install-mvnw.sh; then
        if [ -f "./mvnw" ]; then
            chmod +x ./mvnw
            echo "./mvnw"
            return 0
        fi
    fi
    
    return 1
}

MVN_CMD=$(find_maven)

if [ -z "$MVN_CMD" ]; then
    echo ""
    echo "❌ 无法找到或安装Maven"
    echo ""
    echo "备选启动方案:"
    echo ""
    echo "1. 使用IDE直接运行（推荐）:"
    echo "   在IDE中打开项目，直接运行:"
    echo "   src/main/java/com/feiyong/feecalc/FeeCalculationApplication.java"
    echo ""
    echo "2. 手动安装Maven:"
    echo "   Mac: brew install maven"
    echo "   Linux: sudo apt install maven 或 sudo yum install maven"
    echo "   下载: https://maven.apache.org/download.cgi"
    echo ""
    exit 1
fi

echo "✅ 使用Maven命令: $MVN_CMD"
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
