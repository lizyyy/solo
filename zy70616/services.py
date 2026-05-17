from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from datetime import date, datetime, timedelta
from typing import List, Optional, Dict, Any
import json

from models import (
    Employee, CertificateType, EmployeeCertificate, CourseScore,
    RetakeRecord, PositionRequirement, RenewalItem, OperationLog,
    CertificateStatus, ExamStatus, RetakeStatus, RenewalStatus, QualificationMatch
)
import schemas


class EmployeeService:
    @staticmethod
    def create_employee(db: Session, employee: schemas.EmployeeCreate) -> Employee:
        db_employee = Employee(**employee.model_dump())
        db.add(db_employee)
        db.commit()
        db.refresh(db_employee)
        return db_employee

    @staticmethod
    def get_employee(db: Session, employee_id: str) -> Optional[Employee]:
        return db.query(Employee).filter(Employee.employee_id == employee_id).first()

    @staticmethod
    def get_all_employees(db: Session, skip: int = 0, limit: int = 100) -> List[Employee]:
        return db.query(Employee).offset(skip).limit(limit).all()


class CertificateService:
    @staticmethod
    def create_certificate_type(db: Session, cert_type: schemas.CertificateTypeCreate) -> CertificateType:
        db_cert_type = CertificateType(**cert_type.model_dump())
        db.add(db_cert_type)
        db.commit()
        db.refresh(db_cert_type)
        return db_cert_type

    @staticmethod
    def create_employee_certificate(db: Session, cert: schemas.EmployeeCertificateCreate) -> EmployeeCertificate:
        status = CertificateService._calculate_certificate_status(cert.issue_date, cert.expiry_date)
        db_cert = EmployeeCertificate(**cert.model_dump(), status=status)
        db.add(db_cert)
        db.commit()
        db.refresh(db_cert)
        return db_cert

    @staticmethod
    def _calculate_certificate_status(issue_date: date, expiry_date: date) -> CertificateStatus:
        today = date.today()
        if today > expiry_date:
            return CertificateStatus.EXPIRED
        elif (expiry_date - today).days <= 90:
            return CertificateStatus.EXPIRING_SOON
        return CertificateStatus.VALID

    @staticmethod
    def update_certificate_statuses(db: Session) -> int:
        today = date.today()
        certificates = db.query(EmployeeCertificate).all()
        updated_count = 0
        for cert in certificates:
            new_status = CertificateService._calculate_certificate_status(cert.issue_date, cert.expiry_date)
            if cert.status != new_status:
                cert.status = new_status
                updated_count += 1
        db.commit()
        return updated_count

    @staticmethod
    def get_expiring_certificates(db: Session, days: int = 90) -> List[EmployeeCertificate]:
        today = date.today()
        target_date = today + timedelta(days=days)
        return db.query(EmployeeCertificate).filter(
            and_(
                EmployeeCertificate.expiry_date <= target_date,
                EmployeeCertificate.status != CertificateStatus.EXPIRED
            )
        ).all()

    @staticmethod
    def get_employee_certificates(db: Session, employee_id: int) -> List[EmployeeCertificate]:
        return db.query(EmployeeCertificate).filter(EmployeeCertificate.employee_id == employee_id).all()


class CourseService:
    @staticmethod
    def create_course_score(db: Session, score: schemas.CourseScoreCreate) -> CourseScore:
        status = ExamStatus.PASSED if score.score >= 60 else ExamStatus.FAILED
        db_score = CourseScore(**score.model_dump(), status=status)
        db.add(db_score)
        db.commit()
        db.refresh(db_score)
        
        if status == ExamStatus.FAILED:
            RetakeService.create_retake_for_failed_exam(db, db_score)
        
        return db_score

    @staticmethod
    def get_employee_courses(db: Session, employee_id: int) -> List[CourseScore]:
        return db.query(CourseScore).filter(CourseScore.employee_id == employee_id).all()


