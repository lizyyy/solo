from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import date, datetime, timedelta
from pathlib import Path
import json

from app.models import Elderly, MealAllocation, Delivery, FollowUp
from app.core.config import settings
from app.utils.mask import mask_sensitive_data


class ReportService:
    @staticmethod
    def generate_daily_report(
        db: Session,
        report_date: date
    ) -> Dict[str, Any]:
        
        meal_counts = {
            "breakfast": db.query(MealAllocation).filter(
                MealAllocation.menu_date == report_date,
                MealAllocation.meal_type == "breakfast"
            ).count(),
            "lunch": db.query(MealAllocation).filter(
                MealAllocation.menu_date == report_date,
                MealAllocation.meal_type == "lunch"
            ).count(),
            "dinner": db.query(MealAllocation).filter(
                MealAllocation.menu_date == report_date,
                MealAllocation.meal_type == "dinner"
            ).count()
        }
        
        conflict_count = db.query(MealAllocation).filter(
            MealAllocation.menu_date == report_date,
            MealAllocation.has_conflict == 1
        ).count()
        
        deliveries = db.query(Delivery).filter(
            Delivery.delivery_date == report_date
        ).all()
        
        delivery_stats = {
            "total": len(deliveries),
            "delivered": len([d for d in deliveries if d.status == "delivered"]),
            "failed": len([d for d in deliveries if d.status == "failed"]),
            "pending": len([d for d in deliveries if d.status == "pending"])
        }
        
        follow_ups = db.query(FollowUp).filter(
            FollowUp.follow_up_date == report_date
        ).all()
        
        satisfaction_rate = 0
        if follow_ups:
            satisfied = len([f for f in follow_ups if f.overall_satisfaction in ["very_good", "good"]])
            satisfaction_rate = round(satisfied / len(follow_ups) * 100, 2)
        
        report = {
            "report_date": str(report_date),
            "generated_at": datetime.now().isoformat(),
            "meal_counts": meal_counts,
            "total_meals": sum(meal_counts.values()),
            "conflict_count": conflict_count,
            "delivery_stats": delivery_stats,
            "follow_up_count": len(follow_ups),
            "satisfaction_rate": satisfaction_rate
        }
        
        return report
    
    @staticmethod
    def generate_delivery_route_sheet(
        db: Session,
        delivery_date: date,
        meal_type: str,
        route: Optional[str] = None
    ) -> Dict[str, Any]:
        
        query = db.query(Delivery).filter(
            Delivery.delivery_date == delivery_date,
            Delivery.meal_type == meal_type
        )
        
        if route:
            query = query.filter(Delivery.route == route)
        
        deliveries = query.order_by(Delivery.route, Delivery.sequence).all()
        
        route_data = {}
        for delivery in deliveries:
            elderly = db.query(Elderly).filter(Elderly.id == delivery.elderly_id).first()
            if not elderly:
                continue
            
            if delivery.route not in route_data:
                route_data[delivery.route] = []
            
            route_data[delivery.route].append({
                "sequence": delivery.sequence,
                "elderly_id": elderly.id,
                "name": elderly.name,
                "room_number": elderly.room_number,
                "phone": mask_sensitive_data({"phone": elderly.phone})["phone"],
                "dietary_restrictions": elderly.dietary_restrictions,
                "status": delivery.status.value
            })
        
        return {
            "delivery_date": str(delivery_date),
            "meal_type": meal_type,
            "routes": route_data,
            "total_deliveries": len(deliveries)
        }
    
    @staticmethod
    def generate_conflict_report(
        db: Session,
        report_date: date
    ) -> Dict[str, Any]:
        
        allocations = db.query(MealAllocation).filter(
            MealAllocation.menu_date == report_date,
            MealAllocation.has_conflict == 1
        ).all()
        
        conflict_list = []
        for alloc in allocations:
            elderly = db.query(Elderly).filter(Elderly.id == alloc.elderly_id).first()
            conflict_list.append({
                "elderly_id": alloc.elderly_id,
                "elderly_name": elderly.name if elderly else None,
                "meal_type": alloc.meal_type.value,
                "conflicts": json.loads(alloc.conflicts) if alloc.conflicts else []
            })
        
        grouped_conflicts = {}
        for conflict in conflict_list:
            for c in conflict["conflicts"]:
                if c not in grouped_conflicts:
                    grouped_conflicts[c] = []
                grouped_conflicts[c].append(conflict["elderly_name"])
        
        return {
            "report_date": str(report_date),
            "total_conflicts": len(conflict_list),
            "conflicts": conflict_list,
            "grouped_conflicts": grouped_conflicts
        }
    
    @staticmethod
    def generate_export_file(
        db: Session,
        report_type: str,
        report_date: date,
        export_format: str = "json"
    ) -> str:
        
        export_dir = Path(settings.BASE_DIR) / "exports"
        export_dir.mkdir(parents=True, exist_ok=True)
        
        filename = f"{report_type}_{report_date.isoformat()}_{datetime.now().strftime('%H%M%S')}.{export_format}"
        filepath = export_dir / filename
        
        if report_type == "daily":
            report = ReportService.generate_daily_report(db, report_date)
        elif report_type == "delivery_route":
            report = ReportService.generate_delivery_route_sheet(db, report_date, "lunch")
        elif report_type == "conflict":
            report = ReportService.generate_conflict_report(db, report_date)
        else:
            raise ValueError(f"不支持的报告类型: {report_type}")
        
        if export_format == "json":
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
        else:
            raise ValueError(f"不支持的导出格式: {export_format}")
        
        return str(filepath)
    
    @staticmethod
    def get_operation_history(
        db: Session,
        entity_type: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: int = 100
    ) -> Dict[str, Any]:
        from app.models import OperationHistory
        
        query = db.query(OperationHistory)
        
        if entity_type:
            query = query.filter(OperationHistory.entity_type == entity_type)
        
        if start_date:
            query = query.filter(OperationHistory.operation_time >= start_date)
        
        if end_date:
            query = query.filter(OperationHistory.operation_time <= end_date + timedelta(days=1))
        
        query = query.order_by(OperationHistory.operation_time.desc()).limit(limit)
        
        history_list = query.all()
        
        result = []
        for h in history_list:
            result.append({
                "id": h.id,
                "operation_type": h.operation_type,
                "entity_type": h.entity_type,
                "entity_id": h.entity_id,
                "operator": h.operator,
                "operation_time": h.operation_time.isoformat() if h.operation_time else None,
                "changes": h.changes,
                "notes": h.notes
            })
        
        return {
            "success": True,
            "total": len(result),
            "history": result
        }
