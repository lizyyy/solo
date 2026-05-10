from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from core import (
    InMemoryStore,
    TenantConfig,
    RequestProcessor,
    CircuitBreaker,
    DegradedResponseManager,
    RecoveryProbe,
    SLOCalculator,
    SLOConfig,
    BackgroundTaskManager,
    RequestStatus,
)


app = FastAPI(
    title="推理限流熔断 API",
    description="租户级限流、熔断、队列管理和 SLO 监控工具",
    version="1.0.0"
)

store = InMemoryStore()
request_processor = RequestProcessor(store)
circuit_breaker = CircuitBreaker(store)
degraded_manager = DegradedResponseManager(store)
recovery_probe = RecoveryProbe(store, circuit_breaker)
slo_calculator = SLOCalculator(store)
task_manager = BackgroundTaskManager(store)


class SubmitRequestRequest(BaseModel):
    tenant_id: str
    payload: Dict[str, Any] = {}


class CompleteRequestRequest(BaseModel):
    request_id: str
    success: bool
    response: Dict[str, Any] = {}
    error_message: Optional[str] = None
    degraded: bool = False
    degraded_reason: Optional[str] = None


def _get_request_with_context(request_id: str) -> Dict[str, Any]:
    record = store.get_request(request_id)
    if not record:
        return None
    
    result = record.model_dump(mode='json')
    
    if record.previous_processing_record:
        prev_record = store.get_request(record.previous_processing_record)
        if prev_record:
            result["previous_record_summary"] = {
                "request_id": prev_record.request_id,
                "status": prev_record.status.value,
                "completed_at": prev_record.completed_at.isoformat() if prev_record.completed_at else None,
                "latency_ms": prev_record.latency_ms,
                "reject_reason": prev_record.reject_reason.value if prev_record.reject_reason else None,
            }
    
    if record.status == RequestStatus.REJECTED and record.current_block_point:
        block_explanations = {
            "tenant_lookup": "租户不存在，请先注册租户",
            "tenant_status": "租户已被禁用，请联系管理员启用",
            "circuit_breaker": "熔断器打开中，服务正在自动恢复或需要手动干预",
            "rate_limit": "超出每分钟请求限额，请稍后重试",
            "queue_depth": "队列已满，系统负载过高",
            "queue_enqueue": "入队失败，请稍后重试",
        }
        result["block_point_explanation"] = block_explanations.get(
            record.current_block_point, 
            "未知卡点"
        )
        
        result["next_steps"] = _get_next_steps(record.current_block_point, record.tenant_id)
    
    return result


def _get_next_steps(block_point: str, tenant_id: str) -> List[str]:
    steps = {
        "tenant_lookup": [
            f"1. 调用 POST /api/tenants 注册租户 {tenant_id}",
            f"2. 或者检查 tenant_id 是否拼写正确",
            "3. 参考：GET /api/tenants 查看现有租户列表",
        ],
        "tenant_status": [
            f"1. 调用 GET /api/tenants/{tenant_id} 查看租户状态",
            f"2. 如确需启用，调用 PUT /api/tenants/{tenant_id} 设置 enabled=true",
            "3. 联系系统管理员确认禁用原因",
        ],
        "circuit_breaker": [
            f"1. 调用 GET /api/circuit-breaker/{tenant_id} 查看熔断详情",
            f"2. 调用 GET /api/recovery-probe/{tenant_id} 运行恢复探测",
            "3. 如确认服务已恢复，可调用 POST /api/recovery-probe/{tenant_id}/reset 手动复位",
            "4. 查看 GET /api/slo/reports 检查近期 SLO 指标",
        ],
        "rate_limit": [
            f"1. 调用 GET /api/tenants/{tenant_id} 查看当前 rate_limit_per_minute 设置",
            "2. 如有必要，联系管理员调整配额",
            "3. 客户端实现退避重试策略",
        ],
        "queue_depth": [
            f"1. 调用 GET /api/tenants/{tenant_id} 查看 max_queue_size 和 max_concurrency",
            f"2. 调用 GET /api/queue/{tenant_id} 查看当前队列深度和活跃请求",
            "3. 降低请求频率或联系管理员扩容",
        ],
        "queue_enqueue": [
            "1. 稍后重试该请求",
            f"2. 检查 GET /api/queue/{tenant_id} 确认队列状态",
            "3. 如问题持续，联系系统管理员",
        ],
    }
    return steps.get(block_point, ["请联系系统管理员"])


@app.get("/")
def root():
    return {
        "name": "推理限流熔断 API",
        "version": "1.0.0",
        "docs": "/docs",
        "quick_start": [
            "1. POST /api/tenants - 注册租户",
            "2. POST /api/requests - 提交推理请求",
            "3. POST /api/requests/{id}/complete - 完成请求",
            "4. GET /api/requests/{id} - 查看请求详情和上下文",
        ]
    }


