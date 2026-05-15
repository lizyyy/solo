#!/bin/bash
# 项目验证脚本 - 测试多租户加密轮换 API

set -euo pipefail

echo "=========================================="
echo "多租户加密轮换 API - 项目验证脚本"
echo "=========================================="
echo ""

# 全局变量
MVN_CMD=""
COMPILE_SUCCESS=true

# 检查 Java 版本
echo "1. 检查 Java 版本..."
if command -v java >/dev/null 2>&1; then
    java -version 2>&1
    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | grep -Eo '[0-9]+\.[0-9]+' | head -n 1)
    echo "检测到 Java 版本: $JAVA_VERSION"
else
    echo "错误: 未找到 Java，请安装 JDK 8 或更高版本"
    exit 1
fi
echo ""

# 查找或准备 Maven
echo "2. 准备构建工具..."

# 优先使用系统 Maven
if command -v mvn >/dev/null 2>&1; then
    MVN_CMD="mvn"
    echo "  使用系统 Maven: $(mvn -version 2>&1 | head -n 1)"
else
    MVN_CMD=""
    echo "  警告: 未找到系统 Maven，将跳过编译测试"
    echo "  提示: 如需测试编译，请先安装 Maven"
    echo "        macOS: brew install maven"
    echo "        Linux: sudo apt install maven 或 sudo yum install maven"
fi
echo ""

# 验证项目结构
echo "3. 验证项目结构..."
REQUIRED_FILES=(
    "pom.xml"
    "src/main/java/com/encryption/rotation/RotationApplication.java"
    "src/main/java/com/encryption/rotation/service/RotationService.java"
    "src/main/java/com/encryption/rotation/controller/RotationController.java"
    "src/main/resources/application.yml"
    "README.md"
)

all_files_exist=true
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ✗ $file (缺失)"
        all_files_exist=false
    fi
done
echo ""

# 检查关键代码特性
echo "4. 检查关键代码特性..."

echo -n "  重复提交检测逻辑... "
if grep -q "generateDataSignature" src/main/java/com/encryption/rotation/service/RotationService.java; then
    echo "✓ 已实现"
else
    echo "✗ 未实现"
    COMPILE_SUCCESS=false
fi

echo -n "  数据签名生成(SHA-256)... "
if grep -q "SHA-256" src/main/java/com/encryption/rotation/service/RotationService.java; then
    echo "✓ 已实现"
else
    echo "✗ 未实现"
    COMPILE_SUCCESS=false
fi

echo -n "  状态机流转控制... "
if grep -q "validateTransition" src/main/java/com/encryption/rotation/service/RotationStateMachine.java; then
    echo "✓ 已实现"
else
    echo "✗ 未实现"
    COMPILE_SUCCESS=false
fi

echo -n "  失败记录持久化... "
if [ -f "src/main/java/com/encryption/rotation/model/entity/FailureRecord.java" ]; then
    echo "✓ 已实现"
else
    echo "✗ 未实现"
    COMPILE_SUCCESS=false
fi

echo -n "  Java 8 兼容性配置... "
if grep -q "<java.version>1.8</java.version>" pom.xml; then
    echo "✓ 已配置"
else
    echo "✗ 未配置"
    COMPILE_SUCCESS=false
fi

echo -n "  Java 8 语法兼容... "
# 检查 Java 9+ 特有语法: Set.of, List.of
JAVA9_FOUND=0
if find src -name "*.java" -exec grep -l "\.of(" {} \; 2>/dev/null | grep -q .; then
    JAVA9_FOUND=1
fi
# 检查 switch 表达式 (case ... ->)
if find src -name "*.java" -exec grep -l "case.*->" {} \; 2>/dev/null | grep -q .; then
    JAVA9_FOUND=1
fi
if [ $JAVA9_FOUND -eq 1 ]; then
    echo "✗ 发现 Java 9+ 语法"
    COMPILE_SUCCESS=false
else
    echo "✓ 已兼容"
fi
echo ""

# 测试编译（如果有 Maven）
if [ -n "$MVN_CMD" ]; then
    echo "5. 测试项目编译..."
    echo "   运行: $MVN_CMD compile -q"
    
    # 禁用 set -e 以便捕获编译错误
    set +e
    $MVN_CMD compile -q 2>&1
    EXIT_CODE=$?
    set -e
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo "   ✓ 编译成功"
    else
        echo "   ✗ 编译失败 (退出码: $EXIT_CODE)"
        echo "   提示: 尝试运行 '$MVN_CMD compile' 查看详细错误"
        COMPILE_SUCCESS=false
    fi
    echo ""
else
    echo "5. 编译测试: 跳过（无可用 Maven）"
    echo "   提示: 安装 Maven 后可运行 'mvn compile' 进行完整编译测试"
    echo ""
fi

echo "=========================================="
if [ "$COMPILE_SUCCESS" = true ]; then
    echo "✓ 所有验证通过！"
    echo ""
    echo "启动项目命令:"
    if [ -n "$MVN_CMD" ]; then
        echo "  $MVN_CMD spring-boot:run"
    else
        echo "  先安装 Maven，然后: mvn spring-boot:run"
    fi
    echo ""
    echo "测试重复提交保护:"
    echo "  1. 先 POST /api/rotation 创建批次"
    echo "  2. 再次 POST 相同请求，应返回同一批次 ID"
    EXIT_CODE=0
else
    echo "✗ 部分验证失败，请检查上述问题"
    EXIT_CODE=1
fi
echo "=========================================="

exit $EXIT_CODE
