from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional

from app.database import engine, get_db, Base
from app.models import MaintenanceWindow
from pydantic import BaseModel, Field

Base.metadata.create_all(bind=engine)

app = FastAPI(title="铁路天窗维修 API")


class MaintenanceWindowCreate(BaseModel):
    request_id: str = Field(..., description="申请编号")
    line_section: str = Field(..., description="线路区间")
    start_time: datetime = Field(..., description="开始时间")
    end_time: datetime = Field(..., description="结束时间")
    work_summary: Optional[str] = Field(None, description="作业内容摘要")
    applicant: Optional[str] = Field(None, description="申请人")
    applicant_department: Optional[str] = Field(None, description="申请部门")


class CloseWindowRequest(BaseModel):
    final_conclusion: Optional[str] = None


@app.get("/")
def root():
    return {"message": "铁路天窗维修 API 服务已启动"}


@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


def check_time_overlap(start1: datetime, end1: datetime, start2: datetime, end2: datetime) -> bool:
    return start1 < end2 and start2 < end1


def check_section_overlap(section1: str, section2: str) -> bool:
    return section1 == section2


def detect_conflicts(window: MaintenanceWindow, db: Session) -> List[dict]:
    conflicts = []
    existing_windows = db.query(MaintenanceWindow).filter(
        MaintenanceWindow.id != window.id,
        MaintenanceWindow.status.in_(["pending", "reviewing", "approved"])
    ).all()

    for w in existing_windows:
        time_overlap = check_time_overlap(
            window.start_time, window.end_time,
            w.start_time, w.end_time
        )
        section_overlap = check_section_overlap(window.line_section, w.line_section)

        if time_overlap and section_overlap:
            conflicts.append({
                "type": "time_and_section_overlap",
                "conflict_with": w.request_id,
                "conflict_window_id": w.id,
                "line_section": w.line_section,
                "start_time": w.start_time.isoformat(),
                "end_time": w.end_time.isoformat(),
                "description": "时间和线路区间重叠冲突"
            })
        elif time_overlap:
            conflicts.append({
                "type": "time_overlap",
                "conflict_with": w.request_id,
                "conflict_window_id": w.id,
                "start_time": w.start_time.isoformat(),
                "end_time": w.end_time.isoformat(),
                "description": "时间重叠冲突"
            })
        elif section_overlap:
            conflicts.append({
                "type": "section_overlap",
                "conflict_with": w.request_id,
                "conflict_window_id": w.id,
                "line_section": w.line_section,
                "description": "线路区间重叠冲突"
            })

    return conflicts


@app.post("/windows/")
def create_window(
    window_data: MaintenanceWindowCreate,
    db: Session = Depends(get_db)
):
    existing = db.query(MaintenanceWindow).filter(
        MaintenanceWindow.request_id == window_data.request_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="申请编号已存在")

    if window_data.start_time >= window_data.end_time:
        raise HTTPException(status_code=400, detail="开始时间必须早于结束时间")

    is_cross = window_data.start_time.date() != window_data.end_time.date()

    window = MaintenanceWindow(
        request_id=window_data.request_id,
        line_section=window_data.line_section,
        start_time=window_data.start_time,
        end_time=window_data.end_time,
        is_cross_day=is_cross,
        work_summary=window_data.work_summary,
        applicant=window_data.applicant,
        applicant_department=window_data.applicant_department,
        status="pending"
    )

    db.add(window)
    db.commit()
    db.refresh(window)

    return {
        "id": window.id,
        "request_id": window.request_id,
        "status": window.status,
        "line_section": window.line_section,
        "is_cross_day": window.is_cross_day,
        "start_time": window.start_time.isoformat(),
        "end_time": window.end_time.isoformat()
    }


