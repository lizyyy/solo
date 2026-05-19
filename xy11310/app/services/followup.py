from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import date, datetime

from app.models import FollowUp, SatisfactionLevel, Delivery
from app.core.logging import app_logger
from app.services.history import HistoryService


class FollowUpService:
    @staticmethod
    def create_follow_up(
        db: Session,
        elderly_id: int,
        follow_up_date: date,
        delivery_id: Optional[int] = None,
        food_quality: Optional[SatisfactionLevel] = None,
        temperature: Optional[SatisfactionLevel] = None,
        packaging: Optional[SatisfactionLevel] = None,
        delivery_service: Optional[SatisfactionLevel] = None,
        overall_satisfaction: Optional[SatisfactionLevel] = None,
        complaints: Optional[str] = None,
        suggestions: Optional[str] = None,
        dietary_feedback: Optional[str] = None,
        followed_by: Optional[str] = None,
        follow_up_method: Optional[str] = None,
        needs_further_action: bool = False,
        action_taken: Optional[str] = None,
        operator: Optional[str] = None
    ) -> Dict[str, Any]:
        
        if delivery_id:
            existing = db.query(FollowUp).filter(
                FollowUp.delivery_id == delivery_id
            ).first()
            if existing:
                app_logger.info(f"回访已存在: delivery_id={delivery_id}")
                return {
                    "success": True,
                    "is_duplicate": True,
                    "follow_up_id": existing.id,
                    "message": "回访记录已存在"
                }
        
        follow_up = FollowUp(
            elderly_id=elderly_id,
            delivery_id=delivery_id,
            follow_up_date=follow_up_date,
            food_quality=food_quality,
            temperature=temperature,
            packaging=packaging,
            delivery_service=delivery_service,
            overall_satisfaction=overall_satisfaction,
            complaints=complaints,
            suggestions=suggestions,
            dietary_feedback=dietary_feedback,
            followed_by=followed_by,
            follow_up_method=follow_up_method,
            needs_further_action=1 if needs_further_action else 0,
            action_taken=action_taken
        )
        
        db.add(follow_up)
        db.commit()
        db.refresh(follow_up)
        
        HistoryService.record_operation(
            db=db,
            operation_type="create",
            entity_type="FollowUp",
            entity_id=follow_up.id,
            after_data={
                "elderly_id": elderly_id,
                "follow_up_date": str(follow_up_date),
                "overall_satisfaction": overall_satisfaction.value if overall_satisfaction else None,
                "needs_further_action": needs_further_action
            },
            operator=operator
        )
        
        app_logger.info(f"回访创建成功: follow_up_id={follow_up.id}")
        
        return {
            "success": True,
            "is_duplicate": False,
            "follow_up_id": follow_up.id,
            "message": "回访创建成功"
        }
    
    @staticmethod
    def get_follow_ups_by_date(
        db: Session,
        follow_up_date: date
    ) -> Dict[str, Any]:
        follow_ups = db.query(FollowUp).filter(
            FollowUp.follow_up_date == follow_up_date
        ).all()
        
        result = []
        for fu in follow_ups:
            result.append({
                "follow_up_id": fu.id,
                "elderly_id": fu.elderly_id,
                "delivery_id": fu.delivery_id,
                "overall_satisfaction": fu.overall_satisfaction.value if fu.overall_satisfaction else None,
                "complaints": fu.complaints,
                "suggestions": fu.suggestions,
                "needs_further_action": fu.needs_further_action == 1,
                "followed_by": fu.followed_by
            })
        
        satisfaction_stats = FollowUpService.calculate_satisfaction_stats(follow_ups)
        
        return {
            "success": True,
            "follow_up_date": str(follow_up_date),
            "total": len(result),
            "satisfaction_stats": satisfaction_stats,
            "follow_ups": result
        }
    
    @staticmethod
    def calculate_satisfaction_stats(follow_ups: List[FollowUp]) -> Dict[str, Any]:
        stats = {
            "very_good": 0,
            "good": 0,
            "fair": 0,
            "poor": 0,
            "very_poor": 0,
            "needs_further_action": 0
        }
        
        for fu in follow_ups:
            if fu.overall_satisfaction:
                stats[fu.overall_satisfaction.value] += 1
            if fu.needs_further_action:
                stats["needs_further_action"] += 1
        
        total = len(follow_ups)
        if total > 0:
            satisfaction_rate = (stats["very_good"] + stats["good"]) / total * 100
            stats["satisfaction_rate"] = round(satisfaction_rate, 2)
        else:
            stats["satisfaction_rate"] = 0
        
        return stats
    
    @staticmethod
    def update_follow_up_action(
        db: Session,
        follow_up_id: int,
        action_taken: str,
        operator: Optional[str] = None
    ) -> Dict[str, Any]:
        follow_up = db.query(FollowUp).filter(FollowUp.id == follow_up_id).first()
        if not follow_up:
            return {
                "success": False,
                "message": "回访记录不存在"
            }
        
        before_data = HistoryService.get_entity_before_data(follow_up)
        follow_up.action_taken = action_taken
        after_data = HistoryService.get_entity_before_data(follow_up)
        
        db.commit()
        
        HistoryService.record_operation(
            db=db,
            operation_type="update",
            entity_type="FollowUp",
            entity_id=follow_up.id,
            before_data=before_data,
            after_data=after_data,
            changes=HistoryService.calculate_changes(before_data, after_data),
            operator=operator
        )
        
        return {
            "success": True,
            "follow_up_id": follow_up_id,
            "action_taken": action_taken,
            "message": "处理措施已更新"
        }
