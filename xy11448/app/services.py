from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
import json

from app.models import (
    PileAlert, Inspection, CustomerComplaint, SupervisorComment,
    WorkOrder, Reconciliation, FailedData, ChargingPile,
    AlertStatus, WorkOrderStatus, DataQuality
)
from app.schemas import DataQualityCheck, ReconciliationLink


class DataQualityService:
    @staticmethod
    def validate_pile_alert(db: Session, alert_data: Dict) -> Tuple[bool, List[str]]:
        issues = []
        
        if not alert_data.get("pile_id"):
            issues.append("缺少充电桩ID")
        else:
            pile = db.query(ChargingPile).filter(ChargingPile.id == alert_data.get("pile_id")).first()
            if not pile:
                issues.append(f"充电桩ID {alert_data.get('pile_id')} 不存在")
        
        if not alert_data.get("alert_type"):
            issues.append("缺少告警类型")
        
        if not alert_data.get("start_time"):
            issues.append("缺少开始时间")
        
        if alert_data.get("end_time") and alert_data.get("start_time"):
            try:
                start = datetime.fromisoformat(str(alert_data.get("start_time")).replace("Z", "+00:00"))
                end = datetime.fromisoformat(str(alert_data.get("end_time")).replace("Z", "+00:00"))
                if end < start:
                    issues.append("结束时间早于开始时间")
            except:
                issues.append("时间格式错误")
        
        return len(issues) == 0, issues
    
    @staticmethod
    def validate_inspection(db: Session, inspection_data: Dict) -> Tuple[bool, List[str]]:
        issues = []
        
        if not inspection_data.get("pile_id"):
            issues.append("缺少充电桩ID")
        else:
            pile = db.query(ChargingPile).filter(ChargingPile.id == inspection_data.get("pile_id")).first()
            if not pile:
                issues.append(f"充电桩ID {inspection_data.get('pile_id')} 不存在")
        
        if not inspection_data.get("inspection_date"):
            issues.append("缺少巡检日期")
        
        if inspection_data.get("status") == "abnormal" and not inspection_data.get("abnormal_items"):
            issues.append("异常状态需要填写异常项")
        
        return len(issues) == 0, issues
    
    @staticmethod
    def validate_complaint(db: Session, complaint_data: Dict) -> Tuple[bool, List[str]]:
        issues = []
        
        if not complaint_data.get("complaint_no"):
            issues.append("缺少投诉单号")
        
        if not complaint_data.get("complaint_time"):
            issues.append("缺少投诉时间")
        
        if complaint_data.get("pile_id"):
            pile = db.query(ChargingPile).filter(ChargingPile.id == complaint_data.get("pile_id")).first()
            if not pile:
                issues.append(f"充电桩ID {complaint_data.get('pile_id')} 不存在")
        
        return len(issues) == 0, issues
    
    @staticmethod
    def save_failed_data(db: Session, data_type: str, source_data: Dict, error_message: str):
        failed = FailedData(
            data_type=data_type,
            source_data=json.dumps(source_data, ensure_ascii=False),
            error_message=error_message
        )
        db.add(failed)
        db.commit()
        db.refresh(failed)
        return failed


