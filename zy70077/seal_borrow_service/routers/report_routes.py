from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from ..database import get_db
from ..schemas import StatisticsSummary, MonthlyReportItem, BusinessResponse
from ..services.report_service import ReportService
from ..services.timeout_service import TimeoutService
from ..models import TimeoutLevel

router = APIRouter(prefix="/reports", tags=["统计报告"])


@router.get("/summary", response_model=BusinessResponse, summary="统计摘要")
def get_summary(db: Session = Depends(get_db)):
    stats = ReportService.get_statistics_summary(db)
    
    message = f"总计 {stats['total_applications']}笔申请。"
    message += f" 待审批 {stats['pending_approval']}笔，"
    message += f" 外借中 {stats['lended']}笔，"
    message += f" 已归还 {stats['returned']}笔，"
    message += f" 超时 {stats['timeout']}笔。"
    message += f" 材料不全 {stats['materials_missing']}笔，"
    message += f" 正常完成 {stats['normal_completion']}笔。"
    message += f" 超时等级：一级 {stats['timeout_level1']}、二级 {stats['timeout_level2']}、三级 {stats['timeout_level3']}、四级 {stats['timeout_level4']}。"
    
    return BusinessResponse(
        success=True,
        business_code="SUMMARY_OK",
        message=message,
        data=stats
    )


@router.get("/monthly/{year}/{month}", response_model=BusinessResponse, summary="月度报告")
def get_monthly_report(
    year: int,
    month: int,
    db: Session = Depends(get_db)
):
    report = ReportService.get_monthly_report(db, year, month)
    
    message = f"{year}年{month}月报告："
    message += f"共{report['total_applications']}笔申请，"
    message += f"正常完成{report['normal_completion']}笔，"
    message += f"材料不全{report['materials_incomplete']}笔，"
    message += f"严重超时{report['timeout_serious']}笔，"
    message += f"归还异常{report['abnormal_return']}笔。"
    message += f"平均外借{report['average_borrow_days']}天，"
    message += f"材料上传率{report['materials_upload_rate']}%。"
    
    return BusinessResponse(
        success=True,
        business_code="MONTHLY_REPORT_OK",
        message=message,
        data=report
    )


@router.get("/materials/{application_id}", response_model=BusinessResponse, summary="材料跟踪")
def get_materials_tracking(
    application_id: int,
    db: Session = Depends(get_db)
):
    tracking = ReportService.get_materials_tracking(db, application_id)
    
    if not tracking.get("success"):
        return BusinessResponse(
            success=False,
            business_code="MATERIALS_NOT_FOUND",
            message=tracking["message"]
        )
    
    status_msg = f"材料完整" if tracking["materials_complete"] else f"材料不全（待核验{tracking['unverified_materials']}份"
    message = f"申请 {tracking['application_no']}，申请人 {tracking['applicant']}："
    message += f"共上传 {tracking['total_materials']} 份材料，已核验 {tracking['verified_materials']} 份。{status_msg}。"
    
    return BusinessResponse(
        success=True,
        business_code="MATERIALS_TRACKING_OK",
        message=message,
        data=tracking
    )


@router.get("/ledger", response_model=BusinessResponse, summary="使用台账")
def get_usage_ledger(
    start_date: Optional[str] = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
    seal_id: Optional[int] = Query(None, description="印章ID"),
    db: Session = Depends(get_db)
):
    start = datetime.strptime(start_date, "%Y-%m-%d") if start_date else None
    end = datetime.strptime(end_date, "%Y-%m-%d") if end_date else None
    
    ledger = ReportService.get_usage_ledger(db, start, end, seal_id)
    
    message = f"共查询到 {len(ledger)} 笔外借记录"
    if start_date or end_date:
        period = f"（{start_date or '最早'} 至 {end_date or '最新'}）"
        message += period
    
    return BusinessResponse(
        success=True,
        business_code="LEDGER_OK",
        message=message,
        data={"count": len(ledger), "records": ledger}
    )


