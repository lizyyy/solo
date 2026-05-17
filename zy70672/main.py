from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
from database import engine, get_db, Base
from models import SettlementStatus
from schemas import (
    Farmer, FarmerCreate, Plot, PlotCreate, Project, ProjectCreate,
    GPSRecord, GPSRecordCreate, Confirmation, ConfirmationCreate,
    Settlement, SettlementCreate, SettlementUpdate, SettlementList,
    ManualCorrectionRequest, ExceptionHandleRequest
)
from services import (
    create_settlement_service, get_settlement_service,
    list_settlements_service, update_settlement_status_service,
    manual_correction_service, cancel_settlement_service,
    handle_exception_service, export_settlement_service
)
from models import Farmer as FarmerModel, Plot as PlotModel, Project as ProjectModel, GPSRecord as GPSRecordModel, Confirmation as ConfirmationModel

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="农机亩数地块去重结算确认API",
    description="用于农机合作社结算时合并GPS面积和农户确认单，处理重复作业地块",
    version="1.0.0"
)


@app.post("/farmers/", response_model=Farmer, tags=["农户管理"])
def create_farmer(farmer: FarmerCreate, db: Session = Depends(get_db)):
    db_farmer = FarmerModel(**farmer.dict())
    db.add(db_farmer)
    db.commit()
    db.refresh(db_farmer)
    return db_farmer


@app.get("/farmers/", response_model=list[Farmer], tags=["农户管理"])
def list_farmers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(FarmerModel).offset(skip).limit(limit).all()


@app.post("/plots/", response_model=Plot, tags=["地块管理"])
def create_plot(plot: PlotCreate, db: Session = Depends(get_db)):
    existing = db.query(PlotModel).filter(PlotModel.plot_code == plot.plot_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Plot code already exists")
    db_plot = PlotModel(**plot.dict())
    db.add(db_plot)
    db.commit()
    db.refresh(db_plot)
    return db_plot


@app.get("/plots/", response_model=list[Plot], tags=["地块管理"])
def list_plots(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(PlotModel).offset(skip).limit(limit).all()


@app.post("/projects/", response_model=Project, tags=["作业项目管理"])
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    existing = db.query(ProjectModel).filter(ProjectModel.project_code == project.project_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Project code already exists")
    db_project = ProjectModel(**project.dict())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


@app.get("/projects/", response_model=list[Project], tags=["作业项目管理"])
def list_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(ProjectModel).offset(skip).limit(limit).all()


@app.post("/gps-records/", response_model=GPSRecord, tags=["GPS面积记录"])
def create_gps_record(gps_record: GPSRecordCreate, db: Session = Depends(get_db)):
    db_gps = GPSRecordModel(**gps_record.dict())
    db.add(db_gps)
    db.commit()
    db.refresh(db_gps)
    return db_gps


@app.get("/gps-records/", response_model=list[GPSRecord], tags=["GPS面积记录"])
def list_gps_records(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(GPSRecordModel).offset(skip).limit(limit).all()


@app.post("/confirmations/", response_model=Confirmation, tags=["农户确认单"])
def create_confirmation(confirmation: ConfirmationCreate, db: Session = Depends(get_db)):
    db_confirmation = ConfirmationModel(**confirmation.dict())
    db.add(db_confirmation)
    db.commit()
    db.refresh(db_confirmation)
    return db_confirmation


@app.get("/confirmations/", response_model=list[Confirmation], tags=["农户确认单"])
def list_confirmations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(ConfirmationModel).offset(skip).limit(limit).all()


@app.post("/settlements/", response_model=Settlement, tags=["结算管理"])
def create_settlement(settlement: SettlementCreate, db: Session = Depends(get_db)):
    try:
        return create_settlement_service(db, settlement)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/settlements/{settlement_id}", response_model=Settlement, tags=["结算管理"])
def get_settlement(settlement_id: int, db: Session = Depends(get_db)):
    settlement = get_settlement_service(db, settlement_id)
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")
    return settlement


@app.get("/settlements/", response_model=SettlementList, tags=["结算管理"])
def list_settlements(skip: int = 0, limit: int = 100, status: Optional[str] = None, db: Session = Depends(get_db)):
    return list_settlements_service(db, skip, limit, status)


@app.put("/settlements/{settlement_id}/status", response_model=Settlement, tags=["结算管理"])
def update_settlement_status(settlement_id: int, update: SettlementUpdate, db: Session = Depends(get_db)):
    try:
        settlement = update_settlement_status_service(
            db, settlement_id, update.status, update.processed_by, update.notes
        )
        if not settlement:
            raise HTTPException(status_code=404, detail="Settlement not found")
        return settlement
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/settlements/manual-correction", response_model=Settlement, tags=["结算管理"])
def manual_correction(request: ManualCorrectionRequest, db: Session = Depends(get_db)):
    try:
        settlement = manual_correction_service(db, request)
        if not settlement:
            raise HTTPException(status_code=404, detail="Settlement not found")
        return settlement
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/settlements/{settlement_id}/cancel", response_model=Settlement, tags=["结算管理"])
def cancel_settlement(settlement_id: int, processed_by: str, reason: str, db: Session = Depends(get_db)):
    try:
        settlement = cancel_settlement_service(db, settlement_id, processed_by, reason)
        if not settlement:
            raise HTTPException(status_code=404, detail="Settlement not found")
        return settlement
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/exceptions/handle", tags=["异常处理"])
def handle_exception(request: ExceptionHandleRequest, db: Session = Depends(get_db)):
    exception = handle_exception_service(db, request)
    if not exception:
        raise HTTPException(status_code=404, detail="Exception record not found")
    return exception


@app.get("/settlements/{settlement_id}/export", tags=["结算管理"])
def export_settlement(settlement_id: int, db: Session = Depends(get_db)):
    result = export_settlement_service(db, settlement_id)
    if not result:
        raise HTTPException(status_code=404, detail="Settlement not found")
    return JSONResponse(content=result)


@app.get("/health", tags=["系统"])
def health_check():
    return {"status": "ok", "message": "农机亩数地块去重结算确认API运行正常"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
