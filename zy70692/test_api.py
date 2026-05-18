import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import date, time, timedelta
import json

from database import Base, get_db
from main import app

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_dental.db"

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


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "version" in data


def test_create_patient():
    response = client.post(
        "/patients/",
        json={"name": "测试患者", "phone": "13800138000", "age": 30, "gender": "男"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "测试患者"
    assert data["phone"] == "13800138000"
    assert "id" in data


def test_read_patients():
    client.post(
        "/patients/",
        json={"name": "患者1", "phone": "13800138001"}
    )
    client.post(
        "/patients/",
        json={"name": "患者2", "phone": "13800138002"}
    )
    response = client.get("/patients/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2


def test_create_doctor():
    response = client.post(
        "/doctors/",
        json={"name": "测试医生", "department": "口腔科", "title": "主任医师"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "测试医生"
    assert "id" in data


def test_create_schedule():
    doctor_response = client.post(
        "/doctors/",
        json={"name": "排班医生", "department": "口腔科"}
    )
    doctor_id = doctor_response.json()["id"]
    
    today = date.today().isoformat()
    response = client.post(
        "/schedules/",
        json={
            "doctor_id": doctor_id,
            "schedule_date": today,
            "start_time": "09:00:00",
            "end_time": "12:00:00",
            "max_patients": 10,
            "is_available": True
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["doctor_id"] == doctor_id


def test_create_treatment_plan():
    patient_response = client.post(
        "/patients/",
        json={"name": "计划患者", "phone": "13900139000"}
    )
    patient_id = patient_response.json()["id"]
    
    next_date = (date.today() + timedelta(days=3)).isoformat()
    response = client.post(
        "/treatment-plans/",
        json={
            "patient_id": patient_id,
            "treatment_name": "根管治疗复查",
            "treatment_description": "术后一周复查",
            "next_revisit_date": next_date,
            "revisit_type": "常规复查"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["treatment_name"] == "根管治疗复查"


def test_get_pending_treatment_plans():
    patient_response = client.post(
        "/patients/",
        json={"name": "待处理患者", "phone": "13900139001"}
    )
    patient_id = patient_response.json()["id"]
    
    next_date = (date.today() + timedelta(days=3)).isoformat()
    client.post(
        "/treatment-plans/",
        json={
            "patient_id": patient_id,
            "treatment_name": "待处理治疗",
            "next_revisit_date": next_date
        }
    )
    
    response = client.get("/treatment-plans/pending/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


def test_reminder_schedule_match():
    patient_response = client.post(
        "/patients/",
        json={"name": "匹配患者", "phone": "13900139002"}
    )
    patient_id = patient_response.json()["id"]
    
    doctor_response = client.post(
        "/doctors/",
        json={"name": "匹配医生", "department": "口腔科"}
    )
    doctor_id = doctor_response.json()["id"]
    
    next_date = (date.today() + timedelta(days=3)).isoformat()
    plan_response = client.post(
        "/treatment-plans/",
        json={
            "patient_id": patient_id,
            "treatment_name": "匹配测试",
            "next_revisit_date": next_date
        }
    )
    plan_id = plan_response.json()["id"]
    
    schedule_response = client.post(
        "/schedules/",
        json={
            "doctor_id": doctor_id,
            "schedule_date": next_date,
            "start_time": "09:00:00",
            "end_time": "12:00:00",
            "max_patients": 10,
            "is_available": True
        }
    )
    schedule_id = schedule_response.json()["id"]
    
    match_response = client.post(
        "/reminders/match/",
        json={"treatment_plan_id": plan_id, "schedule_id": schedule_id}
    )
    assert match_response.status_code == 200
    reminder_data = match_response.json()
    assert reminder_data["treatment_plan_id"] == plan_id
    assert reminder_data["status"] == "scheduled"


def test_duplicate_reminder_prevention():
    patient_response = client.post(
        "/patients/",
        json={"name": "重复患者", "phone": "13900139003"}
    )
    patient_id = patient_response.json()["id"]
    
    doctor_response = client.post(
        "/doctors/",
        json={"name": "重复医生", "department": "口腔科"}
    )
    doctor_id = doctor_response.json()["id"]
    
    next_date = (date.today() + timedelta(days=3)).isoformat()
    plan_response = client.post(
        "/treatment-plans/",
        json={
            "patient_id": patient_id,
            "treatment_name": "重复测试",
            "next_revisit_date": next_date
        }
    )
    plan_id = plan_response.json()["id"]
    
    schedule_response = client.post(
        "/schedules/",
        json={
            "doctor_id": doctor_id,
            "schedule_date": next_date,
            "start_time": "09:00:00",
            "end_time": "12:00:00",
            "max_patients": 10,
            "is_available": True
        }
    )
    schedule_id = schedule_response.json()["id"]
    
    client.post(
        "/reminders/match/",
        json={"treatment_plan_id": plan_id, "schedule_id": schedule_id}
    )
    
    duplicate_response = client.post(
        "/reminders/match/",
        json={"treatment_plan_id": plan_id, "schedule_id": schedule_id}
    )
    assert duplicate_response.status_code == 400


def test_update_reminder_status():
    patient_response = client.post(
        "/patients/",
        json={"name": "状态患者", "phone": "13900139004"}
    )
    patient_id = patient_response.json()["id"]
    
    next_date = (date.today() + timedelta(days=3)).isoformat()
    reminder_response = client.post(
        "/reminders/",
        json={
            "patient_id": patient_id,
            "treatment_plan_id": 1,
            "reminder_date": next_date,
            "status": "pending"
        }
    )
    reminder_id = reminder_response.json()["id"]
    
    update_response = client.patch(
        f"/reminders/{reminder_id}/status/",
        json={"status": "sent", "notes": "已发送短信提醒", "operator": "测试员"}
    )
    assert update_response.status_code == 200
    updated_data = update_response.json()
    assert updated_data["status"] == "sent"


def test_manual_correct_reminder():
    patient_response = client.post(
        "/patients/",
        json={"name": "修正患者", "phone": "13900139005"}
    )
    patient_id = patient_response.json()["id"]
    
    next_date = (date.today() + timedelta(days=3)).isoformat()
    reminder_response = client.post(
        "/reminders/",
        json={
            "patient_id": patient_id,
            "treatment_plan_id": 1,
            "reminder_date": next_date,
            "status": "pending"
        }
    )
    reminder_id = reminder_response.json()["id"]
    
    new_date = (date.today() + timedelta(days=5)).isoformat()
    correct_response = client.patch(
        f"/reminders/{reminder_id}/correct/",
        json={
            "reminder_date": new_date,
            "reminder_time": "14:00:00",
            "notes": "患者要求改期",
            "operator": "前台护士"
        }
    )
    assert correct_response.status_code == 200
    corrected_data = correct_response.json()
    assert corrected_data["reminder_date"] == new_date


def test_cancel_reminder():
    patient_response = client.post(
        "/patients/",
        json={"name": "取消患者", "phone": "13900139006"}
    )
    patient_id = patient_response.json()["id"]
    
    next_date = (date.today() + timedelta(days=3)).isoformat()
    reminder_response = client.post(
        "/reminders/",
        json={
            "patient_id": patient_id,
            "treatment_plan_id": 1,
            "reminder_date": next_date,
            "status": "scheduled"
        }
    )
    reminder_id = reminder_response.json()["id"]
    
    cancel_response = client.post(
        f"/reminders/{reminder_id}/cancel/",
        params={"operator": "测试员", "reason": "患者取消预约"}
    )
    assert cancel_response.status_code == 200
    canceled_data = cancel_response.json()
    assert canceled_data["status"] == "cancelled"


def test_missed_appointment():
    patient_response = client.post(
        "/patients/",
        json={"name": "爽约患者", "phone": "13900139007"}
    )
    patient_id = patient_response.json()["id"]
    
    today = date.today().isoformat()
    reminder_response = client.post(
        "/reminders/",
        json={
            "patient_id": patient_id,
            "treatment_plan_id": 1,
            "reminder_date": today,
            "status": "sent"
        }
    )
    reminder_id = reminder_response.json()["id"]
    
    missed_response = client.post(
        "/missed-appointments/",
        json={
            "reminder_record_id": reminder_id,
            "miss_date": today,
            "reason_code": "P001",
            "reason_description": "患者忘记时间",
            "reported_by": "前台",
            "is_manual": True
        }
    )
    assert missed_response.status_code == 200


def test_missed_appointment_via_status_update():
    patient_response = client.post(
        "/patients/",
        json={"name": "状态爽约患者", "phone": "13900139008"}
    )
    patient_id = patient_response.json()["id"]
    
    today = date.today().isoformat()
    reminder_response = client.post(
        "/reminders/",
        json={
            "patient_id": patient_id,
            "treatment_plan_id": 1,
            "reminder_date": today,
            "status": "confirmed"
        }
    )
    reminder_id = reminder_response.json()["id"]
    
    update_response = client.patch(
        f"/reminders/{reminder_id}/status/",
        json={"status": "missed", "notes": "患者未到", "operator": "护士"}
    )
    assert update_response.status_code == 200
    
    missed_list = client.get("/missed-appointments/")
    assert missed_list.status_code == 200
    assert len(missed_list.json()) >= 1


def test_revisit_report():
    patient_response = client.post(
        "/patients/",
        json={"name": "报告患者", "phone": "13900139009"}
    )
    patient_id = patient_response.json()["id"]
    
    today = date.today().isoformat()
    report_response = client.post(
        "/revisit-reports/",
        json={
            "patient_id": patient_id,
            "report_date": today,
            "doctor_name": "张医生",
            "diagnosis": "恢复良好",
            "treatment_result": "完成治疗",
            "created_by": "张医生"
        }
    )
    assert report_response.status_code == 200


def test_export_reminders():
    patient_response = client.post(
        "/patients/",
        json={"name": "导出患者", "phone": "13900139010"}
    )
    patient_id = patient_response.json()["id"]
    
    next_date = (date.today() + timedelta(days=3)).isoformat()
    client.post(
        "/reminders/",
        json={
            "patient_id": patient_id,
            "treatment_plan_id": 1,
            "reminder_date": next_date,
            "status": "pending"
        }
    )
    
    export_response = client.get("/export/reminders/")
    assert export_response.status_code == 200
    export_data = export_response.json()
    assert "data" in export_data
    assert "count" in export_data


def test_export_reminders_csv():
    export_response = client.get("/export/reminders/", params={"format": "csv"})
    assert export_response.status_code == 200


def test_exception_logging():
    patient_response = client.post(
        "/patients/",
        json={"name": "异常患者", "phone": "13900139011"}
    )
    patient_id = patient_response.json()["id"]
    
    next_date = (date.today() + timedelta(days=3)).isoformat()
    client.post(
        "/reminders/",
        json={
            "patient_id": patient_id,
            "treatment_plan_id": 999,
            "reminder_date": next_date,
            "status": "pending"
        }
    )
    
    exceptions_response = client.get("/exceptions/", params={"is_resolved": False})
    assert exceptions_response.status_code == 200


def test_full_workflow():
    patient_response = client.post(
        "/patients/",
        json={"name": "完整流程患者", "phone": "13900139100"}
    )
    patient_id = patient_response.json()["id"]
    
    doctor_response = client.post(
        "/doctors/",
        json={"name": "完整流程医生", "department": "口腔科"}
    )
    doctor_id = doctor_response.json()["id"]
    
    next_date = (date.today() + timedelta(days=5)).isoformat()
    plan_response = client.post(
        "/treatment-plans/",
        json={
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "treatment_name": "完整流程测试治疗",
            "next_revisit_date": next_date
        }
    )
    plan_id = plan_response.json()["id"]
    
    schedule_response = client.post(
        "/schedules/",
        json={
            "doctor_id": doctor_id,
            "schedule_date": next_date,
            "start_time": "10:00:00",
            "end_time": "13:00:00",
            "max_patients": 10,
            "is_available": True
        }
    )
    schedule_id = schedule_response.json()["id"]
    
    match_response = client.post(
        "/reminders/match/",
        json={"treatment_plan_id": plan_id, "schedule_id": schedule_id}
    )
    reminder_id = match_response.json()["id"]
    
    client.patch(
        f"/reminders/{reminder_id}/status/",
        json={"status": "sent", "operator": "系统"}
    )
    
    client.patch(
        f"/reminders/{reminder_id}/status/",
        json={"status": "confirmed", "operator": "前台", "notes": "患者电话确认"}
    )
    
    report_response = client.post(
        "/revisit-reports/",
        json={
            "patient_id": patient_id,
            "reminder_record_id": reminder_id,
            "treatment_plan_id": plan_id,
            "report_date": next_date,
            "doctor_name": "完整流程医生",
            "diagnosis": "治疗效果良好，无需进一步处理",
            "treatment_result": "完成",
            "created_by": "完整流程医生"
        }
    )
    assert report_response.status_code == 200
    
    final_reminder = client.get(f"/reminders/{reminder_id}/")
    assert final_reminder.json()["status"] == "completed"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
