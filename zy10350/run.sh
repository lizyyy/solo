#!/bin/bash
# 对象生命周期规则API - 独立启动脚本
# 用法: ./run.sh [build|start|test|stop]

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$PROJECT_DIR/app.pid"
LOG_FILE="$PROJECT_DIR/app.log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_usage() {
    echo "对象生命周期规则API - 启动脚本"
    echo ""
    echo "用法: ./run.sh [命令]"
    echo ""
    echo "可用命令:"
    echo "  build   - 编译项目"
    echo "  start   - 启动服务 (后台运行)"
    echo "  run     - 运行服务 (前台)"
    echo "  test    - 运行测试"
    echo "  stop    - 停止服务"
    echo "  status  - 查看服务状态"
    echo "  clean   - 清理构建文件"
}

check_java() {
    if ! command -v java > /dev/null 2>&1; then
        echo -e "${RED}错误: 未找到Java命令${NC}"
        exit 1
    fi
    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)
    echo -e "${GREEN}✓ 找到Java版本: $(java -version 2>&1 | head -n 1)${NC}"
}

download_maven_wrapper() {
    if [ ! -f "$PROJECT_DIR/.mvn/wrapper/maven-wrapper.jar" ]; then
        echo "正在下载Maven wrapper..."
        cd "$PROJECT_DIR/.mvn/wrapper"
        javac MavenWrapperDownloader.java
        java MavenWrapperDownloader \
            "https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar" \
            "maven-wrapper.jar"
        cd "$PROJECT_DIR"
        echo -e "${GREEN}✓ Maven wrapper下载完成${NC}"
    fi
}

build_project() {
    check_java
    download_maven_wrapper
    echo "正在编译项目..."
    cd "$PROJECT_DIR"
    chmod +x ./mvnw
    ./mvnw clean compile -DskipTests
    echo -e "${GREEN}✓ 项目编译完成${NC}"
}

run_tests() {
    check_java
    download_maven_wrapper
    echo "正在运行测试..."
    cd "$PROJECT_DIR"
    chmod +x ./mvnw
    ./mvnw test
    echo -e "${GREEN}✓ 测试运行完成${NC}"
}

package_project() {
    check_java
    download_maven_wrapper
    echo "正在打包项目..."
    cd "$PROJECT_DIR"
    chmod +x ./mvnw
    ./mvnw package -DskipTests
    echo -e "${GREEN}✓ 项目打包完成${NC}"
}

start_server() {
    check_java
    
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 $PID 2>/dev/null; then
            echo -e "${YELLOW}服务已经在运行 (PID: $PID)${NC}"
            return 0
        else
            rm "$PID_FILE"
        fi
    fi

    # 先打包
    package_project
    
    # 找到jar文件
    JAR_FILE=$(find "$PROJECT_DIR/target" -name "*.jar" -not -name "*sources*" -not -name "*javadoc*" | head -n 1)
    
    if [ -z "$JAR_FILE" ]; then
        echo -e "${RED}错误: 未找到jar文件${NC}"
        exit 1
    fi

    echo "正在启动服务..."
    nohup java -jar "$JAR_FILE" > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    
    # 等待服务启动
    echo "等待服务启动..."
    sleep 10
    
    if curl -s http://localhost:8080 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 服务启动成功!${NC}"
        echo "  访问地址: http://localhost:8080"
        echo "  H2控制台: http://localhost:8080/h2-console"
        echo "  日志文件: $LOG_FILE"
    else
        echo -e "${YELLOW}服务可能正在启动中，请稍后检查...${NC}"
        echo "  查看日志: tail -f $LOG_FILE"
    fi
}

run_server_foreground() {
    check_java
    
    # 先打包
    package_project
    
    # 找到jar文件
    JAR_FILE=$(find "$PROJECT_DIR/target" -name "*.jar" -not -name "*sources*" -not -name "*javadoc*" | head -n 1)
    
    if [ -z "$JAR_FILE" ]; then
        echo -e "${RED}错误: 未找到jar文件${NC}"
        exit 1
    fi

    echo "正在前台运行服务..."
    java -jar "$JAR_FILE"
}

stop_server() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 $PID 2>/dev/null; then
            echo "正在停止服务 (PID: $PID)..."
            kill $PID
            sleep 3
            if kill -0 $PID 2>/dev/null 2>&1; then
                echo "强制停止..."
                kill -9 $PID
            fi
            rm "$PID_FILE"
            echo -e "${GREEN}✓ 服务已停止${NC}"
        else
            rm "$PID_FILE"
            echo -e "${YELLOW}PID文件存在但服务未运行${NC}"
        fi
    else
        echo -e "${YELLOW}服务未运行${NC}"
    fi
}

check_status() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 $PID 2>/dev/null; then
            echo -e "${GREEN}✓ 服务正在运行 (PID: $PID)${NC}"
            echo "  访问地址: http://localhost:8080"
        else
            echo -e "${RED}✗ PID文件存在但服务未运行${NC}"
        fi
    else
        echo -e "${YELLOW}服务未运行${NC}"
    fi
}

clean_project() {
    echo "正在清理..."
    rm -rf "$PROJECT_DIR/target"
    rm -f "$PROJECT_DIR/app.pid"
    rm -f "$PROJECT_DIR/app.log"
    echo -e "${GREEN}✓ 清理完成${NC}"
}

# 主逻辑
case "$1" in
    build)
        build_project
        ;;
    start)
        start_server
        ;;
    run)
        run_server_foreground
        ;;
    test)
        run_tests
        ;;
    stop)
        stop_server
        ;;
    status)
        check_status
        ;;
    clean)
        clean_project
        ;;
    *)
        print_usage
        ;;
esac
