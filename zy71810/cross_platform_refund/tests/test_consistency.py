import os
import sys
import tempfile
from pathlib import Path
from datetime import datetime, timedelta

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from config import SUPPLEMENT_STATUS, OUTPUT_DIR
from core import SupplementManager
from models import SupplementRecord
from reconciliation_report import ReconciliationReportGenerator
from errors import (
    DuplicateRecordError,
    InvalidStatusTransitionError,
    RecordNotFoundError,
    AmountMismatchError,
    FilterError
)


@pytest.fixture
def manager():
    return SupplementManager()


@pytest.fixture
def sample_reconciliation_file():
    df = pd.DataFrame([
        {
            "交易流水号": "T001",
            "交易时间": "2024-05-01 10:00:00",
            "交易金额": 100.00,
            "支付平台": "支付宝",
            "商户订单号": "ORD001",
            "备注": "正常交易"
        },
        {
            "交易流水号": "T002",
            "交易时间": "2024-05-02 14:30:00",
            "交易金额": 200.00,
            "支付平台": "微信支付",
            "商户订单号": "ORD002",
            "备注": "客户申请退款"
        },
        {
            "交易流水号": "T003",
            "交易时间": "2024-05-03 09:15:00",
            "交易金额": 300.00,
            "支付平台": "银行卡",
            "商户订单号": "ORD003",
            "备注": "质量问题退款"
        },
        {
            "交易流水号": "T004",
            "交易时间": "2024-05-04 16:45:00",
            "交易金额": 150.00,
            "支付平台": "支付宝",
            "商户订单号": "ORD004",
            "备注": ""
        }
    ])
    
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as f:
        df.to_excel(f.name, index=False)
        yield f.name
        os.unlink(f.name)


@pytest.fixture
def sample_refund_file():
    df = pd.DataFrame([
        {
            "退款流水号": "R001",
            "原交易流水号": "T001",
            "退款金额": 100.00,
            "退款时间": "2024-05-02 10:00:00",
            "退款状态": "退款成功",
            "退款原因": "不想要了",
            "操作人": "张会计"
        },
        {
            "退款流水号": "R002",
            "原交易流水号": "T002",
            "退款金额": 190.00,
            "退款时间": "2024-05-03 14:30:00",
            "退款状态": "退款成功",
            "退款原因": "使用优惠券",
            "操作人": "李会计"
        },
        {
            "退款流水号": "R003",
            "原交易流水号": "T003",
            "退款金额": 300.00,
            "退款时间": "2024-05-04 09:15:00",
            "退款状态": "退款成功",
            "退款原因": "质量问题",
            "操作人": "张会计"
        }
    ])
    
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as f:
        df.to_excel(f.name, index=False)
        yield f.name
        os.unlink(f.name)


class TestImportConsistency:
    def test_import_reconciliation_success(self, manager, sample_reconciliation_file):
        new_count, dup_count = manager.import_reconciliation(sample_reconciliation_file)
        assert new_count == 4
        assert dup_count == 0
        assert len(manager.reconciliation_records) == 4
        assert manager.reconciliation_records["T001"].交易金额 == 100.00
    
    def test_import_reconciliation_duplicate_skipped(self, manager, sample_reconciliation_file):
        manager.import_reconciliation(sample_reconciliation_file)
        new_count, dup_count = manager.import_reconciliation(sample_reconciliation_file)
        assert new_count == 0
        assert dup_count == 4
        assert len(manager.reconciliation_records) == 4
    
    def test_import_refund_success(self, manager, sample_refund_file):
        new_count, dup_count = manager.import_refund_flow(sample_refund_file)
        assert new_count == 3
        assert dup_count == 0
        assert len(manager.refund_flow_records) == 3
    
    def test_import_refund_duplicate_skipped(self, manager, sample_refund_file):
        manager.import_refund_flow(sample_refund_file)
        new_count, dup_count = manager.import_refund_flow(sample_refund_file)
        assert new_count == 0
        assert dup_count == 3
        assert len(manager.refund_flow_records) == 3


