from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, JSONResponse, PlainTextResponse
from sqlalchemy.orm import Session
from io import BytesIO, StringIO
import csv
from config import SessionLocal, get_db
from models.schemas import RiskQueryResponse
from storage.repository import RepositoryFactory
from exporters.markdown_exporter import MarkdownExporter
from exporters.csv_exporter import CSVExporter
from exporters.json_exporter import JSONExporter

router = APIRouter(
    prefix="/api/export",
    tags=["export"],
    responses={404: {"description": "Not found"}}
)


@router.get("/operations/{operation_id}/markdown")
async def export_operation_markdown(
    operation_id: int,
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    operation = repo.operation.get_by_id(operation_id)
    
    if not operation:
        raise HTTPException(status_code=404, detail="操作不存在")
    
    current_version = None
    target_version = None
    current_values = []
    target_values = []
    
    if operation.current_version_id:
        current_version = repo.setting.get_by_id(operation.current_version_id)
        if current_version:
            current_values = repo.setting.get_values(operation.current_version_id)
    
    if operation.target_version_id:
        target_version = repo.setting.get_by_id(operation.target_version_id)
        if target_version:
            target_values = repo.setting.get_values(operation.target_version_id)
    
    plate_status = None
    plates = []
    if operation.plate_status_id:
        plate_status = repo.plate.get_by_id(operation.plate_status_id)
        if plate_status:
            plates = repo.plate.get_plates(operation.plate_status_id)
    
    approval_ticket = None
    signatures = []
    if operation.approval_ticket_id:
        approval_ticket = repo.approval.get_by_id(operation.approval_ticket_id)
        if approval_ticket:
            signatures = repo.approval.get_signatures(operation.approval_ticket_id)
    
    check_results = repo.check.get_by_operation(operation_id)
    simulation_logs = repo.simulation.get_by_operation(operation_id)
    
    exporter = MarkdownExporter()
    markdown_content = exporter.export_operation(
        operation=operation,
        current_version=current_version,
        target_version=target_version,
        current_values=current_values,
        target_values=target_values,
        plate_status=plate_status,
        plates=plates,
        approval_ticket=approval_ticket,
        signatures=signatures,
        check_results=check_results,
        simulation_logs=simulation_logs
    )
    
    repo.audit.log_operation(
        operation="EXPORT",
        resource_type="operation",
        resource_id=operation_id,
        details={"format": "markdown"}
    )
    
    return PlainTextResponse(
        content=markdown_content,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f"attachment; filename=operation_{operation_id}_audit.md"
        }
    )


@router.get("/operations/{operation_id}/csv")
async def export_operation_csv(
    operation_id: int,
    include_checks: bool = Query(True, description="包含检查结果"),
    include_logs: bool = Query(True, description="包含模拟日志"),
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    operation = repo.operation.get_by_id(operation_id)
    
    if not operation:
        raise HTTPException(status_code=404, detail="操作不存在")
    
    check_results = repo.check.get_by_operation(operation_id)
    simulation_logs = repo.simulation.get_by_operation(operation_id)
    
    output = StringIO()
    writer = csv.writer(output)
    
    writer.writerow(["定值票联锁核验审计报告"])
    writer.writerow(["导出时间", "操作ID", "操作名称", "间隔ID", "间隔名称", "当前状态"])
    writer.writerow([
        "", operation_id, operation.name, operation.bay_id, 
        operation.bay_name, operation.status.value
    ])
    writer.writerow([])
    
    if include_checks and check_results:
        writer.writerow(["联锁检查结果"])
        writer.writerow(["序号", "检查类型", "是否通过", "风险等级", "检查消息"])
        for idx, result in enumerate(check_results, 1):
            passed = "是" if result.passed else "否"
            writer.writerow([
                idx, result.check_type, passed, result.risk_level, result.message
            ])
        writer.writerow([])
    
    if include_logs and simulation_logs:
        writer.writerow(["模拟执行日志"])
        writer.writerow(["步骤", "操作类型", "目标", "结果", "消息"])
        for log in simulation_logs:
            result = "成功" if log.result == "SUCCESS" else "失败"
            writer.writerow([
                log.step, log.action, log.target or "", result, log.message or ""
            ])
        writer.writerow([])
    
    csv_content = output.getvalue()
    
    repo.audit.log_operation(
        operation="EXPORT",
        resource_type="operation",
        resource_id=operation_id,
        details={"format": "csv"}
    )
    
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=operation_{operation_id}_audit.csv"
        }
    )


