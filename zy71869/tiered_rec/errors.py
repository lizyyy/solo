from __future__ import annotations

from tiered_rec.models import EquivalentAnswerIssue, EquivalentAnswerSource, ProcessingStatus

_ERROR_MAP: dict[str, str] = {
    "KeyError: question_id": "找不到对应的题目编号，请检查题目编号是否拼写正确。",
    "ValueError: score_exceeds_max": "某一步的得分超过了该步骤的满分，请核实评分是否正确。",
    "ValueError: missing_step_score": "缺少分步得分信息，请确认每一步的满分是否已填写。",
    "TypeError: invalid_tier": "难度层级填写有误，只能填「基础」「提高」「竞赛」三者之一。",
    "ValueError: duplicate_batch": "这批材料已经处理过了，不会重复生成推荐结果。如需重新处理，请先清除历史记录。",
    "ValueError: empty_answer": "答案内容为空，请补全后再提交。",
    "ValueError: step_mismatch": "评分步骤和题目设定的分步不一致，请核对步骤标签是否匹配。",
}

_FIELD_MAP: dict[str, str] = {
    "question_id": "题目编号",
    "student_answer": "学生答案",
    "awarded_score": "实际得分",
    "step_label": "步骤标签",
    "max_score": "步骤满分",
    "tier": "难度层级",
    "standard_answer": "标准答案",
    "equivalent_answers": "等价答案列表",
    "reviewer": "评卷人",
    "review_date": "评卷日期",
    "source_exam": "来源考试",
    "batch_id": "批次编号",
}


class FriendlyError(Exception):
    def __init__(self, internal: str, human: str) -> None:
        self.internal_message = internal
        self.human_message = human
        super().__init__(human)


def friendly_error(exc: Exception) -> str:
    exc_type = type(exc).__name__
    exc_msg = str(exc)
    canonical_key = f"{exc_type}: {exc_msg}"
    for pattern, human_msg in _ERROR_MAP.items():
        if pattern.lower() == canonical_key.lower():
            return human_msg

    for pattern, human_msg in _ERROR_MAP.items():
        if exc_msg.lower() in pattern.lower() or pattern.lower() in canonical_key.lower():
            return human_msg

    if isinstance(exc, KeyError):
        field_name = _FIELD_MAP.get(exc_msg.strip("'\""), exc_msg)
        return f"缺少必要字段「{field_name}」，请检查数据是否完整。"

    if isinstance(exc, ValueError):
        for field_en, field_cn in _FIELD_MAP.items():
            if field_en in exc_msg:
                return exc_msg.replace(field_en, field_cn)
        return f"数据内容有误：{exc_msg}"

    if isinstance(exc, TypeError):
        return f"数据类型不匹配：{exc_msg}。请检查填写的内容格式是否正确。"

    return f"处理时遇到问题：{exc_msg}。如果反复出现，请联系技术支持。"


def status_label(status: ProcessingStatus) -> str:
    return {
        ProcessingStatus.CONFIRMED: "✅ 已确认",
        ProcessingStatus.PENDING: "⏳ 待补充",
        ProcessingStatus.MANUAL_OVERRIDE: "✏️ 人工修改",
    }[status]


def source_label(source: EquivalentAnswerSource) -> str:
    return source.value


def issue_to_human(issue: EquivalentAnswerIssue) -> str:
    return issue.to_human_message()


def translate_field(field_name: str) -> str:
    return _FIELD_MAP.get(field_name, field_name)
