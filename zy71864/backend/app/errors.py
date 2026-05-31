from typing import Optional, Dict, Any
from fastapi import HTTPException, status


class DiagnosisError(HTTPException):
    def __init__(
        self,
        error_code: str,
        message: str,
        suggestion: Optional[str] = None,
        contact_person: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        status_code: int = status.HTTP_400_BAD_REQUEST
    ):
        self.error_code = error_code
        self.suggestion = suggestion
        self.contact_person = contact_person
        self.details = details
        super().__init__(status_code=status_code, detail=message)


class EmptySetError(DiagnosisError):
    def __init__(
        self,
        source: str,
        source_type: str,
        count: int,
        description: str,
        next_action: str,
        contact_person: str
    ):
        super().__init__(
            error_code="EMPTY_SET_DETECTED",
            message=f"在{source}中发现{count}条空记录：{description}",
            suggestion=f"请先处理空记录后再继续诊断",
            contact_person=contact_person,
            details={
                "source": source,
                "source_type": source_type,
                "count": count,
                "next_action": next_action
            }
        )


class QuestionNotFoundError(DiagnosisError):
    def __init__(self, question_no: str):
        super().__init__(
            error_code="QUESTION_NOT_FOUND",
            message=f"题目编号「{question_no}」在题库中找不到",
            suggestion="请检查题库是否已导入该题目，或联系题库管理员补充",
            contact_person="题库管理员"
        )


class EquivalentAnswerConflictError(DiagnosisError):
    def __init__(self, question_no: str, answer: str):
        super().__init__(
            error_code="EQUIVALENT_ANSWER_CONFLICT",
            message=f"题目「{question_no}」的答案「{answer}」与已有等价答案冲突，但未被正确识别",
            suggestion="请检查等价答案配置，或添加新的等价答案规则",
            contact_person="教研组长"
        )


class DuplicateBatchError(DiagnosisError):
    def __init__(self, batch_name: str, existing_batch_id: int):
        super().__init__(
            error_code="DUPLICATE_BATCH",
            message=f"批次「{batch_name}」对应的材料已经诊断过，系统将返回历史记录而非创建新记录",
            suggestion="如需重新诊断，请创建新的批次名称或清空历史诊断记录",
            contact_person="系统管理员",
            details={"existing_batch_id": existing_batch_id},
            status_code=status.HTTP_200_OK
        )


class InvalidStudentAnswerError(DiagnosisError):
    def __init__(self, student_name: str, question_no: str, answer: str):
        super().__init__(
            error_code="INVALID_STUDENT_ANSWER",
            message=f"学生「{student_name}」在题目「{question_no}」的答案「{answer}」格式不正确",
            suggestion="请检查学生答案是否为有效的数学表达式，或联系讲评老师确认",
            contact_person="讲评老师"
        )


class VersionNotFoundError(DiagnosisError):
    def __init__(self, question_no: str, version: int):
        super().__init__(
            error_code="VERSION_NOT_FOUND",
            message=f"题目「{question_no}」的版本 {version} 不存在",
            suggestion="请检查题库版本历史，或使用最新版本进行诊断",
            contact_person="题库管理员"
        )


class FilterConditionMismatchError(DiagnosisError):
    def __init__(self):
        super().__init__(
            error_code="FILTER_CONDITION_MISMATCH",
            message="当前屏幕显示的筛选条件与导出时使用的条件不一致",
            suggestion="请先保存当前筛选条件，或使用已保存的条件进行导出",
            contact_person="系统管理员"
        )


ERROR_MESSAGES = {
    "INTEGRITY_ERROR": {
        "message": "数据完整性校验失败",
        "suggestion": "请检查输入数据是否正确，避免重复或缺失",
        "contact_person": "系统管理员"
    },
    "DATABASE_ERROR": {
        "message": "数据库操作失败",
        "suggestion": "请稍后重试，如问题持续请联系技术支持",
        "contact_person": "技术支持"
    },
    "UNKNOWN_ERROR": {
        "message": "系统遇到未知错误",
        "suggestion": "请截图并联系技术支持处理",
        "contact_person": "技术支持"
    }
}


def get_human_readable_error(
    error_code: str,
    **kwargs
) -> Dict[str, Any]:
    error_template = ERROR_MESSAGES.get(error_code, ERROR_MESSAGES["UNKNOWN_ERROR"])
    return {
        "error_code": error_code,
        "message": error_template["message"].format(**kwargs) if kwargs else error_template["message"],
        "suggestion": error_template["suggestion"],
        "contact_person": error_template["contact_person"]
    }
