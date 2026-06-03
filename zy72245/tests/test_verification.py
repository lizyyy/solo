import os
import tempfile
import pytest

from src.models.db import init_db, get_db
from src.services.verification import (
    import_transactions,
    update_transaction_field,
    get_transaction_history,
    advance_verification_step,
    add_supplementary_email,
    get_verification_with_trace,
    rollback_verification,
    fix_approver,
    list_verifications,
)
from src.services.approver_checker import is_pinyin_only, classify_approver
from src.services.error_messages import get_error, humanize_field
from src.models.db import (
    APPROVER_STATUS_PINYIN_ONLY,
    APPROVER_STATUS_NORMAL,
    VERIFICATION_STEP_IMPORT,
    VERIFICATION_STEP_EMAIL_REVIEW,
    VERIFICATION_STEP_BALANCE_UPDATE,
    VERIFICATION_STATUS_PENDING,
)


@pytest.fixture
def db_path():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    init_db(path)
    yield path
    os.unlink(path)


def _import_one(db_path, tail_number="T001", approver="张三", amount=100000, green_ratio=0.65, remark=""):
    result = import_transactions(
        [{"tail_number": tail_number, "approver": approver, "amount": amount,
          "green_ratio": green_ratio, "remark": remark}],
        db_path=db_path,
    )
    return result


class TestPinyinApproverDetection:
    def test_pinyin_single_word(self):
        assert is_pinyin_only("zhangsan") is True

    def test_pinyin_with_space(self):
        assert is_pinyin_only("zhang san") is True

    def test_pinyin_uppercase(self):
        assert is_pinyin_only("ZhangSan") is True

    def test_chinese_name(self):
        assert is_pinyin_only("张三") is False

    def test_mixed_chinese_pinyin(self):
        assert is_pinyin_only("张三(zhangsan)") is False

    def test_empty_string(self):
        assert is_pinyin_only("") is True

    def test_single_letter(self):
        assert is_pinyin_only("A") is False

    def test_common_pinyin_name(self):
        assert is_pinyin_only("linjie") is True

    def test_classify_returns_correct_status(self):
        assert classify_approver("zhangsan") == APPROVER_STATUS_PINYIN_ONLY
        assert classify_approver("张三") == APPROVER_STATUS_NORMAL


class TestDuplicateImport:
    def test_duplicate_import_does_not_double_count(self, db_path):
        r1 = _import_one(db_path, tail_number="T001", approver="张三")
        assert r1["imported_count"] == 1
        assert r1["skipped_count"] == 0

        r2 = _import_one(db_path, tail_number="T001", approver="张三")
        assert r2["imported_count"] == 0
        assert r2["skipped_count"] == 1
        assert "已经导入过" in r2["skipped"][0]["reason"]

    def test_different_approver_is_not_duplicate(self, db_path):
        _import_one(db_path, tail_number="T001", approver="张三")
        r2 = _import_one(db_path, tail_number="T001", approver="李四")
        assert r2["imported_count"] == 1

    def test_batch_import_with_duplicates(self, db_path):
        txns = [
            {"tail_number": "T001", "approver": "张三", "amount": 100},
            {"tail_number": "T002", "approver": "李四", "amount": 200},
        ]
        r1 = import_transactions(txns, db_path=db_path)
        assert r1["imported_count"] == 2

        r2 = import_transactions(txns, db_path=db_path)
        assert r2["imported_count"] == 0
        assert r2["skipped_count"] == 2

    def test_verification_count_stays_same_after_duplicate(self, db_path):
        _import_one(db_path, tail_number="T001", approver="张三")
        _import_one(db_path, tail_number="T001", approver="张三")

        verifs = list_verifications(db_path=db_path)
        txn_verifs = [v for v in verifs if v["tail_number"] == "T001"]
        assert len(txn_verifs) == 1


