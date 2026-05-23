from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import models
import schemas
import crud
from database import engine, get_db
from models import BatchStatus, ClothingStatus

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="回收衣物分拣 API",
    description="公益衣物回收分拣管理系统，支持批次追踪、分类管理、消毒记录、转赠管理、异常处理、报告导出",
    version="1.0.0"
)


@app.get("/", tags=["系统"])
async def root():
    return {"message": "回收衣物分拣 API 服务已启动", "version": "1.0.0"}


@app.post("/api/batches/", response_model=schemas.DonationBatch, tags=["批次管理"])
def create_batch(batch: schemas.DonationBatchCreate, db: Session = Depends(get_db)):
    return crud.create_donation_batch(db=db, batch=batch)


@app.get("/api/batches/", response_model=List[schemas.DonationBatch], tags=["批次管理"])
def read_batches(skip: int = 0, limit: int = 100, status: Optional[str] = None, db: Session = Depends(get_db)):
    return crud.get_donation_batches(db, skip=skip, limit=limit, status=status)


@app.get("/api/batches/{batch_id}", tags=["批次管理"])
def read_batch(batch_id: int, db: Session = Depends(get_db)):
    db_batch = crud.get_donation_batch(db, batch_id=batch_id)
    if db_batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    stats = crud.get_batch_statistics(db, batch_id=batch_id)
    return {"batch": db_batch, "statistics": stats}


@app.get("/api/batches/no/{batch_no}", response_model=schemas.DonationBatch, tags=["批次管理"])
def read_batch_by_no(batch_no: str, db: Session = Depends(get_db)):
    db_batch = crud.get_donation_batch_by_no(db, batch_no=batch_no)
    if db_batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    return db_batch


@app.put("/api/batches/{batch_id}/status", response_model=schemas.DonationBatch, tags=["批次管理"])
def update_batch_status(batch_id: int, request: schemas.StatusTransitionRequest, db: Session = Depends(get_db)):
    db_batch = crud.update_batch_status(
        db, batch_id=batch_id, target_status=request.target_status,
        operator=request.operator, reason=request.reason
    )
    if db_batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    return db_batch


@app.post("/api/clothing/", response_model=schemas.ClothingItem, tags=["衣物管理"])
def create_clothing_item(item: schemas.ClothingItemCreate, db: Session = Depends(get_db)):
    return crud.create_clothing_item(db=db, item=item)


@app.get("/api/clothing/", response_model=List[schemas.ClothingItem], tags=["衣物管理"])
def read_clothing_items(
    skip: int = 0, limit: int = 100, batch_id: Optional[int] = None,
    status: Optional[str] = None, db: Session = Depends(get_db)
):
    return crud.get_clothing_items(db, skip=skip, limit=limit, batch_id=batch_id, status=status)


@app.get("/api/clothing/{item_id}", tags=["衣物管理"])
def read_clothing_item(item_id: int, db: Session = Depends(get_db)):
    db_item = crud.get_clothing_item(db, item_id=item_id)
    if db_item is None:
        raise HTTPException(status_code=404, detail="衣物不存在")
    related = {
        "sterilization_records": db_item.sterilization_records,
        "donation_records": db_item.donation_records,
        "rejection_records": db_item.rejection_records,
        "status_history": db_item.status_history
    }
    return {"item": db_item, "related_records": related}


@app.put("/api/clothing/{item_id}", response_model=schemas.ClothingItem, tags=["衣物管理"])
def update_clothing_item(item_id: int, item_update: schemas.ClothingItemUpdate, db: Session = Depends(get_db)):
    db_item = crud.update_clothing_item(db, item_id=item_id, item_update=item_update)
    if db_item is None:
        raise HTTPException(status_code=404, detail="衣物不存在")
    return db_item


@app.put("/api/clothing/{item_id}/status", response_model=schemas.ClothingItem, tags=["衣物管理"])
def transition_clothing_status(item_id: int, request: schemas.StatusTransitionRequest, db: Session = Depends(get_db)):
    db_item = crud.transition_clothing_status(
        db, item_id=item_id, target_status=request.target_status,
        operator=request.operator, reason=request.reason
    )
    if db_item is None:
        raise HTTPException(status_code=404, detail="衣物不存在")
    return db_item


@app.post("/api/sterilization/", response_model=schemas.SterilizationRecord, tags=["消毒管理"])
def create_sterilization_record(record: schemas.SterilizationRecordCreate, db: Session = Depends(get_db)):
    return crud.create_sterilization_record(db=db, record=record)


