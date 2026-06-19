from urllib.parse import quote
import json
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Request, Form, Body
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from typing import Optional, List, Any, Union
from pydantic import BaseModel
import io

from . import models, schemas
from .database import engine, get_db, Base
from .crud import (
    get_all_batches, get_batch, get_unified_record_data,
    get_record_audit_logs, update_record, mark_manager_reviewed,
    resolve_duplicate, get_batch_audit_logs
)
from .workflow import (
    import_clearing_batch, review_holiday_adjustment,
    get_workflow_status, can_proceed_to_balance_update
)
from .self_check import run_self_check, get_check_history
from .balance import (
    update_balance_for_batch, get_balance_changes, get_balance_summary
)
from .export import export_to_excel, export_to_csv, verify_export_consistency

Base.metadata.create_all(bind=engine)

app = FastAPI(title="基金销售尾佣拆分系统")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


class HolidayReviewBody(BaseModel):
    reviewed_by: Optional[str] = "老秦"
    adjustments: Optional[List[dict]] = None


@app.post("/api/batches/import", response_model=schemas.ImportResult)
async def import_batch(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    request: Request = None
):
    final_batch_number = None
    final_imported_by = None

    query_params = request.query_params
    if "batch_number" in query_params:
        final_batch_number = query_params.get("batch_number")
    if "imported_by" in query_params:
        final_imported_by = query_params.get("imported_by")

    form = None
    try:
        form = await request.form()
    except Exception:
        form = None

    if form is not None:
        if ("batch_number" in form) and (not final_batch_number):
            final_batch_number = form.get("batch_number")
        if ("imported_by" in form) and (not final_imported_by):
            final_imported_by = form.get("imported_by")

    final_imported_by = final_imported_by or "system"

    if not final_batch_number:
        raise HTTPException(status_code=400, detail="缺少批次号 batch_number")

    content = await file.read()
    try:
        result = import_clearing_batch(db, final_batch_number, content, final_imported_by)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")


@app.get("/api/batches", response_model=List[schemas.ClearingBatch])
async def list_batches(db: Session = Depends(get_db)):
    return get_all_batches(db)


@app.get("/api/batches/{batch_id}", response_model=schemas.ClearingBatch)
async def get_batch_detail(batch_id: int, db: Session = Depends(get_db)):
    batch = get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch


@app.get("/api/batches/{batch_id}/records")
async def get_batch_records_api(batch_id: int, db: Session = Depends(get_db)):
    records = get_unified_record_data(db, batch_id)
    return {"batch_id": batch_id, "records": records}


@app.get("/api/batches/{batch_id}/workflow", response_model=schemas.WorkflowStatus)
async def get_batch_workflow(batch_id: int, db: Session = Depends(get_db)):
    return get_workflow_status(db, batch_id)


@app.post("/api/batches/{batch_id}/holiday-review")
async def holiday_review(
    batch_id: int,
    reviewed_by_q: Optional[str] = None,
    db: Session = Depends(get_db),
    request: Request = None
):
    final_reviewed_by = reviewed_by_q
    final_adjustments = None

    if "reviewed_by" in request.query_params and (not final_reviewed_by):
        final_reviewed_by = request.query_params.get("reviewed_by")

    raw_body = None
    try:
        raw_body = await request.body()
    except Exception:
        raw_body = None

    if raw_body:
        try:
            parsed = json.loads(raw_body.decode("utf-8"))
            if isinstance(parsed, list):
                final_adjustments = parsed
            elif isinstance(parsed, dict):
                if "adjustments" in parsed and isinstance(parsed["adjustments"], list):
                    final_adjustments = parsed["adjustments"]
                if "reviewed_by" in parsed and not final_reviewed_by:
                    final_reviewed_by = parsed["reviewed_by"]
        except Exception:
            pass

    final_reviewed_by = final_reviewed_by or "老秦"

    result = review_holiday_adjustment(db, batch_id, final_reviewed_by, final_adjustments)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result


