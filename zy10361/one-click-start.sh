#!/bin/bash
# ⭐ 一键启动脚本 - 什么都不用管，直接运行我！
# 自动处理：依赖下载 → 移除Lombok → 清理旧class → Java8编译 → 启动服务

set -e

cd "$(dirname "$0")"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         跨服务补偿指令 API - 一键启动                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# 检查 Java 环境
echo "🔍 第一步：检查 Java 环境..."
if command -v java &> /dev/null; then
    JAVA_CMD="java"
    JAVAC_CMD="javac"
elif [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/java" ]; then
    JAVA_CMD="$JAVA_HOME/bin/java"
    JAVAC_CMD="$JAVA_HOME/bin/javac"
else
    echo "❌ 未找到 Java 环境！"
    echo "   请先安装 JDK 8 或更高版本"
    exit 1
fi

JAVA_VERSION=$($JAVA_CMD -version 2>&1 | head -n 1)
echo "   ✅ $JAVA_VERSION"
echo ""

# 强制清理旧的 class 文件（关键！解决 version 55 问题）
echo "🧹 第二步：强制清理旧编译文件..."
rm -rf target/classes
rm -rf target/test-classes
rm -rf target/dependency
mkdir -p target/classes
echo "   ✅ 已清理旧 class 文件"
echo ""

# 移除 Lombok 注解（确保能用 javac 直接编译）
echo "🔧 第三步：移除 Lombok 注解（纯 Java 兼容处理）..."
if [ -f "remove-lombok.sh" ]; then
    bash remove-lombok.sh
fi
echo "   ✅ 已移除 Lombok 依赖"
echo ""

# 下载依赖
echo "📦 第四步：检查并下载依赖..."
if [ ! -d "lib" ] || [ -z "$(ls lib/*.jar 2>/dev/null)" ]; then
    if [ -f "download-deps.sh" ]; then
        bash download-deps.sh
    else
        echo "❌ 找不到 download-deps.sh"
        exit 1
    fi
else
    echo "   ✅ 依赖已就绪 ($(ls lib/*.jar 2>/dev/null | wc -l | tr -d ' ') 个 jar 文件)"
fi
echo ""

# 编译（强制 Java 8 模式）
echo "🔨 第五步：编译源码（Java 8 兼容模式）..."

CLASSPATH=""
for jar in lib/*.jar; do
    CLASSPATH="$CLASSPATH:$jar"
done
CLASSPATH=${CLASSPATH#:}

JAVA_FILES=$(find src/main/java -name "*.java" | tr '\n' ' ')
FILE_COUNT=$(find src/main/java -name "*.java" | wc -l | tr -d ' ')

echo "   找到 $FILE_COUNT 个源文件"
echo ""

$JAVAC_CMD \
    -source 1.8 \
    -target 1.8 \
    -encoding UTF-8 \
    -cp "$CLASSPATH" \
    -d target/classes \
    $JAVA_FILES 2>&1

CLASS_COUNT=$(find target/classes -name "*.class" | wc -l | tr -d ' ')
echo ""
echo "   ✅ 编译成功！生成 $CLASS_COUNT 个 class 文件"
echo ""

# 验证 class 版本
echo "🔍 第六步：验证 class 文件版本..."
FIRST_CLASS=$(find target/classes -name "*.class" | head -n 1)
if [ -n "$FIRST_CLASS" ]; then
    # 读取 class 文件版本（字节 7-8）
    # Java 8 = 52 (0x34), Java 11 = 55 (0x37)
    if command -v od &> /dev/null; then
        MAJOR_VERSION=$(od -An -j7 -N1 -tu1 "$FIRST_CLASS" | tr -d ' ')
        echo "   Class 主版本号: $MAJOR_VERSION"
        if [ "$MAJOR_VERSION" = "52" ]; then
            echo "   ✅ Java 8 兼容 (版本 52)"
        else
            echo "   ⚠️  版本: $MAJOR_VERSION (Java 8 = 52)"
        fi
    else
        echo "   ⚠️  无法验证版本（缺少 od 命令），跳过"
    fi
fi
echo ""

# 构建运行 classpath
echo "🚀 第七步：启动服务..."
RUN_CLASSPATH="target/classes"
for jar in lib/*.jar; do
    RUN_CLASSPATH="$RUN_CLASSPATH:$jar"
done

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  API 地址: http://localhost:8080/api/v1/compensation       ║"
echo "║  H2 Console: http://localhost:8080/h2-console                  ║"
echo "║                                                              ║"
echo "║  测试验证：打开另一个终端运行: ./test-full.sh                ║"
echo "║  停止服务：按 Ctrl + C                                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# 启动！
$JAVA_CMD \
    -Xms256m \
    -Xmx512m \
    -cp "$RUN_CLASSPATH" \
    com.compensation.CompensationApplication