class TestPinyinApproverInImport:
    def test_pinyin_approver_flagged_in_import(self, db_path):
        result = _import_one(db_path, approver="zhangsan")
        assert result["imported_count"] == 1
        item = result["imported"][0]
        assert item["approver_status"] == APPROVER_STATUS_PINYIN_ONLY
        assert item["pinyin_warning"] is not None
        assert "拼音" in item["pinyin_warning"]

    def test_normal_approver_no_warning(self, db_path):
        result = _import_one(db_path, approver="张三")
        item = result["imported"][0]
        assert item["approver_status"] == APPROVER_STATUS_NORMAL
        assert item["pinyin_warning"] is None


class TestHistoryTracking:
    def test_remark_change_shows_before_after(self, db_path):
        result = _import_one(db_path, tail_number="T001", approver="张三", remark="原始备注")
        txn_id = result["imported"][0]["transaction_id"]

        update_result = update_transaction_field(
            txn_id, "remark", "修改后备注", changed_by="林姐", db_path=db_path
        )
        assert update_result["old_value"] == "原始备注"
        assert update_result["new_value"] == "修改后备注"

    def test_history_records_all_changes(self, db_path):
        result = _import_one(db_path, tail_number="T001", approver="张三", remark="v1")
        txn_id = result["imported"][0]["transaction_id"]

        update_transaction_field(txn_id, "remark", "v2", changed_by="林姐", db_path=db_path)
        update_transaction_field(txn_id, "remark", "v3", changed_by="林姐", db_path=db_path)

        history = get_transaction_history(txn_id, db_path=db_path)
        assert len(history) == 2
        assert history[0]["old_value"] == "v1"
        assert history[0]["new_value"] == "v2"
        assert history[1]["old_value"] == "v2"
        assert history[1]["new_value"] == "v3"

    def test_field_name_humanized_in_history(self, db_path):
        result = _import_one(db_path, approver="张三")
        txn_id = result["imported"][0]["transaction_id"]

        update_transaction_field(txn_id, "remark", "新备注", db_path=db_path)
        history = get_transaction_history(txn_id, db_path=db_path)
        assert history[0]["field_name"] == "备注"

    def test_no_change_no_history(self, db_path):
        result = _import_one(db_path, approver="张三", remark="相同备注")
        txn_id = result["imported"][0]["transaction_id"]

        update_result = update_transaction_field(
            txn_id, "remark", "相同备注", db_path=db_path
        )
        assert "没有变化" in update_result["message"]

        history = get_transaction_history(txn_id, db_path=db_path)
        assert len(history) == 0


