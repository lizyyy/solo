from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import json
from datetime import datetime, timedelta

from backend.database import get_db, engine, Base
from backend.models import User, FormTemplate, Workflow, FormSubmission, ValidationRule
from backend.schemas import (
    UserCreate, UserResponse,
    FormTemplateCreate, FormTemplateResponse,
    WorkflowCreate, WorkflowResponse,
    FormSubmissionCreate, FormSubmissionResponse,
    ApprovalAction, WithdrawRequest, ResubmitRequest,
    BatchImportRequest, ValidationResponse
)
from backend.services import (
    UserService, FormTemplateService, WorkflowService,
    FormSubmissionService, ValidationService
)
from backend.export_service import ExportService

Base.metadata.create_all(bind=engine)

app = FastAPI(title="表单流程规则编排系统")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", response_class=HTMLResponse)
async def root():
    with open("templates/index.html", "r", encoding="utf-8") as f:
        return f.read()


def init_sample_data(db: Session):
    if db.query(User).count() > 0:
        return
    
    users = [
        {"username": "zhangsan", "name": "张三", "email": "zhangsan@example.com", "role": "employee", "department": "技术部"},
        {"username": "lisi", "name": "李四", "email": "lisi@example.com", "role": "manager", "department": "技术部"},
        {"username": "wangwu", "name": "王五", "email": "wangwu@example.com", "role": "director", "department": "管理层"},
        {"username": "zhaoliu", "name": "赵六", "email": "zhaoliu@example.com", "role": "hr", "department": "人力资源部"}
    ]
    
    created_users = []
    for user_data in users:
        user = UserService.create_user(db, UserCreate(**user_data))
        created_users.append(user)
    
    template = FormTemplateService.create_template(db, FormTemplateCreate(
        name="费用报销申请单",
        description="员工差旅及日常费用报销申请",
        created_by=created_users[0].id,
        fields=[
            {"name": "amount", "label": "报销金额", "type": "number", "required": True},
            {"name": "reason", "label": "报销事由", "type": "text", "required": True},
            {"name": "department", "label": "所属部门", "type": "select", "required": True},
            {"name": "email", "label": "联系邮箱", "type": "email", "required": True},
            {"name": "is_emergency", "label": "是否紧急", "type": "checkbox", "required": False}
        ]
    ))
    
    workflow_nodes = [
        {"id": "start", "type": "start", "name": "开始"},
        {"id": "approval1", "type": "approval", "name": "部门经理审批", "approvers": [created_users[1].id]},
        {"id": "approval2", "type": "approval", "name": "财务总监审批", "approvers": [created_users[2].id]},
        {"id": "approval3", "type": "approval", "name": "HR确认", "approvers": [created_users[3].id]},
        {"id": "end", "type": "end", "name": "结束"}
    ]
    
    workflow_edges = [
        {"source": "start", "target": "approval1", "condition": {}},
        {"source": "approval1", "target": "approval2", "condition": {"field": "amount", "operator": "greater_than", "value": 5000}},
        {"source": "approval1", "target": "approval3", "condition": {"field": "amount", "operator": "less_than", "value": 5000}},
        {"source": "approval2", "target": "approval3", "condition": {}},
        {"source": "approval3", "target": "end", "condition": {}}
    ]
    
    workflow = WorkflowService.create_workflow(db, WorkflowCreate(
        name="费用报销审批流程",
        description="标准费用报销多级审批流程",
        form_template_id=template.id,
        created_by=created_users[0].id,
        nodes=workflow_nodes,
        edges=workflow_edges
    ))
    
    validation_rules = [
        {"workflow_id": workflow.id, "node_id": "", "field_name": "amount", "rule_type": "required", "rule_config": {}, "error_message": "报销金额不能为空"},
        {"workflow_id": workflow.id, "node_id": "", "field_name": "amount", "rule_type": "min_value", "rule_config": {"min": 1}, "error_message": "报销金额必须大于0"},
        {"workflow_id": workflow.id, "node_id": "", "field_name": "amount", "rule_type": "max_value", "rule_config": {"max": 100000}, "error_message": "报销金额不能超过100000"},
        {"workflow_id": workflow.id, "node_id": "", "field_name": "reason", "rule_type": "required", "rule_config": {}, "error_message": "报销事由不能为空"},
        {"workflow_id": workflow.id, "node_id": "", "field_name": "reason", "rule_type": "min_length", "rule_config": {"min": 5}, "error_message": "报销事由至少5个字符"},
        {"workflow_id": workflow.id, "node_id": "", "field_name": "department", "rule_type": "required", "rule_config": {}, "error_message": "所属部门不能为空"},
        {"workflow_id": workflow.id, "node_id": "", "field_name": "email", "rule_type": "required", "rule_config": {}, "error_message": "联系邮箱不能为空"},
        {"workflow_id": workflow.id, "node_id": "", "field_name": "email", "rule_type": "email", "rule_config": {}, "error_message": "邮箱格式不正确"}
    ]
    
    from backend.schemas import ValidationRuleCreate
    for rule_data in validation_rules:
        ValidationService.create_validation_rule(db, ValidationRuleCreate(**rule_data))
    
    sample_submissions = [
        {
            "form_data": {"amount": 3000, "reason": "北京出差交通费", "department": "技术部", "email": "zhangsan@example.com", "is_emergency": False},
            "status": "complete"
        },
        {
            "form_data": {"amount": 8000, "reason": "参加技术峰会费用", "department": "技术部", "email": "zhangsan@example.com", "is_emergency": True},
            "status": "pending_manager"
        },
        {
            "form_data": {"amount": 500, "reason": "办公用品采购", "department": "技术部", "email": "zhangsan@example.com", "is_emergency": False},
            "status": "draft"
        },
        {
            "form_data": {"amount": 15000, "reason": "服务器采购预付款", "department": "技术部", "email": "invalid-email", "is_emergency": True},
            "status": "invalid"
        }
    ]
    
    for sub_data in sample_submissions:
        submission = FormSubmissionService.create_submission(db, FormSubmissionCreate(
            form_template_id=template.id,
            workflow_id=workflow.id,
            submitter_id=created_users[0].id,
            form_data=sub_data["form_data"]
        ))
        
        if sub_data["status"] == "complete":
            submitted = FormSubmissionService.submit_form(db, submission.id)
            FormSubmissionService.approve_submission(db, submitted.id, created_users[1].id, "同意报销")
        elif sub_data["status"] == "pending_manager":
            FormSubmissionService.submit_form(db, submission.id)
        elif sub_data["status"] == "timeout":
            submitted = FormSubmissionService.submit_form(db, submission.id)
            submitted.updated_at = datetime.utcnow() - timedelta(hours=48)
            db.commit()
    
    print("Sample data initialized successfully!")


