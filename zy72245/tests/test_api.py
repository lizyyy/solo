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
        assert data["review_required"] == 0

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
        assert data["review_required"] is True

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


class TestConfirmReviewAPI:
    def test_confirm_review_after_fix(self, app_client):
        r = _import_one(app_client, approver="zhangsan")
        txn_id = r.get_json()["imported"][0]["transaction_id"]

        app_client.post(
            f"/api/transactions/{txn_id}/fix-approver",
            data=json.dumps({"new_approver": "张三", "operator": "客户经理王五"}),
            content_type="application/json",
        )

        r2 = app_client.post(
            f"/api/transactions/{txn_id}/confirm-review",
            data=json.dumps({"reviewer": "客户经理王五"}),
            content_type="application/json",
        )
        data = r2.get_json()
        assert data["review_required"] is False

    def test_confirm_review_noop_when_not_required(self, app_client):
        r = _import_one(app_client, approver="张三")
        txn_id = r.get_json()["imported"][0]["transaction_id"]

        r2 = app_client.post(
            f"/api/transactions/{txn_id}/confirm-review",
            data=json.dumps({"reviewer": "林姐"}),
            content_type="application/json",
        )
        data = r2.get_json()
        assert "无需复核" in data["message"]


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


class TestReviewAPI:
    def test_review_page_has_links(self, app_client):
        r = _import_one(app_client, approver="zhangsan")
        txn_id = r.get_json()["imported"][0]["transaction_id"]

        r2 = app_client.get(f"/api/transactions/{txn_id}/review")
        data = r2.get_json()
        assert "review_actions" in data
        assert "fix_approver" in data["review_actions"]
        assert "confirm_review" in data["review_actions"]
        assert data["transaction"]["approver_status"] == "pinyin_only"

    def test_review_page_shows_hint_after_fix(self, app_client):
        r = _import_one(app_client, approver="zhangsan")
        txn_id = r.get_json()["imported"][0]["transaction_id"]

        app_client.post(
            f"/api/transactions/{txn_id}/fix-approver",
            data=json.dumps({"new_approver": "张三", "operator": "客户经理"}),
            content_type="application/json",
        )

        r2 = app_client.get(f"/api/transactions/{txn_id}/review")
        data = r2.get_json()
        assert data["transaction"]["review_required"] == 1
        assert "confirm_review_hint" in data["review_actions"]


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

    def test_trace_email_links_use_correct_route(self, app_client):
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
        for link in data["trace_links"]["supplementary_emails"]:
            assert "/api/emails/" not in link
            assert "/api/transactions/" in link


class TestEndToEndAPIWorkflow:
    def test_full_pinyin_fix_confirm_balance_via_api(self, app_client):
        r = _import_one(app_client, approver="zhangsan", green_ratio=0.7)
        data = r.get_json()
        txn_id = data["imported"][0]["transaction_id"]
        verif_id = data["imported"][0]["verification_id"]

        app_client.post(
            f"/api/transactions/{txn_id}/emails",
            data=json.dumps({"sender": "客户经理王五", "content": "确认审批人为张三"}),
            content_type="application/json",
        )

        r2 = app_client.post(
            f"/api/verifications/{verif_id}/advance",
            data=json.dumps({"target_step": "基金会计补看客户经理补充邮件", "operator": "林姐"}),
            content_type="application/json",
        )
        assert r2.get_json()["current_step"] == "基金会计补看客户经理补充邮件"

        r_blocked = app_client.post(
            f"/api/verifications/{verif_id}/advance",
            data=json.dumps({"target_step": "余额变化表更新", "new_balance": 500000}),
            content_type="application/json",
        )
        assert "error" in r_blocked.get_json()

        app_client.post(
            f"/api/transactions/{txn_id}/fix-approver",
            data=json.dumps({"new_approver": "张三", "operator": "客户经理王五"}),
            content_type="application/json",
        )

        r_still_blocked = app_client.post(
            f"/api/verifications/{verif_id}/advance",
            data=json.dumps({"target_step": "余额变化表更新", "new_balance": 500000}),
            content_type="application/json",
        )
        assert "error" in r_still_blocked.get_json()
        assert "复核确认" in r_still_blocked.get_json()["error"]

        app_client.post(
            f"/api/transactions/{txn_id}/confirm-review",
            data=json.dumps({"reviewer": "客户经理王五"}),
            content_type="application/json",
        )

        r_pass = app_client.post(
            f"/api/verifications/{verif_id}/advance",
            data=json.dumps({"target_step": "余额变化表更新", "operator": "林姐", "new_balance": 500000}),
            content_type="application/json",
        )
        assert r_pass.get_json()["current_step"] == "余额变化表更新"
        assert r_pass.get_json()["status"] == "approved"

        r_txn = app_client.get(f"/api/transactions/{txn_id}")
        txn_data = r_txn.get_json()
        assert txn_data["approver"] == "张三"
        assert txn_data["approver_status"] == "normal"
        assert txn_data["review_required"] == 0


