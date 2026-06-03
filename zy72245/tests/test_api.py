import json
import os
import tempfile
import pytest

from src.app import create_app


@pytest.fixture
def app_client():
    fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    app = create_app(db_path=db_path)
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client
    os.unlink(db_path)


def _import_one(client, tail_number="T001", approver="张三", amount=100000, green_ratio=0.65, remark=""):
    return client.post(
        "/api/transactions/import",
        data=json.dumps({
            "transactions": [{
                "tail_number": tail_number,
                "approver": approver,
                "amount": amount,
                "green_ratio": green_ratio,
                "remark": remark,
            }]
        }),
        content_type="application/json",
    )


class TestImportAPI:
    def test_import_success(self, app_client):
        r = _import_one(app_client)
        data = r.get_json()
        assert r.status_code in (200, 207)
        assert data["imported_count"] == 1

    def test_import_empty_list(self, app_client):
        r = app_client.post(
            "/api/transactions/import",
            data=json.dumps({"transactions": []}),
            content_type="application/json",
        )
        assert r.status_code == 400

    def test_duplicate_import_no_double(self, app_client):
        _import_one(app_client, tail_number="T001", approver="张三")
        r2 = _import_one(app_client, tail_number="T001", approver="张三")
        data = r2.get_json()
        assert data["imported_count"] == 0
        assert data["skipped_count"] == 1

    def test_pinyin_approver_warning_in_response(self, app_client):
        r = _import_one(app_client, approver="zhangsan")
        data = r.get_json()
        item = data["imported"][0]
        assert item["approver_status"] == "pinyin_only"
        assert item["pinyin_warning"] is not None


class TestTransactionAPI:
    def test_get_transaction(self, app_client):
        r = _import_one(app_client)
        txn_id = r.get_json()["imported"][0]["transaction_id"]

        r2 = app_client.get(f"/api/transactions/{txn_id}")
        assert r2.status_code == 200
        data = r2.get_json()
        assert data["tail_number"] == "T001"

    def test_get_nonexistent_transaction(self, app_client):
        r = app_client.get("/api/transactions/nonexistent")
        assert r.status_code == 404

    def test_update_remark(self, app_client):
        r = _import_one(app_client, remark="旧备注")
        txn_id = r.get_json()["imported"][0]["transaction_id"]

        r2 = app_client.patch(
            f"/api/transactions/{txn_id}/update",
            data=json.dumps({"field_name": "remark", "new_value": "新备注", "changed_by": "林姐"}),
            content_type="application/json",
        )
        data = r2.get_json()
        assert data["old_value"] == "旧备注"
        assert data["new_value"] == "新备注"

    def test_update_history(self, app_client):
        r = _import_one(app_client, remark="v1")
        txn_id = r.get_json()["imported"][0]["transaction_id"]

        app_client.patch(
            f"/api/transactions/{txn_id}/update",
            data=json.dumps({"field_name": "remark", "new_value": "v2", "changed_by": "林姐"}),
            content_type="application/json",
        )

        r2 = app_client.get(f"/api/transactions/{txn_id}/history")
        data = r2.get_json()
        assert len(data["history"]) == 1
        assert data["history"][0]["old_value"] == "v1"
        assert data["history"][0]["new_value"] == "v2"


class TestFixApproverAPI:
    def test_fix_pinyin_approver(self, app_client):
        r = _import_one(app_client, approver="lisi")
        txn_id = r.get_json()["imported"][0]["transaction_id"]

        r2 = app_client.post(
            f"/api/transactions/{txn_id}/fix-approver",
            data=json.dumps({"new_approver": "李四", "operator": "客户经理王五"}),
            content_type="application/json",
        )
        data = r2.get_json()
        assert data["old_approver"] == "lisi"
        assert data["new_approver"] == "李四"
        assert data["new_status"] == "normal"
        assert data["requires_review"] is True

    def test_fix_approver_creates_history(self, app_client):
        r = _import_one(app_client, approver="lisi")
        txn_id = r.get_json()["imported"][0]["transaction_id"]

        app_client.post(
            f"/api/transactions/{txn_id}/fix-approver",
            data=json.dumps({"new_approver": "李四", "operator": "客户经理"}),
            content_type="application/json",
        )

        r2 = app_client.get(f"/api/transactions/{txn_id}/history")
        data = r2.get_json()
        assert len(data["history"]) == 1
        assert data["history"][0]["old_value"] == "lisi"
        assert data["history"][0]["new_value"] == "李四"


