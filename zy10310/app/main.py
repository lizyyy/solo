from fastapi import FastAPI, Depends, HTTPException, Request, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db, engine
from app.models import Base
from app.schemas import (
    ImportPackageCreate, ImportPackage, ImportPackageUpdate, ImportPackageListItem,
    StatusAdvanceRequest, RevokeCertificateRequest, ExportRequest, ApiResponse,
    AuditLog, PassCertificate, PrecheckResult
)
from app.services import PrecheckService, PrecheckRules
from app.config import get_settings

settings = get_settings()

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="租户导入预检 API",
    description="租户导入数据预检服务，支持字段映射验证、依赖资源检查、错误分类、修复建议和凭证管理",
    version=settings.API_VERSION
)


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "message": str(exc),
            "error_code": "VALIDATION_ERROR"
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "服务器内部错误",
            "error_code": "INTERNAL_ERROR"
        }
    )


@app.get("/")
async def root():
    return {
        "service": "租户导入预检 API",
        "version": settings.API_VERSION,
        "rules_version": PrecheckRules.VERSION,
        "status": "running"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/api/v1/packages", response_model=ApiResponse)
async def create_package(
    package_data: ImportPackageCreate,
    created_by: str = Query(..., description="创建人"),
    db: Session = Depends(get_db)
):
    service = PrecheckService(db)
    package = service.create_import_package(package_data, created_by)
    return ApiResponse(
        success=True,
        message="导入包创建成功",
        data={"package_id": package.id, "status": package.status}
    )


@app.get("/api/v1/packages", response_model=ApiResponse)
async def list_packages(
    tenant_id: Optional[str] = None,
    status: Optional[str] = None,
    created_by: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    service = PrecheckService(db)
    packages = service.list_packages(tenant_id, status, created_by, skip, limit)

    package_list = []
    for package in packages:
        error_count = len([e for e in package.precheck_errors if e.severity == "error"])
        package_list.append(ImportPackageListItem(
            id=package.id,
            tenant_id=package.tenant_id,
            package_name=package.package_name,
            package_version=package.package_version,
            status=package.status,
            created_by=package.created_by,
            created_at=package.created_at,
            updated_at=package.updated_at,
            completed_at=package.completed_at,
            rules_version=package.rules_version,
            error_count=error_count
        ))

    return ApiResponse(
        success=True,
        message="查询成功",
        data={"total": len(package_list), "items": package_list}
    )


@app.get("/api/v1/packages/{package_id}", response_model=ApiResponse)
async def get_package(package_id: str, db: Session = Depends(get_db)):
    service = PrecheckService(db)
    package = service.get_package(package_id)

    if not package:
        raise HTTPException(status_code=404, detail="导入包不存在")

    package_data = {
        "id": package.id,
        "tenant_id": package.tenant_id,
        "package_name": package.package_name,
        "package_version": package.package_version,
        "metadata": package.metadata_ or {},
        "status": package.status,
        "created_by": package.created_by,
        "created_at": package.created_at,
        "updated_at": package.updated_at,
        "completed_at": package.completed_at,
        "rules_version": package.rules_version,
        "source_hash": package.source_hash,
        "field_mappings": package.field_mappings,
        "dependency_resources": package.dependency_resources,
        "precheck_errors": package.precheck_errors,
        "pass_certificates": package.pass_certificates
    }

    return ApiResponse(
        success=True,
        message="查询成功",
        data=ImportPackage.model_validate(package_data)
    )


@app.post("/api/v1/packages/{package_id}/precheck", response_model=ApiResponse)
async def run_precheck(
    package_id: str,
    operator: str = Query(..., description="操作人"),
    db: Session = Depends(get_db)
):
    service = PrecheckService(db)
    package = service.run_precheck(package_id, operator)

    errors = [e for e in package.precheck_errors]
    warnings = [e for e in package.precheck_errors if e.severity == "warning"]

    result = PrecheckResult(
        package_id=package.id,
        status=package.status,
        total_checks=len(package.field_mappings) + len(package.dependency_resources),
        passed_checks=len([fm for fm in package.field_mappings if fm.is_valid]) +
                      len([dr for dr in package.dependency_resources if dr.status == "VALID"]),
        failed_checks=len([e for e in errors if e.severity == "error"]),
        warning_count=len(warnings),
        errors=errors
    )

    return ApiResponse(
        success=True,
        message=f"预检完成，状态: {package.status}",
        data=result
    )


@app.post("/api/v1/packages/{package_id}/status", response_model=ApiResponse)
async def advance_status(
    package_id: str,
    request: StatusAdvanceRequest,
    db: Session = Depends(get_db)
):
    service = PrecheckService(db)
    package = service.advance_status(package_id, request)

    return ApiResponse(
        success=True,
        message=f"状态已更新为: {package.status}",
        data={"package_id": package.id, "status": package.status}
    )


@app.post("/api/v1/packages/{package_id}/cancel", response_model=ApiResponse)
async def cancel_package(
    package_id: str,
    operator: str = Query(..., description="操作人"),
    reason: str = Query(..., description="取消原因"),
    db: Session = Depends(get_db)
):
    service = PrecheckService(db)
    package = service.cancel_package(package_id, operator, reason)

    return ApiResponse(
        success=True,
        message="导入包已取消",
        data={"package_id": package.id, "status": package.status}
    )


@app.get("/api/v1/packages/{package_id}/audit-logs", response_model=ApiResponse)
async def get_audit_logs(
    package_id: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    service = PrecheckService(db)
    logs = service.get_audit_logs(package_id, skip, limit)

    return ApiResponse(
        success=True,
        message="查询成功",
        data={"total": len(logs), "items": [AuditLog.model_validate(log) for log in logs]}
    )


@app.post("/api/v1/packages/{package_id}/export", response_model=ApiResponse)
async def export_package(
    package_id: str,
    request: ExportRequest,
    db: Session = Depends(get_db)
):
    service = PrecheckService(db)
    export_data = service.export_package(package_id, request.include_audit_logs)

    return ApiResponse(
        success=True,
        message="导出成功",
        data=export_data
    )


@app.get("/api/v1/packages/{package_id}/certificates", response_model=ApiResponse)
async def get_certificates(package_id: str, db: Session = Depends(get_db)):
    service = PrecheckService(db)
    package = service.get_package(package_id)

    if not package:
        raise HTTPException(status_code=404, detail="导入包不存在")

    return ApiResponse(
        success=True,
        message="查询成功",
        data={"total": len(package.pass_certificates),
              "items": [PassCertificate.model_validate(cert) for cert in package.pass_certificates]}
    )


@app.post("/api/v1/packages/{package_id}/certificates/{cert_id}/revoke", response_model=ApiResponse)
async def revoke_certificate(
    package_id: str,
    cert_id: str,
    request: RevokeCertificateRequest,
    db: Session = Depends(get_db)
):
    service = PrecheckService(db)
    cert = service.revoke_certificate(package_id, cert_id, request)

    return ApiResponse(
        success=True,
        message="凭证已撤销",
        data=PassCertificate.model_validate(cert)
    )


@app.get("/api/v1/rules/version")
async def get_rules_version():
    return {
        "rules_version": PrecheckRules.VERSION,
        "api_version": settings.API_VERSION
    }
