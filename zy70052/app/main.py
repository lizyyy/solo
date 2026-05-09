from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from decimal import Decimal
import io

from app.config import settings
from app.database import engine, Base, get_db, get_db_session
from app.utils import ApplicationStatus
from app.services.extension_service import ExtensionService, ExtensionApplicationException
from app.services.reconciliation_service import ReconciliationService
from app.services.task_service import TaskService

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="贷款展期审批服务 - 支持展期申请、还款计划重算、罚息快照、额度释放、审批历史和对账导出",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {
        "service": settings.PROJECT_NAME,
        "version": "1.0.0",
        "docs_url": "/docs",
        "api_prefix": settings.API_V1_STR
    }


@app.post(f"{settings.API_V1_STR}/extension/applications", tags=["展期申请"])
def submit_extension_application(
    account_no: str,
    extension_months: int,
    applicant_id: str,
    applicant_name: str,
    extension_reason: Optional[str] = None,
    extension_interest_rate: Optional[float] = None,
    db: Session = Depends(get_db)
):
    try:
        service = ExtensionService(db)
        result = service.submit_application(
            account_no=account_no,
            extension_months=extension_months,
            applicant_id=applicant_id,
            applicant_name=applicant_name,
            extension_reason=extension_reason,
            extension_interest_rate=Decimal(str(extension_interest_rate)) if extension_interest_rate else None
        )
        return result
    except ExtensionApplicationException as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{settings.API_V1_STR}/extension/applications/{{application_no}}/first-approve", tags=["审批流程"])
