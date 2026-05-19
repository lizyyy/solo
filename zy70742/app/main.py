from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from typing import List
from .database import init_db, get_db
from .schemas import (
    TenantCreate, TenantResponse,
    RegionRuleCreate, RegionRuleResponse,
    ApprovalSubmitRequest, ApprovalReviewRequest,
    ApprovalResponse, RegionValidationResult,
    ReportGenerateRequest, ReportResponse,
    ApprovalFilterRequest, PaginatedApprovalResponse,
    ErrorCode
)
from .services import ApprovalService, ReportService, TenantService, RegionRuleService
from .models import ApprovalStatus

app = FastAPI(title="数据驻留审批区域规则API", version="1.0.0")

@app.on_event("startup")
def startup_event():
    init_db()

@app.post("/api/tenants", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
def create_tenant(tenant_data: TenantCreate, db: Session = Depends(get_db)):
    service = TenantService(db)
    existing = service.get_tenant(tenant_data.tenant_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "TENANT_ALREADY_EXISTS",
                "message": f"Tenant {tenant_data.tenant_id} already exists"
            }
        )
    return service.create_tenant(tenant_data)

@app.get("/api/tenants/{tenant_id}", response_model=TenantResponse)
def get_tenant(tenant_id: str, db: Session = Depends(get_db)):
    service = TenantService(db)
    tenant = service.get_tenant(tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": ErrorCode.TENANT_NOT_FOUND,
                "message": f"Tenant {tenant_id} not found"
            }
        )
    return tenant

@app.post("/api/region-rules", response_model=RegionRuleResponse, status_code=status.HTTP_201_CREATED)
def create_region_rule(rule_data: RegionRuleCreate, db: Session = Depends(get_db)):
    service = RegionRuleService(db)
    return service.create_rule(rule_data)

@app.get("/api/region-rules/{region_code}", response_model=List[RegionRuleResponse])
def get_region_rules(region_code: str, db: Session = Depends(get_db)):
    service = RegionRuleService(db)
    return service.get_rules_by_region(region_code)

@app.get("/api/validate-region/{region_code}/{data_type}", response_model=RegionValidationResult)
def validate_region(region_code: str, data_type: str, db: Session = Depends(get_db)):
    service = ApprovalService(db)
    return service.validate_region_rule(region_code, data_type)

@app.post("/api/approvals", response_model=ApprovalResponse, status_code=status.HTTP_201_CREATED)
def submit_approval(request: ApprovalSubmitRequest, db: Session = Depends(get_db)):
    if not request.request_id or not request.tenant_id or not request.target_region or not request.data_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": ErrorCode.MISSING_FIELD,
                "message": "Missing required fields: request_id, tenant_id, target_region, data_type"
            }
        )
    
    service = ApprovalService(db)
    approval, error_code, processed_code = service.submit_approval(request)
    
    if processed_code == "ALREADY_PROCESSED" and approval:
        return approval
    
    if error_code == ErrorCode.TENANT_NOT_FOUND:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": ErrorCode.TENANT_NOT_FOUND,
                "message": f"Tenant {request.tenant_id} not found"
            }
        )
    
    if error_code == ErrorCode.REGION_RULE_NOT_FOUND:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": ErrorCode.REGION_RULE_NOT_FOUND,
                "message": f"No active region rule found for {request.target_region} and {request.data_type}"
            }
        )
    
    return approval

@app.put("/api/approvals/{request_id}/review", response_model=ApprovalResponse)
def review_approval(request_id: str, review: ApprovalReviewRequest, db: Session = Depends(get_db)):
    service = ApprovalService(db)
    approval, error_code, processed_code = service.review_approval(request_id, review)
    
    if processed_code == "already_processed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": ErrorCode.ALREADY_PROCESSED,
                "message": "This approval has already been finalized"
            }
        )
    
    if error_code == "approval_not_found":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "APPROVAL_NOT_FOUND",
                "message": f"Approval request {request_id} not found"
            }
        )
    
    if error_code == "missing_field":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": ErrorCode.MISSING_FIELD,
                "message": "block_reason is required when status is blocked"
            }
        )
    
    if error_code == "invalid_status":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": ErrorCode.INVALID_STATUS,
                "message": "Can only approve pending requests. Needs review requests must be manually reviewed first."
            }
        )
    
    return approval

@app.get("/api/approvals/{request_id}", response_model=ApprovalResponse)
def get_approval(request_id: str, db: Session = Depends(get_db)):
    service = ApprovalService(db)
    approval = service.get_approval_by_request_id(request_id)
    if not approval:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "APPROVAL_NOT_FOUND",
                "message": f"Approval request {request_id} not found"
            }
        )
    return approval

@app.post("/api/approvals/filter", response_model=PaginatedApprovalResponse)
def filter_approvals(
    filter_request: ApprovalFilterRequest,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db)
):
    service = ApprovalService(db)
    items, total = service.filter_approvals(filter_request, page, page_size)
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size
    }

@app.get("/api/block-categories")
def get_block_categories(db: Session = Depends(get_db)):
    service = ApprovalService(db)
    return {"categories": service.get_block_reason_categories()}

@app.post("/api/reports", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def generate_report(report_request: ReportGenerateRequest, db: Session = Depends(get_db)):
    service = ReportService(db)
    report, error_code = service.generate_report(
        report_request.approval_id,
        report_request.generated_by
    )
    
    if error_code == "APPROVAL_NOT_FOUND":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "APPROVAL_NOT_FOUND",
                "message": f"Approval {report_request.approval_id} not found"
            }
        )
    
    return report

@app.get("/api/reports/{report_id}", response_model=ReportResponse)
def get_report(report_id: str, db: Session = Depends(get_db)):
    service = ReportService(db)
    report = service.get_report_by_id(report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "REPORT_NOT_FOUND",
                "message": f"Report {report_id} not found"
            }
        )
    return report

@app.get("/api/reports/{report_id}/export", response_class=PlainTextResponse)
def export_report(report_id: str, db: Session = Depends(get_db)):
    service = ReportService(db)
    report = service.get_report_by_id(report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "REPORT_NOT_FOUND",
                "message": f"Report {report_id} not found"
            }
        )
    
    return PlainTextResponse(
        content=report.report_content,
        media_type="text/plain",
        headers={
            "Content-Disposition": f"attachment; filename={report_id}.txt"
        }
    )

@app.get("/api/statuses")
def get_approval_statuses():
    return {
        "statuses": [s.value for s in ApprovalStatus]
    }