@app.get("/api/batches/{batch_id}/can-balance-update")
async def check_can_balance_update(batch_id: int, db: Session = Depends(get_db)):
    return can_proceed_to_balance_update(db, batch_id)


@app.post("/api/batches/{batch_id}/balance-update")
async def balance_update(
    batch_id: int,
    performed_by: str = "system",
    db: Session = Depends(get_db)
):
    check = can_proceed_to_balance_update(db, batch_id)
    if not check.get("can_proceed"):
        raise HTTPException(
            status_code=400,
            detail=f"无法更新余额: {'; '.join(check.get('issues', []))}"
        )
    result = update_balance_for_batch(db, batch_id, performed_by)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result


@app.get("/api/batches/{batch_id}/self-check", response_model=schemas.SelfCheckReport)
async def run_self_check_api(batch_id: int, db: Session = Depends(get_db)):
    return run_self_check(db, batch_id)


@app.get("/api/batches/{batch_id}/self-check/history")
async def get_self_check_history(batch_id: int, db: Session = Depends(get_db)):
    history = get_check_history(db, batch_id)
    return {"batch_id": batch_id, "history": history}


@app.get("/api/batches/{batch_id}/export/excel")
async def export_excel(batch_id: int, db: Session = Depends(get_db)):
    content = export_to_excel(db, batch_id)
    fn = quote(f"尾佣拆分_{batch_id}.xlsx")
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{fn}"}
    )


@app.get("/api/batches/{batch_id}/export/csv")
async def export_csv(batch_id: int, db: Session = Depends(get_db)):
    content = export_to_csv(db, batch_id)
    fn = quote(f"尾佣拆分_{batch_id}.csv")
    return StreamingResponse(
        iter([content]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{fn}"}
    )


@app.get("/api/batches/{batch_id}/export/verify")
async def verify_export(batch_id: int, db: Session = Depends(get_db)):
    return verify_export_consistency(db, batch_id)


@app.get("/api/batches/{batch_id}/audit")
async def get_batch_audit(batch_id: int, db: Session = Depends(get_db)):
    logs = get_batch_audit_logs(db, batch_id)
    return {"batch_id": batch_id, "audit_logs": logs}


@app.get("/api/records/{record_id}/audit")
async def get_record_audit(record_id: int, db: Session = Depends(get_db)):
    logs = get_record_audit_logs(db, record_id)
    return {"record_id": record_id, "audit_logs": logs}


@app.put("/api/records/{record_id}")
async def update_record_api(
    record_id: int,
    update_data: schemas.CommissionRecordUpdate,
    performed_by: str = "system",
    db: Session = Depends(get_db)
):
    record = update_record(db, record_id, update_data, performed_by)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return {"success": True, "record": record}


@app.post("/api/records/{record_id}/manager-review")
async def manager_review(
    record_id: int,
    reviewed_by: str,
    approved: bool = True,
    db: Session = Depends(get_db)
):
    record = mark_manager_reviewed(db, record_id, reviewed_by, approved)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return {"success": True, "record": record}


@app.post("/api/records/{record_id}/resolve-duplicate")
async def resolve_duplicate_api(
    record_id: int,
    action: str,
    resolved_by: str = "system",
    db: Session = Depends(get_db)
):
    if action not in ("skip", "keep"):
        raise HTTPException(status_code=400, detail="action 必须为 skip 或 keep")
    record = resolve_duplicate(db, record_id, action, resolved_by)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在或不是重复记录")
    return {"success": True, "record_id": record_id, "action": action}


@app.get("/api/balance-changes")
async def list_balance_changes(
    manager_code: Optional[str] = None,
    batch_id: Optional[int] = None,
    include_pending: bool = True,
    db: Session = Depends(get_db)
):
    changes = get_balance_changes(db, manager_code, batch_id, include_pending)
    return {"changes": changes, "total": len(changes)}


@app.get("/api/balance-summary")
async def balance_summary(db: Session = Depends(get_db)):
    summary = get_balance_summary(db)
    return {"summary": summary}
