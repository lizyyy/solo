#!/usr/bin/env python3
# -*- coding: utf-8 -*-

content = r"""from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import engine, get_db, Base
from app.models import MaintenanceWindow

Base.metadata.create_all(bind=engine)

app = FastAPI(title='铁路天窗维修 API')

@app.get('/')
def root():
    return {'message': '铁路天窗维修 API 服务已启动'}

@app.get('/health')
def health_check():
    return {'status': 'healthy', 'timestamp': datetime.now().isoformat()}

def check_time_overlap(start1, end1, start2, end2):
    return start1 < end2 and start2 < end1

def detect_conflicts(window, db):
    conflicts = []
    existing = db.query(MaintenanceWindow).filter(
        MaintenanceWindow.id != window.id,
        MaintenanceWindow.status.in_(['pending', 'reviewing', 'approved'])
    ).all()
    for w in existing:
        if check_time_overlap(window.start_time, window.end_time, w.start_time, w.end_time):
            if window.line_section == w.line_section:
                conflicts.append({
                    'type': 'time_overlap',
                    'conflict_with': w.request_id,
                    'description': '时间重叠且线路区间相同'
                })
    return conflicts

@app.post('/windows/')
def create_window(
    request_id: str,
    line_section: str,
    start_time: datetime,
    end_time: datetime,
    work_summary: str = None,
    applicant: str = None,
    db: Session = Depends(get_db)
):
    existing = db.query(MaintenanceWindow).filter(
        MaintenanceWindow.request_id == request_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail='申请编号已存在')
    is_cross = start_time.date() != end_time.date()
    window = MaintenanceWindow(
        request_id=request_id, line_section=line_section,
        start_time=start_time, end_time=end_time,
        is_cross_day=is_cross, work_summary=work_summary,
        applicant=applicant, status='pending'
    )
    db.add(window)
    db.commit()
    db.refresh(window)
    return {'id': window.id, 'request_id': request_id, 'status': window.status, 'is_cross_day': is_cross}

@app.get('/windows/')
def list_windows(
    status: str = None, skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(MaintenanceWindow)
    if status:
        query = query.filter(MaintenanceWindow.status == status)
    windows = query.offset(skip).limit(limit).all()
    return [{'id': w.id, 'request_id': w.request_id, 'status': w.status,
             'line_section': w.line_section} for w in windows]

@app.get('/windows/{window_id}')
def get_window(window_id: int, db: Session = Depends(get_db)):
    window = db.query(MaintenanceWindow).filter(
        MaintenanceWindow.id == window_id
    ).first()
    if not window:
        raise HTTPException(status_code=404, detail='天窗记录不存在')
    return {'id': window.id, 'request_id': window.request_id,
            'status': window.status, 'line_section': window.line_section,
            'is_cross_day': window.is_cross_day}

@app.post('/windows/{window_id}/validate')
def validate_window(window_id: int, db: Session = Depends(get_db)):
    window = db.query(MaintenanceWindow).filter(
        MaintenanceWindow.id == window_id
    ).first()
    if not window:
        raise HTTPException(status_code=404, detail='天窗记录不存在')
    conflicts = detect_conflicts(window, db)
    if conflicts:
        window.status = 'conflict'
        db.commit()
        return {'window_id': window.id, 'status': 'conflict', 'conflicts': conflicts}
    else:
        window.status = 'reviewing'
        db.commit()
        return {'window_id': window.id, 'status': 'reviewing', 'conflicts': []}

@app.post('/windows/{window_id}/approve')
def approve_window(
    window_id: int, processor: str,
    db: Session = Depends(get_db)
):
    window = db.query(MaintenanceWindow).filter(
        MaintenanceWindow.id == window_id
    ).first()
    if not window:
        raise HTTPException(status_code=404, detail='天窗记录不存在')
    window.status = 'approved'
    db.commit()
    return {'window_id': window.id, 'status': 'approved', 'message': '已批准'}

@app.post('/windows/{window_id}/close')
def close_window(
    window_id: int, conclusion: str,
    db: Session = Depends(get_db)
):
    window = db.query(MaintenanceWindow).filter(
        MaintenanceWindow.id == window_id
    ).first()
    if not window:
        raise HTTPException(status_code=404, detail='天窗记录不存在')
    window.status = 'closed'
    window.final_conclusion = conclusion
    window.closed_at = datetime.now()
    db.commit()
    return {'window_id': window.id, 'status': 'closed', 'message': '已结案'}

@app.get('/export')
def export_windows(db: Session = Depends(get_db)):
    windows = db.query(MaintenanceWindow).all()
    data = []
    for w in windows:
        data.append({
            '申请编号': w.request_id,
            '线路区间': w.line_section,
            '状态': w.status,
            '是否跨日': '是' if w.is_cross_day else '否'
        })
    return {'count': len(data), 'data': data}
"""

with open('main.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('main.py created successfully')
