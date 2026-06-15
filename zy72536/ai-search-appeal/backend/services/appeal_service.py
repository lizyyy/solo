import pandas as pd
import math
import json
from typing import List, Tuple, Dict, Any
from sqlalchemy.orm import Session
from .. import models, schemas


LOW_CONFIDENCE_THRESHOLD = 0.6


def _safe_int(val):
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def _safe_float(val):
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def parse_csv_content(content: str) -> pd.DataFrame:
    from io import StringIO
    return pd.read_csv(StringIO(content))


def detect_low_confidence_samples(df: pd.DataFrame) -> List[int]:
    if "confidence" in df.columns:
        return df[df["confidence"] < LOW_CONFIDENCE_THRESHOLD].index.tolist()
    return []


def import_ticket_from_df(
    db: Session,
    df: pd.DataFrame,
    ticket_no: str,
    original_row_start: int = 1,
    operator: str = "system"
) -> Tuple[models.AppealTicket, List[str]]:
    warnings = []

    existing = db.query(models.AppealTicket).filter(
        models.AppealTicket.ticket_no == ticket_no
    ).first()
    if existing:
        warnings.append(f"工单 {ticket_no} 已存在，将追加样本")

    raw_content = json.loads(df.to_json(orient="records"))

    ticket = models.AppealTicket(
        ticket_no=ticket_no,
        source="线上反馈工单",
        original_row_no=original_row_start,
        raw_content=raw_content,
        status="待处理"
    )
    db.add(ticket)
    db.flush()

    samples = []
    low_conf_indices = detect_low_confidence_samples(df)

    for idx, row in df.iterrows():
        confidence = float(row.get("confidence", 0.8))
        is_low = confidence < LOW_CONFIDENCE_THRESHOLD
        sample_no = row.get("sample_no", f"{ticket_no}-{idx+1}")
        expected_rank = _safe_int(row.get("expected_rank"))

        sample = models.Sample(
            ticket_id=ticket.id,
            sample_no=str(sample_no),
            query=str(row.get("query", "")),
            doc_title=str(row.get("doc_title", "")),
            doc_url=str(row.get("doc_url", "")),
            original_rank=int(row.get("original_rank", idx + 1)),
            expected_rank=expected_rank,
            confidence=confidence,
            is_low_confidence=is_low,
            is_hidden_by_avg=False,
            current_rank=int(row.get("original_rank", idx + 1)),
            status="待复核" if is_low else "正常"
        )
        samples.append(sample)

    db.add_all(samples)
    db.flush()

    audit = models.AuditLog(
        ticket_id=ticket.id,
        action="导入工单",
        operator=operator,
        after_value={"ticket_no": ticket_no, "samples_count": len(samples)},
        note=f"从CSV导入，共{len(samples)}条样本，低置信度{len(low_conf_indices)}条"
    )
    db.add(audit)

    db.commit()
    db.refresh(ticket)

    if low_conf_indices:
        warnings.append(f"检测到 {len(low_conf_indices)} 条低置信度样本，已标记为待复核")

    return ticket, warnings


def check_duplicate_import(db: Session, ticket_no: str) -> dict:
    tickets = db.query(models.AppealTicket).filter(
        models.AppealTicket.ticket_no == ticket_no
    ).all()

    sample_nos = []
    for t in tickets:
        for s in t.samples:
            sample_nos.append(s.sample_no)

    from collections import Counter
    duplicates = [k for k, v in Counter(sample_nos).items() if v > 1]

    return {
        "passed": len(duplicates) == 0,
        "duplicate_tickets": len(tickets) > 1,
        "duplicate_samples": duplicates,
        "ticket_count": len(tickets)
    }


def check_low_confidence_hidden(db: Session, ticket_id: int) -> dict:
    samples = db.query(models.Sample).filter(
        models.Sample.ticket_id == ticket_id,
        models.Sample.is_low_confidence == True
    ).all()

    hidden = [s for s in samples if s.is_hidden_by_avg]
    not_hidden = [s for s in samples if not s.is_hidden_by_avg]

    return {
        "passed": len(not_hidden) > 0,
        "total_low_confidence": len(samples),
        "hidden_count": len(hidden),
        "visible_count": len(not_hidden),
        "hidden_samples": [{"id": s.id, "sample_no": s.sample_no} for s in hidden]
    }


