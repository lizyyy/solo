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
    if os.path.exists("./test.db"):
        os.remove("./test.db")


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


def test_multi_light_same_pole_detection():
    """测试同杆多灯识别 - P001下有L001和L002两盏灯"""
    alarms_csv = """alarm_id,pole_id,light_id,alarm_type,alarm_level,alarm_time,description,status
ALM001,P001,L001,灯具故障,高,2024-01-15 08:30:00,路灯不亮,已修复
ALM002,P001,L002,电源故障,高,2024-01-15 09:15:00,同杆多灯故障,已修复"""
    
    inspections_json = """[{
        "inspection_id": "INS001",
        "pole_id": "P001",
        "light_id": "L001",
        "inspector": "张三",
        "inspection_time": "2024-01-15 09:00:00",
        "status": "发现问题",
        "issues_found": ["灯具损坏"]
    }, {
        "inspection_id": "INS002",
        "pole_id": "P001",
        "light_id": "L002",
        "inspector": "张三",
        "inspection_time": "2024-01-15 09:30:00",
        "status": "发现问题",
        "issues_found": ["电源故障"]
    }]"""
    
    work_orders_csv = """order_id,pole_id,light_id,alarm_id,repair_type,reporter,report_time,status
WO001,P001,L001,ALM001,更换灯具,系统自动派单,2024-01-15 08:45:00,已完成
WO002,P001,L002,ALM002,电源维修,系统自动派单,2024-01-15 09:30:00,已完成"""
    
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
    
    client.post(
        "/reconciliation/start",
        json={
            "batch_id": "BATCH_UNDERSCORE_TEST",
            "name": "同杆多灯测试",
            "description": "测试同杆多灯识别",
            "created_by": "测试员"
        }
    )
    
    run_response = client.post("/reconciliation/BATCH_UNDERSCORE_TEST/run")
    assert run_response.status_code == 200
    run_data = run_response.json()
    
    p001_records = [r for r in run_data["records"] if r["pole_id"] == "P001"]
    assert len(p001_records) >= 2
    
    has_multi_light_discrepancy = False
    for record in p001_records:
        for disc in record["discrepancies"]:
            if disc["type"] == "multi_light_same_pole":
                has_multi_light_discrepancy = True
                break
    
    assert has_multi_light_discrepancy, "同杆多灯场景未被识别"


def test_batch_id_with_underscore_review_sync():
    """测试带下划线的批次ID复核后统计同步"""
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
        "batch_id": "BATCH_2024_01",
        "name": "带下划线批次测试",
        "description": "2024年1月",
        "created_by": "测试员"
    })
    client.post("/reconciliation/BATCH_2024_01/run")
    
    batch_before = client.get("/batches/BATCH_2024_01").json()
    assert batch_before["reviewed_count"] == 0
    
    records = client.get("/reconciliation/BATCH_2024_01/records").json()
    record_id = records[0]["id"]
    
    client.post(
        "/review",
        json={
            "record_id": record_id,
            "reviewer": "复核员",
            "status": "approved",
            "comment": "数据核对无误",
            "explanation": "三单一致",
            "resolve_discrepancies": []
        }
    )
    
    batch_after = client.get("/batches/BATCH_2024_01").json()
    assert batch_after["reviewed_count"] == 1, "复核后统计未同步"


def test_recalculate_no_duplicate_records():
    """测试重新计算不会产生重复记录"""
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
        "batch_id": "BATCH_RECALC_TEST",
        "name": "重计算测试",
        "created_by": "测试员"
    })
    
    first_run = client.post("/reconciliation/BATCH_RECALC_TEST/run").json()
    first_count = len(first_run["records"])
    
    second_run = client.post("/reconciliation/BATCH_RECALC_TEST/recalculate").json()
    second_count = len(second_run["records"])
    
    assert first_count == second_count, "重新计算产生了重复记录"


def test_report_summary_after_review():
    """测试报告汇总在复核后同步更新"""
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
        "batch_id": "BATCH_REPORT_SYNC",
        "name": "报告同步测试",
        "created_by": "测试员"
    })
    client.post("/reconciliation/BATCH_REPORT_SYNC/run")
    
    summary_before = client.get("/report/BATCH_REPORT_SYNC/summary").json()
    assert summary_before["reviewed_count"] == 0
    assert summary_before["approved_count"] == 0
    
    records = client.get("/reconciliation/BATCH_REPORT_SYNC/records").json()
    record_id = records[0]["id"]
    
    client.post(
        "/review",
        json={
            "record_id": record_id,
            "reviewer": "复核员",
            "status": "approved",
            "comment": "通过",
            "explanation": "同意",
            "resolve_discrepancies": []
        }
    )
    
    summary_after = client.get("/report/BATCH_REPORT_SYNC/summary").json()
    assert summary_after["reviewed_count"] == 1
    assert summary_after["approved_count"] == 1


def test_trace_work_order_multi_light_pole():
    """测试维修单全链路追踪在同杆多灯场景"""
    alarms_csv = """alarm_id,pole_id,light_id,alarm_type,alarm_level,alarm_time,description,status
ALM001,P001,L001,灯具故障,高,2024-01-15 08:30:00,路灯不亮,已修复
ALM002,P001,L002,电源故障,高,2024-01-15 09:15:00,同杆多灯故障,已修复"""
    
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
WO001,P001,L001,ALM001,更换灯具,系统自动派单,2024-01-15 08:45:00,已完成
WO002,P001,L002,ALM002,电源维修,系统自动派单,2024-01-15 09:30:00,已完成"""
    
    client.post("/import/alarms/csv", files={"file": ("alarms.csv", alarms_csv, "text/csv")})
    client.post("/import/inspections/json", files={"file": ("inspections.json", inspections_json, "application/json")})
    client.post("/import/work-orders/csv", files={"file": ("work_orders.csv", work_orders_csv, "text/csv")})
    
    client.post("/reconciliation/start", json={
        "batch_id": "BATCH_TRACE_TEST",
        "name": "追踪测试",
        "created_by": "测试员"
    })
    client.post("/reconciliation/BATCH_TRACE_TEST/run")
    
    trace_response = client.get("/trace/work-order/WO001")
    assert trace_response.status_code == 200
    trace_data = trace_response.json()
    assert trace_data["work_order"]["order_id"] == "WO001"
    assert trace_data["alarm"]["alarm_id"] == "ALM001"
    assert trace_data["batch_id"] == "BATCH_TRACE_TEST"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
