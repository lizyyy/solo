from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.schemas import ResetRequestCreate, ResetRequest, ResetStatusUpdate
from app.services import ResetService
from app.models.reset_request import ResetStatus

router = APIRouter(tags=["重置申请"])


@router.post("/", response_model=ResetRequest)
def create_reset_request(
    request: ResetRequestCreate,
    db: Session = Depends(get_db),
    x_user_role: str = Header("student", description="用户角色: student/assistant/teacher/admin")
):
    service = ResetService(db)
    try:
        return service.create_reset_request(request, user_role=x_user_role)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[ResetRequest])
def get_reset_requests(
    status: Optional[ResetStatus] = Query(None, description="按状态筛选"),
    db: Session = Depends(get_db)
):
    service = ResetService(db)
    return service.get_all_requests(status)


@router.get("/{request_id}", response_model=ResetRequest)
def get_reset_request(request_id: int, db: Session = Depends(get_db)):
    service = ResetService(db)
    request = service.get_request(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="重置申请不存在")
    return request


@router.get("/{request_id}/available-transitions")
def get_available_transitions(request_id: int, db: Session = Depends(get_db)):
    service = ResetService(db)
    request = service.get_request(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="重置申请不存在")
    transitions = service.get_available_transitions(request.status)
    return {
        "current_status": request.status.value,
        "available_transitions": [t.value for t in transitions]
    }


@router.patch("/{request_id}/status", response_model=ResetRequest)
def update_reset_status(
    request_id: int,
    status_update: ResetStatusUpdate,
    db: Session = Depends(get_db),
    x_user_role: str = Header("assistant", description="用户角色: student/assistant/teacher/admin")
):
    service = ResetService(db)
    try:
        return service.update_status(request_id, status_update, user_role=x_user_role)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{request_id}/logs")
def get_reset_request_logs(request_id: int, db: Session = Depends(get_db)):
    service = ResetService(db)
    return service.get_request_logs(request_id)


@router.get("/{request_id}/retained-files")
def get_reset_retained_files(request_id: int, db: Session = Depends(get_db)):
    service = ResetService(db)
    return service.get_retained_files(request_id)


@router.get("/{request_id}/export")
def export_reset_report(request_id: int, db: Session = Depends(get_db)):
    service = ResetService(db)
    try:
        return service.export_report(request_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/init-sample-data")
def initialize_sample_data(db: Session = Depends(get_db)):
    service = ResetService(db)
    try:
        service.create_sample_data()
        return {"message": "样例数据创建成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/permissions/info")
def get_permission_info():
    return {
        "roles": ["student", "assistant", "teacher", "admin"],
        "actions": {
            "create": ["student", "assistant", "teacher", "admin"],
            "approve": ["assistant", "teacher", "admin"],
            "process": ["assistant", "teacher", "admin"],
            "block": ["teacher", "admin"],
            "cancel": ["assistant", "teacher", "admin"],
        },
        "valid_transitions": {
            status.value: [s.value for s in transitions]
            for status, transitions in ResetService.VALID_TRANSITIONS.items()
        }
    }