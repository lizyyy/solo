import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import time
from datetime import datetime, timedelta
from core import (
    InMemoryStore,
    TenantConfig,
    RequestProcessor,
    CircuitBreaker,
    RecoveryProbe,
    SLOCalculator,
    SLOConfig,
    BackgroundTaskManager,
    RequestStatus,
    RejectReason,
    CircuitState,
)


def demo_tenant_queue():
    print("=" * 60)
    print("演示 1: 租户队列管理")
    print("=" * 60)
    
    store = InMemoryStore()
    processor = RequestProcessor(store)
    
    config = TenantConfig(
        tenant_id="tenant-001",
        name="测试租户",
        max_queue_size=3,
        max_concurrency=1,
        rate_limit_per_minute=10,
        circuit_breaker_error_threshold=0.5,
        circuit_breaker_timeout=10,
    )
    store.add_tenant(config)
    
    print(f"\n租户配置: max_concurrency={config.max_concurrency}, max_queue={config.max_queue_size}")
    
    records = []
    for i in range(5):
        record = processor.submit_request("tenant-001", {"idx": i})
        records.append(record)
        queue_depth = store.get_queue_depth("tenant-001")
        print(f"请求 {i}: status={record.status.value}, queue={queue_depth}")
        if record.status == RequestStatus.REJECTED:
            print(f"  -> 拒绝原因: {record.reject_reason.value}")
            print(f"  -> 当前卡点: {record.current_block_point}")
    
    print("\n当前队列深度:", store.get_queue_depth("tenant-001"))
    print("活跃请求数:", store.get_active_requests_count("tenant-001"))


def demo_circuit_breaker():
    print("\n" + "=" * 60)
    print("演示 2: 熔断器和恢复探测")
    print("=" * 60)
    
    store = InMemoryStore()
    processor = RequestProcessor(store)
    circuit = CircuitBreaker(store)
    probe = RecoveryProbe(store, circuit)
    
    config = TenantConfig(
        tenant_id="tenant-002",
        name="高风险租户",
        max_queue_size=10,
        max_concurrency=5,
        rate_limit_per_minute=60,
        circuit_breaker_error_threshold=0.3,
        circuit_breaker_timeout=5,
        half_open_max_requests=2,
    )
    store.add_tenant(config)
    
    print(f"\n熔断器阈值: error_rate >= 30% 时熔断, 测试窗口10次请求")
    
    records = []
    for i in range(10):
        record = processor.submit_request("tenant-002", {"idx": i})
        records.append(record)
        is_success = i < 3
        processor.complete_request(
            request_id=record.request_id,
            success=is_success,
            response={"result": i} if is_success else None,
            error_message="模拟失败" if not is_success else None,
        )
    
    cb_state = store.get_circuit_breaker("tenant-002")
    print(f"\n10次请求后熔断器状态: {cb_state.state.value}")
    print(f"错误计数: {cb_state.error_count}/{cb_state.request_count}")
    
    print(f"\n尝试提交新请求...")
    new_record = processor.submit_request("tenant-002", {"test": "new"})
    print(f"新请求状态: {new_record.status.value}")
    if new_record.status == RequestStatus.REJECTED:
        print(f"拒绝原因: {new_record.reject_reason.value}")
        print(f"卡点解释: 熔断器打开, 等待 timeout={config.circuit_breaker_timeout}s")
    
    print(f"\n运行恢复探测...")
    probe_result = probe.run_probe("tenant-002")
    print(f"探测结果: {probe_result}")


def demo_request_tracing():
    print("\n" + "=" * 60)
    print("演示 3: 请求追踪和拒绝可解释性")
    print("=" * 60)
    
    store = InMemoryStore()
    processor = RequestProcessor(store)
    
    config = TenantConfig(
        tenant_id="tenant-003",
        name="追踪演示租户",
        max_queue_size=1,
        max_concurrency=1,
        rate_limit_per_minute=1,
    )
    store.add_tenant(config)
    
    print("\n先执行一次成功请求...")
    r1 = processor.submit_request("tenant-003", {"step": 1})
    processor.complete_request(r1.request_id, True, {"ok": True})
    print(f"请求 1: request_id={r1.request_id}, status=success")
    
    print("\n快速连续提交请求（触发 rate_limit）...")
    rejected_records = []
    for i in range(3):
        r = processor.submit_request("tenant-003", {"attempt": i+1})
        if r.status == RequestStatus.REJECTED:
            rejected_records.append(r)
            print(f"请求 {i+1}: rejected, reason={r.reject_reason.value}")
            print(f"  当前卡点: {r.current_block_point}")
            print(f"  上一次处理: {r.previous_processing_record}")
            
            prev = store.get_request(r.previous_processing_record)
            if prev:
                print(f"  上一次详情: status={prev.status.value}, completed_at={prev.completed_at}")
            break


