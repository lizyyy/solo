"""端到端测试 - 验证置信区间样本量试算完整流程

核心验证点：
1. 三步核心流程能跑通（导入权重表→导入样本→补录截图）
2. 边界值刚好等于阈值时标记为 NEED_REVIEW，不自动归为正常
3. 补录旧公式截图后反例列表自动更新
4. 三种典型记录处理结果不同
5. 人工修正和重跑流程正常
"""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from ci_sample_calc.models import RecordStatus, DataSource
from ci_sample_calc.workflow import CISampleWorkflow
from demo_data.demo_dataset import (
    WEIGHT_TABLE_DATA,
    SAMPLE_RECORDS_DATA,
    OLD_FORMULA_SCREENSHOT_DATA,
)


class TestThreeStepWorkflow:
    """测试三步核心流程"""

    def setup_method(self):
        """每个测试前初始化工作流"""
        self.wf = CISampleWorkflow()

    def test_step1_import_weight_table(self):
        """第1步：导入评分权重表"""
        weight_table = self.wf.step1_import_weight_table(WEIGHT_TABLE_DATA)

        assert weight_table is not None
        assert weight_table.name == "2024-2025学年第二学期评分权重表"
        assert weight_table.version == "v2.1"
        assert len(weight_table.rules) == 4
        assert weight_table.is_active is True
        assert self.wf.weight_manager.get_active_table() is weight_table

        # 验证边界阈值精确值（80-89分区间）
        boundary_rule = weight_table.rules[1]
        assert boundary_rule.score_range == "80-89"
        assert abs(boundary_rule.threshold - 0.626939526190) < 1e-12

    def test_step2_import_and_calculate_records(self):
        """第2步：导入样本记录并试算 - 重点验证边界值处理"""
        # 先执行第1步
        self.wf.step1_import_weight_table(WEIGHT_TABLE_DATA)

        # 执行第2步
        records = self.wf.step2_import_sample_records(SAMPLE_RECORDS_DATA)

        assert len(records) == 3
        assert len(self.wf.get_all_records()) == 3

        # 案例1: 顺利记录 - NORMAL
        rec1 = self.wf.get_record("REC-2024-001")
        assert rec1.status == RecordStatus.NORMAL
        assert rec1.ci_lower > 0.85
        assert rec1.boundary_equal_to_threshold is False

        # 案例2: 边界值记录 - 核心验证点！
        rec2 = self.wf.get_record("REC-2024-002")
        assert rec2.status == RecordStatus.NEED_REVIEW
        assert rec2.boundary_equal_to_threshold is True
        assert abs(rec2.ci_lower - 0.626939526190) < 1e-9
        assert "待任课老师复核" in rec2.review_note

        # 关键断言：边界值不等于阈值时不应该自动归为正常
        assert rec2.status != RecordStatus.NORMAL
        assert rec2.status != RecordStatus.BOUNDARY

        # 案例3: 正常记录
        rec3 = self.wf.get_record("REC-2024-003")
        assert rec3.status == RecordStatus.NORMAL

        # 验证边界案例列表
        boundary_cases = self.wf.get_boundary_cases()
        assert len(boundary_cases) == 1
        assert boundary_cases[0].record_id == "REC-2024-002"

    def test_step3_old_formula_screenshot_updates_counter_examples(self):
        """第3步：补录旧公式截图后反例列表自动更新"""
        # 先执行第1、2步
        self.wf.step1_import_weight_table(WEIGHT_TABLE_DATA)
        self.wf.step2_import_sample_records(SAMPLE_RECORDS_DATA)

        # 验证补录前反例数量为0
        before_count = len(self.wf.get_counter_examples())
        assert before_count == 0
        assert len(self.wf.get_all_records()) == 3

        # 执行第3步：补录旧公式截图
        counter_example, old_record = self.wf.step3_process_old_formula_screenshot(
            OLD_FORMULA_SCREENSHOT_DATA,
            target_record_id="REC-2024-003",
        )

        # 验证反例列表自动更新
        after_count = len(self.wf.get_counter_examples())
        assert after_count == 1
        assert after_count > before_count

        # 验证反例内容
        assert counter_example.record_id == "REC-2024-003"
        assert counter_example.issue_type == "old_formula_abnormal"
        assert counter_example.formula_version == "v1"
        assert counter_example.resolved is False
        assert "旧公式口径下置信区间下限" in counter_example.description

        # 验证旧口径记录
        assert old_record.record_id == "REC-2024-003-old"
        assert old_record.data_source == DataSource.OLD_FORMULA
        assert old_record.formula_version == "v1"
        assert old_record.status == RecordStatus.ABNORMAL
        assert "来自旧公式截图补录" in old_record.review_note

        # 验证总记录数增长
        assert len(self.wf.get_all_records()) == 4

        # 验证未解决反例数量
        unresolved = self.wf.get_counter_examples(unresolved_only=True)
        assert len(unresolved) == 1


