#!/bin/bash

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAVEN_VERSION="3.8.8"
MAVEN_DIR="$PROJECT_DIR/.maven"
MAVEN_HOME="$MAVEN_DIR/apache-maven-$MAVEN_VERSION"
MAVEN_BIN="$MAVEN_HOME/bin/mvn"

# 设置 JAVA_HOME
if [ -x /usr/libexec/java_home ]; then
    export JAVA_HOME="$(/usr/libexec/java_home)"
fi

if [ ! -d "$MAVEN_HOME" ]; then
    echo "Maven 未安装，请先运行: ./setup.sh"
    exit 1
fi

cd "$PROJECT_DIR"
echo "========================================="
echo "启动批处理优先级队列 API 服务..."
echo "========================================="
echo ""
echo "服务将在以下地址可用："
echo "  API: http://localhost:8080/api/tasks"
echo "  H2控制台: http://localhost:8080/h2-console"
echo ""
echo "按 Ctrl+C 停止服务"
echo "========================================="
echo ""

"$MAVEN_BIN" spring-boot:run
