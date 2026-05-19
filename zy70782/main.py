from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, Integer
from typing import List, Optional
from pydantic import BaseModel
import json
from datetime import datetime

from database import get_db, init_db, YamlDirectory, ContainerResource, OptimizationReport
from database import ResourceStatus, IssueType
from k8s_parser import K8sResourceParser

app = FastAPI(title="K8s Requests/Limits Checker API", version="1.0.0")

parser = K8sResourceParser()


@app.on_event("startup")
async def startup_event():
    init_db()


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[dict] = None


def create_error_response(error_code: str, message: str, status_code: int, details: dict = None):
    return JSONResponse(
        status_code=status_code,
        content={
            "error_code": error_code,
            "message": message,
            "details": details or {}
        }
    )


class ContainerResourceResponse(BaseModel):
    id: int
    namespace: str
    workload_name: str
    workload_type: str
    container_name: str
    cpu_requests: str
    memory_requests: str
    cpu_limits: str
    memory_limits: str
    issue_type: str
    status: str
    cpu_ratio: Optional[float]
    memory_ratio: Optional[float]
    notes: Optional[str]
    yaml_file_path: str

    class Config:
        orm_mode = True


class DirectoryImportRequest(BaseModel):
    directory_path: str


class DirectoryImportResponse(BaseModel):
    directory_id: int
    path: str
    total_files: int
    total_containers: int
    message: str


class StatusUpdateRequest(BaseModel):
    status: ResourceStatus
    notes: Optional[str] = None


class ReportGenerateRequest(BaseModel):
    namespace: Optional[str] = None
    report_type: str = "summary"


@app.post("/api/directories/import", response_model=DirectoryImportResponse)
async def import_directory(request: DirectoryImportRequest, db: Session = Depends(get_db)):
    import os

    if not request.directory_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "MISSING_FIELD",
                "message": "directory_path is required",
                "details": {"field": "directory_path"}
            }
        )

    if not os.path.isdir(request.directory_path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_DIRECTORY",
                "message": "Directory does not exist",
                "details": {"path": request.directory_path}
            }
        )

    existing = db.query(YamlDirectory).filter(YamlDirectory.path == request.directory_path).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "ALREADY_PROCESSED",
                "message": "Directory has already been imported",
                "details": {"directory_id": existing.id, "path": existing.path}
            }
        )

    containers, file_count = parser.parse_directory(request.directory_path)

    if not containers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "NO_CONTAINERS_FOUND",
                "message": "No Kubernetes workload containers found in the directory",
                "details": {"path": request.directory_path, "files_scanned": file_count}
            }
        )

    directory = YamlDirectory(
        path=request.directory_path,
        total_files=file_count,
        total_containers=len(containers)
    )
    db.add(directory)
    db.flush()

    for container in containers:
        issue_type, cpu_ratio, memory_ratio = parser.determine_issue_type(
            container.cpu_requests,
            container.memory_requests,
            container.cpu_limits,
            container.memory_limits
        )

        db_container = ContainerResource(
            directory_id=directory.id,
            namespace=container.namespace,
            workload_name=container.workload_name,
            workload_type=container.workload_type,
            container_name=container.container_name,
            cpu_requests=container.cpu_requests,
            memory_requests=container.memory_requests,
            cpu_limits=container.cpu_limits,
            memory_limits=container.memory_limits,
            issue_type=issue_type,
            status=ResourceStatus.PENDING,
            cpu_ratio=cpu_ratio,
            memory_ratio=memory_ratio,
            yaml_file_path=container.yaml_file_path
        )
        db.add(db_container)

    db.commit()
    db.refresh(directory)

    return DirectoryImportResponse(
        directory_id=directory.id,
        path=directory.path,
        total_files=directory.total_files,
        total_containers=directory.total_containers,
        message=f"Successfully imported {len(containers)} containers from {file_count} files"
    )