class TestMatchConsistency:
    def test_match_creates_correct_records(self, manager, sample_reconciliation_file, sample_refund_file):
        manager.import_reconciliation(sample_reconciliation_file)
        manager.import_refund_flow(sample_refund_file)
        
        matched, mismatch, _ = manager.match_supplements()
        
        assert matched == 2
        assert mismatch == 1
        
        total_supplements = len([s for s in manager.supplement_records.values() 
                                if s.补单状态 != SUPPLEMENT_STATUS["REVOKED"]])
        assert total_supplements == 4
        
        t004_supplements = [s for s in manager.supplement_records.values() 
                           if s.原交易流水号 == "T004"]
        assert len(t004_supplements) == 1
        assert "有退款记录无退款流水" in t004_supplements[0].处理口径
    
    def test_match_amount_mismatch_detected(self, manager, sample_reconciliation_file, sample_refund_file):
        manager.import_reconciliation(sample_reconciliation_file)
        manager.import_refund_flow(sample_refund_file)
        
        matched, mismatch, mismatched_ids = manager.match_supplements()
        
        assert mismatch == 1
        assert "R002" in mismatched_ids
        
        r002_supplement = [s for s in manager.supplement_records.values() 
                          if s.退款流水号 == "R002"][0]
        assert r002_supplement.补单状态 == SUPPLEMENT_STATUS["PENDING"]
        assert "金额不匹配" in r002_supplement.补单说明
    
    def test_match_no_duplicate_supplements(self, manager, sample_reconciliation_file, sample_refund_file):
        manager.import_reconciliation(sample_reconciliation_file)
        manager.import_refund_flow(sample_refund_file)
        
        manager.match_supplements()
        count1 = len(manager.supplement_records)
        
        manager.match_supplements()
        count2 = len(manager.supplement_records)
        
        assert count1 == count2


class TestStatusTransitionConsistency:
    def test_confirm_pending_success(self, manager, sample_reconciliation_file, sample_refund_file):
        manager.import_reconciliation(sample_reconciliation_file)
        manager.import_refund_flow(sample_refund_file)
        manager.match_supplements()
        
        pending = [s for s in manager.supplement_records.values() 
                  if s.补单状态 == SUPPLEMENT_STATUS["PENDING"] 
                  and "金额不匹配" not in s.处理口径][0]
        
        result = manager.confirm_supplement(pending.补单编号, "测试员")
        assert result.补单状态 == SUPPLEMENT_STATUS["CONFIRMED"]
        assert result.确认时间 is not None
        assert result.修改人 == "测试员"
    
    def test_cannot_confirm_revoked(self, manager, sample_reconciliation_file, sample_refund_file):
        manager.import_reconciliation(sample_reconciliation_file)
        manager.import_refund_flow(sample_refund_file)
        manager.match_supplements()
        
        supplement = list(manager.supplement_records.values())[0]
        supplement.补单状态 = SUPPLEMENT_STATUS["REVOKED"]
        
        with pytest.raises(InvalidStatusTransitionError):
            manager.confirm_supplement(supplement.补单编号)
    
    def test_revoke_confirmed_success(self, manager, sample_reconciliation_file, sample_refund_file):
        manager.import_reconciliation(sample_reconciliation_file)
        manager.import_refund_flow(sample_refund_file)
        manager.match_supplements()
        
        confirmed = [s for s in manager.supplement_records.values() 
                    if s.补单状态 == SUPPLEMENT_STATUS["CONFIRMED"]]
        if not confirmed:
            pending = [s for s in manager.supplement_records.values() 
                      if s.补单状态 == SUPPLEMENT_STATUS["PENDING"]][0]
            manager.confirm_supplement(pending.补单编号)
            confirmed = [pending]
        
        result = manager.revoke_supplement(confirmed[0].补单编号, "测试员")
        assert result.补单状态 == SUPPLEMENT_STATUS["REVOKED"]
        assert result.撤回时间 is not None
    
    def test_cannot_revoke_pending(self, manager, sample_reconciliation_file, sample_refund_file):
        manager.import_reconciliation(sample_reconciliation_file)
        manager.import_refund_flow(sample_refund_file)
        manager.match_supplements()
        
        pending = [s for s in manager.supplement_records.values() 
                  if s.补单状态 == SUPPLEMENT_STATUS["PENDING"]][0]
        
        with pytest.raises(InvalidStatusTransitionError):
            manager.revoke_supplement(pending.补单编号)
    
    def test_modify_pending_success(self, manager, sample_reconciliation_file, sample_refund_file):
        manager.import_reconciliation(sample_reconciliation_file)
        manager.import_refund_flow(sample_refund_file)
        manager.match_supplements()
        
        pending = [s for s in manager.supplement_records.values() 
                  if s.补单状态 == SUPPLEMENT_STATUS["PENDING"]][0]
        old_amount = pending.补单金额
        
        result = manager.modify_supplement(
            pending.补单编号,
            {"补单金额": 999.99, "补单说明": "人工修改测试"},
            "测试员"
        )
        
        assert result.补单状态 == SUPPLEMENT_STATUS["MANUAL_MODIFIED"]
        assert result.补单金额 == 999.99
        assert result.是否人工修改 == True
        assert result.修改前内容["补单金额"] == old_amount
        assert result.修改人 == "测试员"


