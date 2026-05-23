from datetime import datetime
from .database import get_session, ConsumableRecord, AuditLog


def run_data_checks(record_id=None):
    session = get_session()

    query = session.query(ConsumableRecord).filter(ConsumableRecord.is_valid == True)
    if record_id:
        query = query.filter(ConsumableRecord.id == record_id)

    records = query.all()
    issues = []

    for record in records:
        record_issues = check_single_record(record)
        issues.extend(record_issues)

    session.close()
    return issues


def check_single_record(record):
    issues = []

    if not record.material_name or record.material_name.strip() == "":
        issues.append({
            "record_id": record.id,
            "original_row": record.original_row,
            "source_type": record.source_type,
            "field": "material_name",
            "issue": "耗材名称为空",
            "severity": "error",
        })

    if record.quantity <= 0:
        issues.append({
            "record_id": record.id,
            "original_row": record.original_row,
            "source_type": record.source_type,
            "field": "quantity",
            "issue": f"数量异常: {record.quantity}",
            "severity": "error",
        })

    if record.record_date and record.record_date > datetime.now():
        issues.append({
            "record_id": record.id,
            "original_row": record.original_row,
            "source_type": record.source_type,
            "field": "record_date",
            "issue": f"日期在未来: {record.record_date}",
            "severity": "warning",
        })

    if record.total_price and record.unit_price and record.quantity:
        expected = round(record.unit_price * record.quantity, 2)
        actual = round(record.total_price, 2)
        if abs(expected - actual) > 0.01:
            issues.append({
                "record_id": record.id,
                "original_row": record.original_row,
                "source_type": record.source_type,
                "field": "total_price",
                "issue": f"金额不符: 单价×数量={expected}, 实际={actual}",
                "severity": "warning",
            })

    if not record.department and record.source_type in ["领用单", "老师补签记录"]:
        issues.append({
            "record_id": record.id,
            "original_row": record.original_row,
            "source_type": record.source_type,
            "field": "department",
            "issue": "部门为空",
            "severity": "warning",
        })

    if record.purpose and record.purpose not in ["教学", "科研", "办公", "维修", "其他"]:
        issues.append({
            "record_id": record.id,
            "original_row": record.original_row,
            "source_type": record.source_type,
            "field": "purpose",
            "issue": f"用途不规范: {record.purpose}",
            "severity": "info",
        })

    return issues


def check_summary():
    issues = run_data_checks()
    summary = {
        "total_records": 0,
        "total_issues": len(issues),
        "by_severity": {"error": 0, "warning": 0, "info": 0},
        "by_field": {},
        "by_source": {},
        "issues": issues,
    }

    for issue in issues:
        summary["by_severity"][issue["severity"]] += 1
        summary["by_field"][issue["field"]] = summary["by_field"].get(issue["field"], 0) + 1
        summary["by_source"][issue["source_type"]] = summary["by_source"].get(issue["source_type"], 0) + 1

    session = get_session()
    summary["total_records"] = session.query(ConsumableRecord).filter(ConsumableRecord.is_valid == True).count()
    session.close()

    return summary
