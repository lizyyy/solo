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

# 正确解析 Java 版本号（支持 1.8.x 和 9+ 格式）
JAVA_VERSION_FULL=$(java -version 2>&1 | head -n 1 | sed 's/.*version "\([^"]*\)".*/\1/')
echo "   Java 完整版本: $JAVA_VERSION_FULL"

# 提取主版本号：1.8.x -> 8, 9.x -> 9, 11.x -> 11, 等等
JAVA_MAJOR=$(echo "$JAVA_VERSION_FULL" | cut -d'.' -f1)
if [ "$JAVA_MAJOR" = "1" ]; then
    # Java 8 格式: 1.8.x
    JAVA_MAJOR=$(echo "$JAVA_VERSION_FULL" | cut -d'.' -f2)
fi
echo "   Java 主版本: $JAVA_MAJOR"

if [ "$JAVA_MAJOR" -lt 8 ]; then
    echo "❌ 错误: 需要 Java 8 或更高版本，当前版本: $JAVA_VERSION_FULL"
    exit 1
fi
echo "   ✓ Java 版本符合要求"

# 检查是否有 javac（JDK，不是 JRE）
HAS_JAVAC=0
if command -v javac &> /dev/null; then
    HAS_JAVAC=1
    echo "   ✓ JDK 编译器已就绪"
else
    echo "   ⚠️  JRE 环境（无 javac 编译器）"
fi

# 检查是否已有完整的可执行 JAR
echo ""
echo "📦 编译状态检测..."
JAR_FILE=""

# 优先找 Spring Boot executable JAR
if [ -f "target/data-access-approval-1.0.0.jar" ]; then
    JAR_FILE="target/data-access-approval-1.0.0.jar"
    echo "   ✓ 发现完整 JAR: $JAR_FILE"
elif ls target/*.jar 1> /dev/null 2>&1; then
    for jar in target/*.jar; do
        # 检查是否是 Spring Boot JAR（有 BOOT-INF 目录）
        if unzip -l "$jar" | grep -q "BOOT-INF" 2>/dev/null; then
            JAR_FILE="$jar"
            echo "   ✓ 发现 Spring Boot JAR: $JAR_FILE"
            break
        fi
    done
fi

if [ -z "$JAR_FILE" ]; then
    echo "   ✗ 未发现可执行 JAR 文件"
fi

# 编译策略：没有 JAR 时必须编译
NEED_COMPILE=0
if [ -z "$JAR_FILE" ]; then
    NEED_COMPILE=1
fi

# 执行编译
if [ $NEED_COMPILE -eq 1 ]; then
    if [ $HAS_JAVAC -eq 1 ]; then
        echo ""
        echo "🔨 开始编译项目..."
        chmod +x ./mvnw 2>/dev/null || true
        
        # 先清理再编译，确保生成完整 JAR
        ./mvnw clean package -DskipTests -q
        
        # 再次查找 JAR
        if [ -f "target/data-access-approval-1.0.0.jar" ]; then
            JAR_FILE="target/data-access-approval-1.0.0.jar"
        elif ls target/*.jar 1> /dev/null 2>&1; then
            for jar in target/*.jar; do
                if unzip -l "$jar" | grep -q "BOOT-INF" 2>/dev/null; then
                    JAR_FILE="$jar"
                    break
                fi
            done
        fi
        
        if [ -z "$JAR_FILE" ]; then
            echo ""
            echo "⚠️  未找到标准 JAR，尝试查找任何可用 JAR..."
            ANY_JAR=$(ls target/*.jar 2>/dev/null | head -n 1)
            if [ -n "$ANY_JAR" ]; then
                JAR_FILE="$ANY_JAR"
                echo "   ✓ 找到 JAR: $JAR_FILE"
            fi
        fi
        
        if [ -z "$JAR_FILE" ]; then
            echo "❌ 编译失败或未生成 JAR 文件"
            echo "   请尝试手动编译查看详细错误："
            echo "   ./mvnw clean package -DskipTests"
            exit 1
        fi
        echo "   ✓ 编译完成"
    else
        echo ""
        echo "❌ 无法编译（当前是 JRE 环境）且没有预编译的 JAR 文件"
        echo ""
        echo "📋 解决方案（二选一）："
        echo "   方案一：安装完整 JDK 后重新运行 【推荐】"
        echo "           下载地址: https://adoptium.net/"
        echo "           安装后执行: javac -version 验证"
        echo ""
        echo "   方案二：在有 JDK 的机器上预编译，复制 JAR 过来："
        echo "           1. 在有 JDK 的机器上执行: ./mvnw clean package -DskipTests"
        echo "           2. 复制 target/data-access-approval-1.0.0.jar 到本机 target/ 目录"
        echo "           3. 重新运行此脚本"
        exit 1
    fi
fi

# 启动应用
echo ""
echo "🚀 启动应用..."
echo "========================================"
echo "   JAR 文件: $JAR_FILE"
echo "   服务地址: http://localhost:8080"
echo "   API 测试: http://localhost:8080/api/applications/statuses"
echo "   H2控制台: http://localhost:8080/h2-console"
echo "   数据库: jdbc:h2:file:./data/approvaldb"
echo "========================================"
echo ""

java -jar "$JAR_FILE"
