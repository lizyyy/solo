from datetime import datetime, timedelta
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from ..models import (
    BorrowApplication, UsageMaterial, ReturnRecord, TimeoutRecord,
    StatusHistory, Seal,
    ApplicationStatus, FinalResult, TimeoutLevel, StatusCorrectionType
)
from .status_service import StatusService


class ReportService:
    @staticmethod
    def get_statistics_summary(db: Session) -> Dict:
        total = db.query(func.count(BorrowApplication.id)).scalar() or 0
        
        pending_approval = db.query(func.count(BorrowApplication.id)).filter(
            BorrowApplication.status == ApplicationStatus.PENDING_APPROVAL
        ).scalar() or 0
        
        lended = db.query(func.count(BorrowApplication.id)).filter(
            BorrowApplication.status == ApplicationStatus.LENDED
        ).scalar() or 0
        
        returned = db.query(func.count(BorrowApplication.id)).filter(
            BorrowApplication.status == ApplicationStatus.RETURNED
        ).scalar() or 0
        
        timeout = db.query(func.count(BorrowApplication.id)).filter(
            BorrowApplication.status == ApplicationStatus.TIMEOUT
        ).scalar() or 0
        
        materials_missing = db.query(func.count(BorrowApplication.id)).filter(
            BorrowApplication.final_result == FinalResult.MATERIALS_INCOMPLETE
        ).scalar() or 0
        
        normal_completion = db.query(func.count(BorrowApplication.id)).filter(
            BorrowApplication.final_result == FinalResult.NORMAL_COMPLETION
        ).scalar() or 0
        
        level1 = db.query(func.count(TimeoutRecord.id)).filter(
            TimeoutRecord.timeout_level == TimeoutLevel.LEVEL1
        ).scalar() or 0
        
        level2 = db.query(func.count(TimeoutRecord.id)).filter(
            TimeoutRecord.timeout_level == TimeoutLevel.LEVEL2
        ).scalar() or 0
        
        level3 = db.query(func.count(TimeoutRecord.id)).filter(
            TimeoutRecord.timeout_level == TimeoutLevel.LEVEL3
        ).scalar() or 0
        
        level4 = db.query(func.count(TimeoutRecord.id)).filter(
            TimeoutRecord.timeout_level == TimeoutLevel.LEVEL4
        ).scalar() or 0
        
        return {
            "total_applications": total,
            "pending_approval": pending_approval,
            "lended": lended,
            "returned": returned,
            "timeout": timeout,
            "materials_missing": materials_missing,
            "normal_completion": normal_completion,
            "timeout_level1": level1,
            "timeout_level2": level2,
            "timeout_level3": level3,
            "timeout_level4": level4
        }

    @staticmethod
    def get_monthly_report(db: Session, year: int, month: int) -> Dict:
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        
        applications = db.query(BorrowApplication).filter(
            BorrowApplication.created_at >= start_date,
            BorrowApplication.created_at < end_date
        ).all()
        
        if not applications:
            return {
                "month": f"{year}-{month:02d}",
                "total_applications": 0,
                "normal_completion": 0,
                "materials_incomplete": 0,
                "timeout_serious": 0,
                "abnormal_return": 0,
                "average_borrow_days": 0.0,
                "materials_upload_rate": 0.0
            }
        
        total = len(applications)
        app_ids = [a.id for a in applications]
        
        normal = db.query(func.count(BorrowApplication.id)).filter(
            BorrowApplication.id.in_(app_ids),
            BorrowApplication.final_result == FinalResult.NORMAL_COMPLETION
        ).scalar() or 0
        
        materials_incomplete = db.query(func.count(BorrowApplication.id)).filter(
            BorrowApplication.id.in_(app_ids),
            BorrowApplication.final_result == FinalResult.MATERIALS_INCOMPLETE
        ).scalar() or 0
        
        timeout_serious = db.query(func.count(BorrowApplication.id)).filter(
            BorrowApplication.id.in_(app_ids),
            BorrowApplication.final_result == FinalResult.TIMEOUT_SERIOUS
        ).scalar() or 0
        
        abnormal_return = db.query(func.count(BorrowApplication.id)).filter(
            BorrowApplication.id.in_(app_ids),
            BorrowApplication.final_result == FinalResult.ABNORMAL_RETURN
        ).scalar() or 0
        
        return_records = db.query(ReturnRecord).filter(
            ReturnRecord.application_id.in_(app_ids)
        ).all()
        
        total_borrow_days = 0
        count_with_return = 0
        for rr in return_records:
            app = next((a for a in applications if a.id == rr.application_id), None)
            if app and app.borrow_records:
                borrow_date = app.borrow_records.actual_borrow_date
                return_date = rr.actual_return_date
                days = (return_date - borrow_date).total_seconds() / 86400
                total_borrow_days += days
                count_with_return += 1
        
        avg_days = total_borrow_days / count_with_return if count_with_return > 0 else 0
        
        apps_with_materials = db.query(UsageMaterial.application_id).filter(
            UsageMaterial.application_id.in_(app_ids)
        ).distinct().count()
        materials_rate = apps_with_materials / total if total > 0 else 0
        
        return {
            "month": f"{year}-{month:02d}",
            "total_applications": total,
            "normal_completion": normal,
            "materials_incomplete": materials_incomplete,
            "timeout_serious": timeout_serious,
            "abnormal_return": abnormal_return,
            "average_borrow_days": round(avg_days, 2),
            "materials_upload_rate": round(materials_rate * 100, 2)
        }

    @staticmethod
    def get_materials_tracking(db: Session, application_id: int) -> Dict:
        application = db.query(BorrowApplication).filter(
            BorrowApplication.id == application_id
        ).first()
        
        if not application:
            return {"success": False, "message": "申请不存在"}
        
        materials = db.query(UsageMaterial).filter(
            UsageMaterial.application_id == application_id
        ).all()
        
        total_materials = len(materials)
        verified_materials = len([m for m in materials if m.is_verified])
        
        return {
            "success": True,
            "application_no": application.application_no,
            "applicant": application.applicant_name,
            "total_materials": total_materials,
            "verified_materials": verified_materials,
            "unverified_materials": total_materials - verified_materials,
            "materials_complete": total_materials > 0 and (total_materials == verified_materials),
            "materials": [
                {
                    "id": m.id,
                    "name": m.material_name,
                    "type": m.material_type,
                    "is_verified": m.is_verified,
                    "verified_by": m.verified_by,
                    "verified_at": m.verified_at.isoformat() if m.verified_at else None
                }
                for m in materials
            ]
        }

    @staticmethod
    def get_usage_ledger(
        db: Session,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        seal_id: Optional[int] = None
    ) -> List[Dict]:
        query = db.query(BorrowApplication)
        
        if start_date:
            query = query.filter(BorrowApplication.created_at >= start_date)
        if end_date:
            query = query.filter(BorrowApplication.created_at <= end_date)
        if seal_id:
            query = query.filter(BorrowApplication.seal_id == seal_id)
        
        applications = query.order_by(BorrowApplication.created_at.desc()).all()
        
        ledger = []
        for app in applications:
            materials = db.query(UsageMaterial).filter(
                UsageMaterial.application_id == app.id
            ).all()
            
            timeout_records = db.query(TimeoutRecord).filter(
                TimeoutRecord.application_id == app.id
            ).all()
            
            has_manual_correction = StatusService.has_manual_correction(db, app.id)
            
            ledger.append({
                "application_no": app.application_no,
                "seal_name": app.seal.seal_name if app.seal else None,
                "seal_type": app.seal.seal_type.value if app.seal else None,
                "applicant": app.applicant_name,
                "department": app.applicant_department,
                "borrow_reason": app.borrow_reason,
                "planned_borrow_date": app.planned_borrow_date.isoformat() if app.planned_borrow_date else None,
                "planned_return_date": app.planned_return_date.isoformat() if app.planned_return_date else None,
                "actual_borrow_date": app.borrow_records.actual_borrow_date.isoformat() if app.borrow_records else None,
                "actual_return_date": app.return_records.actual_return_date.isoformat() if app.return_records else None,
                "status": app.status.value,
                "final_result": app.final_result.value if app.final_result else None,
                "materials_count": len(materials),
                "verified_materials_count": len([m for m in materials if m.is_verified]),
                "timeout_level": app.current_timeout_level.value if app.current_timeout_level else None,
                "timeout_count": len(timeout_records),
                "has_manual_correction": has_manual_correction
            })
        
        return ledger

    @staticmethod
    def get_audit_trail(
        db: Session,
        application_id: Optional[int] = None,
        include_manual_only: bool = False,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict]:
        query = db.query(StatusHistory)
        
        if application_id:
            query = query.filter(StatusHistory.application_id == application_id)
        
        if include_manual_only:
            query = query.filter(
                StatusHistory.correction_type == StatusCorrectionType.MANUAL_CORRECTION
            )
        
        if start_date:
            query = query.filter(StatusHistory.operation_time >= start_date)
        if end_date:
            query = query.filter(StatusHistory.operation_time <= end_date)
        
        histories = query.order_by(StatusHistory.operation_time.desc()).all()
        
        return [
            {
                "application_no": h.application.application_no if h.application else None,
                "previous_status": h.previous_status.value if h.previous_status else None,
                "new_status": h.new_status.value if h.new_status else None,
                "previous_timeout_level": h.previous_timeout_level.value if h.previous_timeout_level else None,
                "new_timeout_level": h.new_timeout_level.value if h.new_timeout_level else None,
                "correction_type": h.correction_type.value,
                "operator": h.operator,
                "operation_reason": h.operation_reason,
                "operation_time": h.operation_time.isoformat(),
                "affected_fields": h.affected_fields,
                "previous_values": h.previous_values,
                "new_values": h.new_values
            }
            for h in histories
        ]

    @staticmethod
    def get_reconciliation_report(db: Session) -> Dict:
        applications = db.query(BorrowApplication).all()
        
        inconsistent_records = []
        for app in applications:
            histories = StatusService.get_application_history(db, app.id)
            
            if histories:
                latest_history = histories[0]
                if latest_history.new_status != app.status:
                    inconsistent_records.append({
                        "application_no": app.application_no,
                        "issue": "当前状态与历史记录不一致",
                        "current_status": app.status.value,
                        "latest_history_status": latest_history.new_status.value
                    })
                
                if latest_history.new_timeout_level != app.current_timeout_level:
                    inconsistent_records.append({
                        "application_no": app.application_no,
                        "issue": "当前超时等级与历史记录不一致",
                        "current_timeout_level": app.current_timeout_level.value if app.current_timeout_level else None,
                        "latest_history_timeout_level": latest_history.new_timeout_level.value if latest_history.new_timeout_level else None
                    })
        
        manual_correction_count = db.query(StatusHistory).filter(
            StatusHistory.correction_type == StatusCorrectionType.MANUAL_CORRECTION
        ).count()
        
        return {
            "total_applications": len(applications),
            "inconsistent_count": len(inconsistent_records),
            "manual_correction_count": manual_correction_count,
            "inconsistent_records": inconsistent_records,
            "is_consistent": len(inconsistent_records) == 0
        }
