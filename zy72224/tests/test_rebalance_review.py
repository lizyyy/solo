import pytest
from rebalance_review import (
    RebalanceReviewEngine,
    RebalanceWorkflow,
    TraceabilityService,
    ReviewRecord,
    TaxRateNote,
    CounterTransaction,
    BalanceChangeEntry,
    ApproverBoundaryRule,
    ChangeHistory,
    ReviewStatus,
    WorkflowPhase,
    PinyinVerdict,
)
from rebalance_review.workflow import PinyinInterceptError, WorkflowError


class TestPinyinDetection:
    def setup_method(self):
        self.engine = RebalanceReviewEngine()

    def test_chinese_name_is_normal(self):
        assert self.engine.detect_pinyin("张三") == PinyinVerdict.NORMAL

    def test_pure_pinyin_is_flagged(self):
        assert self.engine.detect_pinyin("zhangsan") == PinyinVerdict.PINYIN_ONLY

    def test_pinyin_initials_are_flagged(self):
        assert self.engine.detect_pinyin("ZS") == PinyinVerdict.PINYIN_ONLY

    def test_pinyin_with_space(self):
        assert self.engine.detect_pinyin("zhang san") == PinyinVerdict.PINYIN_ONLY

    def test_empty_name_is_ambiguous(self):
        assert self.engine.detect_pinyin("") == PinyinVerdict.AMBIGUOUS

    def test_mixed_non_chinese_non_alpha(self):
        assert self.engine.detect_pinyin("审批人_001") == PinyinVerdict.NORMAL
        assert self.engine.detect_pinyin("_001") == PinyinVerdict.AMBIGUOUS

    def test_chinese_with_english_is_normal(self):
        assert self.engine.detect_pinyin("张三ZS") == PinyinVerdict.NORMAL


class TestDeduplication:
    def setup_method(self):
        self.engine = RebalanceReviewEngine()
        self.record = self.engine.create_record("组合A", "张三")

    def test_duplicate_import_does_not_double(self):
        notes = [
            TaxRateNote(tax_category="增值税", rate=0.06, remark="普通税率", approver_name="张三"),
            TaxRateNote(tax_category="印花税", rate=0.001, remark="交易印花税", approver_name="张三"),
        ]
        first = self.engine.import_tax_notes(self.record, notes, "老秦")
        assert len(first) == 2
        assert len(self.record.tax_notes) == 2

        second = self.engine.import_tax_notes(self.record, notes, "老秦")
        assert len(second) == 0
        assert len(self.record.tax_notes) == 2

    def test_partial_duplicate_only_adds_new(self):
        note1 = TaxRateNote(tax_category="增值税", rate=0.06, remark="普通税率", approver_name="张三")
        self.engine.import_tax_notes(self.record, [note1], "老秦")
        assert len(self.record.tax_notes) == 1

        note2 = TaxRateNote(tax_category="印花税", rate=0.001, remark="交易印花税", approver_name="张三")
        added = self.engine.import_tax_notes(self.record, [note1, note2], "老秦")
        assert len(added) == 1
        assert len(self.record.tax_notes) == 2


class TestHistoryDiff:
    def setup_method(self):
        self.engine = RebalanceReviewEngine()
        self.record = self.engine.create_record("组合A", "张三")

    def test_update_remark_creates_history(self):
        note = TaxRateNote(tax_category="增值税", rate=0.06, remark="旧备注", approver_name="张三")
        self.engine.import_tax_notes(self.record, [note], "老秦")

        history = self.engine.update_note_remark(self.record, note.id, "新备注", "老秦")
        assert history is not None
        assert history.old_value == "旧备注"
        assert history.new_value == "新备注"
        assert history.changed_by == "老秦"

    def test_history_diff_shows_change(self):
        note = TaxRateNote(tax_category="增值税", rate=0.06, remark="旧备注", approver_name="张三")
        self.engine.import_tax_notes(self.record, [note], "老秦")
        self.engine.update_note_remark(self.record, note.id, "新备注", "老秦")

        diffs = self.engine.get_history_diff(self.record)
        remark_diffs = [d for d in diffs if "旧备注" in d and "新备注" in d]
        assert len(remark_diffs) >= 1
        assert "老秦" in remark_diffs[0]