class TestThreeStepWorkflow:
    def _get_latest_verif_id(self, txn_id, db_path):
        conn = get_db(db_path)
        try:
            c = conn.cursor()
            c.execute(
                "SELECT id FROM green_bond_verifications WHERE transaction_id = ? ORDER BY created_at DESC LIMIT 1",
                (txn_id,),
            )
            row = c.fetchone()
            return row["id"] if row else None
        finally:
            conn.close()

    def test_full_three_step_workflow(self, db_path):
        result = _import_one(db_path, approver="张三", green_ratio=0.7)
        txn_id = result["imported"][0]["transaction_id"]
        verif_id = result["imported"][0]["verification_id"]

        email_result = add_supplementary_email(txn_id, "客户经理王五", "确认投向占比70%", db_path=db_path)
        email_id = email_result["email_id"]

        r2 = advance_verification_step(
            txn_id, VERIFICATION_STEP_EMAIL_REVIEW,
            operator="林姐", supplementary_email_id=email_id, db_path=db_path,
        )
        assert r2["current_step"] == VERIFICATION_STEP_EMAIL_REVIEW

        verif_id_2 = self._get_latest_verif_id(txn_id, db_path)

        r3 = advance_verification_step(
            txn_id, VERIFICATION_STEP_BALANCE_UPDATE,
            operator="林姐", new_balance=950000, db_path=db_path,
        )
        assert r3["current_step"] == VERIFICATION_STEP_BALANCE_UPDATE
        assert r3["status"] == "approved"

    def test_cannot_skip_steps(self, db_path):
        result = _import_one(db_path, approver="张三")
        txn_id = result["imported"][0]["transaction_id"]

        r = advance_verification_step(
            txn_id, VERIFICATION_STEP_BALANCE_UPDATE, db_path=db_path,
        )
        assert "error" in r
        assert "顺序" in r["error"]

    def test_pinyin_approver_blocked_at_balance_step(self, db_path):
        result = _import_one(db_path, approver="zhangsan")
        txn_id = result["imported"][0]["transaction_id"]

        add_supplementary_email(txn_id, "客户经理", "确认", db_path=db_path)
        advance_verification_step(
            txn_id, VERIFICATION_STEP_EMAIL_REVIEW, operator="林姐", db_path=db_path,
        )

        r = advance_verification_step(
            txn_id, VERIFICATION_STEP_BALANCE_UPDATE, new_balance=100, db_path=db_path,
        )
        assert "error" in r
        assert "拼音" in r["error"] or "复核" in r["error"] or "pinyin" in r.get("error", "").lower()

    def test_pinyin_approver_must_go_through_email_review(self, db_path):
        result = _import_one(db_path, approver="lisi")
        txn_id = result["imported"][0]["transaction_id"]

        r = advance_verification_step(
            txn_id, VERIFICATION_STEP_EMAIL_REVIEW, db_path=db_path,
        )
        assert r.get("current_step") == VERIFICATION_STEP_EMAIL_REVIEW

    def test_fix_pinyin_approver_then_continue(self, db_path):
        result = _import_one(db_path, approver="lisi")
        txn_id = result["imported"][0]["transaction_id"]

        add_supplementary_email(txn_id, "客户经理", "确认审批人为李四", db_path=db_path)
        advance_verification_step(
            txn_id, VERIFICATION_STEP_EMAIL_REVIEW, operator="林姐", db_path=db_path,
        )

        fix_result = fix_approver(txn_id, "李四", operator="客户经理王五", db_path=db_path)
        assert fix_result["new_approver"] == "李四"
        assert fix_result["new_status"] == APPROVER_STATUS_NORMAL
        assert fix_result["requires_review"] is True

        verif_id = self._get_latest_verif_id(txn_id, db_path)
        r = advance_verification_step(
            txn_id, VERIFICATION_STEP_BALANCE_UPDATE,
            new_balance=200000, db_path=db_path,
        )
        assert r["current_step"] == VERIFICATION_STEP_BALANCE_UPDATE


class TestRollback:
    def test_rollback_from_balance_update(self, db_path):
        result = _import_one(db_path, approver="张三")
        txn_id = result["imported"][0]["transaction_id"]

        add_supplementary_email(txn_id, "客户经理", "确认", db_path=db_path)
        advance_verification_step(txn_id, VERIFICATION_STEP_EMAIL_REVIEW, db_path=db_path)

        verif_id_2 = None
        conn = get_db(db_path)
        try:
            c = conn.cursor()
            c.execute(
                "SELECT id FROM green_bond_verifications WHERE transaction_id = ? ORDER BY created_at DESC LIMIT 1",
                (txn_id,),
            )
            verif_id_2 = c.fetchone()["id"]
        finally:
            conn.close()

        advance_verification_step(
            txn_id, VERIFICATION_STEP_BALANCE_UPDATE, new_balance=100, db_path=db_path,
        )

        conn = get_db(db_path)
        try:
            c = conn.cursor()
            c.execute(
                "SELECT id FROM green_bond_verifications WHERE transaction_id = ? ORDER BY created_at DESC LIMIT 1",
                (txn_id,),
            )
            verif_id_3 = c.fetchone()["id"]
        finally:
            conn.close()

        r = rollback_verification(verif_id_3, reason="余额有误", db_path=db_path)
        assert r["rolled_back_from"] == VERIFICATION_STEP_BALANCE_UPDATE
        assert r["rolled_back_to"] == VERIFICATION_STEP_EMAIL_REVIEW

    def test_cannot_rollback_from_initial_step(self, db_path):
        result = _import_one(db_path, approver="张三")
        verif_id = result["imported"][0]["verification_id"]

        r = rollback_verification(verif_id, db_path=db_path)
        assert "error" in r


