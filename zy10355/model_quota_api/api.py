from datetime import datetime
from typing import Optional, List
from uuid import UUID
from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.responses import JSONResponse
from models import (
    BusinessParty,
    ModelInfo,
    GpuQuota,
    InferenceRequest,
    QueuePosition,
    ReturnRecord,
    UsageRecord,
    RequestStatus,
    PriorityLevel,
)
from engine import QuotaEngine, QuotaEngineError


app = FastAPI(
    title="模型推理配额 API",
    description="GPU 配额管理与推理请求调度系统",
    version="1.0.0",
)

engine = QuotaEngine()


@app.exception_handler(QuotaEngineError)
async def quota_engine_error_handler(request, exc: QuotaEngineError):
    return JSONResponse(
        status_code=400,
        content={
            "error_code": exc.error_code,
            "message": exc.message,
            "timestamp": datetime.now().isoformat(),
        },
    )


@app.post("/parties", response_model=BusinessParty, tags=["业务方管理"])
def create_party(party: BusinessParty):
    return engine.register_party(party)


@app.get("/parties/{party_id}", response_model=BusinessParty, tags=["业务方管理"])
def get_party(party_id: str):
    party = engine.parties.get(party_id)
    if not party:
        raise HTTPException(status_code=404, detail="业务方不存在")
    return party


@app.post("/models", response_model=ModelInfo, tags=["模型管理"])
def create_model(model: ModelInfo):
    return engine.register_model(model)


@app.get("/models/{model_id}", response_model=ModelInfo, tags=["模型管理"])
def get_model(model_id: str):
    model = engine.models.get(model_id)
    if not model:
        raise HTTPException(status_code=404, detail="模型不存在")
    return model


@app.post("/quotas", response_model=GpuQuota, tags=["额度管理"])
def set_quota(quota: GpuQuota):
    return engine.set_quota(quota)


@app.get("/quotas/{party_id}/{model_id}", response_model=GpuQuota, tags=["额度管理"])
def get_quota(party_id: str, model_id: str):
    quota = engine.get_quota(party_id, model_id)
    if not quota:
        raise HTTPException(status_code=404, detail="额度配置不存在")
    return quota


@app.post("/requests", response_model=InferenceRequest, tags=["推理请求"])
def create_inference_request(
    idempotency_key: str = Header(..., description="幂等性键，重复提交返回相同结果"),
    party_id: str = Query(..., description="业务方 ID"),
    model_id: str = Query(..., description="模型 ID"),
    requested_gpu_units: Optional[int] = Query(None, description="请求 GPU 数量"),
    priority: PriorityLevel = Query(PriorityLevel.NORMAL, description="优先级"),
):
    return engine.create_request(
        idempotency_key=idempotency_key,
        party_id=party_id,
        model_id=model_id,
        requested_gpu_units=requested_gpu_units,
        priority=priority,
    )


@app.post("/requests/{request_id}/process", response_model=InferenceRequest, tags=["推理请求"])
def process_request(request_id: UUID):
    return engine.validate_and_process(request_id)


@app.post("/requests/{request_id}/complete", response_model=InferenceRequest, tags=["推理请求"])
def complete_request(request_id: UUID, success: bool = Query(True, description="是否成功")):
    return engine.complete_request(request_id, success)


@app.post("/requests/{request_id}/fail", response_model=InferenceRequest, tags=["推理请求"])
def fail_request(
    request_id: UUID,
    error_code: str = Query(..., description="错误码"),
    error_message: str = Query(..., description="错误信息"),
):
    return engine.fail_request(request_id, error_code, error_message)


@app.post("/requests/{request_id}/cancel", response_model=InferenceRequest, tags=["推理请求"])
def cancel_request(request_id: UUID):
    return engine.cancel_request(request_id)


@app.post(
    "/requests/{request_id}/priority", response_model=InferenceRequest, tags=["推理请求"]
)
def adjust_request_priority(
    request_id: UUID,
    priority: PriorityLevel = Query(..., description="新优先级"),
):
    return engine.adjust_priority(request_id, priority)


@app.get("/requests/{request_id}", response_model=InferenceRequest, tags=["推理请求"])
def get_request(request_id: UUID):
    request = engine.get_request(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="请求不存在")
    return request


@app.get(
    "/requests/idempotency/{idempotency_key}",
    response_model=InferenceRequest,
    tags=["推理请求"],
)
def get_request_by_idempotency(idempotency_key: str):
    request = engine.get_request_by_idempotency(idempotency_key)
    if not request:
        raise HTTPException(status_code=404, detail="请求不存在")
    return request


@app.get("/parties/{party_id}/requests", response_model=List[InferenceRequest], tags=["推理请求"])
def list_party_requests(
    party_id: str,
    status: Optional[RequestStatus] = Query(None, description="按状态过滤"),
):
    return engine.get_party_requests(party_id, status)


@app.get("/queues/{party_id}/{model_id}", response_model=List[QueuePosition], tags=["排队管理"])
def get_queue(party_id: str, model_id: str):
    return engine.get_queue(party_id, model_id)


@app.get("/usage", response_model=List[UsageRecord], tags=["用量统计"])
def get_usage(
    party_id: Optional[str] = Query(None, description="业务方 ID"),
    model_id: Optional[str] = Query(None, description="模型 ID"),
    start_time: Optional[datetime] = Query(None, description="开始时间"),
    end_time: Optional[datetime] = Query(None, description="结束时间"),
):
    return engine.get_usage_records(party_id, model_id, start_time, end_time)


@app.get("/returns", response_model=List[ReturnRecord], tags=["返还记录"])
def get_return_records(
    party_id: Optional[str] = Query(None, description="业务方 ID"),
    model_id: Optional[str] = Query(None, description="模型 ID"),
):
    return engine.get_return_records(party_id, model_id)


@app.get("/health", tags=["系统"])
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}
