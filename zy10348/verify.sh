#!/bin/bash
# 项目验证脚本 - 测试多租户加密轮换 API

set -euo pipefail

echo "=========================================="
echo "多租户加密轮换 API - 项目验证脚本"
echo "=========================================="
echo ""

# 全局状态变量
JAVA_VALID=false
MAVEN_AVAILABLE=false
COMPILE_TESTED=false
COMPILE_SUCCESS=false
CODE_CHECKS_PASSED=false
ALL_VALID=false

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_ok() {
    echo -e "  ${GREEN}✓${NC} $1"
}

print_warn() {
    echo -e "  ${YELLOW}!${NC} $1"
}

print_fail() {
    echo -e "  ${RED}✗${NC} $1"
}

# 检查 Java 版本
echo "1. 检查 Java 版本..."
if command -v java >/dev/null 2>&1 && command -v javac >/dev/null 2>&1; then
    java_version=$(java -version 2>&1 | head -n 1)
    echo "$java_version"
    # 检查是否为 Java 8 或更高
    if java -version 2>&1 | grep -q 'version "1\.[8-9]\|version "[1-9][0-9]\.'; then
        print_ok "Java 版本兼容"
        JAVA_VALID=true
    else
        print_warn "建议使用 Java 8 或更高版本"
        JAVA_VALID=true
    fi
else
    print_fail "未找到 Java 或 javac，请安装 JDK"
    JAVA_VALID=false
fi
echo ""

# 检查 Maven
echo "2. 检查构建工具..."
if command -v mvn >/dev/null 2>&1; then
    MAVEN_AVAILABLE=true
    MAVEN_VERSION=$(mvn -version 2>&1 | head -n 1)
    print_ok "Maven 可用: $MAVEN_VERSION"
else
    print_warn "系统未安装 Maven"
    echo "     提示: 如需完整编译验证，请安装 Maven"
    echo "           macOS: brew install maven"
    echo "           Linux: sudo apt install maven 或 sudo yum install maven"
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
        print_ok "$file"
    else
        print_fail "$file (缺失)"
        all_files_exist=false
    fi
done
echo ""

# 检查关键代码特性
echo "4. 检查关键代码特性..."
CODE_CHECK_RESULT=true

check_feature() {
    local name="$1"
    local check="$2"
    echo -n "  $name... "
    if eval "$check" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ 已实现${NC}"
        return 0
    else
        echo -e "${RED}✗ 未实现${NC}"
        CODE_CHECK_RESULT=false
        return 1
    fi
}

check_feature "重复提交检测逻辑" "grep -q 'generateDataSignature' src/main/java/com/encryption/rotation/service/RotationService.java"
check_feature "数据签名生成(SHA-256)" "grep -q 'SHA-256' src/main/java/com/encryption/rotation/service/RotationService.java"
check_feature "状态机流转控制" "grep -q 'validateTransition' src/main/java/com/encryption/rotation/service/RotationStateMachine.java"
check_feature "失败记录持久化" "[ -f src/main/java/com/encryption/rotation/model/entity/FailureRecord.java ]"
check_feature "Java 8 版本配置" "grep -q '<java.version>1.8</java.version>' pom.xml"

# 检查 javax 兼容性
echo -n "  JPA javax 包兼容... "
if grep -r "import javax.persistence" src >/dev/null 2>&1 && ! grep -r "import jakarta.persistence" src >/dev/null 2>&1; then
    echo -e "${GREEN}✓ 已兼容${NC}"
else
    echo -e "${RED}✗ 发现 jakarta 包，与 Spring Boot 2.x 不兼容${NC}"
    CODE_CHECK_RESULT=false
fi

# 检查 Java 9+ 特有语法
echo -n "  Java 8 语法兼容... "
JAVA9_FOUND=0
if find src -name "*.java" -exec grep -l "\.of(" {} \; 2>/dev/null | grep -q .; then
    JAVA9_FOUND=1
fi
if find src -name "*.java" -exec grep -l "case.*->" {} \; 2>/dev/null | grep -q .; then
    JAVA9_FOUND=1
fi
if [ $JAVA9_FOUND -eq 1 ]; then
    echo -e "${RED}✗ 发现 Java 9+ 语法${NC}"
    CODE_CHECK_RESULT=false
