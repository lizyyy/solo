import hashlib
import json
import uuid
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from database import (
    CollateralBatch, CollateralRecord, StatusHistory,
    ManualNote, ExportSnapshot
)

EXCEPTION_CODES = {
    "E001": {
        "description": "质押品代码不存在或无效",
        "suggestion": "请核对质押品代码是否正确，或联系数据维护组更新基础信息"
    },
    "E002": {
        "description": "市值为0或负数",
        "suggestion": "请检查数据源，确认市值字段是否正确导入"
    },
    "E003": {
        "description": "折扣率超出正常范围(0-1)",
        "suggestion": "请核对折扣率配置，股票一般0.3-0.7，债券一般0.6-0.9"
    },
    "E004": {
        "description": "计算值与人工值差异超过阈值(>10%)",
        "suggestion": "请复核人工调整的合理性，差异过大需注明详细原因"
    },
    "E005": {
        "description": "质押品类型未配置折扣规则",
        "suggestion": "请联系风控参数组添加该质押品类型的折扣规则"
    },
    "E006": {
        "description": "重复记录（同一批次内质押品代码重复）",
        "suggestion": "请清理重复数据后重新导入，保留最新一条即可"
    },
    "E007": {
        "description": "缺少关键字段",
        "suggestion": "请检查导入文件，确保质押品代码、市值、折扣率字段完整"
    },
    "E008": {
        "description": "人工备注后系统重算覆盖风险",
        "suggestion": "该记录已有备注，重算前请确认是否需要保留原有人工结论"
    }
}


def generate_record_key(batch_id: str, collateral_code: str) -> str:
    return f"{batch_id}_{collateral_code}"


def generate_batch_id(batch_date: str, source_file: str) -> str:
    content = f"{batch_date}_{source_file}"
    hash_suffix = hashlib.md5(content.encode()).hexdigest()[:8]
    return f"BATCH_{batch_date}_{hash_suffix.upper()}"


def calculate_discount(market_value: float, discount_rate: float) -> float:
    return round(market_value * discount_rate, 2)


def validate_record(row: Dict) -> Tuple[bool, Optional[str], Optional[str]]:
    collateral_code = str(row.get("collateral_code", "")).strip()
    if not collateral_code:
        return False, "E007", EXCEPTION_CODES["E007"]["description"]

    market_value = float(row.get("market_value", 0) or 0)
    if market_value <= 0:
        return False, "E002", EXCEPTION_CODES["E002"]["description"]

    discount_rate = float(row.get("discount_rate", 0) or 0)
    if discount_rate <= 0 or discount_rate > 1:
        return False, "E003", EXCEPTION_CODES["E003"]["description"]

    collateral_type = str(row.get("collateral_type", "")).strip()
    valid_types = {"股票", "债券", "基金", "存单", "票据"}
    if collateral_type and collateral_type not in valid_types:
        return False, "E005", EXCEPTION_CODES["E005"]["description"]

    return True, None, None


def add_status_history(
    db: Session,
    record_key: str,
    batch_id: str,
    version: int,
    old_status: Optional[str],
    new_status: str,
    old_discount: Optional[float],
    new_discount: float,
    change_reason: str,
    operator: str,
    operation_type: str,
    remark: str = ""
):
    history = StatusHistory(
        record_key=record_key,
        batch_id=batch_id,
        version=version,
        old_status=old_status,
        new_status=new_status,
        old_discount=old_discount,
        new_discount=new_discount,
        change_reason=change_reason,
        operator=operator,
        operation_type=operation_type,
        remark=remark
    )
    db.add(history)


