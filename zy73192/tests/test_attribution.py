import pytest
import math
from sequence_error_attribution.attribution import SequenceAttribution
from sequence_error_attribution.models import QuestionRecord
from sequence_error_attribution.config import DEFAULT_CONFIG, STABLE_MESSAGES


class TestSequenceAttribution:
    """测试数列递推错题归因算法"""

    @pytest.fixture
    def attribution(self):
        """创建归因分析器"""
        return SequenceAttribution()

    def test_is_zero_with_tolerance(self, attribution):
        """测试零值判断（考虑容差）"""
        assert attribution._is_zero(0.0) is True
        assert attribution._is_zero(1e-15) is True
        assert attribution._is_zero(1e-5) is False
        assert attribution._is_zero(1.0) is False
        assert attribution._is_zero(-1e-15) is True

    def test_evaluate_formula_simple_linear(self, attribution):
        """测试计算简单线性递推公式"""
        result, warning = attribution._evaluate_formula("2*a_n + 1", 2.0)
        assert abs(result - 5.0) < 1e-6
        assert warning is None

    def test_evaluate_formula_division_by_zero(self, attribution):
        """测试除零边界检测"""
        result, warning = attribution._evaluate_formula("a_n / (a_n - 1)", 1.0)
        assert math.isnan(result)
        assert STABLE_MESSAGES.REVIEW_REASON_DIVISION_BY_ZERO in warning

    def test_evaluate_formula_division_by_zero_with_parentheses(self, attribution):
        """测试带括号的除零边界检测"""
        result, warning = attribution._evaluate_formula("(a_n + 1) / (a_n - 2)", 2.0)
        assert math.isnan(result)
        assert STABLE_MESSAGES.REVIEW_REASON_DIVISION_BY_ZERO in warning

    def test_evaluate_formula_fractional(self, attribution):
        """测试计算分式递推公式"""
        result, warning = attribution._evaluate_formula("a_n / (a_n - 2)", 1.0)
        assert abs(result - (-1.0)) < 1e-6
        assert warning is None

    def test_evaluate_formula_different_notation(self, attribution):
        """测试不同公式表示法"""
        result1, _ = attribution._evaluate_formula("2*a(n) + 1", 3.0)
        result2, _ = attribution._evaluate_formula("2*an + 1", 3.0)
        result3, _ = attribution._evaluate_formula("2*x + 1", 3.0)

        assert abs(result1 - 7.0) < 1e-6
        assert abs(result2 - 7.0) < 1e-6
        assert abs(result3 - 7.0) < 1e-6

    def test_evaluate_formula_empty(self, attribution):
        """测试空公式"""
        result, warning = attribution._evaluate_formula("", 1.0)
        assert math.isnan(result)
        assert warning is None

    def test_calculate_sequence_linear(self, attribution):
        """测试计算线性递推数列"""
        terms, warnings = attribution._calculate_sequence(
            [2.0], "2*a_n + 1", n_terms=5
        )
        assert len(terms) == 5
        assert abs(terms[0] - 2.0) < 1e-6
        assert abs(terms[1] - 5.0) < 1e-6
        assert abs(terms[2] - 11.0) < 1e-6
        assert abs(terms[3] - 23.0) < 1e-6
        assert abs(terms[4] - 47.0) < 1e-6
        assert len(warnings) == 0

    def test_calculate_sequence_division_by_zero(self, attribution):
        """测试计算过程中遇到除零"""
        terms, warnings = attribution._calculate_sequence(
            [1.0], "a_n / (a_n - 1)", n_terms=5
        )
        assert len(terms) >= 2
        assert terms[0] == 1.0
        assert math.isnan(terms[1])
        assert any(STABLE_MESSAGES.REVIEW_REASON_DIVISION_BY_ZERO in w for w in warnings)

    def test_calculate_sequence_empty_terms(self, attribution):
        """测试空初始项"""
        terms, warnings = attribution._calculate_sequence([], "2*a_n + 1")
        assert terms == []
        assert warnings == []

    def test_parse_numeric_answer(self, attribution):
        """测试解析答案中的数值"""
        terms = attribution._parse_numeric_answer("2, 5, 11, 23")
        assert terms == [2.0, 5.0, 11.0, 23.0]

    def test_parse_numeric_answer_with_spaces(self, attribution):
        """测试解析带空格的答案"""
        terms = attribution._parse_numeric_answer("2 5 11 23")
        assert terms == [2.0, 5.0, 11.0, 23.0]

    def test_parse_numeric_answer_with_text(self, attribution):
        """测试解析包含文字的答案"""
        terms = attribution._parse_numeric_answer("a1=2, a2=5, a3=11")
        assert terms == [1.0, 2.0, 2.0, 5.0, 3.0, 11.0]

    def test_parse_numeric_answer_empty(self, attribution):
        """测试解析空答案"""
        terms = attribution._parse_numeric_answer("")
        assert terms == []

        terms = attribution._parse_numeric_answer(None)
        assert terms == []

    def test_check_calculation_error(self, attribution):
        """测试检测计算错误"""
        student = [2.0, 5.0, 12.0, 23.0]
        correct = [2.0, 5.0, 11.0, 23.0]
        has_error, msg, positions = attribution._check_calculation_error(student, correct)
        assert has_error is True
        assert "第[3]项" in msg
        assert positions == [2]

    def test_check_calculation_error_no_error(self, attribution):
        """测试无计算错误"""
        student = [2.0, 5.0, 11.0, 23.0]
        correct = [2.0, 5.0, 11.0, 23.0]
        has_error, msg, positions = attribution._check_calculation_error(student, correct)
        assert has_error is False
        assert msg == ""
        assert positions == []

    def test_check_index_error(self, attribution):
        """测试检测索引错误"""
        student = [5.0, 11.0, 23.0]
        correct = [2.0, 5.0, 11.0, 23.0]
        has_error, msg = attribution._check_index_error(student, correct)
        assert has_error is True
        assert "偏移了1项" in msg

    def test_check_initial_term_error(self, attribution):
        """测试检测初始项错误"""
        student = [3.0, 5.0, 11.0]
        correct = [2.0, 5.0, 11.0]
        has_error, msg = attribution._check_initial_term_error(student, correct)
        assert has_error is True
        assert "首项应为2.0" in msg

    def test_check_formula_misapplication(self, attribution):
        """测试检测递推公式应用错误"""
        student_terms = [2.0, 6.0, 13.0]
        formula = "2*a_n + 1"
        given_terms = [2.0]
        has_error, msg = attribution._check_formula_misapplication(student_terms, formula, given_terms)
        assert has_error is True
        assert "应为5.0" in msg
        assert "学生得到6.0" in msg

    def test_analyze_small_sample(self, attribution):
        """测试样本量不足时标记待复核"""
        record = QuestionRecord(
            question_id="Q001",
            original_terms=[1.0],
            recurrence_formula="2*a_n + 1",
            student_answer="1, 3",
        )
        result = attribution.analyze(record)
        assert result.needs_review is True
        assert STABLE_MESSAGES.REVIEW_REASON_SMALL_SAMPLE in result.review_reason

    def test_analyze_division_by_zero(self, attribution):
        """测试除零边界标记待复核"""
        record = QuestionRecord(
            question_id="Q001",
            original_terms=[1.0, 2.0, 3.0],
            recurrence_formula="a_n / (a_n - 1)",
            student_answer="1, 无穷大",
        )
        result = attribution.analyze(record)
        assert result.needs_review is True
        assert STABLE_MESSAGES.REVIEW_REASON_DIVISION_BY_ZERO in result.review_reason

    def test_analyze_negative_term(self, attribution):
        """测试负项数标记待复核"""
        record = QuestionRecord(
            question_id="Q001",
            original_terms=[1.0, 2.0, -3.0],
            recurrence_formula="2*a_n + 1",
            student_answer="1, 2, -3",
        )
        result = attribution.analyze(record)
        assert result.needs_review is True
        assert "负值" in result.review_reason

    def test_analyze_correct_answer(self, attribution):
        """测试正确答案的归因"""
        record = QuestionRecord(
            question_id="Q001",
            original_terms=[2.0, 5.0, 11.0],
            recurrence_formula="2*a_n + 1",
            student_answer="2, 5, 11, 23",
            correct_answer="2, 5, 11, 23",
        )
        result = attribution.analyze(record)
        assert result.processing_status == STABLE_MESSAGES.STATUS_SUCCESS
        assert "答案正确" in result.attribution_result

    def test_analyze_calculation_error(self, attribution):
        """测试计算错误的归因"""
        record = QuestionRecord(
            question_id="Q001",
            original_terms=[2.0, 5.0, 11.0],
            recurrence_formula="2*a_n + 1",
            student_answer="2, 5, 12, 23",
            correct_answer="2, 5, 11, 23",
        )
        result = attribution.analyze(record)
        assert result.processing_status == STABLE_MESSAGES.STATUS_SUCCESS
        assert "计算错误" in result.error_category
        assert "第[3]项" in result.attribution_result

    def test_analyze_already_marked_for_review(self, attribution):
        """测试已标记待复核的记录跳过分析"""
        record = QuestionRecord(
            question_id="Q001",
            original_terms=[2.0, 5.0, 11.0],
            needs_review=True,
            review_reason="人工标记",
        )
        result = attribution.analyze(record)
        assert result.needs_review is True
        assert result.review_reason == "人工标记"
        assert any("跳过自动归因" in log for log in result.processing_log)

    def test_analyze_no_numeric_answer(self, attribution):
        """测试学生答案无可解析数值"""
        record = QuestionRecord(
            question_id="Q001",
            original_terms=[2.0, 5.0, 11.0],
            recurrence_formula="2*a_n + 1",
            student_answer="不会做",
        )
        result = attribution.analyze(record)
        assert result.processing_status == STABLE_MESSAGES.STATUS_SUCCESS
        assert "无可解析数值" in result.attribution_result

    def test_error_categories_defined(self, attribution):
        """测试错误分类已定义"""
        expected_categories = [
            "formula_misapplication",
            "calculation_error",
            "initial_term_error",
            "index_error",
            "division_by_zero",
            "negative_term",
            "logic_error",
            "unknown",
        ]
        for cat in expected_categories:
            assert cat in attribution.ERROR_CATEGORIES

    def test_analyze_batch(self, attribution):
        """测试批量分析"""
        records = [
            QuestionRecord(
                question_id=f"Q{i:03d}",
                original_terms=[2.0, 5.0, 11.0],
                recurrence_formula="2*a_n + 1",
                student_answer="2, 5, 11, 23",
                correct_answer="2, 5, 11, 23",
            )
            for i in range(3)
        ]
        results = attribution.analyze_batch(records)
        assert len(results) == 3
        for r in results:
            assert r.processing_status == STABLE_MESSAGES.STATUS_SUCCESS
