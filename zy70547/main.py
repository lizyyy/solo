from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from database import init_db, get_db
from service import QuotaCircuitBreakerService
from models import CircuitBreakerStatus

app = FastAPI(title="第三方额度熔断API")


class SupplierCreateRequest(BaseModel):
    name: str = Field(..., description="供应商名称")
    code: str = Field(..., description="供应商代码")
    description: Optional[str] = Field(None, description="描述")


class BusinessTagCreateRequest(BaseModel):
    name: str = Field(..., description="业务标签名称")
    code: str = Field(..., description="业务标签代码")
    priority: int = Field(..., description="优先级，数字越小优先级越高")
    description: Optional[str] = Field(None, description="描述")


class QuotaWindowCreateRequest(BaseModel):
    supplier_id: int = Field(..., description="供应商ID")
    window_type: str = Field(..., description="窗口类型，如DAILY, MONTHLY")
    total_quota: int = Field(..., description="总额度")
    warning_threshold: float = Field(0.8, description="警告阈值")
    circuit_breaker_threshold: float = Field(0.95, description="熔断阈值")
    start_time: datetime = Field(..., description="窗口开始时间")
    end_time: datetime = Field(..., description="窗口结束时间")


class ConsumeQuotaRequest(BaseModel):
    supplier_code: str = Field(..., description="供应商代码")
    business_tag_code: str = Field(..., description="业务标签代码")
    amount: int = Field(..., description="消耗额度数量")
    request_id: Optional[str] = Field(None, description="请求ID，用于幂等性")
    raw_input: Optional[str] = Field(None, description="原始输入数据")


class ManualCorrectionRequest(BaseModel):
    quota_window_id: int = Field(..., description="额度窗口ID")
    new_used_quota: int = Field(..., description="新的已使用额度")
    reason: str = Field(..., description="修正原因")
    operator: str = Field(..., description="操作人")


@app.on_event("startup")
def startup_event():
    init_db()


@app.post("/suppliers", tags=["供应商管理"])
def create_supplier(request: SupplierCreateRequest, db: Session = Depends(get_db)):
    service = QuotaCircuitBreakerService(db)
    supplier = service.create_supplier(request.name, request.code, request.description)
    return {"success": True, "data": {"id": supplier.id, "name": supplier.name, "code": supplier.code}}


@app.get("/suppliers", tags=["供应商管理"])
def list_suppliers(db: Session = Depends(get_db)):
    from models import Supplier
    suppliers = db.query(Supplier).all()
    return {"success": True, "data": [{"id": s.id, "name": s.name, "code": s.code} for s in suppliers]}


@app.post("/business-tags", tags=["业务标签管理"])
def create_business_tag(request: BusinessTagCreateRequest, db: Session = Depends(get_db)):
    service = QuotaCircuitBreakerService(db)
    tag = service.create_business_tag(request.name, request.code, request.priority, request.description)
    return {"success": True, "data": {"id": tag.id, "name": tag.name, "code": tag.code, "priority": tag.priority}}


@app.get("/business-tags", tags=["业务标签管理"])
def list_business_tags(db: Session = Depends(get_db)):
    from models import BusinessTag
    tags = db.query(BusinessTag).all()
    return {"success": True, "data": [{"id": t.id, "name": t.name, "code": t.code, "priority": t.priority} for t in tags]}


@app.post("/quota-windows", tags=["额度窗口管理"])
def create_quota_window(request: QuotaWindowCreateRequest, db: Session = Depends(get_db)):
    service = QuotaCircuitBreakerService(db)
    window = service.create_quota_window(
        request.supplier_id,
        request.window_type,
        request.total_quota,
        request.start_time,
        request.end_time,
        request.warning_threshold,
        request.circuit_breaker_threshold
    )
    return {
        "success": True,
        "data": {
            "id": window.id,
            "supplier_id": window.supplier_id,
            "total_quota": window.total_quota,
            "used_quota": window.used_quota
        }
    }


@app.get("/quota-windows/{supplier_id}/current", tags=["额度窗口管理"])
def get_current_window(supplier_id: int, db: Session = Depends(get_db)):
    service = QuotaCircuitBreakerService(db)
    window = service.get_current_quota_window(supplier_id)
    if not window:
        return {"success": False, "error": "No active quota window found"}
    return {
        "success": True,
        "data": {
            "id": window.id,
            "total_quota": window.total_quota,
            "used_quota": window.used_quota,
            "remaining_quota": window.total_quota - window.used_quota
        }
    }


@app.post("/quota/consume", tags=["额度管理"])
def consume_quota(request: ConsumeQuotaRequest, db: Session = Depends(get_db)):
    service = QuotaCircuitBreakerService(db)
    result = service.consume_quota(
        request.supplier_code,
        request.business_tag_code,
        request.amount,
        request.request_id,
        request.raw_input
    )
    return result


@app.get("/circuit-breaker/{supplier_id}/status", tags=["熔断管理"])
def get_circuit_breaker_status(supplier_id: int, db: Session = Depends(get_db)):
    service = QuotaCircuitBreakerService(db)
    status = service.get_circuit_breaker_status(supplier_id)
    return {"success": True, "data": status}


@app.get("/circuit-breaker/events", tags=["熔断管理"])
def list_circuit_breaker_events(supplier_id: Optional[int] = None, db: Session = Depends(get_db)):
    service = QuotaCircuitBreakerService(db)
    events = service.get_circuit_breaker_events(supplier_id)
    return {
        "success": True,
        "data": [
            {
                "id": e.id,
                "supplier_id": e.supplier_id,
                "status": e.status,
                "reason": e.reason,
                "triggered_at": e.triggered_at.isoformat()
            }
            for e in events
        ]
    }


@app.get("/quota/usage-history", tags=["额度管理"])
def get_quota_usage_history(
    supplier_id: Optional[int] = None,
    business_tag_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    service = QuotaCircuitBreakerService(db)
    usages = service.get_quota_usage_history(supplier_id, business_tag_id)
    return {
        "success": True,
        "data": [
            {
                "id": u.id,
                "amount": u.amount,
                "status": u.status,
                "conclusion": u.conclusion,
                "created_at": u.created_at.isoformat()
            }
            for u in usages
        ]
    }


@app.post("/quota/manual-correct", tags=["人工管理"])
def manual_correct_quota(request: ManualCorrectionRequest, db: Session = Depends(get_db)):
    service = QuotaCircuitBreakerService(db)
    result = service.manual_correct_quota(
        request.quota_window_id,
        request.new_used_quota,
        request.reason,
        request.operator
    )
    return result


@app.post("/quota/recalculate/{quota_window_id}", tags=["人工管理"])
def recalculate_quota(quota_window_id: int, db: Session = Depends(get_db)):
    service = QuotaCircuitBreakerService(db)
    result = service.recalculate_quota_usage(quota_window_id)
    return result


@app.get("/reports/export/{supplier_id}", tags=["报告管理"])
def export_report(supplier_id: int, db: Session = Depends(get_db)):
    service = QuotaCircuitBreakerService(db)
    report = service.export_quota_report(supplier_id=supplier_id)
    return {"success": True, "data": report}


@app.get("/health", tags=["系统"])
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
