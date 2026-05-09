from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
import io

import models
import schemas
from database import engine, get_db
from services import PlanService, ExecutionService, RevenueService
from export_service import ExportService

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="储能充放电计划 API",
    description="储能电站充放电计划管理系统，支持电价、负荷预测和设备限制影响下的计划制定、执行和收益分析",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", tags=["系统"])
def root():
    return {
        "message": "储能充放电计划 API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.post("/price-windows/", response_model=schemas.PriceWindowResponse, tags=["电价窗口"])
def create_price_window(
    window: schemas.PriceWindowCreate,
    db: Session = Depends(get_db)
):
    if window.start_time >= window.end_time:
        raise HTTPException(status_code=400, detail="开始时间必须早于结束时间")
    
    db_window = models.PriceWindow(**window.model_dump())
    db.add(db_window)
    db.commit()
    db.refresh(db_window)
    return db_window

@app.get("/price-windows/", response_model=List[schemas.PriceWindowResponse], tags=["电价窗口"])
def get_price_windows(
    window_type: Optional[str] = None,
    is_charge: Optional[bool] = None,
    is_discharge: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.PriceWindow)
    
    if window_type:
        query = query.filter(models.PriceWindow.window_type == window_type)
    if is_charge is not None:
        query = query.filter(models.PriceWindow.is_charge_window == is_charge)
    if is_discharge is not None:
        query = query.filter(models.PriceWindow.is_discharge_window == is_discharge)
    
    return query.order_by(models.PriceWindow.start_time.asc()).all()

@app.post("/soc-constraints/", response_model=schemas.SOCConstraintResponse, tags=["SOC约束"])
def create_soc_constraint(
    constraint: schemas.SOCConstraintCreate,
    db: Session = Depends(get_db)
):
    if constraint.min_soc > constraint.max_soc:
        raise HTTPException(status_code=400, detail="最小 SOC 不能大于最大 SOC")
    
    existing = db.query(models.SOCConstraint).filter(
        models.SOCConstraint.station_id == constraint.station_id,
        models.SOCConstraint.plan_date == constraint.plan_date
    ).first()
    
    if existing:
        for key, value in constraint.model_dump().items():
            setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        return existing
    
    db_constraint = models.SOCConstraint(**constraint.model_dump())
    db.add(db_constraint)
    db.commit()
    db.refresh(db_constraint)
    return db_constraint

@app.get("/soc-constraints/", response_model=List[schemas.SOCConstraintResponse], tags=["SOC约束"])
def get_soc_constraints(
    station_id: Optional[str] = None,
    plan_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.SOCConstraint)
    
    if station_id:
        query = query.filter(models.SOCConstraint.station_id == station_id)
    if plan_date:
        query = query.filter(models.SOCConstraint.plan_date == plan_date)
    
    return query.order_by(models.SOCConstraint.plan_date.desc()).all()

@app.post("/plans/", response_model=schemas.ChargePlanResponse, tags=["充放电计划"])
def create_plan(
    plan: schemas.ChargePlanCreate,
    operator: Optional[str] = Query(None, description="操作人"),
    db: Session = Depends(get_db)
):
    try:
        return PlanService.create_plan(db, plan, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/plans/", response_model=List[schemas.ChargePlanResponse], tags=["充放电计划"])
def get_plans(
    station_id: Optional[str] = None,
    plan_date: Optional[date] = None,
    status: Optional[schemas.PlanStatus] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.ChargePlan)
    
    if station_id:
        query = query.filter(models.ChargePlan.station_id == station_id)
    if plan_date:
        query = query.filter(models.ChargePlan.plan_date == plan_date)
    if status:
        query = query.filter(models.ChargePlan.status == status.value)
    
    return query.order_by(models.ChargePlan.created_at.desc()).all()

@app.get("/plans/{plan_id}", response_model=schemas.ChargePlanResponse, tags=["充放电计划"])
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(models.ChargePlan).filter(models.ChargePlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="计划不存在")
    return plan

@app.post("/plans/{plan_id}/submit", response_model=schemas.ChargePlanResponse, tags=["充放电计划"])
def submit_plan(
    plan_id: int,
    operator: Optional[str] = Query(None, description="操作人"),
    db: Session = Depends(get_db)
):
    try:
        return PlanService.submit_plan_for_approval(db, plan_id, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/plans/{plan_id}/approve", response_model=schemas.ChargePlanResponse, tags=["充放电计划"])
def approve_plan(
    plan_id: int,
    operator: Optional[str] = Query(None, description="操作人"),
    db: Session = Depends(get_db)
):
    try:
        return PlanService.approve_plan(db, plan_id, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/plans/{plan_id}/start", response_model=schemas.ChargePlanResponse, tags=["充放电计划"])
def start_plan(
    plan_id: int,
    operator: Optional[str] = Query(None, description="操作人"),
    db: Session = Depends(get_db)
):
    try:
        return PlanService.start_execution(db, plan_id, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/plans/{plan_id}/cancel", response_model=schemas.ChargePlanResponse, tags=["充放电计划"])
def cancel_plan(
    plan_id: int,
    reason: str = Query(..., description="取消原因"),
    operator: Optional[str] = Query(None, description="操作人"),
    db: Session = Depends(get_db)
):
    try:
        return PlanService.cancel_plan(db, plan_id, reason, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/plans/manual-correct", response_model=schemas.ChargePlanResponse, tags=["充放电计划"])
def manual_correct_plan(
    correction: schemas.ManualCorrectionCreate,
    db: Session = Depends(get_db)
):
    try:
        return PlanService.manual_correct(db, correction)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/plans/{plan_id}/history", response_model=List[schemas.PlanHistoryResponse], tags=["充放电计划"])
def get_plan_history(plan_id: int, db: Session = Depends(get_db)):
    return PlanService.get_plan_history(db, plan_id)

@app.get("/plans/{plan_id}/versions", response_model=List[schemas.PlanVersionResponse], tags=["计划版本"])
def get_plan_versions(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(models.ChargePlan).filter(models.ChargePlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="计划不存在")
    return plan.versions

@app.post("/execution-receipts/", response_model=schemas.ExecutionReceiptResponse, tags=["执行回执"])
def create_execution_receipt(
    receipt: schemas.ExecutionReceiptCreate,
    db: Session = Depends(get_db)
):
    try:
        return ExecutionService.create_receipt(db, receipt)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/execution-receipts/", response_model=List[schemas.ExecutionReceiptResponse], tags=["执行回执"])
def get_execution_receipts(
    plan_id: Optional[int] = None,
    segment_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.ExecutionReceipt)
    
    if plan_id:
        query = query.filter(models.ExecutionReceipt.plan_id == plan_id)
    if segment_id:
        query = query.filter(models.ExecutionReceipt.segment_id == segment_id)
    
    return query.order_by(models.ExecutionReceipt.created_at.desc()).all()

@app.get("/alerts/", response_model=List[schemas.DeviationAlertResponse], tags=["偏差告警"])
def get_alerts(
    plan_id: Optional[int] = None,
    is_resolved: Optional[bool] = None,
    alert_level: Optional[schemas.AlertLevel] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.DeviationAlert)
    
    if plan_id:
        query = query.filter(models.DeviationAlert.plan_id == plan_id)
    if is_resolved is not None:
        query = query.filter(models.DeviationAlert.is_resolved == is_resolved)
    if alert_level:
        query = query.filter(models.DeviationAlert.alert_level == alert_level.value)
    
    return query.order_by(models.DeviationAlert.created_at.desc()).all()

@app.post("/alerts/{alert_id}/resolve", response_model=schemas.DeviationAlertResponse, tags=["偏差告警"])
def resolve_alert(
    alert_id: int,
    resolved_by: str = Query(..., description="处理人"),
    db: Session = Depends(get_db)
):
    try:
        return ExecutionService.resolve_alert(db, alert_id, resolved_by)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/revenue-reports/", response_model=List[schemas.RevenueReportResponse], tags=["收益报表"])
def get_revenue_reports(
    plan_id: Optional[int] = None,
    station_id: Optional[str] = None,
    report_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.RevenueReport)
    
    if plan_id:
        query = query.filter(models.RevenueReport.plan_id == plan_id)
    if station_id:
        query = query.filter(models.RevenueReport.station_id == station_id)
    if report_date:
        query = query.filter(models.RevenueReport.report_date == report_date)
    
    return query.order_by(models.RevenueReport.created_at.desc()).all()

@app.post("/revenue-reports/{plan_id}/generate", response_model=schemas.RevenueReportResponse, tags=["收益报表"])
def generate_revenue_report(plan_id: int, db: Session = Depends(get_db)):
    try:
        return RevenueService.generate_report(db, plan_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/plans/{plan_id}/export/csv", tags=["导出"])
def export_plan_csv(plan_id: int, db: Session = Depends(get_db)):
    try:
        data = ExportService.export_plan_to_csv(db, plan_id)
        plan = db.query(models.ChargePlan).filter(models.ChargePlan.id == plan_id).first()
        filename = f"plan_{plan_id}_{plan.station_id}_{plan.plan_date}.csv"
        
        return StreamingResponse(
            io.StringIO(data.decode('utf-8-sig')),
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.get("/plans/{plan_id}/export/excel", tags=["导出"])
def export_plan_excel(plan_id: int, db: Session = Depends(get_db)):
    try:
        data = ExportService.export_plan_to_excel(db, plan_id)
        plan = db.query(models.ChargePlan).filter(models.ChargePlan.id == plan_id).first()
        filename = f"plan_{plan_id}_{plan.station_id}_{plan.plan_date}.xlsx"
        
        return StreamingResponse(
            io.BytesIO(data),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
