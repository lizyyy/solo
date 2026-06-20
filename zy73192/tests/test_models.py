import pytest
from sequence_error_attribution.models import QuestionRecord, AttributionResult
from sequence_error_attribution.config import STABLE_MESSAGES


class TestQuestionRecord:
    """测试题目记录模型"""

    def test_default_values(self):
        """测试默认值设置"""
        record = QuestionRecord()
        assert record.question_id == ""
        assert record.question_source == ""
        assert record.processing_status == STABLE_MESSAGES.STATUS_PENDING
        assert record.needs_review is False
        assert record.jump_detected is False
        assert record.original_terms == []
        assert record.calculated_terms == []
        assert record.processing_log == []

    def test_source_location_with_file_and_row(self):
        """测试来源位置格式（含文件名和行号）"""
        record = QuestionRecord(source_row=5, source_file="questions.csv")
        assert record.source_location == "questions.csv:5"

    def test_source_location_with_row_only(self):
        """测试来源位置格式（仅行号）"""
        record = QuestionRecord(source_row=10)
        assert record.source_location == "第10行"

    def test_source_location_with_file_only(self):
        """测试来源位置格式（仅文件名）"""
        record = QuestionRecord(source_file="data.xlsx")
        assert record.source_location == "data.xlsx"

    def test_source_location_unknown(self):
        """测试未知来源位置"""
        record = QuestionRecord()
        assert record.source_location == "未知来源"

    def test_add_log(self):
        """测试添加日志"""
        record = QuestionRecord()
        record.add_log("测试日志消息")
        assert len(record.processing_log) == 1
        assert "测试日志消息" in record.processing_log[0]
        assert "[" in record.processing_log[0]
        assert "]" in record.processing_log[0]

    def test_mark_for_review(self):
        """测试标记待复核"""
        record = QuestionRecord()
        reason = STABLE_MESSAGES.REVIEW_REASON_DIVISION_BY_ZERO
        record.mark_for_review(reason)

        assert record.needs_review is True
        assert record.review_reason == reason
        assert record.processing_status == STABLE_MESSAGES.STATUS_NEEDS_REVIEW
        assert any(reason in log for log in record.processing_log)

    def test_mark_success(self):
        """测试标记处理完成"""
        record = QuestionRecord()
        result = "计算错误: 第2项计算有误"
        category = "计算错误"
        record.mark_success(result, category)

        assert record.attribution_result == result
        assert record.error_category == category
        assert record.processing_status == STABLE_MESSAGES.STATUS_SUCCESS
        assert any(result in log for log in record.processing_log)

    def test_mark_failed(self):
        """测试标记处理失败"""
        record = QuestionRecord()
        error = "公式解析失败"
        record.mark_failed(error)

        assert record.processing_status == STABLE_MESSAGES.STATUS_FAILED
        assert any(error in log for log in record.processing_log)

    def test_to_output_dict(self):
        """测试转换为输出字典"""
        record = QuestionRecord(
            question_id="Q001",
            question_source="2023高考",
            source_row=2,
            source_file="test.csv",
            original_terms=[1.0, 2.0, 3.0],
            calculated_terms=[1.0, 2.0, 4.0],
            needs_review=True,
            review_reason=STABLE_MESSAGES.REVIEW_REASON_SMALL_SAMPLE,
        )
        record.add_log("测试日志")

        output = record.to_output_dict()

        assert output["question_id"] == "Q001"
        assert output["question_source"] == "2023高考"
        assert output["source_location"] == "test.csv:2"
        assert output["needs_review"] is True
        assert output["review_reason"] == STABLE_MESSAGES.REVIEW_REASON_SMALL_SAMPLE
        assert output["original_terms"] == "1.0; 2.0; 3.0"
        assert output["calculated_terms"] == "1.0; 2.0; 4.0"
        assert "测试日志" in output["processing_log"]

    def test_to_output_dict_empty_lists(self):
        """测试空列表转换为输出字典"""
        record = QuestionRecord()
        output = record.to_output_dict()

        assert output["original_terms"] == ""
        assert output["calculated_terms"] == ""
        assert output["processing_log"] == ""


class TestAttributionResult:
    """测试归因结果汇总模型"""

    def test_default_values(self):
        """测试默认值"""
        result = AttributionResult()
        assert result.total_records == 0
        assert result.success_count == 0
        assert result.review_count == 0
        assert result.failed_count == 0
        assert result.jump_count == 0
        assert result.records == []

    def test_generate_summary_with_records(self):
        """测试生成汇总报告（含记录）"""
        record1 = QuestionRecord(
            question_id="Q001",
            source_row=2,
            source_file="test.csv",
            processing_status=STABLE_MESSAGES.STATUS_SUCCESS,
        )
        record2 = QuestionRecord(
            question_id="Q002",
            source_row=3,
            source_file="test.csv",
            processing_status=STABLE_MESSAGES.STATUS_NEEDS_REVIEW,
            needs_review=True,
            review_reason=STABLE_MESSAGES.REVIEW_REASON_DIVISION_BY_ZERO,
            jump_detected=True,
            jump_reason=STABLE_MESSAGES.JUMP_REASON_THRESHOLD,
        )

        result = AttributionResult(
            total_records=2,
            success_count=1,
            review_count=1,
            jump_count=1,
            records=[record1, record2],
            output_file="/tmp/test.csv",
        )

        report = result.generate_summary()

        assert "数列递推错题归因分析报告" in report
        assert "总记录数: 2" in report
        assert "处理完成: 1" in report
        assert "待复核: 1" in report
        assert "检测到跳变: 1" in report
        assert "test.csv:3" in report
        assert STABLE_MESSAGES.REVIEW_REASON_DIVISION_BY_ZERO in report
        assert STABLE_MESSAGES.JUMP_REASON_THRESHOLD in report
        assert "交接说明" in report
        assert "source_location字段" in report

    def test_generate_summary_empty(self):
        """测试生成空汇总报告"""
        result = AttributionResult()
        report = result.generate_summary()

        assert "数列递推错题归因分析报告" in report
        assert "总记录数: 0" in report
        assert "处理完成: 0" in report