@router.get("/operations/{operation_id}/json")
async def export_operation_json(
    operation_id: int,
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    operation = repo.operation.get_by_id(operation_id)
    
    if not operation:
        raise HTTPException(status_code=404, detail="操作不存在")
    
    current_version = None
    target_version = None
    current_values = []
    target_values = []
    
    if operation.current_version_id:
        current_version = repo.setting.get_by_id(operation.current_version_id)
        if current_version:
            current_values = repo.setting.get_values(operation.current_version_id)
    
    if operation.target_version_id:
        target_version = repo.setting.get_by_id(operation.target_version_id)
        if target_version:
            target_values = repo.setting.get_values(operation.target_version_id)
    
    plate_status = None
    plates = []
    if operation.plate_status_id:
        plate_status = repo.plate.get_by_id(operation.plate_status_id)
        if plate_status:
            plates = repo.plate.get_plates(operation.plate_status_id)
    
    approval_ticket = None
    signatures = []
    if operation.approval_ticket_id:
        approval_ticket = repo.approval.get_by_id(operation.approval_ticket_id)
        if approval_ticket:
            signatures = repo.approval.get_signatures(operation.approval_ticket_id)
    
    check_results = repo.check.get_by_operation(operation_id)
    simulation_logs = repo.simulation.get_by_operation(operation_id)
    
    exporter = JSONExporter()
    json_content = exporter.export_operation(
        operation=operation,
        current_version=current_version,
        target_version=target_version,
        current_values=current_values,
        target_values=target_values,
        plate_status=plate_status,
        plates=plates,
        approval_ticket=approval_ticket,
        signatures=signatures,
        check_results=check_results,
        simulation_logs=simulation_logs
    )
    
    repo.audit.log_operation(
        operation="EXPORT",
        resource_type="operation",
        resource_id=operation_id,
        details={"format": "json"}
    )
    
    return JSONResponse(
        content=json_content,
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=operation_{operation_id}_audit.json"
        }
    )


@router.get("/checks/{operation_id}/markdown")
async def export_check_results_markdown(
    operation_id: int,
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    operation = repo.operation.get_by_id(operation_id)
    
    if not operation:
        raise HTTPException(status_code=404, detail="操作不存在")
    
    check_results = repo.check.get_by_operation(operation_id)
    
    if not check_results:
        raise HTTPException(status_code=404, detail="未找到检查结果")
    
    exporter = MarkdownExporter()
    markdown_content = exporter.export_check_results(check_results, operation)
    
    repo.audit.log_operation(
        operation="EXPORT",
        resource_type="check_results",
        resource_id=operation_id,
        details={"format": "markdown"}
    )
    
    return PlainTextResponse(
        content=markdown_content,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f"attachment; filename=check_results_{operation_id}.md"
        }
    )


@router.get("/checks/{operation_id}/csv")
async def export_check_results_csv(
    operation_id: int,
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    check_results = repo.check.get_by_operation(operation_id)
    
    if not check_results:
        raise HTTPException(status_code=404, detail="未找到检查结果")
    
    exporter = CSVExporter()
    csv_content = exporter.export_check_results(check_results)
    
    repo.audit.log_operation(
        operation="EXPORT",
        resource_type="check_results",
        resource_id=operation_id,
        details={"format": "csv"}
    )
    
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=check_results_{operation_id}.csv"
        }
    )


@router.get("/checks/{operation_id}/json")
async def export_check_results_json(
    operation_id: int,
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    operation = repo.operation.get_by_id(operation_id)
    check_results = repo.check.get_by_operation(operation_id)
    
    if not check_results:
        raise HTTPException(status_code=404, detail="未找到检查结果")
    
    exporter = JSONExporter()
    json_content = exporter.export_check_results(check_results, operation)
    
    repo.audit.log_operation(
        operation="EXPORT",
        resource_type="check_results",
        resource_id=operation_id,
        details={"format": "json"}
    )
    
    return JSONResponse(
        content=json_content,
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=check_results_{operation_id}.json"
        }
    )


@router.get("/logs/json")
async def export_audit_logs_json(
    limit: int = Query(100, ge=1, le=1000, description="返回日志数量限制"),
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    logs = repo.audit.get_recent(limit=limit)
    
    exporter = JSONExporter()
    json_content = exporter.export_audit_logs(logs)
    
    return JSONResponse(
        content=json_content,
        media_type="application/json"
    )


@router.get("/versions/{version_id}/csv")
async def export_version_csv(
    version_id: int,
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    version = repo.setting.get_by_id(version_id)
    
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")
    
    values = repo.setting.get_values(version_id)
    
    exporter = CSVExporter()
    csv_content = exporter.export_setting_versions(version, values)
    
    repo.audit.log_operation(
        operation="EXPORT",
        resource_type="setting_version",
        resource_id=version_id,
        details={"format": "csv"}
    )
    
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=setting_version_{version_id}.csv"
        }
    )
