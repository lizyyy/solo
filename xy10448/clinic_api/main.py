from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from . import models, schemas, services
from .database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="诊所耗材收费 API",
    description="小诊所治疗收费与耗材扣减管理系统",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "诊所耗材收费 API 运行中", "version": "1.0.0"}


@app.post("/api/supplies/", response_model=schemas.Supply)
def create_supply(supply: schemas.SupplyCreate, db: Session = Depends(get_db)):
    return services.create_supply(db, supply)


@app.get("/api/supplies/", response_model=List[schemas.Supply])
def list_supplies(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return services.get_supplies(db, skip=skip, limit=limit)


@app.get("/api/supplies/{supply_id}", response_model=schemas.Supply)
def get_supply(supply_id: int, db: Session = Depends(get_db)):
    supply = services.get_supply(db, supply_id)
    if not supply:
        raise HTTPException(status_code=404, detail="Supply not found")
    return supply


@app.put("/api/supplies/{supply_id}", response_model=schemas.Supply)
def update_supply(supply_id: int, supply_update: schemas.SupplyUpdate, db: Session = Depends(get_db)):
    supply = services.update_supply(db, supply_id, supply_update)
    if not supply:
        raise HTTPException(status_code=404, detail="Supply not found")
    return supply


@app.post("/api/treatment-items/", response_model=schemas.TreatmentItem)
def create_treatment_item(item: schemas.TreatmentItemCreate, db: Session = Depends(get_db)):
    return services.create_treatment_item(db, item)


@app.get("/api/treatment-items/", response_model=List[schemas.TreatmentItem])
def list_treatment_items(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return services.get_treatment_items(db, skip=skip, limit=limit)


@app.get("/api/treatment-items/{item_id}", response_model=schemas.TreatmentItem)
def get_treatment_item(item_id: int, db: Session = Depends(get_db)):
    item = services.get_treatment_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Treatment item not found")
    return item


@app.post("/api/supply-templates/", response_model=schemas.SupplyTemplate)
def create_supply_template(template: schemas.SupplyTemplateCreate, db: Session = Depends(get_db)):
    return services.create_supply_template(db, template)


@app.post("/api/patients/", response_model=schemas.Patient)
def create_patient(patient: schemas.PatientCreate, db: Session = Depends(get_db)):
    existing = services.get_patient_by_phone(db, patient.phone)
    if existing:
        return existing
    return services.create_patient(db, patient)


@app.get("/api/patients/{patient_id}", response_model=schemas.Patient)
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    patient = services.get_patient(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@app.post("/api/visits/", response_model=schemas.Visit)
def create_visit(visit_data: schemas.VisitCreate, db: Session = Depends(get_db)):
    try:
        return services.create_visit(db, visit_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/visits/", response_model=List[schemas.Visit])
def list_visits(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return services.get_visits(db, skip=skip, limit=limit)


@app.get("/api/visits/{visit_id}", response_model=schemas.Visit)
def get_visit(visit_id: int, db: Session = Depends(get_db)):
    visit = services.get_visit(db, visit_id)
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    return visit


@app.post("/api/visits/{visit_id}/supplies/", response_model=schemas.Visit)
def update_visit_supplies(
    visit_id: int,
    supplies_data: List[schemas.ActualSupplyCreate],
    db: Session = Depends(get_db)
):
    try:
        return services.update_visit_actual_supplies(db, visit_id, supplies_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/visits/{visit_id}/charge/", response_model=schemas.Charge)
def charge_visit(
    visit_id: int,
    charge_data: schemas.ChargeCreate,
    db: Session = Depends(get_db)
):
    try:
        return services.charge_visit(db, visit_id, charge_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/charges/{charge_id}", response_model=schemas.Charge)
def get_charge(charge_id: int, db: Session = Depends(get_db)):
    charge = services.get_charge(db, charge_id)
    if not charge:
        raise HTTPException(status_code=404, detail="Charge not found")
    return charge


@app.post("/api/refunds/", response_model=schemas.Refund)
def create_refund(refund_data: schemas.RefundCreate, db: Session = Depends(get_db)):
    try:
        return services.refund_visit(db, refund_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/refunds/{refund_id}", response_model=schemas.Refund)
def get_refund(refund_id: int, db: Session = Depends(get_db)):
    refund = services.get_refund(db, refund_id)
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")
    return refund


@app.get("/api/statistics/", response_model=schemas.StatisticsResponse)
def get_statistics(db: Session = Depends(get_db)):
    return services.get_statistics(db)


@app.post("/api/visits/check-stock/", response_model=dict)
def check_stock(
    visit_items: List[schemas.VisitItemCreate],
    db: Session = Depends(get_db)
):
    all_sufficient, results = services.check_stock_for_visit_items(db, visit_items)
    return {
        "all_sufficient": all_sufficient,
        "results": results
    }
