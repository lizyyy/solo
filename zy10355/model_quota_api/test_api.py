import sys
from datetime import datetime, timedelta
from uuid import uuid4

sys.path.insert(0, '.')

from models import BusinessParty, ModelInfo, GpuQuota, PriorityLevel
from engine import QuotaEngine


def test_full_flow():
    print("=" * 60)
    print("测试完整流程")
    print("=" * 60)

    engine = QuotaEngine()

    party = BusinessParty(
        party_id="party_001",
        name="AI 业务部",
        description="负责大模型推理业务",
    )
    engine.register_party(party)
    print(f"✓ 注册业务方: {party.party_id}")

    model = ModelInfo(
        model_id="model_llama_v2",
        name="Llama-2-70B",
        version="v2",
        gpu_units_per_request=8,
        avg_inference_seconds=300,
    )
    engine.register_model(model)
    print(f"✓ 注册模型: {model.model_id}")

    quota = GpuQuota(
        party_id="party_001",
        model_id="model_llama_v2",
        total_quota=16,
        effective_date=datetime.now() - timedelta(days=1),
        expire_date=datetime.now() + timedelta(days=30),
    )
    engine.set_quota(quota)
    print(f"✓ 设置额度: 总量 {quota.total_quota}")

    print("\n--- 测试幂等性 ---")
    idempotency_key = f"req_{uuid4()}"
    req1 = engine.create_request(
        idempotency_key=idempotency_key,
        party_id="party_001",
        model_id="model_llama_v2",
        priority=PriorityLevel.NORMAL,
    )
    print(f"✓ 创建请求 1: {req1.request_id}")

    req2 = engine.create_request(
        idempotency_key=idempotency_key,
        party_id="party_001",
        model_id="model_llama_v2",
        priority=PriorityLevel.NORMAL,
    )
    print(f"✓ 重复提交 (幂等): {req2.request_id}")
    assert req1.request_id == req2.request_id, "幂等性验证失败"
    print("✓ 幂等性验证通过")

    print("\n--- 测试额度扣减 ---")
    req = engine.validate_and_process(req1.request_id)
    print(f"✓ 请求状态: {req.status}")
    print(f"✓ 已用额度: {quota.used_quota}")
    assert req.status.value == "running", "请求应该处于运行状态"

    print("\n--- 测试排队机制 ---")
    req3 = engine.create_request(
        idempotency_key=f"req_{uuid4()}",
        party_id="party_001",
        model_id="model_llama_v2",
        priority=PriorityLevel.NORMAL,
    )
    req3 = engine.validate_and_process(req3.request_id)
    print(f"✓ 请求 2 状态: {req3.status} (额度充足，直接运行)")
    print(f"✓ 当前已用额度: {quota.used_quota}")

    req4 = engine.create_request(
        idempotency_key=f"req_{uuid4()}",
        party_id="party_001",
        model_id="model_llama_v2",
        priority=PriorityLevel.HIGH,
    )
    req4 = engine.validate_and_process(req4.request_id)
    print(f"✓ 请求 3 状态: {req4.status} (额度不足，排队)")
    print(f"✓ 队列位置: {req4.queue_position}")

    req5 = engine.create_request(
        idempotency_key=f"req_{uuid4()}",
        party_id="party_001",
        model_id="model_llama_v2",
        priority=PriorityLevel.NORMAL,
    )
    req5 = engine.validate_and_process(req5.request_id)
    print(f"✓ 请求 4 (普通优先级) 队列位置: {req5.queue_position}")
    assert req4.queue_position == 1, "高优先级请求应该排在前面"
    assert req5.queue_position == 2, "普通优先级请求排在后面"
    print("✓ 优先级排序验证通过")

    print("\n--- 测试完成请求与额度返还 ---")
    completed_req = engine.complete_request(req.request_id)
    print(f"✓ 完成请求: {completed_req.status}")
    print(f"✓ 返还后可用额度: {quota.available_quota}")

    queue = engine.get_queue("party_001", "model_llama_v2")
    print(f"✓ 当前队列长度: {len(queue)}")
    assert len(queue) == 1, "应该还剩一个请求在队列中"

    updated_req = engine.get_request(req4.request_id)
    print(f"✓ 队首请求状态: {updated_req.status}")
    assert updated_req.status.value == "running", "队首高优先级请求应该被自动启动"
    print("✓ 队列自动处理验证通过")

    print("\n--- 测试失败请求 ---")
    failed_req = engine.fail_request(
        updated_req.request_id,
        error_code="GPU_OOM",
        error_message="GPU 内存不足",
    )
    print(f"✓ 失败请求: {failed_req.status}")
    print(f"✓ 错误码: {failed_req.error_code}")
    print(f"✓ 错误信息: {failed_req.error_message}")

    print("\n--- 测试记录查询 ---")
    usage = engine.get_usage_records(party_id="party_001")
    print(f"✓ 用量记录数: {len(usage)}")

    returns = engine.get_return_records(party_id="party_001")
    print(f"✓ 返还记录数: {len(returns)}")

    print("\n" + "=" * 60)
    print("✓ 所有测试通过!")
    print("=" * 60)


def test_error_scenarios():
    print("\n" + "=" * 60)
    print("测试异常场景")
    print("=" * 60)

    engine = QuotaEngine()

    from engine import QuotaEngineError

    try:
        engine.create_request(
            idempotency_key="test",
            party_id="nonexistent",
            model_id="nonexistent",
        )
    except QuotaEngineError as e:
        print(f"✓ 预期错误 (业务方不存在): {e.error_code}")

    party = BusinessParty(party_id="test_party", name="测试方", is_active=False)
    engine.register_party(party)

    model = ModelInfo(
        model_id="test_model",
        name="测试模型",
        version="v1",
        gpu_units_per_request=1,
    )
    engine.register_model(model)

    try:
        engine.create_request(
            idempotency_key="test2",
            party_id="test_party",
            model_id="test_model",
        )
    except QuotaEngineError as e:
        print(f"✓ 预期错误 (业务方停用): {e.error_code}")

    party.is_active = True
    engine.parties["test_party"] = party

    quota = GpuQuota(
        party_id="test_party",
        model_id="test_model",
        total_quota=1,
        effective_date=datetime.now() + timedelta(days=1),
    )
    engine.set_quota(quota)

    req = engine.create_request(
        idempotency_key="test3",
        party_id="test_party",
        model_id="test_model",
    )

    try:
        engine.validate_and_process(req.request_id)
    except QuotaEngineError as e:
        print(f"✓ 预期错误 (额度未生效): {e.error_code}")

    print("\n✓ 异常场景测试完成!")


if __name__ == "__main__":
    test_full_flow()
    test_error_scenarios()
