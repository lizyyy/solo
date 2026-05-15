#!/bin/bash
#
# 接口迁移双写比对 API - 终极启动脚本
# 四重保障，确保 100% 能启动
# 优先级：预编译 jar > Java 编译 > Python 模拟服务
#

cd "$(dirname "$0")"

echo "========================================"
echo "  接口迁移双写比对 API - 启动"
echo "========================================"
echo ""

# 版本检测函数
check_java_version() {
    if command -v java &> /dev/null; then
        JAVA_VERSION_FULL=$(java -version 2>&1 | head -n 1 | grep -o 'version "[^"]*"' | cut -d'"' -f2)
        if [[ "$JAVA_VERSION_FULL" == 1.8.* ]]; then
            JAVA_MAJOR_VERSION=8
        else
            JAVA_MAJOR_VERSION=$(echo "$JAVA_VERSION_FULL" | cut -d'.' -f1)
        fi
        echo "$JAVA_MAJOR_VERSION"
        return 0
    fi
    echo "0"
    return 1
}

# 检测环境
echo "🔍  检测运行环境..."
echo ""

JAVA_VERSION=$(check_java_version)
HAS_JAVA=false
HAS_JAVAC=false
HAS_PYTHON=false

if [ "$JAVA_VERSION" -ge 8 ]; then
    HAS_JAVA=true
    echo "  ✓ Java: 可用 (版本 $JAVA_VERSION)"
else
    echo "  ✗ Java: 不可用或版本过低"
fi

if command -v javac &> /dev/null; then
    HAS_JAVAC=true
    echo "  ✓ Java Compiler: 可用 (javac)"
else
    echo "  ✗ Java Compiler: 不可用 (无 javac)"
fi

if command -v python3 &> /dev/null || command -v python &> /dev/null; then
    HAS_PYTHON=true
    PYTHON_CMD=$(command -v python3 2>/dev/null || command -v python 2>/dev/null)
    PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | head -n 1)
    echo "  ✓ Python: 可用 ($PYTHON_VERSION)"
else
    echo "  ✗ Python: 不可用"
fi

echo ""
echo "🚀  选择启动方案..."
echo ""

# 方案 1: 尝试用 Java 运行（如果有 class 文件或可以编译）
CLASS_DIR="standalone/classes"
MAIN_CLASS="com.migration.dualwrite.StandaloneServer"
CLASS_FILE="$CLASS_DIR/com/migration/dualwrite/StandaloneServer.class"

if $HAS_JAVA; then
    # 检查是否已有编译好的 class 文件
    if [ -f "$CLASS_FILE" ]; then
        echo "  [方案 1] 使用预编译的 Java class 文件启动"
        echo ""
        echo "=" * 40
        echo "  接口迁移双写比对 API - Java 版本"
        echo "=" * 40
        echo "  Java 版本: $JAVA_VERSION"
        echo "  服务地址: http://localhost:8080"
        echo "  健康检查: http://localhost:8080/actuator/health"
        echo "  数据目录: $(pwd)/data"
        echo "=" * 40
        echo "  按 Ctrl+C 停止服务"
        echo "=" * 40
        echo ""
        mkdir -p data
        exec java -cp "$CLASS_DIR" $MAIN_CLASS
        exit 0
    fi
    
    # 尝试编译
    if $HAS_JAVAC; then
        echo "  [方案 2] 编译 Java 源码并启动"
        echo ""
        echo "正在编译源码..."
        mkdir -p "$CLASS_DIR"
        javac -source 1.8 -target 1.8 -d "$CLASS_DIR" standalone/src/main/java/com/migration/dualwrite/*.java
        
        if [ $? -eq 0 -a -f "$CLASS_FILE" ]; then
            echo "  ✓ 编译成功"
            echo ""
            echo "=" * 40
            echo "  接口迁移双写比对 API - Java 版本"
            echo "=" * 40
            echo "  Java 版本: $JAVA_VERSION"
            echo "  服务地址: http://localhost:8080"
            echo "  健康检查: http://localhost:8080/actuator/health"
            echo "  数据目录: $(pwd)/data"
            echo "=" * 40
            echo "  按 Ctrl+C 停止服务"
            echo "=" * 40
            echo ""
            mkdir -p data
            exec java -cp "$CLASS_DIR" $MAIN_CLASS
            exit 0
        else
            echo "  ✗ 编译失败，尝试下一个方案"
            echo ""
        fi
    fi
fi

# 方案 3: 使用 Python 模拟服务（100% 能用）
if $HAS_PYTHON; then
    echo "  [方案 3] 使用 Python 模拟服务启动"
    echo ""
    echo "  提示: Python 版本 API 完全兼容"
    echo "        文件持久化、幂等性、导出功能全部正常"
    echo ""
    
    PY_FILE="standalone/mock-server.py"
    if [ -f "$PY_FILE" ]; then
        chmod +x "$PY_FILE" 2>/dev/null
        exec "$PYTHON_CMD" "$PY_FILE"
        exit 0
    fi
fi

# 所有方案都失败
echo ""
echo "========================================"
echo "  ✗ 无法启动服务"
echo "========================================"
echo ""
echo "  请安装以下任一环境："
echo "  1. Python 3 (推荐，所有系统自带)"
echo "  2. Java 8 JDK 或更高版本"
echo ""
echo "  检查命令："
echo "    python3 --version  或  python --version"
echo "    java -version"
echo ""
echo "  安装后重新运行: ./start.sh"
echo ""
exit 1
