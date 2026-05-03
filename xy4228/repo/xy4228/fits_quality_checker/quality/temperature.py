"""温度匹配器。

用于检查暗场文件与光场文件的温度匹配情况，
防止温度差异过大的暗场被错误地用于叠加。
"""

from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from collections import defaultdict

import numpy as np

from fits_quality_checker.models.models import (
    FITSMetadata,
    FileType,
    ObservationConfig,
)


@dataclass
class TemperatureMatchResult:
    """温度匹配结果。"""
    light_file: str
    dark_file: Optional[str]
    temperature_diff: float
    is_match: bool
    details: Dict[str, Any]


class TemperatureMatcher:
    """温度匹配器。

    功能：
    1. 计算文件之间的温度差异
    2. 为光场文件找到最佳匹配的暗场文件
    3. 检测温度异常的文件
    """

    def __init__(
        self,
        config: Optional[ObservationConfig] = None,
        tolerance: Optional[float] = None,
    ):
        """初始化温度匹配器。

        Args:
            config: 观测配置
            tolerance: 温度容差(°C)，如果为None则使用配置中的值或默认0.5°C
        """
        self.config = config

        if tolerance is not None:
            self.tolerance = tolerance
        elif config and config.temperature_tolerance is not None:
            self.tolerance = config.temperature_tolerance
        else:
            self.tolerance = 0.5

    def find_best_dark_match(
        self,
        light_metadata: FITSMetadata,
        dark_metadatas: List[FITSMetadata],
    ) -> Tuple[Optional[FITSMetadata], float]:
        """为光场文件找到最佳匹配的暗场文件。

        Args:
            light_metadata: 光场文件元数据
            dark_metadatas: 暗场文件元数据列表

        Returns:
            (最佳匹配的暗场元数据, 温度差异) 元组
        """
        if not dark_metadatas:
            return None, float("inf")

        if light_metadata.temperature is None:
            return None, float("inf")

        light_temp = light_metadata.temperature
        best_match = None
        min_diff = float("inf")

        for dark in dark_metadatas:
            if dark.temperature is None:
                continue

            diff = abs(light_temp - dark.temperature)
            if diff < min_diff:
                min_diff = diff
                best_match = dark

        return best_match, min_diff

    def match_all_lights_to_darks(
        self,
        all_metadatas: List[FITSMetadata],
    ) -> List[TemperatureMatchResult]:
        """将所有光场文件匹配到暗场文件。

        Args:
            all_metadatas: 所有文件的元数据列表

        Returns:
            温度匹配结果列表
        """
        # 分离光场和暗场
        lights = [m for m in all_metadatas if m.file_type == FileType.LIGHT]
        darks = [m for m in all_metadatas if m.file_type == FileType.DARK]

        results = []
        for light in lights:
            best_dark, diff = self.find_best_dark_match(light, darks)

            is_match = diff <= self.tolerance if best_dark else False

            result = TemperatureMatchResult(
                light_file=light.file_name,
                dark_file=best_dark.file_name if best_dark else None,
                temperature_diff=diff,
                is_match=is_match,
                details={
                    "light_temp": light.temperature,
                    "dark_temp": best_dark.temperature if best_dark else None,
                    "tolerance": self.tolerance,
                    "filter": light.filter_name,
                    "exposure": light.exposure_time,
                },
            )
            results.append(result)

        return results

    def check_dark_temperature_consistency(
        self,
        dark_metadatas: List[FITSMetadata],
    ) -> Dict[str, Any]:
        """检查暗场文件的温度一致性。

        Args:
            dark_metadatas: 暗场文件元数据列表

        Returns:
            一致性检查结果字典
        """
        if not dark_metadatas:
            return {
                "total": 0,
                "has_temperature": 0,
                "consistent": True,
                "message": "没有暗场文件",
            }

        temps = [m.temperature for m in dark_metadatas if m.temperature is not None]

        if not temps:
            return {
                "total": len(dark_metadatas),
                "has_temperature": 0,
                "consistent": False,
                "message": "所有暗场文件都缺少温度信息",
                "details": {},
            }

        min_temp = min(temps)
        max_temp = max(temps)
        mean_temp = np.mean(temps)
        std_temp = np.std(temps)
        temp_range = max_temp - min_temp

        # 检查是否一致（所有温度在容差范围内）
        consistent = temp_range <= self.tolerance

        # 分组温度
        temp_groups = defaultdict(list)
        for m in dark_metadatas:
            if m.temperature is not None:
                # 按容差分组
                group_key = round(m.temperature / self.tolerance) * self.tolerance
                temp_groups[group_key].append(m)

        # 识别异常值
        outliers = []
        if len(temps) >= 3:
            # 使用IQR方法检测异常值
            q1 = np.percentile(temps, 25)
            q3 = np.percentile(temps, 75)
            iqr = q3 - q1
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr

            for m in dark_metadatas:
                if m.temperature is not None:
                    if m.temperature < lower_bound or m.temperature > upper_bound:
                        outliers.append({
                            "file": m.file_name,
                            "temperature": m.temperature,
                            "lower_bound": lower_bound,
                            "upper_bound": upper_bound,
                        })

        message = "暗场温度一致" if consistent else f"暗场温度不一致，范围: {min_temp:.2f} 到 {max_temp:.2f}°C"

        return {
            "total": len(dark_metadatas),
            "has_temperature": len(temps),
            "min_temperature": min_temp,
            "max_temperature": max_temp,
            "mean_temperature": float(mean_temp),
            "std_temperature": float(std_temp),
            "temperature_range": temp_range,
            "tolerance": self.tolerance,
            "consistent": consistent,
            "temperature_groups": {
                float(k): [m.file_name for m in v]
                for k, v in temp_groups.items()
            },
            "outliers": outliers,
            "message": message,
        }

    def get_temperature_statistics(
        self,
        metadatas: List[FITSMetadata],
    ) -> Dict[str, Dict[str, Any]]:
        """获取各类型文件的温度统计。

        Args:
            metadatas: 文件元数据列表

        Returns:
            按文件类型分组的温度统计
        """
        by_type: Dict[FileType, List[float]] = defaultdict(list)

        for m in metadatas:
            if m.temperature is not None:
                by_type[m.file_type].append(m.temperature)

        stats = {}
        for file_type, temps in by_type.items():
            if temps:
                stats[file_type.value] = {
                    "count": len(temps),
                    "min": float(min(temps)),
                    "max": float(max(temps)),
                    "mean": float(np.mean(temps)),
                    "median": float(np.median(temps)),
                    "std": float(np.std(temps)),
                    "range": float(max(temps) - min(temps)),
                }

        return stats

    def flag_temperature_issues(
        self,
        metadatas: List[FITSMetadata],
    ) -> List[Dict[str, Any]]:
        """标记存在温度问题的文件。

        Args:
            metadatas: 文件元数据列表

        Returns:
            问题文件列表
        """
        issues = []

        # 检查暗场一致性
        darks = [m for m in metadatas if m.file_type == FileType.DARK]
        dark_check = self.check_dark_temperature_consistency(darks)

        if not dark_check["consistent"]:
            # 标记与组温度差异大的暗场
            for dark in darks:
                if dark.temperature is None:
                    issues.append({
                        "file": dark.file_name,
                        "issue_type": "missing_temperature",
                        "severity": "warning",
                        "message": "暗场文件缺少温度信息",
                    })
                else:
                    # 检查是否与平均温度差异过大
                    if abs(dark.temperature - dark_check["mean_temperature"]) > self.tolerance:
                        issues.append({
                            "file": dark.file_name,
                            "issue_type": "temperature_mismatch",
                            "severity": "error",
                            "message": f"温度与暗场组平均差异过大: {dark.temperature:.2f}°C vs {dark_check['mean_temperature']:.2f}°C",
                            "details": {
                                "file_temp": dark.temperature,
                                "group_mean": dark_check["mean_temperature"],
                                "tolerance": self.tolerance,
                            },
                        })

        # 检查光场与暗场的匹配
        lights = [m for m in metadatas if m.file_type == FileType.LIGHT]
        for light in lights:
            if light.temperature is None:
                issues.append({
                    "file": light.file_name,
                    "issue_type": "missing_temperature",
                    "severity": "warning",
                    "message": "光场文件缺少温度信息，无法匹配暗场",
                })
                continue

            best_dark, diff = self.find_best_dark_match(light, darks)
            if best_dark is None:
                issues.append({
                    "file": light.file_name,
                    "issue_type": "no_matching_dark",
                    "severity": "error",
                    "message": "没有可用的暗场文件",
                    "details": {"light_temp": light.temperature},
                })
            elif diff > self.tolerance:
                issues.append({
                    "file": light.file_name,
                    "issue_type": "dark_temperature_mismatch",
                    "severity": "warning",
                    "message": f"最佳匹配暗场温度差异: {diff:.2f}°C，超过容差 {self.tolerance}°C",
                    "details": {
                        "light_temp": light.temperature,
                        "best_dark_temp": best_dark.temperature,
                        "difference": diff,
                        "tolerance": self.tolerance,
                    },
                })

        return issues
