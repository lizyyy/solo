#!/bin/bash
set -e

echo "========================================"
echo "  文件病毒扫描编排 API - 启动脚本"
echo "========================================"
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# 1. 检测 Java
echo "[1/5] 检测 Java 环境..."
if ! command -v java > /dev/null 2>&1; then
    echo "  ❌ 错误: 未找到 java 命令，请先安装 Java 8 或更高版本"
    exit 1
fi

JAVA_VERSION="$(java -version 2>&1 | head -n 1 | grep -Eo '"[0-9._]+"' | tr -d '"' | cut -d'.' -f1-2)"
echo "  ✅ Java 版本: $JAVA_VERSION"

# 2. 检查 Maven Wrapper JAR
echo ""
echo "[2/5] 检查 Maven Wrapper..."
if [ ! -f "$PROJECT_DIR/.mvn/wrapper/maven-wrapper.jar" ]; then
    echo "  Maven Wrapper JAR 不存在，准备下载..."
    
    # 尝试从 Maven Central 下载
    DOWNLOAD_URL="https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.1.0/maven-wrapper-3.1.0.jar"
    mkdir -p "$PROJECT_DIR/.mvn/wrapper"
    
    if command -v curl > /dev/null 2>&1; then
        echo "  使用 curl 下载..."
        curl -s -f -L -o "$PROJECT_DIR/.mvn/wrapper/maven-wrapper.jar" "$DOWNLOAD_URL"
    elif command -v wget > /dev/null 2>&1; then
        echo "  使用 wget 下载..."
        wget -q -O "$PROJECT_DIR/.mvn/wrapper/maven-wrapper.jar" "$DOWNLOAD_URL"
    else
        echo "  ❌ 错误: 未找到 curl 或 wget，请手动下载"
        echo "     $DOWNLOAD_URL"
        echo "     并放置到: $PROJECT_DIR/.mvn/wrapper/maven-wrapper.jar"
        exit 1
    fi
    echo "  ✅ Maven Wrapper 下载完成"
else
    echo "  ✅ Maven Wrapper 已存在"
fi

# 3. 构建项目
echo ""
echo "[3/5] 构建项目..."
echo "  首次构建可能需要几分钟下载依赖，请耐心等待..."
if ! "$PROJECT_DIR/mvnw" clean package -DskipTests -q; then
    echo ""
    echo "  ❌ 构建失败，请检查错误信息"
    echo ""
    echo "  可以尝试以下命令查看详细错误："
    echo "  ./mvnw clean package -DskipTests"
    exit 1
fi
echo "  ✅ 构建成功"

# 4. 查找生成的 JAR 文件
echo ""
echo "[4/5] 查找可执行 JAR..."
JAR_FILE="$(find "$PROJECT_DIR/target" -name "*.jar" -type f 2>/dev/null | grep -v "sources" | grep -v "javadoc" | head -n 1)"
if [ -z "$JAR_FILE" ]; then
    echo "  ❌ 未找到可执行 JAR 文件"
    exit 1
fi
echo "  ✅ 找到 JAR 文件: $(basename "$JAR_FILE")"

# 5. 启动服务
echo ""
echo "[5/5] 启动服务..."
echo "========================================"
echo "  服务启动信息"
echo "========================================"
echo "  API 地址:  http://localhost:8080/api"
echo "  H2 控制台: http://localhost:8080/h2-console"
echo "  JDBC URL: jdbc:h2:file:./data/virus_scan_db"
echo "  用户名:   sa"
echo "  密码:     (空)"
echo "========================================"
echo "  按 Ctrl+C 停止服务"
echo "========================================"
echo ""

cd "$PROJECT_DIR"
exec java -jar "$JAR_FILE"