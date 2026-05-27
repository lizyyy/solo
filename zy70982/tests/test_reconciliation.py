import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.database import Base, get_db
from app import models, schemas

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_health_check():
    """测试健康检查接口"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_import_alarms_csv():
    """测试导入告警CSV"""
    csv_content = """alarm_id,pole_id,light_id,alarm_type,alarm_level,alarm_time,description,status
ALM001,P001,L001,灯具故障,高,2024-01-15 08:30:00,路灯不亮,已修复
ALM002,P001,L002,电源故障,高,2024-01-15 09:15:00,同杆多灯故障,已修复"""
    
    response = client.post(
        "/import/alarms/csv",
        files={"file": ("alarms.csv", csv_content, "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["imported_count"] == 2
    assert data["source_type"] == "alarm"


def test_import_inspections_json():
    """测试导入巡查JSON"""
    json_content = """[{
        "inspection_id": "INS001",
        "pole_id": "P001",
        "light_id": "L001",
        "inspector": "张三",
        "inspection_time": "2024-01-15 09:00:00",
        "status": "发现问题",
        "issues_found": ["灯具损坏"]
    }]"""
    
    response = client.post(
        "/import/inspections/json",
        files={"file": ("inspections.json", json_content, "application/json")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["imported_count"] == 1
    assert data["source_type"] == "inspection"


def test_import_work_orders_csv():
    """测试导入维修单CSV"""
    csv_content = """order_id,pole_id,light_id,alarm_id,repair_type,reporter,report_time,status
WO001,P001,L001,ALM001,更换灯具,系统自动派单,2024-01-15 08:45:00,已完成"""
    
    response = client.post(
        "/import/work-orders/csv",
        files={"file": ("work_orders.csv", csv_content, "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["imported_count"] == 1
    assert data["source_type"] == "work_order"


def test_full_reconciliation_flow():
    """测试完整对账流程"""
    alarms_csv = """alarm_id,pole_id,light_id,alarm_type,alarm_level,alarm_time,description,status
ALM001,P001,L001,灯具故障,高,2024-01-15 08:30:00,路灯不亮,已修复
ALM002,P002,L001,通信异常,中,2024-01-15 10:00:00,设备重启恢复,已恢复"""
    
    inspections_json = """[{
        "inspection_id": "INS001",
        "pole_id": "P001",
        "light_id": "L001",
        "inspector": "张三",
        "inspection_time": "2024-01-15 09:00:00",
        "status": "发现问题",
        "issues_found": ["灯具损坏"]
    }]"""
    
    work_orders_csv = """order_id,pole_id,light_id,alarm_id,repair_type,reporter,report_time,status
WO001,P001,L001,ALM001,更换灯具,系统自动派单,2024-01-15 08:45:00,已完成"""
    
    client.post(
        "/import/alarms/csv",
        files={"file": ("alarms.csv", alarms_csv, "text/csv")}
    )
    
    client.post(
        "/import/inspections/json",
        files={"file": ("inspections.json", inspections_json, "application/json")}
    )
    
    client.post(
        "/import/work-orders/csv",
        files={"file": ("work_orders.csv", work_orders_csv, "text/csv")}
    )
    
    batch_response = client.post(
        "/reconciliation/start",
        json={
            "batch_id": "BATCH001",
            "name": "2024年1月对账",
            "description": "1月份路灯故障对账",
            "created_by": "管理员"
        }
    )
    assert batch_response.status_code == 200
    assert batch_response.json()["batch_id"] == "BATCH001"
    
    run_response = client.post("/reconciliation/BATCH001/run")
    assert run_response.status_code == 200
    run_data = run_response.json()
    assert run_data["batch_id"] == "BATCH001"
    assert run_data["total_records"] > 0


def test_review_record():
    """测试人工复核功能"""
    alarms_csv = """alarm_id,pole_id,light_id,alarm_type,alarm_level,alarm_time,description,status
ALM001,P001,L001,灯具故障,高,2024-01-15 08:30:00,路灯不亮,已修复"""
    
    inspections_json = """[{
        "inspection_id": "INS001",
        "pole_id": "P001",
        "light_id": "L001",
        "inspector": "张三",
        "inspection_time": "2024-01-15 09:00:00",
        "status": "发现问题",
        "issues_found": ["灯具损坏"]
    }]"""
    
    work_orders_csv = """order_id,pole_id,light_id,alarm_id,repair_type,reporter,report_time,status