class RetakeService:
    @staticmethod
    def create_retake_for_failed_exam(db: Session, course_score: CourseScore) -> RetakeRecord:
        existing = db.query(RetakeRecord).filter(
            RetakeRecord.course_score_id == course_score.id
        ).first()
        if existing:
            return existing
        
        retake = RetakeRecord(
            employee_id=course_score.employee_id,
            course_score_id=course_score.id,
            attempt_number=1,
            status=RetakeStatus.NOT_STARTED
        )
        db.add(retake)
        db.commit()
        db.refresh(retake)
        return retake

    @staticmethod
    def create_retake_record(db: Session, retake: schemas.RetakeRecordCreate) -> RetakeRecord:
        db_retake = RetakeRecord(**retake.model_dump())
        db.add(db_retake)
        db.commit()
        db.refresh(db_retake)
        return db_retake

    @staticmethod
    def update_retake_record(db: Session, retake_id: int, update: schemas.RetakeRecordUpdate) -> Optional[RetakeRecord]:
        retake = db.query(RetakeRecord).filter(RetakeRecord.id == retake_id).first()
        if not retake:
            return None
        
        for key, value in update.model_dump(exclude_unset=True).items():
            setattr(retake, key, value)
        
        if update.score is not None:
            if update.score >= 60:
                retake.status = RetakeStatus.COMPLETED_PASSED
            else:
                retake.status = RetakeStatus.COMPLETED_FAILED
        
        db.commit()
        db.refresh(retake)
        return retake

    @staticmethod
    def get_employee_retakes(db: Session, employee_id: int) -> List[RetakeRecord]:
        return db.query(RetakeRecord).filter(RetakeRecord.employee_id == employee_id).all()

    @staticmethod
    def get_pending_retakes(db: Session) -> List[RetakeRecord]:
        return db.query(RetakeRecord).filter(
            RetakeStatus.status.in_([RetakeStatus.NOT_STARTED, RetakeStatus.SCHEDULED])
        ).all()


class QualificationService:
    @staticmethod
    def create_position_requirement(db: Session, req: schemas.PositionRequirementCreate) -> PositionRequirement:
        db_req = PositionRequirement(**req.model_dump())
        db.add(db_req)
        db.commit()
        db.refresh(db_req)
        QualificationService.evaluate_qualification(db, db_req.id)
        return db_req

    @staticmethod
    def evaluate_qualification(db: Session, req_id: int) -> Optional[PositionRequirement]:
        req = db.query(PositionRequirement).filter(PositionRequirement.id == req_id).first()
        if not req:
            return None

        employee_certs = CertificateService.get_employee_certificates(db, req.employee_id)
        employee_courses = CourseService.get_employee_courses(db, req.employee_id)
        
        required_certs = json.loads(req.required_certificate_types) if req.required_certificate_types else []
        required_courses = json.loads(req.required_courses) if req.required_courses else []
        
        match_details = {
            "certificates": [],
            "courses": []
        }
        
        cert_matched_count = 0
        for cert_code in required_certs:
            cert_type = db.query(CertificateType).filter(CertificateType.code == cert_code).first()
            if cert_type:
                has_cert = any(
                    ec.certificate_type_id == cert_type.id and 
                    ec.status == CertificateStatus.VALID
                    for ec in employee_certs
                )
                match_details["certificates"].append({
                    "code": cert_code,
                    "matched": has_cert
                })
                if has_cert:
                    cert_matched_count += 1
        
        course_matched_count = 0
        for course_code in required_courses:
            has_passed = any(
                ec.course_code == course_code and 
                ec.status == ExamStatus.PASSED
                for ec in employee_courses
            )
            match_details["courses"].append({
                "code": course_code,
                "matched": has_passed
            })
            if has_passed:
                course_matched_count += 1
        
        total_required = len(required_certs) + len(required_courses)
        total_matched = cert_matched_count + course_matched_count
        
        if total_matched == total_required:
            req.qualification_match = QualificationMatch.FULLY_MATCHED
        elif total_matched > 0:
            req.qualification_match = QualificationMatch.PARTIALLY_MATCHED
        else:
            req.qualification_match = QualificationMatch.NOT_MATCHED
        
        req.match_details = json.dumps(match_details, ensure_ascii=False)
        req.evaluated_at = datetime.now()
        db.commit()
        db.refresh(req)
        return req

    @staticmethod
    def get_employee_qualifications(db: Session, employee_id: int) -> List[PositionRequirement]:
        return db.query(PositionRequirement).filter(PositionRequirement.employee_id == employee_id).all()