@app.on_event("startup")
async def startup_event():
    db = next(get_db())
    try:
        init_sample_data(db)
    finally:
        db.close()


@app.get("/api/users", response_model=List[UserResponse])
def get_users(db: Session = Depends(get_db)):
    return UserService.get_all_users(db)


@app.post("/api/users", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    return UserService.create_user(db, user)


@app.get("/api/templates", response_model=List[FormTemplateResponse])
def get_templates(db: Session = Depends(get_db)):
    return FormTemplateService.get_all_templates(db)


@app.get("/api/workflows", response_model=List[WorkflowResponse])
def get_workflows(db: Session = Depends(get_db)):
    return WorkflowService.get_all_workflows(db)


@app.get("/api/workflows/{workflow_id}", response_model=WorkflowResponse)
def get_workflow(workflow_id: int, db: Session = Depends(get_db)):
    workflow = WorkflowService.get_workflow(db, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


@app.post("/api/submissions", response_model=FormSubmissionResponse)
def create_submission(submission: FormSubmissionCreate, db: Session = Depends(get_db)):
    return FormSubmissionService.create_submission(db, submission)


@app.post("/api/submissions/{submission_id}/submit", response_model=FormSubmissionResponse)
def submit_submission(submission_id: int, db: Session = Depends(get_db)):
    try:
        return FormSubmissionService.submit_form(db, submission_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/submissions", response_model=List[FormSubmissionResponse])
def get_submissions(user_id: int = None, db: Session = Depends(get_db)):
    if user_id:
        return FormSubmissionService.get_submissions_by_user(db, user_id)
    return FormSubmissionService.get_all_submissions(db)


@app.get("/api/submissions/{submission_id}", response_model=FormSubmissionResponse)
def get_submission(submission_id: int, db: Session = Depends(get_db)):
    submission = FormSubmissionService.get_submission(db, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission


@app.post("/api/submissions/approve", response_model=FormSubmissionResponse)
def approve_submission(action: ApprovalAction, db: Session = Depends(get_db)):
    try:
        return FormSubmissionService.approve_submission(
            db, action.submission_id, action.approver_id, action.comment
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/submissions/reject", response_model=FormSubmissionResponse)
def reject_submission(action: ApprovalAction, db: Session = Depends(get_db)):
    try:
        return FormSubmissionService.reject_submission(
            db, action.submission_id, action.approver_id, action.comment
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/submissions/withdraw", response_model=FormSubmissionResponse)
def withdraw_submission(request: WithdrawRequest, db: Session = Depends(get_db)):
    try:
        return FormSubmissionService.withdraw_submission(
            db, request.submission_id, request.user_id, request.reason
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/submissions/resubmit", response_model=FormSubmissionResponse)
def resubmit_submission(request: ResubmitRequest, db: Session = Depends(get_db)):
    try:
        return FormSubmissionService.resubmit_submission(
            db, request.submission_id, request.form_data
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/approvals/pending/{approver_id}", response_model=List[FormSubmissionResponse])
def get_pending_approvals(approver_id: int, db: Session = Depends(get_db)):
    return FormSubmissionService.get_pending_approvals(db, approver_id)


@app.post("/api/validate/{workflow_id}", response_model=ValidationResponse)
def validate_submission(workflow_id: int, form_data: Dict[str, Any], db: Session = Depends(get_db)):
    return ValidationService.validate_form_data(db, workflow_id, form_data)


@app.post("/api/batch-import")
def batch_import(request: BatchImportRequest, db: Session = Depends(get_db)):
    results = []
    errors = []
    
    for i, form_data in enumerate(request.submissions):
        try:
            validation_result = ValidationService.validate_form_data(
                db, request.workflow_id, form_data
            )
            
            if not validation_result.valid:
                errors.append({
                    "index": i,
                    "form_data": form_data,
                    "errors": [e.dict() for e in validation_result.errors]
                })
                continue
            
            submission = FormSubmissionService.create_submission(db, FormSubmissionCreate(
                form_template_id=1,
                workflow_id=request.workflow_id,
                submitter_id=request.submitter_id,
                form_data=form_data
            ))
            submitted = FormSubmissionService.submit_form(db, submission.id)
            results.append({
                "index": i,
                "submission_id": submitted.id,
                "submission_no": submitted.submission_no,
                "success": True
            })
        except Exception as e:
            errors.append({
                "index": i,
                "form_data": form_data,
                "error": str(e)
            })
    
    return {"success_count": len(results), "error_count": len(errors), "results": results, "errors": errors}


@app.get("/api/export")
def export_submissions(db: Session = Depends(get_db)):
    try:
        output = ExportService.export_submissions(db)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=submissions_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/check-timeouts")
def check_timeouts(db: Session = Depends(get_db)):
    timeout_submissions = FormSubmissionService.check_timeouts(db, timeout_hours=24)
    return {"timeout_count": len(timeout_submissions), "submissions": timeout_submissions}