@app.post("/api/tenants")
def create_tenant(config: TenantConfig):
    existing = store.get_tenant(config.tenant_id)
    if existing:
        raise HTTPException(status_code=400, detail="Tenant already exists")
    store.add_tenant(config)
    return {"message": "Tenant created", "tenant": config.model_dump(mode='json')}


@app.get("/api/tenants")
def list_tenants():
    tenants = store.list_tenants()
    result = []
    for t in tenants:
        result.append({
            **t.model_dump(mode='json'),
            "queue_depth": store.get_queue_depth(t.tenant_id),
            "active_requests": store.get_active_requests_count(t.tenant_id),
            "circuit_state": store.get_circuit_breaker(t.tenant_id).state.value,
        })
    return {"tenants": result}


@app.get("/api/tenants/{tenant_id}")
def get_tenant(tenant_id: str):
    config = store.get_tenant(tenant_id)
    if not config:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    cb_state = store.get_circuit_breaker(tenant_id)
    
    return {
        **config.model_dump(mode='json'),
        "runtime_stats": {
            "queue_depth": store.get_queue_depth(tenant_id),
            "active_requests": store.get_active_requests_count(tenant_id),
            "rate_limit_count": store.get_rate_limit_count(tenant_id),
            "circuit_state": cb_state.state.value,
            "circuit_error_count": cb_state.error_count,
            "circuit_request_count": cb_state.request_count,
        }
    }


