from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, List
from database import Base, engine, get_db, ExceptionStatus, ExceptionType
from schemas import (
    ExceptionRequestCreate, ExceptionRequestResponse, ExceptionRequestListResponse,
    ApprovalActionRequest, AuditLogResponse, ExceptionHistoryResponse,
    ImportBatchResponse, ErrorResponse, ErrorDetail, ErrorCode
)
from services import ExceptionService, ImportService
from export_service import ExportService

Base.metadata.create_all(bind=engine)

app = FastAPI(title="商旅审批服务差旅政策例外 API", version="1.0.0")


def create_http_exception(status_code: int, errors: List[ErrorDetail], request_id: Optional[str] = None):
    error_response = ErrorResponse(
        error="请求处理失败",
        details=errors,
        request_id=request_id
    )
    raise HTTPException(
        status_code=status_code,
        detail=error_response.dict()
    )


@app.get("/api/v1/exceptions", response_model=ExceptionRequestListResponse, tags=["例外申请"])
def list_exceptions(
    status: Optional[ExceptionStatus] = Query(None, description="按状态过滤"),
    employee_id: Optional[str] = Query(None, description="按员工ID过滤"),
    trip_id: Optional[str] = Query(None, description="按出差单ID过滤"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: Session = Depends(get_db)
):
    """查询例外申请列表"""
    service = ExceptionService(db)
    items, total = service.list_exceptions(status, employee_id, trip_id, page, page_size)
    return ExceptionRequestListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size
    )


@app.get("/api/v1/exceptions/{request_id}", response_model=ExceptionRequestResponse, tags=["例外申请"])
def get_exception(request_id: str, db: Session = Depends(get_db)):
    """查询例外申请详情"""
    service = ExceptionService(db)
    exception = service.get_exception(request_id)
    if not exception:
        errors = [ErrorDetail(
            code=ErrorCode.EMPLOYEE_NOT_FOUND,
            message=f"例外申请 {request_id} 不存在",
            suggestion="请检查申请ID是否正确"
        )]
        create_http_exception(404, errors, request_id)
    return exception


@app.post("/api/v1/exceptions", response_model=ExceptionRequestResponse, status_code=201, tags=["例外申请"])
def create_exception(data: ExceptionRequestCreate, db: Session = Depends(get_db)):
    """创建例外申请
    
    - 使用幂等键防止重复提交
    - 同一出差单不能同时有多个进行中的申请
    - 住宿和机票例外需要分别提供理由（或合并理由）
    """
    service = ExceptionService(db)
    exception, errors = service.create_exception(data)
    
    if errors:
        if exception:
            return exception
        create_http_exception(400, errors)
    
    return exception


@app.post("/api/v1/exceptions/{request_id}/actions", response_model=ExceptionRequestResponse, tags=["例外申请"])
def process_approval_action(
    request_id: str,
    data: ApprovalActionRequest,
    db: Session = Depends(get_db)
):
    """处理审批动作
    
    支持的动作:
    - escalate: 升级到例外审核状态
    - approve: 审批通过
    - reject: 审批拒绝
    """
    service = ExceptionService(db)
    exception, errors = service.process_approval(request_id, data)
    
    if errors:
        create_http_exception(400, errors, request_id)
    
    return exception


@app.get("/api/v1/exceptions/{request_id}/history", response_model=ExceptionHistoryResponse, tags=["例外申请"])
def get_exception_history(request_id: str, db: Session = Depends(get_db)):
    """查询例外申请的审核历史"""
    service = ExceptionService(db)
    exception = service.get_exception(request_id)
    if not exception:
        errors = [ErrorDetail(
            code=ErrorCode.EMPLOYEE_NOT_FOUND,
            message=f"例外申请 {request_id} 不存在",
            suggestion="请检查申请ID是否正确"
        )]
        create_http_exception(404, errors, request_id)
    
    logs = service.get_history(request_id)
    return ExceptionHistoryResponse(
        request_id=request_id,
        logs=logs
    )


@app.post("/api/v1/exceptions/import", response_model=ImportBatchResponse, status_code=201, tags=["导入导出"])
def import_exceptions(rows: List[dict], db: Session = Depends(get_db)):
    """批量导入例外申请
    
    返回每一行的校验结果，包含错误码和修复建议
    """
    service = ImportService(db)
    batch_id, results = service.import_batch(rows)
    
    valid_count = sum(1 for r in results if r.is_valid)
    invalid_count = len(results) - valid_count
    
    return ImportBatchResponse(
        batch_id=batch_id,
        total_rows=len(results),
        valid_rows=valid_count,
        invalid_rows=invalid_count,
        results=results
    )


@app.get("/api/v1/exceptions/export/csv", tags=["导入导出"])
def export_exceptions_csv(
    status: Optional[ExceptionStatus] = Query(None, description="按状态过滤"),
    db: Session = Depends(get_db)
):
    """导出差旅政策例外为 CSV"""
    service = ExportService(db)
    csv_content = service.export_to_csv(status)
    
    filename = f"policy_exceptions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/api/v1/exceptions/export/json", tags=["导入导出"])
def export_exceptions_json(
    status: Optional[ExceptionStatus] = Query(None, description="按状态过滤"),
    db: Session = Depends(get_db)
):
    """导出差旅政策例外为 JSON"""
    service = ExportService(db)
    rows = service.export_exceptions(status)
    return {"data": rows}


@app.get("/health", tags=["系统"])
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}