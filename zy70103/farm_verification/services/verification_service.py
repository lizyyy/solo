from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime
from ..models.verification import VerificationRecord, VerificationResult
from ..models.lesion import LesionRecord, LesionStatus
from ..models.grid import FarmGrid
from ..schemas.verification import VerificationCreate, VerificationUpdate
from ..schemas.common import PageResponse


class VerificationService:
    def __init__(self):
        pass
    
    def _generate_verification_code(self) -> str:
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        import random
        suffix = random.randint(1000, 9999)
        return f"HY{timestamp}{suffix}"
    
    def _get_next_verification_round(
        self, 
        db: Session, 
        lesion_id: int
    ) -> int:
        max_round = db.query(
            VerificationRecord.verification_round
        ).filter(
            VerificationRecord.lesion_id == lesion_id
        ).order_by(
            VerificationRecord.verification_round.desc()
        ).first()
        
        return (max_round[0] + 1) if max_round else 1
    
    def create_verification(
        self, 
        db: Session, 
        verification_data: VerificationCreate
    ) -> Dict[str, Any]:
        lesion = db.query(LesionRecord).filter(
            LesionRecord.lesion_code == verification_data.lesion_code
        ).first()
        
        if not lesion:
            raise ValueError(f"病斑编号【{verification_data.lesion_code}】不存在")
        
        if lesion.status == LesionStatus.VERIFYING:
            raise ValueError(f"病斑【{lesion.lesion_code}】正在核验中，请等待当前核验完成")
        
        next_round = self._get_next_verification_round(db, lesion.id)
        
        active_verifications = db.query(VerificationRecord).filter(
            VerificationRecord.lesion_id == lesion.id,
            VerificationRecord.is_active == True
        ).all()
        
        for v in active_verifications:
            v.is_active = False
        
        verification = VerificationRecord(
            verification_code=self._generate_verification_code(),
            lesion_id=lesion.id,
            lesion_code=lesion.lesion_code,
            grid_code=lesion.grid_code,
            grid_name=lesion.grid_name,
            verification_round=next_round,
            result=verification_data.result,
            actual_lesion_type=verification_data.actual_lesion_type,
            actual_area_m2=verification_data.actual_area_m2,
            actual_severity=verification_data.actual_severity,
            false_positive_type=verification_data.false_positive_type,
            false_positive_reason=verification_data.false_positive_reason,
            verification_method=verification_data.verification_method,
            verification_location=verification_data.verification_location,
            photo_evidence=verification_data.photo_evidence,
            video_evidence=verification_data.video_evidence,
            verified_by=verification_data.verified_by,
            verified_at=datetime.now(),
            is_active=True,
            remark=verification_data.remark
        )
        
        db.add(verification)
        
        if verification_data.result == VerificationResult.CONFIRMED:
            lesion.status = LesionStatus.CONFIRMED
            lesion.is_false_positive = False
            if verification_data.actual_lesion_type:
                lesion.lesion_type = verification_data.actual_lesion_type
        elif verification_data.result == VerificationResult.FALSE_POSITIVE:
            lesion.status = LesionStatus.FALSE_POSITIVE
            lesion.is_false_positive = True
        elif verification_data.result == VerificationResult.NEED_RECHECK:
            lesion.status = LesionStatus.PENDING
        
        db.commit()
        db.refresh(verification)
        db.refresh(lesion)
        
        return {
            "verification": verification,
            "lesion": lesion,
            "business_message": f"第{next_round}轮核验完成：病斑【{lesion.lesion_code}】核验结论为【{verification_data.result.value}】，核验人：{verification_data.verified_by}"
        }
    
    def get_verification_by_code(
        self, 
        db: Session, 
        verification_code: str
    ) -> Optional[VerificationRecord]:
        return db.query(VerificationRecord).filter(
            VerificationRecord.verification_code == verification_code
        ).first()
    
    def list_verifications(
        self, 
        db: Session, 
        page: int = 1, 
        page_size: int = 20,
        lesion_code: Optional[str] = None,
        grid_code: Optional[str] = None,
        result: Optional[VerificationResult] = None,
        verified_by: Optional[str] = None,
        is_active: Optional[bool] = None,
        is_reverted: Optional[bool] = None
    ) -> PageResponse:
        query = db.query(VerificationRecord)
        
        if lesion_code:
            query = query.filter(VerificationRecord.lesion_code == lesion_code)
        
        if grid_code:
            query = query.filter(VerificationRecord.grid_code == grid_code)
        
        if result:
            query = query.filter(VerificationRecord.result == result)
        
        if verified_by:
            query = query.filter(VerificationRecord.verified_by == verified_by)
        
        if is_active is not None:
            query = query.filter(VerificationRecord.is_active == is_active)
        
        if is_reverted is not None:
            query = query.filter(VerificationRecord.is_reverted == is_reverted)
        
        total = query.count()
        total_pages = (total + page_size - 1) // page_size
        
        items = query.order_by(VerificationRecord.created_at.desc()).offset(
            (page - 1) * page_size
        ).limit(page_size).all()
        
        return PageResponse(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            items=items
        )
    
    def get_verification_statistics(
        self,
        db: Session,
        batch_code: Optional[str] = None,
        grid_code: Optional[str] = None
    ) -> Dict[str, Any]:
        query = db.query(VerificationRecord)
        
        if grid_code:
            query = query.filter(VerificationRecord.grid_code == grid_code)
        
        if batch_code:
            from ..models.batch import ImageBatch
            batch = db.query(ImageBatch).filter(ImageBatch.batch_code == batch_code).first()
            if batch:
                lesion_ids = [l.id for l in db.query(LesionRecord).filter(LesionRecord.batch_id == batch.id).all()]
                query = query.filter(VerificationRecord.lesion_id.in_(lesion_ids))
        
        total_count = query.count()
        confirmed_count = query.filter(VerificationRecord.result == VerificationResult.CONFIRMED).count()
        false_positive_count = query.filter(VerificationRecord.result == VerificationResult.FALSE_POSITIVE).count()
        need_recheck_count = query.filter(VerificationRecord.result == VerificationResult.NEED_RECHECK).count()
        reverted_count = query.filter(VerificationRecord.is_reverted == True).count()
        
        verification_completed = confirmed_count + false_positive_count
        false_positive_rate = (false_positive_count / verification_completed * 100) if verification_completed > 0 else 0
        
        return {
            "total_verification_count": total_count,
            "confirmed_count": confirmed_count,
            "false_positive_count": false_positive_count,
            "need_recheck_count": need_recheck_count,
            "reverted_count": reverted_count,
            "false_positive_rate": round(false_positive_rate, 2),
            "business_summary": f"共完成{total_count}次核验，其中确认为病斑{confirmed_count}次，误报{false_positive_count}次，需复核{need_recheck_count}次，误报率{round(false_positive_rate, 2)}%"
        }


verification_service = VerificationService()
