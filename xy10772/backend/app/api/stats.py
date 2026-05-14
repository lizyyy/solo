from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, func
from app.core.database import get_db
from app.models import GrayRule, GrayStatus, GrayDevice, CrashReport, ReleaseRecord, GrayStats
from app.schemas import DashboardStats, GrayStatsResponse
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_rules = db.query(GrayRule).count()
    running_rules = db.query(GrayRule).filter(GrayRule.status == GrayStatus.RUNNING).count()
    
    success_rules = db.query(GrayRule).filter(GrayRule.status == GrayStatus.SUCCESS).count()
    completed_rules = db.query(GrayRule).filter(
        GrayRule.status.in_([GrayStatus.SUCCESS, GrayStatus.BLOCKED, GrayStatus.COMPENSATED])
    ).count()
    success_rate = success_rules / completed_rules if completed_rules > 0 else 0
    
    avg_crash_rate = db.query(func.avg(GrayStats.crash_rate)).filter(
        GrayStats.recorded_at >= datetime.utcnow() - timedelta(days=7)
    ).scalar() or 0
    
    recent_releases = db.query(ReleaseRecord).order_by(ReleaseRecord.released_at.desc()).limit(5).all()
    
    return {
        "total_gray_rules": total_rules,
        "running_gray_rules": running_rules,
        "success_rate": round(success_rate * 100, 2),
        "avg_crash_rate": round(avg_crash_rate * 100, 4),
        "recent_releases": recent_releases
    }

@router.get("/gray/{rule_id}", response_model=GrayStatsResponse)
def get_gray_stats(rule_id: int, db: Session = Depends(get_db)):
    total_devices = db.query(GrayDevice).filter(GrayDevice.gray_rule_id == rule_id).count()
    gray_devices = db.query(GrayDevice).filter(
        GrayDevice.gray_rule_id == rule_id,
        GrayDevice.is_gray == True
    ).count()
    upgrade_count = db.query(GrayDevice).filter(
        GrayDevice.gray_rule_id == rule_id,
        GrayDevice.upgraded_at != None
    ).count()
    crash_count = db.query(CrashReport).filter(CrashReport.gray_rule_id == rule_id).count()
    
    crash_rate = crash_count / upgrade_count if upgrade_count > 0 else 0
    
    stats = GrayStats(
        gray_rule_id=rule_id,
        total_devices=total_devices,
        gray_devices=gray_devices,
        upgrade_count=upgrade_count,
        crash_count=crash_count,
        crash_rate=crash_rate
    )
    
    return stats

@router.post("/gray/{rule_id}/refresh")
def refresh_gray_stats(rule_id: int, db: Session = Depends(get_db)):
    total_devices = db.query(GrayDevice).filter(GrayDevice.gray_rule_id == rule_id).count()
    gray_devices = db.query(GrayDevice).filter(
        GrayDevice.gray_rule_id == rule_id,
        GrayDevice.is_gray == True
    ).count()
    upgrade_count = db.query(GrayDevice).filter(
        GrayDevice.gray_rule_id == rule_id,
        GrayDevice.upgraded_at != None
    ).count()
    crash_count = db.query(CrashReport).filter(CrashReport.gray_rule_id == rule_id).count()
    
    crash_rate = crash_count / upgrade_count if upgrade_count > 0 else 0
    
    stats = GrayStats(
        gray_rule_id=rule_id,
        total_devices=total_devices,
        gray_devices=gray_devices,
        upgrade_count=upgrade_count,
        crash_count=crash_count,
        crash_rate=crash_rate
    )
    db.add(stats)
    db.commit()
    
    rule = db.query(GrayRule).filter(GrayRule.id == rule_id).first()
    if rule and crash_rate > rule.crash_rate_threshold:
        rule.status = GrayStatus.BLOCKED
        rule.completed_at = datetime.utcnow()
        db.commit()
    
    return {
        "total_devices": total_devices,
        "gray_devices": gray_devices,
        "upgrade_count": upgrade_count,
        "crash_count": crash_count,
        "crash_rate": round(crash_rate * 100, 4),
        "status": rule.status if rule else None
    }
