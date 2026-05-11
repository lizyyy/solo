from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import List
import os

from .database import engine, Base, get_db
from .models import (
    Wristband, Deposit, Transaction, Settlement,
    WristbandStatus, DepositStatus, TransactionType
)
from .schemas import (
    WristbandCreate, WristbandResponse, DepositResponse,
    TransactionResponse, ConsumptionRequest, LossReport,
    SettlementResponse, StatisticsResponse, DepositRecharge
)
from .services import WristbandService, SettlementService, BusinessError

Base.metadata.create_all(bind=engine)

app = FastAPI(title="水上乐园腕带押金 API", version="1.0.0")


@app.exception_handler(BusinessError)
async def business_error_handler(request: Request, exc: BusinessError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": {
                "code": exc.code,
                "message": exc.message
            }
        }
    )


@app.post("/api/wristbands", response_model=WristbandResponse, status_code=201)
def issue_wristband(data: WristbandCreate, db: Session = Depends(get_db)):
    wristband = WristbandService.issue_wristband(db, data)
    db.commit()
    db.refresh(wristband)
    return wristband


@app.post("/api/wristbands/{wristband_no}/freeze", response_model=WristbandResponse)
def freeze_deposit(wristband_no: str, db: Session = Depends(get_db)):
    wristband = WristbandService.freeze_deposit(db, wristband_no)
    db.commit()
    db.refresh(wristband)
    return wristband


@app.post("/api/wristbands/{wristband_no}/activate", response_model=WristbandResponse)
def activate_wristband(wristband_no: str, initial_deposit: float = 0, db: Session = Depends(get_db)):
    wristband = WristbandService.activate_wristband(db, wristband_no, initial_deposit)
    db.commit()
    db.refresh(wristband)
    return wristband


@app.post("/api/wristbands/{wristband_no}/recharge", response_model=TransactionResponse)
def recharge(wristband_no: str, data: DepositRecharge, db: Session = Depends(get_db)):
    transaction = WristbandService.recharge(db, wristband_no, data)
    db.commit()
    db.refresh(transaction)
    return transaction


@app.post("/api/wristbands/{wristband_no}/consume", response_model=TransactionResponse)
def consume(wristband_no: str, data: ConsumptionRequest, db: Session = Depends(get_db)):
    transaction = WristbandService.consume(db, wristband_no, data)
    db.commit()
    db.refresh(transaction)
    return transaction


@app.post("/api/wristbands/{wristband_no}/loss", response_model=WristbandResponse)
def report_loss(wristband_no: str, data: LossReport, db: Session = Depends(get_db)):
    new_wristband = WristbandService.report_loss(db, wristband_no, data)
    db.commit()
    db.refresh(new_wristband)
    return new_wristband


@app.get("/api/wristbands/{wristband_no}", response_model=WristbandResponse)
def get_wristband(wristband_no: str, db: Session = Depends(get_db)):
    wristband = WristbandService.get_wristband(db, wristband_no)
    if not wristband:
        raise HTTPException(status_code=404, detail={"code": "WRISTBAND_NOT_FOUND", "message": "腕带不存在"})
    return wristband


@app.get("/api/wristbands/{wristband_no}/transactions", response_model=List[TransactionResponse])
def get_transactions(wristband_no: str, db: Session = Depends(get_db)):
    return WristbandService.get_transactions(db, wristband_no)


@app.get("/api/statistics", response_model=StatisticsResponse)
def get_statistics(db: Session = Depends(get_db)):
    return SettlementService.calculate_statistics(db)


@app.post("/api/settlement", response_model=SettlementResponse)
def perform_settlement(db: Session = Depends(get_db)):
    settlement = SettlementService.perform_settlement(db)
    return settlement


@app.get("/api/settlements", response_model=List[SettlementResponse])
def list_settlements(db: Session = Depends(get_db)):
    return SettlementService.list_settlements(db)


@app.get("/api/settlements/{settlement_id}", response_model=SettlementResponse)
def get_settlement(settlement_id: int, db: Session = Depends(get_db)):
    settlement = SettlementService.get_settlement(db, settlement_id)
    if not settlement:
        raise HTTPException(status_code=404, detail={"code": "SETTLEMENT_NOT_FOUND", "message": "结算记录不存在"})
    return settlement


@app.get("/api/settlements/{settlement_id}/export")
def download_export(settlement_id: int, db: Session = Depends(get_db)):
    settlement = SettlementService.get_settlement(db, settlement_id)
    if not settlement:
        raise HTTPException(status_code=404, detail={"code": "SETTLEMENT_NOT_FOUND", "message": "结算记录不存在"})
    
    if not settlement.export_file_path or not os.path.exists(settlement.export_file_path):
        raise HTTPException(status_code=404, detail={"code": "EXPORT_NOT_FOUND", "message": "导出文件不存在"})
    
    return FileResponse(
        path=settlement.export_file_path,
        filename=f"settlement_{settlement_id}.csv",
        media_type="text/csv"
    )
