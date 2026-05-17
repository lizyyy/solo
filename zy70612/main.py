from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List

import crud
import schemas
from database import engine, Base, get_db, VersionStatus

Base.metadata.create_all(bind=engine)

app = FastAPI(title="价签版本促销到期门店确认API", version="1.0.0")


@app.post("/api/v1/stores/", response_model=schemas.Store, tags=["门店管理"])
def create_store(store: schemas.StoreCreate, db: Session = Depends(get_db)):
    return crud.create_store(db=db, store=store)


@app.get("/api/v1/stores/", response_model=List[schemas.Store], tags=["门店管理"])
def read_stores(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    stores = crud.get_stores(db, skip=skip, limit=limit)
    return stores


@app.get("/api/v1/stores/{store_id}", response_model=schemas.Store, tags=["门店管理"])
def read_store(store_id: int, db: Session = Depends(get_db)):
    db_store = crud.get_store(db, store_id=store_id)
    if db_store is None:
        raise HTTPException(status_code=404, detail="Store not found")
    return db_store


@app.post("/api/v1/price-tag-versions/", response_model=schemas.PriceTagVersion, tags=["价签版本"])
def create_price_tag_version(
    version: schemas.PriceTagVersionCreate,
    db: Session = Depends(get_db)
):
    db_version = crud.get_price_tag_version_by_code(db, version_code=version.version_code)
    if db_version:
        raise HTTPException(status_code=400, detail="Version code already exists")
    return crud.create_price_tag_version(db=db, version=version)


@app.get("/api/v1/price-tag-versions/", response_model=List[schemas.PriceTagVersion], tags=["价签版本"])
def read_price_tag_versions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    versions = crud.get_price_tag_versions(db, skip=skip, limit=limit)
    return versions


@app.get("/api/v1/price-tag-versions/{version_id}", response_model=schemas.PriceTagVersion, tags=["价签版本"])
def read_price_tag_version(version_id: int, db: Session = Depends(get_db)):
    db_version = crud.get_price_tag_version(db, version_id=version_id)
    if db_version is None:
        raise HTTPException(status_code=404, detail="Version not found")
    return db_version


@app.patch("/api/v1/price-tag-versions/{version_id}/status", response_model=schemas.PriceTagVersion, tags=["价签版本"])
def update_version_status(
    version_id: int,
    status_update: schemas.PriceTagVersionUpdateStatus,
    db: Session = Depends(get_db)
):
    db_version = crud.update_version_status(
        db,
        version_id=version_id,
        status=status_update.status,
        changed_by=status_update.changed_by,
        change_reason=status_update.change_reason
    )
    if db_version is None:
        raise HTTPException(status_code=404, detail="Version not found")
    return db_version


@app.get("/api/v1/price-tag-versions/{version_id}/status-history", response_model=List[schemas.VersionStatusHistory], tags=["价签版本"])
def get_version_status_history(version_id: int, db: Session = Depends(get_db)):
    db_version = crud.get_price_tag_version(db, version_id=version_id)
    if db_version is None:
        raise HTTPException(status_code=404, detail="Version not found")
    return crud.get_version_status_history(db, version_id=version_id)


@app.post("/api/v1/price-tag-versions/{version_id}/check-expiry", tags=["促销到期检查"])
def check_single_version_expiry(
    version_id: int,
    checked_by: str,
    db: Session = Depends(get_db)
):
    db_version = crud.get_price_tag_version(db, version_id=version_id)
    if db_version is None:
        raise HTTPException(status_code=404, detail="Version not found")
    
    created_discrepancies, status_updated = crud.check_promotion_expiry(
        db,
        version_id=version_id,
        checked_by=checked_by
    )
    
    summary = crud.get_version_status_summary(db, version_id=version_id)
    return {
        "version_id": version_id,
        "version_code": db_version.version_code,
        "name": db_version.name,
        "promotion_end": db_version.promotion_end,
        "total_stores": summary.total_stores if summary else 0,
        "pending_stores": summary.pending_stores if summary else 0,
        "created_discrepancies": created_discrepancies,
        "status_updated": status_updated,
        "checked_at": datetime.utcnow()
    }


@app.post("/api/v1/check-expired-promotions", response_model=List[schemas.ExpiryCheckResult], tags=["促销到期检查"])
def check_all_expired_promotions(
    checked_by: str,
    db: Session = Depends(get_db)
):
    return crud.check_all_expired_promotions(db, checked_by=checked_by)


@app.post("/api/v1/price-tag-versions/{version_id}/close", response_model=schemas.PriceTagVersion, tags=["价签版本"])
def close_version(
    version_id: int,
    close_request: schemas.VersionCloseRequest,
    db: Session = Depends(get_db)
):
    db_version = crud.close_version(
        db,
        version_id=version_id,
        closed_by=close_request.closed_by,
        notes=close_request.notes
    )
    if db_version is None:
        raise HTTPException(status_code=404, detail="Version not found")
    return db_version


@app.post("/api/v1/price-tag-versions/{version_id}/items", response_model=schemas.PriceTagItem, tags=["价签版本"])
def add_item_to_version(
    version_id: int,
    item: schemas.PriceTagItemCreate,
    db: Session = Depends(get_db)
):
    db_version = crud.get_price_tag_version(db, version_id=version_id)
    if db_version is None:
        raise HTTPException(status_code=404, detail="Version not found")
    return crud.add_item_to_version(db=db, version_id=version_id, item=item)


@app.get("/api/v1/price-tag-versions/{version_id}/items", response_model=List[schemas.PriceTagItem], tags=["价签版本"])
def read_version_items(version_id: int, db: Session = Depends(get_db)):
    db_version = crud.get_price_tag_version(db, version_id=version_id)
    if db_version is None:
        raise HTTPException(status_code=404, detail="Version not found")
    return crud.get_version_items(db, version_id=version_id)


@app.post("/api/v1/price-tag-versions/{version_id}/stores", tags=["价签版本"])
def assign_stores_to_version(
    version_id: int,
    assignment: schemas.StoreAssignment,
    db: Session = Depends(get_db)
):
    db_version = crud.get_price_tag_version(db, version_id=version_id)
    if db_version is None:
        raise HTTPException(status_code=404, detail="Version not found")
    
    for store_id in assignment.store_ids:
        db_store = crud.get_store(db, store_id=store_id)
        if db_store is None:
            raise HTTPException(status_code=404, detail=f"Store {store_id} not found")
    
    new_assignments = crud.assign_stores_to_version(
        db,
        version_id=version_id,
        store_ids=assignment.store_ids,
        assigned_by=assignment.assigned_by
    )
    return {"assigned_count": len(new_assignments), "message": "Stores assigned successfully"}


@app.get("/api/v1/price-tag-versions/{version_id}/status", response_model=schemas.VersionStatusSummary, tags=["价签版本"])
def get_version_status(version_id: int, db: Session = Depends(get_db)):
    summary = crud.get_version_status_summary(db, version_id=version_id)
    if summary is None:
        raise HTTPException(status_code=404, detail="Version not found")
    return summary


@app.get("/api/v1/price-tag-versions/{version_id}/export", tags=["报告导出"])
def export_version_report(version_id: int, db: Session = Depends(get_db)):
    report = crud.generate_export_report(db, version_id=version_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Version not found")
    return JSONResponse(content=report)


@app.post("/api/v1/confirmations/", tags=["门店确认"])
def create_confirmation(
    confirmation: schemas.ConfirmationCreate,
    db: Session = Depends(get_db)
):
    db_version = crud.get_price_tag_version(db, version_id=confirmation.version_id)
    if db_version is None:
        raise HTTPException(status_code=404, detail="Version not found")
    
    db_store = crud.get_store(db, store_id=confirmation.store_id)
    if db_store is None:
        raise HTTPException(status_code=404, detail="Store not found")
    
    result, error = crud.create_confirmation(db=db, confirmation=confirmation)
    if error:
        raise HTTPException(status_code=409, detail=error)
    return result


@app.get("/api/v1/confirmations/", response_model=List[schemas.Confirmation], tags=["门店确认"])
def read_confirmations(version_id: int = None, store_id: int = None, db: Session = Depends(get_db)):
    return crud.get_confirmations(db, version_id=version_id, store_id=store_id)


@app.delete("/api/v1/confirmations/{confirmation_id}", tags=["门店确认"])
def revoke_confirmation(
    confirmation_id: int,
    revoked_by: str,
    reason: str,
    db: Session = Depends(get_db)
):
    discrepancy = crud.revoke_confirmation(db, confirmation_id=confirmation_id, revoked_by=revoked_by, reason=reason)
    if discrepancy is None:
        raise HTTPException(status_code=404, detail="Confirmation not found")
    return {"message": "Confirmation revoked successfully", "discrepancy": discrepancy}


@app.post("/api/v1/discrepancies/", response_model=schemas.Discrepancy, tags=["差异管理"])
def create_discrepancy(discrepancy: schemas.DiscrepancyCreate, db: Session = Depends(get_db)):
    return crud.create_discrepancy(db=db, discrepancy=discrepancy)


@app.get("/api/v1/discrepancies/", response_model=List[schemas.Discrepancy], tags=["差异管理"])
def read_discrepancies(
    version_id: int = None,
    store_id: int = None,
    status: str = None,
    db: Session = Depends(get_db)
):
    return crud.get_discrepancies(db, version_id=version_id, store_id=store_id, status=status)


@app.get("/api/v1/discrepancies/{discrepancy_id}", response_model=schemas.Discrepancy, tags=["差异管理"])
def read_discrepancy(discrepancy_id: int, db: Session = Depends(get_db)):
    db_discrepancy = crud.get_discrepancy(db, discrepancy_id=discrepancy_id)
    if db_discrepancy is None:
        raise HTTPException(status_code=404, detail="Discrepancy not found")
    return db_discrepancy


@app.post("/api/v1/discrepancies/{discrepancy_id}/resolve", response_model=schemas.Discrepancy, tags=["差异管理"])
def resolve_discrepancy(
    discrepancy_id: int,
    resolve: schemas.DiscrepancyResolve,
    db: Session = Depends(get_db)
):
    db_discrepancy = crud.resolve_discrepancy(
        db,
        discrepancy_id=discrepancy_id,
        resolution=resolve.resolution,
        resolved_by=resolve.resolved_by,
        correct_action=resolve.correct_action
    )
    if db_discrepancy is None:
        raise HTTPException(status_code=404, detail="Discrepancy not found")
    return db_discrepancy


@app.get("/", tags=["根路径"])
def root():
    return {
        "message": "价签版本促销到期门店确认API",
        "docs": "/docs",
        "version": "1.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
