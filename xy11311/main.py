from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import pandas as pd
import os
from database import engine, get_db, Base
from models import Elderly, MealRecord, MealChangeHistory, RecordStatus, ExceptionType
from schemas import (
    ElderlyCreate, ElderlyResponse, ElderlyUpdate,
    MealRecordCreate, MealRecordResponse, MealRecordUpdate,
    MealChangeHistoryResponse, QueryFilter, MealValidationResult
)
from validator import MealValidator

Base.metadata.create_all(bind=engine)

app = FastAPI(title="社区食堂配餐管理系统", version="1.0.0")


@app.post("/elderly/", response_model=ElderlyResponse, tags=["老人信息"])
def create_elderly(elderly: ElderlyCreate, db: Session = Depends(get_db)):
    db_elderly = Elderly(**elderly.dict())
    db.add(db_elderly)
    db.commit()
    db.refresh(db_elderly)
    return db_elderly


@app.get("/elderly/", response_model=List[ElderlyResponse], tags=["老人信息"])
def get_elderly_list(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Elderly).offset(skip).limit(limit).all()


@app.get("/elderly/{elderly_id}", response_model=ElderlyResponse, tags=["老人信息"])
def get_elderly(elderly_id: int, db: Session = Depends(get_db)):
    elderly = db.query(Elderly).filter(Elderly.id == elderly_id).first()
    if not elderly:
        raise HTTPException(status_code=404, detail="老人信息不存在")
    return elderly


@app.put("/elderly/{elderly_id}", response_model=ElderlyResponse, tags=["老人信息"])
def update_elderly(elderly_id: int, elderly_update: ElderlyUpdate, db: Session = Depends(get_db)):
    elderly = db.query(Elderly).filter(Elderly.id == elderly_id).first()
    if not elderly:
        raise HTTPException(status_code=404, detail="老人信息不存在")
    for key, value in elderly_update.dict(exclude_unset=True).items():
        setattr(elderly, key, value)
    db.commit()
    db.refresh(elderly)
    return elderly


@app.post("/meals/validate", response_model=MealValidationResult, tags=["配餐管理"])
def validate_meal(meal_data: MealRecordCreate, db: Session = Depends(get_db)):
    elderly = db.query(Elderly).filter(Elderly.id == meal_data.elderly_id).first()
    if not elderly:
        raise HTTPException(status_code=404, detail="老人信息不存在")
    return MealValidator.validate_meal(meal_data.menu_items, elderly)


@app.post("/meals/", response_model=MealRecordResponse, tags=["配餐管理"])
def create_meal_record(meal_data: MealRecordCreate, db: Session = Depends(get_db)):
    elderly = db.query(Elderly).filter(Elderly.id == meal_data.elderly_id).first()
    if not elderly:
        raise HTTPException(status_code=404, detail="老人信息不存在")

    validation_result = MealValidator.validate_meal(meal_data.menu_items, elderly)

    meal_record = MealRecord(
        **meal_data.dict(),
        status=validation_result.status,
        exception_type=validation_result.exception_type,
        reason=validation_result.reason
    )
    db.add(meal_record)
    db.commit()
    db.refresh(meal_record)

    response = MealRecordResponse(
        id=meal_record.id,
        elderly_id=meal_record.elderly_id,
        elderly_name=elderly.name,
        meal_date=meal_record.meal_date,
        meal_type=meal_record.meal_type,
        menu_items=meal_record.menu_items,
        status=meal_record.status,
        exception_type=meal_record.exception_type,
        reason=meal_record.reason,
        handled_by=meal_record.handled_by,
        created_at=meal_record.created_at
    )
    return response


@app.put("/meals/{meal_id}", response_model=MealRecordResponse, tags=["配餐管理"])
def update_meal_record(meal_id: int, meal_update: MealRecordUpdate, db: Session = Depends(get_db)):
    meal_record = db.query(MealRecord).filter(MealRecord.id == meal_id).first()
    if not meal_record:
        raise HTTPException(status_code=404, detail="配餐记录不存在")

    elderly = db.query(Elderly).filter(Elderly.id == meal_record.elderly_id).first()

    change_history = MealChangeHistory(
        meal_record_id=meal_id,
        previous_menu=meal_record.menu_items,
        new_menu=meal_update.menu_items,
        changed_by=meal_update.changed_by,
        change_reason=meal_update.change_reason
    )
    db.add(change_history)

    validation_result = MealValidator.validate_meal(meal_update.menu_items, elderly)

    meal_record.menu_items = meal_update.menu_items
    meal_record.status = validation_result.status
    meal_record.exception_type = validation_result.exception_type
    meal_record.reason = validation_result.reason

    db.commit()
    db.refresh(meal_record)

    response = MealRecordResponse(
        id=meal_record.id,
        elderly_id=meal_record.elderly_id,
        elderly_name=elderly.name,
        meal_date=meal_record.meal_date,
        meal_type=meal_record.meal_type,
        menu_items=meal_record.menu_items,
        status=meal_record.status,
        exception_type=meal_record.exception_type,
        reason=meal_record.reason,
        handled_by=meal_record.handled_by,
        created_at=meal_record.created_at
    )
    return response


