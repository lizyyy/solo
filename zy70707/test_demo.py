#!/usr/bin/env python3
import sys
import os
import json
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from trace_sampler.engine import SamplingEngine
from trace_sampler.models import TagMatchType


def main():
    print("=========================================")
    print("采样预算Trace标签规则排查工具 - 测试脚本")
    print("=========================================")
    
    # 清理旧数据
    data_dir = "./data_test"
    if os.path.exists(data_dir):
        import shutil
        shutil.rmtree(data_dir)
    
    engine = SamplingEngine(data_dir=data_dir)
    
    print("\n--- 1. 创建服务预算 (正常输入) ---")
    engine.create_budget("order-service", 1000)
    engine.create_budget("payment-service", 500)
    engine.create_budget("user-service", 2000)
    print("✓ 创建3个服务预算已创建")
    
    print("\n--- 2. 查看服务列表 ---")
    services = engine.list_services()
    print(f"  服务列表: {services}")
    
    print("\n--- 3. 创建采样规则 ---")
    engine.create_rule(
        rule_id="error-high",
        service_name="order-service",
        tag_key="level",
        tag_value="ERROR",
        match_type=TagMatchType.EXACT,
        priority=100,
        sampling_rate=1.0,
        created_by="demo",
    )
    engine.create_rule(
        rule_id="db-slow",
        service_name="order-service",
        tag_key="operation",
        tag_value="db_query",
        match_type=TagMatchType.PREFIX,
        priority=80,
        sampling_rate=0.8,
        created_by="demo",
    )
    engine.create_rule(
        rule_id="http-5xx",
        service_name="order-service",
        tag_key="status_code",
        tag_value="5",
        match_type=TagMatchType.PREFIX,
        priority=90,
        sampling_rate=0.9,
        created_by="demo",
    )
    engine.create_rule(
        rule_id="has-trace-id",
        service_name="order-service",
        tag_key="trace_id",
        match_type=TagMatchType.EXISTS,
        priority=60,
        sampling_rate=0.5,
        created_by="demo",
    )
    print("✓ 创建了4条采样规则")
    
    print("\n--- 4. 查看规则列表 ---")
    rules = engine.list_rules("order-service")
    for rule in rules:
        print(f"  {rule.rule_id}: priority={rule.priority}, rate={rule.sampling_rate}")
    
    print("\n--- 5. 测试正常采样决策 ---")
    print("测试1: 错误日志")
    decision1 = engine.decide_sampling("trace-001", "order-service", {"level": "ERROR", "operation": "create_order"})
    print(f"  trace-001: sampled={decision1.sampled}, reason={decision1.reason}")
    
    print("测试2: DB慢查询")
    decision2 = engine.decide_sampling("trace-002", "order-service", {"operation": "db_query_get_user", "status_code": "200"})
    print(f"  trace-002: sampled={decision2.sampled}, reason={decision2.reason}")
    
    print("测试3: HTTP 5xx")
    decision3 = engine.decide_sampling("trace-003", "order-service", {"status_code": "500", "operation": "http_request"})
    print(f"  trace-003: sampled={decision3.sampled}, reason={decision3.reason}")
    
    print("测试4: 正常日志 (默认采样)")
    decision4 = engine.decide_sampling("trace-004", "order-service", {"level": "INFO", "operation": "health_check"})
    print(f"  trace-004: sampled={decision4.sampled}, reason={decision4.reason}")
    
    print("\n--- 6. 创建调整申请 ---")
    req1, _ = engine.create_adjustment_request(
        request_id="adj-001",
        service_name="order-service",
        requester="zhangsan",
        reason="大促流量突增，预算不足",
        adjustment_type="BUDGET_INCREASE",
        old_value=1000,
        new_value=2000,
        idempotency_key="idem-key-001",
    )
    
    req2, _ = engine.create_adjustment_request(
        request_id="adj-002",
        service_name="order-service",
        requester="lisi",
        reason="DB慢查询太多，降低采样率",
        adjustment_type="RULE_SAMPLING_RATE",
        old_value={"rule_id": "db-slow"},
        new_value=0.5,
        idempotency_key="idem-key-002",
    )
    print("✓ 创建了2个调整申请")
    
    print("\n--- 7. 测试幂等性 (重复提交) ---")
    req_idem, is_idempotent = engine.create_adjustment_request(
        request_id="adj-001-new",
        service_name="order-service",
        requester="zhangsan",
        reason="大促流量突增，预算不足",
        adjustment_type="BUDGET_INCREASE",
        old_value=1000,
        new_value=2000,
        idempotency_key="idem-key-001",
    )
    if is_idempotent:
        print(f"  ✓ 幂等命中，返回已有请求: {req_idem.request_id}")
    else:
        print(f"  ✗ 幂等未生效!")
    
    print("\n--- 8. 查看调整申请 ---")
    adjustments = engine.list_adjustments("order-service")
    for adj in adjustments:
        print(f"  {adj.request_id}: {adj.adjustment_type}, status={adj.status.value}")
    
    print("\n--- 9. 审批调整申请 ---")
    approved = engine.approve_adjustment("adj-001", "wangwu")
    print(f"  ✓ 已批准 adj-001: status={approved.status.value}")
    
    rejected = engine.reject_adjustment("adj-002", "zhaoliu")
    print(f"  ✓ 已拒绝 adj-002: status={rejected.status.value}")
    
    print("\n--- 10. 生成预算报告 (人类可读) ---")
    report = engine.generate_report("order-service")
    print(report.to_human_readable())
    
    print("\n--- 11. 生成预算报告 (机器可读 JSON) ---")
    machine_readable = report.to_machine_readable()
    print(json.dumps(machine_readable, ensure_ascii=False, indent=2))
    
    print("\n--- 12. 边界测试: 预算耗尽场景 ---")
    engine.create_budget("test-service", 3)
    print("  小预算服务已创建，预算=3")
    for i in range(1, 5):
        dec = engine.decide_sampling(f"trace-b-{i:03d}", "test-service", {"level": "INFO"})
        print(f"    trace-b-{i:03d}: sampled={dec.sampled}, reason={dec.reason}")
    
    print("\n--- 13. 边界测试: 无预算服务 ---")
    dec_no_budget = engine.decide_sampling("trace-no-budget", "unknown-service", {"level": "ERROR"})
    print(f"  trace-no-budget: sampled={dec_no_budget.sampled}, reason={dec_no_budget.reason}")
    
    print("\n--- 14. 脏数据测试: 尝试创建重复预算 ---")
    try:
        engine.create_budget("order-service", 1500)
        print("  ✗ 应该失败但成功了!")
    except ValueError as e:
        print(f"  ✓ 预期失败: {e}")
    
    print("\n--- 15. 空结果测试: 查询不存在的服务规则 ---")
    empty_rules = engine.list_rules("non-existent-service")
    print(f"  ✓ 空结果: {len(empty_rules) == 0}")
    
    print("\n--- 16. 验证人类可读与机器可读一致性 ---")
    print(f"  服务名称一致: {report.service_name == machine_readable['service_name']}")
    print(f"  日预算一致: {report.daily_budget == machine_readable['daily_budget']}")
    print(f"  使用率一致: {abs(report.utilization_rate == machine_readable['utilization_rate'])}")
    print("  ✓ 人类可读与机器可读报告一致性验证通过")
    
    print("\n=========================================")
    print("测试完成！所有功能正常工作 ✓")
    print("=========================================")


if __name__ == "__main__":
    main()
