from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel

from .database import create_db_and_tables, get_session
from .models import QARecord, OperationLog, CheckResult
from .checker import (
    import_qa_records,
    run_single_check,
    run_batch_check,
    update_gray_batch,
    manual_fix,
)

app = FastAPI(title="法律问答免责声明检查")

try:
    templates = Jinja2Templates(directory="src/templates")
except:
    templates = None


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


class ImportItem(BaseModel):
    question: str
    answer: str
    reference_url: Optional[str] = None
    desensitization_notes: Optional[str] = None


class ImportRequest(BaseModel):
    records: List[ImportItem]
    source_batch: str
    operator: str = "system"


class UpdateGrayRequest(BaseModel):
    gray_batch: str
    operator: str = "小乔"
    reason: Optional[str] = None


class ManualFixRequest(BaseModel):
    new_status: Optional[str] = None
    review_comment: Optional[str] = None
    next_action: Optional[str] = None
    operator: str
    reason: Optional[str] = None


@app.get("/api/records")
def list_records(status: Optional[str] = None, session: Session = Depends(get_session)):
    stmt = select(QARecord)
    if status:
        stmt = stmt.where(QARecord.status == status)
    records = session.exec(stmt.order_by(QARecord.id)).all()
    return {"records": [r.model_dump() for r in records]}


@app.get("/api/records/{record_id}")
def get_record(record_id: int, session: Session = Depends(get_session)):
    record = session.get(QARecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    logs = session.exec(
        select(OperationLog).where(OperationLog.qa_record_id == record_id).order_by(OperationLog.created_at)
    ).all()
    checks = session.exec(
        select(CheckResult).where(CheckResult.qa_record_id == record_id).order_by(CheckResult.checked_at)
    ).all()
    return {
        "record": record.model_dump(),
        "logs": [l.model_dump() for l in logs],
        "checks": [c.model_dump() for c in checks],
    }


@app.post("/api/import")
async def import_records(req: ImportRequest, session: Session = Depends(get_session)):
    records_data = [item.model_dump() for item in req.records]
    records = import_qa_records(session, records_data, req.source_batch, req.operator)
    return {"count": len(records), "records": [r.model_dump() for r in records]}


@app.post("/api/records/{record_id}/check")
async def check_record(record_id: int, operator: str = "system", session: Session = Depends(get_session)):
    record = session.get(QARecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    result = await run_single_check(session, record, operator=operator)
    return {"record": result.model_dump()}


@app.post("/api/check/batch")
async def check_batch(operator: str = "system", session: Session = Depends(get_session)):
    run_id = await run_batch_check(session, operator=operator)
    return {"run_id": run_id}


@app.post("/api/records/{record_id}/gray")
def set_gray_batch(record_id: int, req: UpdateGrayRequest, session: Session = Depends(get_session)):
    try:
        record = update_gray_batch(session, record_id, req.gray_batch, req.operator, req.reason)
        return {"record": record.model_dump()}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/records/{record_id}/fix")
def fix_record(record_id: int, req: ManualFixRequest, session: Session = Depends(get_session)):
    try:
        record = manual_fix(
            session,
            record_id,
            req.operator,
            new_status=req.new_status,
            review_comment=req.review_comment,
            next_action=req.next_action,
            reason=req.reason,
        )
        return {"record": record.model_dump()}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    if templates is None:
        return HTMLResponse(content="<h1>法律问答免责声明检查系统</h1><p>请安装模板目录后重试</p>")
    with Session(engine) as session:
        records = session.exec(select(QARecord).order_by(QARecord.id)).all()
        stats = {
            "total": len(records),
            "pending": len([r for r in records if r.status == "pending"]),
            "passed": len([r for r in records if r.status == "passed"]),
            "failed": len([r for r in records if r.status == "failed"]),
            "conflict": len([r for r in records if r.status == "conflict"]),
            "manual_fixed": len([r for r in records if r.status == "manual_fixed"]),
        }
    return templates.TemplateResponse("dashboard.html", {"request": request, "records": records, "stats": stats})
