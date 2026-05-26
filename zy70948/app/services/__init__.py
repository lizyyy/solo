import io
import csv
import json
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models import Batch, Record, RecordDetail, AuditLog, Settlement, SettlementItem
from app import schemas

logger = get_logger(__name__)


def _make_record_no() -> str:
    return f"REC-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"


def _log(db: Session, action: str, operator: str, detail: str,
         batch_id: Optional[int] = None, record_id: Optional[int] = None):
    db.add(AuditLog(
        batch_id=batch_id,
        record_id=record_id,
        action=action,
        detail=detail,
        operator=operator,
    ))
    db.commit()


# ===================== Batch =====================

def create_batch(db: Session, data: schemas.BatchCreate) -> Batch:
    batch = Batch(**data.model_dump())
    db.add(batch)
    db.commit()
    db.refresh(batch)
    _log(db, "create", batch.created_by,
         f"创建批次 {batch.batch_no}, 来源: {batch.source_type}",
         batch_id=batch.id)
    return batch


def list_batches(db: Session, status: Optional[str] = None,
                 source_type: Optional[str] = None,
                 skip: int = 0, limit: int = 100) -> (int, List[Batch]):
    q = db.query(Batch)
    if status:
        q = q.filter(Batch.status == status)
    if source_type:
        q = q.filter(Batch.source_type == source_type)
    total = q.count()
    items = q.order_by(Batch.created_at.desc()).offset(skip).limit(limit).all()
    return total, items


def get_batch(db: Session, batch_id: int) -> Optional[Batch]:
    return db.query(Batch).filter(Batch.id == batch_id).first()


def process_batch(db: Session, batch_id: int, data: schemas.BatchProcess) -> Optional[Batch]:
    batch = get_batch(db, batch_id)
    if not batch:
        return None
    batch.status = "processed"
    db.commit()
    db.refresh(batch)
    _log(db, "process", data.operator,
         f"处理批次 {batch.batch_no} ({data.remark or ''})",
         batch_id=batch.id)
    return batch


def return_batch(db: Session, batch_id: int, data: schemas.BatchReturn) -> Optional[Batch]:
    batch = get_batch(db, batch_id)
    if not batch:
        return None
    batch.status = "returned"
    db.commit()
    db.refresh(batch)
    _log(db, "return", data.operator,
         f"退回批次 {batch.batch_no}, 原因: {data.reason}",
         batch_id=batch.id)
    records = db.query(Record).filter(Record.batch_id == batch_id).all()
    for r in records:
        r.status = "returned"
        r.reason = data.reason
        r.processed_by = data.operator
        r.processed_at = datetime.utcnow()
        _log(db, "return", data.operator,
             f"退回记录 {r.record_no}, 原因: {data.reason}",
             batch_id=batch_id, record_id=r.id)
    db.commit()
    return batch


# ===================== Import =====================

def parse_add_item_csv(db: Session, batch: Batch, content: str, operator: str):
    reader = csv.DictReader(io.StringIO(content))
    count = 0
    for row in reader:
        rec = Record(
            batch_id=batch.id,
            record_no=_make_record_no(),
            patient_name=row.get("patient_name"),
            patient_id=row.get("patient_id"),
            unit_name=row.get("unit_name"),
            package_name=row.get("package_name"),
            contract_id=row.get("contract_id"),
            item_code=row.get("item_code"),
            item_name=row.get("item_name"),
            item_type="加项",
            unit_price=float(row["unit_price"]) if row.get("unit_price") else None,
            quantity=int(row["quantity"]) if row.get("quantity") else 1,
            total_amount=float(row["total_amount"]) if row.get("total_amount") else None,
            voucher_code=row.get("voucher_code"),
        )
        rec.total_amount = rec.total_amount or (rec.unit_price or 0) * (rec.quantity or 1)
        db.add(rec)
        db.flush()
        for k, v in row.items():
            if v is not None:
                db.add(RecordDetail(record_id=rec.id, field_key=k, field_value=str(v)))
        _log(db, "import", operator,
             f"导入加项记录 {rec.record_no} ({rec.item_name})",
             batch_id=batch.id, record_id=rec.id)
        count += 1
    db.commit()
    logger.info(f"批次 {batch.batch_no} 导入加项 CSV {count} 条")


