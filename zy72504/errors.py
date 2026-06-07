class ResumeMatchingError(Exception):
    """招聘简历匹配解释系统基础异常类"""
    user_message: str

    def __init__(self, user_message: str, detail: str = None):
        self.user_message = user_message
        self.detail = detail
        super().__init__(user_message)


class PromptVersionExistsError(ResumeMatchingError):
    def __init__(self, version_number: str):
        super().__init__(
            user_message=f"提示词版本 '{version_number}' 已经存在，请勿重复导入。",
            detail=f"Prompt version {version_number} already exists"
        )


class PromptVersionNotFoundError(ResumeMatchingError):
    def __init__(self, version_number: str = None, version_id: int = None):
        identifier = version_number or f"ID={version_id}"
        super().__init__(
            user_message=f"找不到提示词版本 '{identifier}'，请检查版本号是否正确。",
            detail=f"Prompt version {identifier} not found"
        )


class MatchExplanationNotFoundError(ResumeMatchingError):
    def __init__(self, explanation_id: int):
        super().__init__(
            user_message=f"找不到匹配解释记录 ID={explanation_id}，请确认记录是否存在。",
            detail=f"Match explanation {explanation_id} not found"
        )


class KnowledgeRefNotFoundError(ResumeMatchingError):
    def __init__(self, ref_id: int):
        super().__init__(
            user_message=f"找不到知识库引用 ID={ref_id}，请检查链接是否正确。",
            detail=f"Knowledge base reference {ref_id} not found"
        )


class ManualOverrideExistsError(ResumeMatchingError):
    def __init__(self, explanation_id: int):
        super().__init__(
            user_message=f"该匹配解释 ID={explanation_id} 已有待复核的人工改判，请先处理现有改判。",
            detail=f"Manual override already exists for explanation {explanation_id}"
        )


class BatchOverrideConflictError(ResumeMatchingError):
    def __init__(self, explanation_id: int):
        super().__init__(
            user_message=f"匹配解释 ID={explanation_id} 已被人工改判，批跑后需安全审核同事复核，请勿直接标记为正常。",
            detail=f"Manual override exists, needs review after batch run"
        )


class InvalidStatusTransitionError(ResumeMatchingError):
    def __init__(self, from_status: str, to_status: str):
        super().__init__(
            user_message=f"无法从 '{from_status}' 状态变更为 '{to_status}'，请按正确流程操作。",
            detail=f"Invalid status transition: {from_status} -> {to_status}"
        )


class EmptyImportError(ResumeMatchingError):
    def __init__(self):
        super().__init__(
            user_message="导入的数据为空，请检查文件内容后重新导入。",
            detail="Empty import data received"
        )


class MissingRequiredFieldError(ResumeMatchingError):
    def __init__(self, field_name: str, field_display: str):
        super().__init__(
            user_message=f"请填写'{field_display}'，这是必填项。",
            detail=f"Missing required field: {field_name}"
        )


def get_user_friendly_error(exc: Exception) -> str:
    if isinstance(exc, ResumeMatchingError):
        return exc.user_message
    return "系统遇到了一个意外问题，请稍后重试或联系技术支持。"
