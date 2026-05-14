from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.models.database import QualityRecord, SliceRule, ApprovalRecord
from app.models.schemas import QualityRecordCreate, SliceRuleCreate, ApprovalRecordCreate, Statistics
import pandas as pd
from io import BytesIO

def slice_content(content: str, rule: SliceRule) -> str:
    separator = rule.separator
    chunks = content.split(separator)
    result_chunks = []
    current_chunk = ""
    
    for chunk in chunks:
        if len(current_chunk) + len(chunk) < rule.max_length:
            current_chunk += chunk + separator
        else:
            if current_chunk:
                result_chunks.append(current_chunk.strip())
            current_chunk = chunk + separator
    
    if current_chunk:
        result_chunks.append(current_chunk.strip())
    
    final_chunks = []
    for i, chunk in enumerate(result_chunks):
        if len(chunk) < rule.min_length and i > 0:
            if final_chunks:
                final_chunks[-1] = final_chunks[-1] + chunk
        else:
            final_chunks.append(chunk)
    
    return "\n---\n".join(final_chunks)

def calculate_recall_score(sliced_content: str) -> float:
    if not sliced_content:
        return 0.0
    score = min(1.0, len(sliced_content) / 1000)
    return round(score, 2)

def determine_has_answer(content: str) -> bool:
    keywords = ["答案", "回答", "解答", "solution", "answer", "result", "结论", "结果"]
    return any(keyword in content for keyword in keywords)

def determine_status(record: QualityRecord) -> str:
    if record.recall_score is None or record.has_answer is None:
        return "pending"
    
    if record.recall_score < 0.3:
        return "blocked"
    elif record.recall_score < 0.6:
        return "compensated"
    elif not record.has_answer:
        return "pending_review"
    else:
        return "success"

def create_quality_record(db: Session, record: QualityRecordCreate) -> QualityRecord:
    db_record = QualityRecord(**record.model_dump())
    
    if record.slice_rule_id:
        rule = db.query(SliceRule).filter(SliceRule.id == record.slice_rule_id).first()
        if rule:
            try:
                db_record.sliced_content = slice_content(record.original_content, rule)
                db_record.recall_score = calculate_recall_score(db_record.sliced_content)
                db_record.has_answer = determine_has_answer(db_record.sliced_content)
                db_record.status = determine_status(db_record)
            except Exception as e:
                db_record.status = "error"
                db_record.error_message = str(e)
    
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record

def recalculate_record(db: Session, record_id: int) -> Optional[QualityRecord]:
    record = db.query(QualityRecord).filter(QualityRecord.id == record_id).first()
    if not record:
        return None
    
    if record.slice_rule_id:
        rule = db.query(SliceRule).filter(SliceRule.id == record.slice_rule_id).first()
        if rule:
            try:
                record.sliced_content = slice_content(record.original_content, rule)
                record.recall_score = calculate_recall_score(record.sliced_content)
                record.has_answer = determine_has_answer(record.sliced_content)
                record.status = determine_status(record)
                record.error_message = None
            except Exception as e:
                record.status = "error"
                record.error_message = str(e)
    
    record.updated_at = datetime.now()
    db.commit()
    db.refresh(record)
    return record

def recalculate_by_rule(db: Session, rule_id: int) -> List[QualityRecord]:
    records = db.query(QualityRecord).filter(QualityRecord.slice_rule_id == rule_id).all()
    rule = db.query(SliceRule).filter(SliceRule.id == rule_id).first()
    if not rule:
        return []
    
    updated_records = []
    for record in records:
        try:
            record.sliced_content = slice_content(record.original_content, rule)
            record.recall_score = calculate_recall_score(record.sliced_content)
            record.has_answer = determine_has_answer(record.sliced_content)
            record.status = determine_status(record)
            record.error_message = None
        except Exception as e:
            record.status = "error"
            record.error_message = str(e)
        record.updated_at = datetime.now()
        updated_records.append(record)
    
    db.commit()
    return updated_records

def get_quality_records(db: Session, skip: int = 0, limit: int = 100, status: Optional[str] = None) -> List[QualityRecord]:
    query = db.query(QualityRecord)
    if status:
        query = query.filter(QualityRecord.status == status)
    return query.order_by(QualityRecord.created_at.desc()).offset(skip).limit(limit).all()

def get_quality_record(db: Session, record_id: int) -> Optional[QualityRecord]:
    return db.query(QualityRecord).filter(QualityRecord.id == record_id).first()

def create_slice_rule(db: Session, rule: SliceRuleCreate) -> SliceRule:
    db_rule = SliceRule(**rule.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule

def get_slice_rules(db: Session) -> List[SliceRule]:
    return db.query(SliceRule).order_by(SliceRule.created_at.desc()).all()

def update_slice_rule(db: Session, rule_id: int, rule_data: SliceRuleCreate) -> Optional[SliceRule]:
    rule = db.query(SliceRule).filter(SliceRule.id == rule_id).first()
    if not rule:
        return None
    
    for key, value in rule_data.model_dump().items():
        setattr(rule, key, value)
    rule.updated_at = datetime.now()
    db.commit()
    db.refresh(rule)
    
    recalculate_by_rule(db, rule_id)
    return rule

def create_approval(db: Session, approval: ApprovalRecordCreate) -> ApprovalRecord:
    db_approval = ApprovalRecord(**approval.model_dump())
    db.add(db_approval)
    
    record = db.query(QualityRecord).filter(QualityRecord.id == approval.quality_record_id).first()
    if record:
        if approval.action == "approve":
            record.status = "success"
        elif approval.action == "reject":
            record.status = "blocked"
        elif approval.action == "compensate":
            record.status = "compensated"
        record.updated_at = datetime.now()
    
    db.commit()
    db.refresh(db_approval)
    return db_approval

def get_approvals_by_record(db: Session, record_id: int) -> List[ApprovalRecord]:
    return db.query(ApprovalRecord).filter(ApprovalRecord.quality_record_id == record_id).order_by(ApprovalRecord.created_at.desc()).all()

def get_statistics(db: Session) -> Statistics:
    total = db.query(QualityRecord).count()
    success = db.query(QualityRecord).filter(QualityRecord.status == "success").count()
    blocked = db.query(QualityRecord).filter(QualityRecord.status == "blocked").count()
    compensated = db.query(QualityRecord).filter(QualityRecord.status == "compensated").count()
    pending_review = db.query(QualityRecord).filter(QualityRecord.status == "pending_review").count()
    
    success_rate = round(success / total * 100 if total > 0 else 0.0, 2)
    
    return Statistics(
        total=total,
        success=success,
        blocked=blocked,
        compensated=compensated,
        pending_review=pending_review,
        success_rate=success_rate
    )

def export_to_excel(db: Session) -> BytesIO:
    records = db.query(QualityRecord).all()
    data = []
    for record in records:
        data.append({
            "ID": record.id,
            "文档ID": record.document_id,
            "文档名称": record.document_name,
            "原始内容": record.original_content,
            "切片内容": record.sliced_content,
            "召回分数": record.recall_score,
            "有答案": record.has_answer,
            "状态": record.status,
            "错误信息": record.error_message,
            "创建时间": record.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "更新时间": record.updated_at.strftime("%Y-%m-%d %H:%M:%S")
        })
    
    df = pd.DataFrame(data)
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="质检清单")
    output.seek(0)
    return output
