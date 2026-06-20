from typing import List, Dict, Any, Optional
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from models import (
    AttributionStatus, PartStatus, NoteSource, STATUS_EXPORT_MAPPING
)
from service import PipelineAnomalyService
from seed_data import ensure_seed_data
from database import (
    SparePartRepo, AlarmRepo, ManualNoteRepo, AnomalyAttributionRepo
)


_svc: Optional[PipelineAnomalyService] = None


def get_service() -> PipelineAnomalyService:
    global _svc
    if _svc is None:
        _svc = PipelineAnomalyService()
    return _svc


@asynccontextmanager
async def lifespan(app: FastAPI):
    svc = get_service()
    seed_info = ensure_seed_data(svc)
    app.state.seed_info = seed_info
    app.state.service = svc
    yield
    app.state.service = None


app = FastAPI(
    title="工厂管线异常归因",
    description=("安全员老唐/运营主管使用：备件清单→报警→人工备注→异常归因主流程，"
                 "月底复核分组、异常队列导出、接口状态与导出状态一致性保障。"),
    version="1.0.0",
    lifespan=lifespan,
)


class SparePartIn(BaseModel):
    part_no: str = Field(..., description="备件编号，唯一")
    part_name: str
    part_model: str = Field(..., description="实际到货型号")
    expected_model: str = Field(..., description="期望型号；不一致即型号替换")
    quantity: int = Field(..., ge=0)
    pipeline_id: str
    status: PartStatus = PartStatus.NORMAL


class AlarmIn(BaseModel):
    pipeline_id: str
    alarm_type: str
    alarm_desc: str
    related_part_no: Optional[str] = None


class ManualNoteIn(BaseModel):
    pipeline_id: str
    content: str
    operator: str
    related_alarm_no: Optional[str] = None
    related_part_no: Optional[str] = None
    source: NoteSource = NoteSource.MANUAL


class AttributionRunIn(BaseModel):
    part_no: str
    operator: str
    alarm_no: Optional[str] = None
    note_no: Optional[str] = None
    attribution_reason: str = ""


class AttributionConfirmIn(BaseModel):
    attr_no: str
    operator: str
    final_status: AttributionStatus
    confirm_reason: str = ""


def _part_to_dict(p) -> Dict[str, Any]:
    return {
        "id": p.id,
        "part_no": p.part_no,
        "part_name": p.part_name,
        "part_model": p.part_model,
        "expected_model": p.expected_model,
        "quantity": p.quantity,
        "pipeline_id": p.pipeline_id,
        "status": p.status.value,
        "created_at": p.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        "updated_at": p.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
    }


def _alarm_to_dict(a) -> Dict[str, Any]:
    return {
        "id": a.id,
        "alarm_no": a.alarm_no,
        "pipeline_id": a.pipeline_id,
        "alarm_type": a.alarm_type,
        "alarm_desc": a.alarm_desc,
        "status": a.status.value,
        "trigger_time": a.trigger_time.strftime("%Y-%m-%d %H:%M:%S"),
        "resolved_time": a.resolved_time.strftime("%Y-%m-%d %H:%M:%S") if a.resolved_time else None,
        "related_part_no": a.related_part_no,
    }


def _note_to_dict(n) -> Dict[str, Any]:
    return {
        "id": n.id,
        "note_no": n.note_no,
        "pipeline_id": n.pipeline_id,
        "related_alarm_no": n.related_alarm_no,
        "related_part_no": n.related_part_no,
        "source": n.source.value,
        "operator": n.operator,
        "content": n.content,
        "created_at": n.created_at.strftime("%Y-%m-%d %H:%M:%S"),
    }


def _attr_to_dict(a) -> Dict[str, Any]:
    return {
        "id": a.id,
        "attr_no": a.attr_no,
        "pipeline_id": a.pipeline_id,
        "part_id": a.part_id,
        "alarm_id": a.alarm_id,
        "note_id": a.note_id,
        "status": a.status.value,
        "status_for_export": STATUS_EXPORT_MAPPING[a.status],
        "attribution_reason": a.attribution_reason,
        "pending_reason": a.pending_reason,
        "affected_records": a.affected_records,
        "operator": a.operator,
        "is_model_replace": a.is_model_replace,
        "created_at": a.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        "updated_at": a.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
    }


@app.get("/")
def root():
    return {
        "service": "工厂管线异常归因",
        "version": "1.0.0",
        "seed_info": getattr(app.state, "seed_info", None),
        "docs": "/docs",
    }


@app.get("/health", tags=["系统"])
def health():
    svc: PipelineAnomalyService = app.state.service
    ok, errs = svc.verify_status_consistency()
    return {
        "status": "ok",
        "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "status_consistency_ok": ok,
        "status_consistency_errors": errs,
    }


@app.get("/seed", tags=["系统"])
def get_seed_info():
    return {"seed_info": getattr(app.state, "seed_info", None)}


