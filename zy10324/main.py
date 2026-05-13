from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import engine, get_db
from models import Base, DetectionStatus, RiskLevel
from schemas import (
    ApiInventoryCreate, ApiInventory, DetectionTaskCreate, DetectionTask,
    DetectionTaskDetail, DetectionHistory, CloseRecordCreate,
    StatusUpdateRequest, ScanResultRequest, AuthCheckRequest,
    RiskAssessmentRequest, ApiResponse, InspectionReport
)
from services import (
    ApiInventoryService, DetectionTaskService, InspectionReportService,
    TaskStateMachine
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="API 发布暗门检测系统",
    description="用于检测 API 发布过程中的安全风险，防止未授权的 API 暗门暴露",
    version="1.0.0"
)


@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=400,
        content={"success": False, "message": str(exc)}
    )


@app.post("/api/inventory/", response_model=ApiInventory, tags=["API清单管理"])
def create_api_inventory(api_data: ApiInventoryCreate, db: Session = Depends(get_db)):
    return ApiInventoryService.create_api_inventory(db, api_data)


@app.get("/api/inventory/", response_model=List[ApiInventory], tags=["API清单管理"])
def list_api_inventory(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return ApiInventoryService.list_api_inventory(db, skip=skip, limit=limit)


@app.get("/api/inventory/{api_id}", response_model=ApiInventory, tags=["API清单管理"])
def get_api_inventory(api_id: int, db: Session = Depends(get_db)):
    api = ApiInventoryService.get_api_inventory(db, api_id)
    if not api:
        raise HTTPException(status_code=404, detail="API not found")
    return api


@app.post("/detection/tasks/", response_model=DetectionTask, tags=["检测任务"])
def create_detection_task(task_data: DetectionTaskCreate, db: Session = Depends(get_db)):
    api = ApiInventoryService.get_api_inventory(db, task_data.api_inventory_id)
    if not api:
        raise HTTPException(status_code=404, detail="API inventory not found")
    return DetectionTaskService.create_detection_task(db, task_data)


@app.get("/detection/tasks/", response_model=List[DetectionTask], tags=["检测任务"])
def list_detection_tasks(
    skip: int = 0,
    limit: int = 100,
    status: DetectionStatus = None,
    db: Session = Depends(get_db)
):
    return DetectionTaskService.list_tasks(db, skip=skip, limit=limit, status=status)


@app.get("/detection/tasks/{task_id}", response_model=DetectionTaskDetail, tags=["检测任务"])
def get_detection_task(task_id: str, db: Session = Depends(get_db)):
    task = DetectionTaskService.get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.get("/detection/tasks/{task_id}/history", response_model=List[DetectionHistory], tags=["检测任务"])
def get_task_history(task_id: str, db: Session = Depends(get_db)):
    try:
        return DetectionTaskService.get_task_history(db, task_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/detection/tasks/{task_id}/scan", response_model=DetectionTaskDetail, tags=["检测流程"])
def start_scan(task_id: str, request: StatusUpdateRequest, db: Session = Depends(get_db)):
    try:
        return DetectionTaskService.transition_status(
            db, task_id, DetectionStatus.SCANNING,
            handler=request.handler, remark=request.remark or "开始路由扫描"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/detection/tasks/{task_id}/scan/complete", response_model=DetectionTaskDetail, tags=["检测流程"])
def complete_scan(task_id: str, request: ScanResultRequest, db: Session = Depends(get_db)):
    try:
        return DetectionTaskService.update_scan_result(
            db, task_id, request.scan_result, handler=request.handler
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/detection/tasks/{task_id}/auth-check", response_model=DetectionTaskDetail, tags=["检测流程"])
def start_auth_check(task_id: str, request: StatusUpdateRequest, db: Session = Depends(get_db)):
    try:
        return DetectionTaskService.transition_status(
            db, task_id, DetectionStatus.AUTH_CHECKING,
            handler=request.handler, remark=request.remark or "开始认证检查"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/detection/tasks/{task_id}/auth-check/complete", response_model=DetectionTaskDetail, tags=["检测流程"])
def complete_auth_check(task_id: str, request: AuthCheckRequest, db: Session = Depends(get_db)):
    try:
        return DetectionTaskService.update_auth_check(
            db, task_id, request.auth_type, request.auth_configured,
            request.auth_check_result, handler=request.handler
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/detection/tasks/{task_id}/risk-assessment", response_model=DetectionTaskDetail, tags=["检测流程"])
def start_risk_assessment(task_id: str, request: StatusUpdateRequest, db: Session = Depends(get_db)):
    try:
        return DetectionTaskService.transition_status(
            db, task_id, DetectionStatus.RISK_ASSESSING,
            handler=request.handler, remark=request.remark or "开始风险评估"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/detection/tasks/{task_id}/risk-assessment/complete", response_model=DetectionTaskDetail, tags=["检测流程"])
def complete_risk_assessment(task_id: str, request: RiskAssessmentRequest, db: Session = Depends(get_db)):
    try:
        return DetectionTaskService.update_risk_assessment(
            db, task_id, request.risk_level, request.risk_tags,
            request.risk_assessment_result, handler=request.handler
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/detection/tasks/{task_id}/confirm-close", response_model=DetectionTaskDetail, tags=["检测流程"])
def start_confirm_close(task_id: str, request: StatusUpdateRequest, db: Session = Depends(get_db)):
    try:
        return DetectionTaskService.transition_status(
            db, task_id, DetectionStatus.CONFIRMING_CLOSE,
            handler=request.handler, remark=request.remark or "开始关闭确认"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/detection/tasks/{task_id}/close", response_model=DetectionTaskDetail, tags=["检测流程"])
def close_task(task_id: str, close_data: CloseRecordCreate, db: Session = Depends(get_db)):
    try:
        return DetectionTaskService.confirm_close(
            db, task_id, close_data, close_confirmation_result=close_data.close_evidence
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/detection/tasks/{task_id}/cancel", response_model=DetectionTaskDetail, tags=["检测流程"])
def cancel_task(task_id: str, request: StatusUpdateRequest, db: Session = Depends(get_db)):
    try:
        return DetectionTaskService.transition_status(
            db, task_id, DetectionStatus.CANCELLED,
            handler=request.handler, remark=request.remark or "任务取消"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/inspection/reports/", response_model=InspectionReport, tags=["巡检报告"])
def generate_inspection_report(db: Session = Depends(get_db)):
    return InspectionReportService.generate_report(db)


@app.get("/inspection/reports/", response_model=List[InspectionReport], tags=["巡检报告"])
def list_reports(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    return InspectionReportService.list_reports(db, skip=skip, limit=limit)


@app.get("/inspection/reports/{report_id}", response_model=InspectionReport, tags=["巡检报告"])
def get_report(report_id: str, db: Session = Depends(get_db)):
    report = InspectionReportService.get_report(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@app.get("/", response_model=ApiResponse, tags=["系统"])
def root():
    return ApiResponse(
        success=True,
        message="API 发布暗门检测系统运行正常",
        data={"version": "1.0.0", "docs_url": "/docs"}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
