#!/bin/bash
# 多源身份校验 API - 代码结构验证脚本
# 无需编译，快速验证代码结构的完整性和一致性

set -e  # 遇到错误立即退出

echo "========================================"
echo "  多源身份校验 API - 代码结构验证"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERROR_COUNT=0
WARNING_COUNT=0

# 检查文件是否存在
check_file_exists() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
        return 0
    else
        echo -e "${RED}✗${NC} $1 - 缺失"
        ((ERROR_COUNT++))
        return 1
    fi
}

# 检查目录是否存在
check_dir_exists() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
        return 0
    else
        echo -e "${RED}✗${NC} $1 - 缺失"
        ((ERROR_COUNT++))
        return 1
    fi
}

# 统计文件数量
count_files() {
    local pattern="$1"
    local desc="$2"
    local expected_min="$3"
    
    local count=$(find . -path "$pattern" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$count" -ge "$expected_min" ]; then
        echo -e "${GREEN}✓${NC} $desc: $count 个"
    else
        echo -e "${YELLOW}⚠${NC}  $desc: $count 个 (预期至少 $expected_min)"
        ((WARNING_COUNT++))
    fi
    return $count
}

# 检查文件中是否包含特定模式
check_file_contains() {
    local file="$1"
    local pattern="$2"
    local desc="$3"
    
    if grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $desc"
        return 0
    else
        echo -e "${YELLOW}⚠${NC}  $desc - 未找到"
        ((WARNING_COUNT++))
        return 1
    fi
}

# 检查文件中是否不包含特定模式
check_file_not_contains() {
    local file="$1"
    local pattern="$2"
    local desc="$3"
    
    if grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "${YELLOW}⚠${NC}  $desc - 发现问题模式"
        ((WARNING_COUNT++))
        return 1
    else
        echo -e "${GREEN}✓${NC} $desc"
        return 0
    fi
}

echo "[1/7] 检查核心配置文件..."
check_file_exists "pom.xml"
check_file_exists ".mvn/wrapper/maven-wrapper.properties"
check_file_exists "mvnw"
check_file_exists "src/main/resources/application.yml"
echo ""

echo "[2/7] 检查核心目录结构..."
check_dir_exists "src/main/java"
check_dir_exists "src/main/java/com/identity/verification/model"
check_dir_exists "src/main/java/com/identity/verification/dto"
check_dir_exists "src/main/java/com/identity/verification/repository"
check_dir_exists "src/main/java/com/identity/verification/service"
check_dir_exists "src/main/java/com/identity/verification/controller"
check_dir_exists "src/main/resources"
echo ""

echo "[3/7] 统计各类文件数量..."
count_files "./src/main/java/*.java" "Java 源文件" 20
count_files "./src/main/java/*Model.java,./src/main/java/*/model/*.java" "Model 实体类" 6
count_files "./src/main/java/*Repository.java,./src/main/java/*/repository/*.java" "Repository 接口" 6
count_files "./src/main/java/*Service.java,./src/main/java/*/service/*.java" "Service 服务类" 2
count_files "./src/main/java/*Controller.java,./src/main/java/*/controller/*.java" "Controller 控制类" 2
count_files "./src/main/java/*DTO.java,./src/main/java/*/dto/*.java" "DTO 数据传输对象" 3
echo ""

echo "[4/7] 检查核心实体类..."
check_file_exists "src/main/java/com/identity/verification/model/VerificationTask.java"
check_file_exists "src/main/java/com/identity/verification/model/VerificationHistory.java"
check_file_exists "src/main/java/com/identity/verification/model/PersonIdentifier.java"
check_file_exists "src/main/java/com/identity/verification/model/ConflictField.java"
check_file_exists "src/main/java/com/identity/verification/model/MergeSuggestion.java"
check_file_exists "src/main/java/com/identity/verification/model/ConfirmationRecord.java"
check_file_exists "src/main/java/com/identity/verification/model/IdentitySource.java"
echo ""

echo "[5/7] 检查核心 Service 和 Controller..."
check_file_exists "src/main/java/com/identity/verification/service/VerificationService.java"
check_file_exists "src/main/java/com/identity/verification/service/ExportService.java"
check_file_exists "src/main/java/com/identity/verification/controller/VerificationController.java"
check_file_exists "src/main/java/com/identity/verification/controller/ExportController.java"
echo ""

echo "[6/7] 验证关键代码规范（避免二义性）..."
check_file_not_contains "src/main/java/com/identity/verification/service/VerificationService.java" "import.*\.\*;" "Service 避免通配符导入"
check_file_not_contains "src/main/java/com/identity/verification/controller/VerificationController.java" "import.*dto\.\*;" "Controller 避免通配符导入"
check_file_contains "src/main/java/com/identity/verification/service/VerificationService.java" "import.*VerificationHistory" "Service 明确导入 VerificationHistory"
check_file_contains "src/main/java/com/identity/verification/service/VerificationService.java" "VerificationHistoryRepository" "Service 注入历史 Repository"
echo ""

echo "[7/7] 验证 pom.xml 关键配置..."
check_file_contains "pom.xml" "<java.version>1.8</java.version>" "Java 版本配置为 1.8"
check_file_contains "pom.xml" "spring-boot-starter-parent" "Spring Boot Parent 配置"
check_file_contains "pom.xml" "spring-boot-starter-web" "Spring Boot Web 依赖"
check_file_contains "pom.xml" "spring-boot-starter-data-jpa" "Spring Data JPA 依赖"
check_file_contains "pom.xml" "h2" "H2 内存数据库依赖"
echo ""

echo "========================================"
echo "  验证结果汇总"
echo "========================================"
echo ""

if [ "$ERROR_COUNT" -eq 0 ] && [ "$WARNING_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✅ 所有检查通过！${NC}"
    echo "代码结构完整，可以进行编译运行。"
    echo ""
    echo "下一步："
    echo "  1. 确保已安装完整 JDK 8+（含 javac）"
    echo "  2. 运行: ./quick-start.sh"
    exit 0
elif [ "$ERROR_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  检查通过，有 $WARNING_COUNT 个警告${NC}"
    echo "代码结构基本完整，可以进行编译运行。"
    echo ""
    echo "下一步："
    echo "  1. 确保已安装完整 JDK 8+（含 javac）"
    echo "  2. 运行: ./quick-start.sh"
    exit 0
else
    echo -e "${RED}❌ 发现 $ERROR_COUNT 个错误，$WARNING_COUNT 个警告${NC}"
    echo ""
    echo "请修复上述错误后再尝试编译运行。"
    exit 1
fi
