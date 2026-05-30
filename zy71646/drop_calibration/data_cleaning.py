"""
数据清洗模块
- 去重：检测并标记重复记录
- 活动加成计算：根据活动时段计算实际生效的概率
- 概率归一化校验：检查配置概率是否归一化，必要时进行归一化
"""
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple, Set
from collections import defaultdict
from datetime import datetime
import pandas as pd

from .exceptions import DataValidationError, ProbabilityCalculationError, create_error_location
from .models import (
    PlayerLog,
    DropConfig,
    ActivityPeriod,
    ItemPool,
    CalibrationParams,
)
from .utils import (
    check_probability_normalization,
    normalize_probability,
)


@dataclass
class DeduplicateResult:
    """去重结果"""
    total_records: int = 0
    duplicate_count: int = 0
    unique_count: int = 0
    duplicate_groups: Dict[str, List[str]] = field(default_factory=dict)
    duplicate_keys: List[str] = field(default_factory=list)


@dataclass
class ActivityBonusResult:
    """活动加成计算结果"""
    total_records: int = 0
    records_with_activity: int = 0
    records_without_activity: int = 0
    applied_activities: Dict[str, int] = field(default_factory=dict)
    average_multiplier: float = 1.0


@dataclass
class NormalizationResult:
    """概率归一化结果"""
    pool_id: str = ""
    is_normalized: bool = False
    original_total: float = 0.0
    diff_from_one: float = 0.0
    normalized_probabilities: Dict[str, float] = field(default_factory=dict)
    original_probabilities: Dict[str, float] = field(default_factory=dict)
    item_count: int = 0
    source: str = "probability"


@dataclass
class CleaningResult:
    """数据清洗总结果"""
    deduplicate: DeduplicateResult = field(default_factory=DeduplicateResult)
    activity_bonus: ActivityBonusResult = field(default_factory=ActivityBonusResult)
    normalization: Dict[str, NormalizationResult] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)
    errors: List[DataValidationError] = field(default_factory=list)
    cleaned_logs: List[PlayerLog] = field(default_factory=list)
    cleaned_configs: List[DropConfig] = field(default_factory=list)