class TestThreeDifferentResults:
    """验证三种典型记录处理结果不同"""

    def test_three_records_have_different_outcomes(self):
        """三种记录应有三种不同的处理结果"""
        wf = CISampleWorkflow()
        wf.step1_import_weight_table(WEIGHT_TABLE_DATA)
        wf.step2_import_sample_records(SAMPLE_RECORDS_DATA)
        wf.step3_process_old_formula_screenshot(
            OLD_FORMULA_SCREENSHOT_DATA,
            target_record_id="REC-2024-003",
        )

        rec1 = wf.get_record("REC-2024-001")  # 顺利
        rec2 = wf.get_record("REC-2024-002")  # 边界
        rec3 = wf.get_record("REC-2024-003")  # 新口径
        rec3_old = wf.get_record("REC-2024-003-old")  # 旧口径

        # 状态应该不同
        statuses = {
            "顺利记录": rec1.status,
            "边界记录": rec2.status,
            "新口径记录": rec3.status,
            "旧口径记录": rec3_old.status,
        }

        # 至少有三种不同状态
        unique_statuses = set(statuses.values())
        assert len(unique_statuses) >= 3, f"状态不够多样化: {statuses}"

        # 验证每种状态的含义
        assert rec1.status == RecordStatus.NORMAL  # 顺利通过
        assert rec2.status == RecordStatus.NEED_REVIEW  # 待复核
        assert rec3.status == RecordStatus.NORMAL  # 新口径正常
        assert rec3_old.status == RecordStatus.ABNORMAL  # 旧口径异常


class TestManualFixAndRerun:
    """测试人工修正和重跑流程"""

    def test_manual_fix_boundary_case(self):
        """测试人工修正边界案例"""
        wf = CISampleWorkflow()
        wf.step1_import_weight_table(WEIGHT_TABLE_DATA)
        wf.step2_import_sample_records(SAMPLE_RECORDS_DATA)

        # 修正前
        rec = wf.get_record("REC-2024-002")
        assert rec.status == RecordStatus.NEED_REVIEW
        assert len(rec.fix_history) == 0

        # 人工修正
        fixed_rec = wf.manual_fix_record(
            record_id="REC-2024-002",
            operator="任课老师刘主任",
            new_status=RecordStatus.MANUAL_FIXED,
            note="班级整体正态分布，确认教学效果达标",
        )

        # 验证修正结果
        assert fixed_rec.status == RecordStatus.MANUAL_FIXED
        assert len(fixed_rec.fix_history) == 1
        assert fixed_rec.fix_history[0]["before"] == "need_review"
        assert fixed_rec.fix_history[0]["after"] == "manual_fixed"
        assert fixed_rec.fix_history[0]["operator"] == "任课老师刘主任"
        assert "正态分布" in fixed_rec.fix_history[0]["note"]

        # 边界标记应该保留
        assert fixed_rec.boundary_equal_to_threshold is True

    def test_rerun_old_formula_record(self):
        """测试重跑旧口径记录"""
        wf = CISampleWorkflow()
        wf.step1_import_weight_table(WEIGHT_TABLE_DATA)
        wf.step2_import_sample_records(SAMPLE_RECORDS_DATA)
        _, old_record = wf.step3_process_old_formula_screenshot(
            OLD_FORMULA_SCREENSHOT_DATA,
            target_record_id="REC-2024-003",
        )

        # 重跑前
        assert old_record.status == RecordStatus.ABNORMAL
        assert old_record.pass_count == 76

        # 修正数据后重跑
        old_record.pass_count = 79
        old_record.pass_rate = 79 / 100

        rerun_rec = wf.rerun_single_record(
            record_id="REC-2024-003-old",
            operator="运营规划阿岚",
            note="修正统计错误后重跑",
        )

        # 验证重跑结果
        assert rerun_rec is not None
        assert rerun_rec.formula_version == "v2"
        assert "修正统计错误" in rerun_rec.review_note
        assert len(rerun_rec.fix_history) >= 1

        # 边界标记被清除（重跑后重新计算）
        assert rerun_rec.boundary_equal_to_threshold is False


