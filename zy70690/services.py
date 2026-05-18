from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional, Dict, Any
from datetime import datetime
import json
from models import (
    Participant, PersonMaterial, ReturnReason, CertificateBatch,
    BatchItem, BatchReport, MaterialVersionHistory, IDCardRule,
    MaterialStatus, ReportStatus, ParticipantType, IDCardType
)
from schemas import (
    ParticipantCreate, ParticipantUpdate,
    PersonMaterialCreate, PersonMaterialUpdate,
    ReturnReasonCreate, BatchCreate,
    ErrorCodes
)

class BusinessException(Exception):
    def __init__(self, error_code: str, message: str, details: dict = None):
        self.error_code = error_code
        self.message = message
        self.details = details or {}

class MaterialStateMachine:
    VALID_TRANSITIONS = {
        MaterialStatus.DRAFT: [MaterialStatus.SUBMITTED],
        MaterialStatus.SUBMITTED: [MaterialStatus.UNDER_REVIEW, MaterialStatus.RETURNED, MaterialStatus.APPROVED],
        MaterialStatus.UNDER_REVIEW: [MaterialStatus.APPROVED, MaterialStatus.RETURNED, MaterialStatus.NEEDS_MANUAL_REVIEW],
        MaterialStatus.RETURNED: [MaterialStatus.RESUBMITTED, MaterialStatus.REJECTED],
        MaterialStatus.RESUBMITTED: [MaterialStatus.UNDER_REVIEW, MaterialStatus.RETURNED, MaterialStatus.APPROVED],
        MaterialStatus.NEEDS_MANUAL_REVIEW: [MaterialStatus.APPROVED, MaterialStatus.RETURNED, MaterialStatus.REJECTED],
        MaterialStatus.APPROVED: [MaterialStatus.PROCESSED],
        MaterialStatus.REJECTED: [],
        MaterialStatus.PROCESSED: []
    }

    @classmethod
    def can_transition(cls, current_status: MaterialStatus, target_status: MaterialStatus) -> bool:
        return target_status in cls.VALID_TRANSITIONS.get(current_status, [])

    @classmethod
    def validate_transition(cls, current_status: MaterialStatus, target_status: MaterialStatus):
        if not cls.can_transition(current_status, target_status):
            raise BusinessException(
                ErrorCodes.INVALID_STATUS,
                f"无法从状态 {current_status.value} 转换到 {target_status.value}",
                {"current_status": current_status.value, "target_status": target_status.value}
            )

class ParticipantService:
    @staticmethod
    def create_participant(db: Session, participant: ParticipantCreate) -> Participant:
        existing = db.query(Participant).filter(
            Participant.participant_code == participant.participant_code
        ).first()
        if existing:
            raise BusinessException(
                ErrorCodes.DUPLICATE_SUBMISSION,
                f"参展主体代码已存在",
                {"participant_code": participant.participant_code}
            )
        
        db_participant = Participant(**participant.dict())
        db.add(db_participant)
        db.commit()
        db.refresh(db_participant)
        return db_participant

    @staticmethod
    def get_participant_by_code(db: Session, code: str) -> Optional[Participant]:
        return db.query(Participant).filter(Participant.participant_code == code).first()

    @staticmethod
    def list_participants(db: Session, type: Optional[ParticipantType] = None, skip: int = 0, limit: int = 100):
        query = db.query(Participant)
        if type:
            query = query.filter(Participant.type == type)
        return query.offset(skip).limit(limit).all()

class ReturnReasonService:
    @staticmethod
    def create_reason(db: Session, reason: ReturnReasonCreate) -> ReturnReason:
        existing = db.query(ReturnReason).filter(ReturnReason.code == reason.code).first()
        if existing:
            raise BusinessException(ErrorCodes.DUPLICATE_SUBMISSION, "退回原因代码已存在")
        db_reason = ReturnReason(**reason.dict())
        db.add(db_reason)
        db.commit()
        db.refresh(db_reason)
        return db_reason

    @staticmethod
    def get_reason_by_code(db: Session, code: str) -> Optional[ReturnReason]:
        return db.query(ReturnReason).filter(ReturnReason.code == code).first()

    @staticmethod
    def list_reasons(db: Session):
        return db.query(ReturnReason).filter(ReturnReason.is_active == True).all()

