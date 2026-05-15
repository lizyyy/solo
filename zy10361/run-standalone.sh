#!/bin/bash
# 完全独立的启动脚本 - 不依赖 Maven/Gradle
# 直接用 java 命令运行

set -e

cd "$(dirname "$0")"

echo "====================================="
echo "跨服务补偿指令 API - 独立启动"
echo "====================================="
echo ""

# 检查 Java 环境
if command -v java &> /dev/null; then
    JAVA_CMD="java"
elif [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/java" ]; then
    JAVA_CMD="$JAVA_HOME/bin/java"
else
    echo "❌ 未找到 Java 运行环境，请先安装 JRE 8 或更高版本"
    exit 1
fi

JAVA_VERSION=$($JAVA_CMD -version 2>&1 | head -n 1)
echo "✅ 检测到 Java: $JAVA_VERSION"
echo ""

# 检查并编译
if [ ! -d "target/classes" ] || [ -z "$(ls target/classes/*.class 2>/dev/null)" ]; then
    echo "⚠️  未找到编译后的 class 文件，正在编译..."
    if [ -f "compile.sh" ]; then
        bash compile.sh
    else
        echo "❌ 找不到 compile.sh"
        exit 1
    fi
fi

# 检查 lib 目录
if [ ! -d "lib" ] || [ -z "$(ls lib/*.jar 2>/dev/null)" ]; then
    echo "⚠️  lib 目录为空，正在下载依赖..."
    if [ -f "download-deps.sh" ]; then
        bash download-deps.sh
    else
        echo "❌ 找不到 download-deps.sh"
        exit 1
    fi
fi

# 构建 classpath (lib 目录所有 jar + target/classes)
echo "📚 构建运行 classpath..."
CLASSPATH="target/classes"
for jar in lib/*.jar; do
    CLASSPATH="$CLASSPATH:$jar"
done

# 检查主类
if [ ! -f "target/classes/com/compensation/CompensationApplication.class" ]; then
    echo "❌ 未找到主类: com.compensation.CompensationApplication"
    echo "   请重新运行 ./compile.sh"
    exit 1
fi

echo ""
echo "🚀 正在启动服务..."
echo "   API 地址: http://localhost:8080/api/v1/compensation"
echo "   H2 控制台: http://localhost:8080/h2-console"
echo ""
echo "   按 Ctrl + C 停止服务"
echo "====================================="
echo ""

# 启动 Spring Boot 应用
$JAVA_CMD \
    -Xms256m \
    -Xmx512m \
    -cp "$CLASSPATH" \
    com.compensation.CompensationApplication
