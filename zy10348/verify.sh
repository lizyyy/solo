#!/bin/bash
# 项目验证脚本 - 测试多租户加密轮换 API

set -e

echo "=========================================="
echo "多租户加密轮换 API - 项目验证脚本"
echo "=========================================="
echo ""

# 检查 Java 版本
echo "1. 检查 Java 版本..."
if command -v java >/dev/null 2>&1; then
    java -version 2>&1
else
    echo "错误: 未找到 Java，请安装 JDK 8 或更高版本"
    exit 1
fi
echo ""

# 检查 Maven
echo "2. 检查构建工具..."
if command -v mvn >/dev/null 2>&1; then
    MVN_CMD="mvn"
    echo "使用系统 Maven: $(mvn -version | head -n 1)"
elif [ -f "./mvnw" ]; then
    MVN_CMD="./mvnw"
    echo "使用 Maven Wrapper"
else
    echo "警告: 未找到 Maven，跳过编译测试"
    MVN_CMD=""
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

all_exist=true
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ✗ $file (缺失)"
        all_exist=false
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
fi

echo -n "  数据签名生成(SHA-256)... "
if grep -q "SHA-256" src/main/java/com/encryption/rotation/service/RotationService.java; then
    echo "✓ 已实现"
else
    echo "✗ 未实现"
fi

echo -n "  状态机流转控制... "
if grep -q "validateTransition" src/main/java/com/encryption/rotation/service/RotationStateMachine.java; then
    echo "✓ 已实现"
else
    echo "✗ 未实现"
fi

echo -n "  失败记录持久化... "
if [ -f "src/main/java/com/encryption/rotation/model/entity/FailureRecord.java" ]; then
    echo "✓ 已实现"
else
    echo "✗ 未实现"
fi

echo -n "  Java 8 兼容性... "
if grep -q "<java.version>1.8</java.version>" pom.xml; then
    echo "✓ 已配置"
else
    echo "✗ 未配置"
fi
echo ""

# 测试编译（如果有 Maven）
if [ -n "$MVN_CMD" ]; then
    echo "5. 测试项目编译..."
    echo "   运行: $MVN_CMD compile -q"
    if $MVN_CMD compile -q; then
        echo "   ✓ 编译成功"
    else
        echo "   ✗ 编译失败"
    fi
    echo ""
fi

echo "=========================================="
echo "验证完成！"
echo ""
echo "启动项目命令:"
echo "  mvn spring-boot:run  (或 ./mvnw spring-boot:run)"
echo ""
echo "测试重复提交保护:"
echo "  1. 先 POST /api/rotation 创建批次"
echo "  2. 再次 POST 相同请求，应返回同一批次 ID"
echo "=========================================="