WO001,P001,L001,ALM001,更换灯具,系统自动派单,2024-01-15 08:45:00,已完成"""
    
    client.post("/import/alarms/csv", files={"file": ("alarms.csv", alarms_csv, "text/csv")})
    client.post("/import/inspections/json", files={"file": ("inspections.json", inspections_json, "application/json")})
    client.post("/import/work-orders/csv", files={"file": ("work_orders.csv", work_orders_csv, "text/csv")})
    
    client.post("/reconciliation/start", json={
        "batch_id": "BATCH002", "name": "测试对账", "created_by": "测试员"
    })
    client.post("/reconciliation/BATCH002/run")
    
    records_response = client.get("/reconciliation/BATCH002/records")
    assert records_response.status_code == 200
    records = records_response.json()
    assert len(records) > 0
    
    record_id = records[0]["id"]
    
    review_response = client.post(
        "/review",
        json={
            "record_id": record_id,
            "reviewer": "复核员",
            "status": "approved",
            "comment": "数据核对无误",
            "explanation": "告警、巡查、维修单三单一致，时间匹配，状态一致",
            "resolve_discrepancies": []
        }
    )
    assert review_response.status_code == 200
    reviewed_record = review_response.json()
    assert reviewed_record["review_status"] == "approved"
    assert len(reviewed_record["review_histories"]) == 1


def test_trace_work_order():
    """测试维修单全链路追踪"""
    alarms_csv = """alarm_id,pole_id,light_id,alarm_type,alarm_level,alarm_time,description,status
ALM001,P001,L001,灯具故障,高,2024-01-15 08:30:00,路灯不亮,已修复"""
    
    inspections_json = """[{
        "inspection_id": "INS001",
        "pole_id": "P001",
        "light_id": "L001",
        "inspector": "张三",
        "inspection_time": "2024-01-15 09:00:00",
        "status": "发现问题",
        "issues_found": ["灯具损坏"]
    }]"""
    
    work_orders_csv = """order_id,pole_id,light_id,alarm_id,repair_type,reporter,report_time,status
WO001,P001,L001,ALM001,更换灯具,系统自动派单,2024-01-15 08:45:00,已完成"""
    
    client.post("/import/alarms/csv", files={"file": ("alarms.csv", alarms_csv, "text/csv")})
    client.post("/import/inspections/json", files={"file": ("inspections.json", inspections_json, "application/json")})
    client.post("/import/work-orders/csv", files={"file": ("work_orders.csv", work_orders_csv, "text/csv")})
    
    client.post("/reconciliation/start", json={
        "batch_id": "BATCH003", "name": "追踪测试", "created_by": "测试员"
    })
    client.post("/reconciliation/BATCH003/run")
    
    trace_response = client.get("/trace/work-order/WO001")
    assert trace_response.status_code == 200
    trace_data = trace_response.json()
    assert trace_data["work_order"]["order_id"] == "WO001"
    assert trace_data["alarm"]["alarm_id"] == "ALM001"
    assert trace_data["inspection"]["inspection_id"] == "INS001"


def test_report_generation():
    """测试报告生成"""
    alarms_csv = """alarm_id,pole_id,light_id,alarm_type,alarm_level,alarm_time,description,status
ALM001,P001,L001,灯具故障,高,2024-01-15 08:30:00,路灯不亮,已修复"""
    
    inspections_json = """[{
        "inspection_id": "INS001",
        "pole_id": "P001",
        "light_id": "L001",
        "inspector": "张三",
        "inspection_time": "2024-01-15 09:00:00",
        "status": "发现问题",
        "issues_found": ["灯具损坏"]
    }]"""
    
    work_orders_csv = """order_id,pole_id,light_id,alarm_id,repair_type,reporter,report_time,status
WO001,P001,L001,ALM001,更换灯具,系统自动派单,2024-01-15 08:45:00,已完成"""
    
    client.post("/import/alarms/csv", files={"file": ("alarms.csv", alarms_csv, "text/csv")})
    client.post("/import/inspections/json", files={"file": ("inspections.json", inspections_json, "application/json")})
    client.post("/import/work-orders/csv", files={"file": ("work_orders.csv", work_orders_csv, "text/csv")})
    
    client.post("/reconciliation/start", json={
        "batch_id": "BATCH004", "name": "报告测试", "created_by": "测试员"
    })
    client.post("/reconciliation/BATCH004/run")
    
    summary_response = client.get("/report/BATCH004/summary")
    assert summary_response.status_code == 200
    summary_data = summary_response.json()
    assert summary_data["batch_id"] == "BATCH004"
    assert "total_records" in summary_data
    
    excel_response = client.get("/report/BATCH004/download/excel")
    assert excel_response.status_code == 200
    assert excel_response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
