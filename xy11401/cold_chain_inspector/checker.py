from datetime import timedelta
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

from .models import (
    ColdChainRecord, RecordIssue, IssueType, RecordStatus,
    DataSource
)
from .database import log_operation


def check_missing_fields(session: Session, batch_id=None):
    query = session.query(ColdChainRecord)
    if batch_id:
        query = query.filter_by(batch_id=batch_id)
    
    records = query.all()
    issues = []
    
    required_fields = ["box_no", "quantity", "amount", "shipment_date"]
    
    for record in records:
        for field in required_fields:
            value = getattr(record, field)
            if value is None or (isinstance(value, str) and value.strip() == ""):
                issue = RecordIssue(
                    record_id=record.id,
                    issue_type=IssueType.MISSING_FIELD,
                    field_name=field,
                    description=f"缺少必填字段: {field}",
                    old_value=str(value) if value else "",
                    confidence=1.0
                )
                session.add(issue)
                issues.append(issue)
                record.status = RecordStatus.ISSUE_FOUND
    
    session.commit()
    return issues


def check_cross_day_sign(session: Session, batch_id=None):
    query = session.query(ColdChainRecord).filter(
        ColdChainRecord.shipment_date.isnot(None),
        ColdChainRecord.receive_date.isnot(None)
    )
    if batch_id:
        query = query.filter_by(batch_id=batch_id)
    
    records = query.all()
    issues = []
    
    for record in records:
        if record.receive_date and record.shipment_date:
            receive_date = record.receive_date.date()
            shipment_date = record.shipment_date.date()
            
            if receive_date != shipment_date:
                days_diff = (receive_date - shipment_date).days
                record.cross_day = True
                
                issue = RecordIssue(
                    record_id=record.id,
                    issue_type=IssueType.CROSS_DAY_SIGN,
                    field_name="receive_date",
                    description=f"跨日签收: 发货日 {shipment_date}, 签收日 {receive_date}, 相差 {days_diff} 天",
                    old_value=str(record.receive_date),
                    confidence=1.0
                )
                session.add(issue)
                issues.append(issue)
                record.status = RecordStatus.ISSUE_FOUND
    
    session.commit()
    return issues


def check_box_rename(session: Session, batch_id=None):
    subquery = session.query(
        ColdChainRecord.original_box_no,
        func.count(func.distinct(ColdChainRecord.box_no)).label("box_count")
    ).group_by(ColdChainRecord.original_box_no).having(
        func.count(func.distinct(ColdChainRecord.box_no)) > 1
    ).subquery()
    
    query = session.query(ColdChainRecord).join(
        subquery, ColdChainRecord.original_box_no == subquery.c.original_box_no
    ).filter(
        ColdChainRecord.box_no != ColdChainRecord.original_box_no
    )
    
    if batch_id:
        query = query.filter(ColdChainRecord.batch_id == batch_id)
    
    records = query.all()
    issues = []
    
    box_groups = {}
    for record in records:
        if record.original_box_no not in box_groups:
            box_groups[record.original_box_no] = set()
        box_groups[record.original_box_no].add(record.box_no)
    
    for record in records:
        other_names = [n for n in box_groups[record.original_box_no] if n != record.box_no]
        
        issue = RecordIssue(
            record_id=record.id,
            issue_type=IssueType.BOX_RENAME,
            field_name="box_no",
            description=f"箱号改名: 原始箱号 {record.original_box_no}, 当前 {record.box_no}, 其他别名: {', '.join(other_names)}",
            old_value=record.original_box_no,
            new_value=record.box_no,
            confidence=0.9
        )
        session.add(issue)
        issues.append(issue)
        record.status = RecordStatus.ISSUE_FOUND
    
    session.commit()
    return issues


