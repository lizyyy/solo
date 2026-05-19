#!/bin/bash
set -e

echo "========================================="
echo "采样预算Trace标签规则排查工具 - 演示脚本"
echo "========================================="

echo ""
echo "--- 0. 清理旧数据 ---"
rm -rf ./data

echo ""
echo "--- 1. 安装依赖 ---"
python3 -m pip install -q click pydantic rich

echo ""
echo "--- 2. 创建服务预算 (正常输入) ---"
python3 cli.py create-budget order-service 1000
python3 cli.py create-budget payment-service 500
python3 cli.py create-budget user-service 2000

echo ""
echo "--- 3. 查看服务列表 ---"
python3 cli.py list-services

echo ""
echo "--- 4. 创建采样规则 ---"
python3 cli.py create-rule error-high order-service level ERROR --priority 100 --sampling-rate 1.0
python3 cli.py create-rule db-slow order-service operation db_query --match-type prefix --priority 80 --sampling-rate 0.8
python3 cli.py create-rule http-5xx order-service status_code 5 --match-type prefix --priority 90 --sampling-rate 0.9
python3 cli.py create-rule has-trace-id order-service trace_id --match-type exists --priority 60 --sampling-rate 0.5

echo ""
echo "--- 5. 查看规则列表 ---"
python3 cli.py list-rules

echo ""
echo "--- 6. 测试正常采样决策 ---"
echo "测试1: 错误日志 (应该采样)"
python3 cli.py decide trace-001 order-service --tag level=ERROR --tag operation=create_order
echo ""
echo "测试2: DB慢查询 (应该采样)"
python3 cli.py decide trace-002 order-service --tag operation=db_query_get_user --tag status_code=200
echo ""
echo "测试3: HTTP 5xx (应该采样)"
python3 cli.py decide trace-003 order-service --tag status_code=500 --tag operation=http_request
echo ""
echo "测试4: 正常日志 (默认采样)"
python3 cli.py decide trace-004 order-service --tag level=INFO --tag operation=health_check

echo ""
echo "--- 7. 创建调整申请 ---"
python3 cli.py request-adjustment adj-001 order-service zhangsan "大促流量突增，预算不足" BUDGET_INCREASE 1000 2000 idem-key-001
python3 cli.py request-adjustment adj-002 order-service lisi "DB慢查询太多，降低采样率" RULE_SAMPLING_RATE '{"rule_id":"db-slow"}' 0.5 idem-key-002

echo ""
echo "--- 8. 测试幂等性 (重复提交) ---"
echo "重复提交相同的幂等键:"
python3 cli.py request-adjustment adj-001 order-service zhangsan "大促流量突增，预算不足" BUDGET_INCREASE 1000 2000 idem-key-001

echo ""
echo "--- 9. 查看调整申请 ---"
python3 cli.py list-adjustments

echo ""
echo "--- 10. 审批调整申请 ---"
python3 cli.py approve adj-001 wangwu
python3 cli.py reject adj-002 zhaoliu

echo ""
echo "--- 11. 查看审批后的状态 ---"
python3 cli.py list-adjustments

echo ""
echo "--- 12. 生成预算报告 (人类可读) ---"
python3 cli.py report order-service --format human

echo ""
echo "--- 13. 生成预算报告 (机器可读 JSON) ---"
python3 cli.py report order-service --format json --output report.json
echo "报告已写入 report.json"

echo ""
echo "--- 14. 边界测试: 预算耗尽场景 ---"
echo "创建一个小预算服务..."
python3 cli.py create-budget test-service 3
echo "连续请求采样..."
python3 cli.py decide trace-b-001 test-service --tag level=INFO
python3 cli.py decide trace-b-002 test-service --tag level=INFO
python3 cli.py decide trace-b-003 test-service --tag level=INFO
python3 cli.py decide trace-b-004 test-service --tag level=INFO

echo ""
echo "--- 15. 边界测试: 无预算服务 ---"
python3 cli.py decide trace-no-budget unknown-service --tag level=ERROR

echo ""
echo "--- 16. 脏数据测试: 尝试创建重复预算 ---"
echo "尝试创建重复预算 (应该失败):"
python3 cli.py create-budget order-service 1500 || echo "预期失败 ✓"

echo ""
echo "--- 17. 空结果测试: 查询不存在的服务规则 ---"
python3 cli.py list-rules --service non-existent-service

echo ""
echo "--- 18. 最终报告验证 ---"
echo "人类可读报告:"
python3 cli.py report order-service --format human
echo ""
echo "验证机器可读报告与人类报告一致性:"
cat report.json | python3 -c "import json,sys;d=json.load(sys.stdin);print(f'服务: {d[\"service_name\"]}');print(f'日预算: {d[\"daily_budget\"]}');print(f'使用率: {d[\"utilization_rate\"]:.1%}')"

echo ""
echo "========================================="
echo "演示完成！"
echo "========================================="
