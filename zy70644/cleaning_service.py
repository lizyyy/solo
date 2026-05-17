import re
import json
from typing import Dict, List, Any, Tuple, Optional
from sqlalchemy.orm import Session
import pandas as pd
from database import (
    Task, RawRecord, CleanedRecord, Guardian, DietRestriction,
    CleanReport, AuditLog, HeaderMapping
)
from schemas import CleaningResult


DEFAULT_HEADER_MAPPINGS = {
    "王老师": {
        "学生姓名": "student_name",
        "姓名": "student_name",
        "护照号": "passport_number",
        "护照号码": "passport_number",
        "身份证号": "id_card_number",
        "性别": "gender",
        "出生日期": "birth_date",
        "学校": "school",
        "年级": "grade",
        "监护人姓名": "guardian_name",
        "家长姓名": "guardian_name",
        "监护人电话": "guardian_phone",
        "家长电话": "guardian_phone",
        "联系电话": "guardian_phone",
        "手机": "guardian_phone",
        "监护人关系": "guardian_relation",
        "与学生关系": "guardian_relation",
        "监护人邮箱": "guardian_email",
        "饮食禁忌": "diet_restriction",
        "特殊需求": "special_needs",
    },
    "李老师": {
        "Student Name": "student_name",
        "Passport No": "passport_number",
        "ID Card": "id_card_number",
        "Gender": "gender",
        "DOB": "birth_date",
        "School": "school",
        "Grade": "grade",
        "Guardian": "guardian_name",
        "Parent Name": "guardian_name",
        "Contact": "guardian_phone",
        "Phone": "guardian_phone",
        "Mobile": "guardian_phone",
        "Relationship": "guardian_relation",
        "Email": "guardian_email",
        "Dietary Requirements": "diet_restriction",
        "Special Needs": "special_needs",
    },
    "张老师": {
        "名字": "student_name",
        "护照": "passport_number",
        "身份证": "id_card_number",
        "男/女": "gender",
        "生日": "birth_date",
        "所在学校": "school",
        "就读年级": "grade",
        "监护人": "guardian_name",
        "家长": "guardian_name",
        "监护人手机号": "guardian_phone",
        "家长手机号": "guardian_phone",
        "电话": "guardian_phone",
        "关系": "guardian_relation",
        "电子邮箱": "guardian_email",
        "忌口": "diet_restriction",
        "其他说明": "special_needs",
    },
}


def validate_passport(passport: str) -> Tuple[bool, str]:
    if not passport or pd.isna(passport):
        return False, "护照号为空"
    
    passport = str(passport).strip()
    if not passport:
        return False, "护照号为空"
    
    pattern = r'^[A-Z][0-9]{8}$|^[A-Z]{2}[0-9]{7,8}$'
    if not re.match(pattern, passport):
        return False, f"护照号格式错误: {passport}"
    
    return True, ""


def validate_phone(phone: str) -> Tuple[bool, str]:
    if not phone or pd.isna(phone):
        return False, "手机号为空"
    
    phone = str(phone).strip()
    if not phone:
        return False, "手机号为空"
    
    phone = re.sub(r'[\s\-\(\)]', '', phone)
    pattern = r'^1[3-9]\d{9}$|^\+861[3-9]\d{9}$'
    
    if not re.match(pattern, phone):
        return False, f"手机号格式错误: {phone}"
    
    return True, ""


def normalize_phone(phone: str) -> str:
    if not phone or pd.isna(phone):
        return ""
    
    phone = str(phone).strip()
    phone = re.sub(r'[\s\-\(\)\u00a0]', '', phone)
    
    if phone.startswith('+86'):
        phone = phone[3:]
    elif phone.startswith('86'):
        phone = phone[2:]
    
    return phone


def normalize_passport(passport: str) -> str:
    if not passport or pd.isna(passport):
        return ""
    
    return str(passport).strip().upper()


def init_header_mappings(db: Session):
    for teacher, mappings in DEFAULT_HEADER_MAPPINGS.items():
        for source_header, standard_field in mappings.items():
            existing = db.query(HeaderMapping).filter(
                HeaderMapping.source_teacher == teacher,
                HeaderMapping.source_header == source_header
            ).first()
            
            if not existing:
                db_mapping = HeaderMapping(
                    source_teacher=teacher,
                    source_header=source_header,
                    standard_field=standard_field
                )
                db.add(db_mapping)
    
    db.commit()


def get_header_mapping(db: Session, source_teacher: str) -> Dict[str, str]:
    mappings = db.query(HeaderMapping).filter(
        HeaderMapping.source_teacher == source_teacher,
        HeaderMapping.is_active == True
    ).all()
    
    result = {m.source_header: m.standard_field for m in mappings}
    
    if not result and source_teacher in DEFAULT_HEADER_MAPPINGS:
        result = DEFAULT_HEADER_MAPPINGS[source_teacher]
    
    return result


def map_headers(df: pd.DataFrame, header_mapping: Dict[str, str]) -> pd.DataFrame:
    new_columns = {}
    for col in df.columns:
        col_stripped = str(col).strip()
        if col_stripped in header_mapping:
            new_columns[col] = header_mapping[col_stripped]
        else:
            new_columns[col] = col_stripped
    
    return df.rename(columns=new_columns)


