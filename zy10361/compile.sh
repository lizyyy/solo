#!/bin/bash
# 纯 javac 编译脚本 - 不依赖 Maven/Gradle
# 使用 Java 8 模式编译，确保兼容性

set -e

cd "$(dirname "$0")"

echo "====================================="
echo "跨服务补偿指令 API - 编译源码"
echo "====================================="
echo ""

# 检查 Java 环境
if command -v javac &> /dev/null; then
    JAVAC_CMD="javac"
    JAVA_CMD="java"
elif [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/javac" ]; then
    JAVAC_CMD="$JAVA_HOME/bin/javac"
    JAVA_CMD="$JAVA_HOME/bin/java"
else
    echo "❌ 未找到 Java 编译器，请先安装 JDK 8 或更高版本"
    exit 1
fi

JAVA_VERSION=$($JAVA_CMD -version 2>&1 | head -n 1)
echo "✅ 检测到 Java: $JAVA_VERSION"
echo ""

# 检查 lib 目录是否存在
if [ ! -d "lib" ] || [ -z "$(ls lib/*.jar 2>/dev/null)" ]; then
    echo "⚠️  lib 目录为空或不存在，正在下载依赖..."
    if [ -f "download-deps.sh" ]; then
        bash download-deps.sh
    else
        echo "❌ 找不到 download-deps.sh"
        exit 1
    fi
fi

# 构建 classpath
echo "📚 构建 classpath..."
CLASSPATH=""
for jar in lib/*.jar; do
    CLASSPATH="$CLASSPATH:$jar"
done
CLASSPATH=${CLASSPATH#:}  # 去掉开头的冒号

# 强制清理旧的 class 文件
echo "🧹 强制清理旧编译文件..."
rm -rf target/classes
rm -rf target/test-classes
mkdir -p target/classes

# 清理 Lombok（确保代码可以用 javac 直接编译）
echo "🔧 移除 Lombok 注解（确保纯 Java 编译）..."
if [ -f "remove-lombok.sh" ]; then
    bash remove-lombok.sh > /dev/null 2>&1
fi

# 查找所有 Java 源文件
echo "🔍 查找 Java 源文件..."
JAVA_FILES=$(find src/main/java -name "*.java" | tr '\n' ' ')
FILE_COUNT=$(find src/main/java -name "*.java" | wc -l | tr -d ' ')
echo "   找到 $FILE_COUNT 个源文件"
echo ""

# 编译
echo "🔨 正在编译（Java 8 兼容模式）..."
echo ""

$JAVAC_CMD \
    -source 1.8 \
    -target 1.8 \
    -encoding UTF-8 \
    -cp "$CLASSPATH" \
    -d target/classes \
    $JAVA_FILES

if [ $? -eq 0 ]; then
    CLASS_COUNT=$(find target/classes -name "*.class" | wc -l | tr -d ' ')
    echo ""
    echo "✅ 编译成功！生成 $CLASS_COUNT 个 class 文件"
    echo ""
    
    # 验证 class 文件版本
    echo "🔍 验证 class 文件版本..."
    FIRST_CLASS=$(find target/classes -name "*.class" | head -n 1)
    if [ -n "$FIRST_CLASS" ]; then
        # 读取 class 文件的魔数和版本
        # Java 8 = 52, Java 11 = 55
        MAJOR_VERSION=$(od -An -j7 -N1 -tu1 "$FIRST_CLASS" | tr -d ' ')
        echo "   Main class 版本: $MAJOR_VERSION (Java 8 = 52)"
        if [ "$MAJOR_VERSION" = "52" ]; then
            echo "   ✅ 版本正确，Java 8 兼容"
        else
            echo "   ⚠️  版本不是 52，请检查 Java 编译器版本"
        fi
    fi
    echo ""
    echo "🚀 现在可以运行 ./run-standalone.sh 启动服务"
else
    echo ""
    echo "❌ 编译失败"
    exit 1
fi
