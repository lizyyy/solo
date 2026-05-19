import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, get_db
from main import app
import tempfile
import os


@pytest.fixture
def test_db():
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
    temp_file.close()
    
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{temp_file.name}"
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    Base.metadata.create_all(bind=engine)
    
    def override_get_db():
        try:
            db = TestingSessionLocal()
            yield db
        finally:
            db.close()
    
    app.dependency_overrides[get_db] = override_get_db
    
    yield
    
    os.unlink(temp_file.name)


@pytest.mark.asyncio
async def test_health_check(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "dns-preview-api"


@pytest.mark.asyncio
async def test_create_task(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        task_data = {
            "domain": "test.com",
            "record_type": "A",
            "old_target": "1.1.1.1",
            "new_target": "2.2.2.2",
            "ttl_strategy": 300,
            "created_by": "test_user",
            "records": [
                {
                    "record_name": "www.test.com",
                    "record_type": "A",
                    "old_value": "1.1.1.1",
                    "new_value": "2.2.2.2",
                    "old_ttl": 300,
                    "new_ttl": 300
                }
            ]
        }
        
        response = await client.post("/api/tasks/", json=task_data)
        assert response.status_code == 200
        data = response.json()
        assert data["domain"] == "test.com"
        assert data["status"] == "draft"
        assert data["risk_level"] == "low"
        assert len(data["records"]) == 1
        assert data["created_by"] == "test_user"


@pytest.mark.asyncio
async def test_create_high_risk_task(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        task_data = {
            "domain": "highrisk.com",
            "record_type": "A",
            "old_target": "1.1.1.1",
            "new_target": "2.2.2.2",
            "ttl_strategy": 300,
            "created_by": "test_user",
            "records": [
                {
                    "record_name": "www.highrisk.com",
                    "record_type": "A",
                    "old_value": "1.1.1.1",
                    "new_value": "2.2.2.2",
                    "old_ttl": 86400,
                    "new_ttl": 300
                },
                {
                    "record_name": "api.highrisk.com",
                    "record_type": "A",
                    "old_value": None,
                    "new_value": "2.2.2.3",
                    "old_ttl": None,
                    "new_ttl": 300
                }
            ]
        }
        
        response = await client.post("/api/tasks/", json=task_data)
        assert response.status_code == 200
        data = response.json()
        assert data["risk_level"] == "high"
        assert data["risk_reason"] is not None


@pytest.mark.asyncio
async def test_get_task(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        task_data = {
            "domain": "gettest.com",
            "record_type": "A",
            "old_target": "1.1.1.1",
            "new_target": "2.2.2.2",
            "ttl_strategy": 300,
            "created_by": "test_user",
            "records": [
                {
                    "record_name": "www.gettest.com",
                    "record_type": "A",
                    "old_value": "1.1.1.1",
                    "new_value": "2.2.2.2",
                    "old_ttl": 300,
                    "new_ttl": 300
                }
            ]
        }
        
        create_response = await client.post("/api/tasks/", json=task_data)
        task_id = create_response.json()["id"]
        
        get_response = await client.get(f"/api/tasks/{task_id}")
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["id"] == task_id
        assert data["domain"] == "gettest.com"


@pytest.mark.asyncio
async def test_get_task_not_found(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/tasks/99999")
        assert response.status_code == 404
        assert "任务不存在" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_tasks_list(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for i in range(3):
            task_data = {
                "domain": f"list{i}.com",
                "record_type": "A",
                "old_target": "1.1.1.1",
                "new_target": "2.2.2.2",
                "ttl_strategy": 300,
                "created_by": "test_user",
                "records": [
                    {
                        "record_name": f"www.list{i}.com",
                        "record_type": "A",
                        "old_value": "1.1.1.1",
                        "new_value": "2.2.2.2",
                        "old_ttl": 300,
                        "new_ttl": 300
                    }
                ]
            }
            await client.post("/api/tasks/", json=task_data)
        
        response = await client.get("/api/tasks/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3


@pytest.mark.asyncio
async def test_status_transition_valid(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        task_data = {
            "domain": "status.com",
            "record_type": "A",
            "old_target": "1.1.1.1",
            "new_target": "2.2.2.2",
            "ttl_strategy": 300,
            "created_by": "test_user",
            "records": [
                {
                    "record_name": "www.status.com",
                    "record_type": "A",
                    "old_value": "1.1.1.1",
                    "new_value": "2.2.2.2",
                    "old_ttl": 300,
                    "new_ttl": 300
                }
            ]
        }
        
        create_response = await client.post("/api/tasks/", json=task_data)
        task_id = create_response.json()["id"]
        
        transition_data = {
            "target_status": "pending_audit",
            "operator": "admin",
            "remark": "提交审核"
        }
        
        response = await client.post(f"/api/tasks/{task_id}/status", json=transition_data)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending_audit"


@pytest.mark.asyncio
async def test_status_transition_invalid(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        task_data = {
            "domain": "invalid.com",
            "record_type": "A",
            "old_target": "1.1.1.1",
            "new_target": "2.2.2.2",
            "ttl_strategy": 300,
            "created_by": "test_user",
            "records": [
                {
                    "record_name": "www.invalid.com",
                    "record_type": "A",
                    "old_value": "1.1.1.1",
                    "new_value": "2.2.2.2",
                    "old_ttl": 300,
                    "new_ttl": 300
                }
            ]
        }
        
        create_response = await client.post("/api/tasks/", json=task_data)
        task_id = create_response.json()["id"]
        
        transition_data = {
            "target_status": "executing",
            "operator": "admin"
        }
        
        response = await client.post(f"/api/tasks/{task_id}/status", json=transition_data)
        assert response.status_code == 400
        assert "无效的状态转换" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_valid_statuses(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        task_data = {
            "domain": "validstatus.com",
            "record_type": "A",
            "old_target": "1.1.1.1",
            "new_target": "2.2.2.2",
            "ttl_strategy": 300,
            "created_by": "test_user",
            "records": [
                {
                    "record_name": "www.validstatus.com",
                    "record_type": "A",
                    "old_value": "1.1.1.1",
                    "new_value": "2.2.2.2",
                    "old_ttl": 300,
                    "new_ttl": 300
                }
            ]
        }
        
        create_response = await client.post("/api/tasks/", json=task_data)
        task_id = create_response.json()["id"]
        
        response = await client.get(f"/api/tasks/{task_id}/valid-statuses")
        assert response.status_code == 200
        data = response.json()
        assert data["current_status"] == "draft"
        assert "pending_audit" in data["valid_next_statuses"]
        assert "closed" in data["valid_next_statuses"]


@pytest.mark.asyncio
async def test_manual_correction(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        task_data = {
            "domain": "correct.com",
            "record_type": "A",
            "old_target": "1.1.1.1",
            "new_target": "2.2.2.2",
            "ttl_strategy": 300,
            "created_by": "test_user",
            "records": [
                {
                    "record_name": "www.correct.com",
                    "record_type": "A",
                    "old_value": "1.1.1.1",
                    "new_value": "2.2.2.2",
                    "old_ttl": 3600,
                    "new_ttl": 300
                }
            ]
        }
        
        create_response = await client.post("/api/tasks/", json=task_data)
        task_id = create_response.json()["id"]
        
        correction_data = {
            "operator": "admin",
            "ttl_strategy": 60,
            "records": [
                {
                    "record_name": "www.correct.com",
                    "record_type": "A",
                    "old_value": "1.1.1.1",
                    "new_value": "2.2.2.2",
                    "old_ttl": 60,
                    "new_ttl": 60
                }
            ],
            "remark": "修正TTL"
        }
        
        response = await client.post(f"/api/tasks/{task_id}/correct", json=correction_data)
        assert response.status_code == 200
        data = response.json()
        assert data["ttl_strategy"] == 60
        assert data["risk_level"] == "low"


@pytest.mark.asyncio
async def test_get_preview_report(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        task_data = {
            "domain": "report.com",
            "record_type": "A",
            "old_target": "1.1.1.1",
            "new_target": "2.2.2.2",
            "ttl_strategy": 300,
            "created_by": "test_user",
            "records": [
                {
                    "record_name": "www.report.com",
                    "record_type": "A",
                    "old_value": "1.1.1.1",
                    "new_value": "2.2.2.2",
                    "old_ttl": 300,
                    "new_ttl": 300
                }
            ]
        }
        
        create_response = await client.post("/api/tasks/", json=task_data)
        task_id = create_response.json()["id"]
        
        response = await client.get(f"/api/tasks/{task_id}/report")
        assert response.status_code == 200
        data = response.json()
        assert data["task_id"] == task_id
        assert data["domain"] == "report.com"
        assert data["record_diffs"] == 1
        assert "high_risk_records" in data


@pytest.mark.asyncio
async def test_export_csv(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        task_data = {
            "domain": "export.com",
            "record_type": "A",
            "old_target": "1.1.1.1",
            "new_target": "2.2.2.2",
            "ttl_strategy": 300,
            "created_by": "test_user",
            "records": [
                {
                    "record_name": "www.export.com",
                    "record_type": "A",
                    "old_value": "1.1.1.1",
                    "new_value": "2.2.2.2",
                    "old_ttl": 300,
                    "new_ttl": 300
                }
            ]
        }
        
        create_response = await client.post("/api/tasks/", json=task_data)
        task_id = create_response.json()["id"]
        
        response = await client.get(f"/api/tasks/{task_id}/export")
        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]
        assert "DNS切换预演报告" in response.text


@pytest.mark.asyncio
async def test_get_task_logs(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        task_data = {
            "domain": "logs.com",
            "record_type": "A",
            "old_target": "1.1.1.1",
            "new_target": "2.2.2.2",
            "ttl_strategy": 300,
            "created_by": "test_user",
            "records": [
                {
                    "record_name": "www.logs.com",
                    "record_type": "A",
                    "old_value": "1.1.1.1",
                    "new_value": "2.2.2.2",
                    "old_ttl": 300,
                    "new_ttl": 300
                }
            ]
        }
        
        create_response = await client.post("/api/tasks/", json=task_data)
        task_id = create_response.json()["id"]
        
        response = await client.get(f"/api/tasks/{task_id}/logs")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["operation"] == "create"


@pytest.mark.asyncio
async def test_close_task(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        task_data = {
            "domain": "close.com",
            "record_type": "A",
            "old_target": "1.1.1.1",
            "new_target": "2.2.2.2",
            "ttl_strategy": 300,
            "created_by": "test_user",
            "records": [
                {
                    "record_name": "www.close.com",
                    "record_type": "A",
                    "old_value": "1.1.1.1",
                    "new_value": "2.2.2.2",
                    "old_ttl": 300,
                    "new_ttl": 300
                }
            ]
        }
        
        create_response = await client.post("/api/tasks/", json=task_data)
        task_id = create_response.json()["id"]
        
        close_data = {
            "operator": "admin",
            "reason": "任务取消",
            "conclusion": "无需切换"
        }
        
        response = await client.post(f"/api/tasks/{task_id}/close", json=close_data)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "closed"


@pytest.mark.asyncio
async def test_rollback_task_not_executing(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        task_data = {
            "domain": "rollback.com",
            "record_type": "A",
            "old_target": "1.1.1.1",
            "new_target": "2.2.2.2",
            "ttl_strategy": 300,
            "created_by": "test_user",
            "records": [
                {
                    "record_name": "www.rollback.com",
                    "record_type": "A",
                    "old_value": "1.1.1.1",
                    "new_value": "2.2.2.2",
                    "old_ttl": 300,
                    "new_ttl": 300
                }
            ]
        }
        
        create_response = await client.post("/api/tasks/", json=task_data)
        task_id = create_response.json()["id"]
        
        response = await client.post(f"/api/tasks/{task_id}/rollback?operator=admin")
        assert response.status_code == 400
        assert "只有执行中状态的任务才能回滚" in response.json()["detail"]


@pytest.mark.asyncio
async def test_evaluate_ttl(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        records = [
            {
                "record_name": "www.test.com",
                "record_type": "A",
                "old_value": "1.1.1.1",
                "new_value": "2.2.2.2",
                "old_ttl": 7200,
                "new_ttl": 300
            },
            {
                "record_name": "api.test.com",
                "record_type": "A",
                "old_value": "1.1.1.2",
                "new_value": "2.2.2.3",
                "old_ttl": 300,
                "new_ttl": 300
            }
        ]
        
        response = await client.post("/api/ttl/evaluate", json=records)
        assert response.status_code == 200
        data = response.json()
        assert "overall_risk" in data
        assert "assessments" in data
        assert len(data["assessments"]) == 2
        assert data["assessments"][0]["is_risky"] == True


@pytest.mark.asyncio
async def test_closed_task_still_queryable(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        task_data = {
            "domain": "afterclose.com",
            "record_type": "A",
            "old_target": "1.1.1.1",
            "new_target": "2.2.2.2",
            "ttl_strategy": 300,
            "created_by": "test_user",
            "records": [
                {
                    "record_name": "www.afterclose.com",
                    "record_type": "A",
                    "old_value": "1.1.1.1",
                    "new_value": "2.2.2.2",
                    "old_ttl": 300,
                    "new_ttl": 300
                }
            ]
        }
        
        create_response = await client.post("/api/tasks/", json=task_data)
        task_id = create_response.json()["id"]
        
        close_data = {
            "operator": "admin",
            "reason": "任务完成",
            "conclusion": "切换成功无异常"
        }
        await client.post(f"/api/tasks/{task_id}/close", json=close_data)
        
        get_response = await client.get(f"/api/tasks/{task_id}")
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["status"] == "closed"
        assert data["domain"] == "afterclose.com"
        
        report_response = await client.get(f"/api/tasks/{task_id}/report")
        assert report_response.status_code == 200
        
        logs_response = await client.get(f"/api/tasks/{task_id}/logs")
        assert logs_response.status_code == 200
        logs = logs_response.json()
        assert len(logs) >= 2
        assert any(log["operation"] == "close" for log in logs)


@pytest.mark.asyncio
async def test_invalid_status_transition_has_audit_log(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        task_data = {
            "domain": "auditlog.com",
            "record_type": "A",
            "old_target": "1.1.1.1",
            "new_target": "2.2.2.2",
            "ttl_strategy": 300,
            "created_by": "test_user",
            "records": [
                {
                    "record_name": "www.auditlog.com",
                    "record_type": "A",
                    "old_value": "1.1.1.1",
                    "new_value": "2.2.2.2",
                    "old_ttl": 300,
                    "new_ttl": 300
                }
            ]
        }
        
        create_response = await client.post("/api/tasks/", json=task_data)
        task_id = create_response.json()["id"]
        
        transition_data = {
            "target_status": "executing",
            "operator": "audit_tester",
            "remark": "尝试非法跳转"
        }
        await client.post(f"/api/tasks/{task_id}/status", json=transition_data)
        
        logs_response = await client.get(f"/api/tasks/{task_id}/logs")
        assert logs_response.status_code == 200
        logs = logs_response.json()
        failed_logs = [log for log in logs if log["operation"] == "status_change:failed"]
        assert len(failed_logs) >= 1
        assert failed_logs[0]["operator"] == "audit_tester"
        assert "无效的状态转换" in failed_logs[0]["conclusion"]


@pytest.mark.asyncio
async def test_rollback_failure_has_audit_log(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        task_data = {
            "domain": "rollbackaudit.com",
            "record_type": "A",
            "old_target": "1.1.1.1",
            "new_target": "2.2.2.2",
            "ttl_strategy": 300,
            "created_by": "test_user",
            "records": [
                {
                    "record_name": "www.rollbackaudit.com",
                    "record_type": "A",
                    "old_value": "1.1.1.1",
                    "new_value": "2.2.2.2",
                    "old_ttl": 300,
                    "new_ttl": 300
                }
            ]
        }
        
        create_response = await client.post("/api/tasks/", json=task_data)
        task_id = create_response.json()["id"]
        
        await client.post(f"/api/tasks/{task_id}/rollback?operator=rollback_tester")
        
        logs_response = await client.get(f"/api/tasks/{task_id}/logs")
        assert logs_response.status_code == 200
        logs = logs_response.json()
        failed_logs = [log for log in logs if log["operation"] == "rollback:failed"]
        assert len(failed_logs) >= 1
        assert failed_logs[0]["operator"] == "rollback_tester"
        assert "只有执行中状态的任务才能回滚" in failed_logs[0]["conclusion"]
