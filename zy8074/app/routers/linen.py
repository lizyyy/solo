from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Inventory, LinenStatus, Batch
from app.import_validator import ImportValidator
from app.state_machine import StateMachine, LinenState
from app.report_exporter import ReportExporter
from datetime import datetime, timedelta

router = APIRouter(prefix="/linen", tags=["linen"])

@router.post("/import-inventory")
async def import_inventory(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    temp_path = "/tmp/temp_inventory.csv"
    with open(temp_path, "wb") as f:
        f.write(content)
    
    valid_items, errors = ImportValidator.validate_inventory_csv(temp_path)
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})
    
    imported = 0
    for item in valid_items:
        existing = db.query(Inventory).filter(Inventory.rfid == item["rfid"]).first()
        if not existing:
            inv = Inventory(
                rfid=item["rfid"],
                type=item["type"],
                room=item["room"],
                hotel=item["hotel"]
            )
            db.add(inv)
            imported += 1
    
    db.commit()
    return {"imported": imported, "total": len(valid_items)}

@router.get("/{rfid}")
def get_linen_status(rfid: str, db: Session = Depends(get_db)):
    inventory = db.query(Inventory).filter(Inventory.rfid == rfid).first()
    if not inventory:
        raise HTTPException(status_code=404, detail="布草不存在")
    
    latest = db.query(LinenStatus).filter(LinenStatus.rfid == rfid).order_by(LinenStatus.id.desc()).first()
    return {
        "rfid": inventory.rfid,
        "type": inventory.type,
        "room": inventory.room,
        "hotel": inventory.hotel,
        "wash_cycles": inventory.wash_cycles,
        "status": latest.status if latest else LinenState.IN_ROOM.value,
        "send_time": latest.send_time if latest else None,
        "receive_time": latest.receive_time if latest else None
    }

@router.get("/")
def list_all_linen(db: Session = Depends(get_db)):
    inventory_list = db.query(Inventory).all()
    result = []
    for inv in inventory_list:
        latest = db.query(LinenStatus).filter(LinenStatus.rfid == inv.rfid).order_by(LinenStatus.id.desc()).first()
        result.append({
            "rfid": inv.rfid,
            "type": inv.type,
            "room": inv.room,
            "hotel": inv.hotel,
            "status": latest.status if latest else LinenState.IN_ROOM.value,
            "wash_cycles": inv.wash_cycles
        })
    return result
