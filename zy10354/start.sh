#!/bin/bash

cd "$(dirname "$0")"

echo "========================================"
echo "  接口迁移双写比对 API 启动脚本"
echo "========================================"
echo ""

# 修复 Java 版本解析逻辑，支持 1.8.x 格式
JAVA_VERSION_FULL=$(java -version 2>&1 | head -n 1 | grep -o 'version "[^"]*"' | cut -d'"' -f2)
echo "检测到 Java 完整版本: $JAVA_VERSION_FULL"

# 提取主版本号: 1.8.x -> 8, 11.x -> 11
if [[ "$JAVA_VERSION_FULL" == 1.8.* ]]; then
    JAVA_MAJOR_VERSION=8
else
    JAVA_MAJOR_VERSION=$(echo "$JAVA_VERSION_FULL" | cut -d'.' -f1)
fi

echo "Java 主版本: $JAVA_MAJOR_VERSION"

if [ "$JAVA_MAJOR_VERSION" -lt 8 ]; then
    echo ""
    echo "✗ 错误: 需要 Java 8 或更高版本"
    echo "  当前版本: $JAVA_VERSION_FULL"
    exit 1
fi

echo "✓ Java 版本检查通过"
echo ""

# 检查是否有预编译的 jar 包
JAR_FILE=$(ls target/dual-write-compare-api-*.jar 2>/dev/null | head -n 1)

if [ -z "$JAR_FILE" ] || [ ! -f "$JAR_FILE" ]; then
    echo "未找到预编译 jar，尝试编译..."
    
    # 优先使用 mvnw，其次使用系统 mvn
    if [ -f "./mvnw" ]; then
        echo "使用 Maven Wrapper 编译..."
        ./mvnw clean package -DskipTests -q
    elif command -v mvn &> /dev/null; then
        echo "使用系统 Maven 编译..."
        mvn clean package -DskipTests -q
    else
        echo ""
        echo "========================================"
        echo "  ✗ 无法编译项目"
        echo "  原因: 未找到 Maven Wrapper 或系统 mvn"
        echo ""
        echo "  请确保项目包含 mvnw 文件或安装 Maven"
        echo "========================================"
        exit 1
    fi
    
    if [ $? -ne 0 ]; then
        echo "✗ 编译失败，请检查错误信息"
        exit 1
    fi
    
    # 再次查找 jar
    JAR_FILE=$(ls target/dual-write-compare-api-*.jar 2>/dev/null | head -n 1)
fi

if [ -z "$JAR_FILE" ] || [ ! -f "$JAR_FILE" ]; then
    echo ""
    echo "========================================"
    echo "  ✗ 未找到可执行 jar 文件"
    echo "========================================"
    exit 1
fi

echo "✓ 使用 jar 文件: $(basename "$JAR_FILE")"
echo ""
echo "启动服务中..."
echo "服务地址: http://localhost:8080"
echo "健康检查: http://localhost:8080/actuator/health"
echo "按 Ctrl+C 停止服务"
echo ""
echo "========================================"

java -jar "$JAR_FILE"
