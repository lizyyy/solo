from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from database import get_db, init_db
from models import ApplicationStatus, MaterialStatus, CorrectionTaskStatus
from schemas import (
    MaterialCreate, MaterialUpdate, MaterialResponse,
    ReviewRuleCreate, ReviewRuleUpdate, ReviewRuleResponse,
    ApplicationCreate, ApplicationUpdate, ApplicationResponse,
    ApplicationStatusHistoryResponse,
    CorrectionTaskCreate, CorrectionTaskUpdate, CorrectionTaskResponse,
    RejectReasonCreate, RejectReasonResponse,
    SubmitApplicationRequest, ReviewMaterialRequest,
    RejectApplicationRequest, AcceptApplicationRequest,
    RetryCorrectionTaskRequest, ApplicationSummary, CorrectionTaskSummary
)
from services.material_service import MaterialService, ReviewRuleService
from services.application_service import (
    ApplicationService, ApplicationMaterialService,
    CorrectionTaskService, RejectReasonService
)

router = APIRouter()


@router.on_event("startup")
def startup_event():
    init_db()


@router.get("/health")
def health_check():
    return {"status": "healthy"}


@router.get("/materials", response_model=List[MaterialResponse])
def list_materials(
    category: Optional[str] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return MaterialService.get_materials(db, category, keyword)


@router.get("/materials/{material_id}", response_model=MaterialResponse)
def get_material(material_id: int, db: Session = Depends(get_db)):
    material = MaterialService.get_material_by_id(db, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="材料目录不存在")
    return material


@router.post("/materials", response_model=MaterialResponse, status_code=status.HTTP_201_CREATED)
def create_material(material_data: MaterialCreate, db: Session = Depends(get_db)):
    if MaterialService.get_material_by_code(db, material_data.code):
        raise HTTPException(status_code=400, detail="材料编码已存在")
    return MaterialService.create_material(db, material_data)


@router.put("/materials/{material_id}", response_model=MaterialResponse)
def update_material(material_id: int, update_data: MaterialUpdate, db: Session = Depends(get_db)):
    material = MaterialService.update_material(db, material_id, update_data)
    if not material:
        raise HTTPException(status_code=404, detail="材料目录不存在")
    return material


@router.delete("/materials/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material(material_id: int, db: Session = Depends(get_db)):
    if not MaterialService.delete_material(db, material_id):
        raise HTTPException(status_code=404, detail="材料目录不存在")


@router.get("/materials/{material_id}/rules", response_model=List[ReviewRuleResponse])
def list_material_rules(material_id: int, is_active: Optional[int] = None, db: Session = Depends(get_db)):
    if not MaterialService.get_material_by_id(db, material_id):
        raise HTTPException(status_code=404, detail="材料目录不存在")
    return ReviewRuleService.get_rules_by_material(db, material_id, is_active)


@router.post("/review-rules", response_model=ReviewRuleResponse, status_code=status.HTTP_201_CREATED)
def create_review_rule(rule_data: ReviewRuleCreate, db: Session = Depends(get_db)):
    if not MaterialService.get_material_by_id(db, rule_data.material_id):
        raise HTTPException(status_code=404, detail="关联的材料目录不存在")
    return ReviewRuleService.create_rule(db, rule_data)


@router.put("/review-rules/{rule_id}", response_model=ReviewRuleResponse)
def update_review_rule(rule_id: int, update_data: ReviewRuleUpdate, db: Session = Depends(get_db)):
    rule = ReviewRuleService.update_rule(db, rule_id, update_data)
    if not rule:
        raise HTTPException(status_code=404, detail="预审规则不存在")
    return rule


@router.delete("/review-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review_rule(rule_id: int, db: Session = Depends(get_db)):
    if not ReviewRuleService.delete_rule(db, rule_id):
        raise HTTPException(status_code=404, detail="预审规则不存在")


@router.get("/applications", response_model=List[ApplicationResponse])
def list_applications(
    status: Optional[ApplicationStatus] = None,
    applicant_name: Optional[str] = None,
    business_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return ApplicationService.get_applications(db, status, applicant_name, business_type)


@router.get("/applications/by-no/{app_no}", response_model=ApplicationResponse)
def get_application_by_no(app_no: str, db: Session = Depends(get_db)):
    app = ApplicationService.get_application_by_no(db, app_no)
    if not app:
        raise HTTPException(status_code=404, detail="办件不存在")
    return app


@router.get("/applications/summary", response_model=ApplicationSummary)
def get_applications_summary(db: Session = Depends(get_db)):
    return ApplicationService.get_summary(db)


@router.get("/applications/{app_id}", response_model=ApplicationResponse)
def get_application(app_id: int, db: Session = Depends(get_db)):
    app = ApplicationService.get_application_by_id(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="办件不存在")
    return app


@router.post("/applications", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
def create_application(app_data: ApplicationCreate, db: Session = Depends(get_db)):
    return ApplicationService.create_application(db, app_data)


@router.post("/applications/submit", response_model=ApplicationResponse)
def submit_application(request: SubmitApplicationRequest, db: Session = Depends(get_db)):
    app = ApplicationService.submit_application(db, request.application_id)
    if not app:
        raise HTTPException(status_code=400, detail="办件状态不允许提交或办件不存在")
    return app


@router.post("/applications/{app_id}/start-review", response_model=ApplicationResponse)
def start_review(app_id: int, reviewer: Optional[str] = None, db: Session = Depends(get_db)):
    app = ApplicationService.start_review(db, app_id, reviewer)
    if not app:
        raise HTTPException(status_code=400, detail="办件状态不允许开始预审或办件不存在")
    return app


@router.post("/applications/reject", response_model=ApplicationResponse)
def reject_application(request: RejectApplicationRequest, db: Session = Depends(get_db)):
    app = ApplicationService.reject_application(db, request.application_id, request.reject_reason, request.operator)
    if not app:
        raise HTTPException(status_code=404, detail="办件不存在")
    return app


@router.post("/applications/accept", response_model=ApplicationResponse)
def accept_application(request: AcceptApplicationRequest, db: Session = Depends(get_db)):
    app = ApplicationService.accept_application(db, request.application_id, request.operator)
    if not app:
        raise HTTPException(status_code=404, detail="办件不存在")
    return app


@router.get("/applications/{app_id}/history", response_model=List[ApplicationStatusHistoryResponse])
def get_application_history(app_id: int, db: Session = Depends(get_db)):
    if not ApplicationService.get_application_by_id(db, app_id):
        raise HTTPException(status_code=404, detail="办件不存在")
    return ApplicationService.get_status_history(db, app_id)


@router.post("/materials/review", response_model=ApplicationResponse)
def review_material(request: ReviewMaterialRequest, db: Session = Depends(get_db)):
    mat = ApplicationMaterialService.review_material(
        db, request.application_material_id, request.status,
        request.review_result, request.reviewer
    )
    if not mat:
        raise HTTPException(status_code=404, detail="申请材料不存在")
    
    app = ApplicationService.get_application_by_id(db, mat.application_id)
    if not app:
        raise HTTPException(status_code=404, detail="关联办件不存在")
    
    all_materials = app.materials
    has_needs_correction = any(m.status == MaterialStatus.NEEDS_CORRECTION for m in all_materials)
    all_approved = all(m.status in [MaterialStatus.APPROVED, MaterialStatus.CORRECTED] for m in all_materials)
    
    if has_needs_correction and app.status != ApplicationStatus.NEEDS_CORRECTION:
        old_status = app.status.value
        app.status = ApplicationStatus.NEEDS_CORRECTION
        app.current_step = "材料补正"
        ApplicationService.add_status_history(
            db, app.id, old_status, app.status.value,
            reason=f"材料「{mat.material_name}」需补正",
            operator=request.reviewer or "系统"
        )
        db.commit()
        db.refresh(app)
    elif all_approved and app.status == ApplicationStatus.UNDER_REVIEW:
        old_status = app.status.value
        app.status = ApplicationStatus.ACCEPTED
        app.accept_time = datetime.utcnow()
        app.current_step = "窗口受理"
        ApplicationService.add_status_history(
            db, app.id, old_status, app.status.value,
            reason="所有材料预审通过",
            operator=request.reviewer or "系统"
        )
        db.commit()
        db.refresh(app)
    
    return app


@router.get("/correction-tasks", response_model=List[CorrectionTaskResponse])
def list_correction_tasks(
    application_id: Optional[int] = None,
    status: Optional[CorrectionTaskStatus] = None,
    assignee: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return CorrectionTaskService.get_tasks(db, application_id, status, assignee)


@router.get("/correction-tasks/{task_id}", response_model=CorrectionTaskResponse)
def get_correction_task(task_id: int, db: Session = Depends(get_db)):
    task = CorrectionTaskService.get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="补正任务不存在")
    return task


@router.post("/correction-tasks", response_model=CorrectionTaskResponse, status_code=status.HTTP_201_CREATED)
def create_correction_task(task_data: CorrectionTaskCreate, db: Session = Depends(get_db)):
    if not ApplicationService.get_application_by_id(db, task_data.application_id):
        raise HTTPException(status_code=404, detail="关联办件不存在")
    if not ApplicationMaterialService.get_application_material(db, task_data.application_material_id):
        raise HTTPException(status_code=404, detail="关联申请材料不存在")
    return CorrectionTaskService.create_task(
        db, task_data.application_id, task_data.application_material_id,
        task_data.task_name, task_data.correction_content,
        task_data.assignee, task_data.due_date
    )


@router.post("/correction-tasks/{task_id}/start", response_model=CorrectionTaskResponse)
def start_correction_task(task_id: int, db: Session = Depends(get_db)):
    task = CorrectionTaskService.start_task(db, task_id)
    if not task:
        raise HTTPException(status_code=400, detail="任务状态不允许开始或任务不存在")
    return task


@router.post("/correction-tasks/{task_id}/complete", response_model=CorrectionTaskResponse)
def complete_correction_task(task_id: int, db: Session = Depends(get_db)):
    task = CorrectionTaskService.complete_task(db, task_id)
    if not task:
        raise HTTPException(status_code=400, detail="任务状态不允许完成或任务不存在")
    
    ApplicationMaterialService.update_after_correction(db, task.application_material_id)
    
    app = ApplicationService.get_application_by_id(db, task.application_id)
    if app and app.status == ApplicationStatus.NEEDS_CORRECTION:
        all_tasks = CorrectionTaskService.get_tasks(db, application_id=app.id)
        all_completed = all(t.status == CorrectionTaskStatus.COMPLETED for t in all_tasks)
        
        if all_completed:
            old_status = app.status.value
            app.status = ApplicationStatus.CORRECTED
            app.current_step = "补正完成"
            ApplicationService.add_status_history(
                db, app.id, old_status, app.status.value,
                reason="所有补正任务已完成",
                operator="系统"
            )
            db.commit()
    
    return task


@router.post("/correction-tasks/{task_id}/fail")
def fail_correction_task(task_id: int, error_message: str, db: Session = Depends(get_db)):
    task = CorrectionTaskService.fail_task(db, task_id, error_message)
    if not task:
        raise HTTPException(status_code=404, detail="补正任务不存在")
    return {"message": "任务已标记为失败", "task_id": task_id}


@router.post("/correction-tasks/retry", response_model=CorrectionTaskResponse)
def retry_correction_task(request: RetryCorrectionTaskRequest, db: Session = Depends(get_db)):
    task = CorrectionTaskService.retry_task(db, request.task_id, request.operator)
    if not task:
        raise HTTPException(status_code=400, detail="只有失败状态的任务才能重试")
    return task


@router.get("/correction-tasks/summary", response_model=CorrectionTaskSummary)
def get_correction_tasks_summary(db: Session = Depends(get_db)):
    return CorrectionTaskService.get_summary(db)


@router.get("/reject-reasons", response_model=List[RejectReasonResponse])
def list_reject_reasons(is_active: Optional[int] = 1, db: Session = Depends(get_db)):
    return RejectReasonService.get_reasons(db, is_active)


@router.post("/reject-reasons", response_model=RejectReasonResponse, status_code=status.HTTP_201_CREATED)
def create_reject_reason(reason_data: RejectReasonCreate, db: Session = Depends(get_db)):
    return RejectReasonService.create_reason(
        db, reason_data.code, reason_data.name,
        reason_data.description, reason_data.category
    )
