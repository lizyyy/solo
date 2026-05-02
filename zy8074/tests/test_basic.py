import pytest

def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "docs" in data

def test_create_batch(client):
    response = client.post("/batches/", params={"hotel": "希尔顿"})
    assert response.status_code == 200
    data = response.json()
    assert "batch_id" in data
    assert data["hotel"] == "希尔顿"

def test_list_batches(client):
    client.post("/batches/", params={"hotel": "希尔顿"})
    client.post("/batches/", params={"hotel": "万豪"})
    
    response = client.get("/batches/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2

def test_import_inventory(client):
    csv_content = "rfid,type,room,hotel\nR001,床单,101,希尔顿\nR002,被套,102,希尔顿\n"
    response = client.post(
        "/linen/import-inventory",
        files={"file": ("inventory.csv", csv_content)}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["imported"] == 2

def test_get_linen_status(client):
    csv_content = "rfid,type,room,hotel\nG001,床单,101,希尔顿\n"
    client.post(
        "/linen/import-inventory",
        files={"file": ("inventory.csv", csv_content)}
    )
    
    response = client.get("/linen/G001")
    assert response.status_code == 200
    data = response.json()
    assert data["rfid"] == "G001"
    assert data["type"] == "床单"
