from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
from typing import List, Optional
import json

from app import crud, models, schemas
from app.database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="社区养老探访API服务",
    description="围绕老人探访计划、实际到访和异常上报之间断链问题的解决方案",
    version="1.0.0"
)

@app.get("/", tags=["根目录"])
def read_root():
    return {
        "name": "社区养老探访API服务",
        "version": "1.0.0",
        "description": "探访计划 → 签到定位 → 异常上报 → 家属通知 → 服务报表",
        "docs": "/docs",
        "redoc": "/redoc"
    }

# ==================== 老人管理 ====================
@app.post("/elderly/", response_model=schemas.Elderly, tags=["老人管理"], summary="录入老人信息")
def create_elderly(elderly: schemas.ElderlyCreate, db: Session = Depends(get_db)):
    db_elderly = crud.get_elderly_by_id_card(db, id_card=elderly.id_card)
    if db_elderly:
        raise HTTPException(status_code=400, detail="老人信息已存在")
    return crud.create_elderly(db=db, elderly=elderly)

@app.get("/elderly/", response_model=List[schemas.Elderly], tags=["老人管理"], summary="获取老人列表")
def read_elderly(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    elderly = crud.get_all_elderly(db, skip=skip, limit=limit)
    return elderly

@app.get("/elderly/{elderly_id}", response_model=schemas.Elderly, tags=["老人管理"], summary="获取老人详情")
def read_elderly_by_id(elderly_id: int, db: Session = Depends(get_db)):
    db_elderly = crud.get_elderly(db, elderly_id=elderly_id)
    if db_elderly is None:
        raise HTTPException(status_code=404, detail="老人信息不存在")
    return db_elderly

# ==================== 探访计划 ====================
@app.post("/plans/", tags=["探访计划"], summary="创建探访计划（支持幂等性）")
def create_visit_plan(plan: schemas.VisitPlanCreate, db: Session = Depends(get_db)):
    db_elderly = crud.get_elderly(db, elderly_id=plan.elderly_id)
    if db_elderly is None:
        raise HTTPException(status_code=404, detail="老人信息不存在")
    
    db_plan, created = crud.create_visit_plan(db=db, plan=plan)
    
    duplicates = crud.find_duplicate_tasks(
        db=db,
        elderly_id=plan.elderly_id,
        plan_date=plan.plan_date,
        visit_type=plan.visit_type,
        exclude_plan_id=db_plan.id if created else None
    )
    
    return {
        "plan": schemas.VisitPlan.model_validate(db_plan),
        "created": created,
        "duplicate_warning": len(duplicates) > 0,
        "duplicate_count": len(duplicates)
    }

@app.get("/plans/", response_model=List[schemas.VisitPlan], tags=["探访计划"], summary="获取探访计划列表")
def read_visit_plans(
    elderly_id: Optional[int] = None,
    plan_date: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    if elderly_id:
        return crud.get_visit_plans_by_elderly(db, elderly_id=elderly_id, skip=skip, limit=limit)
    elif plan_date:
        return crud.get_visit_plans_by_date(db, plan_date=plan_date, skip=skip, limit=limit)
    return crud.get_all_visit_plans(db, skip=skip, limit=limit)

@app.get("/plans/{plan_id}", response_model=schemas.VisitPlan, tags=["探访计划"], summary="获取探访计划详情")
def read_visit_plan(plan_id: int, db: Session = Depends(get_db)):
    db_plan = crud.get_visit_plan(db, plan_id=plan_id)
    if db_plan is None:
        raise HTTPException(status_code=404, detail="探访计划不存在")
    return db_plan

@app.put("/plans/{plan_id}", tags=["探访计划"], summary="更新探访计划")
def update_visit_plan(
    plan_id: int,
    plan_update: schemas.VisitPlanUpdate,
    operator: str = Query(..., description="操作人"),
    db: Session = Depends(get_db)
):
    db_plan = crud.update_visit_plan(db, plan_id=plan_id, plan_update=plan_update, operator=operator)
    if db_plan is None:
        raise HTTPException(status_code=404, detail="探访计划不存在")
    return {"message": "探访计划已更新", "plan": schemas.VisitPlan.model_validate(db_plan)}

@app.post("/plans/{plan_id}/cancel", tags=["探访计划"], summary="取消探访计划")
def cancel_plan(
    plan_id: int,
    operator: str = Query(..., description="操作人"),
    db: Session = Depends(get_db)
):
    db_plan = crud.cancel_visit_plan(db, plan_id=plan_id, operator=operator)
    if db_plan is None:
        raise HTTPException(status_code=404, detail="探访计划不存在")
    return {"message": "探访计划已取消", "plan": schemas.VisitPlan.model_validate(db_plan)}

@app.post("/plans/merge", tags=["探访计划"], summary="合并重复任务")
def merge_plans(
    primary_plan_id: int = Query(..., description="主计划ID"),
    merge_plan_ids: str = Query(..., description="要合并的计划ID列表，逗号分隔"),
    merge_reason: str = Query(..., description="合并原因"),
    merged_by: str = Query(..., description="合并操作人"),
    db: Session = Depends(get_db)
):
    plan_ids = [int(x.strip()) for x in merge_plan_ids.split(",") if x.strip()]
    result = crud.merge_duplicate_tasks(
        db=db,
        primary_plan_id=primary_plan_id,
        merge_plan_ids=plan_ids,
        merge_reason=merge_reason,
        merged_by=merged_by
    )
    if result is None:
        raise HTTPException(status_code=404, detail="主计划不存在")
    return {"message": "计划合并成功", "primary_plan": schemas.VisitPlan.model_validate(result)}

@app.get("/plans/{plan_id}/history", tags=["探访计划"], summary="获取计划操作历史")
def get_plan_history(plan_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    history = crud.get_operation_history(db, plan_id=plan_id, skip=skip, limit=limit)
    return {
        "plan_id": plan_id,
        "history": [schemas.OperationHistory.model_validate(h) for h in history]
    }

# ==================== 签到定位 ====================
@app.post("/visits/check-in", tags=["签到定位"], summary="签到")
def visit_check_in(check_in_data: schemas.VisitRecordCheckIn, db: Session = Depends(get_db)):
    db_elderly = crud.get_elderly(db, elderly_id=check_in_data.elderly_id)
    if db_elderly is None:
        raise HTTPException(status_code=404, detail="老人信息不存在")
    
    if check_in_data.plan_id:
        db_plan = crud.get_visit_plan(db, plan_id=check_in_data.plan_id)
        if db_plan is None:
            raise HTTPException(status_code=404, detail="探访计划不存在")
    
    db_record, created = crud.check_in(db=db, check_in_data=check_in_data)
    
    return {
        "visit_record": schemas.VisitRecord.model_validate(db_record),
        "created": created,
        "message": "签到成功" if created else "已存在未签退的签到记录"
    }

@app.post("/visits/{record_id}/check-out", tags=["签到定位"], summary="签退")
def visit_check_out(
    record_id: int,
    check_out_data: schemas.VisitRecordCheckOut,
    operator: str = Query(..., description="操作人"),
    db: Session = Depends(get_db)
):
    db_record = crud.check_out(db, record_id=record_id, check_out_data=check_out_data, operator=operator)
    if db_record is None:
        raise HTTPException(status_code=404, detail="签到记录不存在")
    return {
        "message": "签退成功",
        "visit_record": schemas.VisitRecord.model_validate(db_record)
    }

@app.post("/visits/backdate", tags=["签到定位"], summary="补录探访记录")
def backdate_visit(
    visit_data: schemas.VisitRecordCreate,
    operator: str = Query(..., description="操作人"),
    db: Session = Depends(get_db)
):
    if not visit_data.is_backdated:
        raise HTTPException(status_code=400, detail="补录记录必须标记为 backdated")
    
    db_elderly = crud.get_elderly(db, elderly_id=visit_data.elderly_id)
    if db_elderly is None:
        raise HTTPException(status_code=404, detail="老人信息不存在")
    
    db_record, status = crud.create_backdated_visit(db=db, visit_data=visit_data, operator=operator)
    
    return {
        "visit_record": schemas.VisitRecord.model_validate(db_record),
        "status": status,
        "message": "补录成功" if status == "Created" else "记录已存在"
    }

@app.post("/visits/{record_id}/withdraw", tags=["签到定位"], summary="撤回探访记录")
def withdraw_visit(
    record_id: int,
    reason: str = Query(..., description="撤回原因"),
    operator: str = Query(..., description="操作人"),
    db: Session = Depends(get_db)
):
    db_record = crud.withdraw_visit_record(db, record_id=record_id, operator=operator, reason=reason)
    if db_record is None:
        raise HTTPException(status_code=404, detail="探访记录不存在")
    return {"message": "探访记录已撤回", "record_id": record_id}

@app.get("/visits/", response_model=List[schemas.VisitRecord], tags=["签到定位"], summary="获取探访记录列表")
def read_visits(
    elderly_id: Optional[int] = None,
    plan_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    if elderly_id:
        return crud.get_visit_records_by_elderly(db, elderly_id=elderly_id, skip=skip, limit=limit)
    elif plan_id:
        return crud.get_visit_records_by_plan(db, plan_id=plan_id, skip=skip, limit=limit)
    raise HTTPException(status_code=400, detail="必须提供 elderly_id 或 plan_id")

@app.get("/visits/{record_id}", response_model=schemas.VisitRecord, tags=["签到定位"], summary="获取探访记录详情")
def read_visit(record_id: int, db: Session = Depends(get_db)):
    db_record = crud.get_visit_record(db, record_id=record_id)
    if db_record is None:
        raise HTTPException(status_code=404, detail="探访记录不存在")
    return db_record

# ==================== 异常上报 ====================
@app.post("/exceptions/", tags=["异常上报"], summary="上报异常")
def create_exception(exception: schemas.ExceptionReportCreate, db: Session = Depends(get_db)):
    db_elderly = crud.get_elderly(db, elderly_id=exception.elderly_id)
    if db_elderly is None:
        raise HTTPException(status_code=404, detail="老人信息不存在")
    
    db_exception = crud.create_exception_report(db=db, exception=exception)
    
    notification_content = f"【异常通知】老人{db_elderly.name}发生{exception.exception_type}异常，级别：{exception.exception_level}。请尽快处理。描述：{exception.description[:100]}"
    
    family_notification = schemas.NotificationCreate(
        exception_id=db_exception.id,
        recipient_type="family",
        recipient_name=db_elderly.family_contact_name,
        recipient_phone=db_elderly.family_contact_phone,
        notification_type="exception_alert",
        content=notification_content
    )
    crud.create_notification(db=db, notification=family_notification)
    
    return {
        "exception": schemas.ExceptionReport.model_validate(db_exception),
        "message": "异常已上报，家属通知已发送"
    }

@app.post("/exceptions/{exception_id}/resolve", tags=["异常上报"], summary="解决异常")
def resolve_exception(
    exception_id: int,
    resolve_data: schemas.ExceptionReportResolve,
    db: Session = Depends(get_db)
):
    db_exception = crud.resolve_exception_report(db, exception_id=exception_id, resolve_data=resolve_data)
    if db_exception is None:
        raise HTTPException(status_code=404, detail="异常记录不存在")
    return {
        "message": "异常已解决",
        "exception": schemas.ExceptionReport.model_validate(db_exception)
    }

@app.get("/exceptions/", response_model=List[schemas.ExceptionReport], tags=["异常上报"], summary="获取异常列表")
def read_exceptions(
    elderly_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    if status == "pending":
        return crud.get_pending_exception_reports(db, skip=skip, limit=limit)
    elif elderly_id:
        return crud.get_exception_reports_by_elderly(db, elderly_id=elderly_id, skip=skip, limit=limit)
    raise HTTPException(status_code=400, detail="必须提供 elderly_id 或 status=pending")

@app.get("/exceptions/{exception_id}", response_model=schemas.ExceptionReport, tags=["异常上报"], summary="获取异常详情")
def read_exception(exception_id: int, db: Session = Depends(get_db)):
    db_exception = crud.get_exception_report(db, exception_id=exception_id)
    if db_exception is None:
        raise HTTPException(status_code=404, detail="异常记录不存在")
    return db_exception

# ==================== 家属通知 ====================
@app.get("/exceptions/{exception_id}/notifications", response_model=List[schemas.Notification], tags=["家属通知"], summary="获取异常的通知记录")
def read_notifications(exception_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_notifications_by_exception(db, exception_id=exception_id, skip=skip, limit=limit)

@app.post("/notifications/{notification_id}/ack", tags=["家属通知"], summary="确认通知已接收")
def ack_notification(
    notification_id: int,
    ack_by: str = Query(..., description="确认人"),
    db: Session = Depends(get_db)
):
    db_notification = crud.ack_notification(db, notification_id=notification_id, ack_by=ack_by)
    if db_notification is None:
        raise HTTPException(status_code=404, detail="通知记录不存在")
    return {
        "message": "通知已确认",
        "notification": schemas.Notification.model_validate(db_notification)
    }

# ==================== 服务报表 ====================
@app.get("/reports/daily", tags=["服务报表"], summary="获取日报")
def get_daily_report(report_date: date = Query(..., description="报表日期"), db: Session = Depends(get_db)):
    return crud.get_daily_report(db, report_date=report_date)

@app.get("/reports/elderly/{elderly_id}", tags=["服务报表"], summary="获取老人探访汇总")
def get_elderly_report(
    elderly_id: int,
    start_date: date = Query(..., description="开始日期"),
    end_date: date = Query(..., description="结束日期"),
    db: Session = Depends(get_db)
):
    summary = crud.get_elderly_visit_summary(db, elderly_id=elderly_id, start_date=start_date, end_date=end_date)
    if summary is None:
        raise HTTPException(status_code=404, detail="老人信息不存在")
    return summary

@app.get("/reports/export/daily", tags=["服务报表"], summary="导出日报（JSON格式，用于业务复核）")
def export_daily_report(report_date: date = Query(..., description="报表日期"), db: Session = Depends(get_db)):
    daily_report = crud.get_daily_report(db, report_date=report_date)
    
    plans = crud.get_visit_plans_by_date(db, plan_date=report_date)
    plan_list = []
    for plan in plans:
        elderly = crud.get_elderly(db, elderly_id=plan.elderly_id)
        visits = crud.get_visit_records_by_plan(db, plan_id=plan.id)
        exceptions = crud.get_exception_reports_by_elderly(db, elderly_id=plan.elderly_id)
        
        plan_list.append({
            "plan_id": plan.id,
            "elderly_name": elderly.name if elderly else "未知",
            "plan_time": plan.plan_time,
            "visit_type": plan.visit_type,
            "caregiver": plan.caregiver,
            "status": plan.status,
            "visits_count": len(visits),
            "exceptions_count": len([e for e in exceptions if e.plan_id == plan.id])
        })
    
    pending_exceptions = crud.get_pending_exception_reports(db)
    exception_list = []
    for exc in pending_exceptions:
        elderly = crud.get_elderly(db, elderly_id=exc.elderly_id)
        exception_list.append({
            "exception_id": exc.id,
            "elderly_name": elderly.name if elderly else "未知",
            "exception_type": exc.exception_type,
            "exception_level": exc.exception_level,
            "report_time": str(exc.report_time),
            "reported_by": exc.reported_by,
            "description": exc.description[:200]
        })
    
    export_data = {
        "report_type": "daily_business_review",
        "report_date": str(report_date),
        "generated_at": str(datetime.utcnow()),
        "summary": {
            "total_plans": daily_report.total_plans,
            "completed_visits": daily_report.completed_visits,
            "pending_visits": daily_report.pending_visits,
            "missed_visits": daily_report.missed_visits,
            "visit_completion_rate": f"{(daily_report.completed_visits / daily_report.total_plans * 100) if daily_report.total_plans > 0 else 0:.1f}%",
            "total_exceptions": daily_report.total_exceptions,
            "pending_exceptions": daily_report.pending_exceptions,
            "resolved_exceptions": daily_report.resolved_exceptions,
            "family_notifications_sent": daily_report.family_notifications_sent
        },
        "review_checklist": {
            "pending_visits_to_follow_up": daily_report.pending_visits,
            "pending_exceptions_to_resolve": daily_report.pending_exceptions,
            "missed_visits_to_investigate": daily_report.missed_visits
        },
        "detailed_plans": plan_list,
        "pending_exceptions_detail": exception_list
    }
    
    return JSONResponse(content=export_data)