class TestRollback:
    def setup_method(self):
        self.engine = RebalanceReviewEngine()
        self.record = self.engine.create_record("组合A", "张三")

    def test_rollback_restores_remark(self):
        note = TaxRateNote(tax_category="增值税", rate=0.06, remark="原始备注", approver_name="张三")
        self.engine.import_tax_notes(self.record, [note], "老秦")

        h1 = self.engine.update_note_remark(self.record, note.id, "第一次改", "老秦")
        h2 = self.engine.update_note_remark(self.record, note.id, "第二次改", "老秦")

        assert self.engine.rollback_record(self.record, h1.id, "管理员")
        assert self.record.status == ReviewStatus.ROLLED_BACK


class TestWorkflowThreeSteps:
    def setup_method(self):
        self.engine = RebalanceReviewEngine()
        self.workflow = RebalanceWorkflow(self.engine)

    def test_full_three_step_workflow(self):
        record = self.engine.create_record("组合A", "张三")

        note = TaxRateNote(tax_category="增值税", rate=0.06, remark="普通税率", approver_name="张三")
        self.workflow.step_import_tax_notes(record, [note], "老秦")
        assert record.workflow_phase == WorkflowPhase.COUNTER_TRANSACTION_CHECK

        tx = CounterTransaction(tail_number="8899", amount=100000, linked_tax_note_id=note.id)
        self.workflow.step_check_counter_transactions(record, [tx], "老秦")
        assert record.workflow_phase == WorkflowPhase.BALANCE_UPDATE

        entry = BalanceChangeEntry(account="A001", before_balance=500000, after_balance=600000, linked_counter_tx_id=tx.id)
        self.workflow.step_update_balance(record, [entry], "老秦")
        assert record.workflow_phase == WorkflowPhase.COMPLETED

    def test_pinyin_intercept_on_step1(self):
        record = self.engine.create_record("组合A", "zhangsan")
        note = TaxRateNote(tax_category="增值税", rate=0.06, remark="普通税率", approver_name="zhangsan")

        with pytest.raises(PinyinInterceptError) as exc_info:
            self.workflow.step_import_tax_notes(record, [note], "老秦")
        assert "zhangsan" in str(exc_info.value)
        assert record.status == ReviewStatus.AWAITING_CLIENT_MANAGER_REVIEW

    def test_pinyin_intercept_on_step2(self):
        record = self.engine.create_record("组合A", "张三")
        note = TaxRateNote(tax_category="增值税", rate=0.06, remark="普通税率", approver_name="张三")
        self.workflow.step_import_tax_notes(record, [note], "老秦")

        record.approver_name = "zhangsan"
        record.approver_pinyin_verdict = PinyinVerdict.PINYIN_ONLY

        tx = CounterTransaction(tail_number="8899", amount=100000)
        with pytest.raises(PinyinInterceptError):
            self.workflow.step_check_counter_transactions(record, [tx], "老秦")

    def test_pinyin_resolve_then_continue(self):
        record = self.engine.create_record("组合A", "zhangsan")
        note = TaxRateNote(tax_category="增值税", rate=0.06, remark="普通税率", approver_name="zhangsan")

        with pytest.raises(PinyinInterceptError):
            self.workflow.step_import_tax_notes(record, [note], "老秦")

        self.workflow.resolve_pinyin_flag(record, "张三", "客户经理")
        assert record.approver_name == "张三"
        assert record.approver_pinyin_verdict == PinyinVerdict.NORMAL
        assert record.status == ReviewStatus.PENDING

    def test_wrong_phase_raises_error(self):
        record = self.engine.create_record("组合A", "张三")
        with pytest.raises(WorkflowError):
            self.workflow.step_check_counter_transactions(record, [], "老秦")