@app.post("/api/donation/", response_model=schemas.DonationRecord, tags=["转赠管理"])
def create_donation_record(record: schemas.DonationRecordCreate, db: Session = Depends(get_db)):
    return crud.create_donation_record(db=db, record=record)


@app.post("/api/rejection/", response_model=schemas.RejectionRecord, tags=["淘汰管理"])
def create_rejection_record(record: schemas.RejectionRecordCreate, db: Session = Depends(get_db)):
    return crud.create_rejection_record(db=db, record=record)


@app.get("/api/categories/", response_model=List[schemas.ClothingCategory], tags=["基础数据"])
def read_categories(db: Session = Depends(get_db)):
    return crud.get_clothing_categories(db)


@app.post("/api/categories/", response_model=schemas.ClothingCategory, tags=["基础数据"])
def create_category(category: schemas.ClothingCategoryCreate, db: Session = Depends(get_db)):
    return crud.create_clothing_category(db=db, category=category)


@app.get("/api/organizations/", response_model=List[schemas.DonationOrganization], tags=["基础数据"])
def read_organizations(db: Session = Depends(get_db)):
    return crud.get_donation_organizations(db)


@app.post("/api/organizations/", response_model=schemas.DonationOrganization, tags=["基础数据"])
def create_organization(org: schemas.DonationOrganizationCreate, db: Session = Depends(get_db)):
    return crud.create_donation_organization(db=db, org=org)


@app.get("/api/rejection-reasons/", response_model=List[schemas.RejectionReason], tags=["基础数据"])
def read_rejection_reasons(db: Session = Depends(get_db)):
    return crud.get_rejection_reasons(db)


@app.post("/api/rejection-reasons/", response_model=schemas.RejectionReason, tags=["基础数据"])
def create_rejection_reason(reason: schemas.RejectionReasonCreate, db: Session = Depends(get_db)):
    return crud.create_rejection_reason(db=db, reason=reason)


@app.post("/api/exceptions/", response_model=schemas.ProcessingException, tags=["异常处理"])
def create_exception(exception: schemas.ProcessingExceptionCreate, db: Session = Depends(get_db)):
    return crud.create_processing_exception(db=db, exception=exception)


@app.get("/api/exceptions/", response_model=List[schemas.ProcessingException], tags=["异常处理"])
def read_exceptions(skip: int = 0, limit: int = 100, resolved: Optional[int] = None, db: Session = Depends(get_db)):
    return crud.get_processing_exceptions(db, skip=skip, limit=limit, resolved=resolved)


@app.put("/api/exceptions/{exception_id}/resolve", response_model=schemas.ProcessingException, tags=["异常处理"])
def resolve_exception(exception_id: int, resolve_data: schemas.ProcessingExceptionResolve, db: Session = Depends(get_db)):
    db_exception = crud.resolve_processing_exception(db, exception_id=exception_id, resolve_data=resolve_data)
    if db_exception is None:
        raise HTTPException(status_code=404, detail="异常记录不存在")
    return db_exception


@app.post("/api/reports/", response_model=schemas.SortingReport, tags=["报告管理"])
def generate_report(batch_id: int, operator: Optional[str] = None, summary: Optional[str] = None, db: Session = Depends(get_db)):
    db_report = crud.generate_sorting_report(db, batch_id=batch_id, operator=operator, summary=summary)
    if db_report is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    return db_report


@app.get("/api/reports/", response_model=List[schemas.SortingReport], tags=["报告管理"])
def read_reports(skip: int = 0, limit: int = 100, batch_id: Optional[int] = None, db: Session = Depends(get_db)):
    return crud.get_sorting_reports(db, skip=skip, limit=limit, batch_id=batch_id)


@app.get("/api/export/{batch_id}", tags=["数据导出"])
def export_batch(batch_id: int, db: Session = Depends(get_db)):
    export_data = crud.export_batch_data(db, batch_id=batch_id)
    if export_data is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    return JSONResponse(content=export_data)


@app.get("/api/status/batch-statuses", tags=["状态枚举"])
def get_batch_statuses():
    return {status.name: status.value for status in BatchStatus}


@app.get("/api/status/clothing-statuses", tags=["状态枚举"])
def get_clothing_statuses():
    return {status.name: status.value for status in ClothingStatus}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
