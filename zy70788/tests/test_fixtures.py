import pytest
import json
from app.database import FixtureStatus


class TestFixtureCreate:
    def test_create_fixture_success(self, client, sample_fixture_data):
        response = client.post("/api/v1/fixtures/", json=sample_fixture_data)
        assert response.status_code == 201
        data = response.json()
        assert data["fixture_id"].startswith("fixture_")
        assert data["status"] == "recorded"
        assert data["handler"] == "tester"
        assert "normalized_payload" in data

    def test_create_fixture_payload_normalized(self, client, sample_fixture_data):
        sample_fixture_data["raw_payload"] = '{"b":2,"a":1}'
        response = client.post("/api/v1/fixtures/", json=sample_fixture_data)
        assert response.status_code == 201
        data = response.json()
        assert data["normalized_payload"] == '{"a":1,"b":2}'

    def test_create_fixture_invalid_payload_still_saved(self, client, sample_fixture_data):
        sample_fixture_data["raw_payload"] = "not valid json"
        response = client.post("/api/v1/fixtures/", json=sample_fixture_data)
        assert response.status_code == 201
        data = response.json()
        assert data["raw_payload"] == "not valid json"


class TestFixtureQuery:
    def test_get_fixture_by_id(self, client, sample_fixture_data):
        create_response = client.post("/api/v1/fixtures/", json=sample_fixture_data)
        fixture_id = create_response.json()["fixture_id"]

        response = client.get(f"/api/v1/fixtures/{fixture_id}/")
        assert response.status_code == 200
        data = response.json()
        assert data["fixture_id"] == fixture_id
        assert "exceptions" in data

    def test_get_fixture_not_found(self, client):
        response = client.get("/api/v1/fixtures/nonexistent/")
        assert response.status_code == 404

    def test_list_fixtures(self, client, sample_fixture_data):
        for i in range(3):
            sample_fixture_data["handler"] = f"tester_{i}"
            client.post("/api/v1/fixtures/", json=sample_fixture_data)

        response = client.get("/api/v1/fixtures/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3

    def test_list_fixtures_with_status_filter(self, client, sample_fixture_data):
        create_response = client.post("/api/v1/fixtures/", json=sample_fixture_data)
        fixture_id = create_response.json()["fixture_id"]

        client.patch(
            f"/api/v1/fixtures/{fixture_id}/status/",
            json={"status": "normalized", "handler": "tester"}
        )

        response = client.get("/api/v1/fixtures/?status=normalized")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["status"] == "normalized"


class TestFixtureStatus:
    def test_update_status(self, client, sample_fixture_data):
        create_response = client.post("/api/v1/fixtures/", json=sample_fixture_data)
        fixture_id = create_response.json()["fixture_id"]

        response = client.patch(
            f"/api/v1/fixtures/{fixture_id}/status/",
            json={"status": "verified", "handler": "tester"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "verified"

    def test_update_status_not_found(self, client):
        response = client.patch(
            "/api/v1/fixtures/nonexistent/status/",
            json={"status": "verified"}
        )
        assert response.status_code == 404


class TestFixtureOperations:
    def test_manual_fix(self, client, sample_fixture_data):
        create_response = client.post("/api/v1/fixtures/", json=sample_fixture_data)
        fixture_id = create_response.json()["fixture_id"]

        fix_data = {
            "signature_headers": {"X-Signature": "new_signature_123"},
            "raw_payload": '{"fixed": true}',
            "handler": "debugger",
            "conclusion": "修正签名错误"
        }
        response = client.post(
            f"/api/v1/fixtures/{fixture_id}/fix/",
            json=fix_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["signature_headers"]["X-Signature"] == "new_signature_123"
        assert data["status"] == "normalized"

    def test_withdraw_fixture(self, client, sample_fixture_data):
        create_response = client.post("/api/v1/fixtures/", json=sample_fixture_data)
        fixture_id = create_response.json()["fixture_id"]

        response = client.post(
            f"/api/v1/fixtures/{fixture_id}/withdraw/?handler=admin&conclusion=测试数据无效"
        )
        assert response.status_code == 200
        assert response.json()["status"] == "withdrawn"

    def test_close_fixture(self, client, sample_fixture_data):
        create_response = client.post("/api/v1/fixtures/", json=sample_fixture_data)
        fixture_id = create_response.json()["fixture_id"]

        response = client.post(
            f"/api/v1/fixtures/{fixture_id}/close/?handler=admin"
        )
        assert response.status_code == 200
        assert response.json()["status"] == "closed"


class TestExceptions:
    def test_add_exception(self, client, sample_fixture_data):
        create_response = client.post("/api/v1/fixtures/", json=sample_fixture_data)
        fixture_id = create_response.json()["fixture_id"]

        exception_data = {
            "exception_type": "signature_mismatch",
            "raw_input": "signature validation failed",
            "handler": "debugger",
            "conclusion": "需要重新计算签名"
        }
        response = client.post(
            f"/api/v1/fixtures/{fixture_id}/exceptions/",
            json=exception_data
        )
        assert response.status_code == 201
        data = response.json()
        assert data["exception_type"] == "signature_mismatch"
        assert data["resolved"] is False

    def test_resolve_exception(self, client, sample_fixture_data):
        create_response = client.post("/api/v1/fixtures/", json=sample_fixture_data)
        fixture_id = create_response.json()["fixture_id"]

        exception_data = {
            "exception_type": "payload_invalid",
            "raw_input": "payload parse error",
            "handler": "debugger"
        }
        exc_response = client.post(
            f"/api/v1/fixtures/{fixture_id}/exceptions/",
            json=exception_data
        )
        exception_id = exc_response.json()["id"]

        response = client.patch(
            f"/api/v1/exceptions/{exception_id}/resolve/?conclusion=已修正&handler=debugger"
        )
        assert response.status_code == 200
        assert response.json()["resolved"] is True


class TestReportAndExport:
    def test_generate_report(self, client, sample_fixture_data):
        create_response = client.post("/api/v1/fixtures/", json=sample_fixture_data)
        fixture_id = create_response.json()["fixture_id"]

        response = client.post(f"/api/v1/fixtures/{fixture_id}/report/")
        assert response.status_code == 201
        data = response.json()
        assert "report_content" in data
        assert "replay_script_path" in data

    def test_generate_replay_script(self, client, sample_fixture_data):
        create_response = client.post("/api/v1/fixtures/", json=sample_fixture_data)
        fixture_id = create_response.json()["fixture_id"]

        response = client.post(
            f"/api/v1/fixtures/{fixture_id}/replay-script/",
            json={"target_url": "https://test.example.com/webhook"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["fixture_id"] == fixture_id
        assert "script_path" in data

    def test_export_fixture(self, client, sample_fixture_data):
        create_response = client.post("/api/v1/fixtures/", json=sample_fixture_data)
        fixture_id = create_response.json()["fixture_id"]

        response = client.get(f"/api/v1/fixtures/{fixture_id}/export/")
        assert response.status_code == 200
        data = response.json()
        assert data["fixture_id"] == fixture_id
        assert "exceptions" in data


class TestConflictScenarios:
    def test_fixture_id_unique(self, client, sample_fixture_data):
        responses = []
        for _ in range(5):
            r = client.post("/api/v1/fixtures/", json=sample_fixture_data)
            responses.append(r.json()["fixture_id"])
        
        assert len(set(responses)) == 5

    def test_concurrent_status_updates(self, client, sample_fixture_data):
        create_response = client.post("/api/v1/fixtures/", json=sample_fixture_data)
        fixture_id = create_response.json()["fixture_id"]

        r1 = client.patch(
            f"/api/v1/fixtures/{fixture_id}/status/",
            json={"status": "normalized", "handler": "handler1"}
        )
        r2 = client.patch(
            f"/api/v1/fixtures/{fixture_id}/status/",
            json={"status": "verified", "handler": "handler2"}
        )

        assert r1.status_code == 200
        assert r2.status_code == 200
        
        final_response = client.get(f"/api/v1/fixtures/{fixture_id}/")
        assert final_response.json()["status"] == "verified"


class TestHealthCheck:
    def test_health_check(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
