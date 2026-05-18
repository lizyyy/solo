from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

import models
import schemas
import crud
from database import engine, get_db
from models import RegistrationStatus, PesticideCategory

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="农资门店农药限购登记API", description="支持列表、详情、历史记录、限购审核、撤回、人工处理等功能")


@app.on_event("startup")
def startup_event():
    db = next(get_db())
    try:
        rules = crud.get_purchase_limit_rules(db)
        if not rules:
            default_rules = [
                schemas.PurchaseLimitRuleCreate(
                    pesticide_category=PesticideCategory.INSECTICIDE,
                    max_quantity_per_month=10,
                    max_quantity_per_purchase=5
                ),
                schemas.PurchaseLimitRuleCreate(
                    pesticide_category=PesticideCategory.HERBICIDE,
                    max_quantity_per_month=8,
                    max_quantity_per_purchase=4
                ),
                schemas.PurchaseLimitRuleCreate(
                    pesticide_category=PesticideCategory.FUNGICIDE,
                    max_quantity_per_month=12,
                    max_quantity_per_purchase=6
                )
            ]
            for rule in default_rules:
                crud.create_purchase_limit_rule(db, rule)
    finally:
        db.close()


@app.post("/farmers/", response_model=schemas.Farmer, tags=["农户管理"])
def create_farmer(farmer: schemas.FarmerCreate, db: Session = Depends(get_db)):
    db_farmer = crud.get_farmer_by_id_card(db, id_card=farmer.id_card)
    if db_farmer:
        raise HTTPException(status_code=400, detail="该身份证号已存在")
    return crud.create_farmer(db=db, farmer=farmer)


@app.get("/farmers/", response_model=List[schemas.Farmer], tags=["农户管理"])
def read_farmers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    farmers = crud.get_farmers(db, skip=skip, limit=limit)
    return farmers


@app.get("/farmers/{farmer_id}", response_model=schemas.Farmer, tags=["农户管理"])
def read_farmer(farmer_id: int, db: Session = Depends(get_db)):
    db_farmer = crud.get_farmer(db, farmer_id=farmer_id)
    if db_farmer is None:
        raise HTTPException(status_code=404, detail="农户不存在")
    return db_farmer