def demo_slo_reports():
    print("\n" + "=" * 60)
    print("演示 4: SLO 报表和明细导出")
    print("=" * 60)
    
    store = InMemoryStore()
    processor = RequestProcessor(store)
    slo_calc = SLOCalculator(store)
    
    config = TenantConfig(
        tenant_id="tenant-004",
        name="SLO 演示租户",
        max_queue_size=100,
        max_concurrency=10,
        rate_limit_per_minute=100,
    )
    store.add_tenant(config)
    
    slo_config = SLOConfig(
        name="生产环境 SLO",
        tenant_id="tenant-004",
        target_success_rate=0.99,
        target_latency_p95_ms=500,
        window_days=7,
    )
    store.add_slo_config(slo_config)
    
    print("\n生成一些测试请求...")
    for i in range(20):
        r = processor.submit_request("tenant-004", {"i": i})
        processor.complete_request(
            request_id=r.request_id,
            success=i < 18,
            response={"data": i} if i < 18 else None,
            error_message="模拟错误" if i >= 18 else None,
            degraded=i == 17,
            degraded_reason="快速模式" if i == 17 else None,
        )
    
    print("\n生成 SLO 报表...")
    report = slo_calc.generate_report(slo_config)
    print(f"  SLO 名称: {report.slo_name}")
    print(f"  总请求: {report.total_requests}")
    print(f"  成功: {report.successful_requests}")
    print(f"  成功率: {report.success_rate:.2%} (目标: {report.target_success_rate:.2%})")
    print(f"  达成: {'是' if report.success_rate_achieved else '否'}")
    print(f"  降级: {report.degraded_requests}")
    print(f"  拒绝: {report.rejected_requests}")
    print(f"  错误预算剩余: {report.error_budget_remaining:.2%}")
    print(f"  错误明细: {report.breakdown_by_reason}")
    
    print("\n导出明细数据...")
    end = datetime.now()
    start = end - timedelta(hours=1)
    breakdown = slo_calc.get_detailed_breakdown("tenant-004", start, end)
    print(f"  记录数: {breakdown['total_requests']}")
    print(f"  状态分布: {breakdown['by_status']}")
    print(f"  request_ids (前3个): {breakdown['request_ids'][:3]}")
    print(f"  提示: 使用 GET /api/requests/{{id}} 查看详情")


def demo_background_tasks():
    print("\n" + "=" * 60)
    print("演示 5: 后台任务失败和重试表现")
    print("=" * 60)
    
    store = InMemoryStore()
    task_manager = BackgroundTaskManager(store)
    
    print("\n创建任务 (max_retries=3)...")
    task = task_manager.create_task("data_sync", "tenant-005", max_retries=3)
    print(f"  task_id={task.task_id}, status={task.status.value}")
    
    print("\n开始执行任务...")
    task_manager.start_task(task.task_id)
    t = task_manager.get_task_status(task.task_id)
    print(f"  状态: {t.status.value}")
    
    print("\n第1次失败...")
    result = task_manager.fail_task(task.task_id, "网络超时")
    print(f"  结果: {result['status']}")
    print(f"  重试次数: {result['retry_count']}/{result['max_retries']}")
    print(f"  下次重试: {result['next_retry_at']}")
    
    print("\n第2次失败...")
    task_manager.start_task(task.task_id)
    result = task_manager.fail_task(task.task_id, "数据库连接失败")
    print(f"  结果: {result['status']}")
    print(f"  重试次数: {result['retry_count']}/{result['max_retries']}")
    
    print("\n第3次失败...")
    task_manager.start_task(task.task_id)
    result = task_manager.fail_task(task.task_id, "磁盘空间不足")
    print(f"  结果: {result['status']}")
    print(f"  是否需要人工: {result.get('action_required', '否')}")
    
    print("\n查看最终任务状态...")
    final_task = task_manager.get_task_status(task.task_id)
    print(f"  最终状态: {final_task.status.value}")
    print(f"  错误信息: {final_task.error_message}")
    
    print("\n手动重试...")
    success = task_manager.retry_task(task.task_id)
    print(f"  重置成功: {success}")
    t2 = task_manager.get_task_status(task.task_id)
    print(f"  新状态: {t2.status.value}")
    print(f"  重试计数重置: {t2.retry_count}")


if __name__ == "__main__":
    demo_tenant_queue()
    demo_circuit_breaker()
    demo_request_tracing()
    demo_slo_reports()
    demo_background_tasks()
    
    print("\n" + "=" * 60)
    print("演示完成!")
    print("=" * 60)
    print("""
下一步操作建议:
1. pip install -r requirements.txt
2. python main.py 启动 API 服务
3. 访问 http://localhost:8000/docs 查看 Swagger UI
4. 使用 /api/help/troubleshooting 查看故障排查指南
""")
