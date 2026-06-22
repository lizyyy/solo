from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
import csv
import io
from datetime import datetime
from typing import Optional
from urllib.parse import quote

from ..database import get_db
from ..models import CollisionRecord, CollisionHistory
from ..schemas import SummaryData, RejudgePayload
from . import _record_to_out

router = APIRouter(prefix="/api/collisions", tags=["collisions"])


def _fmt_dt(dt):
    if dt is None:
        return ""
    if isinstance(dt, datetime):
        return dt.isoformat()
    return str(dt)


@router.get("/summary", response_model=SummaryData)
def get_summary(db: Session = Depends(get_db)):
    total = db.query(func.count(CollisionRecord.id)).scalar() or 0
    passed = db.query(func.count(CollisionRecord.id)).filter(CollisionRecord.status == "PASSED").scalar() or 0
    pending = db.query(func.count(CollisionRecord.id)).filter(CollisionRecord.status == "PENDING_EVIDENCE").scalar() or 0
    manual = db.query(func.count(CollisionRecord.id)).filter(CollisionRecord.rejudge_count > 0).scalar() or 0
    offset = db.query(func.count(CollisionRecord.id)).filter(CollisionRecord.is_coordinate_offset == True).scalar() or 0
    return {
        "total": total,
        "passed": passed,
        "pendingEvidence": pending,
        "manualRejudged": manual,
        "coordinateOffset": offset,
    }


