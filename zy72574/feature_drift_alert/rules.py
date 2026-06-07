from typing import List, Tuple
from .models import FeatureScore, Alert, AlertStatus, AlertEvidence
from .storage import generate_id


class BoundaryRules:
    ONE_BUCKET_DIFF = 1
    TWO_PLUS_BUCKET_DIFF = 2

    @classmethod
    def evaluate_feature(cls, feature_score: FeatureScore, training_log_id: str) -> Tuple[bool, Alert]:
        alert = Alert(
            alert_id=generate_id(),
            feature_name=feature_score.feature_name,
            offline_score=feature_score.offline_score,
            online_score=feature_score.online_score,
            offline_bucket=feature_score.offline_bucket,
            online_bucket=feature_score.online_bucket,
            bucket_diff=feature_score.bucket_diff,
            evidence=AlertEvidence(training_log_id=training_log_id),
        )

        if feature_score.bucket_diff >= cls.TWO_PLUS_BUCKET_DIFF:
            alert.status = AlertStatus.CONFIRMED_DRIFT
            alert.remark = f"离线索引分{feature_score.offline_score:.3f}({feature_score.offline_bucket.value})与线上得分{feature_score.online_score:.3f}({feature_score.online_bucket.value})差{feature_score.bucket_diff}个桶，自动判定为漂移"
            return True, alert

        if feature_score.bucket_diff == cls.ONE_BUCKET_DIFF:
            alert.status = AlertStatus.PENDING_REVIEW
            alert.remark = f"离线索引分{feature_score.offline_score:.3f}({feature_score.offline_bucket.value})与线上得分{feature_score.online_score:.3f}({feature_score.online_bucket.value})差1个桶，待评测运营复核"
            return True, alert

        return False, alert

    @classmethod
    def evaluate_batch(cls, feature_scores: List[FeatureScore], training_log_id: str) -> List[Alert]:
        alerts = []
        for fs in feature_scores:
            should_alert, alert = cls.evaluate_feature(fs, training_log_id)
            if should_alert:
                alerts.append(alert)
        return alerts

    @classmethod
    def get_judgment_guideline(cls, bucket_diff: int) -> str:
        if bucket_diff >= 2:
            return (
                "【判定规则】离线与线上得分差>=2个桶：自动判定为漂移\n"
                "【操作建议】立即排查数据源、特征工程逻辑、线上服务配置\n"
                "【回滚方式】在报警详情页点击回滚，可将状态回退到上一状态"
            )
        elif bucket_diff == 1:
            return (
                "【判定规则】离线与线上得分差=1个桶：不自动判定，必须评测运营人工复核\n"
                "【操作建议】\n"
                "  1. 点击关联的训练日志曲线，查看分数随时间变化趋势\n"
                "  2. 打开阈值调参笔记，确认当前桶划分阈值是否合理\n"
                "  3. 对比同批次其他特征是否存在类似漂移\n"
                "  4. 复核后选择：确认漂移 / 标记为误报 / 需要重新实验\n"
                "【回滚方式】复核完成后发现误判，可在历史记录中执行回滚"
            )
        else:
            return (
                "【判定规则】离线与线上得分在同一桶：正常，不触发报警"
            )

    @classmethod
    def resolve_one_bucket_diff(cls, alert: Alert, is_confirmed_drift: bool, reviewer: str, reason: str) -> None:
        if alert.bucket_diff != 1:
            raise ValueError("此方法仅用于差1个桶的边界情况")

        if is_confirmed_drift:
            alert.update_status(
                AlertStatus.CONFIRMED_DRIFT,
                reviewer,
                reason=f"人工复核确认漂移: {reason}"
            )
        else:
            alert.update_status(
                AlertStatus.FALSE_ALARM,
                reviewer,
                reason=f"人工复核标记为误报: {reason}"
            )