def first_approve_application(
    application_no: str,
    approver_id: str,
    approver_name: str,
    comment: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        service = ExtensionService(db)
        result = service.first_approve(
            application_no=application_no,
            approver_id=approver_id,
            approver_name=approver_name,
            comment=comment
        )
        return result
    except ExtensionApplicationException as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{settings.API_V1_STR}/extension/applications/{{application_no}}/final-approve", tags=["审批流程"])
def final_approve_application(
    application_no: str,
    approver_id: str,
    approver_name: str,
    comment: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        service = ExtensionService(db)
        result = service.final_approve(
            application_no=application_no,
            approver_id=approver_id,
            approver_name=approver_name,
            comment=comment
        )
        return result
    except ExtensionApplicationException as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{settings.API_V1_STR}/extension/applications/{{application_no}}/execute", tags=["审批流程"])
def execute_extension(
    application_no: str,
    execute_by_id: Optional[str] = None,
    execute_by_name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        service = ExtensionService(db)
        result = service.execute_extension(
            application_no=application_no,
            execute_by_id=execute_by_id,
            execute_by_name=execute_by_name
        )
        return result
    except ExtensionApplicationException as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{settings.API_V1_STR}/extension/applications/{{application_no}}/reject", tags=["审批流程"])
def reject_application(
    application_no: str,
    rejector_id: str,
    rejector_name: str,
    reject_reason: str,
    db: Session = Depends(get_db)
):
    try:
        service = ExtensionService(db)
        result = service.reject_application(
            application_no=application_no,
            rejector_id=rejector_id,
            rejector_name=rejector_name,
            reject_reason=reject_reason
        )
        return result
    except ExtensionApplicationException as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{settings.API_V1_STR}/extension/applications/{{application_no}}/cancel", tags=["审批流程"])
def cancel_application(
    application_no: str,
    canceller_id: str,
    canceller_name: str,
    cancel_reason: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        service = ExtensionService(db)
        result = service.cancel_application(
            application_no=application_no,
            canceller_id=canceller_id,
            canceller_name=canceller_name,
            cancel_reason=cancel_reason
        )
        return result
    except ExtensionApplicationException as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{settings.API_V1_STR}/extension/applications/{{application_no}}", tags=["展期申请"])
def get_application_detail(
    application_no: str,
    db: Session = Depends(get_db)
):
    try:
        service = ExtensionService(db)
        result = service.get_application_detail(application_no=application_no)
        return result
    except ExtensionApplicationException as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{settings.API_V1_STR}/tasks/execute-extension", tags=["后台任务"])
def create_execute_extension_task(
    application_no: str,
    delay_seconds: int = 0,
    db: Session = Depends(get_db)
):
    try:
        service = TaskService(db)
        task = service.create_execute_extension_task(
            application_no=application_no,
            delay_seconds=delay_seconds
        )
        return {
            "success": True,
            "task_id": task.id,
            "task_name": task.task_name,
            "status": task.status,
            "next_execution_time": task.next_execution_time.isoformat() if task.next_execution_time else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{settings.API_V1_STR}/tasks/{{task_id}}", tags=["后台任务"])
def get_task_status(
    task_id: int,
    db: Session = Depends(get_db)
):
    try:
        service = TaskService(db)
        status = service.get_task_status(task_id=task_id)
        if not status:
            raise HTTPException(status_code=404, detail="任务不存在")
        return status
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{settings.API_V1_STR}/tasks/{{task_id}}/retry", tags=["后台任务"])
def retry_failed_task(
    task_id: int,
    db: Session = Depends(get_db)
):
    try:
        service = TaskService(db)
        task = service.retry_failed_task(task_id=task_id)
        if not task:
            raise HTTPException(status_code=404, detail="任务不存在或不允许重试")
        return {
            "success": True,
            "task_id": task.id,
            "status": task.status,
            "message": "任务已重置，准备重试"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{settings.API_V1_STR}/reconciliation/extensions", tags=["对账导出"])
def get_extension_reconciliation(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        service = ReconciliationService(db)
        status_enum = ApplicationStatus(status) if status else None
        data = service.get_extension_reconciliation_data(
            start_date=start_date,
            end_date=end_date,
            status=status_enum
        )
        return {"data": data, "count": len(data)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"无效的状态值: {status}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{settings.API_V1_STR}/reconciliation/extensions/export", tags=["对账导出"])
def export_extension_reconciliation(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        service = ReconciliationService(db)
        status_enum = ApplicationStatus(status) if status else None
        excel_data = service.export_extension_reconciliation(
            start_date=start_date,
            end_date=end_date,
            status=status_enum
        )
        
        return StreamingResponse(
            io.BytesIO(excel_data),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename=extension_reconciliation_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"无效的状态值: {status}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{settings.API_V1_STR}/reconciliation/loan-accounts", tags=["对账导出"])
def get_loan_account_reconciliation(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    try:
        service = ReconciliationService(db)
        data = service.get_loan_account_reconciliation_data(
            start_date=start_date,
            end_date=end_date
        )
        return {"data": data, "count": len(data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{settings.API_V1_STR}/reconciliation/loan-accounts/export", tags=["对账导出"])
def export_loan_account_reconciliation(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    try:
        service = ReconciliationService(db)
        excel_data = service.export_loan_account_reconciliation(
            start_date=start_date,
            end_date=end_date
        )
        
        return StreamingResponse(
            io.BytesIO(excel_data),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename=loan_accounts_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{settings.API_V1_STR}/reconciliation/credit-limits", tags=["对账导出"])
def get_credit_limit_reconciliation(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    try:
        service = ReconciliationService(db)
        data = service.get_limit_reconciliation_data(
            start_date=start_date,
            end_date=end_date
        )
        return {"data": data, "count": len(data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{settings.API_V1_STR}/reconciliation/audit-logs", tags=["对账导出"])
def get_audit_log_reconciliation(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    business_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        from app.utils import BusinessType
        service = ReconciliationService(db)
        bt_enum = BusinessType(business_type) if business_type else None
        data = service.get_audit_reconciliation_data(
            start_date=start_date,
            end_date=end_date,
            business_type=bt_enum
        )
        return {"data": data, "count": len(data)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"无效的业务类型: {business_type}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{settings.API_V1_STR}/consistency/{{application_no}}", tags=["数据一致性"])
def check_data_consistency(
    application_no: str,
    db: Session = Depends(get_db)
):
    try:
        service = ReconciliationService(db)
        result = service.check_data_consistency(application_no=application_no)
        return result
    except ExtensionApplicationException as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{settings.API_V1_STR}/health", tags=["系统管理"])
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": settings.PROJECT_NAME
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
