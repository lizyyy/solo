from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

from .services import service, ValidationError
from .models import BatchStatus, InspectionStatus

app = FastAPI(
    title="农产品检测溯源 API",
    description="围绕农产品入仓前关联产地、检测报告、批次混装、分拣和召回状态的完整溯源系统",
    version="1.0.0"
)


@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "error_code": exc.rule_name,
            "message": str(exc),
            "timestamp": datetime.now().isoformat()
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error_code": "internal_error",
            "message": str(exc),
            "timestamp": datetime.now().isoformat()
        }
    )


class OriginSchema(BaseModel):
    farm_id: str
    farm_name: str
    region: str
    country: str


class CreateBatchRequest(BaseModel):
    origin: OriginSchema
    product_type: str
    quantity: int
    unit: str
    operator_id: str = "OP001"
    operator_name: str = "系统管理员"


class SubmitInspectionRequest(BaseModel):
    batch_id: str
    inspector_id: str
    items: List[Dict[str, Any]]
    status: str
    expiry_days: int = 30
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None
    remarks: Optional[str] = None


class WarehouseInRequest(BaseModel):
    batch_id: str
    box_count: int
    operator_id: str = "OP001"
    operator_name: str = "仓库管理员"


class MixBatchesRequest(BaseModel):
    source_batch_ids: List[str]
    new_batch_info: Dict[str, Any] = {}
    operator_id: str = "OP001"
    operator_name: str = "混装操作员"


class SortingPlanItem(BaseModel):
    box_count: int
    product_type: Optional[str] = None


class SortBatchRequest(BaseModel):
    batch_id: str
    sorting_plan: List[SortingPlanItem]
    operator_id: str = "OP001"
    operator_name: str = "分拣操作员"


class WarehouseOutRequest(BaseModel):
    batch_id: str
    destination: str
    operator_id: str = "OP001"
    operator_name: str = "出库管理员"


class FreezeRequest(BaseModel):
    entity_type: str
    entity_id: str
    reason: str
    operator_id: str = "OP001"
    operator_name: str = "质量管理员"


class RecallRequest(BaseModel):
    source_batch_ids: List[str]
    reason: str
    operator_id: str = "OP001"
    operator_name: str = "召回管理员"


class ManualCorrectionRequest(BaseModel):
    entity_type: str
    entity_id: str
    corrections: Dict[str, Any]
    operator_id: str = "OP001"
    operator_name: str = "超级管理员"
    reason: str