class TestFilterConsistency:
    def test_filter_by_status(self, manager, sample_reconciliation_file, sample_refund_file):
        manager.import_reconciliation(sample_reconciliation_file)
        manager.import_refund_flow(sample_refund_file)
        manager.match_supplements()
        
        pending = manager.filter_supplements("补单状态=待补录")
        all_pending = [s for s in manager.supplement_records.values() 
                      if s.补单状态 == SUPPLEMENT_STATUS["PENDING"]]
        assert len(pending) == len(all_pending)
    
    def test_filter_by_platform(self, manager, sample_reconciliation_file, sample_refund_file):
        manager.import_reconciliation(sample_reconciliation_file)
        manager.import_refund_flow(sample_refund_file)
        manager.match_supplements()
        
        alipay = manager.filter_supplements("对账单_支付平台=支付宝")
        for record in alipay:
            if record.关联对账单信息:
                assert record.关联对账单信息["支付平台"] == "支付宝"
    
    def test_filter_by_amount(self, manager, sample_reconciliation_file, sample_refund_file):
        manager.import_reconciliation(sample_reconciliation_file)
        manager.import_refund_flow(sample_refund_file)
        manager.match_supplements()
        
        result = manager.filter_supplements("补单金额>200")
        for record in result:
            assert record.补单金额 > 200
    
    def test_filter_multiple_conditions(self, manager, sample_reconciliation_file, sample_refund_file):
        manager.import_reconciliation(sample_reconciliation_file)
        manager.import_refund_flow(sample_refund_file)
        manager.match_supplements()
        
        result = manager.filter_supplements("补单状态=待补录,补单金额>150")
        for record in result:
            assert record.补单状态 == SUPPLEMENT_STATUS["PENDING"]
            assert record.补单金额 > 150
    
    def test_filter_invalid_condition(self, manager):
        with pytest.raises(FilterError):
            manager.filter_supplements("无效条件")


class TestExportConsistency:
    def test_export_matches_filter(self, manager, sample_reconciliation_file, sample_refund_file):
        manager.import_reconciliation(sample_reconciliation_file)
        manager.import_refund_flow(sample_refund_file)
        manager.match_supplements()
        
        filtered = manager.filter_supplements("补单状态=待补录")
        
        with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as f:
            output_path = f.name
        
        try:
            result_path = manager.export_supplements(output_path, filtered, format="xlsx")
            assert os.path.exists(result_path)
            
            df = pd.read_excel(result_path, sheet_name="补单记录")
            assert len(df) == len(filtered)
        finally:
            if os.path.exists(output_path):
                os.unlink(output_path)
    
    def test_export_includes_summary_and_log(self, manager, sample_reconciliation_file, sample_refund_file):
        manager.import_reconciliation(sample_reconciliation_file)
        manager.import_refund_flow(sample_refund_file)
        manager.match_supplements()
        
        with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as f:
            output_path = f.name
        
        try:
            result_path = manager.export_supplements(output_path, format="xlsx")
            
            xl = pd.ExcelFile(result_path)
            sheets = xl.sheet_names
            assert "补单记录" in sheets
            assert "汇总统计" in sheets
            assert "操作日志" in sheets
            
            log_df = pd.read_excel(result_path, sheet_name="操作日志")
            assert len(log_df) > 0
        finally:
            if os.path.exists(output_path):
                os.unlink(output_path)


