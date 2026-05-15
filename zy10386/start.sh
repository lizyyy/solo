#!/bin/bash

echo "========================================"
echo "跨境数据访问审批 API - 启动脚本"
echo "========================================"

# 创建数据目录
mkdir -p data

# 检查 Java 版本
echo ""
echo "🔍 环境检查..."
if ! command -v java &> /dev/null; then
    echo "❌ 错误: 未找到 Java"
    echo "   请安装 Java 8 或更高版本的 JDK"
    echo "   下载地址: https://adoptium.net/"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F'"' '{print $2}' | cut -d'.' -f1)
echo "   Java 版本: $JAVA_VERSION"

if [ "$JAVA_VERSION" -lt 8 ]; then
    echo "❌ 错误: 需要 Java 8 或更高版本，当前版本: $JAVA_VERSION"
    exit 1
fi

# 检查是否有 javac（JDK，不是 JRE）
HAS_JAVAC=0
if command -v javac &> /dev/null; then
    HAS_JAVAC=1
    echo "   ✓ JDK 编译器已就绪"
else
    echo "   ⚠️  JRE 环境（无 javac 编译器）"
fi

# 检查是否已有 JAR
JAR_FILE=""
if [ -f "target/data-access-approval-1.0.0.jar" ]; then
    JAR_FILE="target/data-access-approval-1.0.0.jar"
elif [ -f "target/data-access-approval.jar" ]; then
    JAR_FILE="target/data-access-approval.jar"
else
    FOUND_JAR=$(ls target/*.jar 2>/dev/null | head -n 1)
    if [ -n "$FOUND_JAR" ]; then
        JAR_FILE="$FOUND_JAR"
    fi
fi

# 检查是否有编译好的 classes
HAS_CLASSES=0
if [ -d "target/classes" ] && [ -f "target/classes/com/crossborder/approval/CrossBorderApprovalApplication.class" ]; then
    HAS_CLASSES=1
fi

# 决定启动策略
echo ""
echo "📦 编译状态检测..."
if [ -n "$JAR_FILE" ]; then
    echo "   ✓ 发现 JAR 文件: $JAR_FILE"
elif [ $HAS_CLASSES -eq 1 ]; then
    echo "   ✓ 发现已编译的 class 文件"
else
    echo "   ✗ 未发现编译产物"
fi

# 编译策略
if [ -z "$JAR_FILE" ] && [ $HAS_CLASSES -eq 0 ]; then
    if [ $HAS_JAVAC -eq 1 ]; then
        echo ""
        echo "🔨 开始编译项目..."
        chmod +x ./mvnw 2>/dev/null || true
        ./mvnw clean package -DskipTests -q
        
        # 再次查找 JAR
        JAR_FILE=$(ls target/*.jar 2>/dev/null | head -n 1)
        if [ -z "$JAR_FILE" ]; then
            echo "❌ 编译失败或未生成 JAR 文件"
            exit 1
        fi
        echo "   ✓ 编译完成"
    else
        echo ""
        echo "❌ 无法编译（当前是 JRE 环境）且没有预编译文件"
        echo ""
        echo "📋 解决方案："
        echo "   方案一：安装完整 JDK 后重新运行"
        echo "           下载地址: https://adoptium.net/"
        echo ""
        echo "   方案二：在有 JDK 的机器上先编译，再复制过来："
        echo "           ./mvnw clean package -DskipTests"
        echo "           复制 target/*.jar 到本机 target/ 目录"
        exit 1
    fi
fi

# 查找 Spring Boot 主类和 classpath
if [ -z "$JAR_FILE" ] && [ $HAS_CLASSES -eq 1 ]; then
    echo ""
    echo "⚡ 直接从 class 文件启动..."
    # 查找依赖 jar
    DEPS=""
    if [ -d "~/.m2/repository" ]; then
        # 尝试从 Maven 本地仓库找依赖
        echo "   正在查找依赖..."
    fi
    # 如果没有 JAR 但有 classes，提示需要完整依赖
    echo "⚠️  当前只有 classes 文件但缺少依赖库"
    echo "   建议安装 JDK 后完整编译，或从其他机器复制完整 JAR"
    exit 1
fi

echo ""
echo "🚀 启动应用..."
echo "========================================"
echo "   服务地址: http://localhost:8080"
echo "   API 测试: http://localhost:8080/api/applications/statuses"
echo "   H2控制台: http://localhost:8080/h2-console"
echo "   数据库: jdbc:h2:file:./data/approvaldb"
echo "========================================"
echo ""

java -jar "$JAR_FILE"
