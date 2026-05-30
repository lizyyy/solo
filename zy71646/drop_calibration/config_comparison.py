"""
配置对比模块
- 配置概率 vs 实际掉落对比
- 多版本配置对比
- 可视化对比数据
"""
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
from datetime import datetime
import numpy as np
import pandas as pd

from .models import (
    DropConfig,
    PlayerLog,
    ActivityPeriod,
    CalibrationParams,
    DataSource,
)
from .probability_test import TestResult, ItemStats
from .data_cleaning import CleaningResult


@dataclass
class ComparisonItem:
    """单个道具的对比结果"""
    pool_id: str
    item_id: str
    item_name: str
    config_probability: float
    config_weight: float
    actual_probability: float
    actual_drop_count: int
    total_attempts: int
    deviation: float
    deviation_percent: float
    confidence_lower: float
    confidence_upper: float
    p_value: float
    is_significant: bool
    activity_multiplier: float
    expected_count: float
    actual_count: int
    status: str = "normal"


@dataclass
class PoolComparison:
    """单个道具池的对比结果"""
    pool_id: str
    pool_name: str
    total_attempts: int
    total_items: int
    chi_square_statistic: float
    chi_square_p_value: float
    is_distribution_significant: bool
    items: List[ComparisonItem] = field(default_factory=list)
    config_total_probability: float = 0.0
    actual_total_probability: float = 0.0


@dataclass
class ComparisonResult:
    """配置对比总结果"""
    params: CalibrationParams
    filter_hash: str
    generated_time: datetime = field(default_factory=datetime.now)
    pools: Dict[str, PoolComparison] = field(default_factory=dict)
    overall_summary: Dict[str, Any] = field(default_factory=dict)
    data_sources: List[DataSource] = field(default_factory=list)

    def to_dataframe(self) -> pd.DataFrame:
        """导出为DataFrame"""
        rows = []
        for pool_id, pool in self.pools.items():
            for item in pool.items:
                rows.append({
                    "pool_id": pool_id,
                    "pool_name": pool.pool_name,
                    "item_id": item.item_id,
                    "item_name": item.item_name,
                    "config_probability": item.config_probability,
                    "config_probability_pct": item.config_probability * 100,
                    "config_weight": item.config_weight,
                    "actual_probability": item.actual_probability,
                    "actual_probability_pct": item.actual_probability * 100,
                    "actual_drop_count": item.actual_drop_count,
                    "total_attempts": item.total_attempts,
                    "deviation": item.deviation,
                    "deviation_pp": item.deviation * 100,
                    "deviation_percent": item.deviation_percent,
                    "confidence_lower": item.confidence_lower,
                    "confidence_lower_pct": item.confidence_lower * 100,
                    "confidence_upper": item.confidence_upper,
                    "confidence_upper_pct": item.confidence_upper * 100,
                    "p_value": item.p_value,
                    "is_significant": item.is_significant,
                    "activity_multiplier": item.activity_multiplier,
                    "expected_count": item.expected_count,
                    "actual_count": item.actual_count,
                    "status": item.status,
                    "pool_chi_square": pool.chi_square_statistic,
                    "pool_p_value": pool.chi_square_p_value,
                    "pool_significant": pool.is_distribution_significant,
                })
        return pd.DataFrame(rows)


