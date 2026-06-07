"""FastAPI 服务层"""
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .storage import JsonStorage
from .engine import CitationReviewEngine
from .importer import TicketImporter
from .models import (
    FeedbackTicket, DesensitizationNote, ReviewRecord,
    ReviewReport, DuplicateGroup, ReviewStatus
)

app = FastAPI(title="学术摘要引用复核 API", version="0.1.0")

DATA_DIR = "./data"


def get_engine():
    storage = JsonStorage(DATA_DIR)
    engine = CitationReviewEngine(storage)
    return engine, storage


class ImportRequest(BaseModel):
    tickets: List[dict]


class NoteRequest(BaseModel):
    ticket_id: str
    rule: str
    context: Optional[str] = None


@app.get("/")
def root():
    return {"message": "学术摘要引用复核系统 API", "version": "0.1.0"}


@app.post("/tickets/import", response_model=List[FeedbackTicket])
def import_tickets(req: ImportRequest):
    """批量导入工单"""
    import json
    import tempfile
    import os
    from datetime import datetime

    _, storage = get_engine()
    importer = TicketImporter(storage)

    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
        json.dump(req.tickets, f, ensure_ascii=False, default=str)
        tmp_path = f.name

    try:
        tickets = importer.from_json(tmp_path)
    finally:
        os.unlink(tmp_path)

    return tickets


@app.get("/tickets", response_model=List[FeedbackTicket])
def list_tickets():
    """列出所有工单"""
    _, storage = get_engine()
    return storage.list_tickets()


@app.get("/tickets/{ticket_id}", response_model=FeedbackTicket)
def get_ticket(ticket_id: str):
    """获取单条工单"""
    _, storage = get_engine()
    t = storage.get_ticket(ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="工单不存在")
    return t


@app.post("/review/run", response_model=List[ReviewRecord])
def run_review():
    """执行复核流程"""
    engine, _ = get_engine()
    return engine.run_review()


@app.get("/review/records", response_model=List[ReviewRecord])
def list_review_records(status: Optional[ReviewStatus] = None):
    """列出复核记录"""
    _, storage = get_engine()
    records = storage.list_reviews()
    if status:
        records = [r for r in records if r.status == status]
    return records


@app.get("/review/records/{ticket_id}", response_model=ReviewRecord)
def get_review_record(ticket_id: str):
    """获取单条工单的复核记录"""
    _, storage = get_engine()
    r = storage.get_review_for_ticket(ticket_id)
    if not r:
        raise HTTPException(status_code=404, detail="复核记录不存在")
    return r


@app.get("/review/groups", response_model=List[DuplicateGroup])
def list_duplicate_groups():
    """列出重复工单分组"""
    _, storage = get_engine()
    return storage.list_groups()


@app.post("/notes", response_model=DesensitizationNote)
def add_note(req: NoteRequest):
    """阿宁补录脱敏规则备注"""
    _, storage = get_engine()
    importer = TicketImporter(storage)
    note = importer.add_desensitization_note(req.ticket_id, req.rule, req.context)

    engine, _ = get_engine()
    engine.update_evidence_with_note(req.ticket_id)

    return note


@app.get("/notes/{ticket_id}", response_model=Optional[DesensitizationNote])
def get_note(ticket_id: str):
    """获取工单的脱敏备注"""
    _, storage = get_engine()
    return storage.get_note_for_ticket(ticket_id)


@app.get("/report", response_model=ReviewReport)
def generate_report():
    """生成复核报告"""
    engine, _ = get_engine()
    return engine.generate_report()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
