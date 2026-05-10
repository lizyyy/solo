from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List, Dict, Any
from datetime import datetime
from ..models.lesion import LesionRecord, LesionStatus, LesionSource
from ..models.batch import ImageBatch
from ..models.grid import FarmGrid
from ..schemas.lesion import LesionRecordCreate, LesionRecordUpdate
from ..schemas.common import PageResponse
from .grid_service import grid_service


class LesionService:
    def __init__(self):
        pass
    
    def _generate_lesion_code(self) -> str:
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        import random
        suffix = random.randint(1000, 9999)
        return f"LB{timestamp}{suffix}"
    
    def create_lesion(
        self, 
        db: Session, 
        lesion_data: LesionRecordCreate,
        auto_match_grid: bool = True
    ) -> LesionRecord:
        batch = db.query(ImageBatch).filter(
            ImageBatch.batch_code == lesion_data.batch_code
        ).first()
        if not batch:
            raise ValueError(f"批次编号【{lesion_data.batch_code}】不存在")
        
        lesion = LesionRecord(
            lesion_code=self._generate_lesion_code(),
            batch_id=batch.id,
            longitude=lesion_data.longitude,
            latitude=lesion_data.latitude,
            pixel_x=lesion_data.pixel_x,
            pixel_y=lesion_data.pixel_y,
            image_path=lesion_data.image_path,
            image_name=lesion_data.image_name,
            lesion_type=lesion_data.lesion_type,
            confidence_score=lesion_data.confidence_score,
            estimated_area_m2=lesion_data.estimated_area_m2,
            severity_level=lesion_data.severity_level,
            source=lesion_data.source,
            status=LesionStatus.PENDING,
            created_by=lesion_data.created_by,
            remark=lesion_data.remark
        )
        
        db.add(lesion)
        db.flush()
        
        if auto_match_grid:
            match_info = grid_service.match_lesion_to_grid(db, lesion, auto_save=False)
            if match_info["found"]:
                lesion.grid_id = match_info["grid_id"]
                lesion.grid_code = match_info["grid_code"]
                lesion.grid_name = match_info["grid_name"]
        
        db.commit()
        db.refresh(lesion)
        
        return lesion
    
    def get_lesion_by_code(self, db: Session, lesion_code: str) -> Optional[LesionRecord]:
        return db.query(LesionRecord).filter(LesionRecord.lesion_code == lesion_code).first()
    
    def get_lesion_by_id(self, db: Session, lesion_id: int) -> Optional[LesionRecord]:
        return db.query(LesionRecord).filter(LesionRecord.id == lesion_id).first()
    
    def update_lesion(
        self, 
        db: Session, 
        lesion_code: str, 
        update_data: LesionRecordUpdate
    ) -> Optional[LesionRecord]:
        lesion = self.get_lesion_by_code(db, lesion_code)
        if not lesion:
            return None
        
        update_dict = update_data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            if value is not None:
                setattr(lesion, key, value)
        
        db.commit()
        db.refresh(lesion)
        
        return lesion
    
    def delete_lesion(self, db: Session, lesion_code: str) -> bool:
        lesion = self.get_lesion_by_code(db, lesion_code)
        if not lesion:
            return False
        
        db.delete(lesion)
        db.commit()
        
        return True
    
    def list_lesions(
        self, 
        db: Session, 
        page: int = 1, 
        page_size: int = 20,
        batch_code: Optional[str] = None,
        grid_code: Optional[str] = None,
        status: Optional[LesionStatus] = None,
        source: Optional[LesionSource] = None,
        lesion_type: Optional[str] = None,
        is_false_positive: Optional[bool] = None,
        is_reverted: Optional[bool] = None
    ) -> PageResponse:
        query = db.query(LesionRecord)
        
        if batch_code:
            batch = db.query(ImageBatch).filter(ImageBatch.batch_code == batch_code).first()
            if batch:
                query = query.filter(LesionRecord.batch_id == batch.id)
        
        if grid_code:
            query = query.filter(LesionRecord.grid_code == grid_code)
        
        if status:
            query = query.filter(LesionRecord.status == status)
        
        if source:
            query = query.filter(LesionRecord.source == source)
        
        if lesion_type:
            query = query.filter(LesionRecord.lesion_type.like(f"%{lesion_type}%"))
        
        if is_false_positive is not None:
            query = query.filter(LesionRecord.is_false_positive == is_false_positive)
        
        if is_reverted is not None:
            query = query.filter(LesionRecord.is_reverted == is_reverted)
        
        total = query.count()
        total_pages = (total + page_size - 1) // page_size
        
        items = query.order_by(LesionRecord.created_at.desc()).offset(
            (page - 1) * page_size
        ).limit(page_size).all()
        
        return PageResponse(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            items=items
        )
    
    def get_lesion_detail(self, db: Session, lesion_code: str) -> Optional[Dict[str, Any]]:
        lesion = self.get_lesion_by_code(db, lesion_code)
        if not lesion:
            return None
        
        verifications = [
            {
                "verification_code": v.verification_code,
                "verification_round": v.verification_round,
                "result": v.result.value if v.result else None,
                "verified_by": v.verified_by,
                "verified_at": v.verified_at,
                "is_active": v.is_active,
                "is_reverted": v.is_reverted
            }
            for v in lesion.verifications
        ]
        
        return {
            "lesion": lesion,
            "verification_history": verifications,
            "verification_count": len(verifications),
            "active_verification_count": len([v for v in verifications if v["is_active"]]),
            "business_summary": f"病斑【{lesion.lesion_code}】位于【{lesion.grid_code} - {lesion.grid_name}】，当前状态：{lesion.status.value}，共经历{len(verifications)}次核验"
        }
    
    def batch_create_lesions(
        self,
        db: Session,
        batch_code: str,
        lesions_data: List[LesionRecordCreate],
        created_by: str,
        auto_match_grid: bool = True
    ) -> Dict[str, Any]:
        batch = db.query(ImageBatch).filter(
            ImageBatch.batch_code == batch_code
        ).first()
        if not batch:
            raise ValueError(f"批次编号【{batch_code}】不存在")
        
        created_count = 0
        failed_count = 0
        created_lesions = []
        errors = []
        
        for i, lesion_data in enumerate(lesions_data):
            try:
                lesion_data.batch_code = batch_code
                lesion_data.created_by = created_by
                lesion = self.create_lesion(db, lesion_data, auto_match_grid=auto_match_grid)
                created_lesions.append({
                    "index": i,
                    "lesion_code": lesion.lesion_code,
                    "grid_code": lesion.grid_code,
                    "grid_name": lesion.grid_name
                })
                created_count += 1
            except Exception as e:
                failed_count += 1
                errors.append({
                    "index": i,
                    "error": str(e)
                })
        
        return {
            "batch_code": batch_code,
            "total_processed": len(lesions_data),
            "created_count": created_count,
            "failed_count": failed_count,
            "success_rate": round(created_count / len(lesions_data) * 100, 2) if lesions_data else 0,
            "message": f"批量创建完成：共处理{len(lesions_data)}条记录，成功创建{created_count}条，失败{failed_count}条",
            "created_lesions": created_lesions,
            "errors": errors
        }


lesion_service = LesionService()
