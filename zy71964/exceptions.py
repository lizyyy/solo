from typing import Optional, Dict, Any
from models import AbnormalType, UserFriendlyError


class ThresholdRollbackException(Exception):
    def __init__(self, friendly_error: UserFriendlyError):
        self.friendly_error = friendly_error
        super().__init__(friendly_error.message)


def create_friendly_error(
    error_code: str,
    title: str,
    message: str,
    suggestion: str,
    details: Optional[Dict[str, Any]] = None,
    abnormal_type: Optional[AbnormalType] = None,
) -> UserFriendlyError:
    return UserFriendlyError(
        error_code=error_code,
        title=title,
        message=message,
        suggestion=suggestion,
        details=details or {},
        abnormal_type=abnormal_type,
    )


ERROR_METRIC_CHANGED = create_friendly_error(
    error_code="ABNORMAL_001",
    title="指标口径发生变化",
    message="本次上传的训练日志中，指标计算方式与历史记录不一致。"
            "例如：准确率的计算从「正确数/总数」变成了「正确数/有效样本数」。",
    suggestion="请检查训练脚本是否被修改，或联系算法工程师确认指标口径是否调整。"
               "如需强制使用新口径，请在操作时选择「忽略口径变化」。",
    abnormal_type=AbnormalType.METRIC_CHANGED,
)

ERROR_DATA_LEAKAGE = create_friendly_error(
    error_code="ABNORMAL_002",
    title="检测到训练集泄漏风险",
    message="训练集中包含了灰度验证集的样本，这会导致阈值评估结果过于乐观，不可用于线上决策。",
    suggestion="请检查训练数据划分逻辑，确保训练集和验证集没有重叠。"
               "确认无误后可标记为「已审核」继续流程。",
    abnormal_type=AbnormalType.DATA_LEAKAGE,
)

ERROR_LABEL_MISSING = create_friendly_error(
    error_code="ABNORMAL_003",
    title="存在标签未映射",
    message="训练日志中的标签映射表不完整，有 {missing_count} 个标签在新数据中出现但未在映射表中定义。",
    suggestion="请补全标签映射表，确保所有出现的标签都有对应的映射关系。"
               "确认无误后可标记为「已审核」继续流程。",
    abnormal_type=AbnormalType.LABEL_MISSING,
)

ERROR_DUPLICATE_MATERIAL = create_friendly_error(
    error_code="IDEMPOTENT_001",
    title="该批次材料已处理过",
    message="这批材料（{material_id}）之前已经成功完成过阈值灰度回滚，"
            "本次操作不会生成新的成功记录。",
    suggestion="如果您需要重新计算，请选择「强制重新计算」选项，系统会保留历史记录并标记为历史版本。",
)

ERROR_LOG_VERSION_CONFLICT = create_friendly_error(
    error_code="VERSION_001",
    title="训练日志版本有更新",
    message="检测到同一批材料上传了不同版本的训练日志，新版本与历史版本在以下方面存在差异：\n{changes}",
    suggestion="请仔细核对变更内容。如确认无误，可选择「使用新版本」继续，系统会保留旧版本记录供追溯。",
)

ERROR_LOG_NOT_FOUND = create_friendly_error(
    error_code="NOT_FOUND_001",
    title="未找到训练日志",
    message="材料 {material_id} 还没有上传过训练日志，无法进行阈值灰度回滚。",
    suggestion="请先上传训练日志文件，再执行阈值灰度回滚操作。",
)

ERROR_THRESHOLD_INVALID = create_friendly_error(
    error_code="VALIDATION_001",
    title="阈值配置无效",
    message="配置的阈值 {threshold} 超出了合理范围 [0, 1]。",
    suggestion="请检查阈值配置，确保阈值在有效范围内。覆盖率阈值也应在 0 到 1 之间。",
)


def raise_with_params(error: UserFriendlyError, **params) -> None:
    formatted_error = UserFriendlyError(
        error_code=error.error_code,
        title=error.title,
        message=error.message.format(**params),
        suggestion=error.suggestion,
        details={**error.details, **params},
        abnormal_type=error.abnormal_type,
    )
    raise ThresholdRollbackException(formatted_error)
