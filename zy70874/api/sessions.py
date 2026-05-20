from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from sqlalchemy.orm import Session
from typing import List
import pandas as pd
import io
from datetime import datetime

from database import get_db
from models import Session as SessionModel, FilmContract
from schemas import SessionResponse, ImportResponse

router = APIRouter()


@router.post("/import", response_model=ImportResponse)
async def import_sessions(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="仅支持CSV文件")
    
    content = await file.read()
    df = pd.read_csv(io.BytesIO(content))
    
    imported_count = 0
    errors = []
    
    required_columns = ['session_code', 'film_name', 'film_code', 'hall_name', 'show_time']
    for col in required_columns:
        if col not in df.columns:
            errors.append(f"缺少必需列: {col}")
    
    if errors:
        return ImportResponse(success=False, message="文件格式错误", imported_count=0, errors=errors)
    
    for idx, row in df.iterrows():
        try:
            existing = db.query(SessionModel).filter(
                SessionModel.session_code == str(row['session_code'])
            ).first()
            
            if existing:
                errors.append(f"第{idx+2}行: 场次代码 {row['session_code']} 已存在")
                continue
            
            show_time = pd.to_datetime(row['show_time'])
            end_time = pd.to_datetime(row['end_time']) if 'end_time' in df.columns and pd.notna(row['end_time']) else None
            
            is_cross_day = False
            if end_time and show_time and end_time.date() > show_time.date():
                is_cross_day = True
            
            contract = db.query(FilmContract).filter(
                FilmContract.film_code == str(row['film_code']),
                FilmContract.is_active == True
            ).first()
            
            session = SessionModel(
                session_code=str(row['session_code']),
                film_name=str(row['film_name']),
                film_code=str(row['film_code']),
                hall_name=str(row['hall_name']),
                show_time=show_time,
                end_time=end_time,
                is_cross_day=is_cross_day,
                scheduled_seats=int(row['scheduled_seats']) if 'scheduled_seats' in df.columns and pd.notna(row['scheduled_seats']) else 0,
                ticket_price=float(row['ticket_price']) if 'ticket_price' in df.columns and pd.notna(row['ticket_price']) else 0,
                contract_id=contract.id if contract else None,
                source_file=file.filename
            )
            db.add(session)
            imported_count += 1
        except Exception as e:
            errors.append(f"第{idx+2}行: {str(e)}")
    
    db.commit()
    
    return ImportResponse(
        success=True,
        message=f"成功导入 {imported_count} 条场次记录",
        imported_count=imported_count,
        errors=errors
    )


@router.get("/", response_model=List[SessionResponse])
def get_sessions(
    film_code: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(SessionModel)
    if film_code:
        query = query.filter(SessionModel.film_code == film_code)
    return query.offset(skip).limit(limit).all()


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="场次不存在")
    return session