class TestTraceability:
    def setup_method(self):
        self.engine = RebalanceReviewEngine()
        self.workflow = RebalanceWorkflow(self.engine)
        self.service = TraceabilityService()

    def test_full_evidence_chain(self):
        record = self.engine.create_record("组合A", "张三")

        note = TaxRateNote(tax_category="增值税", rate=0.06, remark="普通税率", approver_name="张三")
        self.workflow.step_import_tax_notes(record, [note], "老秦")

        tx = CounterTransaction(tail_number="8899", amount=100000, linked_tax_note_id=note.id)
        self.workflow.step_check_counter_transactions(record, [tx], "老秦")

        entry = BalanceChangeEntry(account="A001", before_balance=500000, after_balance=600000, linked_counter_tx_id=tx.id)
        self.workflow.step_update_balance(record, [entry], "老秦")

        chain = self.service.full_evidence_chain(record, "balance_entry", entry.id)
        assert len(chain) == 3
        assert chain[0].display_type == "balance_entry"
        assert chain[1].display_type == "counter_transaction"
        assert chain[2].display_type == "tax_rate_note"

    def test_trace_back_to_counter_transaction(self):
        record = self.engine.create_record("组合A", "张三")

        note = TaxRateNote(tax_category="增值税", rate=0.06, remark="普通税率", approver_name="张三")
        self.workflow.step_import_tax_notes(record, [note], "老秦")

        tx = CounterTransaction(tail_number="8899", amount=100000, linked_tax_note_id=note.id)
        self.workflow.step_check_counter_transactions(record, [tx], "老秦")

        link = self.service.trace_back(record, "counter_transaction", tx.id)
        assert link is not None
        assert link.back_ref_type == "tax_rate_note"
        assert link.back_ref_id == note.id

    def test_get_source_detail(self):
        record = self.engine.create_record("组合A", "张三")
        note = TaxRateNote(tax_category="增值税", rate=0.06, remark="普通税率", approver_name="张三", source_file="tax_2024.xlsx")
        self.engine.import_tax_notes(record, [note], "老秦")

        detail = self.service.get_source_detail(record, "tax_rate_note", note.id)
        assert detail is not None
        assert detail["tax_category"] == "增值税"
        assert detail["source_file"] == "tax_2024.xlsx"

    def test_trace_pinyin_record_back_to_source(self):
        record = self.engine.create_record("组合A", "zhangsan")
        note = TaxRateNote(tax_category="增值税", rate=0.06, remark="普通税率", approver_name="zhangsan")

        with pytest.raises(PinyinInterceptError):
            self.workflow.step_import_tax_notes(record, [note], "老秦")

        self.workflow.resolve_pinyin_flag(record, "张三", "客户经理")

        self.workflow.step_import_tax_notes(record, [], "老秦")

        tx = CounterTransaction(tail_number="8899", amount=100000, linked_tax_note_id=note.id)
        self.workflow.step_check_counter_transactions(record, [tx], "老秦")

        entry = BalanceChangeEntry(account="A001", before_balance=500000, after_balance=600000, linked_counter_tx_id=tx.id)
        self.workflow.step_update_balance(record, [entry], "老秦")

        chain = self.service.full_evidence_chain(record, "balance_entry", entry.id)
        assert len(chain) >= 2

        tx_detail = self.service.get_source_detail(record, "counter_transaction", tx.id)
        assert tx_detail["linked_tax_note_id"] == note.id

        note_detail = self.service.get_source_detail(record, "tax_rate_note", note.id)
        assert note_detail["approver_name"] == "zhangsan"


class TestBoundaryRules:
    def setup_method(self):
        self.engine = RebalanceReviewEngine()

    def test_custom_rule_matches(self):
        rule = ApproverBoundaryRule(
            rule_name="审批人含数字",
            condition_type="approver_name_pattern",
            condition_value=r"\d",
            action="flag_pinyin",
            priority=10,
        )
        self.engine.add_boundary_rule(rule)

        record = self.engine.create_record("组合A", "审批人001")
        status = self.engine.evaluate_boundary(record)
        assert status == ReviewStatus.PINYIN_FLAGGED

    def test_priority_order(self):
        rule_high = ApproverBoundaryRule(
            rule_name="高优先级",
            condition_type="approver_name_pattern",
            condition_value=r".*",
            action="reject",
            priority=20,
        )
        rule_low = ApproverBoundaryRule(
            rule_name="低优先级",
            condition_type="approver_name_pattern",
            condition_value=r".*",
            action="flag_pinyin",
            priority=10,
        )
        self.engine.add_boundary_rule(rule_low)
        self.engine.add_boundary_rule(rule_high)

        record = self.engine.create_record("组合A", "张三")
        status = self.engine.evaluate_boundary(record)
        assert status == ReviewStatus.REJECTED
