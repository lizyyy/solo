#!/bin/bash

set -e

echo "====================================="
echo "  敏感操作双人确认API - 启动脚本"
echo "====================================="
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# 检查Java版本
echo "🔍 检查Java环境..."
if ! command -v java &> /dev/null; then
    echo "❌ 错误: 未找到Java命令，请先安装JDK 8或更高版本"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1)
echo "✅ $JAVA_VERSION"
echo ""

# 方式1: 检查是否有预编译的JAR包
if [ -f "target/dual-confirmation-api-1.0.0.jar" ]; then
    echo "📦 找到预编译的JAR包，直接启动..."
    echo ""
    java -jar target/dual-confirmation-api-1.0.0.jar
    exit 0
fi

# 方式2: 尝试使用Maven Wrapper编译
echo "🔧 尝试使用Maven Wrapper编译项目..."
echo ""

if [ -f "./mvnw" ] && [ -f ".mvn/wrapper/maven-wrapper.jar" ]; then
    chmod +x ./mvnw
    echo "📥 编译中（首次运行需要下载依赖，可能需要几分钟）..."
    echo "   正在下载Maven和项目依赖..."
    echo ""
    
    if MAVEN_PROJECTBASEDIR="$PROJECT_DIR" ./mvnw clean package -DskipTests -q; then
        echo ""
        echo "✅ 编译成功！启动应用..."
        echo ""
        java -jar target/dual-confirmation-api-1.0.0.jar
        exit 0
    else
        echo ""
        echo "⚠️  Maven编译失败，尝试备用启动方案..."
        echo ""
    fi
else
    echo "⚠️  Maven Wrapper不完整，尝试备用启动方案..."
    echo ""
fi

# 方式3: 备用方案 - 显示帮助信息
echo "====================================="
echo "  ⚠️  需要手动准备依赖"
echo "====================================="
echo ""
echo "由于网络或环境限制，自动编译失败。"
echo ""
echo "请选择以下方案之一："
echo ""
echo "方案1: 配置Maven镜像加速（推荐）"
echo "  编辑 ~/.m2/settings.xml 添加国内镜像"
echo ""
echo "方案2: 手动下载依赖并编译"
echo "  cd $PROJECT_DIR"
echo "  ./mvnw clean package -DskipTests"
echo ""
echo "方案3: 查看项目说明文档"
echo "  cat README.md"
echo ""
echo "====================================="
echo ""
echo "提示：首次编译需要下载约100MB依赖，请确保网络连接正常"
echo ""
