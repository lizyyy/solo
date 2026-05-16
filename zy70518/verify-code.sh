#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_ok() { echo -e "${GREEN}✓${NC} $1"; }
log_no() { echo -e "${RED}✗${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }
log_title() { echo -e "${BLUE}$1${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
passed=0
failed=0

echo ""
log_title "========================================"
log_title "连接池泄漏诊断API - 代码结构验证"
log_title "========================================"
echo ""

# =========== 1. 实体类检查 ===========
echo "【1/7】实体类检查"
if [ -f "$SCRIPT_DIR/src/main/java/com/diagnostic/entity/ConnectionPoolDiagnostic.java" ]; then
    log_ok "ConnectionPoolDiagnostic.java 存在"
    passed=$((passed+1))
else
    log_no "ConnectionPoolDiagnostic.java 缺失"
    failed=$((failed+1))
fi

if [ -f "$SCRIPT_DIR/src/main/java/com/diagnostic/entity/DiagnosticReport.java" ]; then
    log_ok "DiagnosticReport.java 存在"
    passed=$((passed+1))
else
    log_no "DiagnosticReport.java 缺失"
    failed=$((failed+1))
fi

if [ -f "$SCRIPT_DIR/src/main/java/com/diagnostic/entity/ServiceInstance.java" ]; then
    log_ok "ServiceInstance.java 存在"
    passed=$((passed+1))
else
    log_no "ServiceInstance.java 缺失"
    failed=$((failed+1))
fi

# =========== 2. Repository 检查 ===========
echo ""
echo "【2/7】Repository 层检查"
if [ -f "$SCRIPT_DIR/src/main/java/com/diagnostic/repository/ConnectionPoolDiagnosticRepository.java" ]; then
    log_ok "ConnectionPoolDiagnosticRepository.java 存在"
    passed=$((passed+1))
    
    # 检查 @Modifying 注解（归档接口修复）
    if grep -q "@Modifying" "$SCRIPT_DIR/src/main/java/com/diagnostic/repository/ConnectionPoolDiagnosticRepository.java"; then
        log_ok "✅ @Modifying 注解已添加（归档接口修复）"
        passed=$((passed+1))
    else
        log_no "❌ 缺少 @Modifying 注解，归档接口会失败"
        failed=$((failed+1))
    fi
    
    # 检查 @Transactional 注解
    if grep -q "@Transactional" "$SCRIPT_DIR/src/main/java/com/diagnostic/repository/ConnectionPoolDiagnosticRepository.java"; then
        log_ok "✅ @Transactional 注解已添加"
        passed=$((passed+1))
    else
        log_no "❌ 缺少 @Transactional 注解"
        failed=$((failed+1))
    fi
else
    log_no "ConnectionPoolDiagnosticRepository.java 缺失"
    failed=$((failed+1))
fi

# =========== 3. Service 层检查 ===========
echo ""
echo "【3/7】Service 层检查"
if [ -f "$SCRIPT_DIR/src/main/java/com/diagnostic/service/DiagnosticService.java" ]; then
    log_ok "DiagnosticService.java 存在"
    passed=$((passed+1))
    
    # 检查核心方法
    if grep -q "createDiagnostic" "$SCRIPT_DIR/src/main/java/com/diagnostic/service/DiagnosticService.java"; then
        log_ok "包含 createDiagnostic 方法（创建诊断）"
        passed=$((passed+1))
    fi
    if grep -q "queryDiagnostic" "$SCRIPT_DIR/src/main/java/com/diagnostic/service/DiagnosticService.java"; then
        log_ok "包含 queryDiagnostic 方法（查询诊断）"
        passed=$((passed+1))
    fi
    if grep -q "updateStatus" "$SCRIPT_DIR/src/main/java/com/diagnostic/service/DiagnosticService.java"; then
        log_ok "包含 updateStatus 方法（状态推进）"
        passed=$((passed+1))
    fi
    if grep -q "manualCorrection" "$SCRIPT_DIR/src/main/java/com/diagnostic/service/DiagnosticService.java"; then
        log_ok "包含 manualCorrection 方法（人工修正）"
        passed=$((passed+1))
    fi
    if grep -q "archiveOldRecords" "$SCRIPT_DIR/src/main/java/com/diagnostic/service/DiagnosticService.java"; then
        log_ok "包含 archiveOldRecords 方法（归档）"
        passed=$((passed+1))
    fi
else
    log_no "DiagnosticService.java 缺失"
    failed=$((failed+1))
fi

# =========== 4. Controller 层检查 ===========
echo ""
echo "【4/7】Controller 层检查"
if [ -f "$SCRIPT_DIR/src/main/java/com/diagnostic/controller/DiagnosticController.java" ]; then
    log_ok "DiagnosticController.java 存在"
    passed=$((passed+1))
    
    # 检查 API 端点
    api_count=0
    if grep -q "@PostMapping" "$SCRIPT_DIR/src/main/java/com/diagnostic/controller/DiagnosticController.java"; then
        api_count=$((api_count+1))
    fi
    if grep -q "@GetMapping" "$SCRIPT_DIR/src/main/java/com/diagnostic/controller/DiagnosticController.java"; then
        api_count=$((api_count+1))
    fi
    if grep -q "@PutMapping" "$SCRIPT_DIR/src/main/java/com/diagnostic/controller/DiagnosticController.java"; then
        api_count=$((api_count+1))
    fi
    log_ok "包含 $api_count 种 HTTP 方法映射"
    passed=$((passed+1))
else
    log_no "DiagnosticController.java 缺失"
    failed=$((failed+1))
fi

# =========== 5. 枚举类检查 ===========
echo ""
echo "【5/7】枚举类检查"
if [ -f "$SCRIPT_DIR/src/main/java/com/diagnostic/enums/DiagnosticStatus.java" ]; then
    log_ok "DiagnosticStatus.java 存在"
    passed=$((passed+1))
    
    # 检查状态枚举值
    status_count=0
    grep -E "PENDING|CONFIRMED|BLOCKED|REVOKED|COMPENSATED" "$SCRIPT_DIR/src/main/java/com/diagnostic/enums/DiagnosticStatus.java" | while read -r line; do
        status_count=$((status_count+1))
    done
    actual_count=$(grep -Eo "PENDING|CONFIRMED|BLOCKED|REVOKED|COMPENSATED" "$SCRIPT_DIR/src/main/java/com/diagnostic/enums/DiagnosticStatus.java" | sort -u | wc -l)
    log_ok "包含 $actual_count 种状态枚举"
    passed=$((passed+1))
else
    log_no "DiagnosticStatus.java 缺失"
    failed=$((failed+1))
fi

# =========== 6. 配置文件检查 ===========
echo ""
echo "【6/7】配置文件检查"
if [ -f "$SCRIPT_DIR/pom.xml" ]; then
    log_ok "pom.xml 存在"
    passed=$((passed+1))
    if grep -q "spring-boot-starter-web" "$SCRIPT_DIR/pom.xml"; then
        log_ok "包含 spring-boot-starter-web 依赖"
        passed=$((passed+1))
    fi
    if grep -q "spring-boot-starter-data-jpa" "$SCRIPT_DIR/pom.xml"; then
        log_ok "包含 spring-boot-starter-data-jpa 依赖"
        passed=$((passed+1))
    fi
else
    log_no "pom.xml 缺失"
    failed=$((failed+1))
fi

if [ -f "$SCRIPT_DIR/src/main/resources/application.yml" ]; then
    log_ok "application.yml 存在"
    passed=$((passed+1))
else
    log_warn "application.yml 可能在其他位置"
fi

# =========== 7. 启动脚本检查 ===========
echo ""
echo "【7/7】启动脚本检查"
for script in start.sh mvnw env-check.sh verify-api.sh verify-code.sh; do
    if [ -f "$SCRIPT_DIR/$script" ] && [ -x "$SCRIPT_DIR/$script" ]; then
        log_ok "$script 存在且可执行"
        passed=$((passed+1))
    elif [ -f "$SCRIPT_DIR/$script" ]; then
        log_warn "$script 存在但不可执行"
    else
        log_no "$script 缺失"
        failed=$((failed+1))
    fi
done

# Docker 配置检查
if [ -f "$SCRIPT_DIR/Dockerfile" ]; then
    log_ok "Dockerfile 存在"
    passed=$((passed+1))
fi
if [ -f "$SCRIPT_DIR/docker-compose.yml" ]; then
    log_ok "docker-compose.yml 存在"
    passed=$((passed+1))
fi

# =========== 总结 ===========
echo ""
log_title "========================================"
log_title "验证总结"
log_title "========================================"
echo ""
echo "通过: $passed 项"
echo "失败: $failed 项"
echo ""

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}🎉 所有代码结构验证通过！${NC}"
    echo ""
    echo "接下来可以："
    echo "  1. 运行 ./env-check.sh 检查运行环境"
    echo "  2. 安装 Maven 或 Docker 后运行 ./start.sh"
    echo "  3. 启动服务后运行 ./verify-api.sh 测试 API"
else
    echo -e "${RED}❌ 有 $failed 项验证失败，请检查上述问题${NC}"
fi
echo ""