class TestReportConsistency:
    def test_report_separates_statuses(self, manager, sample_reconciliation_file, sample_refund_file):
        manager.import_reconciliation(sample_reconciliation_file)
        manager.import_refund_flow(sample_refund_file)
        manager.match_supplements()
        
        pending = [s for s in manager.supplement_records.values() 
                  if s.补单状态 == SUPPLEMENT_STATUS["PENDING"]]
        for p in pending[:1]:
            manager.confirm_supplement(p.补单编号)
        
        pending2 = [s for s in manager.supplement_records.values() 
                   if s.补单状态 == SUPPLEMENT_STATUS["PENDING"]]
        if pending2:
            manager.modify_supplement(
                pending2[0].补单编号,
                {"补单说明": "人工修改过"},
                "测试员"
            )
        
        reporter = ReconciliationReportGenerator(manager)
        summary = reporter.generate_summary()
        
        assert "已确认记录" in summary
        assert "待补录记录" in summary
        assert "人工修改记录" in summary
        assert int(summary["已确认记录"]["数量"]) >= 1
        assert int(summary["人工修改记录"]["数量"]) >= 1
    
    def test_report_includes_processing_criteria(self, manager, sample_reconciliation_file, sample_refund_file):
        manager.import_reconciliation(sample_reconciliation_file)
        manager.import_refund_flow(sample_refund_file)
        manager.match_supplements()
        
        reporter = ReconciliationReportGenerator(manager)
        
        for record in manager.supplement_records.values():
            criteria = reporter._get_processing_criteria(record)
            assert criteria != ""
            assert isinstance(criteria, str)
    
    def test_hanging_account_report(self, manager, sample_reconciliation_file, sample_refund_file):
        manager.import_reconciliation(sample_reconciliation_file)
        manager.import_refund_flow(sample_refund_file)
        manager.match_supplements()
        
        reporter = ReconciliationReportGenerator(manager)
        
        with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as f:
            output_path = f.name
        
        try:
            result_path = reporter.generate_hanging_account_report(output_path)
            assert os.path.exists(result_path)
            
            xl = pd.ExcelFile(result_path)
            assert "退款挂账明细" in xl.sheet_names
            assert "挂账原因汇总" in xl.sheet_names
        finally:
            if os.path.exists(output_path):
                os.unlink(output_path)


class TestOperationLogConsistency:
    def test_all_operations_logged(self, manager, sample_reconciliation_file, sample_refund_file):
        initial_log_count = len(manager.operation_log)
        
        manager.import_reconciliation(sample_reconciliation_file)
        assert len(manager.operation_log) == initial_log_count + 1
        assert manager.operation_log[-1]["操作类型"] == "导入对账单"
        
        manager.import_refund_flow(sample_refund_file)
        assert len(manager.operation_log) == initial_log_count + 2
        assert manager.operation_log[-1]["操作类型"] == "导入退款流水"
        
        manager.match_supplements()
        assert len(manager.operation_log) == initial_log_count + 3
        assert manager.operation_log[-1]["操作类型"] == "自动匹配补单"
        
        supplement = list(manager.supplement_records.values())[0]
        if supplement.补单状态 == SUPPLEMENT_STATUS["PENDING"] and "金额不匹配" not in supplement.处理口径:
            manager.confirm_supplement(supplement.补单编号)
            assert manager.operation_log[-1]["操作类型"] == "确认补单"
        
        manager.export_supplements(tempfile.mktemp(suffix=".xlsx"))
        assert manager.operation_log[-1]["操作类型"] == "导出补单"
    
    def test_log_includes_details(self, manager, sample_reconciliation_file):
        manager.import_reconciliation(sample_reconciliation_file)
        
        log_entry = manager.operation_log[-1]
        assert "操作时间" in log_entry
        assert "文件名" in log_entry
        assert "新增记录数" in log_entry
        assert "跳过重复数" in log_entry


class TestStatisticsConsistency:
    def test_statistics_match_data(self, manager, sample_reconciliation_file, sample_refund_file):
        manager.import_reconciliation(sample_reconciliation_file)
        manager.import_refund_flow(sample_refund_file)
        manager.match_supplements()
        
        stats = manager.get_statistics()
        
        expected_total = len([s for s in manager.supplement_records.values() 
                             if s.补单状态 != SUPPLEMENT_STATUS["REVOKED"]])
        assert stats["总记录数（不含已撤回）"] == expected_total
        
        expected_amount = sum(s.补单金额 for s in manager.supplement_records.values() 
                             if s.补单状态 != SUPPLEMENT_STATUS["REVOKED"])
        assert f"¥{expected_amount:.2f}" == stats["总补单金额"]
        
        assert stats["对账单记录数"] == 4
        assert stats["退款流水记录数"] == 3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
