from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.database import (
    ReviewRecord, Appointment, Cylinder, Risk
)
import uuid


class ReviewService:
    REVIEW_TYPES = ["risk_review", "appointment_review", "cylinder_check"]
    STATUSES = ["pending", "reviewed", "rescheduled", "cancelled"]
    
    def __init__(self, db: Session):
        self.db = db
    
    def _generate_review_number(self) -> str:
        return f"RV-{datetime.utcnow().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
    
    def create_review(
        self,
        reviewer_name: str,
        review_type: str,
        cylinder_id: Optional[int] = None,
        appointment_id: Optional[int] = None,
        risk_id: Optional[int] = None,
        status: str = "pending",
        notes: str = None
    ) -> Dict[str, Any]:
        if review_type not in self.REVIEW_TYPES:
            return {"success": False, "message": f"无效的复核类型: {review_type}"}
        
        review = ReviewRecord(
            review_number=self._generate_review_number(),
            reviewer_name=reviewer_name,
            review_type=review_type,
            status=status,
            notes=notes,
            review_date=datetime.utcnow()
        )
        
        if cylinder_id:
            review.cylinder_id = cylinder_id
        
        if appointment_id:
            review.appointment_id = appointment_id
        
        self.db.add(review)
        self.db.commit()
        self.db.refresh(review)
        
        result = {
            "success": True,
            "review_number": review.review_number,
            "review_id": review.id,
            "review_type": review.review_type,
            "status": review.status,
            "review_date": review.review_date.strftime("%Y-%m-%d %H:%M:%S")
        }
        
        if cylinder_id:
            cylinder = self.db.query(Cylinder).filter(Cylinder.id == cylinder_id).first()
            if cylinder:
                result["serial_number"] = cylinder.serial_number
        
        if appointment_id:
            appt = self.db.query(Appointment).filter(Appointment.id == appointment_id).first()
            if appt:
                result["appointment_number"] = appt.appointment_number
        
        return result
    
    def mark_as_reviewed(
        self,
        review_id: int,
        reviewer_name: str,
        notes: str = None
    ) -> Dict[str, Any]:
        review = self.db.query(ReviewRecord).filter(
            ReviewRecord.id == review_id
        ).first()
        
        if not review:
            return {"success": False, "message": "复核记录不存在"}
        
        review.status = "reviewed"
        review.reviewer_name = reviewer_name
        review.review_date = datetime.utcnow()
        if notes:
            review.notes = notes
        
        if review.appointment_id:
            appointment = self.db.query(Appointment).filter(
                Appointment.id == review.appointment_id
            ).first()
            if appointment:
                appointment.status = "confirmed"
        
        self.db.commit()
        
        return {
            "success": True,
            "review_number": review.review_number,
            "status": "reviewed",
            "reviewed_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        }
    
    def reschedule_appointment(
        self,
        appointment_id: int,
        rescheduled_to: datetime,
        reviewer_name: str,
        notes: str = None
    ) -> Dict[str, Any]:
        appointment = self.db.query(Appointment).filter(
            Appointment.id == appointment_id
        ).first()
        
        if not appointment:
            return {"success": False, "message": "预约记录不存在"}
        
        review = ReviewRecord(
            review_number=self._generate_review_number(),
            cylinder_id=appointment.cylinder_id,
            appointment_id=appointment.id,
            reviewer_name=reviewer_name,
            review_type="appointment_review",
            status="rescheduled",
            notes=notes,
            rescheduled_to=rescheduled_to,
            review_date=datetime.utcnow()
        )
        
        appointment.pickup_date = rescheduled_to
        appointment.status = "rescheduled"
        appointment.updated_at = datetime.utcnow()
        
        self.db.add(review)
        self.db.commit()
        
        return {
            "success": True,
            "review_number": review.review_number,
            "appointment_number": appointment.appointment_number,
            "new_pickup_date": rescheduled_to.strftime("%Y-%m-%d %H:%M:%S"),
            "status": "rescheduled"
        }
    
    def get_reviews(
        self,
        status: str = None,
        review_type: str = None,
        limit: int = 100
    ) -> list:
        query = self.db.query(ReviewRecord)
        
        if status:
            query = query.filter(ReviewRecord.status == status)
        
        if review_type:
            query = query.filter(ReviewRecord.review_type == review_type)
        
        reviews = query.order_by(ReviewRecord.created_at.desc()).limit(limit).all()
        
        results = []
        for review in reviews:
            item = {
                "review_id": review.id,
                "review_number": review.review_number,
                "review_type": review.review_type,
                "status": review.status,
                "reviewer_name": review.reviewer_name,
                "review_date": review.review_date.strftime("%Y-%m-%d %H:%M:%S") if review.review_date else None,
                "notes": review.notes,
                "rescheduled_to": review.rescheduled_to.strftime("%Y-%m-%d %H:%M:%S") if review.rescheduled_to else None
            }
            
            if review.cylinder_id:
                cylinder = self.db.query(Cylinder).filter(Cylinder.id == review.cylinder_id).first()
                if cylinder:
                    item["serial_number"] = cylinder.serial_number
            
            if review.appointment_id:
                appt = self.db.query(Appointment).filter(Appointment.id == review.appointment_id).first()
                if appt:
                    item["appointment_number"] = appt.appointment_number
                    item["customer_name"] = appt.customer_name
            
            results.append(item)
        
        return results