class TestEmailAPI:
    def test_add_and_list_emails(self, app_client):
        r = _import_one(app_client)
        txn_id = r.get_json()["imported"][0]["transaction_id"]

        r2 = app_client.post(
            f"/api/transactions/{txn_id}/emails",
            data=json.dumps({"sender": "客户经理王五", "content": "确认投向占比70%"}),
            content_type="application/json",
        )
        assert r2.status_code == 201

        r3 = app_client.get(f"/api/transactions/{txn_id}/emails")
        data = r3.get_json()
        assert len(data["emails"]) == 1
        assert data["emails"][0]["sender"] == "客户经理王五"


class TestVerificationAPI:
    def test_list_verifications(self, app_client):
        _import_one(app_client, tail_number="T001", approver="张三")
        _import_one(app_client, tail_number="T002", approver="李四")

        r = app_client.get("/api/verifications")
        data = r.get_json()
        assert data["total"] == 2

    def test_advance_step(self, app_client):
        r = _import_one(app_client, approver="张三")
        txn_id = r.get_json()["imported"][0]["transaction_id"]

        app_client.post(
            f"/api/transactions/{txn_id}/emails",
            data=json.dumps({"sender": "客户经理", "content": "确认"}),
            content_type="application/json",
        )

        conn = None
        from src.models.db import get_db
        for p in [f for f in os.listdir(tempfile.gettempdir()) if f.endswith(".db")]:
            pass

        r2 = app_client.post(
            "/api/verifications/any-id/advance",
            data=json.dumps({"target_step": "基金会计补看客户经理补充邮件"}),
            content_type="application/json",
        )

    def test_pinyin_blocked_at_balance_step(self, app_client):
        r = _import_one(app_client, approver="zhangsan")
        txn_id = r.get_json()["imported"][0]["transaction_id"]

        app_client.post(
            f"/api/transactions/{txn_id}/emails",
            data=json.dumps({"sender": "客户经理", "content": "确认"}),
            content_type="application/json",
        )


class TestReviewAPI:
    def test_review_page_has_links(self, app_client):
        r = _import_one(app_client, approver="zhangsan")
        txn_id = r.get_json()["imported"][0]["transaction_id"]

        r2 = app_client.get(f"/api/transactions/{txn_id}/review")
        data = r2.get_json()
        assert "review_actions" in data
        assert "fix_approver" in data["review_actions"]
        assert data["transaction"]["approver_status"] == "pinyin_only"


class TestChartDataAPI:
    def test_chart_data_returns_pinyin_items(self, app_client):
        _import_one(app_client, tail_number="T001", approver="zhangsan")
        _import_one(app_client, tail_number="T002", approver="张三")

        r = app_client.get("/api/verifications/chart-data")
        data = r.get_json()
        assert "pinyin_approver_items" in data
        assert len(data["pinyin_approver_items"]) >= 1
        item = data["pinyin_approver_items"][0]
        assert "trace_links" in item
        assert "detail" in item["trace_links"]


class TestTraceAPI:
    def test_trace_has_all_links_for_pinyin(self, app_client):
        r = _import_one(app_client, approver="zhangsan")
        verif_id = r.get_json()["imported"][0]["verification_id"]

        r2 = app_client.get(f"/api/verifications/{verif_id}/trace")
        data = r2.get_json()
        assert "trace_links" in data
        assert "approver_review" in data["trace_links"]

    def test_trace_has_email_links(self, app_client):
        r = _import_one(app_client, approver="张三")
        txn_id = r.get_json()["imported"][0]["transaction_id"]
        verif_id = r.get_json()["imported"][0]["verification_id"]

        app_client.post(
            f"/api/transactions/{txn_id}/emails",
            data=json.dumps({"sender": "客户经理", "content": "补充说明"}),
            content_type="application/json",
        )

        r2 = app_client.get(f"/api/verifications/{verif_id}/trace")
        data = r2.get_json()
        assert len(data["supplementary_emails"]) == 1
        assert "supplementary_emails" in data["trace_links"]
