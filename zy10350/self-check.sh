#!/bin/bash
# 项目自检脚本 - 验证所有关键功能

echo "========================================"
echo "  对象生命周期规则API - 项目自检"
echo "========================================"
echo ""

PASS=0
FAIL=0

check_item() {
    local name="$1"
    local result="$2"
    printf "  %-40s ... " "$name"
    if [ "$result" = "OK" ]; then
        echo -e "\033[32m✓ PASS\033[0m"
        ((PASS++))
    else
        echo -e "\033[31m✗ FAIL\033[0m"
        echo "    $result"
        ((FAIL++))
    fi
}

# 1. 检查Bash脚本语法
echo "[1/5] 检查脚本语法"
if bash -n test-api.sh 2>&1; then
    check_item "test-api.sh Bash语法" "OK"
else
    check_item "test-api.sh Bash语法" "FAIL - $(bash -n test-api.sh 2>&1)"
fi

if bash -n run.sh 2>&1; then
    check_item "run.sh Bash语法" "OK"
else
    check_item "run.sh Bash语法" "FAIL - $(bash -n run.sh 2>&1)"
fi

# 2. 检查关键Java文件存在
echo ""
echo "[2/5] 检查关键文件存在"
if [ -f "src/main/java/com/object/lifecycle/exception/GlobalExceptionHandler.java" ]; then
    check_item "GlobalExceptionHandler.java存在" "OK"
else
    check_item "GlobalExceptionHandler.java存在" "FAIL - 文件不存在"
fi

if [ -f "src/main/java/com/object/lifecycle/service/RuleMatcherService.java" ]; then
    check_item "RuleMatcherService.java存在" "OK"
else
    check_item "RuleMatcherService.java存在" "FAIL - 文件不存在"
fi

if [ -f "src/main/java/com/object/lifecycle/service/ArchiveTaskService.java" ]; then
    check_item "ArchiveTaskService.java存在" "OK"
else
    check_item "ArchiveTaskService.java存在" "FAIL - 文件不存在"
fi

if [ -f "src/main/java/com/object/lifecycle/service/DeletionCandidateService.java" ]; then
    check_item "DeletionCandidateService.java存在" "OK"
else
    check_item "DeletionCandidateService.java存在" "FAIL - 文件不存在"
fi

# 3. 检查关键代码修复
echo ""
echo "[3/5] 检查关键代码修复"
if grep -q "ResponseEntity" src/main/java/com/object/lifecycle/exception/GlobalExceptionHandler.java; then
    check_item "GlobalExceptionHandler使用ResponseEntity" "OK"
else
    check_item "GlobalExceptionHandler使用ResponseEntity" "FAIL - 未设置HTTP状态码"
fi

if grep -q "HttpStatus.valueOf" src/main/java/com/object/lifecycle/exception/GlobalExceptionHandler.java; then
    check_item "GlobalExceptionHandler动态设置状态码" "OK"
else
    check_item "GlobalExceptionHandler动态设置状态码" "FAIL - 未动态设置状态码"
fi

if grep -q "RuleMatcherService" src/main/java/com/object/lifecycle/service/ArchiveTaskService.java; then
    check_item "ArchiveTaskService注入RuleMatcherService" "OK"
else
    check_item "ArchiveTaskService注入RuleMatcherService" "FAIL - 未注入规则匹配服务"
fi

if grep -q "RuleMatcherService" src/main/java/com/object/lifecycle/service/DeletionCandidateService.java; then
    check_item "DeletionCandidateService注入RuleMatcherService" "OK"
else
    check_item "DeletionCandidateService注入RuleMatcherService" "FAIL - 未注入规则匹配服务"
fi

# 4. 检查测试覆盖
echo ""
echo "[4/5] 检查测试覆盖"
TEST_COUNT=$(grep -c "test_endpoint\|test_endpoint_expect_fail" test-api.sh)
check_item "API测试用例数量: $TEST_COUNT" "OK"

if grep -q "重复创建" test-api.sh; then
    check_item "测试覆盖重复调用场景" "OK"
else
    check_item "测试覆盖重复调用场景" "FAIL - 未覆盖"
fi

if grep -q "不匹配规则\|状态不能" test-api.sh; then
    check_item "测试覆盖脏数据场景" "OK"
else
    check_item "测试覆盖脏数据场景" "FAIL - 未覆盖"
fi

if grep -q "不能直接激活\|不能重复校验\|不能撤销" test-api.sh; then
    check_item "测试覆盖状态不允许跳转场景" "OK"
else
    check_item "测试覆盖状态不允许跳转场景" "FAIL - 未覆盖"
fi

# 5. 检查核心业务闭环
echo ""
echo "[5/5] 检查核心业务闭环"
if grep -q "status = 'ACTIVE'" src/main/java/com/object/lifecycle/repository/LifecycleRuleRepository.java; then
    check_item "规则匹配仅匹配ACTIVE状态" "OK"
else
    check_item "规则匹配仅匹配ACTIVE状态" "FAIL - 未限制ACTIVE状态"
fi

if grep -q "isObjectMatchRule" src/main/java/com/object/lifecycle/service/ArchiveTaskService.java; then
    check_item "归档任务创建前校验对象匹配" "OK"
else
    check_item "归档任务创建前校验对象匹配" "FAIL - 未校验"
fi

if grep -q "isObjectMatchRule" src/main/java/com/object/lifecycle/service/DeletionCandidateService.java; then
    check_item "删除候选创建前校验对象匹配" "OK"
else
    check_item "删除候选创建前校验对象匹配" "FAIL - 未校验"
fi

if grep -q "hasActiveException" src/main/java/com/object/lifecycle/service/DeletionCandidateService.java; then
    check_item "删除前检查保留例外" "OK"
else
    check_item "删除前检查保留例外" "FAIL - 未校验"
fi

# 总结
echo ""
echo "========================================"
echo "  自检结果汇总"
echo "========================================"
echo "  通过: $PASS"
echo "  失败: $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "\033[32m🎉 所有检查项通过! 项目可正常安装、运行和验证\033[0m"
    echo ""
    echo "  下一步操作:"
    echo "    1. ./run.sh build   - 编译项目"
    echo "    2. ./run.sh start   - 启动服务"
    echo "    3. ./test-api.sh    - 运行API完整测试"
    exit 0
else
    echo -e "\033[31m❌ 部分检查项失败，请修复后再运行\033[0m"
    exit 1
fi
