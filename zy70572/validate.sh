#!/bin/bash

echo "========================================"
echo "  Maven Dependency Conflict CLI - 验证"
echo "========================================"

JAVA_CMD="java"
JAVAC_CMD="javac"

if ! command -v $JAVAC_CMD &> /dev/null; then
    echo "错误: 未找到 javac，请安装 Java JDK 11 或更高版本"
    exit 1
fi

echo ""
echo "[1] 编译源代码..."
mkdir -p classes

find src/main/java -name "*.java" > java_sources.txt

$JAVAC_CMD -d classes -sourcepath src/main/java @java_sources.txt

if [ $? -ne 0 ]; then
    echo "错误: 编译失败"
    rm java_sources.txt
    exit 1
fi

rm java_sources.txt
echo "    ✓ 编译成功"

echo ""
echo "[2] 运行验证器 - 解析 sample-dependency-tree.txt"
echo ""
$JAVA_CMD -cp classes com.maven.dependency.Validator sample-dependency-tree.txt

echo ""
echo ""
echo "[3] 运行完整 CLI - 生成报告"
echo ""
$JAVA_CMD -cp classes com.maven.dependency.cli.ConflictAnalyzerCommand sample-dependency-tree.txt

if [ -f "sample-dependency-tree-conflicts.json" ]; then
    echo ""
    echo "✓ JSON 报告已生成: sample-dependency-tree-conflicts.json"
fi

if [ -f "sample-dependency-tree-conflicts.md" ]; then
    echo "✓ Markdown 报告已生成: sample-dependency-tree-conflicts.md"
fi

echo ""
echo "========================================"
echo "  验证完成!"
echo "========================================"