def check_recalculate_consistency(db: Session, ticket_id: int) -> dict:
    samples = db.query(models.Sample).filter(models.Sample.ticket_id == ticket_id).all()
    inconsistencies = []

    for s in samples:
        latest_version = db.query(models.SampleVersion).filter(
            models.SampleVersion.sample_id == s.id
        ).order_by(models.SampleVersion.created_at.desc()).first()

        if latest_version and latest_version.rank != s.current_rank:
            inconsistencies.append({
                "sample_id": s.id,
                "sample_no": s.sample_no,
                "current_rank": s.current_rank,
                "latest_version_rank": latest_version.rank
            })

    return {
        "passed": len(inconsistencies) == 0,
        "inconsistencies": inconsistencies
    }


def check_export_consistency(db: Session, ticket_id: int) -> dict:
    samples = db.query(models.Sample).filter(models.Sample.ticket_id == ticket_id).all()

    issues = []
    for s in samples:
        if s.is_low_confidence and s.is_hidden_by_avg:
            issues.append({
                "sample_id": s.id,
                "sample_no": s.sample_no,
                "issue": "低置信度样本被平均指标盖住，导出时需特殊标记"
            })

    return {
        "passed": True,
        "total_samples": len(samples),
        "special_mark_count": len(issues),
        "issues": issues
    }


def run_self_check(db: Session, ticket_id: int) -> List[models.SelfCheckResult]:
    results = []

    ticket = db.query(models.AppealTicket).filter(models.AppealTicket.id == ticket_id).first()
    if not ticket:
        return results

    checks = [
        ("重复导入检查", check_duplicate_import(db, ticket.ticket_no)),
        ("低置信度样本盖住检查", check_low_confidence_hidden(db, ticket_id)),
        ("补录重算一致性检查", check_recalculate_consistency(db, ticket_id)),
        ("导出一致性检查", check_export_consistency(db, ticket_id))
    ]

    for check_type, details in checks:
        result = models.SelfCheckResult(
            ticket_id=ticket_id,
            check_type=check_type,
            passed=details["passed"],
            details=details
        )
        db.add(result)
        results.append(result)

    db.commit()
    return results


def recalculate_ranks(db: Session, ticket_id: int, operator: str) -> dict:
    samples = db.query(models.Sample).filter(models.Sample.ticket_id == ticket_id).all()

    recalculated = 0
    hidden_count = 0

    for s in samples:
        old_rank = s.current_rank
        old_hidden = s.is_hidden_by_avg
        old_status = s.status

        if s.expected_rank is not None:
            s.current_rank = s.expected_rank
            recalculated += 1

        if s.is_low_confidence:
            avg_conf = sum(x.confidence for x in samples) / len(samples) if samples else 0
            if s.confidence < avg_conf * 0.7:
                s.is_hidden_by_avg = True
                hidden_count += 1
                if s.status == "正常":
                    s.status = "待复核"
            else:
                s.is_hidden_by_avg = False

        if old_rank != s.current_rank or old_hidden != s.is_hidden_by_avg or old_status != s.status:
            audit = models.AuditLog(
                ticket_id=ticket_id,
                sample_id=s.id,
                action="重算排名",
                operator=operator,
                before_value={"rank": old_rank, "is_hidden_by_avg": old_hidden, "status": old_status},
                after_value={"rank": s.current_rank, "is_hidden_by_avg": s.is_hidden_by_avg, "status": s.status}
            )
            db.add(audit)

    db.commit()

    return {
        "ticket_id": ticket_id,
        "recalculated_count": recalculated,
        "hidden_by_avg_count": hidden_count
    }


def build_export_rows(db: Session, ticket_id: int) -> List[Dict[str, Any]]:
    ticket = db.query(models.AppealTicket).filter(models.AppealTicket.id == ticket_id).first()
    if not ticket:
        return []

    rows = []
    for s in ticket.samples:
        rows.append({
            "工单编号": ticket.ticket_no,
            "原始行号": ticket.original_row_no,
            "样本编号": s.sample_no,
            "查询词": s.query,
            "文档标题": s.doc_title,
            "文档URL": s.doc_url,
            "原始排名": s.original_rank,
            "预期排名": s.expected_rank,
            "当前排名": s.current_rank,
            "置信度": s.confidence,
            "低置信度": "是" if s.is_low_confidence else "否",
            "被平均指标盖住": "是" if s.is_hidden_by_avg else "否",
            "处理状态": s.status,
            "来源": ticket.source,
            "处理人": ticket.handler or "",
            "脱敏规则备注": ticket.desensitization_note or "",
            "人工备注": s.manual_note or ""
        })

    return rows


def export_ticket_excel(db: Session, ticket_id: int) -> pd.DataFrame:
    rows = build_export_rows(db, ticket_id)
    if not rows:
        return pd.DataFrame()
    return pd.DataFrame(rows)


