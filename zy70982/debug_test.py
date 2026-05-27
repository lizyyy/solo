import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import Base, get_db
from app import models

url = "sqlite:///:memory:"
engine = create_engine(url, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

csv = "alarm_id,pole_id,light_id,alarm_type,alarm_level,alarm_time,description,status\nALM001,P001,L001,灯具故障,高,2024-01-15 08:30:00,路灯不亮,已修复\nALM002,P001,L002,电源故障,高,2024-01-15 09:15:00,同杆多灯故障,已修复"
r = client.post("/import/alarms/csv", files={"file": ("alarms.csv", csv, "text/csv")})
print(f"状态: {r.status_code}")
print(f"响应: {r.json()}")

db = TestingSessionLocal()
print(f"DB告警数: {db.query(models.Alarm).count()}")
db.close()