def check_amount_conflict(session: Session, batch_id=None):
    query = session.query(ColdChainRecord).filter(
        ColdChainRecord.quantity.isnot(None),
        ColdChainRecord.unit_price.isnot(None),
        ColdChainRecord.amount.isnot(None)
    )
    if batch_id:
        query = query.filter_by(batch_id=batch_id)
    
    records = query.all()
    issues = []
    
    for record in records:
        calculated_amount = record.quantity * record.unit_price
        diff = abs(calculated_amount - record.amount)
        
        if diff > 0.01:
            issue = RecordIssue(
                record_id=record.id,
                issue_type=IssueType.AMOUNT_CONFLICT,
                field_name="amount",
                description=f"金额冲突: 计算值 {calculated_amount:.2f} ≠ 记录值 {record.amount:.2f}, 差值 {diff:.2f}",
                old_value=str(record.amount),
                new_value=str(calculated_amount),
                confidence=0.95
            )
            session.add(issue)
            issues.append(issue)
            record.status = RecordStatus.ISSUE_FOUND
    
    session.commit()
    return issues


def check_quantity_conflict(session: Session, batch_id=None):
    query = session.query(ColdChainRecord).filter(
        ColdChainRecord.original_box_no.isnot(None),
        ColdChainRecord.quantity.isnot(None)
    )
    if batch_id:
        query = query.filter_by(batch_id=batch_id)
    
    records = query.all()
    box_quantities = {}
    
    for record in records:
        key = record.original_box_no or record.box_no
        if key:
            if key not in box_quantities:
                box_quantities[key] = []
            box_quantities[key].append(record)
    
    issues = []
    for box_no, box_records in box_quantities.items():
        if len(box_records) > 1:
            quantities = set(r.quantity for r in box_records if r.quantity)
            if len(quantities) > 1:
                for record in box_records:
                    other_qtys = [str(r.quantity) for r in box_records if r.id != record.id]
                    issue = RecordIssue(
                        record_id=record.id,
                        issue_type=IssueType.QUANTITY_CONFLICT,
                        field_name="quantity",
                        description=f"数量冲突: 箱号 {box_no}, 当前值 {record.quantity}, 其他记录值: {', '.join(other_qtys)}",
                        old_value=str(record.quantity),
                        confidence=0.9
                    )
                    session.add(issue)
                    issues.append(issue)
                    record.status = RecordStatus.ISSUE_FOUND
    
    session.commit()
    return issues


def check_duplicate_records(session: Session, batch_id=None):
    query = session.query(ColdChainRecord)
    if batch_id:
        query = query.filter_by(batch_id=batch_id)
    
    records = query.all()
    seen = {}
    issues = []
    
    for record in records:
        key = (record.box_no, record.shipment_date.date() if record.shipment_date else None, 
               record.quantity, record.amount)
        
        if key in seen:
            issue = RecordIssue(
                record_id=record.id,
                issue_type=IssueType.DUPLICATE_IMPORT,
                field_name="duplicate",
                description=f"重复记录: 与记录 ID {seen[key].id} 重复 (箱号: {record.box_no}, 数量: {record.quantity})",
                old_value=str(seen[key].id),
                confidence=1.0
            )
            session.add(issue)
            issues.append(issue)
            record.status = RecordStatus.ISSUE_FOUND
        else:
            seen[key] = record
    
    session.commit()
    return issues


def run_all_checks(session: Session, user, batch_id=None):
    all_issues = []
    
    check_functions = [
        ("缺字段检查", check_missing_fields),
        ("跨日签收检查", check_cross_day_sign),
        ("箱号改名检查", check_box_rename),
        ("金额冲突检查", check_amount_conflict),
        ("数量冲突检查", check_quantity_conflict),
        ("重复记录检查", check_duplicate_records),
    ]
    
    for check_name, check_func in check_functions:
        issues = check_func(session, batch_id)
        all_issues.extend(issues)
    
    log_operation(session, user, "run_checks", "RecordIssue", None, {
        "batch_id": batch_id,
        "total_issues": len(all_issues),
        "issue_types": list(set(i.issue_type.value for i in all_issues))
    })
    
    return all_issues


def get_issue_summary(session: Session, batch_id=None):
    query = session.query(RecordIssue)
    if batch_id:
        query = query.join(ColdChainRecord).filter(ColdChainRecord.batch_id == batch_id)
    
    issues = query.all()
    
    summary = {}
    for issue in issues:
        itype = issue.issue_type.value
        if itype not in summary:
            summary[itype] = {"count": 0, "resolved": 0}
        summary[itype]["count"] += 1
        if issue.resolved:
            summary[itype]["resolved"] += 1
    
    return summary