class MaterialService:
    @staticmethod
    def _save_version_history(db: Session, material: PersonMaterial, created_by: str = None):
        history = MaterialVersionHistory(
            material_id=material.id,
            version=material.version,
            status=material.status,
            name=material.name,
            id_card_number=material.id_card_number,
            phone=material.phone,
            email=material.email,
            photo_url=material.photo_url,
            company=material.company,
            position=material.position,
            return_reason_id=material.current_return_reason_id,
            return_note=material.return_note,
            created_by=created_by
        )
        db.add(history)

    @staticmethod
    def create_material(db: Session, material: PersonMaterialCreate) -> PersonMaterial:
        participant = ParticipantService.get_participant_by_code(db, material.participant_code)
        if not participant:
            raise BusinessException(ErrorCodes.NOT_FOUND, "参展主体不存在")

        existing = db.query(PersonMaterial).filter(
            PersonMaterial.material_code == material.material_code
        ).first()
        if existing:
            raise BusinessException(ErrorCodes.DUPLICATE_SUBMISSION, "材料代码已存在")

        IDCardRuleService.check_participant_type_allowed(db, material.id_card_type, participant)
        IDCardRuleService.check_participant_limit(db, material.id_card_type, participant.id)
        
        material_data = material.dict(exclude={"participant_code"})
        IDCardRuleService.validate_material_for_card_type(db, material.id_card_type, material_data)
        
        material_data["participant_id"] = participant.id
        
        db_material = PersonMaterial(**material_data)
        db.add(db_material)
        db.flush()
        
        MaterialService._save_version_history(db, db_material)
        
        db.commit()
        db.refresh(db_material)
        return db_material

    @staticmethod
    def get_material_by_code(db: Session, code: str) -> Optional[PersonMaterial]:
        return db.query(PersonMaterial).filter(PersonMaterial.material_code == code).first()

    @staticmethod
    def submit_material(db: Session, material_code: str, idempotency_key: str = None) -> PersonMaterial:
        material = MaterialService.get_material_by_code(db, material_code)
        if not material:
            raise BusinessException(ErrorCodes.NOT_FOUND, "材料不存在")

        if idempotency_key:
            existing = db.query(PersonMaterial).filter(
                PersonMaterial.idempotency_key == idempotency_key
            ).first()
            if existing and existing.id != material.id:
                raise BusinessException(
                    ErrorCodes.DUPLICATE_SUBMISSION,
                    "该请求已处理过",
                    {"idempotency_key": idempotency_key}
                )
            material.idempotency_key = idempotency_key

        MaterialStateMachine.validate_transition(material.status, MaterialStatus.SUBMITTED)
        material.status = MaterialStatus.SUBMITTED
        material.submitted_at = datetime.utcnow()
        
        MaterialService._save_version_history(db, material)
        
        db.commit()
        db.refresh(material)
        return material

    @staticmethod
    def return_material(db: Session, material_code: str, return_reason_code: str, return_note: str = None) -> PersonMaterial:
        material = MaterialService.get_material_by_code(db, material_code)
        if not material:
            raise BusinessException(ErrorCodes.NOT_FOUND, "材料不存在")

        if material.status in [MaterialStatus.PROCESSED, MaterialStatus.REJECTED]:
            raise BusinessException(
                ErrorCodes.ALREADY_PROCESSED,
                f"材料已处于终态，无法退回",
                {"current_status": material.status.value}
            )

        return_reason = ReturnReasonService.get_reason_by_code(db, return_reason_code)
        if not return_reason:
            raise BusinessException(ErrorCodes.NOT_FOUND, "退回原因不存在")

        MaterialStateMachine.validate_transition(material.status, MaterialStatus.RETURNED)
        material.status = MaterialStatus.RETURNED
        material.current_return_reason_id = return_reason.id
        material.return_note = return_note
        material.reviewed_at = datetime.utcnow()
        
        MaterialService._save_version_history(db, material)
        
        if return_reason.needs_manual_review:
            raise BusinessException(
                ErrorCodes.NEEDS_MANUAL_REVIEW,
                "该退回原因需要人工复核",
                {"return_reason_code": return_reason_code}
            )
        
        db.commit()
        db.refresh(material)
        return material

    @staticmethod
    def resubmit_material(db: Session, material_code: str, update_data: PersonMaterialUpdate = None) -> PersonMaterial:
        material = MaterialService.get_material_by_code(db, material_code)
        if not material:
            raise BusinessException(ErrorCodes.NOT_FOUND, "材料不存在")

        MaterialStateMachine.validate_transition(material.status, MaterialStatus.RESUBMITTED)
        
        MaterialService._save_version_history(db, material)
        
        material.version += 1
        material.status = MaterialStatus.RESUBMITTED
        material.submitted_at = datetime.utcnow()
        material.current_return_reason_id = None
        material.return_note = None
        
        if update_data:
            for key, value in update_data.dict(exclude_unset=True).items():
                setattr(material, key, value)
        
        MaterialService._save_version_history(db, material)
        
        db.commit()
        db.refresh(material)
        return material

    @staticmethod
    def approve_material(db: Session, material_code: str) -> PersonMaterial:
        material = MaterialService.get_material_by_code(db, material_code)
        if not material:
            raise BusinessException(ErrorCodes.NOT_FOUND, "材料不存在")

        if material.status in [MaterialStatus.PROCESSED, MaterialStatus.REJECTED]:
            raise BusinessException(
                ErrorCodes.ALREADY_PROCESSED,
                "材料已处于终态"
            )

        MaterialStateMachine.validate_transition(material.status, MaterialStatus.APPROVED)
        material.status = MaterialStatus.APPROVED
        material.reviewed_at = datetime.utcnow()
        
        MaterialService._save_version_history(db, material)
        
        db.commit()
        db.refresh(material)
        return material

    @staticmethod
    def list_materials(db: Session, participant_code: str = None, status: MaterialStatus = None, 
                       id_card_type: IDCardType = None, skip: int = 0, limit: int = 100):
        query = db.query(PersonMaterial)
        if participant_code:
            participant = ParticipantService.get_participant_by_code(db, participant_code)
            if participant:
                query = query.filter(PersonMaterial.participant_id == participant.id)
        if status:
            query = query.filter(PersonMaterial.status == status)
        if id_card_type:
            query = query.filter(PersonMaterial.id_card_type == id_card_type)
        return query.offset(skip).limit(limit).all()