def export_ticket_json(db: Session, ticket_id: int) -> Dict[str, Any]:
    ticket = db.query(models.AppealTicket).filter(models.AppealTicket.id == ticket_id).first()
    if not ticket:
        return {}

    samples = []
    for s in ticket.samples:
        samples.append({
            "id": s.id,
            "sample_no": s.sample_no,
            "query": s.query,
            "doc_title": s.doc_title,
            "doc_url": s.doc_url,
            "original_rank": s.original_rank,
            "expected_rank": s.expected_rank,
            "current_rank": s.current_rank,
            "confidence": s.confidence,
            "is_low_confidence": s.is_low_confidence,
            "is_hidden_by_avg": s.is_hidden_by_avg,
            "status": s.status,
            "manual_note": s.manual_note
        })

    audit_logs = []
    for l in db.query(models.AuditLog).filter(
        models.AuditLog.ticket_id == ticket_id
    ).order_by(models.AuditLog.created_at).all():
        audit_logs.append({
            "id": l.id,
            "action": l.action,
            "operator": l.operator,
            "sample_id": l.sample_id,
            "before_value": l.before_value,
            "after_value": l.after_value,
            "note": l.note,
            "created_at": l.created_at.isoformat() if l.created_at else None
        })

    self_checks = []
    for c in db.query(models.SelfCheckResult).filter(
        models.SelfCheckResult.ticket_id == ticket_id
    ).order_by(models.SelfCheckResult.created_at.desc()).all():
        self_checks.append({
            "check_type": c.check_type,
            "passed": c.passed,
            "details": c.details
        })

    return {
        "ticket": {
            "id": ticket.id,
            "ticket_no": ticket.ticket_no,
            "source": ticket.source,
            "original_row_no": ticket.original_row_no,
            "status": ticket.status,
            "handler": ticket.handler,
            "desensitization_note": ticket.desensitization_note,
            "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
            "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None,
        },
        "samples": samples,
        "audit_logs": audit_logs,
        "self_checks": self_checks,
        "export_rows": build_export_rows(db, ticket_id)
    }


def compare_versions(db: Session, version1_id: int, version2_id: int) -> schemas.VersionCompareResult:
    v1 = db.query(models.ModelVersion).filter(models.ModelVersion.id == version1_id).first()
    v2 = db.query(models.ModelVersion).filter(models.ModelVersion.id == version2_id).first()

    if not v1 or not v2:
        return schemas.VersionCompareResult(
            version1=v1.version_name if v1 else "未知",
            version2=v2.version_name if v2 else "未知",
            items=[],
            total_count=0,
            pending_review_count=0,
            from_ticket_count=0
        )

    all_sample_ids = set()
    v1_map = {}
    v2_map = {}

    for sv in db.query(models.SampleVersion).filter(
        models.SampleVersion.model_version_id == version1_id
    ).all():
        v1_map[sv.sample_id] = sv.rank
        all_sample_ids.add(sv.sample_id)

    for sv in db.query(models.SampleVersion).filter(
        models.SampleVersion.model_version_id == version2_id
    ).all():
        v2_map[sv.sample_id] = sv.rank
        all_sample_ids.add(sv.sample_id)

    items = []
    pending_count = 0
    from_ticket_count = 0

    for sample_id in all_sample_ids:
        sample = db.query(models.Sample).filter(models.Sample.id == sample_id).first()
        if not sample:
            continue

        ticket = db.query(models.AppealTicket).filter(
            models.AppealTicket.id == sample.ticket_id
        ).first()

        from_source = ticket.source if ticket else "未知"
        if from_source == "线上反馈工单":
            from_ticket_count += 1

        if sample.status == "待复核":
            pending_count += 1

        v1_rank = v1_map.get(sample_id)
        v2_rank = v2_map.get(sample_id)
        rank_change = v2_rank - v1_rank if v1_rank is not None and v2_rank is not None else None

        items.append(schemas.VersionCompareItem(
            sample_id=sample.id,
            sample_no=sample.sample_no,
            query=sample.query,
            doc_title=sample.doc_title,
            from_source=from_source,
            status=sample.status,
            v1_rank=v1_rank,
            v2_rank=v2_rank,
            rank_change=rank_change,
            is_low_confidence=sample.is_low_confidence,
            is_hidden_by_avg=sample.is_hidden_by_avg
        ))

    return schemas.VersionCompareResult(
        version1=v1.version_name,
        version2=v2.version_name,
        items=items,
        total_count=len(items),
        pending_review_count=pending_count,
        from_ticket_count=from_ticket_count
    )
