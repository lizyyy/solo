#!/bin/bash

set -e  # 遇到错误立即退出

echo "====================================="
echo "  敏感操作双人确认API - 启动脚本"
echo "====================================="
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "📋 启动方式（按优先级尝试）："
echo "   1. 预编译JAR包（最快，无需任何依赖）"
echo "   2. Maven Wrapper编译（需要网络下载依赖）"
echo "   3. 纯Java独立服务器（只需JDK，无需Maven）"
echo "   4. Bash简化版（无需Java，只用nc命令）"
echo ""

# 方式1: 检查是否有预编译的JAR包
if [ -f "target/dual-confirmation-api-1.0.0.jar" ]; then
    echo "✅ 找到预编译JAR包"
    echo "🚀 启动Spring Boot服务..."
    echo ""
    java -jar target/dual-confirmation-api-1.0.0.jar
    exit 0
fi

echo "⚠️  未找到预编译JAR包，尝试下一种方式..."
echo ""

# 方式2: 尝试使用Maven Wrapper编译
if [ -f "./mvnw" ] && [ -f ".mvn/wrapper/maven-wrapper.jar" ] && [ -f "pom.xml" ]; then
    echo "🔧 方式2: 使用Maven Wrapper编译..."
    echo "   首次运行需要下载Maven和Spring Boot依赖（约100MB）"
    echo "   如果网络不通，会自动降级到其他方式"
    echo ""
    
    chmod +x ./mvnw
    
    # 设置超时，5分钟没完成就降级
    if command -v timeout &> /dev/null; then
        if timeout 300 ./mvnw clean package -DskipTests -q -Dmaven.test.skip=true 2>/dev/null; then
            echo ""
            echo "✅ Maven编译成功！"
            echo "🚀 启动Spring Boot服务..."
            echo ""
            java -jar target/dual-confirmation-api-1.0.0.jar
            exit 0
        else
            echo "⚠️  Maven编译超时或失败，降级到下一种方式..."
            echo ""
        fi
    else
        # 没有timeout命令，直接尝试
        if ./mvnw clean package -DskipTests -q -Dmaven.test.skip=true 2>/dev/null; then
            echo ""
            echo "✅ Maven编译成功！"
            echo "🚀 启动Spring Boot服务..."
            echo ""
            java -jar target/dual-confirmation-api-1.0.0.jar
            exit 0
        else
            echo "⚠️  Maven编译失败，降级到下一种方式..."
            echo ""
        fi
    fi
fi

# 方式3: 尝试纯Java独立服务器
if command -v javac &> /dev/null && command -v java &> /dev/null; then
    echo "🔧 方式3: 编译并启动纯Java独立服务器..."
    echo "   无需Maven，无需Spring Boot，纯JDK即可"
    echo ""
    
    if [ -f "./standalone-server.sh" ]; then
        chmod +x ./standalone-server.sh
        ./standalone-server.sh
        exit 0
    fi
fi

echo "⚠️  JDK不可用，降级到最后一种方式..."
echo ""

# 方式4: Bash简化版
if command -v nc &> /dev/null; then
    echo "🔧 方式4: 启动Bash简化版HTTP服务..."
    echo "   无需Java，无需编译，纯bash实现"
    echo ""
    
    if [ -f "./start-simple-server.sh" ]; then
        chmod +x ./start-simple-server.sh
        ./start-simple-server.sh
        exit 0
    fi
fi

# 所有方式都失败
echo "====================================="
echo "❌ 所有启动方式都失败！"
echo "====================================="
echo ""
echo "环境检查结果："
echo "  Java: $(command -v java &> /dev/null && echo "✅ 已安装" || echo "❌ 未安装")"
echo "  Javac: $(command -v javac &> /dev/null && echo "✅ 已安装" || echo "❌ 未安装")"
echo "  Maven Wrapper: $([ -f "./mvnw" ] && [ -f ".mvn/wrapper/maven-wrapper.jar" ] && echo "✅ 完整" || echo "❌ 不完整")"
echo "  nc命令: $(command -v nc &> /dev/null && echo "✅ 已安装" || echo "❌ 未安装")"
echo ""
echo "建议："
echo "  1. 安装JDK 8或更高版本：推荐使用OpenJDK"
echo "  2. 或使用 ./demo.sh 体验核心业务逻辑（无需网络服务）"
echo ""
