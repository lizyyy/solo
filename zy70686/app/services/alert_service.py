from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
from typing import List, Optional
from app.models import AlertReport
from app.schemas import AlertReportCreate, AlertReportHandle, AlertMergeRequest
from app.utils.common import generate_alert_no


class AlertService:
    VALID_STATUSES = ["pending", "processing", "resolved", "merged", "dismissed"]
    MERGE_WINDOW_HOURS = 24

    def __init__(self, db: Session):
        self.db = db

    def create_alert(self, alert_data: AlertReportCreate) -> AlertReport:
        existing_alert = self._find_existing_alert(
            alert_data.store_id,
            alert_data.material_id,
            alert_data.alert_type
        )

        if existing_alert:
            existing_alert.current_stock = alert_data.current_stock
            existing_alert.forecast_consumption = alert_data.forecast_consumption
            existing_alert.estimated_runout_days = alert_data.estimated_runout_days
            existing_alert.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(existing_alert)
            return existing_alert

        alert_no = generate_alert_no()
        db_alert = AlertReport(
            alert_no=alert_no,
            **alert_data.model_dump()
        )

        self.db.add(db_alert)
        self.db.commit()
        self.db.refresh(db_alert)
        return db_alert

    def _find_existing_alert(self, store_id: int, material_id: int, alert_type: str) -> Optional[AlertReport]:
        time_threshold = datetime.utcnow() - timedelta(hours=self.MERGE_WINDOW_HOURS)
        return self.db.query(AlertReport).filter(
            and_(
                AlertReport.store_id == store_id,
                AlertReport.material_id == material_id,
                AlertReport.alert_type == alert_type,
                AlertReport.status == "pending",
                AlertReport.created_at >= time_threshold
            )
        ).first()

    def handle_alert(self, alert_id: int, handle_data: AlertReportHandle) -> Optional[AlertReport]:
        alert = self.db.query(AlertReport).filter(AlertReport.id == alert_id).first()
        if not alert:
            return None

        if alert.status in ["resolved", "merged", "dismissed"]:
            raise ValueError(f"预警已处理，当前状态: {alert.status}")

        new_status = handle_data.status.lower()
        if new_status not in self.VALID_STATUSES:
            raise ValueError(f"无效的状态: {new_status}")

        alert.status = new_status
        alert.handled_by = handle_data.handled_by
        alert.handled_at = datetime.utcnow()
        if handle_data.remarks:
            alert.remarks = handle_data.remarks

        self.db.commit()
        self.db.refresh(alert)
        return alert

    def merge_alerts(self, merge_request: AlertMergeRequest) -> AlertReport:
        alerts = self.db.query(AlertReport).filter(
            AlertReport.id.in_(merge_request.alert_ids)
        ).all()

        if len(alerts) < 2:
            raise ValueError("至少需要2条预警才能合并")

        store_ids = set(a.store_id for a in alerts)
        if len(store_ids) > 1:
            raise ValueError("合并的预警必须来自同一门店")

        for alert in alerts:
            if alert.status in ["resolved", "merged", "dismissed"]:
                raise ValueError(f"预警 {alert.alert_no} 已处理，无法合并")

        main_alert = alerts[0]
        merged_nos = ",".join([a.alert_no for a in alerts[1:]])

        max_current_stock = max(a.current_stock for a in alerts)
        max_forecast_consumption = max(a.forecast_consumption for a in alerts)
        min_runout_days = min(
            (a.estimated_runout_days for a in alerts if a.estimated_runout_days is not None),
            default=None
        )

        main_alert.alert_type = merge_request.merged_alert_type
        main_alert.current_stock = max_current_stock
        main_alert.forecast_consumption = max_forecast_consumption
        main_alert.estimated_runout_days = min_runout_days
        main_alert.merged_from = merged_nos
        main_alert.status = "merged"
        main_alert.handled_by = merge_request.handled_by
        main_alert.handled_at = datetime.utcnow()

        for alert in alerts[1:]:
            alert.status = "merged"
            alert.handled_by = merge_request.handled_by
            alert.handled_at = datetime.utcnow()
            alert.merged_from = f"merged_into_{main_alert.alert_no}"

        self.db.commit()
        self.db.refresh(main_alert)
        return main_alert

    def find_related_alerts(self, store_id: int, hours: int = 24) -> List[AlertReport]:
        time_threshold = datetime.utcnow() - timedelta(hours=hours)
        return self.db.query(AlertReport).filter(
            and_(
                AlertReport.store_id == store_id,
                AlertReport.status == "pending",
                AlertReport.created_at >= time_threshold
            )
        ).order_by(AlertReport.created_at.desc()).all()

    def get_alerts_by_status(self, status: str, store_id: Optional[int] = None) -> List[AlertReport]:
        query = self.db.query(AlertReport).filter(AlertReport.status == status)
        if store_id:
            query = query.filter(AlertReport.store_id == store_id)
        return query.order_by(AlertReport.created_at.desc()).all()

    def get_alert(self, alert_id: int) -> Optional[AlertReport]:
        return self.db.query(AlertReport).filter(AlertReport.id == alert_id).first()