class ReconciliationService:
    @staticmethod
    def link_alert_to_workorder(db: Session, alert_id: int) -> Optional[ReconciliationLink]:
        alert = db.query(PileAlert).filter(PileAlert.id == alert_id).first()
        if not alert:
            return None
        
        work_order = db.query(WorkOrder).filter(WorkOrder.alert_id == alert_id).first()
        
        inspection = db.query(Inspection).filter(
            and_(
                Inspection.pile_id == alert.pile_id,
                Inspection.inspection_date >= alert.start_time - timedelta(days=3),
                Inspection.inspection_date <= (alert.end_time or datetime.now()) + timedelta(days=3)
            )
        ).first()
        
        complaint = db.query(CustomerComplaint).filter(
            and_(
                CustomerComplaint.pile_id == alert.pile_id,
                CustomerComplaint.complaint_time >= alert.start_time - timedelta(days=7),
                CustomerComplaint.complaint_time <= (alert.end_time or datetime.now()) + timedelta(days=7)
            )
        ).first()
        
        comments = db.query(SupervisorComment).filter(
            or_(
                and_(SupervisorComment.related_type == "alert", SupervisorComment.related_id == alert_id),
                and_(SupervisorComment.related_type == "work_order", SupervisorComment.related_id == work_order.id if work_order else None)
            )
        ).all()
        
        return ReconciliationLink(
            alert_id=alert_id,
            inspection_id=inspection.id if inspection else None,
            complaint_id=complaint.id if complaint else None,
            work_order_id=work_order.id if work_order else None,
            comments=comments
        )
    
    @staticmethod
    def create_reconciliation_record(
        db: Session,
        alert_id: int,
        user_id: int
    ) -> Reconciliation:
        alert = db.query(PileAlert).filter(PileAlert.id == alert_id).first()
        if not alert:
            raise ValueError("告警记录不存在")
        
        link = ReconciliationService.link_alert_to_workorder(db, alert_id)
        
        if link and link.work_order_id:
            work_order = db.query(WorkOrder).filter(WorkOrder.id == link.work_order_id).first()
        else:
            work_order = None
        
        if alert.duration_minutes is None and alert.end_time:
            duration = (alert.end_time - alert.start_time).total_seconds() / 60
        else:
            duration = alert.duration_minutes or 0
        
        recon_status = "pending"
        recon_result = ""
        
        if alert.status == AlertStatus.RECOVERED:
            if work_order and work_order.status == WorkOrderStatus.COMPLETED:
                recon_status = "completed"
                recon_result = "告警已恢复，工单已完成"
            elif work_order and work_order.status in [WorkOrderStatus.PENDING, WorkOrderStatus.PROCESSING]:
                recon_status = "warning"
                recon_result = "告警已恢复但工单仍在处理中"
            else:
                recon_status = "review_needed"
                recon_result = "告警已恢复但无关联工单"
        
        monthly_duration = ReconciliationService.calculate_monthly_fault_duration(
            db, alert.pile_id, alert.start_time
        )
        
        recon = Reconciliation(
            recon_date=datetime.now(),
            pile_id=alert.pile_id,
            alert_id=alert_id,
            inspection_id=link.inspection_id if link else None,
            complaint_id=link.complaint_id if link else None,
            work_order_id=link.work_order_id if link else None,
            recon_status=recon_status,
            recon_result=recon_result,
            fault_duration_minutes=duration,
            monthly_fault_duration=monthly_duration,
            created_by=user_id
        )
        
        db.add(recon)
        db.commit()
        db.refresh(recon)
        
        return recon
    
    @staticmethod
    def calculate_monthly_fault_duration(db: Session, pile_id: int, date: datetime) -> float:
        start_of_month = date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if date.month == 12:
            end_of_month = date.replace(year=date.year + 1, month=1, day=1)
        else:
            end_of_month = date.replace(month=date.month + 1, day=1)
        
        alerts = db.query(PileAlert).filter(
            and_(
                PileAlert.pile_id == pile_id,
                PileAlert.start_time >= start_of_month,
                PileAlert.start_time < end_of_month,
                PileAlert.data_quality == DataQuality.VALID
            )
        ).all()
        
        total_duration = 0.0
        for alert in alerts:
            if alert.duration_minutes:
                total_duration += alert.duration_minutes
            elif alert.end_time:
                total_duration += (alert.end_time - alert.start_time).total_seconds() / 60
        
        return round(total_duration, 2)
    
    @staticmethod
    def check_work_order_status(db: Session, alert_id: int) -> Dict[str, Any]:
        alert = db.query(PileAlert).filter(PileAlert.id == alert_id).first()
        if not alert:
            return {"error": "告警不存在"}
        
        work_order = db.query(WorkOrder).filter(WorkOrder.alert_id == alert_id).first()
        
        result = {
            "alert_id": alert_id,
            "alert_status": alert.status,
            "has_work_order": work_order is not None,
            "work_order_status": work_order.status if work_order else None,
            "work_order_no": work_order.order_no if work_order else None,
            "is_alert_recovered_wo_pending": False
        }
        
        if alert.status == AlertStatus.RECOVERED and work_order:
            if work_order.status in [WorkOrderStatus.PENDING, WorkOrderStatus.PROCESSING]:
                result["is_alert_recovered_wo_pending"] = True
                result["issue"] = "异常告警已恢复但工单仍挂着，需要核实工单处理情况"
        
        return result