class BatchService:
    @staticmethod
    def create_batch(db: Session, batch_data: BatchCreate) -> CertificateBatch:
        existing = db.query(CertificateBatch).filter(
            CertificateBatch.batch_code == batch_data.batch_code
        ).first()
        if existing:
            raise BusinessException(ErrorCodes.DUPLICATE_SUBMISSION, "批次代码已存在")
        
        batch = CertificateBatch(
            batch_code=batch_data.batch_code,
            name=batch_data.name,
            description=batch_data.description,
            id_card_type=batch_data.id_card_type,
            total_count=0
        )
        db.add(batch)
        db.flush()
        
        for material_code in batch_data.material_codes:
            material = MaterialService.get_material_by_code(db, material_code)
            if material:
                batch_item = BatchItem(
                    batch_id=batch.id,
                    material_id=material.id,
                    material_version=material.version,
                    status_at_batch_time=material.status,
                    is_returned=False
                )
                db.add(batch_item)
                batch.total_count += 1
        
        db.commit()
        db.refresh(batch)
        return batch

    @staticmethod
    def get_batch_by_code(db: Session, code: str) -> Optional[CertificateBatch]:
        return db.query(CertificateBatch).filter(CertificateBatch.batch_code == code).first()

    @staticmethod
    def add_materials_to_batch(db: Session, batch_code: str, material_codes: List[str]) -> CertificateBatch:
        batch = BatchService.get_batch_by_code(db, batch_code)
        if not batch:
            raise BusinessException(ErrorCodes.NOT_FOUND, "批次不存在")
        
        for material_code in material_codes:
            material = MaterialService.get_material_by_code(db, material_code)
            if material:
                existing = db.query(BatchItem).filter(
                    BatchItem.batch_id == batch.id,
                    BatchItem.material_id == material.id
                ).first()
                if not existing:
                    batch_item = BatchItem(
                        batch_id=batch.id,
                        material_id=material.id,
                        material_version=material.version,
                        status_at_batch_time=material.status,
                        is_returned=False
                    )
                    db.add(batch_item)
                    batch.total_count += 1
        
        db.commit()
        db.refresh(batch)
        return batch

    @staticmethod
    def return_batch_materials(db: Session, batch_code: str, return_items: List[dict]) -> CertificateBatch:
        batch = BatchService.get_batch_by_code(db, batch_code)
        if not batch:
            raise BusinessException(ErrorCodes.NOT_FOUND, "批次不存在")
        
        needs_manual_items = []
        
        for item in return_items:
            material_code = item.get("material_code")
            return_reason_code = item.get("return_reason_code")
            return_note = item.get("return_note")
            
            material = MaterialService.get_material_by_code(db, material_code)
            if not material:
                continue
            
            batch_item = db.query(BatchItem).filter(
                BatchItem.batch_id == batch.id,
                BatchItem.material_id == material.id
            ).first()
            
            if batch_item:
                return_reason = ReturnReasonService.get_reason_by_code(db, return_reason_code)
                
                try:
                    MaterialService.return_material(db, material_code, return_reason_code, return_note)
                    batch_item.is_returned = True
                    batch_item.return_reason_id = return_reason.id if return_reason else None
                    batch_item.return_note = return_note
                    batch_item.returned_at = datetime.utcnow()
                    batch.returned_count += 1
                except BusinessException as e:
                    if e.error_code == ErrorCodes.NEEDS_MANUAL_REVIEW:
                        needs_manual_items.append(material_code)
                        batch_item.is_returned = True
                        batch_item.return_reason_id = return_reason.id if return_reason else None
                        batch_item.return_note = return_note
                        batch_item.returned_at = datetime.utcnow()
                        batch.returned_count += 1
        
        db.commit()
        db.refresh(batch)
        
        if needs_manual_items:
            raise BusinessException(
                ErrorCodes.NEEDS_MANUAL_REVIEW,
                "部分材料需要人工复核",
                {"needs_manual_items": needs_manual_items}
            )
        
        return batch

    @staticmethod
    def list_batches(db: Session, id_card_type: IDCardType = None, status: str = None):
        query = db.query(CertificateBatch)
        if id_card_type:
            query = query.filter(CertificateBatch.id_card_type == id_card_type)
        if status:
            query = query.filter(CertificateBatch.status == status)
        return query.all()