class TestTraceLinks:
    def test_pinyin_approver_has_trace_links(self, db_path):
        result = _import_one(db_path, approver="zhangsan")
        verif_id = result["imported"][0]["verification_id"]

        trace = get_verification_with_trace(verif_id, db_path=db_path)
        assert "trace_links" in trace
        assert "approver_review" in trace["trace_links"]
        assert trace["trace_links"]["approver_review"] is not None

    def test_normal_approver_no_review_link(self, db_path):
        result = _import_one(db_path, approver="张三")
        verif_id = result["imported"][0]["verification_id"]

        trace = get_verification_with_trace(verif_id, db_path=db_path)
        assert "approver_review" not in trace.get("trace_links", {})

    def test_email_links_in_trace(self, db_path):
        result = _import_one(db_path, approver="张三")
        txn_id = result["imported"][0]["transaction_id"]
        verif_id = result["imported"][0]["verification_id"]

        add_supplementary_email(txn_id, "王五", "补充说明", db_path=db_path)

        trace = get_verification_with_trace(verif_id, db_path=db_path)
        assert len(trace["supplementary_emails"]) == 1
        assert len(trace["trace_links"]["supplementary_emails"]) == 1


class TestErrorMessages:
    def test_humanize_field(self):
        assert humanize_field("approver") == "审批人"
        assert humanize_field("remark") == "备注"
        assert humanize_field("unknown_field") == "unknown_field"

    def test_error_message_is_chinese(self):
        msg = get_error("DUPLICATE_IMPORT")
        assert "已经导入过" in msg

    def test_error_with_params(self):
        msg = get_error("PINYIN_APPROVER_DETECTED", approver="zhangsan")
        assert "zhangsan" in msg
        assert "拼音" in msg

    def test_unknown_error_code_returns_code(self):
        msg = get_error("NONEXISTENT_CODE")
        assert msg == "NONEXISTENT_CODE"


class TestFixApprover:
    def test_fix_pinyin_to_chinese(self, db_path):
        result = _import_one(db_path, approver="zhangsan")
        txn_id = result["imported"][0]["transaction_id"]

        fix_result = fix_approver(txn_id, "张三", operator="客户经理王五", db_path=db_path)
        assert fix_result["old_approver"] == "zhangsan"
        assert fix_result["new_approver"] == "张三"
        assert fix_result["new_status"] == APPROVER_STATUS_NORMAL
        assert fix_result["requires_review"] is True

    def test_fix_to_still_pinyin(self, db_path):
        result = _import_one(db_path, approver="zhangsan")
        txn_id = result["imported"][0]["transaction_id"]

        fix_result = fix_approver(txn_id, "zhang san", operator="客户经理", db_path=db_path)
        assert fix_result["new_status"] == APPROVER_STATUS_PINYIN_ONLY
        assert fix_result["requires_review"] is True

    def test_fix_approver_creates_history(self, db_path):
        result = _import_one(db_path, approver="zhangsan")
        txn_id = result["imported"][0]["transaction_id"]

        fix_approver(txn_id, "张三", operator="客户经理", db_path=db_path)

        history = get_transaction_history(txn_id, db_path=db_path)
        assert len(history) == 1
        assert history[0]["old_value"] == "zhangsan"
        assert history[0]["new_value"] == "张三"

    def test_fix_nonexistent_transaction(self, db_path):
        r = fix_approver("nonexistent-id", "张三", db_path=db_path)
        assert "error" in r
