from dataclasses import dataclass
from datetime import date
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum
from .models import Essay, Feedback, Mistake
from config.loader import DictionaryConfig


class ValidationLevel(Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


@dataclass
class ValidationIssue:
    level: ValidationLevel
    field: str
    message: str
    suggestion: str
    item_id: Optional[str] = None
    student_name: Optional[str] = None
    source_file: Optional[str] = None


@dataclass
class ValidationResult:
    valid: bool
    issues: List[ValidationIssue]
    items_count: int
    valid_count: int
    error_count: int
    warning_count: int

    @property
    def has_errors(self) -> bool:
        return any(i.level == ValidationLevel.ERROR for i in self.issues)

    @property
    def has_warnings(self) -> bool:
        return any(i.level == ValidationLevel.WARNING for i in self.issues)

    def get_errors(self) -> List[ValidationIssue]:
        return [i for i in self.issues if i.level == ValidationLevel.ERROR]

    def get_warnings(self) -> List[ValidationIssue]:
        return [i for i in self.issues if i.level == ValidationLevel.WARNING]


class Validator:
    DEFAULT_MIN_SCORE = 0
    DEFAULT_MAX_SCORE = 150
    VALID_SEVERITY_LEVELS = ['high', 'medium', 'low']

    def __init__(self, dictionary_config: Optional[DictionaryConfig] = None):
        self.dict_config = dictionary_config or DictionaryConfig()

    def validate_essays(self, essays: List[Essay]) -> ValidationResult:
        issues: List[ValidationIssue] = []
        valid_count = 0

        for essay in essays:
            essay_issues = self._validate_single_essay(essay)
            issues.extend(essay_issues)
            if not any(i.level == ValidationLevel.ERROR for i in essay_issues):
                valid_count += 1

        return ValidationResult(
            valid=all(i.level != ValidationLevel.ERROR for i in issues),
            issues=issues,
            items_count=len(essays),
            valid_count=valid_count,
            error_count=sum(1 for i in issues if i.level == ValidationLevel.ERROR),
            warning_count=sum(1 for i in issues if i.level == ValidationLevel.WARNING)
        )

    def _validate_single_essay(self, essay: Essay) -> List[ValidationIssue]:
        issues: List[ValidationIssue] = []

        if not essay.student_name or not essay.student_name.strip():
            issues.append(ValidationIssue(
                level=ValidationLevel.ERROR,
                field='student_name',
                message='学生姓名为空',
                suggestion='请检查 CSV 文件，确保每行都有学生姓名',
                item_id=essay.id,
                student_name=None,
                source_file=essay.source_file
            ))
        elif len(essay.student_name.strip()) < 2:
            issues.append(ValidationIssue(
                level=ValidationLevel.WARNING,
                field='student_name',
                message=f'学生姓名"{essay.student_name}"可能过短',
                suggestion='请确认学生姓名是否正确',
                item_id=essay.id,
                student_name=essay.student_name,
                source_file=essay.source_file
            ))

        if not essay.title or not essay.title.strip():
            issues.append(ValidationIssue(
                level=ValidationLevel.WARNING,
                field='title',
                message='作文标题为空',
                suggestion='建议填写作文标题以便后续分析',
                item_id=essay.id,
                student_name=essay.student_name,
                source_file=essay.source_file
            ))

        if not essay.essay_type or essay.essay_type == '未知':
            issues.append(ValidationIssue(
                level=ValidationLevel.WARNING,
                field='essay_type',
                message='作文类型未识别或为空',
                suggestion=f'建议填写作文类型。常见类型：{self.dict_config.essay_types}',
                item_id=essay.id,
                student_name=essay.student_name,
                source_file=essay.source_file
            ))
        elif self.dict_config.essay_types and essay.essay_type not in self.dict_config.essay_types:
            issues.append(ValidationIssue(
                level=ValidationLevel.INFO,
                field='essay_type',
                message=f'作文类型"{essay.essay_type}"不在已知类型列表中',
                suggestion=f'已知类型：{self.dict_config.essay_types}',
                item_id=essay.id,
                student_name=essay.student_name,
                source_file=essay.source_file
            ))

        if essay.score < 0:
            issues.append(ValidationIssue(
                level=ValidationLevel.ERROR,
                field='score',
                message=f'分数 {essay.score} 不能为负数',
                suggestion='请检查分数值，确保为非负数',
                item_id=essay.id,
                student_name=essay.student_name,
                source_file=essay.source_file
            ))

        if essay.max_score <= 0:
            issues.append(ValidationIssue(
                level=ValidationLevel.ERROR,
                field='max_score',
                message=f'满分 {essay.max_score} 必须大于 0',
                suggestion='请检查满分值，确保为正数',
                item_id=essay.id,
                student_name=essay.student_name,
                source_file=essay.source_file
            ))

        if essay.score > essay.max_score:
            issues.append(ValidationIssue(
                level=ValidationLevel.ERROR,
                field='score',
                message=f'得分 {essay.score} 不能超过满分 {essay.max_score}',
                suggestion='请检查分数值，确保得分不超过满分',
                item_id=essay.id,
                student_name=essay.student_name,
                source_file=essay.source_file
            ))

        if essay.date and essay.date > date.today():
            issues.append(ValidationIssue(
                level=ValidationLevel.WARNING,
                field='date',
                message=f'日期 {essay.date} 在未来',
                suggestion='请检查日期是否正确',
                item_id=essay.id,
                student_name=essay.student_name,
                source_file=essay.source_file
            ))

        return issues

    def validate_feedback(self, feedback_list: List[Feedback]) -> ValidationResult:
        issues: List[ValidationIssue] = []
        valid_count = 0

        for feedback in feedback_list:
            feedback_issues = self._validate_single_feedback(feedback)
            issues.extend(feedback_issues)
            if not any(i.level == ValidationLevel.ERROR for i in feedback_issues):
                valid_count += 1

        return ValidationResult(
            valid=all(i.level != ValidationLevel.ERROR for i in issues),
            issues=issues,
            items_count=len(feedback_list),
            valid_count=valid_count,
            error_count=sum(1 for i in issues if i.level == ValidationLevel.ERROR),
            warning_count=sum(1 for i in issues if i.level == ValidationLevel.WARNING)
        )

    def _validate_single_feedback(self, feedback: Feedback) -> List[ValidationIssue]:
        issues: List[ValidationIssue] = []

        if not feedback.student_name or not feedback.student_name.strip():
            issues.append(ValidationIssue(
                level=ValidationLevel.ERROR,
                field='student_name',
                message='学生姓名为空',
                suggestion='请检查 Markdown 文件，确保每个反馈块都有学生姓名',
                item_id=feedback.id,
                student_name=None,
                source_file=feedback.source_file
            ))

        has_content = (
            bool(feedback.teacher_comment and feedback.teacher_comment.strip()) or
            bool(feedback.student_revision and feedback.student_revision.strip()) or
            bool(feedback.cause_description and feedback.cause_description.strip())
        )

        if not has_content:
            issues.append(ValidationIssue(
                level=ValidationLevel.WARNING,
                field='content',
                message='反馈内容为空',
                suggestion='建议至少提供老师批注、学生订正或错因描述中的一项',
                item_id=feedback.id,
                student_name=feedback.student_name,
                source_file=feedback.source_file
            ))

        if feedback.score is not None and feedback.score < 0:
            issues.append(ValidationIssue(
                level=ValidationLevel.ERROR,
                field='score',
                message=f'分数 {feedback.score} 不能为负数',
                suggestion='请检查分数值',
                item_id=feedback.id,
                student_name=feedback.student_name,
                source_file=feedback.source_file
            ))

        if feedback.date and feedback.date > date.today():
            issues.append(ValidationIssue(
                level=ValidationLevel.WARNING,
                field='date',
                message=f'日期 {feedback.date} 在未来',
                suggestion='请检查日期是否正确',
                item_id=feedback.id,
                student_name=feedback.student_name,
                source_file=feedback.source_file
            ))

        return issues

    def validate_mistakes(self, mistakes: List[Mistake]) -> ValidationResult:
        issues: List[ValidationIssue] = []
        valid_count = 0

        for mistake in mistakes:
            mistake_issues = self._validate_single_mistake(mistake)
            issues.extend(mistake_issues)
            if not any(i.level == ValidationLevel.ERROR for i in mistake_issues):
                valid_count += 1

        return ValidationResult(
            valid=all(i.level != ValidationLevel.ERROR for i in issues),
            issues=issues,
            items_count=len(mistakes),
            valid_count=valid_count,
            error_count=sum(1 for i in issues if i.level == ValidationLevel.ERROR),
            warning_count=sum(1 for i in issues if i.level == ValidationLevel.WARNING)
        )

    def _validate_single_mistake(self, mistake: Mistake) -> List[ValidationIssue]:
        issues: List[ValidationIssue] = []

        if not mistake.student_name or not mistake.student_name.strip():
            issues.append(ValidationIssue(
                level=ValidationLevel.ERROR,
                field='student_name',
                message='学生姓名为空',
                suggestion='请检查 JSON 文件，确保每个错误项都有学生姓名',
                item_id=mistake.id,
                student_name=None,
                source_file=mistake.source_file
            ))

        if not mistake.description or not mistake.description.strip():
            issues.append(ValidationIssue(
                level=ValidationLevel.WARNING,
                field='description',
                message='错误描述为空',
                suggestion='建议填写具体的错误描述',
                item_id=mistake.id,
                student_name=mistake.student_name,
                source_file=mistake.source_file
            ))

        if mistake.severity and mistake.severity not in self.VALID_SEVERITY_LEVELS:
            issues.append(ValidationIssue(
                level=ValidationLevel.INFO,
                field='severity',
                message=f'严重程度"{mistake.severity}"不是标准值',
                suggestion=f'建议使用：{self.VALID_SEVERITY_LEVELS}',
                item_id=mistake.id,
                student_name=mistake.student_name,
                source_file=mistake.source_file
            ))

        if mistake.date and mistake.date > date.today():
            issues.append(ValidationIssue(
                level=ValidationLevel.WARNING,
                field='date',
                message=f'日期 {mistake.date} 在未来',
                suggestion='请检查日期是否正确',
                item_id=mistake.id,
                student_name=mistake.student_name,
                source_file=mistake.source_file
            ))

        return issues

    def validate_all(
        self,
        essays: List[Essay],
        feedback_list: List[Feedback],
        mistakes: List[Mistake]
    ) -> Tuple[ValidationResult, ValidationResult, ValidationResult]:
        return (
            self.validate_essays(essays),
            self.validate_feedback(feedback_list),
            self.validate_mistakes(mistakes)
        )

    def format_issues_for_display(self, issues: List[ValidationIssue]) -> str:
        if not issues:
            return "无问题"

        lines = []
        errors = [i for i in issues if i.level == ValidationLevel.ERROR]
        warnings = [i for i in issues if i.level == ValidationLevel.WARNING]
        infos = [i for i in issues if i.level == ValidationLevel.INFO]

        if errors:
            lines.append("【错误】")
            for issue in errors:
                lines.append(self._format_single_issue(issue))

        if warnings:
            lines.append("\n【警告】")
            for issue in warnings:
                lines.append(self._format_single_issue(issue))

        if infos:
            lines.append("\n【提示】")
            for issue in infos:
                lines.append(self._format_single_issue(issue))

        return '\n'.join(lines)

    def _format_single_issue(self, issue: ValidationIssue) -> str:
        parts = []
        if issue.student_name:
            parts.append(f"学生: {issue.student_name}")
        if issue.field:
            parts.append(f"字段: {issue.field}")
        parts.append(f"问题: {issue.message}")
        if issue.suggestion:
            parts.append(f"建议: {issue.suggestion}")
        if issue.item_id:
            parts.append(f"(ID: {issue.item_id})")
        return "  " + " | ".join(parts)
