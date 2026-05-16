from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db
from app.models import CompensationRecord, CompensationHistory, CompensationBatch, CompensationReport
from datetime import datetime

router = APIRouter()


@router.get("/", summary="健康检查")
def health_check():
    return {
        "status": "healthy",
        "service": "compensation-service",
        "timestamp": datetime.now().isoformat()
    }


@router.get("/db", summary="数据库连接检查")
def db_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


@router.get("/stats", summary="系统数据统计")
def get_stats(db: Session = Depends(get_db)):
    record_count = db.query(CompensationRecord).count()
    history_count = db.query(CompensationHistory).count()
    batch_count = db.query(CompensationBatch).count()
    report_count = db.query(CompensationReport).count()

    status_stats = {}
    for record in db.query(CompensationRecord.status).all():
        status = record[0]
        status_stats[status] = status_stats.get(status, 0) + 1

    return {
        "status": "healthy",
        "statistics": {
            "total_records": record_count,
            "total_histories": history_count,
            "total_batches": batch_count,
            "total_reports": report_count,
            "status_distribution": status_stats
        },
        "timestamp": datetime.now().isoformat()
    }


@router.get("/self-check", summary="最小自检")
def self_check(db: Session = Depends(get_db)):
    issues = []
    checks = []

    try:
        db.execute(text("SELECT 1"))
        checks.append({"name": "数据库连接", "status": "pass"})
    except Exception as e:
        checks.append({"name": "数据库连接", "status": "fail", "error": str(e)})
        issues.append(f"数据库连接失败: {str(e)}")

    try:
        records_without_history = db.query(CompensationRecord).filter(
            ~CompensationRecord.histories.any()
        ).count()
        if records_without_history > 0:
            checks.append({"name": "历史记录完整性", "status": "warning", "message": f"发现{records_without_history}条记录没有历史"})
            issues.append(f"{records_without_history}条补偿记录缺少历史记录")
        else:
            checks.append({"name": "历史记录完整性", "status": "pass"})
    except Exception as e:
        checks.append({"name": "历史记录完整性", "status": "fail", "error": str(e)})

    try:
        orphan_histories = db.query(CompensationHistory).filter(
            CompensationHistory.record_id.notin_(
                db.query(CompensationRecord.id)
            )
        ).count()
        if orphan_histories > 0:
            checks.append({"name": "历史记录关联完整性", "status": "warning", "message": f"发现{orphan_histories}条孤立历史记录"})
            issues.append(f"{orphan_histories}条历史记录没有关联的主记录")
        else:
            checks.append({"name": "历史记录关联完整性", "status": "pass"})
    except Exception as e:
        checks.append({"name": "历史记录关联完整性", "status": "fail", "error": str(e)})

    try:
        success_records = db.query(CompensationRecord).filter(
            CompensationRecord.status.in_(["success", "manual_fixed"]),
            CompensationRecord.processed_at.is_(None)
        ).count()
        if success_records > 0:
            checks.append({"name": "处理时间完整性", "status": "warning", "message": f"发现{success_records}条成功记录缺少处理时间"})
            issues.append(f"{success_records}条成功/人工修正记录缺少处理时间")
        else:
            checks.append({"name": "处理时间完整性", "status": "pass"})
    except Exception as e:
        checks.append({"name": "处理时间完整性", "status": "fail", "error": str(e)})

    has_failures = any(c.get("status") == "fail" for c in checks)
    if not issues:
        overall_status = "healthy"
    elif has_failures:
        overall_status = "unhealthy"
    else:
        overall_status = "warning"

    return {
        "status": overall_status,
        "checks": checks,
        "issues": issues,
        "timestamp": datetime.now().isoformat()
    }
