from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional

import models
import schemas
import crud
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="实验室试剂管理系统", version="1.0.0")


@app.post("/reagents/", response_model=schemas.Reagent)
def create_reagent(reagent: schemas.ReagentCreate, db: Session = Depends(get_db)):
    return crud.create_reagent(db=db, reagent=reagent)


@app.get("/reagents/", response_model=list[schemas.Reagent])
def read_reagents(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_reagents(db=db, skip=skip, limit=limit)


@app.get("/reagents/{reagent_id}", response_model=schemas.Reagent)
def read_reagent(reagent_id: int, db: Session = Depends(get_db)):
    db_reagent = crud.get_reagent(db=db, reagent_id=reagent_id)
    if db_reagent is None:
        raise HTTPException(status_code=404, detail="试剂不存在")
    return db_reagent


@app.post("/inventory/")
def add_inventory(inventory: schemas.InventoryCreate, db: Session = Depends(get_db)):
    result, msg = crud.add_inventory(db=db, inventory=inventory)
    if result is None:
        raise HTTPException(status_code=400, detail=msg)
    return {"data": result, "message": msg}


@app.get("/inventory/summary")
def get_inventory_summary(db: Session = Depends(get_db)):
    return crud.get_inventory_summary(db=db)


@app.post("/applications/")
def create_application(
    application: schemas.ApplicationCreate,
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    result, msg, is_new = crud.create_application(
        db=db, application=application, idempotency_key=x_idempotency_key
    )
    if result is None:
        raise HTTPException(status_code=400, detail=msg)
    return {"data": result, "message": msg, "is_new": is_new}


@app.get("/applications/", response_model=list[schemas.Application])
def read_applications(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_applications(db=db, skip=skip, limit=limit)


@app.get("/applications/{application_id}", response_model=schemas.Application)
def read_application(application_id: int, db: Session = Depends(get_db)):
    db_application = crud.get_application(db=db, application_id=application_id)
    if db_application is None:
        raise HTTPException(status_code=404, detail="申请不存在")
    return db_application


@app.post("/approvals/")
def process_approval(approval: schemas.ApprovalCreate, db: Session = Depends(get_db)):
    result, msg = crud.process_approval(db=db, approval=approval)
    if result is None:
        raise HTTPException(status_code=400, detail=msg)
    return {"data": result, "message": msg}


@app.post("/applications/{application_id}/resubmit")
def resubmit_application(
    application_id: int,
    resubmit_data: schemas.ApplicationResubmit,
    db: Session = Depends(get_db)
):
    result, msg = crud.resubmit_application(
        db=db, application_id=application_id, resubmit_data=resubmit_data
    )
    if result is None:
        raise HTTPException(status_code=400, detail=msg)
    return {"data": result, "message": msg}


@app.post("/stock-out/")
def stock_out(stock_out_data: schemas.StockOut, db: Session = Depends(get_db)):
    result, msg = crud.stock_out(db=db, stock_out_data=stock_out_data)
    if result is None:
        raise HTTPException(status_code=400, detail=msg)
    return {"data": result, "message": msg}


@app.post("/stock-return/")
def stock_return(return_data: schemas.StockReturn, db: Session = Depends(get_db)):
    result, msg = crud.stock_return(db=db, return_data=return_data)
    if result is None:
        raise HTTPException(status_code=400, detail=msg)
    return {"data": result, "message": msg}


@app.post("/inventory-check/")
def inventory_check(check_data: schemas.InventoryCheck, db: Session = Depends(get_db)):
    result, msg = crud.inventory_check(db=db, check_data=check_data)
    if result is None:
        raise HTTPException(status_code=400, detail=msg)
    return {"data": result, "message": msg}


@app.get("/operation-logs/", response_model=list[schemas.OperationLog])
def read_operation_logs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_operation_logs(db=db, skip=skip, limit=limit)


@app.get("/export/")
def export_all_data(db: Session = Depends(get_db)):
    data = crud.export_all_data(db=db)
    return JSONResponse(content=data)


@app.get("/")
def root():
    return {
        "message": "实验室试剂管理系统 API",
        "docs": "/docs",
        "features": [
            "危险品双人审批",
            "库存防负数校验",
            "驳回重新提交",
            "操作审计日志",
            "幂等性支持",
            "数据导出"
        ]
    }