@app.get("/api/containers", response_model=List[ContainerResourceResponse])
async def list_containers(
    namespace: Optional[str] = None,
    issue_type: Optional[IssueType] = None,
    status: Optional[ResourceStatus] = None,
    directory_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(ContainerResource)

    if namespace:
        query = query.filter(ContainerResource.namespace == namespace)
    if issue_type:
        query = query.filter(ContainerResource.issue_type == issue_type)
    if status:
        query = query.filter(ContainerResource.status == status)
    if directory_id:
        query = query.filter(ContainerResource.directory_id == directory_id)

    containers = query.offset(skip).limit(limit).all()
    return containers


@app.get("/api/containers/{container_id}", response_model=ContainerResourceResponse)
async def get_container(container_id: int, db: Session = Depends(get_db)):
    container = db.query(ContainerResource).filter(ContainerResource.id == container_id).first()
    if not container:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "NOT_FOUND",
                "message": "Container not found",
                "details": {"container_id": container_id}
            }
        )
    return container


@app.patch("/api/containers/{container_id}/status")
async def update_container_status(
    container_id: int,
    request: StatusUpdateRequest,
    db: Session = Depends(get_db)
):
    container = db.query(ContainerResource).filter(ContainerResource.id == container_id).first()
    if not container:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "NOT_FOUND",
                "message": "Container not found",
                "details": {"container_id": container_id}
            }
        )

    if container.status == ResourceStatus.PROCESSED and request.status == ResourceStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "STATUS_NOT_ALLOWED",
                "message": "Cannot revert from PROCESSED to PENDING",
                "details": {"current_status": container.status, "requested_status": request.status}
            }
        )

    if container.status == ResourceStatus.FIXED and request.status not in [ResourceStatus.FIXED]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "STATUS_NOT_ALLOWED",
                "message": "Already marked as FIXED, cannot change status",
                "details": {"current_status": container.status, "requested_status": request.status}
            }
        )

    container.status = request.status
    if request.notes:
        container.notes = request.notes
    container.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(container)

    return {
        "container_id": container_id,
        "status": container.status,
        "notes": container.notes,
        "message": "Status updated successfully"
    }


@app.get("/api/namespaces")
async def list_namespaces(db: Session = Depends(get_db)):
    result = db.query(
        ContainerResource.namespace,
        func.count(ContainerResource.id).label("total_containers"),
        func.sum(func.cast(ContainerResource.issue_type == IssueType.MISSING_REQUESTS, Integer)).label("missing_requests"),
        func.sum(func.cast(ContainerResource.issue_type == IssueType.MISSING_LIMITS, Integer)).label("missing_limits"),
        func.sum(func.cast(ContainerResource.issue_type == IssueType.MISSING_BOTH, Integer)).label("missing_both"),
        func.sum(func.cast(ContainerResource.issue_type == IssueType.RATIO_MISMATCH, Integer)).label("ratio_issues")
    ).group_by(ContainerResource.namespace).all()

    namespaces = []
    for row in result:
        namespaces.append({
            "namespace": row.namespace,
            "total_containers": row.total_containers,
            "missing_requests": row.missing_requests or 0,
            "missing_limits": row.missing_limits or 0,
            "missing_both": row.missing_both or 0,
            "ratio_issues": row.ratio_issues or 0,
            "total_issues": (row.missing_requests or 0) + (row.missing_limits or 0) + (row.missing_both or 0) + (row.ratio_issues or 0)
        })

    return namespaces


