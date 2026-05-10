from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List, Dict, Any
from datetime import datetime
from ..models.batch import ImageBatch, BatchStatus
from ..models.lesion import LesionRecord, LesionStatus
from ..schemas.batch import ImageBatchCreate, ImageBatchUpdate
from ..schemas.common import PageResponse
from ..config import settings
from sqlalchemy.exc import IntegrityError


class BatchService:
    def __init__(self):
        pass
    
    def create_batch(self, db: Session, batch_data: ImageBatchCreate) -> ImageBatch:
        existing = db.query(ImageBatch).filter(
            ImageBatch.batch_code == batch_data.batch_code
        ).first()
        if existing:
            raise ValueError(f"批次编号【{batch_data.batch_code}】已存在，请检查后重试")
        
        batch = ImageBatch(
            batch_code=batch_data.batch_code,
            batch_name=batch_data.batch_name,
            flight_date=batch_data.flight_date,
            flight_area=batch_data.flight_area,
            drone_id=batch_data.drone_id,
            image_count=batch_data.image_count,
            total_area_km2=batch_data.total_area_km2,
            status=BatchStatus.CREATED,
            created_by=batch_data.created_by,
            remark=batch_data.remark
        )
        
        db.add(batch)
        db.commit()
        db.refresh(batch)
        
        return batch
    
    def get_batch_by_code(self, db: Session, batch_code: str) -> Optional[ImageBatch]:
        return db.query(ImageBatch).filter(ImageBatch.batch_code == batch_code).first()
    
    def get_batch_by_id(self, db: Session, batch_id: int) -> Optional[ImageBatch]:
        return db.query(ImageBatch).filter(ImageBatch.id == batch_id).first()
    
    def update_batch(self, db: Session, batch_code: str, update_data: ImageBatchUpdate) -> Optional[ImageBatch]:
        batch = self.get_batch_by_code(db, batch_code)
        if not batch:
            return None
        
        update_dict = update_data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            if value is not None:
                setattr(batch, key, value)
        
        db.commit()
        db.refresh(batch)
        
        return batch
    
    def delete_batch(self, db: Session, batch_code: str) -> bool:
        batch = self.get_batch_by_code(db, batch_code)
        if not batch:
            return False
        
        db.delete(batch)
        db.commit()
        
        return True
    
    def list_batches(
        self, 
        db: Session, 
        page: int = 1, 
        page_size: int = 20,
        status: Optional[BatchStatus] = None,
        flight_area: Optional[str] = None,
        keyword: Optional[str] = None
    ) -> PageResponse:
        query = db.query(ImageBatch)
        
        if status:
            query = query.filter(ImageBatch.status == status)
        
        if flight_area:
            query = query.filter(ImageBatch.flight_area.like(f"%{flight_area}%"))
        
        if keyword:
            query = query.filter(
                (ImageBatch.batch_code.like(f"%{keyword}%")) |
                (ImageBatch.batch_name.like(f"%{keyword}%"))
            )
        
        total = query.count()
        total_pages = (total + page_size - 1) // page_size
        
        items = query.order_by(ImageBatch.created_at.desc()).offset(
            (page - 1) * page_size
        ).limit(page_size).all()
        
        return PageResponse(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            items=items
        )
    
    def get_batch_statistics(self, db: Session, batch_code: str) -> Dict[str, Any]:
        batch = self.get_batch_by_code(db, batch_code)
        if not batch:
            raise ValueError(f"批次【{batch_code}】不存在")
        
        lesion_query = db.query(LesionRecord).filter(LesionRecord.batch_id == batch.id)
        
        total_lesions = lesion_query.count()
        confirmed_count = lesion_query.filter(
            LesionRecord.status == LesionStatus.CONFIRMED
        ).count()
        false_positive_count = lesion_query.filter(
            LesionRecord.status == LesionStatus.FALSE_POSITIVE
        ).count()
        pending_count = lesion_query.filter(
            LesionRecord.status == LesionStatus.PENDING
        ).count()
        verifying_count = lesion_query.filter(
            LesionRecord.status == LesionStatus.VERIFYING
        ).count()
        reverted_count = lesion_query.filter(
            LesionRecord.status == LesionStatus.REVERTED
        ).count()
        
        verification_completed = confirmed_count + false_positive_count
        verification_rate = (verification_completed / total_lesions * 100) if total_lesions > 0 else 0
        false_positive_rate = (false_positive_count / verification_completed * 100) if verification_completed > 0 else 0
        
        return {
            "batch_code": batch.batch_code,
            "batch_name": batch.batch_name,
            "flight_date": batch.flight_date,
            "flight_area": batch.flight_area,
            "status": batch.status.value,
            "statistics": {
                "total_lesion_count": total_lesions,
                "confirmed_count": confirmed_count,
                "false_positive_count": false_positive_count,
                "pending_count": pending_count,
                "verifying_count": verifying_count,
                "reverted_count": reverted_count,
                "verification_rate": round(verification_rate, 2),
                "false_positive_rate": round(false_positive_rate, 2)
            },
            "business_message": f"批次【{batch.batch_name}】共发现疑似病斑{total_lesions}个，已完成核验{verification_completed}个，核验完成率{round(verification_rate, 2)}%"
        }
    
    def get_batch_with_lesions(self, db: Session, batch_code: str) -> Optional[Dict[str, Any]]:
        batch = self.get_batch_by_code(db, batch_code)
        if not batch:
            return None
        
        stats = self.get_batch_statistics(db, batch_code)
        
        return {
            "batch": batch,
            "statistics": stats["statistics"],
            "business_summary": stats["business_message"]
        }


batch_service = BatchService()