@app.get("/")
async def root():
    return {
        "name": "农产品检测溯源 API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.get("/status")
async def get_status_overview():
    result = service.get_all_status()
    return {"success": True, "data": result}


@app.post("/api/batches")
async def create_batch(
    request: CreateBatchRequest,
    x_idempotency_key: Optional[str] = Header(None)
):
    result = service.create_batch(
        origin=request.origin.model_dump(),
        product_type=request.product_type,
        quantity=request.quantity,
        unit=request.unit,
        operator_id=request.operator_id,
        operator_name=request.operator_name,
        idempotency_key=x_idempotency_key
    )
    return {"success": True, "data": result}


@app.post("/api/inspections")
async def submit_inspection(
    request: SubmitInspectionRequest,
    x_idempotency_key: Optional[str] = Header(None)
):
    result = service.submit_inspection(
        batch_id=request.batch_id,
        inspector_id=request.inspector_id,
        items=request.items,
        status=request.status,
        expiry_days=request.expiry_days,
        operator_id=request.operator_id,
        operator_name=request.operator_name,
        idempotency_key=x_idempotency_key,
        remarks=request.remarks
    )
    return {"success": True, "data": result}


@app.post("/api/warehouse/in")
async def warehouse_in(
    request: WarehouseInRequest,
    x_idempotency_key: Optional[str] = Header(None)
):
    result = service.warehouse_in(
        batch_id=request.batch_id,
        box_count=request.box_count,
        operator_id=request.operator_id,
        operator_name=request.operator_name,
        idempotency_key=x_idempotency_key
    )
    return {"success": True, "data": result}


@app.post("/api/batches/mix")
async def mix_batches(
    request: MixBatchesRequest,
    x_idempotency_key: Optional[str] = Header(None)
):
    result = service.mix_batches(
        source_batch_ids=request.source_batch_ids,
        new_batch_info=request.new_batch_info,
        operator_id=request.operator_id,
        operator_name=request.operator_name,
        idempotency_key=x_idempotency_key
    )
    return {"success": True, "data": result}


@app.post("/api/batches/sort")
async def sort_batch(
    request: SortBatchRequest,
    x_idempotency_key: Optional[str] = Header(None)
):
    result = service.sort_batch(
        batch_id=request.batch_id,
        sorting_plan=[p.model_dump() for p in request.sorting_plan],
        operator_id=request.operator_id,
        operator_name=request.operator_name,
        idempotency_key=x_idempotency_key
    )
    return {"success": True, "data": result}


@app.post("/api/warehouse/out")
async def warehouse_out(
    request: WarehouseOutRequest,
    x_idempotency_key: Optional[str] = Header(None)
):
    result = service.warehouse_out(
        batch_id=request.batch_id,
        destination=request.destination,
        operator_id=request.operator_id,
        operator_name=request.operator_name,
        idempotency_key=x_idempotency_key
    )
    return {"success": True, "data": result}


@app.post("/api/freeze")
async def freeze_entity(
    request: FreezeRequest,
    x_idempotency_key: Optional[str] = Header(None)
):
    result = service.freeze_entity(
        entity_type=request.entity_type,
        entity_id=request.entity_id,
        reason=request.reason,
        operator_id=request.operator_id,
        operator_name=request.operator_name,
        idempotency_key=x_idempotency_key
    )
    return {"success": True, "data": result}


@app.post("/api/recall")
async def recall_batches(
    request: RecallRequest,
    x_idempotency_key: Optional[str] = Header(None)
):
    result = service.recall_batches(
        source_batch_ids=request.source_batch_ids,
        reason=request.reason,
        operator_id=request.operator_id,
        operator_name=request.operator_name,
        idempotency_key=x_idempotency_key
    )
    return {"success": True, "data": result}


@app.post("/api/manual-correction")
async def manual_correction(request: ManualCorrectionRequest):
    result = service.manual_correction(
        entity_type=request.entity_type,
        entity_id=request.entity_id,
        corrections=request.corrections,
        operator_id=request.operator_id,
        operator_name=request.operator_name,
        reason=request.reason
    )
    return {"success": True, "data": result}


@app.get("/api/batches/{batch_id}")
async def get_batch_detail(batch_id: str):
    result = service.get_batch_detail(batch_id)
    return {"success": True, "data": result}


@app.get("/api/batches/{batch_id}/lineage")
async def get_batch_lineage(batch_id: str):
    detail = service.get_batch_detail(batch_id)
    return {"success": True, "data": {"lineage": detail["lineage"]}}


@app.get("/api/batches/{batch_id}/outbound-trace")
async def trace_outbound(batch_id: str):
    result = service.trace_outbound(batch_id)
    return {"success": True, "data": result}


@app.get("/api/boxes/{box_id}")
async def get_box_detail(box_id: str):
    result = service.get_box_detail(box_id)
    return {"success": True, "data": result}


@app.get("/api/audit")
async def get_audit_history(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None
):
    result = service.get_audit_history(entity_type, entity_id)
    return {"success": True, "data": result}


@app.get("/api/reports/recall/{recall_id}")
async def get_recall_report(recall_id: str):
    result = service.generate_recall_report(recall_id)
    return {"success": True, "data": result}


@app.get("/api/reports/freeze/{freeze_id}")
async def get_freeze_report(freeze_id: str):
    result = service.generate_freeze_report(freeze_id)
    return {"success": True, "data": result}
