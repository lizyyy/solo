from typing import Optional, Tuple, List, Dict, Any
import re
import math
from fractions import Fraction


class SequenceRecurrenceValidator:
    def __init__(self):
        self.patterns = {
            'arithmetic': r'^a\s*_\s*\{\s*n\s*\+\s*1\s*\}\s*=\s*a\s*_\s*\{\s*n\s*\}\s*([+\-])\s*([\d\.]+)$',
            'geometric': r'^a\s*_\s*\{\s*n\s*\+\s*1\s*\}\s*=\s*([\d\.]+)\s*\*\s*a\s*_\s*\{\s*n\s*\}$',
            'linear': r'^a\s*_\s*\{\s*n\s*\+\s*1\s*\}\s*=\s*([\d\.]+)\s*\*\s*a\s*_\s*\{\s*n\s*\}\s*([+\-])\s*([\d\.]+)$',
            'general_term': r'^a\s*_\s*\{\s*n\s*\}\s*=',
            'recurrence_general': r'^a\s*_\s*\{\s*n\s*\+\s*(\d+)\s*\}\s*='
        }

    def normalize_expression(self, expr: str) -> str:
        if not expr:
            return ""
        expr = expr.strip().replace(' ', '')
        expr = expr.replace('×', '*').replace('÷', '/')
        expr = re.sub(r'a\s*_\s*\{?\s*n\s*\+\s*1\s*\}?', 'a_{n+1}', expr)
        expr = re.sub(r'a\s*_\s*\{?\s*n\s*\}?', 'a_n', expr)
        return expr

    def parse_recurrence(self, expr: str) -> Optional[Dict[str, Any]]:
        normalized = self.normalize_expression(expr)
        if not normalized:
            return None

        match = re.match(self.patterns['arithmetic'], normalized)
        if match:
            op, d = match.groups()
            d = float(d) if op == '+' else -float(d)
            return {
                'type': 'arithmetic',
                'common_difference': d,
                'formula': f'a_{{n+1}} = a_n {op} {abs(d)}'
            }

        match = re.match(self.patterns['geometric'], normalized)
        if match:
            r = float(match.group(1))
            return {
                'type': 'geometric',
                'common_ratio': r,
                'formula': f'a_{{n+1}} = {r} * a_n'
            }

        match = re.match(self.patterns['linear'], normalized)
        if match:
            A, op, B = match.groups()
            B = float(B) if op == '+' else -float(B)
            return {
                'type': 'linear_nonhomogeneous',
                'coefficient': float(A),
                'constant': B,
                'formula': f'a_{{n+1}} = {A} * a_n {op} {abs(B)}'
            }

        if re.search(self.patterns['general_term'], normalized):
            return {
                'type': 'general_term',
                'formula': normalized
            }

        if re.search(self.patterns['recurrence_general'], normalized):
            return {
                'type': 'general_recurrence',
                'formula': normalized
            }

        return {
            'type': 'unknown',
            'formula': normalized
        }

    def check_equivalence(self, expr1: str, expr2: str) -> Tuple[bool, Optional[str]]:
        parsed1 = self.parse_recurrence(expr1)
        parsed2 = self.parse_recurrence(expr2)

        if not parsed1 or not parsed2:
            return False, "无法解析表达式"

        if parsed1['type'] != parsed2['type']:
            return False, f"递推类型不匹配：{parsed1['type']} vs {parsed2['type']}"

        if parsed1['type'] == 'arithmetic':
            if math.isclose(parsed1['common_difference'], parsed2['common_difference'], abs_tol=1e-9):
                return True, "公差相等"
            return False, f"公差不等：{parsed1['common_difference']} vs {parsed2['common_difference']}"

        if parsed1['type'] == 'geometric':
            if math.isclose(parsed1['common_ratio'], parsed2['common_ratio'], abs_tol=1e-9):
                return True, "公比相等"
            return False, f"公比不等：{parsed1['common_ratio']} vs {parsed2['common_ratio']}"

        if parsed1['type'] == 'linear_nonhomogeneous':
            if (math.isclose(parsed1['coefficient'], parsed2['coefficient'], abs_tol=1e-9) and
                math.isclose(parsed1['constant'], parsed2['constant'], abs_tol=1e-9)):
                return True, "系数和常数项都相等"
            return False, "系数或常数项不等"

        if parsed1['type'] == 'general_term' or parsed1['type'] == 'general_recurrence':
            norm1 = self.normalize_expression(expr1)
            norm2 = self.normalize_expression(expr2)
            if norm1 == norm2:
                return True, "表达式完全相同"
            return False, "表达式形式不同，需要人工验证"

        return False, "未知类型，无法判断等价性"