class ReportService:
    @staticmethod
    def generate_report(db: Session, batch_code: str, report_code: str, 
                       name: str, file_format: str = "xlsx") -> Dict[str, Any]:
        batch = BatchService.get_batch_by_code(db, batch_code)
        if not batch:
            raise BusinessException(ErrorCodes.NOT_FOUND, "批次不存在")
        
        existing = db.query(BatchReport).filter(BatchReport.report_code == report_code).first()
        if existing:
            raise BusinessException(ErrorCodes.DUPLICATE_SUBMISSION, "报告代码已存在")
        
        report = BatchReport(
            report_code=report_code,
            batch_id=batch.id,
            name=name,
            file_format=file_format,
            status=ReportStatus.GENERATING
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        
        return_items = db.query(BatchItem).filter(
            BatchItem.batch_id == batch.id,
            BatchItem.is_returned == True
        ).all()
        
        statistics = {
            "total_count": batch.total_count,
            "returned_count": len(return_items),
            "approved_count": batch.approved_count,
            "return_rate": round(len(return_items) / batch.total_count if batch.total_count > 0 else 0, 2),
            "return_reasons": {}
        }
        
        for item in return_items:
            if item.return_reason:
                reason_desc = item.return_reason.description
                statistics["return_reasons"][reason_desc] = statistics["return_reasons"].get(reason_desc, 0) + 1
        
        report_data = []
        for item in return_items:
            report_data.append({
                "material_code": item.material.material_code,
                "material_version": item.material_version,
                "participant_name": item.material.participant.name,
                "participant_type": item.material.participant.type.value,
                "person_name": item.material.name,
                "id_card_number": item.material.id_card_number,
                "id_card_type": item.material.id_card_type.value,
                "return_reason": item.return_reason.description if item.return_reason else "",
                "return_reason_category": item.return_reason.category.value if item.return_reason else "",
                "return_note": item.return_note or "",
                "returned_at": item.returned_at.isoformat() if item.returned_at else ""
            })
        
        report.statistics = json.dumps(statistics, ensure_ascii=False)
        report.status = ReportStatus.COMPLETED
        report.generated_at = datetime.utcnow()
        report.file_url = f"/reports/{report_code}.{file_format}"
        
        db.commit()
        db.refresh(report)
        
        return {
            "report": report,
            "statistics": statistics,
            "data": report_data
        }

    @staticmethod
    def get_report_by_code(db: Session, code: str) -> Optional[BatchReport]:
        return db.query(BatchReport).filter(BatchReport.report_code == code).first()

    @staticmethod
    def list_reports(db: Session, batch_code: str = None):
        query = db.query(BatchReport)
        if batch_code:
            batch = BatchService.get_batch_by_code(db, batch_code)
            if batch:
                query = query.filter(BatchReport.batch_id == batch.id)
        return query.all()

class IDCardRuleService:
    @staticmethod
    def get_rule_by_card_type(db: Session, card_type: IDCardType) -> Optional[IDCardRule]:
        return db.query(IDCardRule).filter(IDCardRule.card_type == card_type, IDCardRule.is_active == True).first()
    
    @staticmethod
    def validate_material_for_card_type(db: Session, card_type: IDCardType, material_data: dict):
        rule = IDCardRuleService.get_rule_by_card_type(db, card_type)
        if not rule:
            return
        
        if rule.required_fields:
            import json
            try:
                required_fields = json.loads(rule.required_fields)
                missing_fields = []
                for field in required_fields:
                    if not material_data.get(field):
                        missing_fields.append(field)
                if missing_fields:
                    raise BusinessException(
                        ErrorCodes.MISSING_FIELDS,
                        f"证件类型[{card_type.value}]缺少必填字段",
                        {"missing_fields": missing_fields, "card_type": card_type.value}
                    )
            except json.JSONDecodeError:
                pass
    
    @staticmethod
    def check_participant_type_allowed(db: Session, card_type: IDCardType, participant: Participant):
        rule = IDCardRuleService.get_rule_by_card_type(db, card_type)
        if not rule or not rule.allowed_participant_types:
            return
        
        import json
        try:
            allowed_types = json.loads(rule.allowed_participant_types)
            participant_type_value = participant.type.value
            
            if participant_type_value not in allowed_types:
                raise BusinessException(
                    ErrorCodes.VALIDATION_ERROR,
                    f"[{participant_type_value}]类型主体不允许申请[{card_type.value}]证件",
                    {"participant_type": participant_type_value, "allowed_types": allowed_types}
                )
        except json.JSONDecodeError:
            pass
    
    @staticmethod
    def check_participant_limit(db: Session, card_type: IDCardType, participant_id: int) -> int:
        rule = IDCardRuleService.get_rule_by_card_type(db, card_type)
        if not rule:
            return 0
        
        current_count = db.query(PersonMaterial).filter(
            PersonMaterial.participant_id == participant_id,
            PersonMaterial.id_card_type == card_type
        ).count()
        
        if current_count >= rule.max_count_per_participant:
            raise BusinessException(
                ErrorCodes.VALIDATION_ERROR,
                f"参展主体已达到[{card_type.value}]证件最大数量限制",
                {"current_count": current_count, "max_count": rule.max_count_per_participant}
            )
        
        return current_count

def init_default_data(db: Session):
    default_reasons = [
        {"code": "MISSING_NAME", "category": "信息缺失", "description": "姓名缺失", "needs_manual_review": False},
        {"code": "MISSING_ID_CARD", "category": "信息缺失", "description": "身份证号缺失", "needs_manual_review": False},
        {"code": "INVALID_PHOTO", "category": "照片无效", "description": "照片不符合要求", "needs_manual_review": False},
        {"code": "BLURRY_PHOTO", "category": "照片无效", "description": "照片模糊", "needs_manual_review": False},
        {"code": "ID_CARD_MISMATCH", "category": "证件错误", "description": "身份证信息不匹配", "needs_manual_review": True},
        {"code": "DUPLICATE_PERSON", "category": "重复提交", "description": "人员重复提交", "needs_manual_review": False},
        {"code": "FORMAT_ERROR", "category": "格式错误", "description": "表格格式错误", "needs_manual_review": False},
        {"code": "OTHER", "category": "其他", "description": "其他原因", "needs_manual_review": True}
    ]
    
    for reason_data in default_reasons:
        existing = db.query(ReturnReason).filter(ReturnReason.code == reason_data["code"]).first()
        if not existing:
            reason = ReturnReason(**reason_data)
            db.add(reason)
    
    import json
    default_rules = [
        {
            "card_type": IDCardType.EXHIBITOR_PASS,
            "allowed_participant_types": json.dumps(["参展商", "搭建商"]),
            "max_count_per_participant": 50,
            "required_fields": json.dumps(["name", "id_card_number", "phone", "company"]),
            "photo_requirements": "近期免冠彩色照片，白底，尺寸358x441"
        },
        {
            "card_type": IDCardType.CONSTRUCTOR_PASS,
            "allowed_participant_types": json.dumps(["搭建商"]),
            "max_count_per_participant": 100,
            "required_fields": json.dumps(["name", "id_card_number", "phone", "company"]),
            "photo_requirements": "近期免冠彩色照片，蓝底，尺寸358x441"
        },
        {
            "card_type": IDCardType.MEDIA_PASS,
            "allowed_participant_types": json.dumps(["媒体"]),
            "max_count_per_participant": 20,
            "required_fields": json.dumps(["name", "id_card_number", "phone", "company", "position"]),
            "photo_requirements": "近期免冠彩色照片，红底，尺寸358x441"
        },
        {
            "card_type": IDCardType.WORKER_PASS,
            "allowed_participant_types": json.dumps(["参展商", "搭建商", "媒体"]),
            "max_count_per_participant": 200,
            "required_fields": json.dumps(["name", "id_card_number", "phone"]),
            "photo_requirements": "近期免冠彩色照片，白底，尺寸358x441"
        },
        {
            "card_type": IDCardType.VIP_PASS,
            "allowed_participant_types": json.dumps(["参展商"]),
            "max_count_per_participant": 5,
            "required_fields": json.dumps(["name", "id_card_number", "phone", "company", "position", "email"]),
            "photo_requirements": "近期免冠彩色照片，白底，尺寸358x441"
        }
    ]
    
    for rule_data in default_rules:
        existing = db.query(IDCardRule).filter(IDCardRule.card_type == rule_data["card_type"]).first()
        if not existing:
            rule = IDCardRule(**rule_data)
            db.add(rule)
    
    db.commit()