@router.get("/audit-trail", response_model=BusinessResponse, summary="审计追踪")
def get_audit_trail(
    application_id: Optional[int] = Query(None, description="申请ID"),
    include_manual_only: bool = Query(False, description="仅显示人工修正"),
    start_date: Optional[str] = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
    db: Session = Depends(get_db)
):
    start = datetime.strptime(start_date, "%Y-%m-%d") if start_date else None
    end = datetime.strptime(end_date, "%Y-%m-%d") if end_date else None
    
    records = ReportService.get_audit_trail(db, application_id, include_manual_only, start, end)
    
    filter_msg = "（仅显示人工修正记录）" if include_manual_only else ""
    message = f"共查询到 {len(records)} 条状态变更记录{filter_msg}。"
    
    return BusinessResponse(
        success=True,
        business_code="AUDIT_TRAIL_OK",
        message=message,
        data={"count": len(records), "records": records}
    )


@router.get("/reconciliation", response_model=BusinessResponse, summary="数据一致性校验")
def get_reconciliation(db: Session = Depends(get_db)):
    report = ReportService.get_reconciliation_report(db)
    
    if report["is_consistent"]:
        message = f"数据一致性检查通过：共{report['total_applications']}笔申请，"
        message += f"人工修正{report['manual_correction_count']}次，"
        message += f"无不一致记录。"
    else:
        message = f"数据一致性警告：发现{report['inconsistent_count']}条不一致记录，"
        message += f"共{report['total_applications']}笔申请，"
        message += f"人工修正{report['manual_correction_count']}次。"
    
    return BusinessResponse(
        success=report["is_consistent"],
        business_code="RECONCILIATION_OK" if report["is_consistent"] else "RECONCILIATION_ERROR",
        message=message,
        data=report
    )


@router.post("/tasks/check-timeout", response_model=BusinessResponse, summary="手动执行超时检测")
def run_timeout_check(db: Session = Depends(get_db)):
    result = TimeoutService.check_timeout_applications(db)
    
    return BusinessResponse(
        success=result["success"],
        business_code="TIMEOUT_CHECK_OK",
        message=result["message"],
        data=result["data"]
    )


@router.get("/timeout-alerts", response_model=BusinessResponse, summary="查询待处理超时告警")
def get_pending_alerts(
    level: Optional[TimeoutLevel] = Query(None, description="超时等级"),
    db: Session = Depends(get_db)
):
    alerts = TimeoutService.get_pending_timeout_alerts(db, level)
    
    level_msg = f"（等级{level.value}）" if level else ""
    message = f"共 {len(alerts)} 条待处理超时告警{level_msg}"
    
    return BusinessResponse(
        success=True,
        business_code="PENDING_ALERTS_OK",
        message=message,
        data={"count": len(alerts), "alerts": alerts}
    )


@router.get("/tasks/history", response_model=BusinessResponse, summary="后台任务执行历史")
def get_task_history(
    task_name: Optional[str] = Query(None, description="任务名称"),
    limit: int = Query(50, description="返回条数"),
    db: Session = Depends(get_db)
):
    logs = TimeoutService.get_task_execution_history(db, task_name, limit)
    
    message = f"共查询到 {len(logs)} 条任务执行记录。"
    
    return BusinessResponse(
        success=True,
        business_code="TASK_HISTORY_OK",
        message=message,
        data={"count": len(logs), "logs": logs}
    )


@router.post("/tasks/{log_id}/retry", response_model=BusinessResponse, summary="重试失败任务")
def retry_task(
    log_id: int,
    db: Session = Depends(get_db)
):
    result = TimeoutService.retry_failed_task(db, log_id)
    
    return BusinessResponse(
        success=result["success"],
        business_code="TASK_RETRY_OK" if result["success"] else "TASK_RETRY_FAILED",
        message=result["message"],
        data=result.get("data")
    )
