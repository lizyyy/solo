from datetime import datetime, timedelta
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from ..models import (
    BorrowApplication, Seal, BorrowRecord, UsageMaterial, ReturnRecord,
    ApplicationStatus, SealStatus, ReturnVerificationResult, TimeoutLevel,
    FinalResult, StatusCorrectionType
)
from ..schemas import (
    BorrowApplicationCreate, BorrowApplicationUpdate, BorrowRecordBase,
    UsageMaterialCreate, ReturnRecordBase
)
from .status_service import StatusService
import uuid


class ApplicationService:
    @staticmethod
    def generate_application_no() -> str:
        date_str = datetime.now().strftime("%Y%m%d")
        random_str = uuid.uuid4().hex[:6].upper()
        return f"YZ-{date_str}-{random_str}"

    @staticmethod
    def create_application(
        db: Session,
        applicant: str,
        data: BorrowApplicationCreate
    ) -> Tuple[bool, str, Optional[BorrowApplication]]:
        seal = db.query(Seal).filter(Seal.id == data.seal_id).first()
        if not seal:
            return False, "印章不存在", None
        
        if seal.status != SealStatus.IN_STORAGE:
            return False, f"印章当前状态为「{seal.status.value}」，无法申请外借", None
        
        if data.planned_return_date <= data.planned_borrow_date:
            return False, "计划归还时间必须晚于借用时间", None
        
        application = BorrowApplication(
            application_no=ApplicationService.generate_application_no(),
            seal_id=data.seal_id,
            applicant_id=data.applicant_id,
            applicant_name=data.applicant_name,
            applicant_department=data.applicant_department,
            borrow_reason=data.borrow_reason,
            borrow_location=data.borrow_location,
            planned_borrow_date=data.planned_borrow_date,
            planned_return_date=data.planned_return_date,
            status=ApplicationStatus.DRAFT
        )
        
        db.add(application)
        db.flush()
        
        StatusService.record_status_change(
            db=db,
            application=application,
            new_status=ApplicationStatus.DRAFT,
            operator=applicant,
            reason="创建外借申请",
            correction_type=StatusCorrectionType.NORMAL_FLOW,
            affected_fields=["status"],
            new_values={"status": ApplicationStatus.DRAFT.value}
        )
        
        db.commit()
        db.refresh(application)
        
        return True, f"申请已创建，申请单号：{application.application_no}", application

    @staticmethod
    def submit_for_approval(
        db: Session,
        application_id: int,
        operator: str
    ) -> Tuple[bool, str]:
        application = db.query(BorrowApplication).filter(
            BorrowApplication.id == application_id
        ).first()
        
        if not application:
            return False, "申请不存在"
        
        if application.status != ApplicationStatus.DRAFT:
            return False, f"当前状态为「{application.status.value}」，无法提交审批"
        
        StatusService.record_status_change(
            db=db,
            application=application,
            new_status=ApplicationStatus.PENDING_APPROVAL,
            operator=operator,
            reason="提交外借申请待审批",
            correction_type=StatusCorrectionType.NORMAL_FLOW,
            affected_fields=["status"],
            previous_values={"status": ApplicationStatus.DRAFT.value},
            new_values={"status": ApplicationStatus.PENDING_APPROVAL.value}
        )
        
        db.commit()
        return True, f"申请已提交待审批，申请单号：{application.application_no}"

    @staticmethod
    def approve_application(
        db: Session,
        application_id: int,
        approval_person: str,
        approval_opinion: Optional[str],
        approve: bool
    ) -> Tuple[bool, str]:
        application = db.query(BorrowApplication).filter(
            BorrowApplication.id == application_id
        ).first()
        
        if not application:
            return False, "申请不存在"
        
        if application.status != ApplicationStatus.PENDING_APPROVAL:
            return False, f"当前状态为「{application.status.value}」，无法进行审批"
        
        application.approval_person = approval_person
        application.approval_opinion = approval_opinion
        application.approval_time = datetime.now()
        
        new_status = ApplicationStatus.APPROVED if approve else ApplicationStatus.REJECTED
        
        StatusService.record_status_change(
            db=db,
            application=application,
            new_status=new_status,
            operator=approval_person,
            reason=f"审批{'通过' if approve else '拒绝'}",
            correction_type=StatusCorrectionType.NORMAL_FLOW,
            affected_fields=["status", "approval_person", "approval_opinion", "approval_time"],
            previous_values={"status": ApplicationStatus.PENDING_APPROVAL.value},
            new_values={
                "status": new_status.value,
                "approval_person": approval_person,
                "approval_opinion": approval_opinion
            }
        )
        
        db.commit()
        
        if approve:
            return True, f"审批通过，申请已进入待外借状态"
        return True, f"审批已拒绝，申请已终止"

    @staticmethod
    def record_borrow(
        db: Session,
        application_id: int,
        data: BorrowRecordBase,
        operator: str
    ) -> Tuple[bool, str]:
        application = db.query(BorrowApplication).filter(
            BorrowApplication.id == application_id
        ).first()
        
        if not application:
            return False, "申请不存在"
        
        if application.status != ApplicationStatus.APPROVED:
            return False, f"当前状态为「{application.status.value}」，无法记录外借"
        
        seal = db.query(Seal).filter(Seal.id == application.seal_id).first()
        if seal.status != SealStatus.IN_STORAGE:
            return False, f"印章当前状态为「{seal.status.value}」，无法借出"
        
        borrow_record = BorrowRecord(
            application_id=application.id,
            actual_borrow_date=data.actual_borrow_date,
            borrower_signature=data.borrower_signature,
            custodian_signature=data.custodian_signature,
            borrow_remarks=data.borrow_remarks
        )
        db.add(borrow_record)
        
        seal.status = SealStatus.BORROWED
        
        StatusService.record_status_change(
            db=db,
            application=application,
            new_status=ApplicationStatus.LENDED,
            operator=operator,
            reason="记录印章外借",
            correction_type=StatusCorrectionType.NORMAL_FLOW,
            affected_fields=["status"],
            previous_values={"status": ApplicationStatus.APPROVED.value},
            new_values={"status": ApplicationStatus.LENDED.value}
        )
        
        db.commit()
        return True, f"外借记录已完成，印章已于 {data.actual_borrow_date.strftime('%Y-%m-%d %H:%M')} 借出"

    @staticmethod
    def upload_usage_material(
        db: Session,
        application_id: int,
        data: UsageMaterialCreate,
        uploader: str
    ) -> Tuple[bool, str, Optional[UsageMaterial]]:
        application = db.query(BorrowApplication).filter(
            BorrowApplication.id == application_id
        ).first()
        
        if not application:
            return False, "申请不存在", None
        
        if application.status not in [ApplicationStatus.LENDED, ApplicationStatus.TIMEOUT]:
            return False, f"当前状态为「{application.status.value}」，无法上传使用材料", None
        
        material = UsageMaterial(
            application_id=application_id,
            material_type=data.material_type,
            material_name=data.material_name,
            file_path=data.file_path,
            file_size=data.file_size,
            material_description=data.material_description,
            uploader=uploader or data.uploader,
            upload_time=datetime.now()
        )
        
        db.add(material)
        db.commit()
        db.refresh(material)
        
        return True, f"使用材料「{data.material_name}」已上传", material

    @staticmethod
    def verify_material(
        db: Session,
        material_id: int,
        verified_by: str,
        verification_remarks: Optional[str],
        is_verified: bool
    ) -> Tuple[bool, str]:
        material = db.query(UsageMaterial).filter(UsageMaterial.id == material_id).first()
        
        if not material:
            return False, "材料记录不存在"
        
        if material.is_verified:
            return False, "该材料已核验，不可重复操作"
        
        material.is_verified = is_verified
        material.verified_by = verified_by
        material.verified_at = datetime.now()
        material.verification_remarks = verification_remarks
        
        db.commit()
        
        if is_verified:
            return True, f"材料核验通过"
        return True, f"材料核验未通过，原因：{verification_remarks}"

    @staticmethod
    def _calculate_final_result(
        db: Session,
        application: BorrowApplication,
        return_record: ReturnRecord
    ) -> FinalResult:
        materials = db.query(UsageMaterial).filter(
            UsageMaterial.application_id == application.id
        ).all()
        
        verified_materials = [m for m in materials if m.is_verified]
        materials_complete = return_record.materials_complete and len(verified_materials) > 0
        
        if application.current_timeout_level in [TimeoutLevel.LEVEL3, TimeoutLevel.LEVEL4]:
            if not materials_complete:
                return FinalResult.TIMEOUT_SERIOUS
            return FinalResult.TIMEOUT_SERIOUS
        
        if return_record.verification_result == ReturnVerificationResult.SEAL_DAMAGED:
            return FinalResult.ABNORMAL_RETURN
        
        if return_record.verification_result == ReturnVerificationResult.MATERIALS_MISSING:
            return FinalResult.MATERIALS_INCOMPLETE
        
        if not materials_complete:
            return FinalResult.MATERIALS_INCOMPLETE
        
        if application.current_timeout_level in [TimeoutLevel.LEVEL1, TimeoutLevel.LEVEL2]:
            return FinalResult.NORMAL_COMPLETION
        
        return FinalResult.NORMAL_COMPLETION

    @staticmethod
    def record_return(
        db: Session,
        application_id: int,
        data: ReturnRecordBase,
        operator: str
    ) -> Tuple[bool, str]:
        application = db.query(BorrowApplication).filter(
            BorrowApplication.id == application_id
        ).first()
        
        if not application:
            return False, "申请不存在"
        
        if application.status not in [ApplicationStatus.LENDED, ApplicationStatus.TIMEOUT]:
            return False, f"当前状态为「{application.status.value}」，无法记录归还"
        
        return_record = ReturnRecord(
            application_id=application_id,
            actual_return_date=data.actual_return_date,
            verification_result=data.verification_result,
            verification_details=data.verification_details,
            verifier=data.verifier,
            returned_by=data.returned_by,
            return_remarks=data.return_remarks,
            materials_complete=data.materials_complete,
            seal_intact=data.seal_intact
        )
        db.add(return_record)
        
        final_result = ApplicationService._calculate_final_result(db, application, return_record)
        application.final_result = final_result
        
        seal = db.query(Seal).filter(Seal.id == application.seal_id).first()
        if seal:
            if data.seal_intact:
                seal.status = SealStatus.IN_STORAGE
            else:
                seal.status = SealStatus.DAMAGED
        
        previous_status = application.status
        StatusService.record_status_change(
            db=db,
            application=application,
            new_status=ApplicationStatus.RETURNED,
            operator=operator,
            reason="记录印章归还核验",
            correction_type=StatusCorrectionType.NORMAL_FLOW,
            affected_fields=["status", "final_result"],
            previous_values={"status": previous_status.value},
            new_values={
                "status": ApplicationStatus.RETURNED.value,
                "final_result": final_result.value
            }
        )
        
        db.commit()
        
        result_message = {
            FinalResult.NORMAL_COMPLETION: "正常完成",
            FinalResult.MATERIALS_INCOMPLETE: "材料不全",
            FinalResult.TIMEOUT_SERIOUS: "严重超时",
            FinalResult.ABNORMAL_RETURN: "归还异常",
            FinalResult.LOST: "丢失"
        }
        
        return True, f"归还核验完成，最终结果：{result_message[final_result]}"

    @staticmethod
    def manual_correct_status(
        db: Session,
        application_id: int,
        new_status: ApplicationStatus,
        new_timeout_level: Optional[TimeoutLevel],
        operator: str,
        reason: str
    ) -> Tuple[bool, str]:
        application = db.query(BorrowApplication).filter(
            BorrowApplication.id == application_id
        ).first()
        
        if not application:
            return False, "申请不存在"
        
        previous_values = {
            "status": application.status.value if application.status else None,
            "timeout_level": application.current_timeout_level.value if application.current_timeout_level else None
        }
        
        new_values = {
            "status": new_status.value if new_status else None,
            "timeout_level": new_timeout_level.value if new_timeout_level else None
        }
        
        affected_fields = []
        if new_status and new_status != application.status:
            affected_fields.append("status")
        if new_timeout_level is not None and new_timeout_level != application.current_timeout_level:
            affected_fields.append("current_timeout_level")
        
        if not affected_fields:
            return False, "状态未发生变化，无需修正"
        
        StatusService.record_status_change(
            db=db,
            application=application,
            new_status=new_status,
            new_timeout_level=new_timeout_level,
            operator=operator,
            reason=reason,
            correction_type=StatusCorrectionType.MANUAL_CORRECTION,
            affected_fields=affected_fields,
            previous_values=previous_values,
            new_values=new_values
        )
        
        db.commit()
        
        timeout_msg = f"，超时等级调整为「{new_timeout_level.value}」" if new_timeout_level else ""
        return True, f"人工修正完成：状态已调整为「{new_status.value}」{timeout_msg}"

    @staticmethod
    def get_application_detail(
        db: Session,
        application_id: int
    ) -> Optional[dict]:
        from sqlalchemy.orm import joinedload
        
        application = db.query(BorrowApplication).options(
            joinedload(BorrowApplication.seal),
            joinedload(BorrowApplication.borrow_records),
            joinedload(BorrowApplication.usage_materials),
            joinedload(BorrowApplication.return_records),
            joinedload(BorrowApplication.timeout_records),
            joinedload(BorrowApplication.status_histories)
        ).filter(BorrowApplication.id == application_id).first()
        
        return application