def process_batch(
    db: Session,
    batch_date: str,
    source_file: str,
    records: List[Dict],
    operator: str = "system"
) -> Dict:
    batch_id = generate_batch_id(batch_date, source_file)

    existing_batch = db.query(CollateralBatch).filter(
        CollateralBatch.batch_id == batch_id
    ).first()

    is_reprocess = existing_batch is not None

    if is_reprocess:
        existing_batch.status = "reprocessing"
        existing_batch.source_file = source_file
        existing_batch.remark = f"重跑于 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        db.flush()
    else:
        batch = CollateralBatch(
            batch_id=batch_id,
            batch_date=batch_date,
            source_file=source_file,
            total_records=len(records),
            status="processing",
            processed_by=operator
        )
        db.add(batch)
        db.flush()

    success_count = 0
    exception_count = 0
    seen_codes = set()

    for row in records:
        collateral_code = str(row.get("collateral_code", "")).strip()

        if collateral_code in seen_codes:
            record_key = generate_record_key(batch_id, collateral_code + "_dup")
            is_valid, exc_code, exc_msg = False, "E006", EXCEPTION_CODES["E006"]["description"]
        else:
            seen_codes.add(collateral_code)
            record_key = generate_record_key(batch_id, collateral_code)
            is_valid, exc_code, exc_msg = validate_record(row)

        market_value = float(row.get("market_value", 0) or 0)
        discount_rate = float(row.get("discount_rate", 0) or 0)
        calculated_discount = calculate_discount(market_value, discount_rate) if is_valid else 0
        final_discount = calculated_discount

        existing_record = db.query(CollateralRecord).filter(
            CollateralRecord.record_key == record_key
        ).first()

        if existing_record:
            old_status = existing_record.status
            old_discount = existing_record.final_discount
            old_version = existing_record.current_version

            if existing_record.has_manual_note:
                is_valid = False
                exc_code = "E008"
                exc_msg = EXCEPTION_CODES["E008"]["description"]
                final_discount = old_discount
                status = "manual_override"
            else:
                status = "success" if is_valid else "exception"

            existing_record.market_value = market_value
            existing_record.face_value = float(row.get("face_value", 0) or 0)
            existing_record.discount_rate = discount_rate
            existing_record.calculated_discount = calculated_discount
            existing_record.final_discount = final_discount
            existing_record.status = status
            existing_record.is_exception = not is_valid
            existing_record.exception_code = exc_code
            existing_record.exception_msg = exc_msg
            existing_record.exception_suggestion = EXCEPTION_CODES[exc_code]["suggestion"] if exc_code else None
            existing_record.current_version = old_version + 1
            existing_record.updated_at = datetime.now()

            add_status_history(
                db, record_key, batch_id, old_version + 1,
                old_status, status, old_discount, final_discount,
                "批次重跑更新", operator, "reprocess",
                f"原值: {old_discount}, 新值: {final_discount}"
            )
        else:
            status = "success" if is_valid else "exception"
            record = CollateralRecord(
                record_key=record_key,
                batch_id=batch_id,
                collateral_code=collateral_code,
                collateral_name=str(row.get("collateral_name", "")).strip() or None,
                collateral_type=str(row.get("collateral_type", "")).strip() or None,
                market_value=market_value,
                face_value=float(row.get("face_value", 0) or 0),
                discount_rate=discount_rate,
                calculated_discount=calculated_discount,
                final_discount=final_discount,
                status=status,
                is_exception=not is_valid,
                exception_code=exc_code,
                exception_msg=exc_msg,
                exception_suggestion=EXCEPTION_CODES[exc_code]["suggestion"] if exc_code else None,
                current_version=1,
                has_manual_note=False
            )
            db.add(record)

            add_status_history(
                db, record_key, batch_id, 1,
                None, status, None, final_discount,
                "初始导入计算", operator, "import",
                ""
            )

        if is_valid:
            success_count += 1
        else:
            exception_count += 1

    if is_reprocess:
        existing_batch.total_records = len(records)
        existing_batch.success_count = success_count
        existing_batch.exception_count = exception_count
        existing_batch.status = "completed"
        existing_batch.updated_at = datetime.now()
    else:
        batch.total_records = len(records)
        batch.success_count = success_count
        batch.exception_count = exception_count
        batch.status = "completed"

    db.commit()

    return {
        "batch_id": batch_id,
        "total_records": len(records),
        "success_count": success_count,
        "exception_count": exception_count,
        "status": "completed",
        "is_reprocess": is_reprocess,
        "message": f"批次{'重跑' if is_reprocess else '处理'}完成，成功{success_count}条，异常{exception_count}条"
    }


def add_manual_note(
    db: Session,
    record_key: str,
    batch_id: str,
    note_content: str,
    operator: str,
    new_final_discount: Optional[float] = None,
    new_status: Optional[str] = None
) -> Dict:
    record = db.query(CollateralRecord).filter(
        CollateralRecord.record_key == record_key
    ).first()

    if not record:
        return {"error": "记录不存在"}

    old_notes = db.query(ManualNote).filter(
        ManualNote.record_key == record_key,
        ManualNote.overridden == False
    ).all()

    for old_note in old_notes:
        old_note.overridden = True
        old_note.overridden_by = operator
        old_note.overridden_at = datetime.now()

    note = ManualNote(
        record_key=record_key,
        batch_id=batch_id,
        note_content=note_content,
        operator=operator
    )
    db.add(note)

    old_status = record.status
    old_discount = record.final_discount
    old_version = record.current_version

    record.has_manual_note = True
    record.latest_note = note_content
    record.current_version = old_version + 1
    record.updated_at = datetime.now()

    if new_final_discount is not None:
        record.final_discount = new_final_discount
    if new_status:
        record.status = new_status

    if record.is_exception:
        record.is_exception = False
        record.exception_code = None
        record.exception_msg = None
        record.exception_suggestion = None

    add_status_history(
        db, record_key, batch_id, old_version + 1,
        old_status, record.status, old_discount, record.final_discount,
        note_content, operator, "manual_note",
        f"原值: {old_discount}, 新值: {record.final_discount}"
    )

    db.commit()

    return {
        "id": note.id,
        "record_key": record_key,
        "note_content": note_content,
        "operator": operator,
        "overridden": False,
        "created_at": note.created_at
    }


