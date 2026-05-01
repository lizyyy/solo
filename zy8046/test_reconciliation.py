import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, get_db
from main import app

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_import_and_reconciliation(db):
    sample_orders_csv = """order_id,user_id,cabinet_id,slot_id,start_time,end_time,duration_minutes,amount,status
ORD001,USER001,CAB001,SLOT01,2024-01-15T10:00:00,2024-01-15T12:30:00,150,6.0,completed
ORD002,USER002,CAB001,SLOT02,2024-01-15T14:00:00,2024-01-16T09:00:00,1140,20.0,completed
ORD003,USER003,CAB002,SLOT01,2024-01-15T16:00:00,2024-01-15T18:00:00,120,4.0,completed
ORD004,USER004,CAB002,SLOT03,2024-01-16T08:00:00,,0.0,active
ORD005,USER005,CAB003,SLOT05,2024-01-16T10:00:00,2024-01-16T10:30:00,30,1.5,completed
"""
    
    sample_events_jsonl = """{"event_id":"EVT001","cabinet_id":"CAB001","slot_id":"SLOT01","event_type":"borrow","event_time":"2024-01-15T10:00:00","order_id":"ORD001"}
{"event_id":"EVT002","cabinet_id":"CAB001","slot_id":"SLOT01","event_type":"return","event_time":"2024-01-15T12:30:00","order_id":"ORD001"}
{"event_id":"EVT003","cabinet_id":"CAB001","slot_id":"SLOT02","event_type":"borrow","event_time":"2024-01-15T14:00:00","order_id":"ORD002"}
{"event_id":"EVT004","cabinet_id":"CAB001","slot_id":"SLOT02","event_type":"return","event_time":"2024-01-16T09:00:00","order_id":"ORD002"}
{"event_id":"EVT005","cabinet_id":"CAB002","slot_id":"SLOT01","event_type":"borrow","event_time":"2024-01-15T16:00:00","order_id":"ORD003"}
{"event_id":"EVT006","cabinet_id":"CAB002","slot_id":"SLOT01","event_type":"borrow","event_time":"2024-01-15T16:05:00","order_id":"ORD003"}
{"event_id":"EVT007","cabinet_id":"CAB002","slot_id":"SLOT01","event_type":"return","event_time":"2024-01-15T18:00:00","order_id":"ORD003"}
{"event_id":"EVT008","cabinet_id":"CAB002","slot_id":"SLOT03","event_type":"borrow","event_time":"2024-01-16T08:00:00","order_id":"ORD004"}
"""
    
    sample_rules_yaml = """rules:
  - name: standard
    hourly_rate: 2.0
    daily_cap: 20.0
    free_minutes: 5
"""

    import_response = client.post(
        "/import",
        files={
            "orders_csv": ("orders.csv", sample_orders_csv, "text/csv"),
            "events_jsonl": ("events.jsonl", sample_events_jsonl, "application/jsonl"),
            "rules_yaml": ("rules.yaml", sample_rules_yaml, "text/yaml")
        }
    )
    
    assert import_response.status_code == 200
    data = import_response.json()
    assert data["orders_imported"] == 5
    assert data["events_imported"] == 8
    assert data["rules_imported"] == 1

    reconcile_response = client.post("/reconcile")
    assert reconcile_response.status_code == 200
    data = reconcile_response.json()
    assert data["total_orders"] == 5
    assert data["total_events"] == 8
    assert data["total_discrepancies"] == 3

    get_order_response = client.get("/orders/ORD001")
    assert get_order_response.status_code == 200
    data = get_order_response.json()
    assert data["order"]["id"] == "ORD001"
    assert len(data["events"]) == 2

    export_csv_response = client.get("/export?format=csv")
    assert export_csv_response.status_code == 200
    assert "text/csv" in export_csv_response.headers["content-type"]

    export_md_response = client.get("/export?format=markdown")
    assert export_md_response.status_code == 200
    assert "text/markdown" in export_md_response.headers["content-type"]


def test_order_not_found(db):
    response = client.get("/orders/NONEXISTENT")
    assert response.status_code == 404
