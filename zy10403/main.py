from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import csv
import io
from fastapi.responses import StreamingResponse

from database import engine, get_db, Base
from models import LeaseStatus
from schemas import (
    LeaseCreate, LeaseUpdate, LeaseRelease, LeaseManualCorrect,
    LeaseResponse, LeaseDetailResponse, ReleaseLogResponse,
    AuditLogResponse, OccupancyReportResponse, LeaseQueryParams
)
from services import (
    create_lease, get_lease, query_leases, renew_lease,
    release_lease, manual_correct_lease, recalculate_statuses,
    get_occupancy_report, get_audit_logs, is_lease_expired
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="预览环境租约API",
    description="管理预览环境租约的REST API",
    version="1.0.0"
)


def enrich_lease_response(lease):
    data = {c.name: getattr(lease, c.name) for c in lease.__table__.columns}
    data["is_expired"] = is_lease_expired(lease)
    return data


@app.post("/leases/", response_model=LeaseResponse, summary="创建租约")
def create_new_lease(lease_data: LeaseCreate, db: Session = Depends(get_db)):
    try:
        result = create_lease(db, lease_data)
        return enrich_lease_response(result["lease"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/leases/{lease_id}", response_model=LeaseDetailResponse, summary="获取租约详情")
def get_single_lease(lease_id: int, db: Session = Depends(get_db)):
    lease = get_lease(db, lease_id)
    if not lease:
        raise HTTPException(status_code=404, detail="租约不存在")
    return enrich_lease_response(lease)


@app.get("/leases/", response_model=List[LeaseResponse], summary="查询租约列表")
def list_leases(
    branch_name: Optional[str] = None,
    env_id: Optional[str] = None,
    assignee: Optional[str] = None,
    status: Optional[LeaseStatus] = None,
    only_active: bool = False,
    db: Session = Depends(get_db)
):
    params = LeaseQueryParams(
        branch_name=branch_name,
        env_id=env_id,
        assignee=assignee,
        status=status,
        only_active=only_active
    )
    leases = query_leases(db, params)
    return [enrich_lease_response(lease) for lease in leases]


@app.put("/leases/{lease_id}/renew", response_model=LeaseResponse, summary="续租/更新租约")
def renew_existing_lease(lease_id: int, update_data: LeaseUpdate, db: Session = Depends(get_db)):
    try:
        lease = renew_lease(db, lease_id, update_data)
        return enrich_lease_response(lease)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/leases/{lease_id}/release", response_model=LeaseResponse, summary="释放租约")
def release_existing_lease(lease_id: int, release_data: LeaseRelease, db: Session = Depends(get_db)):
    try:
        lease = release_lease(db, lease_id, release_data)
        return enrich_lease_response(lease)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/leases/{lease_id}/correct", response_model=LeaseResponse, summary="人工修正租约")
def correct_lease(lease_id: int, correct_data: LeaseManualCorrect, db: Session = Depends(get_db)):
    try:
        lease = manual_correct_lease(db, lease_id, correct_data)
        return enrich_lease_response(lease)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/leases/recalculate", summary="批量重新计算租约状态")
def bulk_recalculate(operator: str, db: Session = Depends(get_db)):
    result = recalculate_statuses(db, operator)
    return result


@app.get("/report/occupancy", response_model=OccupancyReportResponse, summary="获取占用报表")
def get_report(db: Session = Depends(get_db)):
    return get_occupancy_report(db)


@app.get("/report/export", summary="导出租约CSV")
def export_leases(db: Session = Depends(get_db)):
    leases = query_leases(db, LeaseQueryParams())
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "分支名称", "环境编号", "占用人", "租约开始", "租约结束",
        "续租理由", "状态", "是否过期", "创建时间"
    ])
    for lease in leases:
        writer.writerow([
            lease.id, lease.branch_name, lease.env_id, lease.assignee,
            lease.lease_start, lease.lease_end, lease.renew_reason or "",
            lease.status, is_lease_expired(lease), lease.created_at
        ])
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=leases_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
    )


@app.get("/audit-logs/", response_model=List[AuditLogResponse], summary="获取审计日志")
def list_audit_logs(limit: int = 100, db: Session = Depends(get_db)):
    return get_audit_logs(db, limit)


@app.get("/health", summary="健康检查")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now()}