class TestGenericUpdateApproverAPI:
    def test_generic_update_approver_persists_review_required(self, app_client):
        r = _import_one(app_client, approver="zhangsan")
        txn_id = r.get_json()["imported"][0]["transaction_id"]

        r_update = app_client.patch(
            f"/api/transactions/{txn_id}/update",
            data=json.dumps({"field_name": "approver", "new_value": "张三", "changed_by": "林姐"}),
            content_type="application/json",
        )
        d = r_update.get_json()
        assert d["review_required"] is True
        assert d["approver_status"] == "normal"
        assert "复核" in d["warning"]

        r_txn = app_client.get(f"/api/transactions/{txn_id}")
        txn_data = r_txn.get_json()
        assert txn_data["review_required"] == 1
        assert txn_data["approver_status"] == "normal"
        assert txn_data["approver"] == "张三"

    def test_generic_update_remark_does_not_affect_review(self, app_client):
        r = _import_one(app_client, approver="张三", remark="v1")
        txn_id = r.get_json()["imported"][0]["transaction_id"]

        r_update = app_client.patch(
            f"/api/transactions/{txn_id}/update",
            data=json.dumps({"field_name": "remark", "new_value": "v2", "changed_by": "林姐"}),
            content_type="application/json",
        )
        assert "review_required" not in r_update.get_json() or r_update.get_json()["review_required"] is None

    def test_generic_update_then_advance_blocked_then_confirm_then_pass(self, app_client):
        r = _import_one(app_client, approver="lisi", green_ratio=0.65)
        txn_id = r.get_json()["imported"][0]["transaction_id"]
        verif_id = r.get_json()["imported"][0]["verification_id"]

        app_client.post(
            f"/api/transactions/{txn_id}/emails",
            data=json.dumps({"sender": "客户经理", "content": "确认"}),
            content_type="application/json",
        )
        app_client.post(
            f"/api/verifications/{verif_id}/advance",
            data=json.dumps({"target_step": "基金会计补看客户经理补充邮件"}),
            content_type="application/json",
        )

        app_client.patch(
            f"/api/transactions/{txn_id}/update",
            data=json.dumps({"field_name": "approver", "new_value": "李四", "changed_by": "林姐"}),
            content_type="application/json",
        )

        r_blocked = app_client.post(
            f"/api/verifications/{verif_id}/advance",
            data=json.dumps({"target_step": "余额变化表更新", "new_balance": 300000}),
            content_type="application/json",
        )
        assert "error" in r_blocked.get_json()
        assert "复核确认" in r_blocked.get_json()["error"]

        app_client.post(
            f"/api/transactions/{txn_id}/confirm-review",
            data=json.dumps({"reviewer": "客户经理王五"}),
            content_type="application/json",
        )

        r_pass = app_client.post(
            f"/api/verifications/{verif_id}/advance",
            data=json.dumps({"target_step": "余额变化表更新", "new_balance": 300000, "operator": "林姐"}),
            content_type="application/json",
        )
        d = r_pass.get_json()
        assert d["current_step"] == "余额变化表更新"
        assert d["status"] == "approved"