@app.post("/api/reports/generate")
async def generate_report(request: ReportGenerateRequest, db: Session = Depends(get_db)):
    query = db.query(ContainerResource)

    if request.namespace:
        query = query.filter(ContainerResource.namespace == request.namespace)

    containers = query.all()

    if not containers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "NO_DATA",
                "message": "No container data found for report generation",
                "details": {"namespace": request.namespace}
            }
        )

    missing_requests_count = sum(1 for c in containers if c.issue_type == IssueType.MISSING_REQUESTS)
    missing_limits_count = sum(1 for c in containers if c.issue_type == IssueType.MISSING_LIMITS)
    missing_both_count = sum(1 for c in containers if c.issue_type == IssueType.MISSING_BOTH)
    ratio_issues_count = sum(1 for c in containers if c.issue_type == IssueType.RATIO_MISMATCH)
    normal_count = sum(1 for c in containers if c.issue_type == IssueType.NORMAL)

    pending_count = sum(1 for c in containers if c.status == ResourceStatus.PENDING)
    needs_review_count = sum(1 for c in containers if c.status == ResourceStatus.NEEDS_REVIEW)
    processed_count = sum(1 for c in containers if c.status == ResourceStatus.PROCESSED)
    fixed_count = sum(1 for c in containers if c.status == ResourceStatus.FIXED)

    summary = {
        "total_containers": len(containers),
        "by_issue_type": {
            "missing_requests": missing_requests_count,
            "missing_limits": missing_limits_count,
            "missing_both": missing_both_count,
            "ratio_mismatch": ratio_issues_count,
            "normal": normal_count
        },
        "by_status": {
            "pending": pending_count,
            "needs_review": needs_review_count,
            "processed": processed_count,
            "fixed": fixed_count
        }
    }

    report = OptimizationReport(
        report_type=request.report_type,
        namespace=request.namespace,
        total_containers=len(containers),
        missing_requests_count=missing_requests_count + missing_both_count,
        missing_limits_count=missing_limits_count + missing_both_count,
        ratio_issues_count=ratio_issues_count,
        summary=json.dumps(summary)
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return {
        "report_id": report.id,
        "generated_at": report.generated_at,
        "namespace": request.namespace,
        "summary": summary
    }


@app.get("/api/reports/{report_id}/export")
async def export_report(report_id: int, format: str = "json", db: Session = Depends(get_db)):
    if format not in ["json"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_FORMAT",
                "message": "Only JSON format is supported",
                "details": {"requested_format": format, "supported_formats": ["json"]}
            }
        )

    report = db.query(OptimizationReport).filter(OptimizationReport.id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "NOT_FOUND",
                "message": "Report not found",
                "details": {"report_id": report_id}
            }
        )

    containers = db.query(ContainerResource)
    if report.namespace:
        containers = containers.filter(ContainerResource.namespace == report.namespace)

    container_list = []
    for c in containers.all():
        container_list.append({
            "id": c.id,
            "namespace": c.namespace,
            "workload_name": c.workload_name,
            "workload_type": c.workload_type,
            "container_name": c.container_name,
            "cpu_requests": c.cpu_requests,
            "memory_requests": c.memory_requests,
            "cpu_limits": c.cpu_limits,
            "memory_limits": c.memory_limits,
            "issue_type": c.issue_type.value,
            "status": c.status.value,
            "cpu_ratio": c.cpu_ratio,
            "memory_ratio": c.memory_ratio,
            "yaml_file_path": c.yaml_file_path
        })

    report_data = {
        "report_id": report.id,
        "generated_at": report.generated_at.isoformat(),
        "namespace": report.namespace,
        "summary": json.loads(report.summary),
        "containers": container_list
    }

    return report_data


@app.get("/api/statistics")
async def get_statistics(db: Session = Depends(get_db)):
    total_containers = db.query(ContainerResource).count()

    issue_stats = db.query(
        ContainerResource.issue_type,
        func.count(ContainerResource.id)
    ).group_by(ContainerResource.issue_type).all()

    status_stats = db.query(
        ContainerResource.status,
        func.count(ContainerResource.id)
    ).group_by(ContainerResource.status).all()

    namespace_count = db.query(ContainerResource.namespace).distinct().count()

    return {
        "total_containers": total_containers,
        "namespaces_count": namespace_count,
        "by_issue_type": {issue.value: count for issue, count in issue_stats},
        "by_status": {status.value: count for status, count in status_stats}
    }


@app.get("/api/directories")
async def list_directories(db: Session = Depends(get_db)):
    directories = db.query(YamlDirectory).all()
    return [
        {
            "id": d.id,
            "path": d.path,
            "imported_at": d.imported_at,
            "total_files": d.total_files,
            "total_containers": d.total_containers
        }
        for d in directories
    ]



