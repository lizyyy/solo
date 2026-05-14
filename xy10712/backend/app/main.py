from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import io
import pandas as pd

from .database import get_db, engine, Base
from .models import (
    EmailTemplate, TemplateVersion, EmailBatch, EmailRecord,
    VariableValidation, ApprovalRecord, BatchLog,
    TemplateStatus, BatchStatus, EmailStatus, ApprovalType, ApprovalStatus
)
from .schemas import (
    EmailTemplateCreate, EmailTemplateUpdate, EmailTemplateResponse,
    TemplateVersionResponse, EmailBatchCreate, EmailBatchResponse,
    EmailRecordResponse, VariableValidationResponse,
    ApprovalCreate, ApprovalAction, ApprovalRecordResponse,
    BatchLogResponse, TemplateDiffResponse, StatisticsResponse,
    CompensationRequest, TemplateDiff
)
from .services import TemplateService, ValidationService, BatchService, StatisticsService

Base.metadata.create_all(bind=engine)

app = FastAPI(title="邮件模板灰度发布系统", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CURRENT_USER = "admin"

@app.get("/")
def root():
    return {"message": "邮件模板灰度发布系统 API", "version": "1.0.0"}

@app.get("/api/statistics", response_model=StatisticsResponse)
def get_statistics(db: Session = Depends(get_db)):
    return StatisticsService.get_statistics(db)

@app.post("/api/templates", response_model=EmailTemplateResponse)
def create_template(template_data: EmailTemplateCreate, db: Session = Depends(get_db)):
    return TemplateService.create_template(db, template_data, CURRENT_USER)

@app.get("/api/templates", response_model=List[EmailTemplateResponse])
def list_templates(
    status: Optional[TemplateStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(EmailTemplate)
    if status:
        query = query.filter(EmailTemplate.status == status)
    return query.offset(skip).limit(limit).all()

@app.get("/api/templates/{template_id}", response_model=EmailTemplateResponse)
def get_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    return template

@app.put("/api/templates/{template_id}", response_model=EmailTemplateResponse)
def update_template(
    template_id: int,
    update_data: EmailTemplateUpdate,
    db: Session = Depends(get_db)
):
    template = TemplateService.update_template(db, template_id, update_data, CURRENT_USER)
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    return template

@app.get("/api/templates/{template_id}/versions", response_model=List[TemplateVersionResponse])
def get_template_versions(template_id: int, db: Session = Depends(get_db)):
    versions = db.query(TemplateVersion).filter(
        TemplateVersion.template_id == template_id
    ).order_by(TemplateVersion.version.desc()).all()
    return versions

@app.get("/api/templates/{template_id}/diff", response_model=TemplateDiffResponse)
def get_template_diff(
    template_id: int,
    version_old: int = Query(...),
    version_new: int = Query(...),
    db: Session = Depends(get_db)
):
    differences = TemplateService.get_template_diff(db, template_id, version_old, version_new)
    return TemplateDiffResponse(
        version_old=version_old,
        version_new=version_new,
        differences=differences
    )

@app.post("/api/batches", response_model=EmailBatchResponse)
def create_batch(batch_data: EmailBatchCreate, db: Session = Depends(get_db)):
    try:
        batch = BatchService.create_batch(db, batch_data, CURRENT_USER)
        return batch
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/batches", response_model=List[EmailBatchResponse])
def list_batches(
    status: Optional[BatchStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(EmailBatch)
    if status:
        query = query.filter(EmailBatch.status == status)
    batches = query.offset(skip).limit(limit).all()
    
    result = []
    for batch in batches:
        batch_data = EmailBatchResponse.model_validate(batch)
        batch_data.template_name = batch.template.name if batch.template else None
        result.append(batch_data)
    return result

@app.get("/api/batches/{batch_id}", response_model=EmailBatchResponse)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(EmailBatch).filter(EmailBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    batch_data = EmailBatchResponse.model_validate(batch)
    batch_data.template_name = batch.template.name if batch.template else None
    return batch_data

@app.get("/api/batches/{batch_id}/emails", response_model=List[EmailRecordResponse])
def get_batch_emails(
    batch_id: int,
    status: Optional[EmailStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(EmailRecord).filter(EmailRecord.batch_id == batch_id)
    if status:
        query = query.filter(EmailRecord.status == status)
    return query.offset(skip).limit(limit).all()

@app.get("/api/batches/{batch_id}/validations", response_model=List[VariableValidationResponse])
def get_batch_validations(batch_id: int, only_invalid: bool = False, db: Session = Depends(get_db)):
    query = db.query(VariableValidation).join(EmailRecord).filter(EmailRecord.batch_id == batch_id)
    if only_invalid:
        query = query.filter(VariableValidation.is_valid == False)
    return query.all()

@app.post("/api/batches/{batch_id}/recalculate-validations")
def recalculate_validations(batch_id: int, db: Session = Depends(get_db)):
    ValidationService.recalculate_validations(db, batch_id)
    return {"message": "校验已重新计算"}

@app.post("/api/batches/{batch_id}/advance-stage")
def advance_stage(batch_id: int, db: Session = Depends(get_db)):
    try:
        batch = BatchService.advance_grayscale_stage(db, batch_id, CURRENT_USER)
        return {"message": f"已进入灰度阶段 {batch.grayscale_stage}/{batch.total_stages}"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/batches/{batch_id}/intercept")
def intercept_batch(batch_id: int, reason: str = "人工拦截", db: Session = Depends(get_db)):
    try:
        BatchService.intercept_batch(db, batch_id, CURRENT_USER, reason)
        return {"message": "批次已拦截"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/batches/{batch_id}/compensate")
def start_compensation(batch_id: int, request: CompensationRequest, db: Session = Depends(get_db)):
    try:
        records = BatchService.start_compensation(
            db, batch_id, CURRENT_USER, request.compensation_type, request.email_ids, request.details
        )
        return {"message": f"已启动 {len(records)} 条补偿记录"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/batches/{batch_id}/manual-review")
def mark_manual_review(batch_id: int, db: Session = Depends(get_db)):
    try:
        BatchService.mark_manual_review(db, batch_id, CURRENT_USER)
        return {"message": "已转入人工复核"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/batches/{batch_id}/logs", response_model=List[BatchLogResponse])
def get_batch_logs(batch_id: int, db: Session = Depends(get_db)):
    return db.query(BatchLog).filter(BatchLog.batch_id == batch_id).order_by(BatchLog.created_at.desc()).all()

@app.get("/api/batches/{batch_id}/export")
def export_batch(batch_id: int, format: str = "xlsx", db: Session = Depends(get_db)):
    batch = db.query(EmailBatch).filter(EmailBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    emails = db.query(EmailRecord).filter(EmailRecord.batch_id == batch_id).all()
    
    status_map = {
        EmailStatus.PENDING: "待发送",
        EmailStatus.SENDING: "发送中",
        EmailStatus.SUCCESS: "发送成功",
        EmailStatus.FAILED: "发送失败",
        EmailStatus.INTERCEPTED: "已拦截",
        EmailStatus.RETRY: "重试中"
    }
    
    data = []
    for email in emails:
        row = {
            "收件人邮箱": email.recipient_email,
            "收件人姓名": email.recipient_name or "",
            "是否测试邮件": "是" if email.is_test else "否",
            "灰度阶段": email.grayscale_stage,
            "发送状态": status_map.get(email.status, str(email.status)),
            "发送时间": email.sent_at.strftime("%Y-%m-%d %H:%M:%S") if email.sent_at else "",
            "错误信息": email.error_message or "",
            "创建时间": email.created_at.strftime("%Y-%m-%d %H:%M:%S")
        }
        
        if email.variables:
            for key, value in email.variables.items():
                row[f"变量 - {key}"] = str(value)
        
        data.append(row)
    
    df = pd.DataFrame(data)
    
    if format == "xlsx":
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="邮件详情")
            
            summary_sheet = pd.DataFrame([
                {"指标": "批次名称", "值": batch.name},
                {"指标": "模板名称", "值": batch.template.name if batch.template else ""},
                {"指标": "灰度阶段", "值": f"{batch.grayscale_stage}/{batch.total_stages}"},
                {"指标": "邮件总数", "值": batch.total_emails},
                {"指标": "已发送", "值": batch.sent_emails},
                {"指标": "成功数", "值": batch.success_count},
                {"指标": "失败数", "值": batch.failed_count},
                {"指标": "拦截数", "值": batch.intercepted_count},
            ])
            summary_sheet.to_excel(writer, index=False, sheet_name="概览")
        
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=batch_{batch_id}_{datetime.now().strftime('%Y%m%d')}.xlsx"}
        )
    else:
        output = io.StringIO()
        df.to_csv(output, index=False)
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=batch_{batch_id}_{datetime.now().strftime('%Y%m%d')}.csv"}
        )

@app.post("/api/approvals", response_model=ApprovalRecordResponse)
def create_approval(approval_data: ApprovalCreate, db: Session = Depends(get_db)):
    if not approval_data.template_id and not approval_data.batch_id:
        raise HTTPException(status_code=400, detail="必须指定模板或批次")
    
    approval = ApprovalRecord(
        type=approval_data.type,
        template_id=approval_data.template_id,
        batch_id=approval_data.batch_id,
        requester=CURRENT_USER,
        request_comment=approval_data.request_comment
    )
    db.add(approval)
    db.commit()
    db.refresh(approval)
    
    if approval_data.type == ApprovalType.TEMPLATE and approval_data.template_id:
        template = db.query(EmailTemplate).filter(EmailTemplate.id == approval_data.template_id).first()
        if template:
            template.status = TemplateStatus.PENDING_REVIEW
            db.commit()
    
    return approval

@app.get("/api/approvals", response_model=List[ApprovalRecordResponse])
def list_approvals(
    status: Optional[ApprovalStatus] = None,
    type: Optional[ApprovalType] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(ApprovalRecord)
    if status:
        query = query.filter(ApprovalRecord.status == status)
    if type:
        query = query.filter(ApprovalRecord.type == type)
    
    approvals = query.offset(skip).limit(limit).all()
    result = []
    for approval in approvals:
        approval_data = ApprovalRecordResponse.model_validate(approval)
        if approval.template:
            approval_data.template_name = approval.template.name
        if approval.batch:
            approval_data.batch_name = approval.batch.name
        result.append(approval_data)
    return result

@app.post("/api/approvals/{approval_id}/action")
def approval_action(
    approval_id: int,
    action_data: ApprovalAction,
    db: Session = Depends(get_db)
):
    approval = db.query(ApprovalRecord).filter(ApprovalRecord.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="审批不存在")
    
    if approval.status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail="该审批已处理")
    
    approval.status = action_data.status
    approval.approver = CURRENT_USER
    approval.approval_comment = action_data.approval_comment
    approval.approved_at = datetime.utcnow()
    
    if approval.type == ApprovalType.TEMPLATE and approval.template_id:
        template = db.query(EmailTemplate).filter(EmailTemplate.id == approval.template_id).first()
        if template:
            if action_data.status == ApprovalStatus.APPROVED:
                template.status = TemplateStatus.APPROVED
            else:
                template.status = TemplateStatus.REJECTED
    
    db.commit()
    return {"message": "审批已处理"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