def parse_package_json(db: Session, batch: Batch, data_obj: dict, operator: str):
    packages = data_obj if isinstance(data_obj, list) else data_obj.get("packages", [data_obj])
    count = 0
    for pkg in packages:
        for item in pkg.get("items", []):
            rec = Record(
                batch_id=batch.id,
                record_no=_make_record_no(),
                patient_name=pkg.get("patient_name"),
                patient_id=pkg.get("patient_id"),
                unit_name=pkg.get("unit_name"),
                package_name=pkg.get("package_name"),
                contract_id=pkg.get("contract_id"),
                item_code=item.get("item_code"),
                item_name=item.get("item_name"),
                item_type="套餐内项",
                unit_price=float(item["unit_price"]) if item.get("unit_price") else None,
                quantity=int(item.get("quantity", 1)),
                total_amount=float(item.get("total_amount", 0)),
            )
            rec.total_amount = rec.total_amount or (rec.unit_price or 0) * (rec.quantity or 1)
            db.add(rec)
            db.flush()
            for k, v in item.items():
                if v is not None:
                    db.add(RecordDetail(record_id=rec.id, field_key=k, field_value=str(v)))
            _log(db, "import", operator,
                 f"导入套餐记录 {rec.record_no} ({rec.item_name})",
                 batch_id=batch.id, record_id=rec.id)
            count += 1
    db.commit()
    logger.info(f"批次 {batch.batch_no} 导入套餐 JSON {count} 条")


def parse_unit_contract(db: Session, batch: Batch, data_obj: dict, operator: str):
    contracts = data_obj if isinstance(data_obj, list) else data_obj.get("contracts", [data_obj])
    count = 0
    for c in contracts:
        for item in c.get("items", []):
            rec = Record(
                batch_id=batch.id,
                record_no=_make_record_no(),
                patient_name=item.get("patient_name"),
                patient_id=item.get("patient_id"),
                unit_name=c.get("unit_name"),
                package_name=item.get("package_name"),
                contract_id=c.get("contract_id"),
                item_code=item.get("item_code"),
                item_name=item.get("item_name"),
                item_type="单位协议",
                unit_price=float(item["unit_price"]) if item.get("unit_price") else None,
                quantity=int(item.get("quantity", 1)),
                total_amount=float(item.get("total_amount", 0)),
            )
            rec.total_amount = rec.total_amount or (rec.unit_price or 0) * (rec.quantity or 1)
            db.add(rec)
            db.flush()
            for k, v in item.items():
                if v is not None:
                    db.add(RecordDetail(record_id=rec.id, field_key=k, field_value=str(v)))
            _log(db, "import", operator,
                 f"导入协议记录 {rec.record_no} ({rec.item_name})",
                 batch_id=batch.id, record_id=rec.id)
            count += 1
    db.commit()
    logger.info(f"批次 {batch.batch_no} 导入单位协议 {count} 条")


# ===================== Business Rules =====================

def apply_coupon_stack(db: Session, record: Record, coupon_amount: float, operator: str):
    """券叠加：同一记录多券合并，总优惠不得超过 total_amount"""
    if not record.coupon_stack:
        record.coupon_stack = True
        record.total_amount = (record.total_amount or 0) - coupon_amount
        if record.total_amount < 0:
            record.total_amount = 0
    reason = f"券叠加抵扣 {coupon_amount}"
    _log(db, "coupon", operator, reason, batch_id=record.batch_id, record_id=record.id)
    db.commit()


