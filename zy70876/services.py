from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import models
import schemas
from typing import List, Optional
import csv
import json
import pandas as pd
from io import BytesIO


class ValidationService:
    @staticmethod
    def validate_allocation(db: Session, student_id: int, advisor_id: int) -> schemas.ValidationResult:
        student = db.query(models.Student).filter(models.Student.id == student_id).first()
        advisor = db.query(models.Advisor).filter(models.Advisor.id == advisor_id).first()
        
        if not student or not advisor:
            return schemas.ValidationResult(valid=False, message="学生或导师不存在", error_type="not_found")
        
        existing_allocation = db.query(models.AllocationRecord).filter(
            and_(
                models.AllocationRecord.student_id == student_id,
                models.AllocationRecord.status == "approved"
            )
        ).first()
        
        if existing_allocation:
            return schemas.ValidationResult(
                valid=False, 
                message=f"学生 {student.name} 已被导师录取，无法重复分配",
                error_type="duplicate_allocation"
            )
        
        if advisor.used_quota >= advisor.total_quota:
            return schemas.ValidationResult(
                valid=False,
                message=f"导师 {advisor.name} 名额已满（已用 {advisor.used_quota}/总名额 {advisor.total_quota}）",
                error_type="quota_exceeded"
            )
        
        if student.major != advisor.major:
            return schemas.ValidationResult(
                valid=False,
                message=f"跨专业限制：学生 {student.name}（{student.major}）与导师 {advisor.name}（{advisor.major}）专业不符",
                error_type="cross_major"
            )
        
        return schemas.ValidationResult(valid=True, message="校验通过")


class AdvisorService:
    @staticmethod
    def import_advisors_from_csv(db: Session, csv_content: str, created_by: str) -> List[models.Advisor]:
        advisors = []
        reader = csv.DictReader(csv_content.splitlines())
        
        for row in reader:
            advisor_data = schemas.AdvisorCreate(
                advisor_id=row.get("advisor_id", row.get("工号", "")),
                name=row.get("name", row.get("姓名", "")),
                department=row.get("department", row.get("院系", "")),
                major=row.get("major", row.get("专业", "")),
                research_direction=row.get("research_direction", row.get("研究方向", "")),
                total_quota=int(row.get("total_quota", row.get("名额", 0)))
            )
            
            existing = db.query(models.Advisor).filter(
                models.Advisor.advisor_id == advisor_data.advisor_id
            ).first()
            
            if existing:
                for key, value in advisor_data.dict(exclude_unset=True).items():
                    setattr(existing, key, value)
                advisors.append(existing)
            else:
                db_advisor = models.Advisor(**advisor_data.dict())
                db.add(db_advisor)
                advisors.append(db_advisor)
        
        db.commit()
        return advisors


class StudentService:
    @staticmethod
    def import_preferences_from_json(db: Session, json_content: str, created_by: str) -> List[models.Preference]:
        data = json.loads(json_content)
        preferences = []
        
        for item in data:
            student_data = schemas.StudentCreate(
                student_id=item.get("student_id", item.get("学号", "")),
                name=item.get("name", item.get("姓名", "")),
                department=item.get("department", item.get("院系", "")),
                major=item.get("major", item.get("专业", "")),
                exam_score=float(item.get("exam_score", item.get("分数", 0)))
            )
            
            db_student = db.query(models.Student).filter(
                models.Student.student_id == student_data.student_id
            ).first()
            
            if not db_student:
                db_student = models.Student(**student_data.dict())
                db.add(db_student)
                db.flush()
            
            pref_list = item.get("preferences", item.get("志愿", []))
            for idx, pref_item in enumerate(pref_list, 1):
                advisor_id = pref_item.get("advisor_id", pref_item.get("导师工号", ""))
                db_advisor = db.query(models.Advisor).filter(
                    models.Advisor.advisor_id == advisor_id
                ).first()
                
                if db_advisor:
                    existing_pref = db.query(models.Preference).filter(
                        and_(
                            models.Preference.student_id == db_student.id,
                            models.Preference.advisor_id == db_advisor.id
                        )
                    ).first()
                    
                    if not existing_pref:
                        pref = models.Preference(
                            student_id=db_student.id,
                            advisor_id=db_advisor.id,
                            priority=idx
                        )
                        db.add(pref)
                        preferences.append(pref)
        
        db.commit()
        return preferences