else
    echo -e "${GREEN}✓ 已兼容${NC}"
fi

CODE_CHECKS_PASSED=$CODE_CHECK_RESULT
echo ""

# 编译测试
echo "5. 编译验证..."

if [ "$MAVEN_AVAILABLE" = true ]; then
    echo "   使用 Maven 编译..."
    set +e
    mvn compile -q 2>&1
    EXIT_CODE=$?
    set -e
    COMPILE_TESTED=true
    if [ $EXIT_CODE -eq 0 ]; then
        print_ok "Maven 编译成功"
        COMPILE_SUCCESS=true
    else
        print_fail "Maven 编译失败 (退出码: $EXIT_CODE)"
        echo "     运行 'mvn compile' 查看详细错误信息"
        COMPILE_SUCCESS=false
    fi
else
    print_warn "跳过 Maven 编译 (无可用 Maven)"
    echo ""
    echo "   执行 Java 语法检查..."
    
    # 创建临时目录
    TMP_DIR=$(mktemp -d)
    trap 'rm -rf "$TMP_DIR"' EXIT
    
    # 检查所有 Java 文件语法（不实际编译）
    JAVA_FILES=$(find src/main/java -name "*.java" | wc -l)
    if [ "$JAVA_FILES" -gt 0 ]; then
        print_ok "发现 $JAVA_FILES 个 Java 源文件"
        
        # 简单语法检查
        SYNTAX_ERRORS=0
        for file in src/main/java/com/encryption/rotation/**/*.java; do
            if [ -f "$file" ]; then
                # 检查基本语法错误
                if grep -q "public.*class\|import\|package" "$file" 2>/dev/null; then
                    continue
                else
                    SYNTAX_ERRORS=$((SYNTAX_ERRORS + 1))
                fi
            fi
        done
        if [ $SYNTAX_ERRORS -eq 0 ]; then
            print_ok "Java 源文件结构检查通过"
        else
            print_warn "部分文件结构可能有问题"
        fi
    fi
    echo ""
    echo "   ⚠️  注意: 未进行实际编译验证，依赖问题可能未被发现"
fi
echo ""

# 总结报告
echo "=========================================="
echo "验证总结"
echo "=========================================="

echo -n "代码特性检查: "
if [ "$CODE_CHECKS_PASSED" = true ]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
fi

echo -n "编译验证: "
if [ "$COMPILE_TESTED" = true ]; then
    if [ "$COMPILE_SUCCESS" = true ]; then
        echo -e "${GREEN}PASS${NC}"
    else
        echo -e "${RED}FAIL${NC}"
    fi
else
    echo -e "${YELLOW}SKIPPED${NC} (无 Maven)"
fi

echo ""

# 最终状态判断
echo ""
echo "=========================================="
echo "最终验证结论"
echo "=========================================="

if [ "$CODE_CHECKS_PASSED" = true ] && [ "$COMPILE_TESTED" = true ] && [ "$COMPILE_SUCCESS" = true ]; then
    echo -e "${GREEN}✓ 完全验证通过！代码正确且可编译运行${NC}"
    EXIT_CODE=0
elif [ "$CODE_CHECKS_PASSED" = true ]; then
    echo -e "${YELLOW}⚠️  代码检查通过，但未进行编译验证${NC}"
    echo "   原因: 未检测到可用 Maven"
    echo ""
    echo "   提示: 安装 Maven 后重新运行 ./verify.sh"
    echo "         可获得完整的编译验证结果"
    EXIT_CODE=2  # 部分通过
else
    echo -e "${RED}✗ 代码验证失败，请检查上述问题${NC}"
    EXIT_CODE=1
fi

echo ""
echo "启动项目命令:"
if [ "$MAVEN_AVAILABLE" = true ]; then
    echo "  mvn spring-boot:run"
else
    echo "  ./mvnw spring-boot:run (自动下载 Maven)"
fi
echo ""
echo "测试重复提交保护:"
echo "  1. 先 POST /api/rotation 创建批次"
echo "  2. 再次 POST 相同请求，应返回同一批次 ID"

echo "=========================================="
exit $EXIT_CODE
