import re
import math
from typing import List, Tuple, Optional, Dict
import numpy as np

from .config import DEFAULT_CONFIG, STABLE_MESSAGES, AttributionConfig
from .models import QuestionRecord


class SequenceAttribution:
    """数列递推错题归因分析核心算法"""

    ERROR_CATEGORIES = {
        "formula_misapplication": "递推公式应用错误",
        "calculation_error": "计算错误",
        "initial_term_error": "初始项代入错误",
        "index_error": "项数索引错误",
        "division_by_zero": "除零边界错误",
        "negative_term": "负项数错误",
        "logic_error": "递推逻辑理解错误",
        "unknown": "未知错误类型",
    }

    def __init__(self, config: AttributionConfig = DEFAULT_CONFIG):
        self.config = config
        self.zero_tol = config.zero_tolerance

    def _is_zero(self, value: float) -> bool:
        """判断是否为零（考虑容差）"""
        return abs(value) < self.zero_tol

    def _evaluate_formula(self, formula: str, term_value: float) -> Tuple[float, Optional[str]]:
        """
        安全计算递推公式，检测除零边界
        返回: (计算结果, 除零警告)
        """
        if not formula:
            return float('nan'), None

        formula = formula.strip()
        a_n = term_value

        if '/' in formula:
            numerator_part, denominator_part = formula.split('/', 1)
            denominator_part = denominator_part.strip()

            if denominator_part.startswith('(') and denominator_part.endswith(')'):
                denominator_part = denominator_part[1:-1].strip()

            try:
                denominator_value = self._safe_eval(denominator_part, a_n)
                if self._is_zero(denominator_value):
                    return float('nan'), STABLE_MESSAGES.REVIEW_REASON_DIVISION_BY_ZERO
            except Exception:
                pass

        try:
            result = self._safe_eval(formula, a_n)
            return result, None
        except ZeroDivisionError:
            return float('nan'), STABLE_MESSAGES.REVIEW_REASON_DIVISION_BY_ZERO
        except Exception as e:
            return float('nan'), f"公式计算错误: {str(e)}"

    def _safe_eval(self, expression: str, a_n: float) -> float:
        """安全计算数学表达式"""
        safe_dict = {
            'a_n': a_n,
            'x': a_n,
            'a': a_n,
            'n': a_n,
            'abs': abs,
            'sqrt': math.sqrt,
            'pow': pow,
            'sin': math.sin,
            'cos': math.cos,
            'tan': math.tan,
            'log': math.log,
            'exp': math.exp,
            'pi': math.pi,
            'e': math.e,
        }

        expr = expression.replace('a(n)', 'a_n')
        expr = expr.replace('a_{n}', 'a_n')
        expr = expr.replace('an', 'a_n')

        return float(eval(expr, {"__builtins__": {}}, safe_dict))

    def _calculate_sequence(self, given_terms: List[float], formula: str, n_terms: int = 5) -> Tuple[List[float], List[str]]:
        """
        根据递推公式计算数列项
        返回: (计算得到的数列项, 警告列表)
        """
        calculated = []
        warnings = []

        if not given_terms:
            return calculated, warnings

        calculated.extend(given_terms)

        current = given_terms[-1]
        for i in range(len(given_terms), n_terms):
            if i <= 0:
                warnings.append(STABLE_MESSAGES.REVIEW_REASON_NEGATIVE_INDEX)
                break

            next_val, div_zero_warning = self._evaluate_formula(formula, current)

            if div_zero_warning:
                warnings.append(div_zero_warning)
                calculated.append(float('nan'))
                break

            if math.isnan(next_val) or math.isinf(next_val):
                warnings.append(f"第{i+1}项计算结果异常: {next_val}")
                calculated.append(next_val)
                break

            calculated.append(next_val)
            current = next_val

        return calculated, warnings

    def _parse_numeric_answer(self, answer_str: str) -> List[float]:
        """解析答案中的数值"""
        if not answer_str:
            return []

        numbers = re.findall(r'-?\d+\.?\d*', answer_str)
        result = []
        for n in numbers:
            try:
                result.append(float(n))
            except (ValueError, TypeError):
                continue
        return result

    def _check_index_error(self, student_terms: List[float], correct_terms: List[float]) -> Tuple[bool, str]:
        """检查是否存在索引错误（项数错位）"""
        if len(student_terms) < 2 or len(correct_terms) < 2:
            return False, ""

        if len(student_terms) == len(correct_terms):
            exact_match = all(
                abs(s - c) < self.zero_tol * 100
                for s, c in zip(student_terms, correct_terms)
            )
            if exact_match:
                return False, ""

        min_len = min(len(student_terms), len(correct_terms))
        for shift in range(1, min_len):
            forward_match = True
            forward_count = 0
            for i in range(len(student_terms) - shift):
                if i + shift < len(correct_terms):
                    if abs(student_terms[i] - correct_terms[i + shift]) < self.zero_tol * 100:
                        forward_count += 1
                    else:
                        forward_match = False
                        break
            if forward_match and forward_count >= 2:
                return True, f"项数索引错误: 学生答案偏移了{shift}项"

            backward_match = True
            backward_count = 0
            for i in range(shift, len(student_terms)):
                if i - shift < len(correct_terms):
                    if abs(student_terms[i] - correct_terms[i - shift]) < self.zero_tol * 100:
                        backward_count += 1
                    else:
                        backward_match = False
                        break
            if backward_match and backward_count >= 2:
                return True, f"项数索引错误: 学生答案偏移了{shift}项"

        return False, ""

    def _check_calculation_error(self, student_terms: List[float], correct_terms: List[float]) -> Tuple[bool, str, List[int]]:
        """检查计算错误，返回错误位置"""
        error_positions = []
        max_len = min(len(student_terms), len(correct_terms))

        for i in range(max_len):
            s_val = student_terms[i]
            c_val = correct_terms[i]

            if math.isnan(s_val) or math.isnan(c_val):
                continue

            if abs(s_val - c_val) > self.zero_tol * 100:
                error_positions.append(i)

        if error_positions:
            return True, f"计算错误: 第{[p+1 for p in error_positions]}项计算有误", error_positions

        return False, "", []

    def _check_initial_term_error(self, student_terms: List[float], correct_terms: List[float]) -> Tuple[bool, str]:
        """检查初始项代入错误"""
        if len(student_terms) < 1 or len(correct_terms) < 1:
            return False, ""

        if abs(student_terms[0] - correct_terms[0]) > self.zero_tol * 100:
            return True, f"初始项错误: 首项应为{correct_terms[0]}，学生写为{student_terms[0]}"

        return False, ""

    def _check_formula_misapplication(self, student_terms: List[float], correct_formula: str, given_terms: List[float]) -> Tuple[bool, str]:
        """检查递推公式应用错误"""
        if len(student_terms) < 2 or not correct_formula:
            return False, ""

        expected_next, _ = self._evaluate_formula(correct_formula, given_terms[-1] if given_terms else student_terms[0])

        if math.isnan(expected_next):
            return False, ""

        if len(student_terms) > len(given_terms):
            student_next = student_terms[len(given_terms)]
            if abs(student_next - expected_next) > self.zero_tol * 100:
                return True, f"递推公式应用错误: 按公式计算应为{expected_next}，学生得到{student_next}"

        return False, ""

    def analyze(self, record: QuestionRecord) -> QuestionRecord:
        """对单条记录进行归因分析"""
        record.processing_status = STABLE_MESSAGES.STATUS_PROCESSING
        record.add_log("开始归因分析")

        if record.needs_review:
            record.add_log("记录已标记为待复核，跳过自动归因")
            return record

        if len(record.original_terms) < self.config.min_sample_size:
            record.mark_for_review(STABLE_MESSAGES.REVIEW_REASON_SMALL_SAMPLE)
            return record

        if any(t < 0 for t in record.original_terms if t > float('-inf')):
            for i, t in enumerate(record.original_terms):
                if t < 0:
                    record.mark_for_review(
                        f"{STABLE_MESSAGES.REVIEW_REASON_NEGATIVE_INDEX}: 第{i+1}项为负值{t}"
                    )
                    return record

        if record.recurrence_formula:
            for i, term in enumerate(record.original_terms):
                _, div_zero_warning = self._evaluate_formula(record.recurrence_formula, term)
                if div_zero_warning and STABLE_MESSAGES.REVIEW_REASON_DIVISION_BY_ZERO in div_zero_warning:
                    record.mark_for_review(
                        f"{div_zero_warning}: 第{i+1}项({term})代入后分母为零"
                    )
                    return record
            calculated_terms, warnings = self._calculate_sequence(
                record.original_terms,
                record.recurrence_formula,
                n_terms=max(5, len(record.original_terms) + 3)
            )
            record.calculated_terms = calculated_terms

            for warning in warnings:
                if STABLE_MESSAGES.REVIEW_REASON_DIVISION_BY_ZERO in warning:
                    record.mark_for_review(warning)
                    return record
                record.add_log(f"计算警告: {warning}")

            record.add_log(f"按公式计算得到数列项: {calculated_terms}")

        student_terms = self._parse_numeric_answer(record.student_answer)
        correct_terms = self._parse_numeric_answer(record.correct_answer)

        if not student_terms:
            record.mark_success("学生答案无可解析数值", "unknown")
            return record

        record.add_log(f"解析学生答案数值: {student_terms}")
        if correct_terms:
            record.add_log(f"解析正确答案数值: {correct_terms}")

        check_results = []

        has_initial_error, initial_msg = self._check_initial_term_error(student_terms, record.original_terms)
        if has_initial_error:
            check_results.append(("initial_term_error", initial_msg))

        if record.recurrence_formula:
            has_formula_error, formula_msg = self._check_formula_misapplication(
                student_terms, record.recurrence_formula, record.original_terms
            )
            if has_formula_error:
                check_results.append(("formula_misapplication", formula_msg))

        has_index_error, index_msg = self._check_index_error(student_terms, correct_terms)
        if has_index_error:
            check_results.append(("index_error", index_msg))

        has_calc_error, calc_msg, error_positions = self._check_calculation_error(student_terms, correct_terms)
        if has_calc_error:
            check_results.append(("calculation_error", calc_msg))

        if check_results:
            primary_category, primary_message = check_results[0]
            all_messages = "; ".join([msg for _, msg in check_results])
            category_name = self.ERROR_CATEGORIES.get(primary_category, primary_category)
            record.mark_success(all_messages, category_name)
            record.add_log(f"检测到{len(check_results)}类错误: {all_messages}")
        else:
            if correct_terms and len(student_terms) == len(correct_terms):
                all_match = all(abs(s - c) < self.zero_tol * 100 for s, c in zip(student_terms, correct_terms))
                if all_match:
                    record.mark_success("答案正确，无错误", "correct")
                else:
                    record.mark_success("错误类型无法自动判定，需人工检查", "unknown")
            else:
                record.mark_success("错误类型无法自动判定，需人工检查", "unknown")

        return record

    def analyze_batch(self, records: List[QuestionRecord]) -> List[QuestionRecord]:
        """批量分析"""
        for i, record in enumerate(records):
            record.add_log(f"开始处理第{i+1}/{len(records)}条记录")
            self.analyze(record)
        return records
