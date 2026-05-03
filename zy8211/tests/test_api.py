import pytest
from httpx import AsyncClient, ASGITransport
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import os
import io
import json
import csv
import yaml
from datetime import datetime, date

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from app.main import app
from app.models import Base, get_db

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
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
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


class TestRootEndpoints:
    def test_root(self):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data
        assert "docs" in data
    
    def test_health(self):
        response = client.get("/health")
        assert response.status_code == 200


class TestReviewRulesImport:
    def test_import_review_rules(self):
        rules_data = {
            "rules": [
                {
                    "rule_id": "test_moisture",
                    "name": "测试含水率规则",
                    "type": "moisture_threshold",
                    "threshold": 80.0,
                    "priority": 1,
                    "enabled": True
                },
                {
                    "rule_id": "test_dosage",
                    "name": "测试投加率规则",
                    "type": "dosage_rate",
                    "threshold": 10.0,
                    "priority": 2,
                    "enabled": True
                }
            ]
        }
        
        yaml_content = yaml.dump(rules_data, allow_unicode=True)
        files = {"file": ("rules.yaml", yaml_content, "application/x-yaml")}
        
        response = client.post("/import/review-rules", files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["imported_count"] == 2
    
    def test_query_review_rules(self):
        rules_data = {
            "rules": [
                {
                    "rule_id": "test_query",
                    "name": "测试查询规则",
                    "type": "moisture_threshold",
                    "threshold": 80.0,
                    "priority": 1,
                    "enabled": True
                }
            ]
        }
        
        yaml_content = yaml.dump(rules_data, allow_unicode=True)
        files = {"file": ("rules.yaml", yaml_content, "application/x-yaml")}
        client.post("/import/review-rules", files=files)
        
        response = client.get("/query/review-rules")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1


class TestChemicalBatchesImport:
    def test_import_chemical_batches(self):
        jsonl_lines = [
            json.dumps({
                "batch_id": "TEST-BATCH-001",
                "chemical_type": "PAM",
                "concentration": 0.1,
                "dosage_rate_target": 3.5,
                "dosage_rate_min": 3.0,
                "dosage_rate_max": 4.0,
                "start_time": "2026-05-03 08:00:00",
                "end_time": "2026-05-03 16:00:00",
                "total_chemical_used": 45.0,
                "supplier": "测试供应商"
            }, ensure_ascii=False)
        ]
        
        jsonl_content = "\n".join(jsonl_lines)
        files = {"file": ("batches.jsonl", jsonl_content, "application/jsonl")}
        
        response = client.post("/import/chemical-batches", files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["imported_count"] == 1
    
    def test_query_chemical_batches(self):
        jsonl_lines = [
            json.dumps({
                "batch_id": "TEST-BATCH-002",
                "chemical_type": "PAM",
                "concentration": 0.1,
                "dosage_rate_target": 3.5,
                "start_time": "2026-05-03 08:00:00",
                "end_time": "2026-05-03 16:00:00",
                "total_chemical_used": 45.0,
                "supplier": "测试供应商"
            }, ensure_ascii=False)
        ]
        
        jsonl_content = "\n".join(jsonl_lines)
        files = {"file": ("batches.jsonl", jsonl_content, "application/jsonl")}
        client.post("/import/chemical-batches", files=files)
        
        response = client.get("/query/chemical-batches")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1


class TestDehydratorRunsImport:
    def test_import_dehydrator_runs(self):
        csv_content = """run_id,machine_id,start_time,end_time,feed_sludge_volume,feed_sludge_concentration,dry_solids_input,batch_id
TEST-RUN-001,DH-01,2026-05-03 08:30:00,2026-05-03 10:30:00,120.5,4.2,5.061,TEST-BATCH-001
"""
        
        files = {"file": ("runs.csv", csv_content, "text/csv")}
        
        response = client.post("/import/dehydrator-runs", files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
    
    def test_query_dehydrator_runs(self):
        csv_content = """run_id,machine_id,start_time,end_time,feed_sludge_volume,feed_sludge_concentration,dry_solids_input,batch_id
TEST-RUN-002,DH-01,2026-05-03 08:30:00,2026-05-03 10:30:00,120.5,4.2,5.061,
"""
        
        files = {"file": ("runs.csv", csv_content, "text/csv")}
        client.post("/import/dehydrator-runs", files=files)
        
        response = client.get("/query/dehydrator-runs")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1


class TestLabMoistureImport:
    def test_import_lab_moisture(self):
        csv_content = """result_id,sample_time,moisture_content,cake_solids,run_id,batch_id,tested_by,tested_at
TEST-LAB-001,2026-05-03 10:30:00,78.5,21.5,TEST-RUN-001,TEST-BATCH-001,李工,2026-05-03 11:00:00
"""
        
        files = {"file": ("lab.csv", csv_content, "text/csv")}
        
        response = client.post("/import/lab-moisture", files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
    
    def test_query_lab_moisture(self):
        csv_content = """result_id,sample_time,moisture_content,cake_solids,run_id,batch_id,tested_by,tested_at
TEST-LAB-002,2026-05-03 10:30:00,78.5,21.5,,,李工,2026-05-03 11:00:00
"""
        
        files = {"file": ("lab.csv", csv_content, "text/csv")}
        client.post("/import/lab-moisture", files=files)
        
        response = client.get("/query/lab-moisture")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1


class TestExceptionDetection:
    def test_moisture_exceed_detection(self):
        rules_data = {
            "rules": [
                {
                    "rule_id": "moisture_rule",
                    "name": "含水率规则",
                    "type": "moisture_threshold",
                    "threshold": 80.0,
                    "priority": 1,
                    "enabled": True
                }
            ]
        }
        yaml_content = yaml.dump(rules_data, allow_unicode=True)
        files = {"file": ("rules.yaml", yaml_content, "application/x-yaml")}
        client.post("/import/review-rules", files=files)
        
        jsonl_lines = [
            json.dumps({
                "batch_id": "EXC-BATCH-001",
                "chemical_type": "PAM",
                "concentration": 0.1,
                "dosage_rate_target": 3.5,
                "start_time": "2026-05-03 08:00:00",
                "end_time": "2026-05-03 16:00:00",
                "total_chemical_used": 45.0,
                "supplier": "测试"
            }, ensure_ascii=False)
        ]
        jsonl_content = "\n".join(jsonl_lines)
        files = {"file": ("batches.jsonl", jsonl_content, "application/jsonl")}
        client.post("/import/chemical-batches", files=files)
        
        csv_content = """run_id,machine_id,start_time,end_time,feed_sludge_volume,feed_sludge_concentration,dry_solids_input,batch_id
EXC-RUN-001,DH-01,2026-05-03 08:30:00,2026-05-03 10:30:00,120.5,4.2,5.061,EXC-BATCH-001
"""
        files = {"file": ("runs.csv", csv_content, "text/csv")}
        client.post("/import/dehydrator-runs", files=files)
        
        lab_csv = """result_id,sample_time,moisture_content,cake_solids,run_id,batch_id,tested_by,tested_at
EXC-LAB-001,2026-05-03 10:30:00,85.0,15.0,EXC-RUN-001,EXC-BATCH-001,李工,2026-05-03 11:00:00
"""
        files = {"file": ("lab.csv", lab_csv, "text/csv")}
        client.post("/import/lab-moisture", files=files)
        
        response = client.get("/query/exceptions?is_resolved=false")
        assert response.status_code == 200
        data = response.json()
        
        moisture_exceptions = [e for e in data if e["exception_type"] == "moisture_exceed"]
        assert len(moisture_exceptions) >= 1


class TestIdempotentImport:
    def test_duplicate_file_import(self):
        csv_content = """run_id,machine_id,start_time,end_time,feed_sludge_volume,feed_sludge_concentration,dry_solids_input,batch_id
IDEMP-RUN-001,DH-01,2026-05-03 08:30:00,2026-05-03 10:30:00,120.5,4.2,5.061,
"""
        
        files = {"file": ("runs.csv", csv_content, "text/csv")}
        response1 = client.post("/import/dehydrator-runs", files=files)
        
        files = {"file": ("runs.csv", csv_content, "text/csv")}
        response2 = client.post("/import/dehydrator-runs", files=files)
        
        assert response2.json()["imported_count"] == 0


class TestReportExport:
    def test_export_csv_report(self):
        rules_data = {
            "rules": [
                {
                    "rule_id": "report_rule",
                    "name": "报告规则",
                    "type": "moisture_threshold",
                    "threshold": 80.0,
                    "priority": 1,
                    "enabled": True
                }
            ]
        }
        yaml_content = yaml.dump(rules_data, allow_unicode=True)
        files = {"file": ("rules.yaml", yaml_content, "application/x-yaml")}
        client.post("/import/review-rules", files=files)
        
        jsonl_lines = [
            json.dumps({
                "batch_id": "REP-BATCH-001",
                "chemical_type": "PAM",
                "concentration": 0.1,
                "dosage_rate_target": 3.5,
                "start_time": "2026-05-03 08:00:00",
                "end_time": "2026-05-03 16:00:00",
                "total_chemical_used": 45.0,
                "supplier": "测试"
            }, ensure_ascii=False)
        ]
        jsonl_content = "\n".join(jsonl_lines)
        files = {"file": ("batches.jsonl", jsonl_content, "application/jsonl")}
        client.post("/import/chemical-batches", files=files)
        
        csv_content = """run_id,machine_id,start_time,end_time,feed_sludge_volume,feed_sludge_concentration,dry_solids_input,batch_id
REP-RUN-001,DH-01,2026-05-03 08:30:00,2026-05-03 10:30:00,120.5,4.2,5.061,REP-BATCH-001
"""
        files = {"file": ("runs.csv", csv_content, "text/csv")}
        client.post("/import/dehydrator-runs", files=files)
        
        response = client.get("/report/csv?start_date=2026-05-03&end_date=2026-05-03")
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("content-type", "")
    
    def test_export_markdown_report(self):
        response = client.get("/report/markdown?start_date=2026-05-03&end_date=2026-05-03")
        assert response.status_code == 200
        assert "text/markdown" in response.headers.get("content-type", "")


class TestExceptionReview:
    def test_exception_stats(self):
        response = client.get("/review/exceptions/stats?start_date=2026-05-03&end_date=2026-05-04")
        assert response.status_code == 200
        data = response.json()
        assert "total_exceptions" in data
        assert "resolved" in data
        assert "unresolved" in data
    
    def test_daily_summary(self):
        response = client.get("/review/daily-summary?summary_date=2026-05-03")
        assert response.status_code == 200
        data = response.json()
        assert "date" in data
        assert "total_runs" in data
