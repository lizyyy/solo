#!/bin/bash

echo "============================================"
echo "  图书馆预约队列CLI 验收测试"
echo "============================================"
echo ""

PASS=0
FAIL=0

run_test() {
    local name="$1"
    local cmd="$2"
    local expected="$3"
    
    echo "测试: $name"
    echo "  命令: $cmd"
    result=$(eval $cmd 2>&1)
    
    if echo "$result" | grep -q "$expected"; then
        echo "  ✅ 通过"
        PASS=$((PASS + 1))
    else
        echo "  ❌ 失败"
        echo "  期望包含: $expected"
        echo "  实际输出:"
        echo "$result" | head -20
        FAIL=$((FAIL + 1))
    fi
    echo ""
}

echo "【场景1: 正常输入】"
echo "--------------------------------------------"
run_test "正常队列排序-教师在前" \
    "python3 library_cli.py --readers samples/normal/readers.txt --copies samples/normal/copies.txt --reservations samples/normal/reservations.txt --queue COPY-001 | tr '\n' ' '" \
    "张教授"

run_test "正常报告生成-总预约数9" \
    "python3 library_cli.py --readers samples/normal/readers.txt --copies samples/normal/copies.txt --reservations samples/normal/reservations.txt --report --no-human --json-out /tmp/test.json && cat /tmp/test.json" \
    '"total_reservations": 9'

run_test "教师优先预约数统计正确" \
    "python3 library_cli.py --readers samples/normal/readers.txt --copies samples/normal/copies.txt --reservations samples/normal/reservations.txt --report --no-human --json-out /tmp/test.json && cat /tmp/test.json" \
    '"teacher_priority_count": 3'

echo "【场景2: 边界冲突 - 10人竞争同一本书】"
echo "--------------------------------------------"
run_test "10人队列-3位教师在前3位" \
    "python3 library_cli.py --readers samples/boundary/readers.txt --copies samples/boundary/copies.txt --reservations samples/boundary/reservations.txt --queue COPY-HOT | head -5 | tr '\n' ' '" \
    "张教授.*李老师.*冯教授"

run_test "队列人数为10人" \
    "python3 library_cli.py --readers samples/boundary/readers.txt --copies samples/boundary/copies.txt --reservations samples/boundary/reservations.txt --queue COPY-HOT" \
    "10 人"

echo "【场景3: 脏数据校验】"
echo "--------------------------------------------"
run_test "检测空姓名" \
    "python3 library_cli.py --readers samples/dirty/readers.txt --copies samples/dirty/copies.txt --validate" \
    "姓名不能为空"

run_test "检测负逾期次数" \
    "python3 library_cli.py --readers samples/dirty/readers.txt --copies samples/dirty/copies.txt --validate" \
    "逾期次数不能为负数"

run_test "检测空ISBN" \
    "python3 library_cli.py --readers samples/dirty/readers.txt --copies samples/dirty/copies.txt --validate" \
    "ISBN不能为空"

run_test "检测空书名" \
    "python3 library_cli.py --readers samples/dirty/readers.txt --copies samples/dirty/copies.txt --validate" \
    "书名不能为空"

echo "【场景4: 空结果】"
echo "--------------------------------------------"
run_test "空数据生成报告无报错" \
    "python3 library_cli.py --readers samples/empty/readers.txt --copies samples/empty/copies.txt --reservations samples/empty/reservations.txt --report --no-human --json-out /tmp/empty.json 2>&1; echo EXIT_CODE:$?" \
    "EXIT_CODE:0"

run_test "空报告total为0" \
    "cat /tmp/empty.json" \
    '"total_reservations": 0'

run_test "空报告teacher_priority_count为0" \
    "cat /tmp/empty.json" \
    '"teacher_priority_count": 0'

echo "【核心机制验证】"
echo "--------------------------------------------"
run_test "同读者同书籍重复预约幂等" \
    "python3 verify_idempotent.py" \
    "SUCCESS.*幂等性验证通过"

echo "============================================"
echo "  测试汇总"
echo "  ✅ 通过: $PASS"
echo "  ❌ 失败: $FAIL"
echo "============================================"

if [ $FAIL -eq 0 ]; then
    echo ""
    echo "🎉 所有验收测试通过！"
    exit 0
else
    echo ""
    echo "❌ 有 $FAIL 个测试失败"
    exit 1
fi
