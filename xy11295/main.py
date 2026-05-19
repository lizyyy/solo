from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
import os
from datetime import datetime

import models, schemas, crud
from database import engine, get_db
from importers.material_importer import import_materials_from_csv
from importers.transfer_importer import import_transfers_from_yaml, import_booths_from_yaml
from importers.return_importer import import_returns_from_csv
from exporter import export_transfer_orders, export_materials

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="会展物料管理系统", description="用于管理会展期间桁架、灯具、屏幕等物料的借还", version="1.0.0")

UPLOAD_DIR = "uploads"
EXPORT_DIR = "exports"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)


@app.post("/api/import/materials", response_model=schemas.ImportResult, summary="导入物料表CSV")
async def upload_materials(file: UploadFile = File(...), db: Session = Depends(get_db)):
    file_path = os.path.join(UPLOAD_DIR, f"material_{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}")
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
    
    success, failed, errors = import_materials_from_csv(db, file_path, file.filename)
    return {"success": success, "failed": failed, "total": success + failed, "errors": errors}


@app.post("/api/import/booths", response_model=schemas.ImportResult, summary="导入展位YAML")
async def upload_booths(file: UploadFile = File(...), db: Session = Depends(get_db)):
    file_path = os.path.join(UPLOAD_DIR, f"booth_{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}")
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
    
    success, failed, errors = import_booths_from_yaml(db, file_path, file.filename)
    return {"success": success, "failed": failed, "total": success + failed, "errors": errors}


@app.post("/api/import/transfers", response_model=schemas.ImportResult, summary="导入调拨单YAML")
async def upload_transfers(file: UploadFile = File(...), db: Session = Depends(get_db)):
    file_path = os.path.join(UPLOAD_DIR, f"transfer_{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}")
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
    
    success, failed, errors = import_transfers_from_yaml(db, file_path, file.filename)
    return {"success": success, "failed": failed, "total": success + failed, "errors": errors}


@app.post("/api/import/returns", response_model=schemas.ImportResult, summary="导入归还记录CSV")
async def upload_returns(file: UploadFile = File(...), db: Session = Depends(get_db)):
    file_path = os.path.join(UPLOAD_DIR, f"return_{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}")
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
    
    success, failed, errors = import_returns_from_csv(db, file_path, file.filename)
    return {"success": success, "failed": failed, "total": success + failed, "errors": errors}


@app.get("/api/transfers", response_model=schemas.TransferListResponse, summary="查询调拨记录")
def get_transfers(
    borrower: Optional[str] = None,
    manager: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    status: Optional[models.TransferStatus] = None,
    exception_type: Optional[models.ExceptionType] = None,
    booth_code: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    query = schemas.TransferQuery(
        borrower=borrower,
        manager=manager,
        start_time=start_time,
        end_time=end_time,
        status=status,
        exception_type=exception_type,
        booth_code=booth_code
    )
    
    total, items = crud.query_transfer_orders(db, query, page, page_size)
    summary = crud.get_transfer_summary(db, query)
    
    return {"total": total, "items": items, "summary": summary}


@app.get("/api/transfers/export", summary="导出调拨记录")
def export_transfers(
    borrower: Optional[str] = None,
    manager: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    status: Optional[models.TransferStatus] = None,
    exception_type: Optional[models.ExceptionType] = None,
    booth_code: Optional[str] = None,
    format: str = Query("xlsx", enum=["xlsx", "csv"]),
    db: Session = Depends(get_db)
):
    query = schemas.TransferQuery(
        borrower=borrower,
        manager=manager,
        start_time=start_time,
        end_time=end_time,
        status=status,
        exception_type=exception_type,
        booth_code=booth_code
    )
    
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    file_name = f"transfer_export_{timestamp}.{format}"
    file_path = os.path.join(EXPORT_DIR, file_name)
    
    export_transfer_orders(db, query, file_path, format)
    
    return FileResponse(
        path=file_path,
        filename=file_name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if format == "xlsx" else "text/csv"
    )


@app.post("/api/transfers", response_model=schemas.TransferOrder, summary="创建调拨单")
def create_transfer(transfer: schemas.TransferOrderCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_transfer_order(db, transfer)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/returns", response_model=schemas.ReturnRecord, summary="创建归还记录")
def create_return(return_record: schemas.ReturnRecordCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_return_record(db, return_record)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/materials", summary="获取所有物料")
def get_materials(db: Session = Depends(get_db)):
    return crud.get_all_materials(db)


@app.get("/api/booths", summary="获取所有展位")
def get_booths(db: Session = Depends(get_db)):
    return crud.get_all_booths(db)


@app.get("/api/import/errors", summary="获取导入错误日志")
def get_import_errors(import_type: Optional[str] = None, resolved: Optional[int] = None, db: Session = Depends(get_db)):
    return crud.get_import_errors(db, import_type, resolved)


@app.get("/api/materials/export", summary="导出物料表")
def export_material_list(format: str = Query("xlsx", enum=["xlsx", "csv"]), db: Session = Depends(get_db)):
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    file_name = f"material_export_{timestamp}.{format}"
    file_path = os.path.join(EXPORT_DIR, file_name)
    
    export_materials(db, file_path, format)
    
    return FileResponse(
        path=file_path,
        filename=file_name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if format == "xlsx" else "text/csv"
    )


@app.get("/", summary="系统状态")
def root():
    return {
        "message": "会展物料管理系统已启动",
        "docs": "/docs",
        "api_docs": "/redoc"
    }
