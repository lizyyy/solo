import pytest
import yaml
import json
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import (
    app,
    Base,
    get_db,
    HashBucket,
    FlagEvaluator,
    FlagHistory,
    SegmentHistory,
    AuditBatch,
    User
)

TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture
def db_session():
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


class TestHashBucket:
    def test_bucket_stability(self):
        user_key = "user_001"
        flag_key = "dark_mode"
        
        bucket1 = HashBucket.compute_bucket(user_key, flag_key)
        bucket2 = HashBucket.compute_bucket(user_key, flag_key)
        
        assert bucket1 == bucket2, "Hash bucket should be stable for same user+flag"
    
    def test_different_flags_different_buckets(self):
        user_key = "user_001"
        
        bucket1 = HashBucket.compute_bucket(user_key, "flag_a")
        bucket2 = HashBucket.compute_bucket(user_key, "flag_b")
        
        assert bucket1 != bucket2, "Different flags should have different buckets"
    
    def test_percentage_rollout_boundary(self):
        assert HashBucket.is_in_rollout("user_a", "flag", 0) == False
        assert HashBucket.is_in_rollout("user_a", "flag", 100) == True
    
    def test_rollout_consistency(self):
        user_key = "test_user_123"
        flag_key = "test_flag"
        
        results = [HashBucket.is_in_rollout(user_key, flag_key, 50) for _ in range(10)]
        assert all(r == results[0] for r in results), "Rollout decision should be consistent"


class TestFlagEvaluator:
    def test_kill_switch_override(self, db_session):
        batch = AuditBatch(name="test_batch")
        db_session.add(batch)
        db_session.commit()
        
        flag = FlagHistory(
            batch_id=batch.id,
            flag_key="test_flag",
            timestamp=datetime.utcnow(),
            version=1,
            is_kill_switch=True,
            kill_switch_value=False,
            default_value=True,
            rollout_percent=100,
            targeting_rules="[]"
        )
        db_session.add(flag)
        db_session.commit()
        
        evaluator = FlagEvaluator(db_session, batch.id)
        result = evaluator.evaluate_flag("test_flag", "any_user", datetime.utcnow())
        
        assert result["is_kill_switch_override"] == True
        assert result["value"] == False
    
    def test_segment_matching(self, db_session):
        batch = AuditBatch(name="test_batch")
        db_session.add(batch)
        db_session.commit()
        
        flag = FlagHistory(
            batch_id=batch.id,
            flag_key="test_flag",
            timestamp=datetime.utcnow(),
            version=1,
            is_kill_switch=False,
            default_value=False,
            rollout_percent=0,
            targeting_rules=json.dumps([
                {"type": "segment", "segment_key": "testers", "value": True}
            ])
        )
        db_session.add(flag)
        
        segment = SegmentHistory(
            batch_id=batch.id,
            segment_key="testers",
            timestamp=datetime.utcnow(),
            version=1,
            user_keys=json.dumps(["user_001", "user_002"])
        )
        db_session.add(segment)
        db_session.commit()
        
        evaluator = FlagEvaluator(db_session, batch.id)
        
        in_segment = evaluator.evaluate_flag("test_flag", "user_001", datetime.utcnow())
        assert in_segment["value"] == True
        
        not_in_segment = evaluator.evaluate_flag("test_flag", "user_999", datetime.utcnow())
        assert not_in_segment["value"] == False
    
    def test_deleted_segment_reference(self, db_session):
        batch = AuditBatch(name="test_batch")
        db_session.add(batch)
        db_session.commit()
        
        flag = FlagHistory(
            batch_id=batch.id,
            flag_key="test_flag",
            timestamp=datetime.utcnow(),
            version=1,
            is_kill_switch=False,
            default_value=False,
            rollout_percent=0,
            targeting_rules=json.dumps([
                {"type": "segment", "segment_key": "deleted_segment", "value": True}
            ])
        )
        db_session.add(flag)
        
        segment = SegmentHistory(
            batch_id=batch.id,
            segment_key="deleted_segment",
            timestamp=datetime.utcnow() - timedelta(hours=1),
            version=1,
            user_keys=json.dumps(["user_001"]),
            is_deleted=True
        )
        db_session.add(segment)
        db_session.commit()
        
        evaluator = FlagEvaluator(db_session, batch.id)
        result = evaluator.evaluate_flag("test_flag", "user_001", datetime.utcnow())
        
        assert result["segment_reference_issue"] is not None
        assert "deleted" in result["segment_reference_issue"].lower()


