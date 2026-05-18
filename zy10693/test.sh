#!/bin/bash

BASE_URL="http://localhost:8080/api/v1/batch"

echo "======================================"
echo "灰度发布系统 - 批次暂停恢复API 测试"
echo "======================================"
echo ""

# 检查服务是否启动
check_service() {
    echo "检查服务状态..."
    if curl -s "$BASE_URL/test-app/1" > /dev/null 2>&1; then
        echo "服务已启动 ✓"
        return 0
    else
        echo "服务未启动，请先执行: go run main.go"
        return 1
    fi
}

# 测试场景1: 正常恢复流程
test_scenario_1() {
    echo ""
    echo "======================================"
    echo "测试场景1: 正常恢复流程"
    echo "======================================"
    
    echo -e "\n1. 创建批次..."
    response=$(curl -s -X POST "$BASE_URL/create" \
        -H "Content-Type: application/json" \
        -d '{"app_name":"test-app","batch_no":1,"machines":["host1","host2"]}')
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    
    echo -e "\n2. 暂停批次..."
    response=$(curl -s -X POST "$BASE_URL/pause" \
        -H "Content-Type: application/json" \
        -d '{"app_name":"test-app","batch_no":1,"pause_reason":"测试暂停","resume_condition":"测试完成"}')
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    
    echo -e "\n3. 恢复批次..."
    response=$(curl -s -X POST "$BASE_URL/resume" \
        -H "Content-Type: application/json" \
        -d '{"app_name":"test-app","batch_no":1}')
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    
    echo -e "\n4. 查询批次状态..."
    response=$(curl -s "$BASE_URL/test-app/1")
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    
    echo -e "\n✓ 测试场景1完成"
}

# 测试场景2: 暂停中误发布（冲突冻结）
test_scenario_2() {
    echo ""
    echo "======================================"
    echo "测试场景2: 暂停中误发布（冲突冻结）"
    echo "======================================"
    
    echo -e "\n1. 创建批次..."
    response=$(curl -s -X POST "$BASE_URL/create" \
        -H "Content-Type: application/json" \
        -d '{"app_name":"test-app","batch_no":2,"machines":["host1","host2"]}')
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    
    echo -e "\n2. 暂停批次..."
    response=$(curl -s -X POST "$BASE_URL/pause" \
        -H "Content-Type: application/json" \
        -d '{"app_name":"test-app","batch_no":2,"pause_reason":"测试暂停"}')
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    
    echo -e "\n3. 尝试更新机器进度（暂停状态下）- 应该触发冻结..."
    response=$(curl -s -X POST "$BASE_URL/machine-progress" \
        -H "Content-Type: application/json" \
        -d '{"app_name":"test-app","batch_no":2,"hostname":"host1","progress":50}')
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    
    echo -e "\n4. 尝试恢复已冻结的批次 - 应该失败..."
    response=$(curl -s -X POST "$BASE_URL/resume" \
        -H "Content-Type: application/json" \
        -d '{"app_name":"test-app","batch_no":2}')
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    
    echo -e "\n✓ 测试场景2完成"
}

# 测试场景3: 恢复后回滚
test_scenario_3() {
    echo ""
    echo "======================================"
    echo "测试场景3: 恢复后回滚"
    echo "======================================"
    
    echo -e "\n1. 创建批次..."
    response=$(curl -s -X POST "$BASE_URL/create" \
        -H "Content-Type: application/json" \
        -d '{"app_name":"test-app","batch_no":3,"machines":["host1"]}')
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    
    echo -e "\n2. 暂停..."
    response=$(curl -s -X POST "$BASE_URL/pause" \
        -H "Content-Type: application/json" \
        -d '{"app_name":"test-app","batch_no":3,"pause_reason":"测试"}')
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    
    echo -e "\n3. 恢复..."
    response=$(curl -s -X POST "$BASE_URL/resume" \
        -H "Content-Type: application/json" \
        -d '{"app_name":"test-app","batch_no":3}')
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    
    echo -e "\n4. 回滚..."
    response=$(curl -s -X POST "$BASE_URL/rollback" \
        -H "Content-Type: application/json" \
        -d '{"app_name":"test-app","batch_no":3,"reason":"需要回滚"}')
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    
    echo -e "\n✓ 测试场景3完成"
}

# 测试场景4: 重复恢复请求
test_scenario_4() {
    echo ""
    echo "======================================"
    echo "测试场景4: 重复恢复请求"
    echo "======================================"
    
    echo -e "\n1. 创建批次..."
    response=$(curl -s -X POST "$BASE_URL/create" \
        -H "Content-Type: application/json" \
        -d '{"app_name":"test-app","batch_no":4,"machines":["host1"]}')
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    
    echo -e "\n2. 暂停..."
    response=$(curl -s -X POST "$BASE_URL/pause" \
        -H "Content-Type: application/json" \
        -d '{"app_name":"test-app","batch_no":4,"pause_reason":"测试"}')
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    
    echo -e "\n3. 第一次恢复（成功）..."
    response=$(curl -s -X POST "$BASE_URL/resume" \
        -H "Content-Type: application/json" \
        -d '{"app_name":"test-app","batch_no":4}')
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    
    echo -e "\n4. 第二次恢复（状态已为RESUMED，应该失败）..."
    response=$(curl -s -X POST "$BASE_URL/resume" \
        -H "Content-Type: application/json" \
        -d '{"app_name":"test-app","batch_no":4}')
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    
    echo -e "\n✓ 测试场景4完成"
}

# 测试场景5: 状态越级（直接从RUNNING恢复）
test_scenario_5() {
    echo ""
    echo "======================================"
    echo "测试场景5: 状态越级（直接从RUNNING恢复）"
    echo "======================================"
    
    echo -e "\n1. 创建批次（状态为RUNNING）..."
    response=$(curl -s -X POST "$BASE_URL/create" \
        -H "Content-Type: application/json" \
        -d '{"app_name":"test-app","batch_no":5,"machines":["host1"]}')
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    
    echo -e "\n2. 直接尝试恢复RUNNING状态的批次 - 应该失败..."
    response=$(curl -s -X POST "$BASE_URL/resume" \
        -H "Content-Type: application/json" \
        -d '{"app_name":"test-app","batch_no":5}')
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    
    echo -e "\n✓ 测试场景5完成"
}

# 主程序
main() {
    if check_service; then
        test_scenario_1
        test_scenario_2
        test_scenario_3
        test_scenario_4
        test_scenario_5
        
        echo ""
        echo "======================================"
        echo "所有测试场景完成！"
        echo "======================================"
    fi
}

main "$@"
