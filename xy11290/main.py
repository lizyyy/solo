from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
import models, schemas, crud, import_service
from database import SessionLocal, engine
from datetime import datetime

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="会展物料管理系统",
    description="支持物料导入、调拨、归还、损耗报告的后端系统",
    version="1.0.0"
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
async def root():
    return {
        "message": "会展物料管理系统 API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.post("/api/materials/", response_model=schemas.Material)
def create_material(material: schemas.MaterialCreate, db: Session = Depends(get_db)):
    db_material = crud.get_material_by_code(db, material_code=material.material_code)
    if db_material:
        raise HTTPException(status_code=400, detail="物料编码已存在")
    return crud.create_material(db=db, material=material)


@app.get("/api/materials/", response_model=List[schemas.Material])
def read_materials(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    materials = crud.get_materials(db, skip=skip, limit=limit)
    return materials


@app.get("/api/materials/{material_id}", response_model=schemas.Material)
def read_material(material_id: int, db: Session = Depends(get_db)):
    db_material = crud.get_material(db, material_id=material_id)
    if db_material is None:
        raise HTTPException(status_code=404, detail="物料不存在")
    return db_material


@app.post("/api/import/materials/csv/", response_model=schemas.ImportResult)
async def import_materials_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="请上传CSV文件")
    
    content = await file.read()
    try:
        file_content = content.decode('utf-8')
    except UnicodeDecodeError:
        file_content = content.decode('gbk')
    
    result = import_service.import_materials_from_csv(db, file_content)
    return result


@app.post("/api/booths/", response_model=schemas.Booth)
def create_booth(booth: schemas.BoothCreate, db: Session = Depends(get_db)):
    return crud.create_booth(db=db, booth=booth)


@app.get("/api/booths/", response_model=List[schemas.Booth])
def read_booths(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    booths = crud.get_booths(db, skip=skip, limit=limit)
    return booths


@app.post("/api/allocations/", response_model=schemas.Allocation)
def create_allocation(allocation: schemas.AllocationCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_allocation(db=db, allocation=allocation)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/allocations/", response_model=List[schemas.Allocation])
def read_allocations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    allocations = crud.get_allocations(db, skip=skip, limit=limit)
    return allocations


@app.post("/api/allocations/{allocation_id}/return")
def return_allocation(
    allocation_id: int,
    quantity_returned: int,
    quantity_damaged: int = 0,
    operator: str = None,
    remark: str = None,
    db: Session = Depends(get_db)
):
    try:
        return crud.return_allocation(
            db, allocation_id, quantity_returned, 
            quantity_damaged, operator, remark
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/import/returns/csv/", response_model=schemas.ImportResult)
async def import_returns_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="请上传CSV文件")
    
    content = await file.read()
    try:
        file_content = content.decode('utf-8')
    except UnicodeDecodeError:
        file_content = content.decode('gbk')
    
    result = import_service.import_return_records_from_csv(db, file_content)
    return result


@app.post("/api/transfer-orders/", response_model=schemas.TransferOrder)
def create_transfer_order(order: schemas.TransferOrderCreate, db: Session = Depends(get_db)):
    return crud.create_transfer_order(db=db, order=order)


@app.get("/api/transfer-orders/", response_model=List[schemas.TransferOrder])
def read_transfer_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    orders = crud.get_transfer_orders(db, skip=skip, limit=limit)
    return orders


@app.post("/api/transfer-orders/{order_id}/approve")
def approve_transfer_order(order_id: int, approver: str = None, db: Session = Depends(get_db)):
    try:
        return crud.approve_transfer_order(db, order_id, approver)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/transfer-orders/{order_id}/complete")
def complete_transfer_order(order_id: int, operator: str = None, db: Session = Depends(get_db)):
    try:
        return crud.complete_transfer_order(db, order_id, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/import/transfer-orders/yaml/", response_model=schemas.ImportResult)
async def import_transfer_orders_yaml(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not (file.filename.endswith('.yaml') or file.filename.endswith('.yml')):
        raise HTTPException(status_code=400, detail="请上传YAML文件")
    
    content = await file.read()
    file_content = content.decode('utf-8')
    
    result = import_service.import_transfer_order_from_yaml(db, file_content)
    return result


@app.post("/api/loss-records/", response_model=schemas.LossRecord)
def create_loss_record(loss: schemas.LossRecordCreate, db: Session = Depends(get_db)):
    return crud.create_loss_record(db=db, loss=loss)


@app.get("/api/loss-records/", response_model=List[schemas.LossRecord])
def read_loss_records(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    records = crud.get_loss_records(db, skip=skip, limit=limit)
    return records


@app.get("/api/import-errors/", response_model=List[schemas.ImportErrorRecord])
def read_import_errors(batch_id: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    errors = crud.get_import_errors(db, batch_id=batch_id, skip=skip, limit=limit)
    return errors


@app.get("/api/inventory-logs/", response_model=List[schemas.InventoryLog])
def read_inventory_logs(material_id: int = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    logs = crud.get_inventory_logs(db, material_id=material_id, skip=skip, limit=limit)
    return logs


@app.get("/api/reports/inventory", response_model=List[schemas.MaterialInventoryReport])
def get_inventory_report(db: Session = Depends(get_db)):
    return crud.get_inventory_report(db)


@app.get("/api/reports/loss", response_model=schemas.LossReport)
def get_loss_report(db: Session = Depends(get_db)):
    return crud.get_loss_report(db)


@app.get("/api/reports/general-ledger", response_model=schemas.GeneralLedgerReport)
def get_general_ledger_report(db: Session = Depends(get_db)):
    return crud.get_general_ledger_report(db)


@app.get("/api/reports/booth-allocations", response_model=List[schemas.BoothAllocationItem])
def get_booth_allocations_report(db: Session = Depends(get_db)):
    return crud.get_booth_allocations_report(db)


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
