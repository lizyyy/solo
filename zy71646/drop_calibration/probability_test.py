"""
概率检验模块
- 卡方检验：比较观测分布和期望分布是否一致
- 分组统计：按指定维度分组统计
- 置信区间：计算真实概率的置信区间
"""
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
from datetime import datetime
import numpy as np
import pandas as pd

from .exceptions import ProbabilityCalculationError, create_error_location
from .models import (
    PlayerLog,
    DropConfig,
    CalibrationParams,
)
from .utils import (
    chi_square_test,
    calculate_confidence_interval,
)


@dataclass
class GroupStats:
    """分组统计结果"""
    group_key: Tuple[Any, ...]
    group_labels: Dict[str, Any]
    total_attempts: int = 0
    total_drops: int = 0
    observed_probability: float = 0.0
    expected_probability: float = 0.0
    confidence_lower: float = 0.0
    confidence_upper: float = 0.0
    deviation: float = 0.0
    deviation_percent: float = 0.0
    chi_square: Optional[Dict[str, Any]] = None
    item_count: int = 0


@dataclass
class ItemStats:
    """单个道具的统计结果"""
    pool_id: str
    item_id: str
    item_name: str
    expected_probability: float = 0.0
    total_attempts: int = 0
    drop_count: int = 0
    observed_probability: float = 0.0
    confidence_lower: float = 0.0
    confidence_upper: float = 0.0
    deviation: float = 0.0
    deviation_percent: float = 0.0
    is_significant: bool = False
    p_value: float = 1.0
    expected_count: float = 0.0


@dataclass
class TestResult:
    """概率检验总结果"""
    params: CalibrationParams
    filter_hash: str = ""
    total_logs: int = 0
    filtered_logs: int = 0
    total_pools: int = 0
    total_items: int = 0
    pool_chi_square: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    item_stats: Dict[str, ItemStats] = field(default_factory=dict)
    group_stats: List[GroupStats] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    errors: List[ProbabilityCalculationError] = field(default_factory=list)
    calculation_time: datetime = field(default_factory=datetime.now)