class TestWorkflowSummary:
    """测试工作流摘要"""

    def test_summary_contains_all_key_metrics(self):
        """摘要应包含所有关键指标"""
        wf = CISampleWorkflow()
        wf.step1_import_weight_table(WEIGHT_TABLE_DATA)
        wf.step2_import_sample_records(SAMPLE_RECORDS_DATA)
        wf.step3_process_old_formula_screenshot(
            OLD_FORMULA_SCREENSHOT_DATA,
            target_record_id="REC-2024-003",
        )

        summary = wf.get_workflow_summary()

        assert summary["total_records"] == 4
        assert summary["boundary_cases_count"] == 1
        assert summary["counter_examples_count"] == 1
        assert summary["unresolved_counter_examples"] == 1
        assert summary["active_weight_table"] is not None
        assert summary["workflow_steps"] == 3

        # 状态统计
        status_summary = summary["status_summary"]
        assert "normal" in status_summary
        assert "need_review" in status_summary
        assert "abnormal" in status_summary


class TestBoundaryEdgeCases:
    """边界值处理的更细致测试"""

    def test_boundary_value_not_auto_normalized(self):
        """
        核心需求验证：边界值刚好等于阈值时，不能自动归为正常
        必须留给任课老师复核
        """
        wf = CISampleWorkflow()
        wf.step1_import_weight_table(WEIGHT_TABLE_DATA)

        # 导入单条边界记录
        boundary_record_data = {
            "record_id": "TEST-BOUNDARY-001",
            "course_name": "测试边界课程",
            "teacher_name": "测试老师",
            "sample_size": 30,
            "pass_count": 24,
            "score": 80.0,
        }
        records = wf.step2_import_sample_records([boundary_record_data])

        rec = records[0]

        # 这是核心断言！
        assert rec.boundary_equal_to_threshold is True
        assert rec.status == RecordStatus.NEED_REVIEW
        assert rec.status != RecordStatus.NORMAL
        assert rec.status != RecordStatus.BOUNDARY

        # 差值应为0（或极小）
        diff = abs(rec.ci_lower - 0.626939526190)
        assert diff < 1e-9, f"差值过大: {diff}"

        # 必须有复核备注
        assert rec.review_note != ""
        assert "任课老师" in rec.review_note or "复核" in rec.review_note

    def test_non_boundary_values_work_normally(self):
        """非边界值应该正常处理"""
        wf = CISampleWorkflow()
        wf.step1_import_weight_table(WEIGHT_TABLE_DATA)

        # 明显大于阈值
        above_threshold = {
            "record_id": "TEST-ABOVE-001",
            "course_name": "明显高于阈值",
            "teacher_name": "张老师",
            "sample_size": 100,
            "pass_count": 95,
            "score": 95.0,
        }

        # 明显小于阈值
        below_threshold = {
            "record_id": "TEST-BELOW-001",
            "course_name": "明显低于阈值",
            "teacher_name": "李老师",
            "sample_size": 100,
            "pass_count": 50,
            "score": 65.0,
        }

        records = wf.step2_import_sample_records([above_threshold, below_threshold])

        assert records[0].status == RecordStatus.NORMAL
        assert records[0].boundary_equal_to_threshold is False

        assert records[1].status == RecordStatus.ABNORMAL
        assert records[1].boundary_equal_to_threshold is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
