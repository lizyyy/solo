from datetime import datetime, date, time, timedelta
from typing import List, Optional
from collections import defaultdict

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from database import get_db, init_db
from models import (
    Auditorium, Film, KDM, Schedule, Event,
    AuditoriumStatus, ScheduleStatus, EventStatus,
    EventType, EventPriority, KDMSource
)
from schemas import (
    AuditoriumCreate, AuditoriumUpdate, AuditoriumResponse,
    FilmCreate, FilmUpdate, FilmResponse,
    KDMCreate, KDMUpdate, KDMResponse,
    ScheduleCreate, ScheduleUpdate, ScheduleReassign, ScheduleResponse,
    EventAcknowledge, EventResolve, EventResponse,
    BatchUploadRequest, BatchUploadResponse,
    DailyRiskSummary, RiskSummaryItem, RiskDetectionResult
)
from risk_detection import RiskDetector

app = FastAPI(
    title="影院放映密钥风险校验 API",
    description="用于小型独立影院的放映密钥风险校验系统，支持资产登记、排片解析、风险自动检测和事件管理",
    version="1.0.0",
    openapi_tags=[
        {"name": "资产登记", "description": "影厅设备、影片DCP、KDM密钥的管理接口"},
        {"name": "排片管理", "description": "排片计划的创建、查询和改派"},
        {"name": "风险检测", "description": "自动检测密钥过期、服务器不匹配等风险"},
        {"name": "事件管理", "description": "待处理事件的确认、解决和查询"},
        {"name": "风险摘要", "description": "风险统计和摘要导出"},
        {"name": "批量操作", "description": "批量上传资产和排片数据"},
    ]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    init_db()


@app.get("/", include_in_schema=False)
def root():
    return {"message": "影院放映密钥风险校验 API - 请访问 /docs 查看接口文档"}


@app.post("/auditoriums/", response_model=AuditoriumResponse, tags=["资产登记"])
def create_auditorium(auditorium: AuditoriumCreate, db: Session = Depends(get_db)):
    existing = db.query(Auditorium).filter(
        or_(Auditorium.name == auditorium.name, Auditorium.server_id == auditorium.server_id)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="影厅名称或服务器ID已存在")
    
    db_auditorium = Auditorium(**auditorium.model_dump())
    db.add(db_auditorium)
    db.commit()
    db.refresh(db_auditorium)
    return db_auditorium


@app.get("/auditoriums/", response_model=List[AuditoriumResponse], tags=["资产登记"])
def list_auditoriums(
    status: Optional[AuditoriumStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(Auditorium)
    if status:
        query = query.filter(Auditorium.status == status)
    return query.offset(skip).limit(limit).all()


@app.get("/auditoriums/{auditorium_id}", response_model=AuditoriumResponse, tags=["资产登记"])
def get_auditorium(auditorium_id: int, db: Session = Depends(get_db)):
    auditorium = db.query(Auditorium).filter(Auditorium.id == auditorium_id).first()
    if not auditorium:
        raise HTTPException(status_code=404, detail="影厅不存在")
    return auditorium


@app.put("/auditoriums/{auditorium_id}", response_model=AuditoriumResponse, tags=["资产登记"])
def update_auditorium(auditorium_id: int, auditorium: AuditoriumUpdate, db: Session = Depends(get_db)):
    db_auditorium = db.query(Auditorium).filter(Auditorium.id == auditorium_id).first()
    if not db_auditorium:
        raise HTTPException(status_code=404, detail="影厅不存在")
    
    update_data = auditorium.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_auditorium, key, value)
    
    db.commit()
    db.refresh(db_auditorium)
    return db_auditorium


@app.post("/films/", response_model=FilmResponse, tags=["资产登记"])
def create_film(film: FilmCreate, db: Session = Depends(get_db)):
    existing = db.query(Film).filter(Film.cpl_id == film.cpl_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="影片CPL ID已存在")
    
    db_film = Film(**film.model_dump())
    db.add(db_film)
    db.commit()
    db.refresh(db_film)
    return db_film


@app.get("/films/", response_model=List[FilmResponse], tags=["资产登记"])
def list_films(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    return db.query(Film).offset(skip).limit(limit).all()


@app.get("/films/{film_id}", response_model=FilmResponse, tags=["资产登记"])
def get_film(film_id: int, db: Session = Depends(get_db)):
    film = db.query(Film).filter(Film.id == film_id).first()
    if not film:
        raise HTTPException(status_code=404, detail="影片不存在")
    return film


@app.put("/films/{film_id}", response_model=FilmResponse, tags=["资产登记"])
def update_film(film_id: int, film: FilmUpdate, db: Session = Depends(get_db)):
    db_film = db.query(Film).filter(Film.id == film_id).first()
    if not db_film:
        raise HTTPException(status_code=404, detail="影片不存在")
    
    update_data = film.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_film, key, value)
    
    db.commit()
    db.refresh(db_film)
    return db_film


@app.post("/kdms/", response_model=KDMResponse, tags=["资产登记"])
def create_kdm(kdm: KDMCreate, db: Session = Depends(get_db)):
    film = db.query(Film).filter(Film.id == kdm.film_id).first()
    if not film:
        raise HTTPException(status_code=400, detail="指定的影片不存在")
    
    if kdm.auditorium_id:
        auditorium = db.query(Auditorium).filter(Auditorium.id == kdm.auditorium_id).first()
        if not auditorium:
            raise HTTPException(status_code=400, detail="指定的影厅不存在")
    
    db_kdm = KDM(
        **kdm.model_dump(),
        cpl_id=film.cpl_id
    )
    db.add(db_kdm)
    db.commit()
    db.refresh(db_kdm)
    
    detector = RiskDetector(db)
    detector.run_detection()
    
    return db_kdm


@app.get("/kdms/", response_model=List[KDMResponse], tags=["资产登记"])
def list_kdms(
    film_id: Optional[int] = None,
    auditorium_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(KDM)
    if film_id:
        query = query.filter(KDM.film_id == film_id)
    if auditorium_id:
        query = query.filter(
            or_(KDM.auditorium_id == auditorium_id, KDM.auditorium_id.is_(None))
        )
    return query.offset(skip).limit(limit).all()


@app.get("/kdms/{kdm_id}", response_model=KDMResponse, tags=["资产登记"])
def get_kdm(kdm_id: int, db: Session = Depends(get_db)):
    kdm = db.query(KDM).filter(KDM.id == kdm_id).first()
    if not kdm:
        raise HTTPException(status_code=404, detail="KDM密钥不存在")
    return kdm


@app.put("/kdms/{kdm_id}", response_model=KDMResponse, tags=["资产登记"])
def update_kdm(kdm_id: int, kdm: KDMUpdate, db: Session = Depends(get_db)):
    db_kdm = db.query(KDM).filter(KDM.id == kdm_id).first()
    if not db_kdm:
        raise HTTPException(status_code=404, detail="KDM密钥不存在")
    
    update_data = kdm.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_kdm, key, value)
    
    db.commit()
    db.refresh(db_kdm)
    
    detector = RiskDetector(db)
    detector.run_detection()
    
    return db_kdm


@app.post("/schedules/", response_model=ScheduleResponse, tags=["排片管理"])
def create_schedule(schedule: ScheduleCreate, db: Session = Depends(get_db)):
    film = db.query(Film).filter(Film.id == schedule.film_id).first()
    if not film:
        raise HTTPException(status_code=400, detail="指定的影片不存在")
    
    auditorium = db.query(Auditorium).filter(Auditorium.id == schedule.auditorium_id).first()
    if not auditorium:
        raise HTTPException(status_code=400, detail="指定的影厅不存在")
    
    db_schedule = Schedule(**schedule.model_dump())
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    
    detector = RiskDetector(db)
    detector.check_schedule(db_schedule)
    db.commit()
    
    return db_schedule


@app.get("/schedules/", response_model=List[ScheduleResponse], tags=["排片管理"])
def list_schedules(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    auditorium_id: Optional[int] = None,
    status: Optional[ScheduleStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(Schedule)
    
    if start_date:
        query = query.filter(Schedule.show_date >= start_date)
    if end_date:
        query = query.filter(Schedule.show_date <= end_date)
    if auditorium_id:
        query = query.filter(Schedule.auditorium_id == auditorium_id)
    if status:
        query = query.filter(Schedule.status == status)
    
    return query.order_by(Schedule.show_date, Schedule.start_time).offset(skip).limit(limit).all()


@app.get("/schedules/{schedule_id}", response_model=ScheduleResponse, tags=["排片管理"])
def get_schedule(schedule_id: int, db: Session = Depends(get_db)):
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="排片不存在")
    return schedule


@app.put("/schedules/{schedule_id}", response_model=ScheduleResponse, tags=["排片管理"])
def update_schedule(schedule_id: int, schedule: ScheduleUpdate, db: Session = Depends(get_db)):
    db_schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not db_schedule:
        raise HTTPException(status_code=404, detail="排片不存在")
    
    update_data = schedule.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_schedule, key, value)
    
    db.commit()
    db.refresh(db_schedule)
    
    detector = RiskDetector(db)
    detector.check_schedule(db_schedule)
    db.commit()
    
    return db_schedule


@app.post("/schedules/{schedule_id}/reassign", response_model=ScheduleResponse, tags=["排片管理"])
def reassign_schedule(
    schedule_id: int,
    reassign: ScheduleReassign,
    db: Session = Depends(get_db)
):
    db_schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not db_schedule:
        raise HTTPException(status_code=404, detail="排片不存在")
    
    new_auditorium = db.query(Auditorium).filter(
        Auditorium.id == reassign.new_auditorium_id,
        Auditorium.status == AuditoriumStatus.ACTIVE
    ).first()
    if not new_auditorium:
        raise HTTPException(status_code=400, detail="目标影厅不存在或不可用")
    
    db_schedule.original_auditorium_id = db_schedule.auditorium_id
    db_schedule.auditorium_id = reassign.new_auditorium_id
    db_schedule.status = ScheduleStatus.REASSIGNED
    if reassign.notes:
        db_schedule.notes = (db_schedule.notes or "") + f"\n改派备注: {reassign.notes}"
    
    db.commit()
    db.refresh(db_schedule)
    
    detector = RiskDetector(db)
    detector.check_schedule(db_schedule)
    db.commit()
    
    return db_schedule


@app.post("/risk-detection/run", response_model=List[EventResponse], tags=["风险检测"])
def run_risk_detection(
    schedule_ids: Optional[List[int]] = Query(None),
    days: int = Query(7, ge=1, le=30),
    db: Session = Depends(get_db)
):
    detector = RiskDetector(db)
    if schedule_ids:
        events = detector.run_detection(schedule_ids=schedule_ids)
    else:
        events = detector.check_all_upcoming(days=days)
    return events


@app.post("/events/{event_id}/acknowledge", response_model=EventResponse, tags=["事件管理"])
def acknowledge_event(
    event_id: int,
    ack: EventAcknowledge,
    db: Session = Depends(get_db)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="事件不存在")
    
    if event.status == EventStatus.RESOLVED:
        raise HTTPException(status_code=400, detail="事件已解决，无法确认")
    
    event.status = EventStatus.ACKNOWLEDGED
    event.acknowledged_by = ack.acknowledged_by
    event.acknowledged_at = datetime.utcnow()
    
    db.commit()
    db.refresh(event)
    return event


@app.post("/events/{event_id}/resolve", response_model=EventResponse, tags=["事件管理"])
def resolve_event(
    event_id: int,
    resolve: EventResolve,
    db: Session = Depends(get_db)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="事件不存在")
    
    if event.status == EventStatus.RESOLVED:
        raise HTTPException(status_code=400, detail="事件已解决")
    
    event.status = EventStatus.RESOLVED
    event.resolved_by = resolve.resolved_by
    event.resolved_at = datetime.utcnow()
    event.resolution_notes = resolve.resolution_notes
    
    db.commit()
    db.refresh(event)
    return event


@app.get("/events/", response_model=List[EventResponse], tags=["事件管理"])
def list_events(
    status: Optional[EventStatus] = None,
    event_type: Optional[EventType] = None,
    priority: Optional[EventPriority] = None,
    auditorium_id: Optional[int] = None,
    film_id: Optional[int] = None,
    schedule_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(Event)
    
    if status:
        query = query.filter(Event.status == status)
    if event_type:
        query = query.filter(Event.event_type == event_type)
    if priority:
        query = query.filter(Event.priority == priority)
    if auditorium_id:
        query = query.filter(Event.auditorium_id == auditorium_id)
    if film_id:
        query = query.filter(Event.film_id == film_id)
    if schedule_id:
        query = query.filter(Event.schedule_id == schedule_id)
    
    return query.order_by(Event.priority.desc(), Event.detected_at.desc()).offset(skip).limit(limit).all()


@app.get("/events/{event_id}", response_model=EventResponse, tags=["事件管理"])
def get_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="事件不存在")
    return event


@app.get("/risk-summary/daily", response_model=DailyRiskSummary, tags=["风险摘要"])
def get_daily_risk_summary(
    summary_date: Optional[date] = Query(None, description="摘要日期，默认为今天"),
    db: Session = Depends(get_db)
):
    if summary_date is None:
        summary_date = date.today()
    
    start_datetime = datetime.combine(summary_date, datetime.min.time())
    end_datetime = start_datetime + timedelta(days=1)
    
    events = db.query(Event).filter(
        Event.detected_at >= start_datetime,
        Event.detected_at < end_datetime
    ).all()
    
    pending_count = len([e for e in events if e.status == EventStatus.PENDING])
    acknowledged_count = len([e for e in events if e.status == EventStatus.ACKNOWLEDGED])
    resolved_count = len([e for e in events if e.status == EventStatus.RESOLVED])
    
    by_priority = defaultdict(int)
    by_type = defaultdict(lambda: {"count": 0, "priority": EventPriority.LOW})
    
    for event in events:
        by_priority[event.priority] += 1
        by_type[event.event_type]["count"] += 1
        current_priority = EventPriority(event.priority)
        existing_priority = EventPriority(by_type[event.event_type]["priority"])
        
        priority_order = {
            EventPriority.CRITICAL: 4,
            EventPriority.HIGH: 3,
            EventPriority.MEDIUM: 2,
            EventPriority.LOW: 1
        }
        
        if priority_order.get(current_priority, 0) > priority_order.get(existing_priority, 0):
            by_type[event.event_type]["priority"] = event.priority
    
    critical_schedules_query = db.query(Schedule).filter(
        Schedule.show_date == summary_date,
        Schedule.status.in_([ScheduleStatus.SCHEDULED, ScheduleStatus.RUNNING])
    ).join(Event, Event.schedule_id == Schedule.id).filter(
        Event.priority == EventPriority.CRITICAL,
        Event.status != EventStatus.RESOLVED
    ).distinct().all()
    
    priority_order = {
        EventPriority.CRITICAL: 4,
        EventPriority.HIGH: 3,
        EventPriority.MEDIUM: 2,
        EventPriority.LOW: 1
    }
    
    by_type_list = [
        RiskSummaryItem(
            event_type=event_type,
            count=data["count"],
            priority=data["priority"]
        )
        for event_type, data in sorted(
            by_type.items(),
            key=lambda x: -priority_order.get(x[1]["priority"], 0)
        )
    ]
    
    return DailyRiskSummary(
        summary_date=summary_date,
        total_events=len(events),
        pending_events=pending_count,
        acknowledged_events=acknowledged_count,
        resolved_events=resolved_count,
        by_priority=dict(by_priority),
        by_type=by_type_list,
        critical_schedules=critical_schedules_query,
        generated_at=datetime.utcnow()
    )


@app.get("/risk-summary/detection-results", response_model=List[RiskDetectionResult], tags=["风险摘要"])
def get_detection_results(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    if start_date is None:
        start_date = date.today()
    if end_date is None:
        end_date = start_date + timedelta(days=7)
    
    schedules = db.query(Schedule).filter(
        Schedule.show_date >= start_date,
        Schedule.show_date <= end_date,
        Schedule.status.in_([ScheduleStatus.SCHEDULED, ScheduleStatus.RUNNING])
    ).all()
    
    results = []
    
    for schedule in schedules:
        film = db.query(Film).filter(Film.id == schedule.film_id).first()
        auditorium = db.query(Auditorium).filter(Auditorium.id == schedule.auditorium_id).first()
        
        if not film or not auditorium:
            continue
        
        events = db.query(Event).filter(
            Event.schedule_id == schedule.id,
            Event.status != EventStatus.RESOLVED
        ).all()
        
        if events:
            risks = [e.title for e in events]
            
            priority_order = {
                EventPriority.CRITICAL: 4,
                EventPriority.HIGH: 3,
                EventPriority.MEDIUM: 2,
                EventPriority.LOW: 1
            }
            
            max_priority = max(
                events,
                key=lambda e: priority_order.get(e.priority, 0)
            ).priority
            
            show_datetime = datetime.combine(schedule.show_date, schedule.start_time)
            
            results.append(RiskDetectionResult(
                schedule_id=schedule.id,
                film_title=film.title,
                auditorium_name=auditorium.name,
                show_time=show_datetime,
                risks=risks,
                severity=max_priority
            ))
    
    priority_order = {
        EventPriority.CRITICAL: 4,
        EventPriority.HIGH: 3,
        EventPriority.MEDIUM: 2,
        EventPriority.LOW: 1
    }
    
    return sorted(
        results,
        key=lambda x: (-priority_order.get(x.severity, 0), x.show_time)
    )


@app.post("/batch/upload", response_model=BatchUploadResponse, tags=["批量操作"])
def batch_upload(data: BatchUploadRequest, db: Session = Depends(get_db)):
    response = BatchUploadResponse()
    
    for auditorium_data in data.auditoriums:
        existing = db.query(Auditorium).filter(
            or_(Auditorium.name == auditorium_data.name, Auditorium.server_id == auditorium_data.server_id)
        ).first()
        if not existing:
            db_auditorium = Auditorium(**auditorium_data.model_dump())
            db.add(db_auditorium)
            response.auditoriums_created += 1
    
    for film_data in data.films:
        existing = db.query(Film).filter(Film.cpl_id == film_data.cpl_id).first()
        if not existing:
            db_film = Film(**film_data.model_dump())
            db.add(db_film)
            response.films_created += 1
    
    db.commit()
    
    for kdm_data in data.kdms:
        film = db.query(Film).filter(Film.id == kdm_data.film_id).first()
        if film:
            if kdm_data.auditorium_id:
                auditorium = db.query(Auditorium).filter(Auditorium.id == kdm_data.auditorium_id).first()
                if not auditorium:
                    continue
            
            db_kdm = KDM(**kdm_data.model_dump(), cpl_id=film.cpl_id)
            db.add(db_kdm)
            response.kdms_created += 1
    
    db.commit()
    
    for schedule_data in data.schedules:
        film = db.query(Film).filter(Film.id == schedule_data.film_id).first()
        auditorium = db.query(Auditorium).filter(Auditorium.id == schedule_data.auditorium_id).first()
        if film and auditorium:
            db_schedule = Schedule(**schedule_data.model_dump())
            db.add(db_schedule)
            response.schedules_created += 1
    
    db.commit()
    
    if response.schedules_created > 0 or response.kdms_created > 0:
        detector = RiskDetector(db)
        events = detector.check_all_upcoming(days=7)
        response.events_detected = len(events)
    
    return response


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
