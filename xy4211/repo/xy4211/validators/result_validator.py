from typing import List
from collections import defaultdict
from datetime import datetime

from .base_validator import BaseValidator, ValidationContext
from models import ValidationIssue, IssueType, IssueSeverity, ScreeningResult, Student


class ResultValidator(BaseValidator):
    def __init__(self):
        super().__init__()
    
    def validate(self, context: ValidationContext) -> List[ValidationIssue]:
        self.issues.clear()
        
        self._validate_missing_results(context)
        self._validate_duplicate_results(context)
        
        return self.issues
    
    def _validate_missing_results(self, context: ValidationContext) -> None:
        if not context.students:
            return
        
        student_ids_with_results = set()
        for result in context.screening_results:
            student_ids_with_results.add(result.student_id)
        
        for student in context.students:
            if student.student_id not in student_ids_with_results:
                student_name = student.name or "未知姓名"
                self._add_issue(
                    issue_type=IssueType.RESULT_MISSING,
                    severity=IssueSeverity.HIGH,
                    title=f"学生 {student_name} ({student.student_id}) 缺少筛查结果",
                    description=f"学生 {student_name} (ID: {student.student_id}) 在学生名单中，但未找到对应的筛查结果。请检查是否遗漏或数据导入不完整。",
                    student_id=student.student_id,
                    details={
                        "student_name": student_name,
                        "student_grade": student.grade,
                        "student_class": student.class_name
                    },
                    source_file=student.source_file
                )
    
    def _validate_duplicate_results(self, context: ValidationContext) -> None:
        student_results = defaultdict(list)
        for result in context.screening_results:
            student_results[result.student_id].append(result)
        
        for student_id, results in student_results.items():
            if len(results) > 1:
                student = context.get_student_by_id(student_id)
                student_name = student.name if student else "未知姓名"
                
                result_dates = []
                for r in results:
                    if r.screening_date:
                        result_dates.append(r.screening_date.strftime("%Y-%m-%d %H:%M"))
                    else:
                        result_dates.append("未知时间")
                
                self._add_issue(
                    issue_type=IssueType.RESULT_DUPLICATE,
                    severity=IssueSeverity.MEDIUM,
                    title=f"学生 {student_name} ({student_id}) 存在多条筛查记录",
                    description=f"学生 {student_name} (ID: {student_id}) 有 {len(results)} 条筛查记录。筛查时间分别为: {', '.join(result_dates)}。请确认是否为重复筛查或数据错误。",
                    student_id=student_id,
                    details={
                        "student_name": student_name,
                        "result_count": len(results),
                        "result_ids": [r.screening_id for r in results],
                        "result_dates": result_dates
                    },
                    source_file=results[0].source_file
                )


def validate_results(context: ValidationContext) -> List[ValidationIssue]:
    validator = ResultValidator()
    return validator.validate(context)