def validate_record(record: Dict[str, Any]) -> Tuple[bool, List[str]]:
    errors = []
    
    passport = record.get('passport_number', '')
    valid, msg = validate_passport(passport)
    if not valid:
        errors.append(msg)
    
    phone = record.get('guardian_phone', '')
    valid, msg = validate_phone(phone)
    if not valid:
        errors.append(msg)
    
    if not record.get('student_name'):
        errors.append("学生姓名为空")
    
    return len(errors) == 0, errors


def find_duplicates(records: List[Dict[str, Any]]) -> Dict[str, List[int]]:
    passport_groups = {}
    phone_groups = {}
    
    for idx, record in enumerate(records):
        passport = normalize_passport(record.get('passport_number', ''))
        phone = normalize_phone(record.get('guardian_phone', ''))
        
        if passport:
            if passport not in passport_groups:
                passport_groups[passport] = []
            passport_groups[passport].append(idx)
        
        if phone:
            if phone not in phone_groups:
                phone_groups[phone] = []
            phone_groups[phone].append(idx)
    
    duplicates = {}
    
    for passport, indices in passport_groups.items():
        if len(indices) > 1:
            key = f"passport_{passport}"
            duplicates[key] = indices
    
    for phone, indices in phone_groups.items():
        if len(indices) > 1:
            key = f"phone_{phone}"
            duplicates[key] = indices
    
    return duplicates


def clean_task_data(db: Session, task_id: int) -> CleaningResult:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise ValueError(f"Task {task_id} not found")
    
    task.status = "cleaning"
    db.commit()
    
    raw_records = db.query(RawRecord).filter(RawRecord.task_id == task_id).all()
    
    records_data = []
    for raw in raw_records:
        try:
            data = json.loads(raw.original_data)
            data['raw_record_id'] = raw.id
            records_data.append(data)
        except json.JSONDecodeError:
            continue
    
    exceptions = []
    valid_count = 0
    exception_count = 0
    
    for idx, record_data in enumerate(records_data):
        record_data['passport_number'] = normalize_passport(record_data.get('passport_number', ''))
        record_data['guardian_phone'] = normalize_phone(record_data.get('guardian_phone', ''))
        
        is_valid, errors = validate_record(record_data)
        
        cleaned_record = CleanedRecord(
            task_id=task_id,
            raw_record_id=record_data.get('raw_record_id'),
            student_name=record_data.get('student_name', ''),
            passport_number=record_data.get('passport_number', ''),
            id_card_number=record_data.get('id_card_number', ''),
            gender=record_data.get('gender', ''),
            birth_date=record_data.get('birth_date', ''),
            school=record_data.get('school', ''),
            grade=record_data.get('grade', ''),
            guardian_name=record_data.get('guardian_name', ''),
            guardian_phone=record_data.get('guardian_phone', ''),
            guardian_relation=record_data.get('guardian_relation', ''),
            guardian_email=record_data.get('guardian_email', ''),
            diet_restriction=record_data.get('diet_restriction', ''),
            special_needs=record_data.get('special_needs', ''),
            status="valid" if is_valid else "exception",
            exception_reason="; ".join(errors) if errors else None
        )
        
        db.add(cleaned_record)
        db.flush()
        
        if is_valid:
            valid_count += 1
        else:
            exception_count += 1
            exceptions.append({
                'raw_record_id': record_data.get('raw_record_id'),
                'record_id': cleaned_record.id,
                'errors': errors,
                'original_data': record_data
            })
    
    db.commit()
    
    cleaned_records = db.query(CleanedRecord).filter(
        CleanedRecord.task_id == task_id,
        CleanedRecord.status == "valid"
    ).all()
    
    records_for_dup = [{
        'id': r.id,
        'passport_number': r.passport_number,
        'guardian_phone': r.guardian_phone
    } for r in cleaned_records]
    
    duplicates = find_duplicates(records_for_dup)
    duplicate_count = 0
    
    for key, record_ids in duplicates.items():
        if len(record_ids) > 1:
            duplicate_count += len(record_ids) - 1
            keep_id = record_ids[0]
            for dup_id in record_ids[1:]:
                dup_record = db.query(CleanedRecord).filter(CleanedRecord.id == dup_id).first()
                if dup_record:
                    dup_record.status = "duplicate"
                    dup_record.is_duplicate = True
                    dup_record.duplicate_with = keep_id
    
    task.total_records = len(records_data)
    task.valid_records = valid_count - duplicate_count
    task.exception_records = exception_count
    task.duplicate_records = duplicate_count
    task.status = "cleaned"
    
    report_content = json.dumps({
        'exceptions': exceptions,
        'duplicate_groups': duplicates
    }, ensure_ascii=False)
    
    report = CleanReport(
        task_id=task_id,
        report_type="summary",
        content=report_content,
        generated_by="system"
    )
    db.add(report)
    
    audit_log = AuditLog(
        task_id=task_id,
        action="clean",
        handler="system",
        conclusion=f"清洗完成，共处理{len(records_data)}条记录，有效{valid_count}条，异常{exception_count}条，重复{duplicate_count}条"
    )
    db.add(audit_log)
    
    db.commit()
    
    return CleaningResult(
        task_id=task_id,
        total_processed=len(records_data),
        valid_count=valid_count - duplicate_count,
        exception_count=exception_count,
        duplicate_count=duplicate_count,
        exceptions=exceptions,
        duplicates=[{'group': k, 'record_ids': v} for k, v in duplicates.items()]
    )
