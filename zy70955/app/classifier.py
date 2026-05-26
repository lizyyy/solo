import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models import RawMaterial, ProcessingDetail, Trajectory
from app.schemas import MaterialItem


REQUIRED_FIELDS = [
    "artifact_no",
    "artifact_name",
    "borrower",
    "lender",
    "loan_start",
    "loan_end",
    "insurance_value",
    "insurance_type",
]


def _parse_date(val: str) -> Optional[datetime]:
    if not val:
        return None
    val = val.strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d", "%Y%m%d"):
        try:
            return datetime.strptime(val, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(val)
    except ValueError:
        return None


def _value_of(m: RawMaterial, field: str) -> Optional[str]:
    return getattr(m, field, None)


def classify_material(db: Session, batch_id: int, material: RawMaterial) -> ProcessingDetail:
    issues_missing: List[str] = []
    for f in REQUIRED_FIELDS:
        v = _value_of(material, f)
        if v is None or (isinstance(v, str) and v.strip() == ""):
            issues_missing.append(f)

    issues_time: List[str] = []
    start_dt = _parse_date(material.loan_start or "")
    end_dt = _parse_date(material.loan_end or "")
    if start_dt and end_dt and end_dt < start_dt:
        issues_time.append("loan_end 早于 loan_start")

    issues_duplicate: List[str] = []
    if material.artifact_no and material.artifact_no.strip():
        dup = db.query(RawMaterial).filter(
            RawMaterial.batch_id == batch_id,
            RawMaterial.artifact_no == material.artifact_no.strip(),
            RawMaterial.id != material.id,
        ).first()
        if dup:
            issues_duplicate.append(f"与行号 {dup.line_no} 的 artifact_no 重复")

    if issues_duplicate or issues_time:
        category = "intercepted"
        reason_code = "TIME_CONFLICT" if issues_time else "DUPLICATE_NO"
        if issues_duplicate and issues_time:
            reason_code = "TIME_AND_DUPLICATE"
        reason_detail = "; ".join(issues_time + issues_duplicate)
        next_action = "已拦截：请展陈部核对原始材料后更正并重新提交"
    elif issues_missing:
        category = "pending"
        reason_code = "MISSING_FIELDS"
        reason_detail = "缺少必填字段: " + ", ".join(issues_missing)
        next_action = "请展陈部补全以下字段后重新提交: " + ", ".join(issues_missing)
    else:
        category = "normal"
        reason_code = "PASS"
        reason_detail = "所有关键字段校验通过"
        next_action = "进入保险报告生成流程"

    detail = ProcessingDetail(
        raw_material_id=material.id,
        batch_id=batch_id,
        category=category,
        reason_code=reason_code,
        reason_detail=reason_detail,
        next_action=next_action,
        review_status="pending",
    )
    db.add(detail)
    db.flush()

    report_snapshot = _build_report_snapshot(material, category)
    detail.report_snapshot = report_snapshot

    trajectory = Trajectory(
        detail_id=detail.id,
        stage="classify",
        action="auto_classify",
        operator="system",
        new_value={"category": category, "reason_code": reason_code, "next_action": next_action},
        comment=f"系统自动分类: {category}",
    )
    db.add(trajectory)
    return detail


def _build_report_snapshot(material: RawMaterial, category: str) -> Dict[str, Any]:
    start_dt = _parse_date(material.loan_start or "")
    end_dt = _parse_date(material.loan_end or "")
    duration_days = None
    if start_dt and end_dt:
        duration_days = (end_dt - start_dt).days + 1

    value_str = (material.insurance_value or "0").replace(",", "")
    value_num = None
    try:
        value_num = float(value_str)
    except ValueError:
        pass

    return {
        "artifact_no": material.artifact_no,
        "artifact_name": material.artifact_name,
        "borrower": material.borrower,
        "lender": material.lender,
        "loan_start": material.loan_start,
        "loan_end": material.loan_end,
        "duration_days": duration_days,
        "insurance_value": value_num,
        "insurance_value_raw": material.insurance_value,
        "insurance_type": material.insurance_type,
        "condition": material.condition,
        "location": material.location,
        "category": category,
    }