def apply_refund(db: Session, record: Record, refund_amount: float, operator: str, reason: str):
    """退项冲正"""
    record.refund_flag = True
    record.refund_amount = refund_amount
    record.total_amount = (record.total_amount or 0) - refund_amount
    if record.total_amount < 0:
        record.total_amount = 0
    record.reason = reason
    _log(db, "refund", operator, f"退项冲正 {refund_amount}, 原因: {reason}",
         batch_id=record.batch_id, record_id=record.id)
    db.commit()


def apply_unit_limit(db: Session, contract_id: str, operator: str, limit: float):
    """单位限额：按合同 ID 汇总，超出限额的记录标记"""
    records = db.query(Record).filter(Record.contract_id == contract_id).all()
    total = sum((r.total_amount or 0) for r in records)
    if total > limit:
        overflow = total - limit
        for r in sorted(records, key=lambda x: x.total_amount or 0, reverse=True):
            if overflow <= 0:
                break
            cut = min((r.total_amount or 0), overflow)
            r.total_amount = (r.total_amount or 0) - cut
            r.unit_limit_applied = True
            r.unit_limit_amount = cut
            overflow -= cut
            _log(db, "unit_limit", operator,
                 f"单位限额 {contract_id} 削减 {cut}, 限额 {limit}",
                 batch_id=r.batch_id, record_id=r.id)
    db.commit()


# ===================== Record =====================

def list_records(db: Session, batch_id: Optional[int] = None,
                 unit_name: Optional[str] = None,
                 contract_id: Optional[str] = None,
                 status: Optional[str] = None,
                 skip: int = 0, limit: int = 100) -> (int, List[Record]):
    q = db.query(Record)
    if batch_id:
        q = q.filter(Record.batch_id == batch_id)
    if unit_name:
        q = q.filter(Record.unit_name == unit_name)
    if contract_id:
        q = q.filter(Record.contract_id == contract_id)
    if status:
        q = q.filter(Record.status == status)
    total = q.count()
    items = q.order_by(Record.created_at.desc()).offset(skip).limit(limit).all()
    return total, items


def get_record(db: Session, record_id: int) -> Optional[Record]:
    return db.query(Record).filter(Record.id == record_id).first()


def process_record(db: Session, record_id: int, data: schemas.RecordProcess) -> Optional[Record]:
    rec = get_record(db, record_id)
    if not rec:
        return None
    rec.status = "approved" if data.approved else "returned"
    rec.processed_by = data.operator
    rec.processed_at = datetime.utcnow()
    if data.reason:
        rec.reason = data.reason
    db.commit()
    db.refresh(rec)
    _log(db, "process", data.operator,
         f"{'放行' if data.approved else '退回'}记录 {rec.record_no}, 原因: {data.reason or ''}",
         batch_id=rec.batch_id, record_id=rec.id)
    return rec


def return_record(db: Session, record_id: int, data: schemas.RecordReturn) -> Optional[Record]:
    rec = get_record(db, record_id)
    if not rec:
        return None
    rec.status = "returned"
    rec.processed_by = data.operator
    rec.processed_at = datetime.utcnow()
    rec.reason = data.reason
    db.commit()
    db.refresh(rec)
    _log(db, "return", data.operator,
         f"退回记录 {rec.record_no}, 原因: {data.reason}",
         batch_id=rec.batch_id, record_id=rec.id)
    return rec


# ===================== Export =====================

def export_records_csv(db: Session, batch_id: Optional[int] = None,
                       unit_name: Optional[str] = None,
                       contract_id: Optional[str] = None,
                       status: Optional[str] = None) -> str:
    q = db.query(Record)
    if batch_id:
        q = q.filter(Record.batch_id == batch_id)
    if unit_name:
        q = q.filter(Record.unit_name == unit_name)
    if contract_id:
        q = q.filter(Record.contract_id == contract_id)
    if status:
        q = q.filter(Record.status == status)
    records = q.order_by(Record.created_at.desc()).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "record_no", "patient_name", "patient_id", "unit_name",
        "package_name", "contract_id", "item_code", "item_name",
        "item_type", "unit_price", "quantity", "total_amount",
        "voucher_code", "coupon_stack", "refund_flag", "refund_amount",
        "unit_limit_applied", "unit_limit_amount", "status",
        "reason", "processed_by", "processed_at", "created_at"
    ])
    for r in records:
        writer.writerow([
            r.record_no, r.patient_name, r.patient_id, r.unit_name,
            r.package_name, r.contract_id, r.item_code, r.item_name,
            r.item_type, r.unit_price, r.quantity, r.total_amount,
            r.voucher_code, r.coupon_stack, r.refund_flag, r.refund_amount,
            r.unit_limit_applied, r.unit_limit_amount, r.status,
            r.reason, r.processed_by,
            r.processed_at.isoformat() if r.processed_at else "",
            r.created_at.isoformat()
        ])
    return buf.getvalue()