class BatchService:
    @staticmethod
    def create_batch(db: Session, batch: schemas.BatchCreate) -> models.Batch:
        db_batch = models.Batch(**batch.dict())
        db.add(db_batch)
        db.commit()
        db.refresh(db_batch)
        return db_batch
    
    @staticmethod
    def get_batches(db: Session, skip: int = 0, limit: int = 100) -> List[models.Batch]:
        return db.query(models.Batch).offset(skip).limit(limit).all()


class AllocationService:
    @staticmethod
    def create_allocation(db: Session, allocation: schemas.AllocationRecordCreate) -> models.AllocationRecord:
        validation = ValidationService.validate_allocation(db, allocation.student_id, allocation.advisor_id)
        
        db_allocation = models.AllocationRecord(**allocation.dict())
        
        if not validation.valid:
            db_allocation.status = "rejected"
        
        db.add(db_allocation)
        db.commit()
        db.refresh(db_allocation)
        
        if not validation.valid:
            AuditLogService.create_audit_log(
                db,
                schemas.AuditLogCreate(
                    allocation_id=db_allocation.id,
                    action="auto_reject",
                    reason=validation.message,
                    operator="system",
                    previous_status="pending",
                    new_status="rejected"
                )
            )
        
        return db_allocation
    
    @staticmethod
    def process_allocation(db: Session, allocation_id: int, process_request: schemas.ProcessRequest) -> models.AllocationRecord:
        allocation = db.query(models.AllocationRecord).filter(models.AllocationRecord.id == allocation_id).first()
        if not allocation:
            return None
        
        previous_status = allocation.status
        new_status = process_request.status
        
        if new_status == "approved" and previous_status != "approved":
            validation = ValidationService.validate_allocation(db, allocation.student_id, allocation.advisor_id)
            if not validation.valid:
                raise ValueError(validation.message)
            
            advisor = db.query(models.Advisor).filter(models.Advisor.id == allocation.advisor_id).first()
            if advisor:
                advisor.used_quota += 1
            
            student = db.query(models.Student).filter(models.Student.id == allocation.student_id).first()
            if student:
                student.status = "allocated"
                student.advisor_id = allocation.advisor_id
        
        elif previous_status == "approved" and new_status != "approved":
            advisor = db.query(models.Advisor).filter(models.Advisor.id == allocation.advisor_id).first()
            if advisor and advisor.used_quota > 0:
                advisor.used_quota -= 1
            
            student = db.query(models.Student).filter(models.Student.id == allocation.student_id).first()
            if student:
                student.status = "pending"
                student.advisor_id = None
        
        allocation.status = new_status
        
        AuditLogService.create_audit_log(
            db,
            schemas.AuditLogCreate(
                allocation_id=allocation.id,
                action="status_change",
                reason=process_request.reason,
                operator=process_request.operator,
                previous_status=previous_status,
                new_status=new_status
            )
        )
        
        db.commit()
        db.refresh(allocation)
        return allocation
    
    @staticmethod
    def query_allocations(
        db: Session,
        advisor_id: Optional[int] = None,
        student_id: Optional[int] = None,
        batch_id: Optional[int] = None,
        status: Optional[str] = None,
        research_direction: Optional[str] = None,
        major: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[models.AllocationRecord]:
        query = db.query(models.AllocationRecord)
        
        if advisor_id:
            query = query.filter(models.AllocationRecord.advisor_id == advisor_id)
        if student_id:
            query = query.filter(models.AllocationRecord.student_id == student_id)
        if batch_id:
            query = query.filter(models.AllocationRecord.batch_id == batch_id)
        if status:
            query = query.filter(models.AllocationRecord.status == status)
        if research_direction:
            query = query.join(models.Advisor).filter(models.Advisor.research_direction.contains(research_direction))
        if major:
            query = query.join(models.Student).filter(models.Student.major == major)
        
        return query.offset(skip).limit(limit).all()
    
    @staticmethod
    def get_allocation_detail(db: Session, allocation_id: int) -> Optional[models.AllocationRecord]:
        return db.query(models.AllocationRecord).filter(models.AllocationRecord.id == allocation_id).first()
    
    @staticmethod
    def export_to_excel(db: Session, export_request: schemas.ExportRequest) -> BytesIO:
        allocations = AllocationService.query_allocations(
            db,
            advisor_id=export_request.advisor_id,
            student_id=export_request.student_id,
            batch_id=export_request.batch_id,
            status=export_request.status,
            research_direction=export_request.research_direction,
            major=export_request.major,
            limit=10000
        )
        
        data = []
        for alloc in allocations:
            student = db.query(models.Student).filter(models.Student.id == alloc.student_id).first()
            advisor = db.query(models.Advisor).filter(models.Advisor.id == alloc.advisor_id).first()
            batch = db.query(models.Batch).filter(models.Batch.id == alloc.batch_id).first()
            
            audit_logs = db.query(models.AuditLog).filter(models.AuditLog.allocation_id == alloc.id).all()
            audit_summary = " | ".join([f"{log.operator}@{log.created_at.strftime('%Y-%m-%d %H:%M')}: {log.reason}" for log in audit_logs])
            
            data.append({
                "分配记录ID": alloc.id,
                "学号": student.student_id if student else "",
                "学生姓名": student.name if student else "",
                "学生专业": student.major if student else "",
                "导师工号": advisor.advisor_id if advisor else "",
                "导师姓名": advisor.name if advisor else "",
                "导师专业": advisor.major if advisor else "",
                "研究方向": advisor.research_direction if advisor else "",
                "批次代码": batch.batch_code if batch else "",
                "批次名称": batch.batch_name if batch else "",
                "分配类型": alloc.allocation_type,
                "状态": alloc.status,
                "创建人": alloc.created_by,
                "创建时间": alloc.created_at.strftime('%Y-%m-%d %H:%M:%S') if alloc.created_at else "",
                "审计追踪": audit_summary
            })
        
        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='分配明细')
        output.seek(0)
        return output


