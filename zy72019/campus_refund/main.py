from fastapi import FastAPI, Query
from typing import Optional
from contextlib import asynccontextmanager
from database import init_db
from models import (
    PaymentRecord, RefundApplication, ApprovalRecord, ManualNote,
    BatchCreate, BatchConfirm, ReconciliationEntry, ConflictResolution,
    RefundStatusUpdate, ExportRequest,
)
from service import (
    PaymentService, RefundService, ApprovalService, NoteService,
    BatchService, ReconciliationService, ConflictService, ExportService,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="校园一卡通退款清算系统",
    description="为结算会计阿宁设计的本地退款清算系统——批次、状态、人工确认和导出报告读同一份本地数据",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/", tags=["系统"])
def root():
    return {
        "系统": "校园一卡通退款清算",
        "版本": "1.0.0",
        "说明": "所有数据存储在本地SQLite，重启服务后历史数据不丢失",
        "核心原则": "月底对账表与清算数据冲突时不替用户拍板，把两边证据和建议动作摆出来",
    }


@app.post("/payments/import", tags=["收款流水"])
def import_payments(records: list[PaymentRecord], strategy: str = Query("conflict", description="重复策略: skip/update/conflict")):
    return PaymentService.import_payments(records, strategy)


@app.get("/payments", tags=["收款流水"])
def list_payments(transaction_id: Optional[str] = None, card_no: Optional[str] = None):
    return PaymentService.list_payments(transaction_id, card_no)


@app.post("/refunds/import", tags=["退款申请"])
def import_refunds(records: list[RefundApplication], strategy: str = Query("conflict", description="重复策略: skip/update/conflict")):
    return RefundService.import_refunds(records, strategy)


@app.get("/refunds", tags=["退款申请"])
def list_refunds(application_no: Optional[str] = None, status: Optional[str] = None, card_no: Optional[str] = None):
    return RefundService.list_refunds(application_no, status, card_no)


@app.put("/refunds/{application_no}/status", tags=["退款申请"])
def update_refund_status(application_no: str, update: RefundStatusUpdate):
    return RefundService.update_status(application_no, update)


@app.post("/approvals/import", tags=["审批记录"])
def import_approvals(records: list[ApprovalRecord]):
    return ApprovalService.import_approvals(records)


@app.get("/approvals", tags=["审批记录"])
def list_approvals(application_no: Optional[str] = None):
    return ApprovalService.list_approvals(application_no)


@app.post("/notes", tags=["人工备注"])
def add_note(note: ManualNote):
    return NoteService.add_note(note)


@app.get("/notes", tags=["人工备注"])
def list_notes(application_no: Optional[str] = None):
    return NoteService.list_notes(application_no)


@app.post("/batches", tags=["批次管理"])
def create_batch(batch: BatchCreate):
    return BatchService.create_batch(batch)


@app.post("/batches/{batch_no}/submit", tags=["批次管理"])
def submit_batch(batch_no: str):
    return BatchService.submit_batch(batch_no)


@app.post("/batches/{batch_no}/confirm", tags=["批次管理"])
def confirm_batch(batch_no: str, confirm: BatchConfirm):
    return BatchService.confirm_batch(batch_no, confirm)


@app.post("/batches/{batch_no}/export", tags=["批次管理"])
def mark_batch_exported(batch_no: str):
    return BatchService.mark_exported(batch_no)


@app.get("/batches", tags=["批次管理"])
def list_batches(status: Optional[str] = None):
    return BatchService.list_batches(status)


@app.get("/batches/{batch_no}", tags=["批次管理"])
def get_batch_detail(batch_no: str):
    return BatchService.get_batch_detail(batch_no)


@app.post("/reconciliation/import", tags=["月底对账"])
def import_reconciliation(entries: list[ReconciliationEntry], strategy: str = Query("conflict", description="重复策略: skip/update/conflict")):
    return ReconciliationService.import_reconciliation(entries, strategy)


@app.get("/reconciliation", tags=["月底对账"])
def list_reconciliation(period: Optional[str] = None):
    return ReconciliationService.list_reconciliation(period)


@app.get("/reconciliation/consistency", tags=["月底对账"])
def check_consistency(period: Optional[str] = None):
    return ReconciliationService.check_consistency(period)


@app.get("/conflicts", tags=["冲突处理"])
def list_conflicts(status: Optional[str] = None):
    return ConflictService.list_conflicts(status)


@app.post("/conflicts/{conflict_id}/resolve", tags=["冲突处理"])
def resolve_conflict(conflict_id: int, resolution: ConflictResolution):
    resolution.conflict_id = conflict_id
    return ConflictService.resolve_conflict(resolution)


@app.post("/export", tags=["导出报告"])
def export_report(req: ExportRequest):
    return ExportService.export_report(req)
