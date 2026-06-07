from enum import Enum


class ProcessingStatus(str, Enum):
    """处理状态枚举

    状态流转说明（给推荐负责人看的）：
    - IMPORTED: YAML刚导进来，原始数据，还没动过
    - LINJI_REVIEWED: 林姐（数据科学家）看完评测切片了，标记了初步结论
    - PENDING_LEAD_REVIEW: 有特殊情况，等推荐负责人复核（比如线上特征缺失给了默认分）
    - LEAD_APPROVED: 推荐负责人复核通过，可以算正常
    - LEAD_REJECTED: 推荐负责人打回，需要重新看
    - SUMMARY_UPDATED: 可解释摘要已经更新完了，归档
    - ROLLBACK: 回滚到上一个状态（改错了的时候用）
    """

    IMPORTED = "imported"
    LINJI_REVIEWED = "linji_reviewed"
    PENDING_LEAD_REVIEW = "pending_lead_review"
    LEAD_APPROVED = "lead_approved"
    LEAD_REJECTED = "lead_rejected"
    SUMMARY_UPDATED = "summary_updated"
    ROLLBACK = "rollback"


class AnomalyType(str, Enum):
    """异常类型标记

    重点：DEFAULT_SCORE_MISSING_FEATURE 就是"线上特征缺失却给了默认分"
    这个类型不能自动归为正常，必须留给推荐负责人复核
    """

    NONE = "none"
    DEFAULT_SCORE_MISSING_FEATURE = "default_score_missing_feature"
    EMBEDDING_DIM_MISMATCH = "embedding_dim_mismatch"
    VERSION_TAG_MISSING = "version_tag_missing"
    CUSTOM_ANOMALY = "custom_anomaly"
