from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from typing import List
import json

from database import get_db, init_db, Station, SupplyCategory, RaceConfig, SupplyRecord, GapRecord, TransferLog
import schemas
import services

app = FastAPI(title="赛事补给缺口备用量调拨建议后端API", version="1.0.0")


@app.on_event("startup")
def startup_event():
    init_db()


@app.get("/")
def read_root():
    return {"message": "赛事补给缺口备用量调拨建议系统", "version": "1.0.0"}


@app.post("/api/stations/", response_model=schemas.Station)
def create_station(station: schemas.StationCreate, db: Session = Depends(get_db)):
    db_station = Station(**station.model_dump())
    db.add(db_station)
    db.commit()
    db.refresh(db_station)
    return db_station


@app.get("/api/stations/", response_model=List[schemas.Station])
def list_stations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    stations = db.query(Station).offset(skip).limit(limit).all()
    return stations


@app.post("/api/race-configs/", response_model=schemas.RaceConfig)
def create_race_config(config: schemas.RaceConfigCreate, db: Session = Depends(get_db)):
    db_config = RaceConfig(**config.model_dump())
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return db_config


@app.get("/api/race-configs/", response_model=List[schemas.RaceConfig])
def list_race_configs(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    configs = db.query(RaceConfig).offset(skip).limit(limit).all()
    return configs


@app.post("/api/supply-records/", response_model=schemas.SupplyRecord)
def create_supply_record(record: schemas.SupplyRecordCreate, db: Session = Depends(get_db)):
    db_record = SupplyRecord(**record.model_dump())
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record


@app.get("/api/supply-records/", response_model=List[schemas.SupplyRecord])
def list_supply_records(station_id: int = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(SupplyRecord)
    if station_id:
        query = query.filter(SupplyRecord.station_id == station_id)
    records = query.offset(skip).limit(limit).all()
    return records


@app.put("/api/supply-records/{record_id}", response_model=schemas.SupplyRecord)
def update_supply_record(record_id: int, update: schemas.SupplyRecordUpdate, db: Session = Depends(get_db)):
    record = db.query(SupplyRecord).get(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(record, key, value)
    db.commit()
    db.refresh(record)
    return record


@app.post("/api/import/stations/", response_model=schemas.CSVImportResponse)
def import_stations(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = file.file.read()
    result = services.import_stations_from_csv(db, content)
    return result


@app.post("/api/import/supply-allocations/", response_model=schemas.CSVImportResponse)
def import_supply_allocations(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = file.file.read()
    result = services.import_supply_allocation_from_csv(db, content)
    return result


@app.post("/api/calculate/{race_config_id}", response_model=schemas.CalculationResponse)
def calculate_requirements(race_config_id: int, db: Session = Depends(get_db)):
    result = services.calculate_supply_requirements(db, race_config_id)
    return result


@app.get("/api/gap-records/", response_model=List[schemas.GapRecord])
def list_gap_records(status: str = None, level: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(GapRecord)
    if status:
        query = query.filter(GapRecord.status == status)
    if level:
        query = query.filter(GapRecord.gap_level == level)
    records = query.order_by(GapRecord.priority, GapRecord.created_at).offset(skip).limit(limit).all()
    return records


@app.put("/api/gap-records/{gap_id}", response_model=schemas.GapRecord)
def update_gap_record(gap_id: int, update: schemas.GapRecordUpdate, db: Session = Depends(get_db)):
    gap = db.query(GapRecord).get(gap_id)
    if not gap:
        raise HTTPException(status_code=404, detail="缺口记录不存在")
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(gap, key, value)
    db.commit()
    db.refresh(gap)
    return gap


@app.post("/api/gap-records/{gap_id}/advance")
def advance_gap_status(gap_id: int, handler: str, db: Session = Depends(get_db)):
    gap = db.query(GapRecord).get(gap_id)
    if not gap:
        raise HTTPException(status_code=404, detail="缺口记录不存在")
    status_flow = ["open", "processing", "resolved", "closed"]
    current_idx = status_flow.index(gap.status) if gap.status in status_flow else 0
    if current_idx < len(status_flow) - 1:
        gap.status = status_flow[current_idx + 1]
        gap.handler = handler
        db.commit()
        return {"success": True, "new_status": gap.status}
    return {"success": False, "message": "已在最终状态"}


@app.post("/api/gap-records/{gap_id}/close")
def close_gap(gap_id: int, handler: str, conclusion: str, db: Session = Depends(get_db)):
    gap = db.query(GapRecord).get(gap_id)
    if not gap:
        raise HTTPException(status_code=404, detail="缺口记录不存在")
    gap.status = "closed"
    gap.handler = handler
    gap.conclusion = conclusion
    db.commit()
    return {"success": True, "message": "已关闭"}


@app.post("/api/gap-records/{gap_id}/withdraw")
def withdraw_gap(gap_id: int, handler: str, reason: str, db: Session = Depends(get_db)):
    gap = db.query(GapRecord).get(gap_id)
    if not gap:
        raise HTTPException(status_code=404, detail="缺口记录不存在")
    gap.status = "withdrawn"
    gap.handler = handler
    gap.conclusion = f"撤回原因: {reason}"
    db.commit()
    return {"success": True, "message": "已撤回"}


@app.get("/api/transfer-suggestions/", response_model=List[schemas.TransferSuggestion])
def get_transfer_suggestions(db: Session = Depends(get_db)):
    return services.generate_transfer_suggestions(db)


@app.post("/api/transfer-logs/", response_model=schemas.TransferLog)
def create_transfer_log(log: schemas.TransferLogCreate, db: Session = Depends(get_db)):
    db_log = TransferLog(**log.model_dump())
    db_log.status = "executed"
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log


@app.get("/api/export/markdown/{race_config_id}")
def export_markdown(race_config_id: int, db: Session = Depends(get_db)):
    md_content = services.generate_markdown_report(db, race_config_id)
    return PlainTextResponse(content=md_content, media_type="text/markdown")


@app.get("/api/export/json/{race_config_id}")
def export_json(race_config_id: int, db: Session = Depends(get_db)):
    config = db.query(RaceConfig).get(race_config_id)
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    gaps = db.query(GapRecord).filter(GapRecord.status == "open").order_by(GapRecord.priority).all()
    gap_summary = []
    for gap in gaps:
        station = db.query(Station).get(gap.station_id)
        category = db.query(SupplyCategory).get(gap.category_id)
        gap_summary.append({
            "station": station.name,
            "category": category.name,
            "gap_quantity": gap.gap_quantity,
            "level": gap.gap_level,
            "priority": gap.priority
        })
    suggestions = services.generate_transfer_suggestions(db)
    return {
        "race_name": config.race_name,
        "total_runners": config.total_runners,
        "backup_ratios": {
            "water": config.backup_ratio_water,
            "salt": config.backup_ratio_salt,
            "gel": config.backup_ratio_gel
        },
        "gap_summary": gap_summary,
        "transfer_suggestions": suggestions
    }


@app.get("/api/categories/", response_model=List[schemas.SupplyCategory])
def list_categories(db: Session = Depends(get_db)):
    return db.query(SupplyCategory).all()


@app.get("/api/exception-logs/", response_model=List[schemas.ExceptionLog])
def list_exception_logs(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    logs = db.query(ExceptionLog).order_by(ExceptionLog.created_at.desc()).offset(skip).limit(limit).all()
    return logs


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
