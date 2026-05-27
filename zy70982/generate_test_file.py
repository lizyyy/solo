#!/usr/bin/env python3
"""生成测试文件"""

code = '''import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.database import Base, get_db
from app import models, schemas


@pytest.fixture(autouse=True)
def setup_database():
    """为每个测试创建独立的数据库"""
    db_file = tempfile.mktemp(suffix=".db")
    url = f"sqlite:///{db_file}"
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
    yield client, TestingSessionLocal
    Base.metadata.drop_all(bind=engine)
    if os.path.exists(db_file):
        os.remove(db_file)
    app.dependency_overrides.clear()


def test_health_check(setup_database):
    """测试健康检查接口"""
    client, _ = setup_database
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_import_alarms_csv(setup_database):
    """测试导入告警CSV"""
    client, _ = setup_database
    csv = "alarm_id,pole_id,light_id,alarm_type,alarm_level,alarm_time,description,status\\nALM001,P001,L001,灯具故障,高,2024-01-15 08:30:00,路灯不亮,已修复\\nALM002,P001,L002,电源故障,高,2024-01-15 09:15:00,同杆多灯故障,已修复"
    r = client.post("/import/alarms/csv", files={"file": ("alarms.csv", csv, "text/csv")})
    assert r.status_code == 200
    d = r.json()
    assert d["imported_count"] == 2
    assert d["source_type"] == "alarm"
'''

with open("tests/test_reconciliation.py", "w", encoding="utf-8") as f:
    f.write(code)

print(f"测试文件生成成功，行数: {len(code.splitlines())}")