class EquivalentAnswerMatcher:
    def __init__(self, equivalent_answers: List[Any]):
        self.validator = SequenceRecurrenceValidator()
        self.equivalent_answers = equivalent_answers

    def match(self, student_answer: str) -> Tuple[bool, Optional[int], Optional[str]]:
        for eq in self.equivalent_answers:
            is_equiv, reason = self.validator.check_equivalence(
                student_answer,
                eq.answer_expression
            )
            if is_equiv:
                return True, eq.id, reason
        return False, None, None


class EmptySetHandler:
    def __init__(self):
        self.issues = []

    def check_empty_records(
        self,
        records: List[Any],
        source: str,
        source_type: str
    ) -> List[Dict[str, Any]]:
        empty_records = []
        for idx, record in enumerate(records):
            issues = self._check_single_record(record, source_type)
            if issues:
                empty_records.append({
                    'index': idx,
                    'record_id': getattr(record, 'id', None),
                    'student_name': getattr(record, 'student_name', '未知'),
                    'question_no': getattr(record, 'question_no', '未知'),
                    'issues': issues,
                    'source': source,
                    'source_type': source_type
                })
        return empty_records

    def _check_single_record(self, record: Any, source_type: str) -> List[str]:
        issues = []

        if source_type == 'evaluation_record':
            if not getattr(record, 'student_id', None):
                issues.append("学号为空")
            if not getattr(record, 'student_name', None):
                issues.append("学生姓名为空")
            if not getattr(record, 'question_no', None):
                issues.append("题目编号为空")
            if not getattr(record, 'student_answer', None):
                issues.append("学生答案为空")
            if str(getattr(record, 'student_answer', '')).strip() in ['', 'null', '无', '未填写']:
                issues.append("学生答案为无效值")

        elif source_type == 'question_bank':
            if not getattr(record, 'question_no', None):
                issues.append("题目编号为空")
            if not getattr(record, 'content', None):
                issues.append("题目内容为空")
            if not getattr(record, 'standard_answer', None):
                issues.append("标准答案为空")

        return issues

    def generate_human_readable_report(self, empty_records: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not empty_records:
            return {"has_empty": False}

        by_source = {}
        for record in empty_records:
            source_key = f"{record['source']}_{record['source_type']}"
            if source_key not in by_source:
                by_source[source_key] = []
            by_source[source_key].append(record)

        report = {
            "has_empty": True,
            "total_count": len(empty_records),
            "by_source": [],
            "next_steps": []
        }

        for source_key, records in by_source.items():
            source = records[0]['source']
            source_type = records[0]['source_type']
            contact = "讲评老师" if source_type == 'evaluation_record' else "题库管理员"
            next_action = "请联系讲评老师补充学生答案" if source_type == 'evaluation_record' else "请联系题库管理员补充题目信息"

            report["by_source"].append({
                "source": source,
                "source_type": source_type,
                "count": len(records),
                "description": f"在{source}中发现{len(records)}条空记录",
                "details": [
                    f"学生「{r['student_name']}」的题目「{r['question_no']}」：{', '.join(r['issues'])}"
                    for r in records
                ],
                "next_action": next_action,
                "contact_person": contact
            })

            report["next_steps"].append({
                "action": next_action,
                "contact": contact
            })

        return report
