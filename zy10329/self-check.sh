#!/bin/bash

echo "========================================"
echo "  API合成事务巡检 - 自检测试入口"
echo "========================================"
echo ""

# 检测Java环境
echo "检测Java环境..."
if ! command -v java &> /dev/null; then
    echo "❌ 未检测到Java，请先安装JDK 11+"
    exit 1
fi
JAVA_VERSION=$(java -version 2>&1 | head -1 | cut -d'"' -f2 | cut -d'.' -f1)
echo "✓ Java版本: $JAVA_VERSION"
echo ""

# 检测Maven环境，优先使用mvnw
echo "检测构建工具..."
chmod +x mvnw 2>/dev/null

if [ -f "./mvnw" ]; then
    MVN_CMD="./mvnw"
    echo "✓ 使用Maven Wrapper (mvnw)"
elif command -v mvn &> /dev/null; then
    MVN_CMD="mvn"
    echo "✓ 使用系统Maven"
else
    echo "⚠ 未检测到Maven，将尝试直接编译运行"
    echo ""
    echo "提示: 可以手动下载Maven Wrapper jar:"
    echo "  mkdir -p .mvn/wrapper"
    echo "  cd .mvn/wrapper && curl -O https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.1.0/maven-wrapper-3.1.0.jar"
    exit 1
fi
echo ""

# 编译项目
echo "编译项目中，请稍候..."
$MVN_CMD compile -q -DskipTests
if [ $? -ne 0 ]; then
    echo "❌ 项目编译失败，请检查代码错误"
    exit 1
fi
echo "✓ 项目编译成功"
echo ""

# 运行自检测试（运行主类）
echo "运行自检程序..."
$MVN_CMD spring-boot:run -Dspring-boot.run.main-class="com.api.inspection.SelfCheckMain" -q 2>&1 | grep -v "^\[INFO\]" | grep -v "^$"

EXIT_CODE=${PIPESTATUS[0]}

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "  ✅ 自检测试成功完成!"
    echo "========================================"
    echo ""
    echo "启动完整服务命令:"
    echo "  ./mvnw spring-boot:run"
    echo ""
    echo "或打包后运行:"
    echo "  ./mvnw package"
    echo "  java -jar target/api-transaction-inspection-1.0.0.jar"
    exit 0
else
    echo ""
    echo "❌ 自检失败，请查看上面的错误信息"
    exit 1
fi