# ===================== Audit Log =====================

def list_logs(db: Session, batch_id: Optional[int] = None,
              record_id: Optional[int] = None,
              skip: int = 0, limit: int = 200) -> (int, List[AuditLog]):
    q = db.query(AuditLog)
    if batch_id:
        q = q.filter(AuditLog.batch_id == batch_id)
    if record_id:
        q = q.filter(AuditLog.record_id == record_id)
    total = q.count()
    items = q.order_by(AuditLog.operated_at.desc()).offset(skip).limit(limit).all()
    return total, items


# ===================== Settlement =====================

def create_settlement(db: Session, data: schemas.SettlementCreate) -> Settlement:
    s = Settlement(
        settlement_no=data.settlement_no,
        batch_id=data.batch_id,
        contract_id=data.contract_id,
        unit_name=data.unit_name,
        total_amount=data.total_amount,
        created_by=data.created_by,
    )
    db.add(s)
    db.flush()
    for rid in data.record_ids:
        rec = db.query(Record).filter(Record.id == rid).first()
        if rec:
            db.add(SettlementItem(
                settlement_id=s.id,
                record_id=rid,
                amount=rec.total_amount or 0,
            ))
    db.commit()
    db.refresh(s)
    _log(db, "settlement", data.created_by,
         f"创建结算清单 {s.settlement_no}, 合计 {s.total_amount}",
         batch_id=s.batch_id)
    return s


def list_settlements(db: Session, batch_id: Optional[int] = None,
                     contract_id: Optional[str] = None,
                     unit_name: Optional[str] = None,
                     skip: int = 0, limit: int = 100) -> (int, List[Settlement]):
    q = db.query(Settlement)
    if batch_id:
        q = q.filter(Settlement.batch_id == batch_id)
    if contract_id:
        q = q.filter(Settlement.contract_id == contract_id)
    if unit_name:
        q = q.filter(Settlement.unit_name == unit_name)
    total = q.count()
    items = q.order_by(Settlement.created_at.desc()).offset(skip).limit(limit).all()
    return total, items


def get_settlement(db: Session, settlement_id: int) -> Optional[Settlement]:
    return db.query(Settlement).filter(Settlement.id == settlement_id).first()


def confirm_settlement(db: Session, settlement_id: int,
                       data: schemas.SettlementConfirm) -> Optional[Settlement]:
    s = get_settlement(db, settlement_id)
    if not s:
        return None
    s.status = "confirmed"
    s.confirmed_by = data.operator
    s.confirmed_at = datetime.utcnow()
    db.commit()
    db.refresh(s)
    _log(db, "confirm", data.operator,
         f"确认结算清单 {s.settlement_no}",
         batch_id=s.batch_id)
    return s


def trace_settlement(db: Session, settlement_id: int) -> Optional[Dict[str, Any]]:
    s = get_settlement(db, settlement_id)
    if not s:
        return None
    batch = db.query(Batch).filter(Batch.id == s.batch_id).first()
    record_ids = [si.record_id for si in s.items]
    logs = []
    if record_ids:
        logs = db.query(AuditLog).filter(AuditLog.record_id.in_(record_ids)) \
            .order_by(AuditLog.operated_at.desc()).all()
    return {
        "settlement": s,
        "trace_logs": logs,
        "source_batch": batch,
    }
