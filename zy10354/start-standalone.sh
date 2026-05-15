#!/bin/bash
#
# 接口迁移双写比对 API - 零依赖独立版本
# 只需要 Java 8+，无需 Maven、无需任何外部依赖
#

cd "$(dirname "$0")"

echo "========================================"
echo "  接口迁移双写比对 API - 独立版本"
echo "========================================"
echo ""

# 检查 Java
if ! command -v java &> /dev/null; then
    echo "✗ 错误: 未找到 Java 运行环境"
    echo "  请安装 Java 8 或更高版本"
    exit 1
fi

JAVA_VERSION_FULL=$(java -version 2>&1 | head -n 1 | grep -o 'version "[^"]*"' | cut -d'"' -f2)
if [[ "$JAVA_VERSION_FULL" == 1.8.* ]]; then
    JAVA_MAJOR_VERSION=8
else
    JAVA_MAJOR_VERSION=$(echo "$JAVA_VERSION_FULL" | cut -d'.' -f1)
fi

echo "✓ Java 版本: $JAVA_VERSION_FULL (主版本: $JAVA_MAJOR_VERSION)"
echo ""

# 检查 class 文件是否存在，不存在则编译
CLASS_DIR="standalone/classes"
MAIN_CLASS="com.migration.dualwrite.StandaloneServer"
CLASS_FILE="$CLASS_DIR/com/migration/dualwrite/StandaloneServer.class"

# 使用 -f 检查文件（不是 -d 目录）
if [ ! -f "$CLASS_FILE" ]; then
    echo "未找到编译后的 class 文件，尝试编译..."
    echo ""
    
    if command -v javac &> /dev/null; then
        mkdir -p "$CLASS_DIR"
        echo "正在编译源码..."
        javac -source 1.8 -target 1.8 -d "$CLASS_DIR" standalone/src/main/java/com/migration/dualwrite/*.java
        
        if [ $? -eq 0 ]; then
            echo "✓ 编译成功"
        else
            echo "✗ 编译失败"
            exit 1
        fi
    else
        echo ""
        echo "========================================"
        echo "  ✗ 无法编译源码"
        echo "  原因: 未找到 javac 编译器"
        echo ""
        echo "  请安装 JDK (Java Development Kit)"
        echo "========================================"
        exit 1
    fi
    echo ""
fi

echo "✓ Class 文件就绪"
echo "数据目录: ./data"
echo "服务地址: http://localhost:8080"
echo "健康检查: http://localhost:8080/actuator/health"
echo ""
echo "启动服务中..."
echo "========================================"
echo ""

# 启动服务
java -cp "$CLASS_DIR" $MAIN_CLASS