@app.put("/api/tenants/{tenant_id}")
def update_tenant(tenant_id: str, config: TenantConfig):
    if tenant_id != config.tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id mismatch")
    
    existing = store.get_tenant(tenant_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    store.update_tenant(config)
    return {"message": "Tenant updated", "tenant": config.model_dump(mode='json')}


@app.post("/api/requests")
def submit_request(req: SubmitRequestRequest):
    record = request_processor.submit_request(req.tenant_id, req.payload)
    return _get_request_with_context(record.request_id)


@app.get("/api/requests/{request_id}")
def get_request(request_id: str):
    result = _get_request_with_context(request_id)
    if not result:
        raise HTTPException(status_code=404, detail="Request not found")
    return result


@app.post("/api/requests/{request_id}/complete")
def complete_request(request_id: str, req: CompleteRequestRequest):
    if request_id != req.request_id:
        raise HTTPException(status_code=400, detail="request_id mismatch")
    
    record = request_processor.complete_request(
        request_id=req.request_id,
        success=req.success,
        response=req.response,
        error_message=req.error_message,
        degraded=req.degraded,
        degraded_reason=req.degraded_reason,
    )
    
    if not record:
        raise HTTPException(status_code=404, detail="Request not found")
    
    return _get_request_with_context(request_id)


@app.post("/api/requests/{request_id}/timeout")
def timeout_request(request_id: str):
    record = request_processor.timeout_request(request_id)
    if not record:
        raise HTTPException(status_code=404, detail="Request not found")
    return _get_request_with_context(request_id)


@app.get("/api/queue/{tenant_id}")
def get_queue_status(tenant_id: str):
    config = store.get_tenant(tenant_id)
    if not config:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    return {
        "tenant_id": tenant_id,
        "queue_depth": store.get_queue_depth(tenant_id),
        "max_queue_size": config.max_queue_size,
        "active_requests": store.get_active_requests_count(tenant_id),
        "max_concurrency": config.max_concurrency,
        "queue_utilization": store.get_queue_depth(tenant_id) / config.max_queue_size,
        "concurrency_utilization": store.get_active_requests_count(tenant_id) / config.max_concurrency,
    }


@app.get("/api/circuit-breaker/{tenant_id}")
def get_circuit_breaker(tenant_id: str):
    state = store.get_circuit_breaker(tenant_id)
    if not state:
        raise HTTPException(status_code=404, detail="Circuit breaker not found")
    
    result = state.model_dump(mode='json')
    
    state_enum = circuit_breaker.check_circuit(tenant_id)
    result["current_checked_state"] = state_enum.value
    
    explanations = {
        "closed": "正常工作 - 请求可以正常通过",
        "open": "熔断器打开 - 拒绝所有请求以防止级联失败",
        "half_open": "半开状态 - 允许有限请求测试服务是否恢复",
    }
    result["state_explanation"] = explanations.get(state_enum.value, "未知状态")
    
    return result


@app.get("/api/recovery-probe/{tenant_id}")
def run_recovery_probe(tenant_id: str):
    return recovery_probe.run_probe(tenant_id)


@app.post("/api/recovery-probe/{tenant_id}/force-half-open")
def force_half_open(tenant_id: str):
    return recovery_probe.force_half_open(tenant_id)


@app.post("/api/recovery-probe/{tenant_id}/reset")
def reset_circuit(tenant_id: str):
    return recovery_probe.reset_circuit(tenant_id)


@app.post("/api/slo/configs")
def create_slo_config(config: SLOConfig):
    existing = [c for c in store.get_slo_configs() if c.name == config.name]
    if existing:
        raise HTTPException(status_code=400, detail="SLO config with this name already exists")
    store.add_slo_config(config)
    return {"message": "SLO config created", "config": config.model_dump(mode='json')}


@app.get("/api/slo/configs")
def list_slo_configs():
    return {"configs": [c.model_dump(mode='json') for c in store.get_slo_configs()]}


@app.get("/api/slo/reports")
def get_slo_reports():
    reports = slo_calculator.generate_all_reports()
    return {"reports": [r.model_dump(mode='json') for r in reports]}


@app.get("/api/slo/reports/{slo_name}")
def get_slo_report(slo_name: str):
    configs = [c for c in store.get_slo_configs() if c.name == slo_name]
    if not configs:
        raise HTTPException(status_code=404, detail="SLO config not found")
    
    report = slo_calculator.generate_report(configs[0])
    return report.model_dump(mode='json')


@app.get("/api/analytics/breakdown/{tenant_id}")
def get_detailed_breakdown(
    tenant_id: str,
    hours: int = Query(24, description="分析时间窗口，单位小时"),
):
    end_time = datetime.now()
    start_time = end_time - timedelta(hours=hours)
    
    breakdown = slo_calculator.get_detailed_breakdown(tenant_id, start_time, end_time)
    
    if breakdown["total_requests"] == 0:
        breakdown["note"] = "该时间窗口内没有请求记录"
        breakdown["next_steps"] = [
            f"1. 确认租户 {tenant_id} 是否已注册：GET /api/tenants/{tenant_id}",
            f"2. 调整时间窗口参数 hours={hours}",
            "3. 提交测试请求：POST /api/requests",
        ]
    else:
        breakdown["next_steps"] = [
            f"1. 使用 request_ids 列表查询具体请求详情：GET /api/requests/{{request_id}}",
            f"2. 查看租户运行状态：GET /api/tenants/{tenant_id}",
            "3. 检查 SLO 报告：GET /api/slo/reports",
        ]
    
    return breakdown


@app.get("/api/analytics/export/{tenant_id}")
def export_requests(
    tenant_id: str,
    hours: int = Query(24, description="导出时间窗口，单位小时"),
    status: Optional[str] = Query(None, description="按状态过滤: success/rejected/failed/degraded/timeout"),
):
    end_time = datetime.now()
    start_time = end_time - timedelta(hours=hours)
    
    status_enum = None
    if status:
        try:
            status_enum = RequestStatus(status.upper())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
    
    history = store.get_request_history(
        tenant_id=tenant_id,
        start_time=start_time,
        end_time=end_time,
        status=status_enum,
    )
    
    export_data = [r.model_dump(mode='json') for r in history]
    
    return {
        "tenant_id": tenant_id,
        "period_start": start_time.isoformat(),
        "period_end": end_time.isoformat(),
        "filter_status": status,
        "total_records": len(export_data),
        "records": export_data,
        "next_steps": [
            "1. 每条记录包含 request_id，可用于详细查询",
            "2. 查看 request_history[].current_block_point 了解拒绝卡点",
            "3. 查看 request_history[].previous_processing_record 追溯上一次处理",
        ],
    }


@app.post("/api/tasks")
def create_task(task_type: str, tenant_id: Optional[str] = None, max_retries: int = 3):
    task = task_manager.create_task(task_type, tenant_id, max_retries)
    return {
        "message": "Task created",
        "task": task.model_dump(mode='json'),
        "next_steps": [
            f"1. 查询任务状态：GET /api/tasks/{task.task_id}",
            "2. 开始任务：POST /api/tasks/{task.task_id}/start",
            "3. 完成任务：POST /api/tasks/{task.task_id}/complete",
        ]
    }


@app.get("/api/tasks")
def list_tasks(tenant_id: Optional[str] = None):
    tasks = task_manager.list_tasks(tenant_id)
    return {"tasks": [t.model_dump(mode='json') for t in tasks]}


@app.get("/api/tasks/{task_id}")
def get_task(task_id: str):
    task = task_manager.get_task_status(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    result = task.model_dump(mode='json')
    
    if task.status.value == "failed":
        result["next_steps"] = [
            f"1. 查看错误信息：{task.error_message}",
            f"2. 手动重试任务：POST /api/tasks/{task_id}/retry",
            "3. 检查依赖服务是否正常",
        ]
    elif task.status.value == "retry":
        result["next_steps"] = [
            f"1. 下次自动重试时间：{task.next_retry_at}",
            f"2. 当前重试次数：{task.retry_count}/{task.max_retries}",
            f"3. 错误信息：{task.error_message}",
            "4. 可提前手动重试：POST /api/tasks/{task_id}/retry",
        ]
    elif task.status.value == "pending":
        result["next_steps"] = [
            f"1. 开始执行任务：POST /api/tasks/{task_id}/start",
        ]
    
    return result


@app.post("/api/tasks/{task_id}/start")
def start_task(task_id: str):
    success = task_manager.start_task(task_id)
    if not success:
        raise HTTPException(
            status_code=400, 
            detail="Task cannot be started. Check status: must be pending or retry"
        )
    task = task_manager.get_task_status(task_id)
    return {"message": "Task started", "task": task.model_dump(mode='json')}


@app.post("/api/tasks/{task_id}/complete")
def complete_task(task_id: str, result: Dict[str, Any] = {}):
    task_manager.complete_task(task_id, result)
    task = task_manager.get_task_status(task_id)
    return {"message": "Task completed", "task": task.model_dump(mode='json')}


@app.post("/api/tasks/{task_id}/fail")
def fail_task(task_id: str, error_message: str):
    result = task_manager.fail_task(task_id, error_message)
    
    if result.get("status") == "failed_permanently":
        result["next_steps"] = [
            "1. 任务已达到最大重试次数，无法自动恢复",
            f"2. 如需手动重试：POST /api/tasks/{task_id}/retry",
            "3. 排查并修复导致失败的根本原因",
        ]
    elif result.get("status") == "retry_scheduled":
        result["next_steps"] = [
            f"1. 下次自动重试：{result['next_retry_at']}",
            "2. 任务将使用指数退避策略重试",
            f"3. 剩余重试次数：{result['max_retries'] - result['retry_count']}",
        ]
    
    return result


@app.post("/api/tasks/{task_id}/retry")
def retry_task(task_id: str):
    success = task_manager.retry_task(task_id)
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Task cannot be retried. Only FAILED tasks can be retried."
        )
    task = task_manager.get_task_status(task_id)
    return {
        "message": "Task reset to pending, ready for retry",
        "task": task.model_dump(mode='json'),
        "next_steps": [
            f"1. 开始执行：POST /api/tasks/{task_id}/start",
            "2. 重试次数已重置为 0",
        ]
    }


@app.get("/api/help/troubleshooting")
def troubleshooting_guide():
    return {
        "title": "故障排查指南",
        "sections": [
            {
                "title": "请求被拒绝？",
                "checklist": [
                    "1. 查看 GET /api/requests/{request_id} 获取拒绝原因",
                    "2. 检查 current_block_point 字段定位卡点",
                    "3. 参考 next_steps 进行下一步操作",
                    "4. 查看 previous_processing_record 追溯历史",
                ]
            },
            {
                "title": "常见卡点及解决方案",
                "points": [
                    {
                        "point": "tenant_lookup",
                        "cause": "租户不存在",
                        "fix": "POST /api/tenants 注册租户",
                        "related_endpoints": ["/api/tenants", "/api/tenants/{id}"],
                    },
                    {
                        "point": "circuit_breaker",
                        "cause": "熔断器打开，服务异常",
                        "fix": "等待自动恢复或手动干预",
                        "related_endpoints": [
                            "/api/circuit-breaker/{tenant_id}",
                            "/api/recovery-probe/{tenant_id}",
                        ],
                    },
                    {
                        "point": "rate_limit",
                        "cause": "超出速率限制",
                        "fix": "降低频率或调整配额",
                        "related_endpoints": ["/api/tenants/{id}"],
                    },
                    {
                        "point": "queue_depth",
                        "cause": "队列已满",
                        "fix": "等待或调整队列/并发配置",
                        "related_endpoints": ["/api/queue/{tenant_id}"],
                    },
                ]
            },
            {
                "title": "后台任务失败？",
                "checklist": [
                    "1. GET /api/tasks/{task_id} 查看状态和错误信息",
                    "2. FAILED 状态可 POST /api/tasks/{id}/retry 手动重试",
                    "3. RETRY 状态会自动按指数退避重试",
                    "4. 重试次数耗尽后需要手动处理",
                ]
            },
            {
                "title": "性能问题排查",
                "endpoints": [
                    "GET /api/tenants/{id} - 查看租户运行时统计",
                    "GET /api/queue/{tenant_id} - 查看队列和并发利用率",
                    "GET /api/slo/reports - 检查 SLO 达成情况",
                    "GET /api/analytics/breakdown/{id} - 按状态/原因细分",
                    "GET /api/analytics/export/{id} - 导出全部明细",
                ]
            }
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8080)
