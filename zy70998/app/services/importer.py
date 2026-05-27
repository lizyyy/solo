import csv
import json
import io
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from sqlalchemy.orm import Session
from app.models import ImportBatch, Employee, Coupon, RequisitionRecord
from app.database import UPLOAD_DIR


BATCH_TYPE_EMPLOYEE = "employee"
BATCH_TYPE_COUPON = "coupon"
BATCH_TYPE_REQUISITION = "requisition"


def _make_batch_no(batch_type: str) -> str:
    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"{batch_type.upper()}-{ts}"


def _save_file(batch_no: str, file_name: str, content: bytes) -> str:
    import os
    ext = os.path.splitext(file_name)[1] or ".bin"
    save_path = UPLOAD_DIR / f"{batch_no}{ext}"
    save_path.write_bytes(content)
    return str(save_path)


def import_employees_json(db: Session, file_name: str, content: bytes, operator: str = "system") -> Dict:
    batch_no = _make_batch_no(BATCH_TYPE_EMPLOYEE)
    _save_file(batch_no, file_name, content)

    try:
        data = json.loads(content.decode("utf-8-sig"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        return {"success": False, "error": f"JSON 解析失败: {str(e)}"}

    if isinstance(data, dict):
        records = data.get("employees", data.get("data", [data]))
    elif isinstance(data, list):
        records = data
    else:
        return {"success": False, "error": "JSON 格式错误，应为数组或包含 employees/data 的对象"}

    batch = ImportBatch(
        batch_no=batch_no,
        batch_type=BATCH_TYPE_EMPLOYEE,
        file_name=file_name,
        record_count=len(records),
        operator=operator,
    )
    db.add(batch)
    db.flush()

    imported = 0
    skipped = 0
    skipped_reasons = []

    for rec in records:
        emp_no = str(rec.get("emp_no", rec.get("employee_no", ""))).strip()
        name = str(rec.get("name", rec.get("emp_name", ""))).strip()
        if not emp_no or not name:
            skipped += 1
            skipped_reasons.append(f"缺少工号或姓名: {json.dumps(rec, ensure_ascii=False)[:120]}")
            continue

        existing = db.query(Employee).filter_by(emp_no=emp_no).first()
        if existing:
            existing.department = rec.get("department", existing.department)
            existing.status = rec.get("status", existing.status)
            existing.phone = rec.get("phone", existing.phone)
            existing.id_card = rec.get("id_card", existing.id_card)
            existing.remark = rec.get("remark", existing.remark)
            existing.batch_id = batch.id
        else:
            emp = Employee(
                emp_no=emp_no,
                name=name,
                department=rec.get("department"),
                status=rec.get("status", "active"),
                phone=rec.get("phone"),
                id_card=rec.get("id_card"),
                remark=rec.get("remark"),
                batch_id=batch.id,
            )
            db.add(emp)
        imported += 1

    batch.record_count = imported
    db.commit()

    return {
        "success": True,
        "batch_no": batch_no,
        "batch_type": BATCH_TYPE_EMPLOYEE,
        "total_rows": len(records),
        "imported_rows": imported,
        "skipped_rows": skipped,
        "skipped_reasons": skipped_reasons[:10],
    }


def import_coupons_csv(db: Session, file_name: str, content: bytes, operator: str = "system") -> Dict:
    batch_no = _make_batch_no(BATCH_TYPE_COUPON)
    _save_file(batch_no, file_name, content)

    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("gbk", errors="replace")

    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)

    batch = ImportBatch(
        batch_no=batch_no,
        batch_type=BATCH_TYPE_COUPON,
        file_name=file_name,
        record_count=len(rows),
        operator=operator,
    )
    db.add(batch)
    db.flush()

    imported = 0
    skipped = 0
    skipped_reasons = []

    for row in rows:
        coupon_code = str(row.get("coupon_code", row.get("券码", ""))).strip()
        coupon_type = str(row.get("coupon_type", row.get("券类型", "节日福利券"))).strip()
        if not coupon_code:
            skipped += 1
            skipped_reasons.append(f"缺少券码: {json.dumps(row, ensure_ascii=False)[:120]}")
            continue

        face_value = 0.0
        try:
            face_value = float(row.get("face_value", row.get("面值", 0)) or 0)
        except (ValueError, TypeError):
            pass

        existing = db.query(Coupon).filter_by(coupon_code=coupon_code).first()
        if existing:
            existing.coupon_type = coupon_type or existing.coupon_type
            existing.face_value = face_value
            existing.status = row.get("status", row.get("状态", existing.status))
            existing.batch_no = row.get("batch_no", row.get("批次", existing.batch_no))
            existing.issued_emp_no = row.get("issued_emp_no", existing.issued_emp_no)
            existing.issued_name = row.get("issued_name", existing.issued_name)
            existing.expire_date = row.get("expire_date", row.get("有效期", existing.expire_date))
            existing.batch_id = batch.id
        else:
            cp = Coupon(
                coupon_code=coupon_code,
                coupon_type=coupon_type,
                face_value=face_value,
                status=row.get("status", row.get("状态", "unused")),
                batch_no=row.get("batch_no", row.get("批次")),
                issued_emp_no=row.get("issued_emp_no"),
                issued_name=row.get("issued_name"),
                expire_date=row.get("expire_date", row.get("有效期")),
                batch_id=batch.id,
            )
            db.add(cp)
        imported += 1

    batch.record_count = imported
    db.commit()

    return {
        "success": True,
        "batch_no": batch_no,
        "batch_type": BATCH_TYPE_COUPON,
        "total_rows": len(rows),
        "imported_rows": imported,
        "skipped_rows": skipped,
        "skipped_reasons": skipped_reasons[:10],
    }


def import_requisitions_csv(db: Session, file_name: str, content: bytes, operator: str = "system") -> Dict:
    batch_no = _make_batch_no(BATCH_TYPE_REQUISITION)
    _save_file(batch_no, file_name, content)

    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("gbk", errors="replace")

    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)

    batch = ImportBatch(
        batch_no=batch_no,
        batch_type=BATCH_TYPE_REQUISITION,
        file_name=file_name,
        record_count=len(rows),
        operator=operator,
    )
    db.add(batch)
    db.flush()

    imported = 0
    skipped = 0
    skipped_reasons = []

    for row in rows:
        emp_no = str(row.get("emp_no", row.get("工号", ""))).strip()
        emp_name = str(row.get("emp_name", row.get("姓名", ""))).strip()
        if not emp_no or not emp_name:
            skipped += 1
            skipped_reasons.append(f"缺少工号或姓名: {json.dumps(row, ensure_ascii=False)[:120]}")
            continue

        claim_amount = 0.0
        try:
            claim_amount = float(row.get("claim_amount", row.get("金额", 0)) or 0)
        except (ValueError, TypeError):
            pass

        record = RequisitionRecord(
            batch_id=batch.id,
            emp_no=emp_no,
            emp_name=emp_name,
            department=row.get("department", row.get("部门")),
            coupon_code=row.get("coupon_code", row.get("券码")),
            coupon_type=row.get("coupon_type", row.get("券类型")),
            claim_type=row.get("claim_type", row.get("领取方式", "线下领取")),
            claim_date=row.get("claim_date", row.get("领取日期")),
            claim_amount=claim_amount,
            proxy_emp_no=row.get("proxy_emp_no", row.get("代领工号")),
            proxy_name=row.get("proxy_name", row.get("代领人")),
            remark=row.get("remark", row.get("备注")),
            raw_data=json.dumps(row, ensure_ascii=False),
        )
        db.add(record)
        imported += 1

    batch.record_count = imported
    db.commit()

    return {
        "success": True,
        "batch_no": batch_no,
        "batch_type": BATCH_TYPE_REQUISITION,
        "total_rows": len(rows),
        "imported_rows": imported,
        "skipped_rows": skipped,
        "skipped_reasons": skipped_reasons[:10],
    }


def list_batches(db: Session, batch_type: Optional[str] = None) -> List[ImportBatch]:
    q = db.query(ImportBatch)
    if batch_type:
        q = q.filter_by(batch_type=batch_type)
    return q.order_by(ImportBatch.created_at.desc()).all()
