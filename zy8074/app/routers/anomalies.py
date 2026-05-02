from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Inventory, LinenStatus, Batch, ScanRecord
from app.import_validator import ImportValidator
from app.state_machine import StateMachine, LinenState
from datetime import datetime, timedelta

router = APIRouter(prefix="/anomalies", tags=["anomalies"])

loss_rules = {
    "timeout_hours": 48,
    "cross_hotel_alarm": True,
    "max_wash_cycles": {
        "床单": 100,
        "被套": 80,
        "枕套": 120
    }
}

@router.post("/import-rules")
async def import_rules(file: UploadFile = File(...)):
    content = await file.read()
    temp_path = "/tmp/temp_rules.yaml"
    with open(temp_path, "wb") as f:
        f.write(content)
    
    rules, errors = ImportValidator.validate_loss_rules_yaml(temp_path)
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})
    
    global loss_rules
    loss_rules = rules
    return {"rules": loss_rules}

@router.get("/")
def check_anomalies(db: Session = Depends(get_db)):
    anomalies = []
    
    linen_items = db.query(LinenStatus).all()
    inventory_dict = {inv.rfid: inv for inv in db.query(Inventory).all()}
    
    batch_rfids = {}
    for linen in linen_items:
        if linen.batch_id:
            if linen.batch_id not in batch_rfids:
                batch_rfids[linen.batch_id] = []
            batch_rfids[linen.batch_id].append(linen.rfid)
    
    rfid_scan_count = {}
    scans = db.query(ScanRecord).all()
    for scan in scans:
        key = (scan.rfid, scan.action, scan.batch_id)
        rfid_scan_count[key] = rfid_scan_count.get(key, 0) + 1
    
    for (rfid, action, batch_id), count in rfid_scan_count.items():
        if count > 1:
            anomalies.append({
                "type": "DUPLICATE_SCAN",
                "rfid": rfid,
                "batch_id": batch_id,
                "action": action,
                "count": count,
                "description": f"重复扫描 {count} 次"
            })
    
    for linen in linen_items:
        if linen.rfid not in inventory_dict:
            continue
        inv = inventory_dict[linen.rfid]
        
        if StateMachine.check_timeout(linen, loss_rules["timeout_hours"]):
            anomalies.append({
                "type": "TIMEOUT",
                "rfid": linen.rfid,
                "batch_id": linen.batch_id,
                "description": f"超时 {loss_rules['timeout_hours']} 小时未回仓"
            })
        
        if linen.batch_id and linen.batch_id in batch_rfids and loss_rules["cross_hotel_alarm"]:
            batch = db.query(Batch).filter(Batch.id == linen.batch_id).first()
            if batch and batch.hotel != inv.hotel:
                anomalies.append({
                    "type": "CROSS_HOTEL",
                    "rfid": linen.rfid,
                    "batch_id": linen.batch_id,
                    "hotel": inv.hotel,
                    "batch_hotel": batch.hotel,
                    "description": "跨酒店串包"
                })
    
    for inv in db.query(Inventory).all():
        if StateMachine.check_max_cycles(inv, loss_rules["max_wash_cycles"]):
            anomalies.append({
                "type": "MAX_CYCLES",
                "rfid": inv.rfid,
                "type_": inv.type,
                "cycles": inv.wash_cycles,
                "description": f"达到最大洗涤次数 {inv.wash_cycles}"
            })
    
    return anomalies
