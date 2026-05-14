#!/bin/bash

echo "========================================"
echo "  API合成事务巡检 - 自检测试入口"
echo "========================================"
echo ""

# 步骤1: 检查并配置环境
echo "步骤1/3: 环境检查..."

# 检查Java
if ! command -v java &> /dev/null; then
    echo "❌ 未检测到Java，请先安装JDK 11+"
    exit 1
fi

# 尝试设置正确的JAVA_HOME（MacOS专用）
if [ -z "$JAVA_HOME" ] && [ -x /usr/libexec/java_home ]; then
    export JAVA_HOME=$(/usr/libexec/java_home 2>/dev/null)
fi

if [ -n "$JAVA_HOME" ]; then
    echo "✓ JAVA_HOME: $JAVA_HOME"
else
    echo "⚠ 未设置JAVA_HOME，将尝试使用系统java"
fi
echo ""

# 步骤2: 检查Maven Wrapper
echo "步骤2/3: 检查构建工具..."

WRAPPER_JAR=".mvn/wrapper/maven-wrapper.jar"
MVN_CMD=""

if [ -f "$WRAPPER_JAR" ]; then
    chmod +x mvnw 2>/dev/null
    MVN_CMD="./mvnw"
    echo "✓ 使用Maven Wrapper"
elif command -v mvn &> /dev/null; then
    MVN_CMD="mvn"
    echo "✓ 使用系统Maven"
else
    echo ""
    echo "========================================"
    echo "  Maven Wrapper 不完整"
    echo "========================================"
    echo ""
    echo "请运行以下命令完成环境配置："
    echo ""
    echo "  chmod +x setup.sh && ./setup.sh"
    echo ""
    echo "setup.sh 将自动下载 maven-wrapper.jar"
    echo ""
    echo "或者手动下载："
    echo "  mkdir -p .mvn/wrapper"
    echo "  curl -O https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.1.0/maven-wrapper-3.1.0.jar"
    echo "  mv maven-wrapper-3.1.0.jar .mvn/wrapper/"
    echo ""
    exit 1
fi

echo ""

# 步骤3: 编译并运行自检
echo "步骤3/3: 编译并运行自检..."
echo ""
echo "正在编译项目，请稍候（首次运行需要下载依赖，可能需要几分钟）..."
echo ""

$MVN_CMD compile -DskipTests -q 2>&1 | tail -20

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ 编译失败，错误信息已显示在上方"
    echo ""
    echo "提示：如果是依赖下载失败，可以尝试配置Maven镜像源"
    exit 1
fi

echo "✓ 编译成功"
echo ""
echo "启动自检程序..."
echo "========================================"
echo ""

# 运行自检主类
$MVN_CMD spring-boot:run -Dspring-boot.run.main-class="com.api.inspection.SelfCheckMain" -q 2>&1 | while IFS= read -r line; do
    # 过滤掉无用的Spring日志，只显示我们的输出
    if [[ "$line" =~ ^\s*$ ]]; then
        continue
    elif [[ "$line" =~ ^\[|^  |^:::|Starting|PID|Operating|Profiles|Tomcat|Spring|Framework|HikariPool|dataSource|JPA|Liquibase|Initialized ]]; then
        # 静默处理Spring的启动日志
        continue
    else
        echo "$line"
    fi
done

EXIT_CODE=${PIPESTATUS[0]}

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "========================================"
    echo "  ✅ 自检测试全部通过!"
    echo "========================================"
    echo ""
    echo "下一步操作："
    echo "  启动服务: ./mvnw spring-boot:run"
    echo "  打包部署: ./mvnw package"
    echo ""
    exit 0
else
    echo "========================================"
    echo "  ❌ 自检失败"
    echo "========================================"
    echo ""
    echo "请查看上方的错误信息"
    exit 1
fi