@app.get("/meals/", response_model=List[MealRecordResponse], tags=["配餐管理"])
def get_meal_records(
    handled_by: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    status: Optional[RecordStatus] = None,
    exception_type: Optional[ExceptionType] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(MealRecord).join(Elderly)

    if handled_by:
        query = query.filter(MealRecord.handled_by == handled_by)
    if start_date:
        query = query.filter(MealRecord.meal_date >= start_date)
    if end_date:
        query = query.filter(MealRecord.meal_date <= end_date)
    if status:
        query = query.filter(MealRecord.status == status)
    if exception_type:
        query = query.filter(MealRecord.exception_type == exception_type)

    records = query.order_by(MealRecord.meal_date.desc()).offset(skip).limit(limit).all()

    response_list = []
    for record in records:
        elderly = db.query(Elderly).filter(Elderly.id == record.elderly_id).first()
        response_list.append(MealRecordResponse(
            id=record.id,
            elderly_id=record.elderly_id,
            elderly_name=elderly.name if elderly else "",
            meal_date=record.meal_date,
            meal_type=record.meal_type,
            menu_items=record.menu_items,
            status=record.status,
            exception_type=record.exception_type,
            reason=record.reason,
            handled_by=record.handled_by,
            created_at=record.created_at
        ))

    return response_list


@app.get("/meals/{meal_id}", response_model=MealRecordResponse, tags=["配餐管理"])
def get_meal_record(meal_id: int, db: Session = Depends(get_db)):
    meal_record = db.query(MealRecord).filter(MealRecord.id == meal_id).first()
    if not meal_record:
        raise HTTPException(status_code=404, detail="配餐记录不存在")

    elderly = db.query(Elderly).filter(Elderly.id == meal_record.elderly_id).first()

    return MealRecordResponse(
        id=meal_record.id,
        elderly_id=meal_record.elderly_id,
        elderly_name=elderly.name if elderly else "",
        meal_date=meal_record.meal_date,
        meal_type=meal_record.meal_type,
        menu_items=meal_record.menu_items,
        status=meal_record.status,
        exception_type=meal_record.exception_type,
        reason=meal_record.reason,
        handled_by=meal_record.handled_by,
        created_at=meal_record.created_at
    )


@app.get("/meals/{meal_id}/history", response_model=List[MealChangeHistoryResponse], tags=["配餐管理"])
def get_meal_change_history(meal_id: int, db: Session = Depends(get_db)):
    return db.query(MealChangeHistory).filter(MealChangeHistory.meal_record_id == meal_id).order_by(MealChangeHistory.created_at.desc()).all()


@app.get("/export/meals", tags=["导出报告"])
def export_meal_records(
    handled_by: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    status: Optional[RecordStatus] = None,
    exception_type: Optional[ExceptionType] = None,
    db: Session = Depends(get_db)
):
    query = db.query(MealRecord).join(Elderly)

    if handled_by:
        query = query.filter(MealRecord.handled_by == handled_by)
    if start_date:
        query = query.filter(MealRecord.meal_date >= start_date)
    if end_date:
        query = query.filter(MealRecord.meal_date <= end_date)
    if status:
        query = query.filter(MealRecord.status == status)
    if exception_type:
        query = query.filter(MealRecord.exception_type == exception_type)

    records = query.order_by(MealRecord.meal_date.desc()).all()

    data = []
    for record in records:
        elderly = db.query(Elderly).filter(Elderly.id == record.elderly_id).first()
        data.append({
            "记录ID": record.id,
            "老人姓名": elderly.name if elderly else "",
            "房间号": elderly.room_number if elderly else "",
            "配送路线": elderly.delivery_route if elderly else "",
            "配餐日期": record.meal_date.strftime("%Y-%m-%d"),
            "餐次": record.meal_type,
            "菜单": record.menu_items,
            "状态": record.status,
            "异常类型": record.exception_type,
            "原因": record.reason,
            "操作人": record.handled_by,
            "创建时间": record.created_at.strftime("%Y-%m-%d %H:%M:%S")
        })

    df = pd.DataFrame(data)
    export_path = "配餐记录报告.xlsx"
    df.to_excel(export_path, index=False, engine="openpyxl")

    return FileResponse(
        export_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=export_path
    )


@app.get("/", tags=["系统"])
def root():
    return {"message": "社区食堂配餐管理系统", "version": "1.0.0", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
