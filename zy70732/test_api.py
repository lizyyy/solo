import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from main import app, get_db
from models import Base, TrialStatus, SourceType, FeaturePackage

TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
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


@pytest.fixture(autouse=True)
def cleanup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_create_trial():
    response = client.post(
        "/api/trials",
        json={
            "tenant_id": "tenant_test_001",
            "feature_package": FeaturePackage.AI_ANALYTICS.value,
            "trial_days": 30,
            "source": SourceType.SALES_PRESALE.value,
            "source_id": "test_source_001",
            "created_by": "test_user"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["tenant_id"] == "tenant_test_001"
    assert data["feature_package"] == FeaturePackage.AI_ANALYTICS.value
    assert data["status"] == TrialStatus.PENDING.value
    assert data["trial_days"] == 30


def test_create_trial_idempotent():
    payload = {
        "tenant_id": "tenant_test_001",
        "feature_package": FeaturePackage.AI_ANALYTICS.value,
        "trial_days": 30,
        "source": SourceType.SALES_PRESALE.value,
        "source_id": "test_source_001",
        "created_by": "test_user"
    }

    response1 = client.post("/api/trials", json=payload)
    assert response1.status_code == 200
    data1 = response1.json()

    response2 = client.post("/api/trials", json=payload)
    assert response2.status_code == 200
    data2 = response2.json()

    assert data1["id"] == data2["id"]


def test_get_trial():
    create_response = client.post(
        "/api/trials",
        json={
            "tenant_id": "tenant_test_001",
            "feature_package": FeaturePackage.AI_ANALYTICS.value,
            "trial_days": 30,
            "source": SourceType.SALES_PRESALE.value,
            "source_id": "test_source_001",
            "created_by": "test_user"
        }
    )
    trial_id = create_response.json()["id"]

    get_response = client.get(f"/api/trials/{trial_id}")
    assert get_response.status_code == 200
    data = get_response.json()
    assert data["id"] == trial_id


def test_list_trials():
    for i in range(3):
        client.post(
            "/api/trials",
            json={
                "tenant_id": f"tenant_test_{i}",
                "feature_package": FeaturePackage.AI_ANALYTICS.value,
                "trial_days": 30,
                "source": SourceType.SALES_PRESALE.value,
                "source_id": f"test_source_{i}",
                "created_by": "test_user"
            }
        )

    list_response = client.get("/api/trials")
    assert list_response.status_code == 200
    data = list_response.json()
    assert len(data) >= 3


def test_list_trials_with_filters():
    client.post(
        "/api/trials",
        json={
            "tenant_id": "tenant_filter",
            "feature_package": FeaturePackage.AI_ANALYTICS.value,
            "trial_days": 30,
            "source": SourceType.SALES_PRESALE.value,
            "source_id": "filter_source_001",
            "created_by": "test_user"
        }
    )

    list_response = client.get("/api/trials?tenant_id=tenant_filter")
    assert list_response.status_code == 200
    data = list_response.json()
    assert len(data) == 1
    assert data[0]["tenant_id"] == "tenant_filter"


def test_advance_status():
    create_response = client.post(
        "/api/trials",
        json={
            "tenant_id": "tenant_advance",
            "feature_package": FeaturePackage.AI_ANALYTICS.value,
            "trial_days": 30,
            "source": SourceType.SALES_PRESALE.value,
            "source_id": "advance_source_001",
            "created_by": "test_user"
        }
    )
    trial_id = create_response.json()["id"]

    advance_response = client.post(
        f"/api/trials/{trial_id}/advance",
        json={"operated_by": "system_test"}
    )
    assert advance_response.status_code == 200
    data = advance_response.json()
    assert data["status"] == TrialStatus.ACTIVE.value


def test_correct_status():
    create_response = client.post(
        "/api/trials",
        json={
            "tenant_id": "tenant_correct",
            "feature_package": FeaturePackage.AI_ANALYTICS.value,
            "trial_days": 30,
            "source": SourceType.SALES_PRESALE.value,
            "source_id": "correct_source_001",
            "created_by": "test_user"
        }
    )
    trial_id = create_response.json()["id"]

    correct_response = client.post(
        f"/api/trials/{trial_id}/correct",
        json={
            "new_status": TrialStatus.ACTIVE.value,
            "reason": "测试人工修正",
            "operated_by": "admin_test"
        }
    )
    assert correct_response.status_code == 200
    data = correct_response.json()
    assert data["status"] == TrialStatus.ACTIVE.value


def test_close_trial():
    create_response = client.post(
        "/api/trials",
        json={
            "tenant_id": "tenant_close",
            "feature_package": FeaturePackage.AI_ANALYTICS.value,
            "trial_days": 30,
            "source": SourceType.SALES_PRESALE.value,
            "source_id": "close_source_001",
            "created_by": "test_user"
        }
    )
    trial_id = create_response.json()["id"]

    close_response = client.post(
        f"/api/trials/{trial_id}/close",
        json={
            "reason": "测试关闭",
            "operated_by": "admin_test"
        }
    )
    assert close_response.status_code == 200
    data = close_response.json()
    assert data["status"] == TrialStatus.CLOSED.value


def test_create_snapshot():
    create_response = client.post(
        "/api/trials",
        json={
            "tenant_id": "tenant_snapshot",
            "feature_package": FeaturePackage.AI_ANALYTICS.value,
            "trial_days": 30,
            "source": SourceType.SALES_PRESALE.value,
            "source_id": "snapshot_source_001",
            "created_by": "test_user"
        }
    )
    trial_id = create_response.json()["id"]

    snapshot_response = client.post(f"/api/trials/{trial_id}/snapshot?operated_by=test_user")
    assert snapshot_response.status_code == 200
    data = snapshot_response.json()
    assert data["trial_id"] == trial_id
    assert "snapshot_data" in data


def test_export_snapshot():
    create_response = client.post(
        "/api/trials",
        json={
            "tenant_id": "tenant_export",
            "feature_package": FeaturePackage.AI_ANALYTICS.value,
            "trial_days": 30,
            "source": SourceType.SALES_PRESALE.value,
            "source_id": "export_source_001",
            "created_by": "test_user"
        }
    )
    trial_id = create_response.json()["id"]

    export_response = client.get(f"/api/trials/{trial_id}/snapshot")
    assert export_response.status_code == 200
    data = export_response.json()
    assert data["trial_id"] == trial_id
    assert data["tenant_id"] == "tenant_export"


def test_get_operation_logs():
    create_response = client.post(
        "/api/trials",
        json={
            "tenant_id": "tenant_logs",
            "feature_package": FeaturePackage.AI_ANALYTICS.value,
            "trial_days": 30,
            "source": SourceType.SALES_PRESALE.value,
            "source_id": "logs_source_001",
            "created_by": "test_user"
        }
    )
    trial_id = create_response.json()["id"]

    client.post(
        f"/api/trials/{trial_id}/advance",
        json={"operated_by": "system_test"}
    )

    logs_response = client.get(f"/api/trials/{trial_id}/logs")
    assert logs_response.status_code == 200
    logs = logs_response.json()
    assert len(logs) >= 2


def test_get_nonexistent_trial():
    response = client.get("/api/trials/999999")
    assert response.status_code == 404


def test_close_already_closed_trial():
    create_response = client.post(
        "/api/trials",
        json={
            "tenant_id": "tenant_double_close",
            "feature_package": FeaturePackage.AI_ANALYTICS.value,
            "trial_days": 30,
            "source": SourceType.SALES_PRESALE.value,
            "source_id": "double_close_source_001",
            "created_by": "test_user"
        }
    )
    trial_id = create_response.json()["id"]

    client.post(
        f"/api/trials/{trial_id}/close",
        json={"reason": "第一次关闭", "operated_by": "admin_test"}
    )

    second_close = client.post(
        f"/api/trials/{trial_id}/close",
        json={"reason": "第二次关闭", "operated_by": "admin_test"}
    )
    assert second_close.status_code == 400


def test_full_state_machine_flow():
    create_response = client.post(
        "/api/trials",
        json={
            "tenant_id": "tenant_full_flow",
            "feature_package": FeaturePackage.AI_ANALYTICS.value,
            "trial_days": 30,
            "source": SourceType.SALES_PRESALE.value,
            "source_id": "full_flow_source_001",
            "created_by": "test_user"
        }
    )
    trial_id = create_response.json()["id"]

    expected_states = [
        TrialStatus.ACTIVE.value,
        TrialStatus.EXPIRING.value,
        TrialStatus.EXPIRED.value,
        TrialStatus.RECYCLING.value,
        TrialStatus.RECYCLED.value
    ]

    current_status = TrialStatus.PENDING.value
    for expected_state in expected_states:
        response = client.post(
            f"/api/trials/{trial_id}/advance",
            json={"operated_by": "system_auto"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == expected_state
        current_status = expected_state


def test_source_tracking():
    create_response = client.post(
        "/api/trials",
        json={
            "tenant_id": "tenant_source",
            "feature_package": FeaturePackage.AI_ANALYTICS.value,
            "trial_days": 30,
            "source": SourceType.SALES_PRESALE.value,
            "source_id": "source_track_001",
            "created_by": "test_user"
        }
    )
    trial_id = create_response.json()["id"]

    logs_response = client.get(f"/api/trials/{trial_id}/logs")
    logs = logs_response.json()

    create_log = next(log for log in logs if log["operation_type"] == "CREATE")
    assert create_log is not None
    assert "original_input" in create_log
    assert create_log["original_input"]["source"] == SourceType.SALES_PRESALE.value
