#!/bin/bash
# ============================================================================
# 批处理优先级队列 API - 完整构建和启动脚本
# ============================================================================
# 功能：
#   1. 自动检测 JDK 环境
#   2. 下载所有依赖到本地
#   3. 编译源代码
#   4. 打包为可执行 JAR
#   5. 启动服务
# ============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAVEN_VERSION="3.8.8"
MAVEN_DIR="$PROJECT_DIR/.maven"
MAVEN_HOME="$MAVEN_DIR/apache-maven-$MAVEN_VERSION"
MAVEN_BIN="$MAVEN_HOME/bin/mvn"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║           批处理优先级队列 API - 构建启动脚本                  ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# 步骤 1: 检测 Java 环境
# ============================================================================
echo "[1/6] 检测 Java 环境..."

# 尝试自动设置 JAVA_HOME（macOS）
if [ -z "$JAVA_HOME" ] && [ -x /usr/libexec/java_home ]; then
    export JAVA_HOME="$(/usr/libexec/java_home 2>/dev/null || true)"
fi

if [ -z "$JAVA_HOME" ]; then
    echo "  ⚠️  JAVA_HOME 未自动检测到，请手动设置:"
    echo "     export JAVA_HOME=/path/to/jdk"
    echo ""
    echo "  下载 JDK 地址:"
    echo "  - OpenJDK 8: https://adoptium.net/temurin/releases/?version=8"
    echo "  - Oracle JDK: https://www.oracle.com/java/technologies/downloads/"
    exit 1
fi

echo "  ✅ JAVA_HOME: $JAVA_HOME"
"$JAVA_HOME/bin/java" -version 2>&1 | head -1
echo ""

# ============================================================================
# 步骤 2: 检查 Maven
# ============================================================================
echo "[2/6] 检查 Maven..."

if [ ! -d "$MAVEN_HOME" ]; then
    echo "  📦 正在下载 Maven $MAVEN_VERSION..."
    mkdir -p "$MAVEN_DIR"
    cd "$MAVEN_DIR"
    
    if command -v curl > /dev/null 2>&1; then
        curl -L -o maven.zip \
            "https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/$MAVEN_VERSION/apache-maven-$MAVEN_VERSION-bin.zip"
    elif command -v wget > /dev/null 2>&1; then
        wget -O maven.zip \
            "https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/$MAVEN_VERSION/apache-maven-$MAVEN_VERSION-bin.zip"
    else
        echo "  ❌ 错误: 未找到 curl 或 wget"
        exit 1
    fi
    
    unzip -q maven.zip
    rm -f maven.zip
    cd "$PROJECT_DIR"
    echo "  ✅ Maven 下载完成"
else
    echo "  ✅ Maven 已存在"
fi
echo ""

# ============================================================================
# 步骤 3: 清理旧的构建产物
# ============================================================================
echo "[3/6] 清理旧构建..."
rm -rf "$PROJECT_DIR/target"
echo "  ✅ 清理完成"
echo ""

# ============================================================================
# 步骤 4: 编译项目
# ============================================================================
echo "[4/6] 编译项目..."
cd "$PROJECT_DIR"
"$MAVEN_BIN" compile -q
echo "  ✅ 编译完成"
echo ""

# ============================================================================
# 步骤 5: 打包为可执行 JAR
# ============================================================================
echo "[5/6] 打包为可执行 JAR..."
"$MAVEN_BIN" package -DskipTests -q
echo "  ✅ 打包完成"

JAR_FILE="$PROJECT_DIR/target/priority-queue-api-1.0.0.jar"
if [ -f "$JAR_FILE" ]; then
    echo "  📦 JAR 文件: $JAR_FILE"
    FILE_SIZE=$(ls -lh "$JAR_FILE" | awk '{print $5}')
    echo "  文件大小: $FILE_SIZE"
else
    echo "  ❌ 错误: JAR 文件未生成"
    exit 1
fi
echo ""

# ============================================================================
# 步骤 6: 启动服务
# ============================================================================
echo "[6/6] 启动服务..."
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                      服务启动信息                              ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║  API 地址:   http://localhost:8080/api/tasks                  ║"
echo "║  H2 控制台:  http://localhost:8080/h2-console                 ║"
echo "║  JDBC URL:   jdbc:h2:file:./data/batchqueue                   ║"
echo "║  用户名:     sa                                                ║"
echo "║  密码:       (空)                                              ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""
echo "════════════════════════════════════════════════════════════════"

exec "$JAVA_HOME/bin/java" -jar "$JAR_FILE"
