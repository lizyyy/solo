#!/bin/bash

set -e

echo "=== 服务实例排空 API 验证脚本 ==="
echo ""

if [ -z "$JAVA_HOME" ]; then
    echo "警告: JAVA_HOME 未设置，尝试使用系统默认 Java"
    JAVA_CMD="java"
else
    JAVA_CMD="$JAVA_HOME/bin/java"
fi

echo "1. 检查 Java 版本..."
$JAVA_CMD -version 2>&1 | head -1

echo ""
echo "2. 检查项目结构..."
echo "源文件数量: $(find src/main/java -name "*.java" | wc -l)"
echo "测试文件数量: $(find src/test/java -name "*.java" | wc -l)"

echo ""
echo "3. 检查核心文件..."
CORE_FILES=(
    "src/main/java/com/infrastructure/drain/DrainApiApplication.java"
    "src/main/java/com/infrastructure/drain/service/DrainService.java"
    "src/main/java/com/infrastructure/drain/service/DrainStateMachine.java"
    "src/main/java/com/infrastructure/drain/controller/DrainController.java"
    "src/main/java/com/infrastructure/drain/dto/DrainBatchResponse.java"
    "src/main/resources/application.yml"
    "pom.xml"
)

for file in "${CORE_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file"
    else
        echo "✗ $file (缺失)"
    fi
done

echo ""
echo "4. 检查 Repository 接口..."
REPO_FILES=(
    "DrainBatchRepository.java"
    "ServiceInstanceRepository.java"
    "DrainActionLogRepository.java"
    "PersistentConnectionRepository.java"
    "QueueTaskRepository.java"
    "TrafficOffloadResultRepository.java"
    "RecoveryActionRepository.java"
)

echo "Repository 接口列表:"
for file in "${REPO_FILES[@]}"; do
    if [ -f "src/main/java/com/infrastructure/drain/repository/$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ✗ $file (缺失)"
    fi
done

echo ""
echo "5. 检查编译结果..."
if [ -d "target/classes" ]; then
    echo "编译目录存在"
    echo "Class 文件数量: $(find target/classes -name "*.class" | wc -l)"
    echo ""
    
    if [ -f "target/classes/com/infrastructure/drain/DrainApiApplication.class" ]; then
        echo "主类已编译"
    else
        echo "警告: 主类未编译"
    fi
else
    echo "编译目录不存在"
fi

echo ""
echo "6. 验证脚本可用性..."
echo "verify.sh: $(realpath "$0")"
echo "README.md: $(realpath README.md)"

echo ""
echo "=== 验证完成 ==="
echo ""
echo "启动方式（需要 Java 11+）:"
echo "  JAVA_HOME=/path/to/java11 java -cp target/classes com.infrastructure.drain.DrainApiApplication"
echo ""
echo "API 端点:"
echo "  GET  http://localhost:8080/api/v1/drain/batches"
echo "  POST http://localhost:8080/api/v1/drain/batches"
echo ""
echo "H2 控制台:"
echo "  http://localhost:8080/h2-console"
echo ""
echo "注意: 当前系统 Java 版本为 1.8，编译需要 Java 11+ JDK"