class PlaybackService:
    @staticmethod
    def playback_alert_chain(db: Session, pile_id: int, start_time: datetime, end_time: datetime) -> Dict[str, Any]:
        alerts = db.query(PileAlert).filter(
            and_(
                PileAlert.pile_id == pile_id,
                PileAlert.start_time >= start_time,
                PileAlert.start_time <= end_time
            )
        ).order_by(PileAlert.start_time).all()
        
        result = {
            "pile_id": pile_id,
            "time_range": {"start": start_time, "end": end_time},
            "alert_count": len(alerts),
            "alert_chain": [],
            "inspections": [],
            "complaints": [],
            "work_orders": []
        }
        
        for alert in alerts:
            link = ReconciliationService.link_alert_to_workorder(db, alert.id)
            result["alert_chain"].append({
                "alert_id": alert.id,
                "alert_type": alert.alert_type,
                "alert_message": alert.alert_message,
                "start_time": alert.start_time,
                "end_time": alert.end_time,
                "status": alert.status,
                "linked_work_order": link.work_order_id if link else None,
                "linked_inspection": link.inspection_id if link else None,
                "linked_complaint": link.complaint_id if link else None
            })
        
        inspections = db.query(Inspection).filter(
            and_(
                Inspection.pile_id == pile_id,
                Inspection.inspection_date >= start_time,
                Inspection.inspection_date <= end_time
            )
        ).all()
        result["inspections"] = [{"id": i.id, "date": i.inspection_date, "status": i.status} for i in inspections]
        
        complaints = db.query(CustomerComplaint).filter(
            and_(
                CustomerComplaint.pile_id == pile_id,
                CustomerComplaint.complaint_time >= start_time,
                CustomerComplaint.complaint_time <= end_time
            )
        ).all()
        result["complaints"] = [{"id": c.id, "no": c.complaint_no, "type": c.complaint_type} for c in complaints]
        
        work_orders = db.query(WorkOrder).filter(
            and_(
                WorkOrder.pile_id == pile_id,
                WorkOrder.created_at >= start_time,
                WorkOrder.created_at <= end_time
            )
        ).all()
        result["work_orders"] = [{"id": w.id, "no": w.order_no, "status": w.status} for w in work_orders]
        
        return result


class ReportService:
    @staticmethod
    def get_monthly_report(db: Session, year: int, month: int, area: Optional[str] = None) -> List[Dict]:
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        
        query = db.query(ChargingPile)
        if area:
            query = query.filter(ChargingPile.area == area)
        
        piles = query.all()
        
        report_items = []
        for pile in piles:
            alerts = db.query(PileAlert).filter(
                and_(
                    PileAlert.pile_id == pile.id,
                    PileAlert.start_time >= start_date,
                    PileAlert.start_time < end_date,
                    PileAlert.data_quality == DataQuality.VALID
                )
            ).all()
            
            offline_count = sum(1 for a in alerts if a.alert_type == "offline")
            abnormal_count = sum(1 for a in alerts if a.alert_type == "abnormal")
            
            total_duration = sum(
                a.duration_minutes or 
                ((a.end_time - a.start_time).total_seconds() / 60 if a.end_time else 0)
                for a in alerts
            )
            
            complaint_count = db.query(CustomerComplaint).filter(
                and_(
                    CustomerComplaint.pile_id == pile.id,
                    CustomerComplaint.complaint_time >= start_date,
                    CustomerComplaint.complaint_time < end_date,
                    CustomerComplaint.data_quality == DataQuality.VALID
                )
            ).count()
            
            work_order_count = db.query(WorkOrder).filter(
                and_(
                    WorkOrder.pile_id == pile.id,
                    WorkOrder.created_at >= start_date,
                    WorkOrder.created_at < end_date
                )
            ).count()
            
            report_items.append({
                "pile_id": pile.id,
                "pile_code": pile.pile_code,
                "pile_name": pile.pile_name or pile.pile_code,
                "area": pile.area or "",
                "fault_count": len(alerts),
                "total_duration_minutes": round(total_duration, 2),
                "avg_duration_minutes": round(total_duration / len(alerts), 2) if alerts else 0,
                "offline_count": offline_count,
                "abnormal_count": abnormal_count,
                "complaint_count": complaint_count,
                "work_order_count": work_order_count,
                "alert_ids": [a.id for a in alerts]
            })
        
        return report_items
    
    @staticmethod
    def trace_record(db: Session, record_type: str, record_id: int) -> Dict[str, Any]:
        if record_type == "alert":
            record = db.query(PileAlert).filter(PileAlert.id == record_id).first()
        elif record_type == "inspection":
            record = db.query(Inspection).filter(Inspection.id == record_id).first()
        elif record_type == "complaint":
            record = db.query(CustomerComplaint).filter(CustomerComplaint.id == record_id).first()
        elif record_type == "work_order":
            record = db.query(WorkOrder).filter(WorkOrder.id == record_id).first()
        else:
            return {"error": "不支持的记录类型"}
        
        if not record:
            return {"error": "记录不存在"}
        
        trace_data = {
            "record_type": record_type,
            "record_id": record_id,
            "record_data": {c.name: getattr(record, c.name) for c in record.__table__.columns},
            "source": [],
            "related_records": [],
            "audit_trail": []
        }
        
        if hasattr(record, "created_by") and record.created_by:
            trace_data["source"].append({
                "type": "user_create",
                "user_id": record.created_by,
                "action": "create"
            })
        
        if hasattr(record, "alert_id") and record.alert_id:
            trace_data["related_records"].append({"type": "alert", "id": record.alert_id})
        
        if hasattr(record, "pile_id") and record.pile_id:
            trace_data["related_records"].append({"type": "pile", "id": record.pile_id})
        
        return trace_data