@app.post("/registrations/", response_model=schemas.PesticideRegistration, tags=["农药登记"])
def create_registration(registration: schemas.PesticideRegistrationCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_pesticide_registration(db=db, registration=registration)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/registrations/", response_model=List[schemas.PesticideRegistration], tags=["农药登记"])
def read_registrations(skip: int = 0, limit: int = 100, farmer_id: int = None, db: Session = Depends(get_db)):
    registrations = crud.get_pesticide_registrations(db, skip=skip, limit=limit, farmer_id=farmer_id)
    return registrations


@app.get("/registrations/{registration_id}", response_model=schemas.PesticideRegistrationWithHistory, tags=["农药登记"])
def read_registration(registration_id: int, db: Session = Depends(get_db)):
    db_registration = crud.get_pesticide_registration(db, registration_id=registration_id)
    if db_registration is None:
        raise HTTPException(status_code=404, detail="登记记录不存在")
    return db_registration


@app.put("/registrations/{registration_id}", response_model=schemas.PesticideRegistration, tags=["农药登记"])
def update_registration(
    registration_id: int,
    registration_update: schemas.PesticideRegistrationUpdate,
    changed_by: str = None,
    db: Session = Depends(get_db)
):
    try:
        db_registration = crud.update_pesticide_registration(
            db, registration_id=registration_id, registration_update=registration_update, changed_by=changed_by
        )
        if db_registration is None:
            raise HTTPException(status_code=404, detail="登记记录不存在")
        return db_registration
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/registrations/{registration_id}/submit", response_model=schemas.PesticideRegistration, tags=["农药登记"])
def submit_registration(registration_id: int, submitter: str = None, db: Session = Depends(get_db)):
    try:
        db_registration = crud.submit_registration(db, registration_id=registration_id, submitter=submitter)
        if db_registration is None:
            raise HTTPException(status_code=404, detail="登记记录不存在")
        return db_registration
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/registrations/{registration_id}/withdraw", response_model=schemas.PesticideRegistration, tags=["农药登记"])
def withdraw_registration(registration_id: int, withdrawer: str = None, db: Session = Depends(get_db)):
    try:
        db_registration = crud.withdraw_registration(db, registration_id=registration_id, withdrawer=withdrawer)
        if db_registration is None:
            raise HTTPException(status_code=404, detail="登记记录不存在")
        return db_registration
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/registrations/{registration_id}/history", response_model=List[schemas.RegistrationHistory], tags=["农药登记"])
def get_registration_history(registration_id: int, db: Session = Depends(get_db)):
    db_registration = crud.get_pesticide_registration(db, registration_id=registration_id)
    if db_registration is None:
        raise HTTPException(status_code=404, detail="登记记录不存在")
    return crud.get_registration_history(db, registration_id=registration_id)


@app.post("/registrations/{registration_id}/manual-process", response_model=schemas.PesticideRegistration, tags=["人工处理"])
def start_manual_process(registration_id: int, processor: str = None, db: Session = Depends(get_db)):
    try:
        db_registration = crud.start_manual_process(db, registration_id=registration_id, processor=processor)
        if db_registration is None:
            raise HTTPException(status_code=404, detail="登记记录不存在")
        return db_registration
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/registrations/{registration_id}/manual-remark", response_model=schemas.PesticideRegistration, tags=["人工处理"])
def add_manual_remark(registration_id: int, manual_request: schemas.ManualProcessRequest, db: Session = Depends(get_db)):
    try:
        db_registration = crud.add_manual_remark(db, registration_id=registration_id, manual_request=manual_request)
        if db_registration is None:
            raise HTTPException(status_code=404, detail="登记记录不存在")
        return db_registration
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/registrations/{registration_id}/submit-from-manual", response_model=schemas.PesticideRegistration, tags=["人工处理"])
def submit_from_manual(registration_id: int, processor: str = None, db: Session = Depends(get_db)):
    try:
        db_registration = crud.submit_from_manual(db, registration_id=registration_id, processor=processor)
        if db_registration is None:
            raise HTTPException(status_code=404, detail="登记记录不存在")
        return db_registration
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/registrations/{registration_id}/approve", response_model=schemas.PesticideRegistration, tags=["审核管理"])
def approve_registration(registration_id: int, audit_request: schemas.AuditRequest, db: Session = Depends(get_db)):
    try:
        db_registration = crud.audit_registration(
            db, registration_id=registration_id, approved=True, audit_request=audit_request
        )
        if db_registration is None:
            raise HTTPException(status_code=404, detail="登记记录不存在")
        return db_registration
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/registrations/{registration_id}/reject", response_model=schemas.PesticideRegistration, tags=["审核管理"])
def reject_registration(registration_id: int, audit_request: schemas.AuditRequest, db: Session = Depends(get_db)):
    try:
        db_registration = crud.audit_registration(
            db, registration_id=registration_id, approved=False, audit_request=audit_request
        )
        if db_registration is None:
            raise HTTPException(status_code=404, detail="登记记录不存在")
        return db_registration
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/limit-rules/", response_model=schemas.PurchaseLimitRule, tags=["限购规则"])
def create_limit_rule(rule: schemas.PurchaseLimitRuleCreate, db: Session = Depends(get_db)):
    return crud.create_purchase_limit_rule(db=db, rule=rule)


@app.get("/limit-rules/", response_model=List[schemas.PurchaseLimitRule], tags=["限购规则"])
def read_limit_rules(db: Session = Depends(get_db)):
    return crud.get_purchase_limit_rules(db)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
