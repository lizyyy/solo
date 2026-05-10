from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime
from ..models.verification import VerificationRecord, VerificationResult
from ..models.lesion import LesionRecord, LesionStatus


class RollbackService:
    def __init__(self):
        pass
    
    def rollback_verification(
        self,
        db: Session,
        verification_code: str,
        rollback_reason: str,
        rolled_by: str
    ) -> Dict[str, Any]:
        verification = db.query(VerificationRecord).filter(
            VerificationRecord.verification_code == verification_code
        ).first()
        
        if not verification:
            raise ValueError(f"核验记录【{verification_code}】不存在")
        
        if verification.is_reverted:
            raise ValueError(f"核验记录【{verification_code}】已被回滚，不能重复回滚")
        
        if not verification.is_active:
            raise ValueError(f"核验记录【{verification_code}】不是当前有效核验，无法回滚")
        
        lesion = db.query(LesionRecord).filter(
            LesionRecord.id == verification.lesion_id
        ).first()
        
        if not lesion:
            raise ValueError(f"关联的病斑记录不存在")
        
        verification.is_reverted = True
        verification.is_active = False
        verification.revert_reason = rollback_reason
        verification.reverted_by = rolled_by
        verification.reverted_at = datetime.now()
        
        lesion.is_reverted = True
        lesion.revert_reason = rollback_reason
        lesion.reverted_by = rolled_by
        lesion.reverted_at = datetime.now()
        lesion.status = LesionStatus.REVERTED
        
        previous_verifications = db.query(VerificationRecord).filter(
            VerificationRecord.lesion_id == lesion.id,
            VerificationRecord.is_reverted == False,
            VerificationRecord.id != verification.id
        ).order_by(
            VerificationRecord.verification_round.desc()
        ).all()
        
        previous_active = None
        if previous_verifications:
            for v in previous_verifications:
                if not v.is_reverted:
                    previous_active = v
                    v.is_active = True
                    break
        
        if previous_active:
            if previous_active.result == VerificationResult.CONFIRMED:
                lesion.status = LesionStatus.CONFIRMED
                lesion.is_false_positive = False
                if previous_active.actual_lesion_type:
                    lesion.lesion_type = previous_active.actual_lesion_type
            elif previous_active.result == VerificationResult.FALSE_POSITIVE:
                lesion.status = LesionStatus.FALSE_POSITIVE
                lesion.is_false_positive = True
            elif previous_active.result == VerificationResult.NEED_RECHECK:
                lesion.status = LesionStatus.PENDING
        else:
            lesion.status = LesionStatus.PENDING
            lesion.is_false_positive = False
        
        db.commit()
        db.refresh(verification)
        db.refresh(lesion)
        
        return {
            "success": True,
            "verification_code": verification_code,
            "lesion_code": lesion.lesion_code,
            "rollback_reason": rollback_reason,
            "rolled_by": rolled_by,
            "rolled_at": verification.reverted_at,
            "previous_verification_code": previous_active.verification_code if previous_active else None,
            "current_lesion_status": lesion.status.value,
            "business_message": f"回滚成功：核验记录【{verification_code}】已回滚，病斑【{lesion.lesion_code}】当前状态为【{lesion.status.value}】" + 
                              (f"，已恢复到第{previous_active.verification_round}轮核验状态" if previous_active else "，无历史核验记录，恢复为待核验状态")
        }
    
    def rollback_false_positive(
        self,
        db: Session,
        lesion_code: str,
        rollback_reason: str,
        rolled_by: str
    ) -> Dict[str, Any]:
        lesion = db.query(LesionRecord).filter(
            LesionRecord.lesion_code == lesion_code
        ).first()
        
        if not lesion:
            raise ValueError(f"病斑【{lesion_code}】不存在")
        
        if lesion.status != LesionStatus.FALSE_POSITIVE:
            raise ValueError(f"病斑【{lesion_code}】当前状态为【{lesion.status.value}】，不是误报状态，无法执行误报回滚")
        
        active_verification = db.query(VerificationRecord).filter(
            VerificationRecord.lesion_id == lesion.id,
            VerificationRecord.is_active == True,
            VerificationRecord.is_reverted == False
        ).first()
        
        if not active_verification:
            raise ValueError(f"病斑【{lesion_code}】没有找到有效的核验记录")
        
        if active_verification.result != VerificationResult.FALSE_POSITIVE:
            raise ValueError(f"病斑【{lesion_code}】的有效核验不是误报结论")
        
        return self.rollback_verification(
            db=db,
            verification_code=active_verification.verification_code,
            rollback_reason=rollback_reason,
            rolled_by=rolled_by
        )
    
    def get_rollback_history(
        self,
        db: Session,
        lesion_code: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        query = db.query(VerificationRecord).filter(
            VerificationRecord.is_reverted == True
        )
        
        if lesion_code:
            query = query.filter(VerificationRecord.lesion_code == lesion_code)
        
        total = query.count()
        total_pages = (total + page_size - 1) // page_size
        
        items = query.order_by(VerificationRecord.reverted_at.desc()).offset(
            (page - 1) * page_size
        ).limit(page_size).all()
        
        rollback_records = []
        for v in items:
            rollback_records.append({
                "verification_code": v.verification_code,
                "lesion_code": v.lesion_code,
                "grid_code": v.grid_code,
                "grid_name": v.grid_name,
                "verification_round": v.verification_round,
                "original_result": v.result.value if v.result else None,
                "revert_reason": v.revert_reason,
                "reverted_by": v.reverted_by,
                "reverted_at": v.reverted_at
            })
        
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "items": rollback_records,
            "business_message": f"共查询到{total}条回滚记录"
        }


rollback_service = RollbackService()
