import pytest
import os
import tempfile
import shutil
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.services.converter import (
    detect_encoding, normalize_column_name,
    compute_file_hash, parse_csv_with_encoding
)


@pytest.fixture(scope="function")
def db_engine():
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "test.db")
    engine = create_engine(
        f"sqlite:///{db_path}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture(scope="function")
def db_session(db_engine):
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = TestingSessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def cleanup_files():
    yield
    if os.path.exists("./uploads"):
        shutil.rmtree("./uploads", ignore_errors=True)
    if os.path.exists("./output"):
        shutil.rmtree("./output", ignore_errors=True)


class TestConverterCore:
    def test_detect_encoding_utf8(self):
        content = "测试内容,123".encode("utf-8")
        encoding, confidence = detect_encoding(content)
        assert encoding.lower() in ["utf-8", "ascii"]

    def test_normalize_column_name(self):
        assert normalize_column_name("User Name") == "user_name"
        assert normalize_column_name("User-Name") == "user_name"
        assert normalize_column_name("Email@Address") == "emailaddress"
        assert normalize_column_name("  Column  Name  ") == "column_name"

    def test_compute_file_hash(self):
        content1 = b"test content"
        content2 = b"test content"
        content3 = b"different content"

        hash1 = compute_file_hash(content1)
        hash2 = compute_file_hash(content2)
        hash3 = compute_file_hash(content3)

        assert hash1 == hash2
        assert hash1 != hash3

    def test_parse_csv_with_encoding(self):
        csv_content = "ID,Name,Value\n1,Alice,100\n2,Bob,200\n"
        headers, rows, bad_rows = parse_csv_with_encoding(
            csv_content.encode("utf-8"), "utf-8"
        )

        assert len(headers) == 3
        assert len(rows) == 2
        assert len(bad_rows) == 0


class TestAPIEndpoints:
    def test_health_check(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

    def test_root_endpoint(self, client):
        response = client.get("/")
        assert response.status_code == 200
        assert "CSV to NDJSON Converter API" in response.json()["message"]

    def test_upload_csv_success(self, client):
        csv_content = "ID,Name,Email\n1,Alice,alice@example.com\n2,Bob,bob@example.com\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_file = f.name

        try:
            with open(temp_file, "rb") as f:
                response = client.post(
                    "/api/v1/csv/upload",
                    files={"file": ("test.csv", f, "text/csv")}
                )

            assert response.status_code == 201
            data = response.json()
            assert data["file_name"] == "test.csv"
            assert data["status"] == "uploaded"
            assert "file_hash" in data
        finally:
            os.unlink(temp_file)

    def test_upload_non_csv_rejected(self, client):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("not csv content")
            temp_file = f.name

        try:
            with open(temp_file, "rb") as f:
                response = client.post(
                    "/api/v1/csv/upload",
                    files={"file": ("test.txt", f, "text/plain")}
                )

            assert response.status_code == 400
            assert "Only CSV files are allowed" in response.json()["detail"]
        finally:
            os.unlink(temp_file)

    def test_list_csv_files(self, client):
        response = client.get("/api/v1/csv?skip=0&limit=10")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_csv_file_not_found(self, client):
        response = client.get("/api/v1/csv/999999")
        assert response.status_code == 404

    def test_update_status_not_found(self, client):
        response = client.put(
            "/api/v1/csv/999999/status",
            json={
                "status": "cancelled",
                "handler": "admin",
                "conclusion": "test"
            }
        )
        assert response.status_code == 404


class TestIdempotency:
    def test_same_file_upload_idempotent(self, client):
        csv_content = "ID,Name\n1,Alice\n2,Bob\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_file = f.name

        try:
            with open(temp_file, "rb") as f:
                response1 = client.post(
                    "/api/v1/csv/upload",
                    files={"file": ("test.csv", f, "text/csv")}
                )

            with open(temp_file, "rb") as f:
                response2 = client.post(
                    "/api/v1/csv/upload",
                    files={"file": ("test.csv", f, "text/csv")}
                )

            assert response1.status_code == 201
            assert response2.status_code == 201

            assert response1.json()["id"] == response2.json()["id"]
            assert response1.json()["file_hash"] == response2.json()["file_hash"]
        finally:
            os.unlink(temp_file)


class TestConversionFlow:
    def test_full_conversion_flow(self, client):
        csv_content = "ID,Name,Email\n1,Alice,alice@example.com\n2,Bob,bob@example.com\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_file = f.name

        try:
            with open(temp_file, "rb") as f:
                upload_response = client.post(
                    "/api/v1/csv/upload",
                    files={"file": ("test.csv", f, "text/csv")}
                )

            file_id = upload_response.json()["id"]
            assert upload_response.status_code == 201

            detail_response = client.get(f"/api/v1/csv/{file_id}")
            assert detail_response.status_code == 200
            assert len(detail_response.json()["column_mappings"]) == 3

            convert_response = client.post(
                f"/api/v1/csv/{file_id}/convert",
                json={"handler": "test_user", "auto_detect_encoding": True}
            )

            assert convert_response.status_code == 200
            assert convert_response.json()["success"] is True

            export_response = client.get(f"/api/v1/csv/{file_id}/export")
            assert export_response.status_code == 200
            assert "application/x-ndjson" in export_response.headers["content-type"]

            audit_response = client.get(f"/api/v1/csv/{file_id}/audit-logs")
            assert audit_response.status_code == 200
            assert len(audit_response.json()) >= 2

        finally:
            os.unlink(temp_file)

    def test_export_before_conversion_fails(self, client):
        csv_content = "ID,Name\n1,Alice\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_file = f.name

        try:
            with open(temp_file, "rb") as f:
                upload_response = client.post(
                    "/api/v1/csv/upload",
                    files={"file": ("test.csv", f, "text/csv")}
                )

            file_id = upload_response.json()["id"]

            export_response = client.get(f"/api/v1/csv/{file_id}/export")
            assert export_response.status_code == 400
            assert "File not yet converted" in export_response.json()["detail"]

        finally:
            os.unlink(temp_file)

    def test_cancel_status_flow(self, client):
        csv_content = "ID,Name\n1,Alice\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_file = f.name

        try:
            with open(temp_file, "rb") as f:
                upload_response = client.post(
                    "/api/v1/csv/upload",
                    files={"file": ("test.csv", f, "text/csv")}
                )

            file_id = upload_response.json()["id"]

            status_response = client.put(
                f"/api/v1/csv/{file_id}/status",
                json={
                    "status": "cancelled",
                    "handler": "admin",
                    "conclusion": "Cancelled for testing"
                }
            )

            assert status_response.status_code == 200
            assert status_response.json()["status"] == "cancelled"

        finally:
            os.unlink(temp_file)

    def test_delete_csv_file(self, client):
        csv_content = "ID,Name\n1,Alice\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_file = f.name

        try:
            with open(temp_file, "rb") as f:
                upload_response = client.post(
                    "/api/v1/csv/upload",
                    files={"file": ("test.csv", f, "text/csv")}
                )

            file_id = upload_response.json()["id"]

            delete_response = client.delete(f"/api/v1/csv/{file_id}")
            assert delete_response.status_code == 200
            assert delete_response.json()["file_id"] == file_id

            get_response = client.get(f"/api/v1/csv/{file_id}")
            assert get_response.status_code == 404

        finally:
            os.unlink(temp_file)