class ConfigComparator:
    """
    配置对比器
    对比配置概率和实际掉落
    """

    def __init__(self, fail_fast: bool = False):
        self.fail_fast = fail_fast

    def compare(
        self,
        drop_configs: List[DropConfig],
        test_result: TestResult,
        activity_periods: List[ActivityPeriod],
        data_sources: List[DataSource],
        pool_names: Optional[Dict[str, str]] = None,
    ) -> ComparisonResult:
        """
        执行配置对比
        """
        pool_names = pool_names or {}

        result = ComparisonResult(
            params=test_result.params,
            filter_hash=test_result.filter_hash,
            data_sources=data_sources,
        )

        pool_configs: Dict[str, List[DropConfig]] = defaultdict(list)
        for cfg in drop_configs:
            if cfg.is_enabled:
                pool_configs[cfg.pool_id].append(cfg)

        for pool_id, pool_cfg_list in pool_configs.items():
            if test_result.params.pool_ids and pool_id not in test_result.params.pool_ids:
                continue

            pool_chi = test_result.pool_chi_square.get(pool_id, {})

            pool_comparison = PoolComparison(
                pool_id=pool_id,
                pool_name=pool_names.get(pool_id, pool_id),
                total_attempts=pool_chi.get("total_trials", 0),
                total_items=len(pool_cfg_list),
                chi_square_statistic=pool_chi.get("chi2_statistic", 0.0),
                chi_square_p_value=pool_chi.get("p_value", 1.0),
                is_distribution_significant=pool_chi.get("significant", False),
            )

            for cfg in pool_cfg_list:
                key = f"{pool_id}:{cfg.item_id}"
                item_stat = test_result.item_stats.get(key)

                if not item_stat:
                    continue

                avg_multiplier = self._get_average_activity_multiplier(
                    pool_id, cfg.item_id, activity_periods, test_result
                )

                adjusted_config_prob = cfg.probability * avg_multiplier

                deviation = item_stat.observed_probability - adjusted_config_prob
                deviation_percent = (
                    (deviation / adjusted_config_prob * 100)
                    if adjusted_config_prob > 0 else 0
                )

                expected_count = adjusted_config_prob * item_stat.total_attempts

                status = self._determine_status(
                    deviation, deviation_percent, item_stat.is_significant,
                    test_result.params
                )

                pool_comparison.items.append(ComparisonItem(
                    pool_id=pool_id,
                    item_id=cfg.item_id,
                    item_name=cfg.item_name or item_stat.item_name,
                    config_probability=cfg.probability,
                    config_weight=cfg.weight,
                    actual_probability=item_stat.observed_probability,
                    actual_drop_count=item_stat.drop_count,
                    total_attempts=item_stat.total_attempts,
                    deviation=deviation,
                    deviation_percent=deviation_percent,
                    confidence_lower=item_stat.confidence_lower,
                    confidence_upper=item_stat.confidence_upper,
                    p_value=item_stat.p_value,
                    is_significant=item_stat.is_significant,
                    activity_multiplier=avg_multiplier,
                    expected_count=expected_count,
                    actual_count=item_stat.drop_count,
                    status=status,
                ))

                pool_comparison.config_total_probability += adjusted_config_prob
                pool_comparison.actual_total_probability += item_stat.observed_probability

            if pool_comparison.items:
                result.pools[pool_id] = pool_comparison

        self._generate_summary(result, test_result)

        return result

    def _get_average_activity_multiplier(
        self,
        pool_id: str,
        item_id: str,
        activities: List[ActivityPeriod],
        test_result: TestResult,
    ) -> float:
        """获取指定道具的平均活动加成倍率"""
        relevant_activities = [
            a for a in activities
            if a.is_active
            and (not a.pool_id or a.pool_id == pool_id)
            and (not a.item_id or a.item_id == item_id)
            and a.drop_rate_multiplier != 1.0
        ]

        if not relevant_activities:
            return 1.0

        total_weight = 0
        weighted_multiplier = 0

        params = test_result.params
        for activity in relevant_activities:
            if params.activity_ids and activity.activity_id not in params.activity_ids:
                continue

            duration = 0
            if activity.start_time and activity.end_time:
                effective_start = max(activity.start_time, params.start_time) if params.start_time else activity.start_time
                effective_end = min(activity.end_time, params.end_time) if params.end_time else activity.end_time
                if effective_end > effective_start:
                    duration = (effective_end - effective_start).total_seconds()

            total_weight += duration
            weighted_multiplier += activity.drop_rate_multiplier * duration

        if total_weight > 0:
            return weighted_multiplier / total_weight

        if relevant_activities:
            return max(a.drop_rate_multiplier for a in relevant_activities)

        return 1.0

    def _determine_status(
        self,
        deviation: float,
        deviation_percent: float,
        is_significant: bool,
        params: CalibrationParams,
    ) -> str:
        """判断道具的状态"""
        abs_deviation_percent = abs(deviation_percent)

        if is_significant and abs_deviation_percent >= params.deviation_critical_threshold * 100:
            return "critical"
        elif is_significant and abs_deviation_percent >= params.deviation_warning_threshold * 100:
            return "warning"
        elif abs_deviation_percent >= params.deviation_critical_threshold * 100:
            return "critical_not_significant"
        elif abs_deviation_percent >= params.deviation_warning_threshold * 100:
            return "warning_not_significant"
        else:
            return "normal"

    def _generate_summary(
        self,
        result: ComparisonResult,
        test_result: TestResult,
    ) -> None:
        """生成汇总信息"""
        total_items = 0
        critical_items = 0
        warning_items = 0
        normal_items = 0
        significant_items = 0
        total_deviation = 0.0

        for pool in result.pools.values():
            for item in pool.items:
                total_items += 1
                total_deviation += abs(item.deviation_percent)
                if item.is_significant:
                    significant_items += 1
                if item.status == "critical":
                    critical_items += 1
                elif item.status == "warning":
                    warning_items += 1
                elif item.status == "normal":
                    normal_items += 1

        result.overall_summary = {
            "total_pools": len(result.pools),
            "total_items": total_items,
            "critical_items": critical_items,
            "warning_items": warning_items,
            "normal_items": normal_items,
            "significant_items": significant_items,
            "average_abs_deviation_percent": total_deviation / total_items if total_items > 0 else 0,
            "total_attempts": test_result.filtered_logs,
            "significance_level": test_result.params.significance_level,
            "confidence_level": test_result.params.confidence_level,
            "deviation_warning_threshold": test_result.params.deviation_warning_threshold,
            "deviation_critical_threshold": test_result.params.deviation_critical_threshold,
            "generated_at": datetime.now().isoformat(),
            "filter_hash": test_result.filter_hash,
        }

    def compare_versions(
        self,
        configs_v1: List[DropConfig],
        configs_v2: List[DropConfig],
    ) -> pd.DataFrame:
        """
        对比两个版本的配置差异
        """
        rows = []

        configs_map_v1: Dict[Tuple[str, str], DropConfig] = {
            (c.pool_id, c.item_id): c for c in configs_v1
        }
        configs_map_v2: Dict[Tuple[str, str], DropConfig] = {
            (c.pool_id, c.item_id): c for c in configs_v2
        }

        all_keys = set(configs_map_v1.keys()) | set(configs_map_v2.keys())

        for key in sorted(all_keys):
            pool_id, item_id = key
            cfg_v1 = configs_map_v1.get(key)
            cfg_v2 = configs_map_v2.get(key)

            prob_v1 = cfg_v1.probability if cfg_v1 else None
            prob_v2 = cfg_v2.probability if cfg_v2 else None

            diff = None
            diff_percent = None
            if prob_v1 is not None and prob_v2 is not None and prob_v1 > 0:
                diff = prob_v2 - prob_v1
                diff_percent = diff / prob_v1 * 100

            change_type = "unchanged"
            if cfg_v1 is None:
                change_type = "added"
            elif cfg_v2 is None:
                change_type = "removed"
            elif prob_v1 != prob_v2:
                change_type = "modified"

            rows.append({
                "pool_id": pool_id,
                "item_id": item_id,
                "item_name": cfg_v2.item_name if cfg_v2 else (cfg_v1.item_name if cfg_v1 else ""),
                "probability_v1": prob_v1,
                "probability_v2": prob_v2,
                "probability_v1_pct": prob_v1 * 100 if prob_v1 is not None else None,
                "probability_v2_pct": prob_v2 * 100 if prob_v2 is not None else None,
                "diff": diff,
                "diff_pp": diff * 100 if diff is not None else None,
                "diff_percent": diff_percent,
                "change_type": change_type,
                "weight_v1": cfg_v1.weight if cfg_v1 else None,
                "weight_v2": cfg_v2.weight if cfg_v2 else None,
                "is_enabled_v1": cfg_v1.is_enabled if cfg_v1 else None,
                "is_enabled_v2": cfg_v2.is_enabled if cfg_v2 else None,
            })

        return pd.DataFrame(rows)
