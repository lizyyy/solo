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
        return abs(value) < self.zero_tol

    def _parse_single_number(self, token: str) -> Optional[float]:
        if not token:
            return None
        token = token.strip()
        if not token:
            return None
        m = re.fullmatch(r'(-?\d+)\s*/\s*(-?\d+)', token)
        if m:
            try:
                n = float(m.group(1))
                d = float(m.group(2))
                if abs(d) < 1e-20:
                    return None
                return n / d
            except (ValueError, ZeroDivisionError):
                return None
        try:
            return float(token)
        except (ValueError, TypeError):
            return None

    def _extract_rhs(self, formula: str) -> str:
        if not formula:
            return ""
        s = formula.strip()
        m = re.search(r'=(.*)', s, re.DOTALL)
        if m:
            return m.group(1).strip()
        return s

    def _normalize_to_prev(self, expr: str) -> str:
        if not expr:
            return ""
        s = expr
        s = re.sub(r'a\s*\(\s*n\s*(?:\+\s*\d+)?\s*\)', 'PREV', s)
        s = re.sub(r'a\s*_\s*\{\s*n\s*(?:\+\s*\d+)?\s*\}', 'PREV', s)
        s = re.sub(r'a\s*_\s*n(?![A-Za-z0-9_{])', 'PREV', s)
        s = re.sub(r'\ban\b', 'PREV', s)
        return s

    def _normalize_prev_k(self, expr: str) -> str:
        """把 a_{n-1}, a(n-1), a_{n+1}, a(n+1), a_{n+2}, a_n, a(n) 等替换成 PREV0/PREV1/PREV2。
        PREV0 表示距离待求项最近的前一项（a_{n+1} 式中的 a_n），PREV1 表示再前一项，依此类推。
        相同 offset 的所有引用（如表达式中多次出现 a(n)）必须映射到同一个 PREV 索引。
        """
        if not expr:
            return ""
        s = expr
        matches: List[Tuple[int, int, int]] = []  # (start, end, offset)

        def record_match(match, content_start, content_end, offset):
            matches.append((match.start(), match.end(), offset))
            return f'__SLOT_{len(matches) - 1}__'

        pattern_paren = r'a\s*\(\s*(n\s*(?:[+-]\s*\d+)?)\s*\)'
        for m in list(re.finditer(pattern_paren, s))[::-1]:
            content = m.group(1)
            offset = 0
            m_off = re.search(r'([+-])\s*(\d+)', content)
            if m_off:
                offset = (1 if m_off.group(1) == '+' else -1) * int(m_off.group(2))
            slot_idx = len(matches)
            matches.append((m.start(), m.end(), offset))
            s = s[:m.start()] + f'__SLOT_{slot_idx}__' + s[m.end():]

        pattern_brace = r'a\s*_\s*\{\s*(n\s*(?:[+-]\s*\d+)?)\s*\}'
        for m in list(re.finditer(pattern_brace, s))[::-1]:
            content = m.group(1)
            offset = 0
            m_off = re.search(r'([+-])\s*(\d+)', content)
            if m_off:
                offset = (1 if m_off.group(1) == '+' else -1) * int(m_off.group(2))
            slot_idx = len(matches)
            matches.append((m.start(), m.end(), offset))
            s = s[:m.start()] + f'__SLOT_{slot_idx}__' + s[m.end():]

        pattern_plain = r'a\s*_\s*n(?![A-Za-z0-9_{])'
        for m in list(re.finditer(pattern_plain, s))[::-1]:
            slot_idx = len(matches)
            matches.append((m.start(), m.end(), 0))
            s = s[:m.start()] + f'__SLOT_{slot_idx}__' + s[m.end():]

        for m in list(re.finditer(r'\ban\b', s))[::-1]:
            slot_idx = len(matches)
            matches.append((m.start(), m.end(), 0))
            s = s[:m.start()] + f'__SLOT_{slot_idx}__' + s[m.end():]

        unique_offsets = sorted({off for _, _, off in matches}, reverse=True)
        offset_to_prev = {off: i for i, off in enumerate(unique_offsets)}
        for slot_idx, (_, _, off) in enumerate(matches):
            s = s.replace(f'__SLOT_{slot_idx}__', f'PREV{offset_to_prev[off]}')
        return s

    def _order_of_recurrence(self, expr_normalized: str) -> int:
        indices = set()
        for m in re.finditer(r'PREV(\d)', expr_normalized):
            indices.add(int(m.group(1)))
        if not indices:
            if 'PREV' in expr_normalized:
                return 1
            return 0
        return max(indices) + 1

    def _safe_eval_expr(self, expr: str, bindings: Dict[str, float]) -> Tuple[Optional[float], Optional[str]]:
        safe_dict = {
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
        if 'PREV' in expr and 'PREV' not in bindings and 'PREV0' not in bindings:
            if 'PREV0' in bindings:
                pass
            elif 'x' in bindings:
                bindings['PREV'] = bindings['x']
            elif len(bindings) == 1:
                bindings['PREV'] = next(iter(bindings.values()))
        if 'x' not in bindings and 'PREV' in bindings:
            bindings['x'] = bindings['PREV']
        if 'a' not in bindings and 'PREV' in bindings:
            bindings['a'] = bindings['PREV']
        safe_dict.update(bindings)
        try:
            val = float(eval(expr, {"__builtins__": {}}, safe_dict))
            return val, None
        except ZeroDivisionError:
            return None, STABLE_MESSAGES.REVIEW_REASON_DIVISION_BY_ZERO
        except Exception as e:
            return None, f"{STABLE_MESSAGES.REVIEW_REASON_FORMULA_EVAL}: {e}"

    def _evaluate_formula(self, rhs_expr: str, term_value: float) -> Tuple[float, Optional[str]]:
        """对一阶递推：给定当前项 a_n，计算下一项 a_{n+1}。rhs_expr 是拆出等号后、尚未统一变量的右侧表达式。
        兼容传入完整等式（如 a(n+1)=...），内部会自行拆出右侧。
        """
        if not rhs_expr:
            return float('nan'), None
        rhs = rhs_expr.strip()
        rhs = self._extract_rhs(rhs)
        if not rhs:
            return float('nan'), None
        normalized = self._normalize_to_prev(rhs)
        if 'PREV' not in normalized and 'x' not in normalized and 'PREV0' not in normalized:
            return float('nan'), None
        bindings = {'PREV': term_value}
        val, err = self._safe_eval_expr(normalized, bindings)
        if err:
            if STABLE_MESSAGES.REVIEW_REASON_DIVISION_BY_ZERO in err:
                return float('nan'), err
            return float('nan'), None
        if val is None:
            return float('nan'), None
        return val, None

    def _evaluate_multi_order(self, rhs_expr: str, prev_terms: List[float], n_index: int) -> Tuple[float, Optional[str]]:
        if not rhs_expr:
            return float('nan'), STABLE_MESSAGES.REVIEW_REASON_FORMULA_PARSE
        rhs = rhs_expr.strip()
        normalized = self._normalize_prev_k(rhs)
        order = self._order_of_recurrence(normalized)
        if order == 0:
            return float('nan'), STABLE_MESSAGES.REVIEW_REASON_FORMULA_PARSE
        if len(prev_terms) < order:
            return float('nan'), STABLE_MESSAGES.REVIEW_REASON_SMALL_SAMPLE
        bindings = {'n': float(n_index)}
        for k in range(order):
            bindings[f'PREV{k}'] = prev_terms[-(k + 1)]
        if 'PREV' in normalized and 'PREV0' not in normalized:
            bindings['PREV'] = prev_terms[-1]
        val, err = self._safe_eval_expr(normalized, bindings)
        if err:
            if STABLE_MESSAGES.REVIEW_REASON_DIVISION_BY_ZERO in err:
                return float('nan'), err
            return float('nan'), err
        if val is None:
            return float('nan'), STABLE_MESSAGES.REVIEW_REASON_FORMULA_EVAL
        return val, None

    def _detect_denominator_expr(self, rhs_expr: str) -> Optional[str]:
        if not rhs_expr:
            return None
        depth = 0
        slash = -1
        for i, ch in enumerate(rhs_expr):
            if ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
            elif ch == '/' and depth == 0:
                slash = i
                break
        if slash < 0:
            return None
        denom = rhs_expr[slash + 1:].strip()
        if denom.startswith('('):
            d2 = 0
            end = -1
            for i, ch in enumerate(denom):
                if ch == '(':
                    d2 += 1
                elif ch == ')':
                    d2 -= 1
                    if d2 == 0:
                        end = i
                        break
            if end > 0:
                return denom[1:end].strip()
        return denom

    def _calculate_sequence(self, given_terms: List[float], formula_rhs: str, n_terms: int = 5, with_status: bool = False):
        """返回计算数列项。
        默认返回 (计算项列表, 警告列表) 以保持测试兼容。
        当 with_status=True 时额外返回计算是否有效标志。
        """
        calculated: List[float] = []
        warnings: List[str] = []
        valid_compute = True
        if not given_terms:
            if with_status:
                return calculated, warnings, True
            return calculated, warnings
        if not formula_rhs:
            if with_status:
                return list(given_terms), [], True
            return list(given_terms), []

        calculated.extend(given_terms)
        rhs = formula_rhs.strip()
        rhs = self._extract_rhs(rhs)
        normalized_multi = self._normalize_prev_k(rhs)
        order = self._order_of_recurrence(normalized_multi)
        if order == 0:
            normalized_single = self._normalize_to_prev(rhs)
            if 'PREV' not in normalized_single and 'x' not in normalized_single:
                if with_status:
                    return list(given_terms), [STABLE_MESSAGES.REVIEW_REASON_FORMULA_PARSE], False
                return list(given_terms), [STABLE_MESSAGES.REVIEW_REASON_FORMULA_PARSE]
            order = 1

        for i in range(len(given_terms), n_terms):
            if i < 0:
                warnings.append(STABLE_MESSAGES.REVIEW_REASON_NEGATIVE_INDEX)
                valid_compute = False
                break

            if order > 1 or (order == 1 and 'PREV0' in normalized_multi):
                if len(calculated) < order:
                    warnings.append(STABLE_MESSAGES.REVIEW_REASON_SMALL_SAMPLE)
                    valid_compute = False
                    break
                prev_window = calculated[-order:]
                n_index = float(i + 1)
                next_val, err = self._evaluate_multi_order(rhs, prev_window, n_index)
            else:
                current = calculated[-1]
                next_val, err = self._evaluate_formula(rhs, current)

            if err:
                if STABLE_MESSAGES.REVIEW_REASON_DIVISION_BY_ZERO in err:
                    warnings.append(f"{err}: 第{i+1}项({calculated[-1]})代入后分母为零")
                    calculated.append(float('nan'))
                    valid_compute = False
                    break
                warnings.append(err)
                calculated.append(float('nan'))
                valid_compute = False
                break
            if next_val is None or math.isnan(next_val) or math.isinf(next_val):
                warnings.append(f"第{i+1}项计算结果异常: {next_val}")
                if next_val is not None:
                    calculated.append(next_val)
                else:
                    calculated.append(float('nan'))
                valid_compute = False
                break
            calculated.append(next_val)

        if with_status:
            return calculated, warnings, valid_compute
        return calculated, warnings

    def _parse_numeric_answer(self, answer_str: str) -> List[float]:
        if not answer_str:
            return []
        raw = str(answer_str).strip()
        if not raw:
            return []

        out: List[float] = []

        eq_pattern = r'[=:：]\s*([^,;，；]+)'
        for m in re.finditer(eq_pattern, raw):
            val_str = m.group(1).strip()
            if not val_str:
                continue
            v = self._parse_single_number(val_str)
            if v is not None:
                out.append(v)
        if out:
            return out

        tokens = re.split(r'[,;，；\s]+', raw)
        for tok in tokens:
            if not tok:
                continue
            tok_clean = tok.strip()
            if re.search(r'[=:：]', tok_clean):
                sub_parts = re.split(r'[=:：]', tok_clean, maxsplit=1)
                if len(sub_parts) == 2:
                    v = self._parse_single_number(sub_parts[1].strip())
                    if v is not None:
                        out.append(v)
                    continue
            v = self._parse_single_number(tok_clean)
            if v is not None:
                out.append(v)
        return out

    def _check_index_error(self, student_terms: List[float], correct_terms: List[float]) -> Tuple[bool, str]:
        if len(student_terms) < 2 or len(correct_terms) < 2:
            return False, ""
        if len(student_terms) == len(correct_terms):
            exact_match = all(abs(s - c) < self.zero_tol * 100 for s, c in zip(student_terms, correct_terms))
            if exact_match:
                return False, ""
        min_len = min(len(student_terms), len(correct_terms))
        for shift in range(1, min_len):
            forward_count = 0
            ok = True
            for i in range(len(student_terms) - shift):
                if i + shift < len(correct_terms):
                    if abs(student_terms[i] - correct_terms[i + shift]) < self.zero_tol * 100:
                        forward_count += 1
                    else:
                        ok = False
                        break
            if ok and forward_count >= 2:
                return True, f"项数索引错误: 学生答案偏移了{shift}项"
            backward_count = 0
            ok = True
            for i in range(shift, len(student_terms)):
                if i - shift < len(correct_terms):
                    if abs(student_terms[i] - correct_terms[i - shift]) < self.zero_tol * 100:
                        backward_count += 1
                    else:
                        ok = False
                        break
            if ok and backward_count >= 2:
                return True, f"项数索引错误: 学生答案偏移了{shift}项"
        return False, ""

    def _check_calculation_error(self, student_terms: List[float], correct_terms: List[float]) -> Tuple[bool, str, List[int]]:
        error_positions: List[int] = []
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
        if len(student_terms) < 1 or len(correct_terms) < 1:
            return False, ""
        if abs(student_terms[0] - correct_terms[0]) > self.zero_tol * 100:
            return True, f"初始项错误: 首项应为{correct_terms[0]}，学生写为{student_terms[0]}"
        return False, ""

    def _check_formula_misapplication(self, student_terms: List[float], correct_rhs: str, given_terms: List[float]) -> Tuple[bool, str]:
        if len(student_terms) < 2 or not correct_rhs:
            return False, ""
        normalized = self._normalize_to_prev(correct_rhs)
        if 'PREV' not in normalized and 'x' not in normalized:
            return False, ""
        expected_next, err = self._evaluate_formula(correct_rhs, given_terms[-1] if given_terms else student_terms[0])
        if err or expected_next is None or math.isnan(expected_next):
            return False, ""
        if len(student_terms) > len(given_terms):
            student_next = student_terms[len(given_terms)]
            if abs(student_next - expected_next) > self.zero_tol * 100:
                return True, f"递推公式应用错误: 按公式计算应为{float(expected_next)}，学生得到{float(student_next)}"
        return False, ""

    def analyze(self, record: QuestionRecord) -> QuestionRecord:
        record.processing_status = STABLE_MESSAGES.STATUS_PROCESSING
        record.add_log("开始归因分析")

        if record.needs_review:
            record.add_log("记录已标记为待复核，跳过自动归因")
            return record

        if len(record.original_terms) < self.config.min_sample_size:
            record.mark_for_review(STABLE_MESSAGES.REVIEW_REASON_SMALL_SAMPLE)
            return record

        if any(t < 0 for t in record.original_terms if not math.isinf(t)):
            for i, t in enumerate(record.original_terms):
                if t < 0:
                    record.mark_for_review(f"{STABLE_MESSAGES.REVIEW_REASON_NEGATIVE_INDEX}: 第{i+1}项为负值{t}")
                    return record

        formula_rhs = ""
        formula_parsed_ok = True
        if record.recurrence_formula:
            rhs = self._extract_rhs(record.recurrence_formula)
            if not rhs:
                formula_parsed_ok = False
            else:
                test_norm = self._normalize_to_prev(rhs)
                test_norm_k = self._normalize_prev_k(rhs)
                if 'PREV' not in test_norm and 'PREV0' not in test_norm_k and not re.search(r'\d', rhs):
                    formula_parsed_ok = False
                else:
                    formula_rhs = rhs
            if not formula_parsed_ok:
                record.mark_for_review(STABLE_MESSAGES.REVIEW_REASON_FORMULA_PARSE)
                return record

            denom_expr = self._detect_denominator_expr(formula_rhs)
            if denom_expr:
                norm_denom = self._normalize_to_prev(denom_expr)
                for i, term in enumerate(record.original_terms):
                    if 'PREV' in norm_denom:
                        val, err = self._safe_eval_expr(norm_denom, {'PREV': term})
                        if err:
                            record.mark_for_review(
                                f"{STABLE_MESSAGES.REVIEW_REASON_DIVISION_BY_ZERO}: 第{i+1}项({term})代入后分母为零"
                            )
                            return record
                        if val is not None and self._is_zero(val):
                            record.mark_for_review(
                                f"{STABLE_MESSAGES.REVIEW_REASON_DIVISION_BY_ZERO}: 第{i+1}项({term})代入后分母为零"
                            )
                            return record

            n_terms = max(5, len(record.original_terms) + 3,
                          len(self._parse_numeric_answer(record.student_answer)) + 1,
                          len(self._parse_numeric_answer(record.correct_answer)) + 1)
            calculated_terms, warnings, compute_ok = self._calculate_sequence(
                record.original_terms, formula_rhs, n_terms=n_terms, with_status=True
            )
            record.calculated_terms = calculated_terms
            fatal_warnings = [w for w in warnings if STABLE_MESSAGES.REVIEW_REASON_DIVISION_BY_ZERO in w
                              or STABLE_MESSAGES.REVIEW_REASON_FORMULA_EVAL in w
                              or STABLE_MESSAGES.REVIEW_REASON_FORMULA_PARSE in w
                              or STABLE_MESSAGES.REVIEW_REASON_NEGATIVE_INDEX in w
                              or STABLE_MESSAGES.REVIEW_REASON_SMALL_SAMPLE in w]
            for warning in warnings:
                if warning in fatal_warnings:
                    record.mark_for_review(warning)
                    return record
                record.add_log(f"计算警告: {warning}")
            if not compute_ok:
                record.mark_for_review(STABLE_MESSAGES.REVIEW_REASON_FORMULA_EVAL)
                return record
            record.add_log(f"按公式计算得到数列项: {calculated_terms}")

        student_terms = self._parse_numeric_answer(record.student_answer)
        correct_terms = self._parse_numeric_answer(record.correct_answer)

        if not student_terms:
            record.mark_success("学生答案无可解析数值", "unknown")
            return record

        record.add_log(f"解析学生答案数值: {student_terms}")
        if correct_terms:
            record.add_log(f"解析正确答案数值: {correct_terms}")

        check_results: List[Tuple[str, str]] = []

        has_initial_error, initial_msg = self._check_initial_term_error(student_terms, record.original_terms)
        if has_initial_error:
            check_results.append(("initial_term_error", initial_msg))

        if formula_rhs:
            has_formula_error, formula_msg = self._check_formula_misapplication(
                student_terms, formula_rhs, record.original_terms
            )
            if has_formula_error:
                check_results.append(("formula_misapplication", formula_msg))

        if correct_terms:
            has_index_error, index_msg = self._check_index_error(student_terms, correct_terms)
            if has_index_error:
                check_results.append(("index_error", index_msg))

            has_calc_error, calc_msg, _ = self._check_calculation_error(student_terms, correct_terms)
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
        for i, record in enumerate(records):
            record.add_log(f"开始处理第{i+1}/{len(records)}条记录")
            self.analyze(record)
        return records