class AdjustmentService:
    @staticmethod
    def create_adjustment(db: Session, adjustment: schemas.AdjustmentRecordCreate) -> models.AdjustmentRecord:
        db_adjustment = models.AdjustmentRecord(**adjustment.dict())
        db.add(db_adjustment)
        db.commit()
        db.refresh(db_adjustment)
        return db_adjustment
    
    @staticmethod
    def import_adjustments(db: Session, adjustments_data: List[dict], created_by: str) -> List[models.AdjustmentRecord]:
        records = []
        for item in adjustments_data:
            student = db.query(models.Student).filter(models.Student.student_id == item.get("student_id")).first()
            from_advisor = db.query(models.Advisor).filter(models.Advisor.advisor_id == item.get("from_advisor_id")).first() if item.get("from_advisor_id") else None
            to_advisor = db.query(models.Advisor).filter(models.Advisor.advisor_id == item.get("to_advisor_id")).first()
            batch = db.query(models.Batch).filter(models.Batch.batch_code == item.get("batch_code")).first()
            
            if student and to_advisor and batch:
                record = models.AdjustmentRecord(
                    student_id=student.id,
                    batch_id=batch.id,
                    from_advisor_id=from_advisor.id if from_advisor else None,
                    to_advisor_id=to_advisor.id,
                    reason=item.get("reason", ""),
                    created_by=created_by
                )
                db.add(record)
                records.append(record)
        
        db.commit()
        return records


class AuditLogService:
    @staticmethod
    def create_audit_log(db: Session, log: schemas.AuditLogCreate) -> models.AuditLog:
        db_log = models.AuditLog(**log.dict())
        db.add(db_log)
        db.commit()
        db.refresh(db_log)
        return db_log
    
    @staticmethod
    def get_audit_logs(db: Session, allocation_id: int) -> List[models.AuditLog]:
        return db.query(models.AuditLog).filter(models.AuditLog.allocation_id == allocation_id).order_by(models.AuditLog.created_at.desc()).all()