class TestAPI:
    def test_create_batch(self, client):
        response = client.post(
            "/api/batches?name=test_release",
            files={}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "test_release"
        assert "id" in data
    
    def test_list_batches(self, client, db_session):
        batch = AuditBatch(name="batch_1")
        db_session.add(batch)
        db_session.commit()
        
        response = client.get("/api/batches")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
    
    def test_upload_flags_yaml(self, client):
        flags_yaml = """flags:
  - key: test_flag
    version: 1
    created_at: "2024-01-01T00:00:00Z"
    default_value: false
    rollout_percent: 50
    is_kill_switch: false
    targeting_rules: []
"""
        response = client.post(
            "/api/batches?name=test_flags",
            files={"flags_file": ("flags.yaml", flags_yaml, "application/yaml")}
        )
        assert response.status_code == 200
    
    def test_upload_segments_json(self, client):
        segments_json = json.dumps([
            {
                "key": "beta_testers",
                "version": 1,
                "created_at": "2024-01-01T00:00:00Z",
                "user_keys": ["user_001", "user_002"]
            }
        ])
        response = client.post(
            "/api/batches?name=test_segments",
            files={"segments_file": ("segments.json", segments_json, "application/json")}
        )
        assert response.status_code == 200
    
    def test_upload_users_csv(self, client):
        users_csv = """user_key,name,plan
user_001,Alice,premium
user_002,Bob,free
"""
        response = client.post(
            "/api/batches?name=test_users",
            files={"users_file": ("users.csv", users_csv, "text/csv")}
        )
        assert response.status_code == 200
    
    def test_full_replay_workflow(self, client):
        flags_yaml = """flags:
  - key: dark_mode
    version: 1
    created_at: "2024-01-15T00:00:00Z"
    default_value: false
    rollout_percent: 50
    is_kill_switch: false
    targeting_rules: []
"""
        segments_json = json.dumps([
            {
                "key": "testers",
                "version": 1,
                "created_at": "2024-01-15T00:00:00Z",
                "user_keys": ["user_001"]
            }
        ])
        users_csv = """user_key
user_001
user_002
"""
        
        response = client.post(
            "/api/batches?name=full_test",
            files={
                "flags_file": ("flags.yaml", flags_yaml, "application/yaml"),
                "segments_file": ("segments.json", segments_json, "application/json"),
                "users_file": ("users.csv", users_csv, "text/csv")
            }
        )
        assert response.status_code == 200
        batch_id = response.json()["id"]
        
        replay_response = client.post(f"/api/batches/{batch_id}/replay")
        assert replay_response.status_code == 200
        replay_data = replay_response.json()
        assert "replayed_users" in replay_data
        assert "replayed_flags" in replay_data
        
        results_response = client.get(f"/api/batches/{batch_id}/replay/results")
        assert results_response.status_code == 200
        
        anomalies_response = client.get(f"/api/batches/{batch_id}/anomalies")
        assert anomalies_response.status_code == 200
    
    def test_export_issues_csv(self, client, db_session):
        from main import Anomaly
        batch = AuditBatch(name="export_test")
        db_session.add(batch)
        db_session.commit()
        
        anomaly = Anomaly(
            batch_id=batch.id,
            anomaly_type="segment_reference",
            flag_key="test_flag",
            segment_key="missing_segment",
            description="Segment not found"
        )
        db_session.add(anomaly)
        db_session.commit()
        
        response = client.get(f"/api/batches/{batch.id}/export/issues.csv")
        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]
    
    def test_export_replay_report(self, client, db_session):
        batch = AuditBatch(name="report_test")
        db_session.add(batch)
        
        user = User(batch_id=batch.id, user_key="user_001", attributes="{}")
        db_session.add(user)
        
        flag = FlagHistory(
            batch_id=batch.id,
            flag_key="test_flag",
            timestamp=datetime.utcnow(),
            version=1,
            default_value=True,
            targeting_rules="[]"
        )
        db_session.add(flag)
        db_session.commit()
        
        response = client.get(f"/api/batches/{batch.id}/export/replay_report.md")
        assert response.status_code == 200
        assert "markdown" in response.headers["content-type"]
