from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import EvaluationRecord, DiagnosisResult, QuestionBank
from app.services.diagnosis_engine import (
    SequenceRecurrenceValidator,
    EquivalentAnswerMatcher,
    EmptySetHandler
)
from app.services.question_bank import QuestionBankService
from app.errors import (
    QuestionNotFoundError,
    InvalidStudentAnswerError,
    EmptySetError,
    EquivalentAnswerConflictError
)
from app.schemas import DiagnosisResultCreate


class DiagnosisService:
    def __init__(self, db: Session):
        self.db = db
        self.question_service = QuestionBankService(db)
        self.validator = SequenceRecurrenceValidator()
        self.empty_set_handler = EmptySetHandler()

    def diagnose_single_record(
        self,
        evaluation_record: EvaluationRecord,
        batch_id: int
    ) -> DiagnosisResultCreate:
        question = self.question_service.get_question_by_no(evaluation_record.question_no)
        if not question:
            raise QuestionNotFoundError(evaluation_record.question_no)

        student_answer = evaluation_record.student_answer
        if not student_answer or str(student_answer).strip() in ['', 'null', '无', '未填写']:
            raise InvalidStudentAnswerError(
                evaluation_record.student_name,
                evaluation_record.question_no,
                str(student_answer)
            )

        is_equivalent = False
        matched_equivalent_id = None
        error_type = None
        human_readable_error = None
        suggestion = None
        next_action = None
        contact_person = None

        is_correct, reason = self.validator.check_equivalence(
            student_answer,
            question.standard_answer
        )

        if not is_correct:
            equivalent_answers = self.question_service.get_equivalent_answers(question.id)
            matcher = EquivalentAnswerMatcher(equivalent_answers)
            is_equivalent, matched_id, match_reason = matcher.match(student_answer)
            if is_equivalent:
                matched_equivalent_id = matched_id
                is_correct = True
                reason = f"匹配到等价答案：{match_reason}"
            else:
                diagnosis_type = self._classify_error(student_answer, question.standard_answer)
                error_type = diagnosis_type
                human_readable_error = self._generate_human_error(
                    diagnosis_type,
                    evaluation_record.student_name,
                    evaluation_record.question_no,
                    student_answer,
                    question.standard_answer,
                    reason
                )
                suggestion, next_action, contact_person = self._generate_suggestion(
                    diagnosis_type
                )
        else:
            diagnosis_type = "correct"

        diagnosis_type = "correct" if is_correct else error_type or "incorrect"

        return DiagnosisResultCreate(
            batch_id=batch_id,
            question_bank_id=question.id,
            evaluation_record_id=evaluation_record.id,
            diagnosis_type=diagnosis_type,
            is_correct=is_correct,
            is_equivalent=is_equivalent,
            matched_equivalent_id=matched_equivalent_id,
            error_type=error_type,
            human_readable_error=human_readable_error,
            suggestion=suggestion,
            next_action=next_action,
            contact_person=contact_person
        )

    def diagnose_batch(
        self,
        evaluation_records: List[EvaluationRecord],
        batch_id: int
    ) -> Tuple[List[DiagnosisResultCreate], Dict[str, Any]]:
        results = []
        errors = []
        empty_issues = []

        empty_from_records = self.empty_set_handler.check_empty_records(
            evaluation_records,
            "讲评记录",
            "evaluation_record"
        )
        empty_issues.extend(empty_from_records)

        question_nos = set(r.question_no for r in evaluation_records if r.question_no)
        missing_questions = []
        for q_no in question_nos:
            q = self.question_service.get_question_by_no(q_no)
            if not q:
                missing_questions.append({
                    'question_no': q_no,
                    'source': '题库表',
                    'source_type': 'question_bank'
                })

        if missing_questions:
            empty_from_questions = [
                {
                    'index': idx,
                    'question_no': mq['question_no'],
                    'issues': ['题目不存在'],
                    'source': mq['source'],
                    'source_type': mq['source_type'],
                    'student_name': '系统检测'
                }
                for idx, mq in enumerate(missing_questions)
            ]
            empty_issues.extend(empty_from_questions)

        if empty_issues:
            report = self.empty_set_handler.generate_human_readable_report(empty_issues)
            for source_info in report['by_source']:
                raise EmptySetError(
                    source=source_info['source'],
                    source_type=source_info['source_type'],
                    count=source_info['count'],
                    description=source_info['details'][0] if source_info['details'] else source_info['description'],
                    next_action=source_info['next_action'],
                    contact_person=source_info['contact_person']
                )

        for record in evaluation_records:
            try:
                result = self.diagnose_single_record(record, batch_id)
                results.append(result)
            except Exception as e:
                errors.append({
                    'record_id': record.id,
                    'student_name': record.student_name,
                    'question_no': record.question_no,
                    'error': str(e)
                })

        summary = self._generate_summary(results, errors)
        return results, summary

    def _classify_error(self, student_answer: str, standard_answer: str) -> str:
        parsed_student = self.validator.parse_recurrence(student_answer)
        parsed_standard = self.validator.parse_recurrence(standard_answer)

        if not parsed_student or not parsed_standard:
            return "format_error"

        if parsed_student['type'] != parsed_standard['type']:
            return "type_mismatch"

        if parsed_student['type'] == 'arithmetic':
            if not self._is_close(parsed_student.get('common_difference'), parsed_standard.get('common_difference')):
                return "wrong_common_difference"

        if parsed_student['type'] == 'geometric':
            if not self._is_close(parsed_student.get('common_ratio'), parsed_standard.get('common_ratio')):
                return "wrong_common_ratio"

        if parsed_student['type'] == 'linear_nonhomogeneous':
            if not self._is_close(parsed_student.get('coefficient'), parsed_standard.get('coefficient')):
                return "wrong_coefficient"
            if not self._is_close(parsed_student.get('constant'), parsed_standard.get('constant')):
                return "wrong_constant"

        return "calculation_error"

    def _is_close(self, a: Optional[float], b: Optional[float]) -> bool:
        if a is None or b is None:
            return False
        import math
        return math.isclose(a, b, abs_tol=1e-9)

    def _generate_human_error(
        self,
        error_type: str,
        student_name: str,
        question_no: str,
        student_answer: str,
        standard_answer: str,
        tech_reason: str
    ) -> str:
        error_messages = {
            "format_error": f"学生「{student_name}」在题目「{question_no}」的答案「{student_answer}」格式有问题，我们读不懂。标准答案应该是「{standard_answer}」。",
            "type_mismatch": f"学生「{student_name}」在题目「{question_no}」写的是{self._get_type_name(self.validator.parse_recurrence(student_answer))}，但题目要的是{self._get_type_name(self.validator.parse_recurrence(standard_answer))}。",
            "wrong_common_difference": f"学生「{student_name}」在题目「{question_no}」的公差算错了。学生写的是「{student_answer}」，正确公差应该是「{standard_answer}」中的常数项。",
            "wrong_common_ratio": f"学生「{student_name}」在题目「{question_no}」的公比算错了。学生写的是「{student_answer}」，正确公比应该是「{standard_answer}」中的系数。",
            "wrong_coefficient": f"学生「{student_name}」在题目「{question_no}」的递推系数算错了。学生写的是「{student_answer}」，正确系数应该是「{standard_answer}」中的a_n前的数字。",
            "wrong_constant": f"学生「{student_name}」在题目「{question_no}」的常数项算错了。学生写的是「{student_answer}」，正确常数项应该是「{standard_answer}」末尾的数字。",
            "calculation_error": f"学生「{student_name}」在题目「{question_no}」的答案「{student_answer}」不对，正确答案是「{standard_answer}」。{tech_reason}"
        }
        return error_messages.get(error_type, f"学生「{student_name}」在题目「{question_no}」的答案「{student_answer}」有问题：{tech_reason}")

    def _get_type_name(self, parsed: Optional[Dict]) -> str:
        if not parsed:
            return "未知类型"
        type_names = {
            'arithmetic': '等差数列递推',
            'geometric': '等比数列递推',
            'linear_nonhomogeneous': '线性非齐次递推',
            'general_term': '通项公式',
            'general_recurrence': '一般递推式'
        }
        return type_names.get(parsed.get('type', 'unknown'), '未知类型')

    def _generate_suggestion(self, error_type: str) -> Tuple[str, str, str]:
        suggestions = {
            "format_error": (
                "建议提醒学生注意递推式的书写格式，要写成 a_{n+1} = ... 的形式",
                "请联系讲评老师提醒学生规范书写",
                "讲评老师"
            ),
            "type_mismatch": (
                "建议帮学生区分等差数列、等比数列和其他递推类型的特点",
                "请联系任课老师加强递推类型识别训练",
                "任课老师"
            ),
            "wrong_common_difference": (
                "建议让学生重新计算相邻两项的差，确认公差是否正确",
                "请联系讲评老师进行针对性辅导",
                "讲评老师"
            ),
            "wrong_common_ratio": (
                "建议让学生重新计算相邻两项的比，确认公比是否正确",
                "请联系讲评老师进行针对性辅导",
                "讲评老师"
            ),
            "wrong_coefficient": (
                "建议让学生检查递推式中a_n前面的系数是否正确",
                "请联系讲评老师进行针对性辅导",
                "讲评老师"
            ),
            "wrong_constant": (
                "建议让学生检查递推式中的常数项是否正确",
                "请联系讲评老师进行针对性辅导",
                "讲评老师"
            ),
            "calculation_error": (
                "建议让学生重新检查计算过程，注意运算符号和数值",
                "请联系讲评老师了解学生具体思路",
                "讲评老师"
            )
        }
        return suggestions.get(error_type, (
            "建议让学生对照标准答案检查自己的答案",
            "请联系讲评老师处理",
            "讲评老师"
        ))

    def _generate_summary(
        self,
        results: List[DiagnosisResultCreate],
        errors: List[Dict]
    ) -> Dict[str, Any]:
        total = len(results) + len(errors)
        correct = sum(1 for r in results if r.is_correct)
        equivalent = sum(1 for r in results if r.is_equivalent)
        incorrect = sum(1 for r in results if not r.is_correct)

        error_types = {}
        for r in results:
            if not r.is_correct and r.error_type:
                error_types[r.error_type] = error_types.get(r.error_type, 0) + 1

        return {
            "total_records": total,
            "successfully_diagnosed": len(results),
            "diagnostic_errors": len(errors),
            "correct_count": correct,
            "equivalent_count": equivalent,
            "incorrect_count": incorrect,
            "accuracy_rate": round(correct / total * 100, 2) if total > 0 else 0,
            "error_type_distribution": error_types,
            "errors": errors
        }
