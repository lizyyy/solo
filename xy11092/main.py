from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import json

from app.database import engine, get_db, Base
from app import models, schemas, crud

Base.metadata.create_all(bind=engine)

app = FastAPI(title="舞台灯光租赁店灯光设备套装 API")


@app.post("/lighting-sets/", response_model=schemas.LightingSet)
def create_lighting_set(lighting_set: schemas.LightingSetCreate, db: Session = Depends(get_db)):
    db_set = crud.get_lighting_set_by_code(db, set_code=lighting_set.set_code)
    if db_set:
        raise HTTPException(status_code=400, detail="套装编号已存在")
    return crud.create_lighting_set(db=db, lighting_set=lighting_set)


@app.get("/lighting-sets/", response_model=List[schemas.LightingSet])
def read_lighting_sets(
    set_code: Optional[str] = None,
    set_name: Optional[str] = None,
    store: Optional[str] = None,
    responsible_person: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    customer_name: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = schemas.LightingSetQuery(
        set_code=set_code,
        set_name=set_name,
        store=store,
        responsible_person=responsible_person,
        status=status,
        start_date=start_date,
        end_date=end_date,
        customer_name=customer_name
    )
    lighting_sets = crud.get_lighting_sets(db, query=query, skip=skip, limit=limit)
    return lighting_sets


@app.get("/lighting-sets/{lighting_set_id}", response_model=schemas.LightingSet)
def read_lighting_set(lighting_set_id: int, db: Session = Depends(get_db)):
    db_set = crud.get_lighting_set(db, lighting_set_id=lighting_set_id)
    if db_set is None:
        raise HTTPException(status_code=404, detail="套装不存在")
    return db_set


@app.put("/lighting-sets/{lighting_set_id}", response_model=schemas.LightingSet)
def update_lighting_set(
    lighting_set_id: int,
    lighting_set_update: schemas.LightingSetUpdate,
    db: Session = Depends(get_db)
):
    db_set = crud.update_lighting_set(db, lighting_set_id, lighting_set_update)
    if db_set is None:
        raise HTTPException(status_code=404, detail="套装不存在")
    return db_set


@app.delete("/lighting-sets/{lighting_set_id}")
def delete_lighting_set(lighting_set_id: int, db: Session = Depends(get_db)):
    success = crud.delete_lighting_set(db, lighting_set_id)
    if not success:
        raise HTTPException(status_code=404, detail="套装不存在")
    return {"message": "删除成功"}


@app.post("/lighting-sets/batch-import/", response_model=schemas.BatchImportResult)
def batch_import_lighting_sets(lighting_sets: List[schemas.LightingSetCreate], db: Session = Depends(get_db)):
    return crud.batch_import_lighting_sets(db, lighting_sets)


@app.get("/lighting-sets/export/json")
def export_lighting_sets_json(
    set_code: Optional[str] = None,
    set_name: Optional[str] = None,
    store: Optional[str] = None,
    responsible_person: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    customer_name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = schemas.LightingSetQuery(
        set_code=set_code,
        set_name=set_name,
        store=store,
        responsible_person=responsible_person,
        status=status,
        start_date=start_date,
        end_date=end_date,
        customer_name=customer_name
    )
    lighting_sets = crud.get_lighting_sets(db, query=query)
    result = [schemas.LightingSet.model_validate(ls).model_dump() for ls in lighting_sets]
    for item in result:
        item["created_date"] = item["created_date"].isoformat() if item["created_date"] else None
        item["last_updated"] = item["last_updated"].isoformat() if item["last_updated"] else None
        item["expected_return_date"] = item["expected_return_date"].isoformat() if item["expected_return_date"] else None
        item["actual_return_date"] = item["actual_return_date"].isoformat() if item["actual_return_date"] else None
    return JSONResponse(content=result)


@app.put("/lighting-sets/{lighting_set_id}/return")
def return_lighting_set(
    lighting_set_id: int,
    actual_return_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    result = crud.return_lighting_set(db, lighting_set_id, actual_return_date)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result
