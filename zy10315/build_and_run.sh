#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "========================================"
echo "  服务实例排空 API - 编译和启动脚本"
echo "========================================"
echo ""

# 1. 检查Java环境
echo "1. 检查Java环境..."
if command -v javac >/dev/null 2>&1 && command -v java >/dev/null 2>&1; then
    JAVAC_CMD="javac"
    JAVA_CMD="java"
    echo "  ✓ 找到 javac 和 java 命令"
elif [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/javac" ] && [ -x "$JAVA_HOME/bin/java" ]; then
    JAVAC_CMD="$JAVA_HOME/bin/javac"
    JAVA_CMD="$JAVA_HOME/bin/java"
    echo "  ✓ 使用 JAVA_HOME: $JAVA_HOME"
else
    echo "  ✗ 未找到 Java 编译器 (javac) 或运行时 (java)"
    echo ""
    echo "请安装 JDK 8 或更高版本："
    echo "  macOS: brew install openjdk@11"
    echo "  Linux: sudo apt install openjdk-11-jdk"
    echo "  Windows: 下载并安装 Oracle JDK 或 OpenJDK"
    exit 1
fi

JAVA_VERSION=$($JAVA_CMD -version 2>&1 | head -1)
echo "  Java版本: $JAVA_VERSION"

# 2. 创建目录
echo ""
echo "2. 创建输出目录..."
mkdir -p target/classes

# 3. 编译源文件
echo ""
echo "3. 编译Java源文件..."

# 先编译枚举和模型类
echo "  编译模型类..."
MODEL_FILES=(
    "src/main/java/com/infrastructure/drain/model/DrainStatus.java"
    "src/main/java/com/infrastructure/drain/model/DrainBatch.java"
    "src/main/java/com/infrastructure/drain/model/ServiceInstance.java"
    "src/main/java/com/infrastructure/drain/model/PersistentConnection.java"
    "src/main/java/com/infrastructure/drain/model/QueueTask.java"
    "src/main/java/com/infrastructure/drain/model/TrafficOffloadResult.java"
    "src/main/java/com/infrastructure/drain/model/RecoveryAction.java"
    "src/main/java/com/infrastructure/drain/model/DrainActionLog.java"
)

$JAVAC_CMD -d target/classes "${MODEL_FILES[@]}" 2>&1
echo "  ✓ 模型类编译完成"

# 编译独立服务器
echo "  编译独立服务器..."
$JAVAC_CMD -cp target/classes -d target/classes src/main/java/com/infrastructure/drain/StandaloneDrainServer.java 2>&1
echo "  ✓ 独立服务器编译完成"

# 4. 检查编译结果
echo ""
echo "4. 检查编译结果..."
CLASS_COUNT=$(find target/classes -name "*.class" | wc -l)
echo "  生成Class文件: $CLASS_COUNT 个"

if [ -f "target/classes/com/infrastructure/drain/StandaloneDrainServer.class" ]; then
    echo "  ✓ 主类编译成功: StandaloneDrainServer"
else
    echo "  ✗ 主类编译失败"
    exit 1
fi

# 5. 启动说明
echo ""
echo "========================================"
echo "  编译完成！"
echo "========================================"
echo ""
echo "启动服务命令:"
echo "  java -cp target/classes com.infrastructure.drain.StandaloneDrainServer"
echo ""
echo "服务端口: 8080"
echo ""
echo "测试API:"
echo "  curl http://localhost:8080/health"
echo "  curl http://localhost:8080/api/v1/drain/batches"
echo ""

# 6. 询问是否启动
read -p "是否立即启动服务？(y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "启动服务中..."
    echo "按 Ctrl+C 停止服务"
    echo ""
    $JAVA_CMD -cp target/classes com.infrastructure.drain.StandaloneDrainServer
fi
