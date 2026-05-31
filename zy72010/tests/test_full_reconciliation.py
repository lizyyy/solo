import os
import sys
import tempfile
import shutil
from pathlib import Path

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from vip_reconcile.data_reader import (
    load_expected_vouchers,
    load_all_evidence,
    load_attachment_index
)
from vip_reconcile.reconciler import Reconciler
from vip_reconcile.exporter import FinanceExporter
from vip_reconcile.models import MatchStatus, EvidenceType


SAMPLES_DIR = os.path.join(os.path.dirname(__file__), '..', 'samples')


class TestFullReconciliation:
    """机场贵宾券核销对账 - 完整流程测试"""

    @pytest.fixture
    def output_dir(self):
        tmpdir = tempfile.mkdtemp()
        yield tmpdir
        shutil.rmtree(tmpdir)

    def test_data_loading(self):
        """测试数据加载"""
        vouchers = load_expected_vouchers(os.path.join(SAMPLES_DIR, 'voucher_list.csv'))
        assert len(vouchers) == 8

        evidence_map = load_all_evidence(SAMPLES_DIR)
        assert len(evidence_map) > 0

        attachment_map = load_attachment_index(os.path.join(SAMPLES_DIR, 'attachment_index.csv'))
        assert len(attachment_map) == 2

    def test_core_reconciliation_logic(self):
        """测试核心对账匹配逻辑"""
        vouchers = load_expected_vouchers(os.path.join(SAMPLES_DIR, 'voucher_list.csv'))
        evidence_map = load_all_evidence(SAMPLES_DIR)
        attachment_map = load_attachment_index(os.path.join(SAMPLES_DIR, 'attachment_index.csv'))

        reconciler = Reconciler(operator="小孟")
        reconciler.associate_evidence(vouchers, evidence_map)
        reconciler.associate_evidence(vouchers, attachment_map)
        records = reconciler.reconcile(vouchers)

        assert len(records) == 8

        status_counts = {}
        for r in records:
            status_counts[r.current_status] = status_counts.get(r.current_status, 0) + 1

        assert MatchStatus.CONFIRMED in status_counts
        assert MatchStatus.CONFLICT in status_counts
        assert MatchStatus.MANUAL_REVIEW in status_counts

    def test_conflict_detection(self):
        """测试冲突检测 - 银企回单与导入数据冲突"""
        vouchers = load_expected_vouchers(os.path.join(SAMPLES_DIR, 'voucher_list.csv'))
        evidence_map = load_all_evidence(SAMPLES_DIR)

        reconciler = Reconciler(operator="测试")
        reconciler.associate_evidence(vouchers, evidence_map)
        records = reconciler.reconcile(vouchers)

        vip002 = [r for r in records if r.voucher_no == 'VIP202605002'][0]
        assert vip002.conflict_details is not None
        assert vip002.current_status == MatchStatus.CONFLICT
        assert vip002.conflict_details['payment_amount'] == 180.00
        assert vip002.conflict_details['bank_amount'] == 160.00
        assert vip002.conflict_details['diff'] == -20.00

        has_suggestion = any("数据冲突" in s for s in vip002.suggestions)
        assert has_suggestion
        assert any("请勿直接拍板" in s for s in vip002.suggestions)

    def test_refund_handling(self):
        """测试退款处理逻辑"""
        vouchers = load_expected_vouchers(os.path.join(SAMPLES_DIR, 'voucher_list.csv'))
        evidence_map = load_all_evidence(SAMPLES_DIR)

        reconciler = Reconciler(operator="测试")
        reconciler.associate_evidence(vouchers, evidence_map)
        records = reconciler.reconcile(vouchers)

        vip004 = [r for r in records if r.voucher_no == 'VIP202605004'][0]
        assert vip004.current_status == MatchStatus.CONFIRMED
        assert vip004.actual_amount == 0.0
        assert "退款已审批" in vip004.judgment_history[-1].reason

    def test_manual_note_handling(self):
        """测试手写备注处理 - 积分兑换场景"""
        vouchers = load_expected_vouchers(os.path.join(SAMPLES_DIR, 'voucher_list.csv'))
        evidence_map = load_all_evidence(SAMPLES_DIR)

        reconciler = Reconciler(operator="测试")
        reconciler.associate_evidence(vouchers, evidence_map)
        records = reconciler.reconcile(vouchers)

        vip005 = [r for r in records if r.voucher_no == 'VIP202605005'][0]
        assert vip005.current_status == MatchStatus.CONFIRMED
        assert "积分兑换" in vip005.judgment_history[-1].reason

    def test_manual_review_pending(self):
        """测试人工改判场景 - 客户联系不上"""
        vouchers = load_expected_vouchers(os.path.join(SAMPLES_DIR, 'voucher_list.csv'))
        evidence_map = load_all_evidence(SAMPLES_DIR)

        reconciler = Reconciler(operator="测试")
        reconciler.associate_evidence(vouchers, evidence_map)
        records = reconciler.reconcile(vouchers)

        vip006 = [r for r in records if r.voucher_no == 'VIP202605006'][0]
        assert vip006.current_status == MatchStatus.MANUAL_REVIEW
        assert "联系不上" in vip006.judgment_history[-1].reason

    def test_approval_email_with_amount_diff(self):
        """测试有审批邮件的金额差异场景"""
        vouchers = load_expected_vouchers(os.path.join(SAMPLES_DIR, 'voucher_list.csv'))
        evidence_map = load_all_evidence(SAMPLES_DIR)

        reconciler = Reconciler(operator="测试")
        reconciler.associate_evidence(vouchers, evidence_map)
        records = reconciler.reconcile(vouchers)

        vip003 = [r for r in records if r.voucher_no == 'VIP202605003'][0]
        assert vip003.current_status == MatchStatus.CONFIRMED
        assert vip003.amount_diff == 100.0
        assert "审批邮件说明" in vip003.judgment_history[-1].reason

    def test_judgment_history_tracking(self):
        """测试判断历史留痕"""
        vouchers = load_expected_vouchers(os.path.join(SAMPLES_DIR, 'voucher_list.csv'))
        evidence_map = load_all_evidence(SAMPLES_DIR)

        reconciler = Reconciler(operator="测试")
        reconciler.associate_evidence(vouchers, evidence_map)
        records = reconciler.reconcile(vouchers)

        for r in records:
            assert len(r.judgment_history) >= 1
            j = r.judgment_history[-1]
            assert j.status_before is not None
            assert j.status_after is not None
            assert j.operator == "测试"
            assert j.timestamp is not None
            assert j.reason is not None

    def test_manual_note_rejudgment(self, output_dir):
        """测试临时补录备注触发重新判断"""
        vouchers = load_expected_vouchers(os.path.join(SAMPLES_DIR, 'voucher_list.csv'))
        evidence_map = load_all_evidence(SAMPLES_DIR)

        reconciler = Reconciler(operator="小孟")
        reconciler.associate_evidence(vouchers, evidence_map)
        records = reconciler.reconcile(vouchers)

        vip002_before = [r for r in records if r.voucher_no == 'VIP202605002'][0]
        assert vip002_before.current_status == MatchStatus.CONFLICT

        result = reconciler.apply_manual_note(
            records,
            'VIP202605002',
            '客户来电确认20元优惠券有效，此差异为正常折扣，可确认入账',
            '小孟'
        )

        assert result is not None
        voucher_no, before, after, desc = result
        assert voucher_no == 'VIP202605002'
        assert before == MatchStatus.CONFLICT
        assert "补录备注触发重新判断" in desc[0]

        vip002_after = [r for r in records if r.voucher_no == 'VIP202605002'][0]
        assert len(vip002_after.judgment_history) >= 2
        assert len(vip002_after.manual_notes) >= 1

    def test_late_evidence_no_override_confirmed(self, output_dir):
        """测试晚到附件不直接覆盖已确认的判断"""
        vouchers = load_expected_vouchers(os.path.join(SAMPLES_DIR, 'voucher_list.csv'))
        evidence_map = load_all_evidence(SAMPLES_DIR)

        reconciler = Reconciler(operator="小孟")
        reconciler.associate_evidence(vouchers, evidence_map)
        records = reconciler.reconcile(vouchers)

        vip001 = [r for r in records if r.voucher_no == 'VIP202605001'][0]
        assert vip001.current_status == MatchStatus.CONFIRMED
        orig_judgment_count = len(vip001.judgment_history)

        from vip_reconcile.models import EvidenceRecord
        late_evidence = {
            'VIP202605001': [
                EvidenceRecord(
                    evidence_type=EvidenceType.ATTACHMENT,
                    source_file='late_attachment.csv',
                    content='附件: 补充说明.pdf, 说明特殊情况',
                    voucher_no='VIP202605001'
                )
            ]
        }

        changes = reconciler.apply_late_evidence(records, late_evidence)

        assert len(changes) == 1
        voucher_no, before, after, desc = changes[0]
        assert before == MatchStatus.CONFIRMED
        assert after == MatchStatus.CONFIRMED
        assert "状态未变，晚到附件已追加" in desc[0]
        assert len(vip001.manual_notes) >= 1
        assert "原判断【已确认】保留" in vip001.manual_notes[-1]
        assert len(vip001.judgment_history) == orig_judgment_count

    def test_finance_excel_export(self, output_dir):
        """测试财务明细Excel导出"""
        vouchers = load_expected_vouchers(os.path.join(SAMPLES_DIR, 'voucher_list.csv'))
        evidence_map = load_all_evidence(SAMPLES_DIR)
        attachment_map = load_attachment_index(os.path.join(SAMPLES_DIR, 'attachment_index.csv'))

        reconciler = Reconciler(operator="小孟")
        reconciler.associate_evidence(vouchers, evidence_map)
        reconciler.associate_evidence(vouchers, attachment_map)
        records = reconciler.reconcile(vouchers)

        exporter = FinanceExporter(output_dir=output_dir)
        excel_path = exporter.export_to_finance_excel(records)

        assert os.path.exists(excel_path)
        assert os.path.getsize(excel_path) > 0

        import pandas as pd
        xl = pd.ExcelFile(excel_path)
        sheets = xl.sheet_names

        assert "对账汇总" in sheets
        assert "已确认" in sheets
        assert "待补材料" in sheets
        assert "人工改判" in sheets
        assert "数据冲突" in sheets
        assert "判断历史全记录" in sheets

        df_summary = pd.read_excel(excel_path, sheet_name="对账汇总")
        assert len(df_summary) == 6

        df_history = pd.read_excel(excel_path, sheet_name="判断历史全记录")
        assert len(df_history) >= len(records)

    def test_csv_export(self, output_dir):
        """测试CSV导出"""
        vouchers = load_expected_vouchers(os.path.join(SAMPLES_DIR, 'voucher_list.csv'))
        evidence_map = load_all_evidence(SAMPLES_DIR)

        reconciler = Reconciler(operator="小孟")
        reconciler.associate_evidence(vouchers, evidence_map)
        records = reconciler.reconcile(vouchers)

        exporter = FinanceExporter(output_dir=output_dir)
        csv_path = exporter.export_to_csv(records)

        assert os.path.exists(csv_path)
        assert os.path.getsize(csv_path) > 0

        import csv
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            rows = list(reader)
            assert len(rows) == len(records) + 1
            assert rows[0][0] == "凭证编号"

    def test_suggestions_for_business_users(self):
        """测试业务建议是否符合业务同事阅读习惯"""
        vouchers = load_expected_vouchers(os.path.join(SAMPLES_DIR, 'voucher_list.csv'))
        evidence_map = load_all_evidence(SAMPLES_DIR)

        reconciler = Reconciler(operator="小孟")
        reconciler.associate_evidence(vouchers, evidence_map)
        records = reconciler.reconcile(vouchers)

        for r in records:
            if r.current_status == MatchStatus.CONFIRMED:
                if not r.manual_notes and not r.get_evidence_by_type(EvidenceType.ATTACHMENT):
                    continue

            assert len(r.suggestions) >= 1
            for s in r.suggestions:
                assert "请" in s or "请勿" in s or "需" in s or "【" in s
                if r.current_status == MatchStatus.CONFLICT:
                    has_conflict_suggestion = any(
                        "请勿直接拍板" in sug or "请核对" in sug or "数据冲突" in sug
                        for sug in r.suggestions
                    )
                    assert has_conflict_suggestion
                if r.current_status == MatchStatus.PENDING_MATERIALS:
                    has_pending_suggestion = any(
                        "待补材料" in sug or "缺少" in sug or "请联系" in sug
                        for sug in r.suggestions
                    )
                    assert has_pending_suggestion
                if r.current_status == MatchStatus.MANUAL_REVIEW:
                    has_manual_suggestion = any(
                        "人工改判" in sug or "人工复核" in sug or "请运营主管" in sug
                        for sug in r.suggestions
                    )
                    assert has_manual_suggestion

    def test_full_workflow_scenario(self, output_dir):
        """端到端测试：运营主管小孟的完整工作流程"""
        vouchers = load_expected_vouchers(os.path.join(SAMPLES_DIR, 'voucher_list.csv'))
        evidence_map = load_all_evidence(SAMPLES_DIR)
        attachment_map = load_attachment_index(os.path.join(SAMPLES_DIR, 'attachment_index.csv'))

        reconciler = Reconciler(operator="小孟")
        reconciler.associate_evidence(vouchers, evidence_map)
        reconciler.associate_evidence(vouchers, attachment_map)
        records = reconciler.reconcile(vouchers)

        status_counts = {}
        for r in records:
            status_counts[r.current_status] = status_counts.get(r.current_status, 0) + 1

        assert MatchStatus.CONFIRMED in status_counts
        assert status_counts[MatchStatus.CONFIRMED] >= 3

        assert MatchStatus.CONFLICT in status_counts
        vip002 = [r for r in records if r.voucher_no == 'VIP202605002'][0]
        assert vip002.current_status == MatchStatus.CONFLICT

        result = reconciler.apply_manual_note(
            records,
            'VIP202605002',
            '客户来电确认20元优惠券有效，此差异为正常折扣，可确认入账',
            '小孟'
        )
        assert result is not None
        assert result[1] == MatchStatus.CONFLICT

        vip002_final = [r for r in records if r.voucher_no == 'VIP202605002'][0]
        assert len(vip002_final.judgment_history) >= 2
        assert len(vip002_final.manual_notes) >= 1

        exporter = FinanceExporter(output_dir=output_dir)
        excel_path = exporter.export_to_finance_excel(records)
        assert os.path.exists(excel_path)

        import pandas as pd
        df_confirmed = pd.read_excel(excel_path, sheet_name="已确认")
        df_manual = pd.read_excel(excel_path, sheet_name="人工改判")
        df_history = pd.read_excel(excel_path, sheet_name="判断历史全记录")

        assert len(df_history) >= len(records)