class RenewalService:
    @staticmethod
    def create_renewal_item(db: Session, item: schemas.RenewalItemCreate) -> RenewalItem:
        existing = db.query(RenewalItem).filter(
            and_(
                RenewalItem.employee_id == item.employee_id,
                RenewalItem.employee_certificate_id == item.employee_certificate_id,
                RenewalItem.renewal_batch == item.renewal_batch,
                RenewalItem.status.not_in([RenewalStatus.WITHDRAWN, RenewalStatus.CLOSED])
            )
        ).first()
        
        if existing:
            return existing
        
        db_item = RenewalItem(**item.model_dump())
        db.add(db_item)
        db.commit()
        db.refresh(db_item)
        return db_item

    @staticmethod
    def batch_create_renewals(db: Session, renewal_batch: str, certificate_ids: List[int], 
                               due_date: date = None) -> List[RenewalItem]:
        if due_date is None:
            due_date = date.today() + timedelta(days=30)
        
        items = []
        for cert_id in certificate_ids:
            cert = db.query(EmployeeCertificate).filter(EmployeeCertificate.id == cert_id).first()
            if cert:
                item = schemas.RenewalItemCreate(
                    employee_id=cert.employee_id,
                    employee_certificate_id=cert_id,
                    renewal_batch=renewal_batch,
                    due_date=due_date
                )
                items.append(RenewalService.create_renewal_item(db, item))
        return items

    @staticmethod
    def update_renewal_status(db: Session, item_id: int, new_status: RenewalStatus, 
                               operator: str, notes: str = None) -> Optional[RenewalItem]:
        item = db.query(RenewalItem).filter(RenewalItem.id == item_id).first()
        if not item:
            return None
        
        original_status = item.status
        item.status = new_status
        
        if new_status in [RenewalStatus.APPROVED, RenewalStatus.REJECTED]:
            item.processed_at = datetime.now()
        
        log = OperationLog(
            renewal_item_id=item_id,
            operation_type="STATUS_UPDATE",
            operator=operator,
            original_input=json.dumps({"from": original_status, "to": new_status}, ensure_ascii=False),
            conclusion=f"状态从{original_status}更新为{new_status}"
        )
        db.add(log)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def manual_correction(db: Session, item_id: int, request: schemas.ManualCorrectionRequest) -> Optional[RenewalItem]:
        item = db.query(RenewalItem).filter(RenewalItem.id == item_id).first()
        if not item:
            return None
        
        original_status = item.status
        item.status = request.new_status
        item.notes = request.notes
        
        if request.new_status in [RenewalStatus.APPROVED, RenewalStatus.REJECTED]:
            item.processed_at = datetime.now()
        
        log = OperationLog(
            renewal_item_id=item_id,
            operation_type="MANUAL_CORRECTION",
            operator=request.operator,
            original_input=json.dumps({
                "original_status": request.original_status,
                "new_status": request.new_status,
                "reason": request.reason
            }, ensure_ascii=False),
            conclusion=f"人工修正: {request.reason}",
            processing_result=request.notes
        )
        db.add(log)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def withdraw_renewal(db: Session, item_id: int, operator: str, reason: str) -> Optional[RenewalItem]:
        return RenewalService.update_renewal_status(
            db, item_id, RenewalStatus.WITHDRAWN, operator, reason
        )

    @staticmethod
    def close_renewal(db: Session, item_id: int, operator: str, reason: str) -> Optional[RenewalItem]:
        return RenewalService.update_renewal_status(
            db, item_id, RenewalStatus.CLOSED, operator, reason
        )

    @staticmethod
    def get_renewal_items(db: Session, filters: schemas.RenewalFilterParams = None, 
                           skip: int = 0, limit: int = 100) -> List[RenewalItem]:
        query = db.query(RenewalItem)
        
        if filters:
            if filters.status:
                query = query.filter(RenewalItem.status == filters.status)
            if filters.renewal_batch:
                query = query.filter(RenewalItem.renewal_batch == filters.renewal_batch)
            if filters.employee_id:
                query = query.join(Employee).filter(Employee.employee_id == filters.employee_id)
            if filters.department:
                query = query.join(Employee).filter(Employee.department == filters.department)
        
        return query.offset(skip).limit(limit).all()

    @staticmethod
    def get_statistics(db: Session) -> Dict[str, Any]:
        total = db.query(func.count(RenewalItem.id)).scalar()
        
        def count_status(status):
            return db.query(func.count(RenewalItem.id)).filter(RenewalItem.status == status).scalar()
        
        today = date.today()
        expired_soon = db.query(func.count(EmployeeCertificate.id)).filter(
            and_(
                EmployeeCertificate.expiry_date <= today + timedelta(days=90),
                EmployeeCertificate.status == CertificateStatus.EXPIRING_SOON
            )
        ).scalar()
        
        expired = db.query(func.count(EmployeeCertificate.id)).filter(
            EmployeeCertificate.status == CertificateStatus.EXPIRED
        ).scalar()
        
        return {
            "total": total,
            "pending": count_status(RenewalStatus.PENDING),
            "in_progress": count_status(RenewalStatus.IN_PROGRESS),
            "approved": count_status(RenewalStatus.APPROVED),
            "rejected": count_status(RenewalStatus.REJECTED),
            "expired_soon": expired_soon or 0,
            "expired": expired or 0
        }