class DataCleaner:
    """
    数据清洗器
    解决常见问题：样本重复、活动加成漏算、概率不归一
    """

    def __init__(self, fail_fast: bool = False):
        self.fail_fast = fail_fast

    def clean_data(
        self,
        player_logs: List[PlayerLog],
        drop_configs: List[DropConfig],
        activity_periods: List[ActivityPeriod],
        item_pools: List[ItemPool],
        params: CalibrationParams,
    ) -> CleaningResult:
        """
        执行完整的数据清洗流程
        """
        result = CleaningResult()

        try:
            if params.deduplicate_enabled:
                result.deduplicate = self.deduplicate_logs(
                    player_logs, params.deduplicate_keys
                )
            else:
                result.deduplicate = DeduplicateResult(
                    total_records=len(player_logs),
                    unique_count=len(player_logs),
                    duplicate_keys=params.deduplicate_keys,
                )

            unique_logs = [
                log for log in player_logs if not log.is_duplicate
            ]
            result.cleaned_logs = unique_logs

            if params.activity_bonus_enabled:
                result.activity_bonus = self.apply_activity_bonus(
                    unique_logs, activity_periods, params
                )

            if params.probability_normalization_enabled:
                result.normalization = self.normalize_probabilities(
                    drop_configs, item_pools, params
                )
                result.cleaned_configs = self._update_configs_with_normalized(
                    drop_configs, result.normalization
                )
            else:
                result.normalization = self._check_normalization(
                    drop_configs, item_pools
                )
                result.cleaned_configs = list(drop_configs)

            self._validate_cleaned_data(
                result.cleaned_logs,
                result.cleaned_configs,
                result,
                params,
            )

        except DataValidationError as e:
            if self.fail_fast:
                raise
            result.errors.append(e)
        except Exception as e:
            error = DataValidationError(
                f"数据清洗失败: {str(e)}"
            )
            if self.fail_fast:
                raise error
            result.errors.append(error)

        return result

    def deduplicate_logs(
        self,
        logs: List[PlayerLog],
        keys: List[str],
    ) -> DeduplicateResult:
        """
        对玩家日志进行去重
        标记重复记录但不删除，保留所有数据
        """
        result = DeduplicateResult(
            total_records=len(logs),
            duplicate_keys=keys,
        )

        groups: Dict[str, List[PlayerLog]] = defaultdict(list)

        for log in logs:
            key_parts = []
            for k in keys:
                if k == "drop_time" and log.drop_time:
                    key_parts.append(log.drop_time.strftime("%Y-%m-%d %H:%M:%S"))
                else:
                    key_parts.append(str(getattr(log, k, "")))
            key = "|".join(key_parts)
            groups[key].append(log)

        for key, group in groups.items():
            if len(group) > 1:
                primary = group[0]
                result.duplicate_groups[primary.log_id] = [g.log_id for g in group[1:]]
                for dup in group[1:]:
                    dup.is_duplicate = True
                    dup.duplicate_of = primary.log_id
                result.duplicate_count += len(group) - 1

        result.unique_count = result.total_records - result.duplicate_count

        if result.duplicate_count > 0:
            pass

        return result

    def apply_activity_bonus(
        self,
        logs: List[PlayerLog],
        activities: List[ActivityPeriod],
        params: CalibrationParams,
    ) -> ActivityBonusResult:
        """
        应用活动加成
        根据掉落时间匹配活动时段，计算实际生效的概率加成
        """
        result = ActivityBonusResult(total_records=len(logs))

        valid_activities = [
            a for a in activities
            if a.is_active and a.start_time and a.end_time
        ]

        if params.activity_ids:
            valid_activities = [
                a for a in valid_activities
                if a.activity_id in params.activity_ids
            ]

        total_multiplier = 0.0

        for log in logs:
            if log.drop_time is None:
                continue

            applied_activity = None
            max_multiplier = 1.0

            for activity in valid_activities:
                if activity.pool_id and activity.pool_id != log.pool_id:
                    continue
                if activity.item_id and activity.item_id != log.item_id:
                    continue
                if activity.start_time <= log.drop_time <= activity.end_time:
                    if activity.drop_rate_multiplier > max_multiplier:
                        max_multiplier = activity.drop_rate_multiplier
                        applied_activity = activity

            if applied_activity:
                log.activity_applied = applied_activity.activity_id
                log.effective_probability = max_multiplier
                result.records_with_activity += 1
                result.applied_activities[applied_activity.activity_id] = (
                    result.applied_activities.get(applied_activity.activity_id, 0) + 1
                )
                total_multiplier += max_multiplier
            else:
                result.records_without_activity += 1
                total_multiplier += 1.0

        if result.total_records > 0:
            result.average_multiplier = total_multiplier / result.total_records

        return result

    def normalize_probabilities(
        self,
        configs: List[DropConfig],
        pools: List[ItemPool],
        params: CalibrationParams,
    ) -> Dict[str, NormalizationResult]:
        """
        检查并归一化掉落配置的概率
        每个道具池的概率总和应为1
        """
        results: Dict[str, NormalizationResult] = {}

        pool_configs: Dict[str, List[DropConfig]] = defaultdict(list)
        for config in configs:
            if config.is_enabled:
                pool_configs[config.pool_id].append(config)

        for pool_id, pool_config_list in pool_configs.items():
            if params.pool_ids and pool_id not in params.pool_ids:
                continue

            result = NormalizationResult(pool_id=pool_id)
            result.item_count = len(pool_config_list)

            prob_probs = []
            weight_probs = []
            for cfg in pool_config_list:
                prob_probs.append(cfg.probability)
                weight_probs.append(cfg.weight)
                result.original_probabilities[cfg.item_id] = cfg.probability

            prob_total = sum(prob_probs)
            weight_total = sum(weight_probs)

            use_probability = False
            if 0.5 <= prob_total <= 2.0 and prob_total > 0:
                use_probability = True
                probs = prob_probs
                result.original_total = prob_total
                result.source = "probability"
            elif weight_total > 0:
                probs = weight_probs
                result.original_total = weight_total
                result.source = "weight"
            else:
                probs = prob_probs
                result.original_total = prob_total
                result.source = "probability"

            if probs:
                is_norm, diff = check_probability_normalization(probs)
                result.is_normalized = is_norm
                result.diff_from_one = diff

                if not is_norm and params.probability_normalization_enabled:
                    try:
                        normalized = normalize_probability(probs)
                        for i, cfg in enumerate(pool_config_list):
                            result.normalized_probabilities[cfg.item_id] = normalized[i]
                    except ValueError as e:
                        raise ProbabilityCalculationError(
                            f"道具池 {pool_id} 概率归一化失败: {str(e)}",
                            location=create_error_location(
                                object_id=pool_id,
                                extra_info={"original_total": result.original_total}
                            )
                        ) from e
                else:
                    for i, cfg in enumerate(pool_config_list):
                        result.normalized_probabilities[cfg.item_id] = probs[i]

            results[pool_id] = result

        return results

    def _check_normalization(
        self,
        configs: List[DropConfig],
        pools: List[ItemPool],
    ) -> Dict[str, NormalizationResult]:
        """仅检查概率归一化，不修改"""
        return self.normalize_probabilities(
            configs, pools, CalibrationParams(probability_normalization_enabled=False)
        )

    def _update_configs_with_normalized(
        self,
        configs: List[DropConfig],
        normalization_results: Dict[str, NormalizationResult],
    ) -> List[DropConfig]:
        """用归一化后的概率更新配置"""
        updated = []
        for cfg in configs:
            pool_result = normalization_results.get(cfg.pool_id)
            if pool_result and cfg.item_id in pool_result.normalized_probabilities:
                new_prob = pool_result.normalized_probabilities[cfg.item_id]
                cfg.probability = new_prob
            updated.append(cfg)
        return updated

    def _validate_cleaned_data(
        self,
        logs: List[PlayerLog],
        configs: List[DropConfig],
        result: CleaningResult,
        params: CalibrationParams,
    ) -> None:
        """验证清洗后的数据"""
        if len(logs) < params.min_sample_size:
            result.warnings.append(
                f"样本量不足: 有效记录 {len(logs)} 条，低于最小样本量 {params.min_sample_size}，"
                f"统计检验结果可能不可靠"
            )

        pool_ids = {log.pool_id for log in logs}
        config_pool_ids = {cfg.pool_id for cfg in configs if cfg.is_enabled}
        missing_pools = pool_ids - config_pool_ids
        if missing_pools:
            for pool_id in missing_pools:
                result.warnings.append(
                    f"道具池 {pool_id} 在玩家日志中有记录，但缺少对应的掉落配置"
                )

        item_pools: Dict[str, Set[str]] = defaultdict(set)
        for log in logs:
            item_pools[log.pool_id].add(log.item_id)

        config_items: Dict[str, Set[str]] = defaultdict(set)
        for cfg in configs:
            if cfg.is_enabled:
                config_items[cfg.pool_id].add(cfg.item_id)

        for pool_id, items in item_pools.items():
            missing_items = items - config_items.get(pool_id, set())
            if missing_items:
                for item_id in list(missing_items)[:5]:
                    result.warnings.append(
                        f"道具池 {pool_id} 中的道具 {item_id} 在日志中有掉落，但没有配置概率"
                    )
                if len(missing_items) > 5:
                    result.warnings.append(
                        f"... 还有 {len(missing_items) - 5} 个道具缺少配置"
                    )
