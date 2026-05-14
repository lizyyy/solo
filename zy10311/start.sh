#!/bin/bash
# API 变更投票门禁系统启动脚本
# 支持 Java 8+，无需安装 Maven

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================================="
echo "  API 变更投票门禁系统 - 启动脚本"
echo "=============================================="
echo ""

# 检查 Java
if ! command -v java >/dev/null 2>&1; then
    echo "错误: 未找到 Java 命令"
    echo "请安装 Java 8 或更高版本"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1-2)
echo "检测到 Java 版本: $JAVA_VERSION"

# 检查是否有编译好的类文件
if [ ! -d "target/classes" ]; then
    echo "错误: 未找到编译后的类文件 target/classes"
    echo "请先运行: ./build.sh"
    exit 1
fi

# 检查依赖 jar
if [ ! -d "target/dependency" ]; then
    echo "错误: 未找到依赖库目录 target/dependency"
    echo "请先运行: ./build.sh"
    exit 1
fi

echo ""
echo "启动服务中..."
echo "服务端口: 8080"
echo "H2 控制台: http://localhost:8080/h2-console"
echo "JDBC URL: jdbc:h2:mem:votingdb"
echo "Username: sa"
echo "Password: (空)"
echo ""
echo "按 Ctrl+C 停止服务"
echo "=============================================="
echo ""

# 构建 classpath
CLASSPATH="target/classes"
for jar in target/dependency/*.jar; do
    CLASSPATH="$CLASSPATH:$jar"
done

# 启动应用
java -cp "$CLASSPATH" com.apigate.voting.VotingGateApplication
