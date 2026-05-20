from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List
from datetime import datetime
import io
import csv

import models
import schemas
from database import engine, get_db
from services import QueueService

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="网关离线指令队列 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "网关离线指令队列 API", "version": "1.0.0"}


@app.get("/api/devices", response_model=List[schemas.GatewayDevice])
def get_devices(db: Session = Depends(get_db)):
    return db.query(models.GatewayDevice).all()


@app.post("/api/devices", response_model=schemas.GatewayDevice)
def create_device(device: schemas.GatewayDeviceCreate, db: Session = Depends(get_db)):
    existing = db.query(models.GatewayDevice).filter(
        models.GatewayDevice.device_id == device.device_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Device already exists")
    db_device = models.GatewayDevice(**device.model_dump())
    db.add(db_device)
    db.commit()
    db.refresh(db_device)
    return db_device


@app.put("/api/devices/{device_id}/status", response_model=schemas.GatewayDevice)
def update_device_status(device_id: int, status_update: schemas.StatusUpdate, db: Session = Depends(get_db)):
    service = QueueService(db)
    try:
        return service.update_device_status(device_id, status_update.status)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/devices/{device_id}", response_model=schemas.DeviceWithCommands)
def get_device_detail(device_id: int, db: Session = Depends(get_db)):
    device = db.query(models.GatewayDevice).filter(
        models.GatewayDevice.id == device_id
    ).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


@app.get("/api/commands", response_model=List[schemas.ControlCommand])
def get_commands(status: str = None, device_id: int = None, db: Session = Depends(get_db)):
    query = db.query(models.ControlCommand)
    if status:
        query = query.filter(models.ControlCommand.status == status)
    if device_id:
        query = query.filter(models.ControlCommand.device_id == device_id)
    return query.order_by(models.ControlCommand.created_at.desc()).all()


@app.get("/api/commands/abnormal", response_model=List[schemas.ControlCommand])
def get_abnormal_commands(db: Session = Depends(get_db)):
    service = QueueService(db)
    return service.get_abnormal_commands()


@app.post("/api/commands", response_model=schemas.ControlCommand)
def create_command(command: schemas.ControlCommandCreate, db: Session = Depends(get_db)):
    service = QueueService(db)
    try:
        return service.create_command(command)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/commands/{command_id}", response_model=schemas.CommandWithHistory)
def get_command_detail(command_id: int, db: Session = Depends(get_db)):
    command = db.query(models.ControlCommand).filter(
        models.ControlCommand.id == command_id
    ).first()
    if not command:
        raise HTTPException(status_code=404, detail="Command not found")
    return command


@app.put("/api/commands/{command_id}/execute")
def execute_command(command_id: int, success: bool = True, error_msg: str = None, db: Session = Depends(get_db)):
    service = QueueService(db)
    try:
        return service.process_command_execution(command_id, success, error_msg)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/commands/{command_id}/retry", response_model=schemas.ControlCommand)
def retry_command(command_id: int, db: Session = Depends(get_db)):
    service = QueueService(db)
    try:
        return service.retry_command(command_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/commands/{command_id}/discard", response_model=schemas.ControlCommand)
def discard_command(command_id: int, db: Session = Depends(get_db)):
    service = QueueService(db)
    try:
        return service.discard_command(command_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/receipts", response_model=schemas.ReceiptRecord)
def submit_receipt(receipt: schemas.ReceiptRecordCreate, db: Session = Depends(get_db)):
    service = QueueService(db)
    return service.submit_receipt(receipt)


@app.get("/api/offline-windows", response_model=List[schemas.OfflineWindow])
def get_offline_windows(device_id: int = None, db: Session = Depends(get_db)):
    query = db.query(models.OfflineWindow)
    if device_id:
        query = query.filter(models.OfflineWindow.device_id == device_id)
    return query.order_by(models.OfflineWindow.start_time.desc()).all()


@app.get("/api/export/commands")
def export_commands(status: str = None, device_id: int = None, db: Session = Depends(get_db)):
    query = db.query(models.ControlCommand)
    if status:
        query = query.filter(models.ControlCommand.status == status)
    if device_id:
        query = query.filter(models.ControlCommand.device_id == device_id)
    commands = query.order_by(models.ControlCommand.created_at.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Command ID", "Device ID", "Type", "Status", "Priority", "Sequence", 
                    "Created At", "Executed At", "Expire At", "Error Message"])
    
    for cmd in commands:
        writer.writerow([
            cmd.id, cmd.command_id, cmd.device_id, cmd.command_type, cmd.status,
            cmd.priority, cmd.sequence, cmd.created_at, cmd.executed_at,
            cmd.expire_at, cmd.error_message or ""
        ])
    
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=commands_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
    )


@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    total_commands = db.query(models.ControlCommand).count()
    queued = db.query(models.ControlCommand).filter(models.ControlCommand.status == "queued").count()
    pending = db.query(models.ControlCommand).filter(models.ControlCommand.status == "pending").count()
    dispatching = db.query(models.ControlCommand).filter(models.ControlCommand.status == "dispatching").count()
    executed = db.query(models.ControlCommand).filter(models.ControlCommand.status == "executed").count()
    confirmed = db.query(models.ControlCommand).filter(models.ControlCommand.status == "confirmed").count()
    failed = db.query(models.ControlCommand).filter(models.ControlCommand.status == "failed").count()
    expired = db.query(models.ControlCommand).filter(models.ControlCommand.status == "expired").count()
    discarded = db.query(models.ControlCommand).filter(models.ControlCommand.status == "discarded").count()
    
    online_devices = db.query(models.GatewayDevice).filter(models.GatewayDevice.status == "online").count()
    offline_devices = db.query(models.GatewayDevice).filter(models.GatewayDevice.status == "offline").count()
    
    return {
        "commands": {
            "total": total_commands,
            "queued": queued,
            "pending": pending,
            "dispatching": dispatching,
            "executed": executed,
            "confirmed": confirmed,
            "failed": failed,
            "expired": expired,
            "discarded": discarded
        },
        "devices": {
            "online": online_devices,
            "offline": offline_devices
        }
    }


@app.post("/api/cleanup/expired")
def cleanup_expired(db: Session = Depends(get_db)):
    service = QueueService(db)
    count = service.cleanup_expired_commands()
    return {"cleaned_count": count}