class TestExportAPI:
    def test_export_route_returns_full_report(self, app_client):
        _import_one(app_client, tail_number="T888", approver="zhangsan", amount=500000, green_ratio=0.7)

        r = app_client.get("/api/verifications/export")
        data = r.get_json()
        assert r.status_code == 200
        assert "exported_at" in data
        assert "summary" in data
        assert "rules" in data
        assert "rows" in data
        assert data["rules"]["改为中文名后仍需复核"] == "是"
        assert data["rules"]["所有改审批人的入口都必须复核"] == "是"
        assert data["rules"]["复核通过后方可继续余额更新"] == "是"
        assert len(data["rows"]) == 1
        row = data["rows"][0]
        assert row["柜台流水尾号"] == "T888"
        assert row["审批人状态"] == "审批人仅拼音（待复核）"
        assert row["是否需复核"] == "是"

    def test_export_reflects_state_after_generic_update(self, app_client):
        r = _import_one(app_client, tail_number="T999", approver="zhangsan", green_ratio=0.7)
        txn_id = r.get_json()["imported"][0]["transaction_id"]
        verif_id = r.get_json()["imported"][0]["verification_id"]

        app_client.post(
            f"/api/transactions/{txn_id}/emails",
            data=json.dumps({"sender": "客户经理", "content": "确认"}),
            content_type="application/json",
        )
        app_client.post(
            f"/api/verifications/{verif_id}/advance",
            data=json.dumps({"target_step": "基金会计补看客户经理补充邮件"}),
            content_type="application/json",
        )
        app_client.patch(
            f"/api/transactions/{txn_id}/update",
            data=json.dumps({"field_name": "approver", "new_value": "张三", "changed_by": "林姐"}),
            content_type="application/json",
        )

        data = app_client.get("/api/verifications/export").get_json()
        row = data["rows"][0]
        assert row["审批人"] == "张三"
        assert row["复核状态"] == "待复核确认"
        assert row["流程阻断原因"] == "审批人已修改，尚未复核确认"
        assert data["summary"]["待复核确认记录数"] == 1
        assert data["summary"]["流程阻断记录数"] == 1

    def test_export_after_full_workflow_matches_page_state(self, app_client):
        r = _import_one(app_client, tail_number="T100", approver="zhangsan", remark="初始备注", green_ratio=0.68)
        txn_id = r.get_json()["imported"][0]["transaction_id"]
        verif_id = r.get_json()["imported"][0]["verification_id"]

        app_client.patch(
            f"/api/transactions/{txn_id}/update",
            data=json.dumps({"field_name": "remark", "new_value": "改了备注", "changed_by": "林姐"}),
            content_type="application/json",
        )

        app_client.post(
            f"/api/transactions/{txn_id}/emails",
            data=json.dumps({"sender": "客户经理王五", "content": "确认审批人张三"}),
            content_type="application/json",
        )
        app_client.post(
            f"/api/verifications/{verif_id}/advance",
            data=json.dumps({"target_step": "基金会计补看客户经理补充邮件", "operator": "林姐"}),
            content_type="application/json",
        )

        page_state_1 = app_client.get(f"/api/transactions/{txn_id}/review").get_json()
        assert page_state_1["transaction"]["approver"] == "zhangsan"
        assert page_state_1["transaction"]["approver_status"] == "pinyin_only"

        app_client.patch(
            f"/api/transactions/{txn_id}/update",
            data=json.dumps({"field_name": "approver", "new_value": "张三", "changed_by": "林姐"}),
            content_type="application/json",
        )

        page_state_2 = app_client.get(f"/api/transactions/{txn_id}/review").get_json()
        assert page_state_2["transaction"]["approver"] == "张三"
        assert page_state_2["transaction"]["review_required"] == 1
        assert "confirm_review_hint" in page_state_2["review_actions"]

        history = app_client.get(f"/api/transactions/{txn_id}/history").get_json()["history"]
        history_fields = [(h["old_value"], h["new_value"], h["field_key"]) for h in history]
        assert ("初始备注", "改了备注", "remark") in history_fields
        assert ("zhangsan", "张三", "approver") in history_fields

        app_client.post(
            f"/api/transactions/{txn_id}/confirm-review",
            data=json.dumps({"reviewer": "客户经理王五"}),
            content_type="application/json",
        )

        app_client.post(
            f"/api/verifications/{verif_id}/advance",
            data=json.dumps({"target_step": "余额变化表更新", "operator": "林姐", "new_balance": 650000}),
            content_type="application/json",
        )

        export_data = app_client.get("/api/verifications/export").get_json()
        row = export_data["rows"][0]

        assert row["柜台流水尾号"] == "T100"
        assert row["审批人"] == "张三"
        assert row["审批人状态"] == "审批人正常"
        assert row["复核状态"] == "无需复核"
        assert row["是否需复核"] == "否"
        assert row["绿色债券投向占比"] == 0.68
        assert row["当前核验步骤"] == "第3步-余额变化表更新"
        assert row["核验状态"] == "已通过"
        assert row["流程阻断原因"] == "无"
        assert row["备注"] == "改了备注"
        assert row["客户经理补充邮件数量"] == 1
        assert row["余额变更次数"] == 1
        assert row["变更历史条目数"] == 3

        detail = row["_detail"]
        assert len(detail["change_history"]) == 3
        assert detail["change_history"][-1]["field_key"] == "review_required"
        assert detail["change_history"][-1]["old_value"] == "1"
        assert detail["change_history"][-1]["new_value"] == "0"

        assert export_data["summary"]["总记录数"] == 1
        assert export_data["summary"]["拼音审批人记录数"] == 0
        assert export_data["summary"]["待复核确认记录数"] == 0
        assert export_data["summary"]["已通过核验记录数"] == 1
        assert export_data["summary"]["流程阻断记录数"] == 0

