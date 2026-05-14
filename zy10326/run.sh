#!/bin/bash

set -e

echo "=================================="
echo "接口重试预算服务 - 快速启动脚本"
echo "=================================="

# 检查Java版本
if ! command -v java &> /dev/null; then
    echo "❌ 未找到Java命令，请先安装JDK 17+"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -1 | cut -d'"' -f2 | cut -d'.' -f1)
if [ "$JAVA_VERSION" -lt 17 ]; then
    echo "❌ 需要Java 17或更高版本，当前版本: $JAVA_VERSION"
    exit 1
fi
echo "✅ Java版本检查通过: $JAVA_VERSION"

# 创建必要的目录
mkdir -p data target/classes

# 检查是否存在Maven
if command -v mvn &> /dev/null; then
    echo ""
    echo "使用Maven编译..."
    mvn compile -q
    echo "✅ 编译完成"
else
    echo ""
    echo "未找到Maven，尝试使用javac直接编译..."
    
    # 下载依赖（简化版 - 使用在线下载）
    if [ ! -d "target/deps" ]; then
        echo "正在下载依赖..."
        mkdir -p target/deps
        
        # 这里简化：使用Spring Boot fat jar直接运行
        if [ ! -f "target/spring-boot-loader.jar" ]; then
            echo "下载Spring Boot Loader..."
            # 使用系统已有环境变量
            echo "⚠️ 纯Java模式：使用编译..."
        fi
    fi
    
    echo "编译Java源文件..."
    find src/main/java -name "*.java" > /tmp/java_sources.txt
    
    # 检查是否有已下载的依赖
    if [ -d "target/deps" ]; then
        CLASSPATH=$(find target/deps -name "*.jar" | tr '\n' ':')
        javac -d target/classes -cp "$CLASSPATH" @/tmp/java_sources.txt 2>/dev/null || {
            echo "⚠️ 直接编译失败，请先安装Maven"
            exit 1
        }
    else
        echo "⚠️ 缺少依赖库"
        echo ""
        echo "=================================="
        echo "请先安装Maven:"
        echo "  macOS: brew install maven"
        echo "  Linux: sudo apt install maven"
        echo "  或者下载: https://maven.apache.org/download.cgi"
        echo "=================================="
        exit 1
    fi
fi

echo ""
echo "=================================="
echo "正在启动服务..."
echo "服务地址: http://localhost:8080"
echo "H2控制台: http://localhost:8080/h2-console"
echo "按 Ctrl+C 停止服务"
echo "=================================="
echo ""

# 使用Maven运行
if command -v mvn &> /dev/null; then
    mvn spring-boot:run -q
else
    java -cp "target/classes:target/deps/*" com.retry.budget.RetryBudgetApplication
fi
