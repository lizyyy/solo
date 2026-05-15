#!/bin/bash

# 快速启动脚本 - 确保在任何 Java 8 环境下都能运行
# 使用预编译的方式或直接启动

cd "$(dirname "$0")"

echo "========================================"
echo "  接口迁移双写比对 API - 快速启动"
echo "========================================"
echo ""

# 1. Java 版本检查
JAVA_VERSION_FULL=$(java -version 2>&1 | head -n 1 | grep -o 'version "[^"]*"' | cut -d'"' -f2)
if [[ "$JAVA_VERSION_FULL" == 1.8.* ]]; then
    JAVA_MAJOR_VERSION=8
else
    JAVA_MAJOR_VERSION=$(echo "$JAVA_VERSION_FULL" | cut -d'.' -f1)
fi

echo "✓ Java 版本: $JAVA_VERSION_FULL (主版本: $JAVA_MAJOR_VERSION)"

if [ "$JAVA_MAJOR_VERSION" -lt 8 ]; then
    echo ""
    echo "✗ 错误: 需要 Java 8 或更高版本"
    exit 1
fi
echo ""

# 2. 检查是否有可执行 jar
JAR_FILE=$(ls target/dual-write-compare-api-*.jar 2>/dev/null | head -n 1)

if [ -n "$JAR_FILE" ] && [ -f "$JAR_FILE" ]; then
    echo "✓ 找到预编译 jar: $(basename "$JAR_FILE")"
    echo ""
    echo "正在启动服务..."
    echo "服务地址: http://localhost:8080"
    echo "健康检查: http://localhost:8080/actuator/health"
    echo ""
    exec java -jar "$JAR_FILE"
fi

# 3. 如果没有 jar，尝试使用 Maven Wrapper 编译
echo "未找到预编译 jar，尝试编译..."
echo ""

if [ -f "./mvnw" ]; then
    echo "使用 Maven Wrapper 编译..."
    echo "这需要网络连接下载依赖..."
    echo ""
    
    if ./mvnw clean package -DskipTests -q; then
        JAR_FILE=$(ls target/dual-write-compare-api-*.jar 2>/dev/null | head -n 1)
        if [ -n "$JAR_FILE" ] && [ -f "$JAR_FILE" ]; then
            echo ""
            echo "✓ 编译成功!"
            echo "正在启动服务..."
            echo "服务地址: http://localhost:8080"
            exec java -jar "$JAR_FILE"
        fi
    fi
fi

# 4. 如果以上都失败，给出友好提示
echo ""
echo "========================================"
echo "  无法自动启动"
echo "========================================"
echo ""
echo "请按以下步骤操作:"
echo ""
echo "方案 1: 使用 Maven 编译（推荐）"
echo "  mvn clean package -DskipTests"
echo "  java -jar target/dual-write-compare-api-*.jar"
echo ""
echo "方案 2: 验证代码兼容性"
echo "  所有代码已使用 Java 8 兼容语法"
echo "  - 已移除 List.of / Map.of 等 Java 9+ API"
echo "  - 已替换为 Java 8 标准写法"
echo ""
echo "方案 3: 查看测试脚本"
echo "  ./run-test.sh  (服务启动后执行)"
echo ""
echo "========================================"
