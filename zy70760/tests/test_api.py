import pytest
from fastapi.testclient import TestClient


class TestWheelAPI:
    def test_upload_wheel(self, client, sample_wheel_file):
        buffer, filename = sample_wheel_file
        response = client.post(
            "/api/wheels",
            files={"file": (filename, buffer, "application/octet-stream")}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["filename"] == filename
        assert data["package_name"] == "test_package"
        assert data["package_version"] == "1.0.0"
        assert data["platform_tag"] == "any"
        assert data["status"] == "pending"

    def test_upload_duplicate_wheel(self, client, sample_wheel_file):
        buffer, filename = sample_wheel_file
        buffer.seek(0)
        client.post(
            "/api/wheels",
            files={"file": (filename, buffer, "application/octet-stream")}
        )

        buffer.seek(0)
        response = client.post(
            "/api/wheels",
            files={"file": (filename, buffer, "application/octet-stream")}
        )
        assert response.status_code == 409

    def test_upload_invalid_file(self, client):
        response = client.post(
            "/api/wheels",
            files={"file": ("test.txt", b"invalid content", "text/plain")}
        )
        assert response.status_code == 400

    def test_list_wheels(self, client, sample_wheel_file):
        buffer, filename = sample_wheel_file
        client.post(
            "/api/wheels",
            files={"file": (filename, buffer, "application/octet-stream")}
        )

        response = client.get("/api/wheels")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_get_wheel_detail(self, client, sample_wheel_file):
        buffer, filename = sample_wheel_file
        upload_response = client.post(
            "/api/wheels",
            files={"file": (filename, buffer, "application/octet-stream")}
        )
        wheel_id = upload_response.json()["id"]

        response = client.get(f"/api/wheels/{wheel_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == wheel_id
        assert "metadata" in data
        assert "entry_points" in data
        assert "dependencies" in data

    def test_get_nonexistent_wheel(self, client):
        response = client.get("/api/wheels/99999")
        assert response.status_code == 404

    def test_validate_wheel(self, client, sample_wheel_file):
        buffer, filename = sample_wheel_file
        upload_response = client.post(
            "/api/wheels",
            files={"file": (filename, buffer, "application/octet-stream")}
        )
        wheel_id = upload_response.json()["id"]

        response = client.post(f"/api/wheels/{wheel_id}/validate")
        assert response.status_code == 200
        data = response.json()
        assert "overall_status" in data
        assert data["platform_tag_check"] is True

    def test_update_status(self, client, sample_wheel_file):
        buffer, filename = sample_wheel_file
        upload_response = client.post(
            "/api/wheels",
            files={"file": (filename, buffer, "application/octet-stream")}
        )
        wheel_id = upload_response.json()["id"]

        response = client.put(
            f"/api/wheels/{wheel_id}/status",
            json={
                "new_status": "validating",
                "actor": "test_user",
                "reason": "Starting validation"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "validating"

    def test_update_invalid_status(self, client, sample_wheel_file):
        buffer, filename = sample_wheel_file
        upload_response = client.post(
            "/api/wheels",
            files={"file": (filename, buffer, "application/octet-stream")}
        )
        wheel_id = upload_response.json()["id"]

        response = client.put(
            f"/api/wheels/{wheel_id}/status",
            json={
                "new_status": "invalid_status",
                "actor": "test_user"
            }
        )
        assert response.status_code == 400

    def test_manual_correction(self, client, sample_wheel_file):
        buffer, filename = sample_wheel_file
        upload_response = client.post(
            "/api/wheels",
            files={"file": (filename, buffer, "application/octet-stream")}
        )
        wheel_id = upload_response.json()["id"]

        response = client.post(
            f"/api/wheels/{wheel_id}/manual-correction",
            json={
                "corrected_platform_tag": "win_amd64",
                "corrected_dependencies": [
                    {"name": "requests", "specifier": ">=2.25.0"}
                ],
                "handler": "test_user",
                "notes": "Corrected platform tag for Windows"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "manual_review"

    def test_exception_path(self, client, sample_wheel_file):
        buffer, filename = sample_wheel_file
        upload_response = client.post(
            "/api/wheels",
            files={"file": (filename, buffer, "application/octet-stream")}
        )
        wheel_id = upload_response.json()["id"]

        response = client.post(
            f"/api/wheels/{wheel_id}/exception-path",
            json={
                "original_input": "Original wheel had wrong dependency",
                "handler": "test_user",
                "conclusion": "Approved with exception",
                "notes": "Internal package only"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "manual_review"
        assert len(data["exception_paths"]) >= 1

    def test_withdraw_wheel(self, client, sample_wheel_file):
        buffer, filename = sample_wheel_file
        upload_response = client.post(
            "/api/wheels",
            files={"file": (filename, buffer, "application/octet-stream")}
        )
        wheel_id = upload_response.json()["id"]

        response = client.post(
            f"/api/wheels/{wheel_id}/withdraw",
            params={"actor": "test_user", "reason": "Security issue"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "withdrawn"

    def test_close_wheel(self, client, sample_wheel_file):
        buffer, filename = sample_wheel_file
        upload_response = client.post(
            "/api/wheels",
            files={"file": (filename, buffer, "application/octet-stream")}
        )
        wheel_id = upload_response.json()["id"]

        response = client.post(
            f"/api/wheels/{wheel_id}/close",
            params={"actor": "test_user", "reason": "Issue resolved"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "closed"

    def test_export_report_json(self, client, sample_wheel_file):
        buffer, filename = sample_wheel_file
        upload_response = client.post(
            "/api/wheels",
            files={"file": (filename, buffer, "application/octet-stream")}
        )
        wheel_id = upload_response.json()["id"]

        response = client.get(f"/api/wheels/{wheel_id}/export?format=json")
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"

    def test_export_report_txt(self, client, sample_wheel_file):
        buffer, filename = sample_wheel_file
        upload_response = client.post(
            "/api/wheels",
            files={"file": (filename, buffer, "application/octet-stream")}
        )
        wheel_id = upload_response.json()["id"]

        response = client.get(f"/api/wheels/{wheel_id}/export?format=txt")
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/plain; charset=utf-8"

    def test_export_invalid_format(self, client, sample_wheel_file):
        buffer, filename = sample_wheel_file
        upload_response = client.post(
            "/api/wheels",
            files={"file": (filename, buffer, "application/octet-stream")}
        )
        wheel_id = upload_response.json()["id"]

        response = client.get(f"/api/wheels/{wheel_id}/export?format=xml")
        assert response.status_code == 400

    def test_get_statuses(self, client):
        response = client.get("/api/statuses")
        assert response.status_code == 200
        data = response.json()
        assert "statuses" in data
        assert "pending" in data["statuses"]
        assert "passed" in data["statuses"]
        assert "failed" in data["statuses"]