@router.get("")
def list_collisions(
    status: Optional[str] = Query(None),
    coordinateOffsetOnly: Optional[bool] = Query(None),
    keyword: Optional[str] = Query(None),
    project: Optional[str] = Query(None),
    floor: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(CollisionRecord)
    if status and status != "ALL":
        if status == "MANUAL_REJUDGED":
            q = q.filter(CollisionRecord.rejudge_count > 0)
        else:
            q = q.filter(CollisionRecord.status == status)
    if coordinateOffsetOnly:
        q = q.filter(CollisionRecord.is_coordinate_offset == True)
    if keyword:
        kw = f"%{keyword}%"
        q = q.filter(
            CollisionRecord.id.ilike(kw)
            | CollisionRecord.element_a.ilike(kw)
            | CollisionRecord.element_b.ilike(kw)
            | CollisionRecord.responsible_person.ilike(kw)
            | CollisionRecord.node_code.ilike(kw)
        )
    if project and project != "ALL":
        q = q.filter(CollisionRecord.project_name == project)
    if floor and floor != "ALL":
        q = q.filter(CollisionRecord.floor == floor)
    records = q.order_by(CollisionRecord.id.asc()).all()
    return [_record_to_out(r, db) for r in records]


@router.get("/projects")
def list_projects(db: Session = Depends(get_db)):
    rows = db.query(CollisionRecord.project_name).distinct().order_by(CollisionRecord.project_name).all()
    return [r[0] for r in rows]


@router.get("/floors")
def list_floors(db: Session = Depends(get_db)):
    rows = db.query(CollisionRecord.floor).distinct().order_by(CollisionRecord.floor).all()
    return [r[0] for r in rows]


@router.get("/{record_id}")
def get_detail(record_id: str, db: Session = Depends(get_db)):
    r = db.query(CollisionRecord).filter(CollisionRecord.id == record_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    return _record_to_out(r, db)


@router.get("/{record_id}/history")
def get_history(record_id: str, db: Session = Depends(get_db)):
    r = db.query(CollisionRecord).filter(CollisionRecord.id == record_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    history = (
        db.query(CollisionHistory)
        .filter(CollisionHistory.collision_id == record_id)
        .order_by(CollisionHistory.created_at.desc())
        .all()
    )
    return [
        {
            "id": h.id,
            "collisionId": h.collision_id,
            "previousStatus": h.previous_status,
            "newStatus": h.new_status,
            "reason": h.reason,
            "operator": h.operator,
            "timestamp": _fmt_dt(h.created_at),
            "evidenceUrls": h.evidence_urls or [],
        }
        for h in history
    ]


@router.post("/{record_id}/rejudge")
def rejudge(record_id: str, payload: RejudgePayload, db: Session = Depends(get_db)):
    r = db.query(CollisionRecord).filter(CollisionRecord.id == record_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")

    prev_status = r.status
    if prev_status == payload.newStatus:
        raise HTTPException(status_code=400, detail="状态未变更，无需改判")

    r.status = payload.newStatus
    r.rejudge_count = (r.rejudge_count or 0) + 1
    r.updated_at = datetime.now()

    hist = CollisionHistory(
        id=f"hist-{record_id}-{int(datetime.now().timestamp())}",
        collision_id=record_id,
        previous_status=prev_status,
        new_status=payload.newStatus,
        reason=payload.reason,
        operator=payload.operator,
        evidence_urls=payload.evidenceUrls or [],
    )
    db.add(hist)
    db.commit()
    db.refresh(r)

    return _record_to_out(r, db)


@router.patch("/{record_id}/sample")
def toggle_sample(record_id: str, body: dict, db: Session = Depends(get_db)):
    r = db.query(CollisionRecord).filter(CollisionRecord.id == record_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    is_sample = bool(body.get("isSample", False))
    r.is_sample = is_sample
    r.updated_at = datetime.now()
    db.commit()
    db.refresh(r)
    return _record_to_out(r, db)


@router.get("/export/csv")
def export_csv(
    status: Optional[str] = Query(None),
    coordinateOffsetOnly: Optional[bool] = Query(None),
    keyword: Optional[str] = Query(None),
    project: Optional[str] = Query(None),
    floor: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(CollisionRecord)
    if status and status != "ALL":
        if status == "MANUAL_REJUDGED":
            q = q.filter(CollisionRecord.rejudge_count > 0)
        else:
            q = q.filter(CollisionRecord.status == status)
    if coordinateOffsetOnly:
        q = q.filter(CollisionRecord.is_coordinate_offset == True)
    if keyword:
        kw = f"%{keyword}%"
        q = q.filter(
            CollisionRecord.id.ilike(kw)
            | CollisionRecord.element_a.ilike(kw)
            | CollisionRecord.element_b.ilike(kw)
            | CollisionRecord.responsible_person.ilike(kw)
        )
    if project and project != "ALL":
        q = q.filter(CollisionRecord.project_name == project)
    if floor and floor != "ALL":
        q = q.filter(CollisionRecord.floor == floor)
    records = q.order_by(CollisionRecord.id.asc()).all()

    STATUS_LABEL = {
        "PASSED": "已放行",
        "PENDING_EVIDENCE": "待补证据",
        "REJECTED": "驳回",
        "MANUAL_REJUDGED": "人工改过",
    }

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "碰撞编号", "是否样例", "项目", "楼层", "节点编号",
        "碰撞类型", "构件A", "构件B", "当前状态", "改判次数",
        "坐标偏移异常", "异常说明", "负责人", "初判结论（原始结论）",
        "最近改判原因", "最近改判人", "最近改判时间",
        "创建时间", "修改时间", "历史操作摘要"
    ])

    for r in records:
        history = (
            db.query(CollisionHistory)
            .filter(CollisionHistory.collision_id == r.id)
            .order_by(CollisionHistory.created_at.desc())
            .all()
        )
        latest = history[0] if history else None
        hist_summary = "; ".join(
            [f"{h.operator}→{STATUS_LABEL.get(h.new_status, h.new_status)}({h.reason[:20]})" for h in history[:3]]
        ) if history else "无改判记录"

        writer.writerow([
            r.id,
            "是" if r.is_sample else "否",
            r.project_name,
            r.floor,
            r.node_code,
            r.collision_type,
            r.element_a,
            r.element_b,
            STATUS_LABEL.get(r.status, r.status),
            r.rejudge_count or 0,
            "是" if r.is_coordinate_offset else "否",
            r.coordinate_offset_note or "",
            r.responsible_person,
            r.initial_conclusion or "",
            latest.reason if latest else "",
            latest.operator if latest else "",
            _fmt_dt(latest.created_at) if latest else "",
            _fmt_dt(r.created_at),
            _fmt_dt(r.updated_at),
            hist_summary,
        ])

    content = output.getvalue()
    bom_content = "\ufeff" + content

    def iter_csv():
        yield bom_content.encode("utf-8")

    filename = f"幕墙节点碰撞预审明细_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    encoded_filename = quote(filename)
    return StreamingResponse(
        iter_csv(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"},
    )