class ProbabilityTester:
    """
    概率检验器
    执行统计检验，判断实际掉落是否符合配置概率
    """

    def __init__(self, fail_fast: bool = False):
        self.fail_fast = fail_fast

    def run_test(
        self,
        player_logs: List[PlayerLog],
        drop_configs: List[DropConfig],
        params: CalibrationParams,
    ) -> TestResult:
        """
        执行完整的概率检验
        """
        result = TestResult(params=params)
        result.filter_hash = params.get_filter_hash()
        result.total_logs = len(player_logs)

        try:
            filtered_logs = self._filter_logs(player_logs, params)
            result.filtered_logs = len(filtered_logs)

            if result.filtered_logs < params.min_sample_size:
                result.warnings.append(
                    f"筛选后样本量不足: {result.filtered_logs} 条，低于最小要求 {params.min_sample_size}"
                )

            active_configs = [c for c in drop_configs if c.is_enabled]
            if params.pool_ids:
                active_configs = [c for c in active_configs if c.pool_id in params.pool_ids]
            if params.item_ids:
                active_configs = [c for c in active_configs if c.item_id in params.item_ids]

            result.total_pools = len({c.pool_id for c in active_configs})
            result.total_items = len(active_configs)

            result.pool_chi_square = self._test_pool_distributions(
                filtered_logs, active_configs, params
            )

            result.item_stats = self._calculate_item_stats(
                filtered_logs, active_configs, params
            )

            if params.group_by:
                result.group_stats = self._calculate_group_stats(
                    filtered_logs, active_configs, params
                )

        except ProbabilityCalculationError as e:
            if self.fail_fast:
                raise
            result.errors.append(e)
        except Exception as e:
            error = ProbabilityCalculationError(
                f"概率检验失败: {str(e)}"
            )
            if self.fail_fast:
                raise error
            result.errors.append(error)

        return result

    def _filter_logs(
        self,
        logs: List[PlayerLog],
        params: CalibrationParams,
    ) -> List[PlayerLog]:
        """根据参数筛选日志"""
        filtered = []

        for log in logs:
            if params.start_time and log.drop_time and log.drop_time < params.start_time:
                continue
            if params.end_time and log.drop_time and log.drop_time > params.end_time:
                continue
            if params.pool_ids and log.pool_id not in params.pool_ids:
                continue
            if params.item_ids and log.item_id not in params.item_ids:
                continue
            if params.player_ids and log.player_id not in params.player_ids:
                continue
            if params.server_ids and log.server_id not in params.server_ids:
                continue
            if params.channels and log.channel not in params.channels:
                continue
            if log.is_duplicate:
                continue

            filtered.append(log)

        if params.max_sample_size and len(filtered) > params.max_sample_size:
            filtered = filtered[:params.max_sample_size]

        return filtered

    def _test_pool_distributions(
        self,
        logs: List[PlayerLog],
        configs: List[DropConfig],
        params: CalibrationParams,
    ) -> Dict[str, Dict[str, Any]]:
        """
        对每个道具池执行卡方检验
        检验整个池子的道具分布是否符合配置
        """
        results: Dict[str, Dict[str, Any]] = {}

        pool_configs: Dict[str, List[DropConfig]] = defaultdict(list)
        for cfg in configs:
            pool_configs[cfg.pool_id].append(cfg)

        pool_logs: Dict[str, List[PlayerLog]] = defaultdict(list)
        for log in logs:
            pool_logs[log.pool_id].append(log)

        for pool_id, pool_cfg_list in pool_configs.items():
            pool_log_list = pool_logs.get(pool_id, [])
            if not pool_log_list:
                continue

            item_ids = [cfg.item_id for cfg in pool_cfg_list]
            expected_probs = [cfg.probability for cfg in pool_cfg_list]

            total = sum(expected_probs)
            if abs(total - 1.0) > 1e-6:
                expected_probs = [p / total for p in expected_probs]

            observed_counts = []
            for item_id in item_ids:
                count = sum(
                    1 for log in pool_log_list
                    if log.item_id == item_id
                )
                observed_counts.append(count)

            total_observed = sum(observed_counts)
            if total_observed <= 0:
                results[pool_id] = {
                    "pool_id": pool_id,
                    "total_trials": 0,
                    "item_count": len(item_ids),
                    "has_data": False,
                    "warning": "该池子没有掉落数据",
                }
                continue

            try:
                test_result = chi_square_test(
                    observed_counts,
                    expected_probs,
                    params.significance_level,
                )
                test_result["pool_id"] = pool_id
                test_result["total_trials"] = total_observed
                test_result["item_count"] = len(item_ids)
                test_result["item_ids"] = item_ids
                test_result["observed_counts"] = observed_counts
                test_result["expected_probs"] = expected_probs
                test_result["has_data"] = True

                if test_result.get("min_expected_count", 999) < 5:
                    test_result["warning"] = (
                        f"卡方检验前提不满足：期望频数最小值为 "
                        f"{test_result['min_expected_count']:.2f}，小于5，"
                        f"检验结果可能不可靠"
                    )

                results[pool_id] = test_result

            except Exception as e:
                results[pool_id] = {
                    "pool_id": pool_id,
                    "error": str(e),
                    "has_data": True,
                }

        return results

    def _calculate_item_stats(
        self,
        logs: List[PlayerLog],
        configs: List[DropConfig],
        params: CalibrationParams,
    ) -> Dict[str, ItemStats]:
        """
        计算每个道具的统计指标
        """
        stats: Dict[str, ItemStats] = {}

        config_map: Dict[Tuple[str, str], DropConfig] = {}
        for cfg in configs:
            config_map[(cfg.pool_id, cfg.item_id)] = cfg

        pool_total_attempts: Dict[str, int] = defaultdict(int)
        for log in logs:
            pool_total_attempts[log.pool_id] += 1

        item_drop_counts: Dict[Tuple[str, str], int] = defaultdict(int)
        for log in logs:
            item_drop_counts[(log.pool_id, log.item_id)] += 1

        for (pool_id, item_id), cfg in config_map.items():
            total_attempts = pool_total_attempts.get(pool_id, 0)
            drop_count = item_drop_counts.get((pool_id, item_id), 0)

            if total_attempts <= 0:
                continue

            observed_prob, ci_lower, ci_upper = calculate_confidence_interval(
                drop_count, total_attempts, params.confidence_level
            )

            expected_prob = cfg.probability
            deviation = observed_prob - expected_prob
            deviation_percent = (
                (deviation / expected_prob * 100)
                if expected_prob > 0 else 0
            )

            expected_count = expected_prob * total_attempts

            success = drop_count
            trials = total_attempts
            from scipy import stats as scipy_stats
            other_success = trials - success
            other_expected = (1 - expected_prob) * trials

            try:
                if expected_count >= 5 and other_expected >= 5:
                    chi2, p_value = scipy_stats.chisquare(
                        [success, other_success],
                        f_exp=[expected_count, other_expected]
                    )
                    is_significant = p_value < params.significance_level
                else:
                    p_value = 1.0
                    is_significant = False
            except Exception:
                p_value = 1.0
                is_significant = False

            key = f"{pool_id}:{item_id}"
            stats[key] = ItemStats(
                pool_id=pool_id,
                item_id=item_id,
                item_name=cfg.item_name,
                expected_probability=expected_prob,
                total_attempts=total_attempts,
                drop_count=drop_count,
                observed_probability=observed_prob,
                confidence_lower=ci_lower,
                confidence_upper=ci_upper,
                deviation=deviation,
                deviation_percent=deviation_percent,
                is_significant=is_significant,
                p_value=p_value,
                expected_count=expected_count,
            )

        return stats

    def _calculate_group_stats(
        self,
        logs: List[PlayerLog],
        configs: List[DropConfig],
        params: CalibrationParams,
    ) -> List[GroupStats]:
        """
        按指定维度分组统计
        """
        results: List[GroupStats] = []

        config_map: Dict[Tuple[str, str], DropConfig] = {}
        for cfg in configs:
            config_map[(cfg.pool_id, cfg.item_id)] = cfg

        groups: Dict[Tuple[Any, ...], List[PlayerLog]] = defaultdict(list)

        for log in logs:
            key_parts = []
            labels: Dict[str, Any] = {}
            for field_name in params.group_by:
                value = getattr(log, field_name, None)
                if field_name == "drop_time" and isinstance(value, datetime):
                    value = value.strftime("%Y-%m-%d")
                key_parts.append(value)
                labels[field_name] = value
            key = tuple(key_parts)
            groups[key].append(log)

        for key, group_logs in groups.items():
            labels = {}
            for i, field_name in enumerate(params.group_by):
                labels[field_name] = key[i]

            pool_ids = {log.pool_id for log in group_logs}
            if len(pool_ids) != 1:
                continue

            pool_id = list(pool_ids)[0]
            total_attempts = len(group_logs)

            if total_attempts < params.min_sample_size:
                continue

            pool_configs = [
                cfg for cfg in configs
                if cfg.pool_id == pool_id and cfg.is_enabled
            ]

            total_drops = len(group_logs)
            item_ids_in_group = {log.item_id for log in group_logs}

            expected_probs = [cfg.probability for cfg in pool_configs]
            total_prob = sum(expected_probs)
            if abs(total_prob - 1.0) > 1e-6:
                expected_probs = [p / total_prob for p in expected_probs]

            observed_counts = []
            for cfg in pool_configs:
                count = sum(1 for log in group_logs if log.item_id == cfg.item_id)
                observed_counts.append(count)

            if sum(observed_counts) == 0:
                continue

            try:
                chi_result = chi_square_test(
                    observed_counts, expected_probs, params.significance_level
                )
            except Exception:
                chi_result = None

            observed_prob = total_drops / total_attempts if total_attempts > 0 else 0
            expected_prob = sum(expected_probs) / len(expected_probs) if expected_probs else 0

            observed_prob, ci_lower, ci_upper = calculate_confidence_interval(
                total_drops, total_attempts, params.confidence_level
            )

            deviation = observed_prob - expected_prob
            deviation_percent = (
                (deviation / expected_prob * 100) if expected_prob > 0 else 0
            )

            results.append(GroupStats(
                group_key=key,
                group_labels=labels,
                total_attempts=total_attempts,
                total_drops=total_drops,
                observed_probability=observed_prob,
                expected_probability=expected_prob,
                confidence_lower=ci_lower,
                confidence_upper=ci_upper,
                deviation=deviation,
                deviation_percent=deviation_percent,
                chi_square=chi_result,
                item_count=len(item_ids_in_group),
            ))

        return results