@app.post("/parts", tags=["备件清单"], response_model=Dict[str, Any])
def create_part(payload: SparePartIn):
    svc: PipelineAnomalyService = app.state.service
    try:
        part = svc.add_spare_part(
            part_no=payload.part_no, part_name=payload.part_name,
            part_model=payload.part_model, expected_model=payload.expected_model,
            quantity=payload.quantity, pipeline_id=payload.pipeline_id,
            status=payload.status,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _part_to_dict(part)


@app.get("/parts", tags=["备件清单"])
def list_parts():
    parts = SparePartRepo.list_all()
    return {"total": len(parts), "items": [_part_to_dict(p) for p in parts]}


@app.get("/parts/{part_no}", tags=["备件清单"])
def get_part(part_no: str):
    p = SparePartRepo.get_by_no(part_no)
    if not p:
        raise HTTPException(status_code=404, detail=f"备件 {part_no} 不存在")
    return _part_to_dict(p)


@app.post("/alarms", tags=["报警"], response_model=Dict[str, Any])
def create_alarm(payload: AlarmIn):
    svc: PipelineAnomalyService = app.state.service
    alarm = svc.add_alarm(
        pipeline_id=payload.pipeline_id, alarm_type=payload.alarm_type,
        alarm_desc=payload.alarm_desc, related_part_no=payload.related_part_no,
    )
    return _alarm_to_dict(alarm)


@app.get("/alarms", tags=["报警"])
def list_alarms():
    alarms = AlarmRepo.list_all()
    return {"total": len(alarms), "items": [_alarm_to_dict(a) for a in alarms]}


@app.post("/notes", tags=["人工备注"], response_model=Dict[str, Any])
def create_note(payload: ManualNoteIn):
    svc: PipelineAnomalyService = app.state.service
    note = svc.add_manual_note(
        pipeline_id=payload.pipeline_id, content=payload.content,
        operator=payload.operator, related_alarm_no=payload.related_alarm_no,
        related_part_no=payload.related_part_no, source=payload.source,
    )
    return _note_to_dict(note)


@app.get("/notes", tags=["人工备注"])
def list_notes(pipeline_id: Optional[str] = None):
    if pipeline_id:
        notes = ManualNoteRepo.list_by_pipeline(pipeline_id)
    else:
        notes = ManualNoteRepo.list_all()
    return {"total": len(notes), "items": [_note_to_dict(n) for n in notes]}


@app.post("/attributions/run", tags=["异常归因"])
def run_attribution(payload: AttributionRunIn):
    svc: PipelineAnomalyService = app.state.service
    try:
        attr = svc.run_attribution_main(
            part_no=payload.part_no, operator=payload.operator,
            alarm_no=payload.alarm_no, note_no=payload.note_no,
            attribution_reason=payload.attribution_reason,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _attr_to_dict(attr)


@app.post("/attributions/confirm", tags=["异常归因"])
def confirm_attribution(payload: AttributionConfirmIn):
    svc: PipelineAnomalyService = app.state.service
    try:
        attr = svc.confirm_attribution(
            attr_no=payload.attr_no, operator=payload.operator,
            final_status=payload.final_status, confirm_reason=payload.confirm_reason,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _attr_to_dict(attr)


@app.get("/attributions/details", tags=["异常归因"])
def attribution_details():
    svc: PipelineAnomalyService = app.state.service
    items = svc.query_attribution_details()
    return {"total": len(items), "items": items}


@app.get("/attributions/queue-export", tags=["异常归因"])
def export_queue():
    svc: PipelineAnomalyService = app.state.service
    rows = svc.export_anomaly_queue()
    return {"total": len(rows), "items": rows}


@app.get("/attributions/model-replace-pending", tags=["异常归因"])
def model_replace_pending():
    svc: PipelineAnomalyService = app.state.service
    items = svc.list_model_replace_pending()
    return {
        "total": len(items),
        "description": "备件型号替换进入待确认的记录（含待确认理由和受影响记录，不会直接归为正常）",
        "items": items,
    }


@app.get("/attributions/monthly-review", tags=["月底复核"])
def monthly_review():
    svc: PipelineAnomalyService = app.state.service
    groups = svc.monthly_review()
    out: Dict[str, Any] = {}
    for grp, details in groups.items():
        out[grp] = {
            "count": len(details),
            "items": [
                {
                    "attr_no": d.attr_no,
                    "pipeline_id": d.pipeline_id,
                    "status": d.status.value,
                    "status_for_export": d.status_for_export,
                    "attribution_reason": d.attribution_reason,
                    "pending_reason": d.pending_reason,
                    "affected_records": d.affected_records,
                    "part_no": d.part_no,
                    "part_name": d.part_name,
                    "part_model": d.part_model,
                    "expected_model": d.expected_model,
                    "part_status": d.part_status,
                    "alarm_no": d.alarm_no,
                    "note_no": d.note_no,
                    "note_content": d.note_content,
                    "note_operator": d.note_operator,
                    "operator": d.operator,
                    "created_at": d.created_at,
                }
                for d in details
            ],
        }
    return out


@app.get("/consistency", tags=["一致性校验"])
def consistency_check():
    svc: PipelineAnomalyService = app.state.service
    ok_status, status_errs = svc.verify_status_consistency()
    ok_persist, persist_errs = svc.verify_restart_persistence()
    return {
        "status_consistency": {
            "ok": ok_status,
            "errors": status_errs,
            "mapping_table": {k.value: v for k, v in STATUS_EXPORT_MAPPING.items()},
        },
        "persistence_consistency": {
            "ok": ok_persist,
            "errors": persist_errs,
            "description": "归因主表 ↔ 归因明细 ↔ 导出队列 三方一致性",
        },
    }