@app.get("/windows/")
def list_windows(
    status: Optional[str] = None,
    line_section: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(MaintenanceWindow)

    if status:
        query = query.filter(MaintenanceWindow.status == status)
    if line_section:
        query = query.filter(MaintenanceWindow.line_section == line_section)

    windows = query.offset(skip).limit(limit).all()

    return [
        {
            "id": w.id,
            "request_id": w.request_id,
            "status": w.status,
            "line_section": w.line_section,
            "start_time": w.start_time.isoformat(),
            "end_time": w.end_time.isoformat(),
            "is_cross_day": w.is_cross_day
        }
        for w in windows
    ]


@app.get("/windows/{window_id}")
def get_window(window_id: int, db: Session = Depends(get_db)):
    window = db.query(MaintenanceWindow).filter(
        MaintenanceWindow.id == window_id
    ).first()

    if not window:
        raise HTTPException(status_code=404, detail="天窗记录不存在")

    return {
        "id": window.id,
        "request_id": window.request_id,
        "status": window.status,
        "line_section": window.line_section,
        "start_time": window.start_time.isoformat(),
        "end_time": window.end_time.isoformat(),
        "is_cross_day": window.is_cross_day,
        "work_summary": window.work_summary,
        "applicant": window.applicant,
        "applicant_department": window.applicant_department,
        "created_at": window.created_at.isoformat() if window.created_at else None,
        "updated_at": window.updated_at.isoformat() if window.updated_at else None,
        "final_conclusion": window.final_conclusion,
        "closed_at": window.closed_at.isoformat() if window.closed_at else None
    }


@app.post("/windows/{window_id}/validate")
def validate_window(window_id: int, db: Session = Depends(get_db)):
    window = db.query(MaintenanceWindow).filter(
        MaintenanceWindow.id == window_id
    ).first()

    if not window:
        raise HTTPException(status_code=404, detail="天窗记录不存在")

    conflicts = detect_conflicts(window, db)

    if window.start_time >= window.end_time:
        conflicts.append({
            "type": "invalid_time_range",
            "description": "开始时间必须早于结束时间"
        })

    is_valid = len(conflicts) == 0

    return {
        "window_id": window_id,
        "request_id": window.request_id,
        "valid": is_valid,
        "conflict_count": len(conflicts),
        "conflicts": conflicts
    }


@app.post("/windows/{window_id}/approve")
def approve_window(window_id: int, db: Session = Depends(get_db)):
    window = db.query(MaintenanceWindow).filter(
        MaintenanceWindow.id == window_id
    ).first()

    if not window:
        raise HTTPException(status_code=404, detail="天窗记录不存在")

    if window.status == "approved":
        return {
            "id": window.id,
            "request_id": window.request_id,
            "status": window.status,
            "message": "天窗已批准"
        }

    if window.status not in ["pending", "reviewing"]:
        raise HTTPException(
            status_code=400,
            detail=f"当前状态 '{window.status}' 无法批准，仅 pending 或 reviewing 状态可批准"
        )

    conflicts = detect_conflicts(window, db)
    if conflicts:
        raise HTTPException(
            status_code=400,
            detail=f"存在 {len(conflicts)} 个冲突，无法批准"
        )

    window.status = "approved"
    db.commit()
    db.refresh(window)

    return {
        "id": window.id,
        "request_id": window.request_id,
        "status": window.status,
        "approved_at": datetime.now().isoformat()
    }


@app.post("/windows/{window_id}/close")
def close_window(
    window_id: int,
    close_request: CloseWindowRequest,
    db: Session = Depends(get_db)
):
    window = db.query(MaintenanceWindow).filter(
        MaintenanceWindow.id == window_id
    ).first()

    if not window:
        raise HTTPException(status_code=404, detail="天窗记录不存在")

    if window.status == "closed":
        return {
            "id": window.id,
            "request_id": window.request_id,
            "status": window.status,
            "message": "天窗已关闭"
        }

    if window.status != "approved":
        raise HTTPException(
            status_code=400,
            detail=f"当前状态 '{window.status}' 无法关闭，需先批准"
        )

    window.status = "closed"
    window.final_conclusion = close_request.final_conclusion
    window.closed_at = datetime.now()
    db.commit()
    db.refresh(window)

    return {
        "id": window.id,
        "request_id": window.request_id,
        "status": window.status,
        "final_conclusion": window.final_conclusion,
        "closed_at": window.closed_at.isoformat() if window.closed_at else None
    }


@app.get("/export")
def export_windows(
    status: Optional[str] = None,
    line_section: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(MaintenanceWindow)

    if status:
        query = query.filter(MaintenanceWindow.status == status)
    if line_section:
        query = query.filter(MaintenanceWindow.line_section == line_section)

    windows = query.all()

    export_data = []
    for w in windows:
        export_data.append({
            "id": w.id,
            "request_id": w.request_id,
            "status": w.status,
            "line_section": w.line_section,
            "start_time": w.start_time.isoformat() if w.start_time else None,
            "end_time": w.end_time.isoformat() if w.end_time else None,
            "is_cross_day": w.is_cross_day,
            "work_summary": w.work_summary,
            "applicant": w.applicant,
            "applicant_department": w.applicant_department,
            "created_at": w.created_at.isoformat() if w.created_at else None,
            "updated_at": w.updated_at.isoformat() if w.updated_at else None,
            "final_conclusion": w.final_conclusion,
            "closed_at": w.closed_at.isoformat() if w.closed_at else None,
            "source_system": w.source_system,
            "version": w.version
        })

    return {
        "export_time": datetime.now().isoformat(),
        "total_count": len(export_data),
        "status_filter": status,
        "line_section_filter": line_section,
        "data": export_data
    }
