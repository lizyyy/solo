from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import uuid
from app.database import get_db
from app.models import Batch, Inventory, LinenStatus, ScanRecord
from app.import_validator import ImportValidator
from app.state_machine import StateMachine, LinenState

router = APIRouter(prefix="/batches", tags=["batches"])

@router.post("/")
def create_batch(hotel: str, db: Session = Depends(get_db)):
    batch_id = str(uuid.uuid4())[:8]
    batch = Batch(id=batch_id, hotel=hotel)
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return {"batch_id": batch_id, "hotel": hotel, "created_at": batch.created_at}

@router.get("/")
def list_batches(db: Session = Depends(get_db)):
    batches = db.query(Batch).all()
    return [{"batch_id": b.id, "hotel": b.hotel, "created_at": b.created_at} for b in batches]

@router.post("/{batch_id}/scan")
def add_scan(batch_id: str, rfid: str, action: str, timestamp: datetime = None, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    inventory = db.query(Inventory).filter(Inventory.rfid == rfid).first()
    if not inventory:
        raise HTTPException(status_code=404, detail="布草不存在")
    
    if timestamp is None:
        timestamp = datetime.utcnow()
    
    scan = ScanRecord(rfid=rfid, action=action, timestamp=timestamp, batch_id=batch_id)
    db.add(scan)
    
    linen = db.query(LinenStatus).filter(LinenStatus.rfid == rfid).order_by(LinenStatus.id.desc()).first()
    current_state = linen.status if linen else None
    
    try:
        new_state = StateMachine.next_state(current_state, action)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    new_linen = LinenStatus(
        rfid=rfid,
        batch_id=batch_id,
        status=new_state.value,
        last_scan_time=timestamp
    )
    
    if action == "SEND":
        new_linen.send_time = timestamp
    elif action == "RECEIVE":
        new_linen.receive_time = timestamp
        inventory.wash_cycles += 1
    
    db.add(new_linen)
    db.commit()
    
    return {"rfid": rfid, "status": new_state.value, "timestamp": timestamp}

@router.post("/{batch_id}/import-scans")
async def import_scans(batch_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    content = await file.read()
    temp_path = "/tmp/temp_scans.jsonl"
    with open(temp_path, "wb") as f:
        f.write(content)
    
    valid_scans, errors = ImportValidator.validate_scans_jsonl(temp_path)
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})
    
    rfid_counts = {}
    for scan_data in valid_scans:
        rfid = scan_data["rfid"]
        rfid_counts[rfid] = rfid_counts.get(rfid, 0) + 1
    
    duplicates = [rfid for rfid, cnt in rfid_counts.items() if cnt > 1]
    
    for scan_data in valid_scans:
        rfid = scan_data["rfid"]
        action = scan_data["action"]
        ts = scan_data["timestamp"]
        
        scan = ScanRecord(rfid=rfid, action=action, timestamp=ts, batch_id=batch_id)
        db.add(scan)
        
        inventory = db.query(Inventory).filter(Inventory.rfid == rfid).first()
        linen = db.query(LinenStatus).filter(LinenStatus.rfid == rfid).order_by(LinenStatus.id.desc()).first()
        current_state = linen.status if linen else None
        
        try:
            new_state = StateMachine.next_state(current_state, action)
        except ValueError:
            continue
        
        new_linen = LinenStatus(
            rfid=rfid,
            batch_id=batch_id,
            status=new_state.value,
            last_scan_time=ts
        )
        
        if action == "SEND":
            new_linen.send_time = ts
        elif action == "RECEIVE":
            new_linen.receive_time = ts
            if inventory:
                inventory.wash_cycles += 1
        
        db.add(new_linen)
    
    db.commit()
    return {"imported": len(valid_scans), "duplicates": duplicates}
