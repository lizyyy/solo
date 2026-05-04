from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services import DashboardService

router = APIRouter()


@router.get("/risk")
async def get_risk_dashboard(db: AsyncSession = Depends(get_db)):
    service = DashboardService(db)
    return await service.get_risk_dashboard()


@router.get("/summary")
async def get_dashboard_summary(db: AsyncSession = Depends(get_db)):
    service = DashboardService(db)
    dashboard = await service.get_risk_dashboard()
    
    alerts = dashboard.get("alerts", {})
    stats = dashboard.get("stats", {})
    
    urgent_alerts = []
    if alerts.get("already_expired"):
        urgent_alerts.append({
            "type": "expired",
            "count": len(alerts["already_expired"]),
            "label": "已过期保单",
            "severity": "danger"
        })
    
    expiring_urgent = [p for p in alerts.get("expiring_soon", []) if p.get("days_remaining", 30) <= 7]
    if expiring_urgent:
        urgent_alerts.append({
            "type": "expiring_soon",
            "count": len(expiring_urgent),
            "label": "7天内到期",
            "severity": "warning"
        })
    
    overdue_reports = [r for r in alerts.get("urgent_reports", []) if r.get("is_overdue")]
    if overdue_reports:
        urgent_alerts.append({
            "type": "overdue_reports",
            "count": len(overdue_reports),
            "label": "逾期报案",
            "severity": "danger"
        })
    
    return {
        "stats": stats,
        "urgent_alerts": urgent_alerts,
        "summary": dashboard.get("summary"),
    }