def get_record_history(db: Session, record_key: str) -> List[Dict]:
    history = db.query(StatusHistory).filter(
        StatusHistory.record_key == record_key
    ).order_by(StatusHistory.version).all()

    return [
        {
            "version": h.version,
            "old_status": h.old_status,
            "new_status": h.new_status,
            "old_discount": h.old_discount,
            "new_discount": h.new_discount,
            "change_reason": h.change_reason,
            "operator": h.operator,
            "operation_type": h.operation_type,
            "remark": h.remark,
            "created_at": h.created_at
        }
        for h in history
    ]


def get_record_notes(db: Session, record_key: str) -> List[Dict]:
    notes = db.query(ManualNote).filter(
        ManualNote.record_key == record_key
    ).order_by(ManualNote.created_at.desc()).all()

    return [
        {
            "id": n.id,
            "note_content": n.note_content,
            "operator": n.operator,
            "overridden": n.overridden,
            "overridden_by": n.overridden_by,
            "overridden_at": n.overridden_at,
            "created_at": n.created_at
        }
        for n in notes
    ]


def calculate_export_hash(records: List[Dict]) -> str:
    content = json.dumps(records, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(content.encode()).hexdigest()


def prepare_export_data(db: Session, batch_id: str) -> Tuple[List[Dict], str]:
    records = db.query(CollateralRecord).filter(
        CollateralRecord.batch_id == batch_id
    ).order_by(CollateralRecord.collateral_code).all()

    export_data = []
    for r in records:
        export_data.append({
            "批次号": batch_id,
            "质押品代码": r.collateral_code,
            "质押品名称": r.collateral_name or "",
            "质押品类型": r.collateral_type or "",
            "市值": r.market_value,
            "面值": r.face_value,
            "折扣率": r.discount_rate,
            "系统计算值": r.calculated_discount,
            "最终折扣值": r.final_discount,
            "状态": r.status,
            "是否异常": "是" if r.is_exception else "否",
            "异常代码": r.exception_code or "",
            "异常说明": r.exception_msg or "",
            "处理建议": r.exception_suggestion or "",
            "是否有人工备注": "是" if r.has_manual_note else "否",
            "最新备注": r.latest_note or "",
            "当前版本": r.current_version,
            "更新时间": r.updated_at.strftime("%Y-%m-%d %H:%M:%S")
        })

    export_hash = calculate_export_hash(export_data)
    return export_data, export_hash


def create_export_snapshot(
    db: Session,
    batch_id: str,
    export_type: str,
    operator: str
) -> Dict:
    export_data, export_hash = prepare_export_data(db, batch_id)

    existing = db.query(ExportSnapshot).filter(
        ExportSnapshot.batch_id == batch_id,
        ExportSnapshot.export_type == export_type,
        ExportSnapshot.export_hash == export_hash
    ).first()

    if existing:
        return {
            "snapshot_id": existing.snapshot_id,
            "batch_id": batch_id,
            "record_count": existing.record_count,
            "export_hash": export_hash,
            "created_at": existing.created_at,
            "message": "该批次数据未发生变化，返回历史快照"
        }

    snapshot = ExportSnapshot(
        snapshot_id=f"SNAP_{datetime.now().strftime('%Y%m%d')}_{uuid.uuid4().hex[:8].upper()}",
        batch_id=batch_id,
        export_type=export_type,
        record_count=len(export_data),
        export_hash=export_hash,
        exported_by=operator
    )
    db.add(snapshot)
    db.commit()

    return {
        "snapshot_id": snapshot.snapshot_id,
        "batch_id": batch_id,
        "record_count": snapshot.record_count,
        "export_hash": export_hash,
        "created_at": snapshot.created_at,
        "message": "导出快照创建成功"
    }


def get_review_checklist(db: Session, batch_id: str) -> Dict:
    records = db.query(CollateralRecord).filter(
        CollateralRecord.batch_id == batch_id
    ).all()

    total = len(records)
    exception_count = sum(1 for r in records if r.is_exception)
    manual_note_count = sum(1 for r in records if r.has_manual_note)
    reviewed = sum(1 for r in records if r.status in ("success", "manual_override", "reviewed"))
    pending = total - reviewed

    suggestions = []
    can_export = True

    if exception_count > 0:
        suggestions.append(f"存在 {exception_count} 条异常记录，请先处理")
        can_export = False

    if pending > 0:
        suggestions.append(f"还有 {pending} 条记录待复核")
        can_export = False

    if manual_note_count > 0:
        suggestions.append(f"有 {manual_note_count} 条人工备注记录，请确认备注内容是否完整")

    if not suggestions:
        suggestions.append("所有记录已处理完毕，可以导出")

    return {
        "batch_id": batch_id,
        "total_records": total,
        "reviewed_count": reviewed,
        "pending_review": pending,
        "has_exceptions": exception_count > 0,
        "exception_count": exception_count,
        "has_manual_notes": manual_note_count > 0,
        "manual_note_count": manual_note_count,
        "review_suggestion": "；".join(suggestions),
        "can_export": can_export
    }
