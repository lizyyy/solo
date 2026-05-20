import pandas as pd
import json
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import Batch, ClassList, MedicationAuthorization, MorningCheckRecord
import uuid


def generate_batch_number():
    return f"BATCH-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"


def create_batch(db: Session, name: str, created_by: str) -> Batch:
    batch_number = generate_batch_number()
    db_batch = Batch(
        batch_number=batch_number,
        name=name,
        created_by=created_by,
        status="importing"
    )
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch


def import_class_list_csv(db: Session, batch_id: int, csv_content: str) -> int:
    from io import StringIO
    df = pd.read_csv(StringIO(csv_content))
    
    count = 0
    for _, row in df.iterrows():
        class_list = ClassList(
            batch_id=batch_id,
            class_name=str(row.get('班级', row.get('class_name', ''))),
            class_teacher=str(row.get('班主任', row.get('class_teacher', ''))),
            student_id=str(row.get('学号', row.get('student_id', ''))),
            student_name=str(row.get('姓名', row.get('student_name', ''))),
            parent_name=str(row.get('家长姓名', row.get('parent_name', ''))),
            parent_phone=str(row.get('家长电话', row.get('parent_phone', '')))
        )
        db.add(class_list)
        count += 1
    
    db.commit()
    return count


def import_medication_json(db: Session, batch_id: int, json_content: str) -> int:
    data = json.loads(json_content)
    if isinstance(data, dict) and 'authorizations' in data:
        data = data['authorizations']
    
    count = 0
    for item in data:
        exp_date_str = item.get('expiration_date', item.get('药品有效期', ''))
        try:
            exp_date = datetime.strptime(exp_date_str, '%Y-%m-%d')
        except:
            exp_date = None
        
        signed_at_str = item.get('signed_at', item.get('签署时间', None))
        if signed_at_str:
            try:
                signed_at = datetime.strptime(signed_at_str, '%Y-%m-%d %H:%M:%S')
            except:
                signed_at = None
        else:
            signed_at = None
        
        med_auth = MedicationAuthorization(
            batch_id=batch_id,
            student_id=str(item.get('student_id', item.get('学号', ''))),
            student_name=str(item.get('student_name', item.get('学生姓名', ''))),
            medication_name=str(item.get('medication_name', item.get('药品名称', ''))),
            dosage=str(item.get('dosage', item.get('剂量', ''))),
            expiration_date=exp_date,
            parent_signature=str(item.get('parent_signature', item.get('家长签名', ''))),
            signed_at=signed_at
        )
        db.add(med_auth)
        count += 1
    
    db.commit()
    return count


def import_morning_check_csv(db: Session, batch_id: int, csv_content: str) -> int:
    from io import StringIO
    df = pd.read_csv(StringIO(csv_content))
    
    med_auths = db.query(MedicationAuthorization).filter(
        MedicationAuthorization.batch_id == batch_id
    ).all()
    med_auth_map = {m.student_id: m for m in med_auths}
    
    class_lists = db.query(ClassList).filter(
        ClassList.batch_id == batch_id
    ).all()
    class_list_map = {c.student_id: c for c in class_lists}
    
    count = 0
    for _, row in df.iterrows():
        check_time_str = str(row.get('检查时间', row.get('check_time', datetime.now().isoformat())))
        try:
            check_time = datetime.strptime(check_time_str, '%Y-%m-%d %H:%M:%S')
        except:
            check_time = datetime.now()
        
        temp_str = str(row.get('体温', row.get('temperature', 36.5)))
        try:
            temperature = float(temp_str)
        except:
            temperature = 36.5
        
        student_id = str(row.get('学号', row.get('student_id', '')))
        
        medication_id = None
        parent_signature = None
        parent_confirmed = False
        
        if student_id in med_auth_map:
            med_auth = med_auth_map[student_id]
            medication_id = med_auth.id
            if med_auth.parent_signature:
                parent_signature = med_auth.parent_signature
                parent_confirmed = True
        
        record = MorningCheckRecord(
            batch_id=batch_id,
            student_id=student_id,
            student_name=str(row.get('姓名', row.get('student_name', ''))),
            class_name=str(row.get('班级', row.get('class_name', ''))),
            class_teacher=str(row.get('班主任', row.get('class_teacher', ''))),
            temperature=temperature,
            check_time=check_time,
            symptoms=str(row.get('症状', row.get('symptoms', ''))),
            status="pending",
            medication_id=medication_id,
            parent_signature=parent_signature,
            parent_confirmed=parent_confirmed
        )
        db.add(record)
        count += 1
    
    db.commit()
    
    db_batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if db_batch:
        db_batch.total_records = count
        db_batch.status = "pending"
        db.commit()
    
    return count
