#!/bin/bash

set -e

echo "========================================="
echo "  批量账号冻结后端服务 - 启动脚本"
echo "========================================="
echo ""

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

check_java() {
    echo "1. 检查 Java 环境..."
    if ! command -v java &> /dev/null; then
        echo "   ❌ Java 未安装，请安装 JDK 17+"
        exit 1
    fi
    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F'"' '{print $2}')
    echo "   ✅ Java 版本: $JAVA_VERSION"
}

build_project() {
    echo ""
    echo "2. 构建项目..."
    if [ -f "./mvnw" ]; then
        chmod +x ./mvnw
        echo "   使用 Maven Wrapper 构建..."
        ./mvnw clean package -DskipTests
    else
        echo "   尝试使用 Maven 构建..."
        mvn clean package -DskipTests
    fi

    if [ $? -ne 0 ]; then
        echo "   ❌ 构建失败，请检查错误信息"
        exit 1
    fi
    echo "   ✅ 构建成功"
}

check_jar() {
    echo ""
    echo "3. 检查构建产物..."
    JAR_FILE=$(find target -name "batch-account-freeze-*.jar" | head -n 1)
    if [ -z "$JAR_FILE" ] || [ ! -f "$JAR_FILE" ]; then
        echo "   ❌ JAR 文件不存在"
        exit 1
    fi
    echo "   ✅ JAR 文件: $JAR_FILE"
}

start_service() {
    echo ""
    echo "4. 启动服务..."
    JAR_FILE=$(find target -name "batch-account-freeze-*.jar" | head -n 1)
    
    echo "   服务即将启动，请确保:"
    echo "   - MySQL 服务已启动"
    echo "   - application.yml 中的数据库配置正确"
    echo ""
    read -p "   按 Enter 继续，或按 Ctrl+C 取消..."
    
    echo "   启动服务，日志将输出到 app.log..."
    nohup java -jar "$JAR_FILE" > app.log 2>&1 &
    PID=$!
    
    echo "   服务 PID: $PID"
    echo "   等待服务启动..."
    sleep 15
    
    if ps -p $PID > /dev/null; then
        echo "   ✅ 服务启动成功"
        echo ""
        echo "   服务地址: http://localhost:8080/api"
        echo "   查看日志: tail -f app.log"
        echo "   停止服务: kill $PID"
    else
        echo "   ❌ 服务启动失败，请查看 app.log"
        exit 1
    fi
}

show_quick_test() {
    echo ""
    echo "========================================="
    echo "  快速测试 API"
    echo "========================================="
    echo ""
    echo "1. 初始化规则:"
    echo "   curl -X POST 'http://localhost:8080/api/rule/init?operator=admin'"
    echo ""
    echo "2. 创建批次:"
    echo "   curl -X POST 'http://localhost:8080/api/batch/sms/create' \\"
    echo "     -H 'Content-Type: application/json' \\"
    echo "     -d '{"'"batchName"'":"'"测试批次"'","'"operator"'":"'"admin"'","'"items"'":[{"'"accountNo"'":"'"ACC001"'","'"smsContent"'":"'"测试短信"'"},{"'"accountNo"'":"'"ACC002"'","'"smsContent"'":"'"测试短信2"'"}] }'"
    echo ""
    echo "3. 查看所有规则版本:"
    echo "   curl 'http://localhost:8080/api/rule/list'"
    echo ""
}

main() {
    check_java
    build_project
    check_jar
    start_service
    show_quick_test
}

main
