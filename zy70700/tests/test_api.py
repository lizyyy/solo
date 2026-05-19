from datetime import datetime, timedelta


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "MCP工具权限声明API" in response.json()["message"]


class TestTools:
    def test_create_tool(self, client):
        response = client.post(
            "/api/v1/tools/",
            json={
                "name": "new_tool",
                "mcp_server": "test_server",
                "description": "New test tool",
                "version": "1.0.0",
                "status": "active",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "new_tool"
        assert data["mcp_server"] == "test_server"
        assert data["status"] == "active"

    def test_get_tools(self, client, test_data):
        response = client.get("/api/v1/tools/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_get_tool_by_id(self, client, test_data):
        tool_id = test_data["tool"].id
        response = client.get(f"/api/v1/tools/{tool_id}")
        assert response.status_code == 200
        assert response.json()["id"] == tool_id

    def test_get_tool_not_found(self, client):
        response = client.get("/api/v1/tools/9999")
        assert response.status_code == 404

    def test_update_tool(self, client, test_data):
        tool_id = test_data["tool"].id
        response = client.put(
            f"/api/v1/tools/{tool_id}",
            json={
                "description": "Updated description",
                "version": "2.0.0",
            },
        )
        assert response.status_code == 200
        assert response.json()["description"] == "Updated description"
        assert response.json()["version"] == "2.0.0"

    def test_deactivate_tool(self, client, test_data):
        tool_id = test_data["tool"].id
        response = client.delete(f"/api/v1/tools/{tool_id}")
        assert response.status_code == 200
        assert response.json()["status"] == "inactive"


class TestPermissions:
    def test_create_declaration(self, client, test_data):
        tool_id = test_data["tool"].id
        response = client.post(
            "/api/v1/permissions/",
            json={
                "tool_id": tool_id,
                "declared_scopes": ["read:test", "write:test"],
                "declared_resources": ["/new/path"],
                "declared_actions": ["new_action"],
                "declared_description": "New declaration",
                "declared_by": "tester@example.com",
            },
        )
        assert response.status_code == 200
        assert response.json()["tool_id"] == tool_id
        assert "read:test" in response.json()["declared_scopes"]

    def test_get_declarations(self, client, test_data):
        response = client.get("/api/v1/permissions/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_get_declaration(self, client, test_data):
        decl_id = test_data["declaration"].id
        response = client.get(f"/api/v1/permissions/{decl_id}")
        assert response.status_code == 200
        assert response.json()["id"] == decl_id

    def test_deactivate_declaration(self, client, test_data):
        decl_id = test_data["declaration"].id
        response = client.delete(f"/api/v1/permissions/{decl_id}")
        assert response.status_code == 200
        assert response.json()["is_active"] == False


class TestCalls:
    def test_record_call(self, client, test_data):
        tool_id = test_data["tool"].id
        response = client.post(
            "/api/v1/calls/",
            json={
                "tool_id": tool_id,
                "call_id": "new_test_call_001",
                "actual_scopes": ["read:test"],
                "actual_resources": ["/test/data"],
                "actual_actions": ["action1"],
                "caller": "user@example.com",
            },
        )
        assert response.status_code == 200
        assert response.json()["call_id"] == "new_test_call_001"

    def test_get_calls(self, client, test_data):
        response = client.get("/api/v1/calls/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_get_call(self, client, test_data):
        call_id = test_data["call"].call_id
        response = client.get(f"/api/v1/calls/{call_id}")
        assert response.status_code == 200
        assert response.json()["call_id"] == call_id

    def test_archive_call(self, client, test_data):
        call_id = test_data["call"].call_id
        response = client.post(f"/api/v1/calls/{call_id}/archive")
        assert response.status_code == 200
        assert response.json()["archived"] == True


class TestApprovals:
    def test_create_batch(self, client):
        response = client.post(
            "/api/v1/approvals/",
            json={
                "batch_number": "NEW-TEST-002",
                "title": "New Test Batch",
                "description": "New batch description",
                "submitter": "admin@example.com",
            },
        )
        assert response.status_code == 200
        assert response.json()["batch_number"] == "NEW-TEST-002"

    def test_get_batches(self, client, test_data):
        response = client.get("/api/v1/approvals/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_get_batch(self, client, test_data):
        batch_id = test_data["batch"].id
        response = client.get(f"/api/v1/approvals/{batch_id}")
        assert response.status_code == 200
        assert response.json()["id"] == batch_id

    def test_approve_batch(self, client, test_data):
        batch_number = test_data["batch"].batch_number
        response = client.post(
            "/api/v1/approvals/approve",
            json={
                "batch_number": batch_number,
                "approver": "approver@example.com",
                "notes": "Approved for testing",
            },
        )
        assert response.status_code == 200
        assert response.json()["status"] == "approved"
        assert response.json()["approver"] == "approver@example.com"

    def test_reject_batch(self, client, test_data):
        batch_id = test_data["batch"].id
        response = client.post(
            f"/api/v1/approvals/{batch_id}/reject",
            json={
                "status": "rejected",
                "operator": "reviewer@example.com",
                "notes": "Rejected due to issues",
            },
        )
        assert response.status_code == 200
        assert response.json()["status"] == "rejected"

    def test_close_batch(self, client, test_data):
        batch_id = test_data["batch"].id
        response = client.post(
            f"/api/v1/approvals/{batch_id}/close",
            json={
                "status": "closed",
                "operator": "admin@example.com",
                "notes": "Batch closed",
            },
        )
        assert response.status_code == 200
        assert response.json()["status"] == "closed"


class TestExceptions:
    def test_create_exception(self, client, test_data):
        batch_id = test_data["batch"].id
        tool_id = test_data["tool"].id
        response = client.post(
            "/api/v1/exceptions/",
            json={
                "batch_id": batch_id,
                "tool_id": tool_id,
                "title": "New Exception",
                "description": "New exception description",
                "exception_type": "scope_mismatch",
                "original_input": {"call_id": "test_call", "actual_scopes": ["extra"]},
            },
        )
        assert response.status_code == 200
        assert response.json()["title"] == "New Exception"
        assert response.json()["status"] == "open"

    def test_get_exceptions(self, client, test_data):
        response = client.get("/api/v1/exceptions/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_get_exception(self, client, test_data):
        exc_id = test_data["exception"].id
        response = client.get(f"/api/v1/exceptions/{exc_id}")
        assert response.status_code == 200
        assert response.json()["id"] == exc_id

    def test_resolve_exception(self, client, test_data):
        exc_id = test_data["exception"].id
        response = client.post(
            f"/api/v1/exceptions/{exc_id}/resolve",
            json={
                "status": "resolved",
                "handler": "reviewer@example.com",
                "handling_conclusion": "Exception resolved",
                "handling_notes": "Issue has been fixed",
            },
        )
        assert response.status_code == 200
        assert response.json()["status"] == "resolved"

    def test_dismiss_exception(self, client, test_data):
        exc_id = test_data["exception"].id
        response = client.post(
            f"/api/v1/exceptions/{exc_id}/dismiss",
            json={
                "status": "dismissed",
                "handler": "admin@example.com",
                "handling_conclusion": "Exception dismissed",
                "handling_notes": "This was a false positive",
            },
        )
        assert response.status_code == 200
        assert response.json()["status"] == "dismissed"


class TestAudit:
    def test_generate_summary(self, client, test_data):
        now = datetime.utcnow()
        start_date = (now - timedelta(days=30)).isoformat()
        end_date = now.isoformat()

        response = client.post(
            "/api/v1/audit/summaries",
            json={
                "summary_id": "AUDIT-TEST-001",
                "title": "Test Audit Summary",
                "audit_period_start": start_date,
                "audit_period_end": end_date,
                "generated_by": "admin@example.com",
            },
        )
        assert response.status_code == 200
        assert response.json()["summary_id"] == "AUDIT-TEST-001"
        assert response.json()["total_tools"] >= 1
        assert response.json()["total_declarations"] >= 1

    def test_get_summaries(self, client, test_data):
        response = client.get("/api/v1/audit/summaries")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_export_summary(self, client, test_data):
        now = datetime.utcnow()
        start_date = (now - timedelta(days=30)).isoformat()
        end_date = now.isoformat()

        client.post(
            "/api/v1/audit/summaries",
            json={
                "summary_id": "AUDIT-EXPORT-TEST",
                "title": "Export Test",
                "audit_period_start": start_date,
                "audit_period_end": end_date,
                "generated_by": "admin@example.com",
            },
        )

        response = client.post(
            "/api/v1/audit/summaries/AUDIT-EXPORT-TEST/export"
        )
        assert response.status_code == 200
        assert response.json()["exported_at"] is not None
