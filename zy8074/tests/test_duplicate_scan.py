import pytest
from datetime import datetime

def test_duplicate_scan_detection(client):
    response = client.post("/batches/", params={"hotel": "希尔顿"})
    assert response.status_code == 200
    batch_id = response.json()["batch_id"]
    
    inv_response = client.post(
        "/linen/import-inventory",
        files={"file": ("test.csv", "rfid,type,room,hotel\nTEST001,床单,101,希尔顿\n")}
    )
    assert inv_response.status_code == 200
    
    test_scans = """{"rfid": "TEST001", "action": "SEND", "timestamp": "2024-05-01T08:00:00"}
{"rfid": "TEST001", "action": "SEND", "timestamp": "2024-05-01T08:01:00"}
{"rfid": "TEST002", "action": "SEND", "timestamp": "2024-05-01T08:00:00"}"""
    
    import_response = client.post(
        f"/batches/{batch_id}/import-scans",
        files={"file": ("test_scans.jsonl", test_scans)}
    )
    assert import_response.status_code == 200
    result = import_response.json()
    assert "duplicates" in result
    assert "TEST001" in result["duplicates"]
    
    anomalies_response = client.get("/anomalies/")
    assert anomalies_response.status_code == 200
    anomalies = anomalies_response.json()
    
    duplicate_anomalies = [a for a in anomalies if a["type"] == "DUPLICATE_SCAN"]
    assert len(duplicate_anomalies) >= 1
    assert any(a["rfid"] == "TEST001" for a in duplicate_anomalies)

def test_multiple_actions_duplicate_scan(client):
    response = client.post("/batches/", params={"hotel": "希尔顿"})
    assert response.status_code == 200
    batch_id = response.json()["batch_id"]
    
    inv_response = client.post(
        "/linen/import-inventory",
        files={"file": ("test.csv", "rfid,type,room,hotel\nMULTI001,床单,101,希尔顿\nMULTI002,被套,102,希尔顿\n")}
    )
    assert inv_response.status_code == 200
    
    test_scans = """{"rfid": "MULTI001", "action": "SEND", "timestamp": "2024-05-01T08:00:00"}
{"rfid": "MULTI001", "action": "SEND", "timestamp": "2024-05-01T08:02:00"}
{"rfid": "MULTI001", "action": "SEND", "timestamp": "2024-05-01T08:03:00"}
{"rfid": "MULTI002", "action": "SEND", "timestamp": "2024-05-01T08:00:00"}
{"rfid": "MULTI002", "action": "RECEIVE", "timestamp": "2024-05-01T16:00:00"}
{"rfid": "MULTI002", "action": "RECEIVE", "timestamp": "2024-05-01T16:01:00"}"""
    
    import_response = client.post(
        f"/batches/{batch_id}/import-scans",
        files={"file": ("test_scans.jsonl", test_scans)}
    )
    assert import_response.status_code == 200
    result = import_response.json()
    assert "TEST001" not in result["duplicates"]
    assert "MULTI001" in result["duplicates"]
    assert "MULTI002" in result["duplicates"]
    
    anomalies_response = client.get("/anomalies/")
    assert anomalies_response.status_code == 200
    anomalies = anomalies_response.json()
    
    duplicate_anomalies = [a for a in anomalies if a["type"] == "DUPLICATE_SCAN"]
    assert len(duplicate_anomalies) >= 2
