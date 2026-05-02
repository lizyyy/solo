import pytest
from datetime import datetime, timedelta
from app.models import Inventory, LinenStatus, Batch
from tests.conftest import TestingSessionLocal

def test_missing_receive_scan_timeout(client):
    response = client.post("/batches/", params={"hotel": "希尔顿"})
    assert response.status_code == 200
    batch_id = response.json()["batch_id"]
    
    inv_response = client.post(
        "/linen/import-inventory",
        files={"file": ("test.csv", "rfid,type,room,hotel\nTIMEOUT001,床单,101,希尔顿\nTIMEOUT002,被套,102,希尔顿\n")}
    )
    assert inv_response.status_code == 200
    
    test_scans = """{"rfid": "TIMEOUT001", "action": "SEND", "timestamp": "2024-04-28T08:00:00"}
{"rfid": "TIMEOUT002", "action": "SEND", "timestamp": "2024-05-01T08:00:00"}
{"rfid": "TIMEOUT002", "action": "RECEIVE", "timestamp": "2024-05-01T16:00:00"}"""
    
    import_response = client.post(
        f"/batches/{batch_id}/import-scans",
        files={"file": ("test_scans.jsonl", test_scans)}
    )
    assert import_response.status_code == 200
    
    db = TestingSessionLocal()
    try:
        linen = db.query(LinenStatus).filter(LinenStatus.rfid == "TIMEOUT001").first()
        if linen:
            old_time = datetime.utcnow() - timedelta(hours=50)
            linen.send_time = old_time
            linen.last_scan_time = old_time
            db.commit()
    finally:
        db.close()
    
    linen_response = client.get("/linen/TIMEOUT001")
    assert linen_response.status_code == 200
    assert linen_response.json()["status"] == "IN_WASH"
    
    linen_response2 = client.get("/linen/TIMEOUT002")
    assert linen_response2.status_code == 200
    assert linen_response2.json()["status"] == "RETURNED"

def test_batch_incomplete_receive(client):
    response = client.post("/batches/", params={"hotel": "希尔顿"})
    assert response.status_code == 200
    batch_id = response.json()["batch_id"]
    
    inv_response = client.post(
        "/linen/import-inventory",
        files={"file": ("test.csv", "rfid,type,room,hotel\nINCOMP001,床单,101,希尔顿\nINCOMP002,被套,102,希尔顿\nINCOMP003,枕套,103,希尔顿\n")}
    )
    assert inv_response.status_code == 200
    
    test_scans = """{"rfid": "INCOMP001", "action": "SEND", "timestamp": "2024-05-01T08:00:00"}
{"rfid": "INCOMP002", "action": "SEND", "timestamp": "2024-05-01T08:00:00"}
{"rfid": "INCOMP003", "action": "SEND", "timestamp": "2024-05-01T08:00:00"}
{"rfid": "INCOMP001", "action": "RECEIVE", "timestamp": "2024-05-01T16:00:00"}
{"rfid": "INCOMP002", "action": "RECEIVE", "timestamp": "2024-05-01T16:00:00"}"""
    
    import_response = client.post(
        f"/batches/{batch_id}/import-scans",
        files={"file": ("test_scans.jsonl", test_scans)}
    )
    assert import_response.status_code == 200
    
    linen_list_response = client.get("/linen/")
    assert linen_list_response.status_code == 200
    linen_list = linen_list_response.json()
    
    incomp003 = next(l for l in linen_list if l["rfid"] == "INCOMP003")
    assert incomp003["status"] == "IN_WASH"
    
    incomp001 = next(l for l in linen_list if l["rfid"] == "INCOMP001")
    assert incomp001["status"] == "RETURNED"
