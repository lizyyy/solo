import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import Base, get_db
from main import app

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
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
def cleanup():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

def test_create_directory():
    response = client.post(
        "/directories/",
        params={"use_sample_data": True},
        json={
            "directory_path": "/test/invoices",
            "reimbursement_data": [
                {
                    "reimbursement_id": "BX2024001",
                    "invoice_code": "123456789012",
                    "invoice_number": "12345678",
                    "amount": 1500.00,
                    "applicant": "张三",
                    "department": "财务部"
                }
            ]
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["directory_path"] == "/test/invoices"
    assert data["status"] == "parsing"
    assert "id" in data

def test_create_directory_without_sample():
    response = client.post(
        "/directories/",
        json={
            "directory_path": "/test/empty",
            "reimbursement_data": []
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["directory_path"] == "/test/empty"
    
    response = client.get(f"/directories/{data['id']}/invoices")
    invoices = response.json()
    assert len(invoices) == 0

def test_scan_and_create_directory():
    response = client.post(
        "/directories/scan",
        json={
            "directory_path": "/test/scan_test",
            "use_sample_data": True,
            "reimbursement_data": []
        }
    )
    assert response.status_code == 200
    result = response.json()
    assert result["files_scanned"] == 5
    assert "directory_id" in result

def test_scan_nonexistent_directory():
    response = client.post(
        "/directories/scan",
        json={
            "directory_path": "/nonexistent/path/that/doesnt/exist",
            "use_sample_data": False,
            "reimbursement_data": []
        }
    )
    assert response.status_code == 200
    result = response.json()
    assert result["files_scanned"] == 0

def test_process_matching():
    response = client.post(
        "/directories/scan",
        json={
            "directory_path": "/test/invoices2",
            "use_sample_data": True,
            "reimbursement_data": [
                {
                    "reimbursement_id": "BX2024001",
                    "invoice_code": "123456789012",
                    "invoice_number": "12345678",
                    "amount": 1500.00
                }
            ]
        }
    )
    directory_id = response.json()["directory_id"]
    
    response = client.post(f"/directories/{directory_id}/process")
    assert response.status_code == 200
    assert response.json()["message"] == "Processing completed"

def test_duplicate_detection():
    response = client.post(
        "/directories/scan",
        json={
            "directory_path": "/test/duplicate",
            "use_sample_data": True,
            "reimbursement_data": []
        }
    )
    directory_id = response.json()["directory_id"]
    
    client.post(f"/directories/{directory_id}/process")
    
    response = client.get(f"/directories/{directory_id}/invoices")
    invoices = response.json()
    
    has_duplicate = any(inv["is_duplicate"] for inv in invoices)
    assert has_duplicate, "应该检测到重复票据"

def test_missing_fields_detection():
    response = client.post(
        "/directories/scan",
        json={
            "directory_path": "/test/missing",
            "use_sample_data": True,
            "reimbursement_data": []
        }
    )
    directory_id = response.json()["directory_id"]
    
    client.post(f"/directories/{directory_id}/process")
    
    response = client.get(f"/directories/{directory_id}/matching-results")
    results = response.json()
    
    has_missing = any(len(r["missing_fields"]) > 0 for r in results)
    assert has_missing, "应该检测到字段缺失"

def test_import_invoice_files():
    response = client.post(
        "/directories/",
        json={
            "directory_path": "/test/import",
            "reimbursement_data": []
        }
    )
    directory_id = response.json()["id"]
    
    response = client.post(
        f"/directories/{directory_id}/import-files",
        json={
            "directory_id": directory_id,
            "filenames": [
                "BX2024005_发票_999.99.jpg",
                "报销单_BX2024006_1999.99.png"
            ]
        }
    )
    assert response.status_code == 200
    result = response.json()
    assert result["files_scanned"] == 2
    
    response = client.get(f"/directories/{directory_id}/invoices")
    invoices = response.json()
    assert len(invoices) == 2

def test_manual_correction():
    response = client.post(
        "/directories/scan",
        json={
            "directory_path": "/test/correction",
            "use_sample_data": True,
            "reimbursement_data": []
        }
    )
    directory_id = response.json()["directory_id"]
    
    response = client.get(f"/directories/{directory_id}/invoices")
    invoices = response.json()
    invoice_id = invoices[0]["id"]
    
    response = client.post(
        "/invoices/manual-correction",
        json={
            "invoice_id": invoice_id,
            "invoice_code": "999999999999",
            "invoice_number": "88888888",
            "reimbursement_id": "BX2024999",
            "amount": 999.99,
            "processed_by": "tester",
            "reason": "测试人工修正"
        }
    )
    assert response.status_code == 200
    corrected = response.json()
    assert corrected["invoice_code"] == "999999999999"
    assert corrected["amount"] == 999.99
    assert corrected["status"] == "manual_corrected"

def test_audit_log():
    response = client.post(
        "/directories/scan",
        json={
            "directory_path": "/test/audit",
            "use_sample_data": True,
            "reimbursement_data": []
        }
    )
    directory_id = response.json()["directory_id"]
    
    response = client.get(f"/directories/{directory_id}/invoices")
    invoice_id = response.json()[0]["id"]
    
    client.post(
        "/invoices/manual-correction",
        json={
            "invoice_id": invoice_id,
            "invoice_code": "111111111111",
            "processed_by": "tester",
            "reason": "测试审计日志"
        }
    )
    
    response = client.get(f"/directories/{directory_id}/audit-logs")
    logs = response.json()
    assert len(logs) >= 1
    assert logs[0]["action"] == "manual_correction"
    assert logs[0]["processed_by"] == "tester"

def test_withdraw_directory():
    response = client.post(
        "/directories/scan",
        json={
            "directory_path": "/test/withdraw",
            "use_sample_data": True,
            "reimbursement_data": []
        }
    )
    directory_id = response.json()["directory_id"]
    
    response = client.post(
        f"/directories/{directory_id}/withdraw",
        params={
            "processed_by": "manager",
            "reason": "测试撤回功能"
        }
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Directory withdrawn"
    
    response = client.get(f"/directories/{directory_id}")
    assert response.json()["status"] == "withdrawn"

def test_close_directory():
    response = client.post(
        "/directories/scan",
        json={
            "directory_path": "/test/close",
            "use_sample_data": True,
            "reimbursement_data": []
        }
    )
    directory_id = response.json()["directory_id"]
    
    response = client.post(
        f"/directories/{directory_id}/close",
        params={
            "processed_by": "manager",
            "note": "测试关闭功能"
        }
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Directory closed"
    
    response = client.get(f"/directories/{directory_id}")
    assert response.json()["status"] == "closed"

def test_generate_report():
    response = client.post(
        "/directories/scan",
        json={
            "directory_path": "/test/report",
            "use_sample_data": True,
            "reimbursement_data": []
        }
    )
    directory_id = response.json()["directory_id"]
    
    client.post(f"/directories/{directory_id}/process")
    
    response = client.post(
        "/reports/",
        params={
            "directory_id": directory_id,
            "generated_by": "tester"
        }
    )
    assert response.status_code == 200
    report = response.json()
    assert report["total_files"] == 5
    assert "report_content" in report

def test_export_report():
    response = client.post(
        "/directories/scan",
        json={
            "directory_path": "/test/export",
            "use_sample_data": True,
            "reimbursement_data": []
        }
    )
    directory_id = response.json()["directory_id"]
    
    client.post(f"/directories/{directory_id}/process")
    
    report_response = client.post(
        "/reports/",
        params={"directory_id": directory_id}
    )
    report_id = report_response.json()["id"]
    
    response = client.get(f"/reports/{report_id}/export")
    assert response.status_code == 200
    export_data = response.json()
    assert export_data["report_id"] == report_id
    assert "content" in export_data
    assert "summary" in export_data["content"]

def test_directory_overview():
    response = client.post(
        "/directories/scan",
        json={
            "directory_path": "/test/overview",
            "use_sample_data": True,
            "reimbursement_data": []
        }
    )
    directory_id = response.json()["directory_id"]
    
    client.post(f"/directories/{directory_id}/process")
    
    response = client.get(f"/directories/{directory_id}/overview")
    assert response.status_code == 200
    overview = response.json()
    assert overview["directory_id"] == directory_id
    assert overview["total_invoices"] == 5
    assert "matched_count" in overview
    assert "duplicate_count" in overview
    assert "missing_count" in overview

def test_supported_formats():
    response = client.get("/supported-formats")
    assert response.status_code == 200
    data = response.json()
    assert "supported_extensions" in data
    assert ".jpg" in data["supported_extensions"]
    assert ".pdf" in data["supported_extensions"]

def test_upload_file_to_nonexistent_directory():
    response = client.post(
        "/directories/99999/upload",
        files={"file": ("test.jpg", b"fake_image_content", "image/jpeg")}
    )
    assert response.status_code == 404

def test_filename_parsing():
    from utils import parse_filename
    
    filename1 = "发票扫描件_123456789012_12345678_BX2024001_1500.00.jpg"
    result1 = parse_filename(filename1)
    assert result1["invoice_code"] == "123456789012"
    assert result1["invoice_number"] == "12345678"
    assert result1["reimbursement_id"] == "BX2024001"
    assert result1["amount"] == 1500.00
    
    filename2 = "乱名文件_无法解析.pdf"
    result2 = parse_filename(filename2)
    assert result2["invoice_code"] is None
    assert result2["invoice_number"] is None
    assert result2["reimbursement_id"] is None
    assert result2["amount"] is None

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
