"""
工具函数
"""
import json
from typing import Any, Optional, List, Dict, Tuple
from datetime import datetime, date
import pandas as pd
import numpy as np


class NumpyJsonEncoder(json.JSONEncoder):
    """自定义JSON编码器，处理numpy类型"""
    def default(self, obj: Any) -> Any:
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, (np.int_, np.intc, np.intp, np.int8, np.int16, np.int32, np.int64,
                            np.uint8, np.uint16, np.uint32, np.uint64)):
            return int(obj)
        if isinstance(obj, (np.float_, np.float16, np.float32, np.float64)):
            return float(obj)
        if isinstance(obj, (np.bool_,)):
            return bool(obj)
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if pd.isna(obj):
            return None
        return super().default(obj)


def safe_json_dumps(data: Any, **kwargs: Any) -> str:
    """安全的JSON序列化，支持numpy类型"""
    kwargs.pop("cls", None)
    return json.dumps(data, cls=NumpyJsonEncoder, **kwargs)


def safe_json_dump(data: Any, fp: Any, **kwargs: Any) -> None:
    """安全的JSON序列化写入文件，支持numpy类型"""
    kwargs.pop("cls", None)
    json.dump(data, fp, cls=NumpyJsonEncoder, **kwargs)


def parse_datetime(value: Any) -> Optional[datetime]:
    """
    安全解析日期时间，支持多种格式
    """
    if value is None or pd.isna(value):
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value)
        except (ValueError, OSError):
            pass
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y/%m/%d",
            "%Y%m%d%H%M%S",
            "%Y%m%d",
            "%m/%d/%Y %H:%M:%S",
            "%m/%d/%Y",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        try:
            return pd.to_datetime(value).to_pydatetime()
        except (ValueError, TypeError):
            pass
    return None


def parse_float(value: Any, default: float = 0.0) -> float:
    """安全解析浮点数"""
    if value is None or pd.isna(value):
        return default
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        value = value.strip().replace("%", "")
        if not value:
            return default
        try:
            return float(value) / 100 if "%" in str(value) else float(value)
        except ValueError:
            return default
    return default


def parse_int(value: Any, default: int = 0) -> int:
    """安全解析整数"""
    if value is None or pd.isna(value):
        return default
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value) if value.is_integer() else default
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return default
        try:
            return int(value)
        except ValueError:
            try:
                return int(float(value))
            except ValueError:
                return default
    return default


def parse_bool(value: Any, default: bool = True) -> bool:
    """安全解析布尔值"""
    if value is None or pd.isna(value):
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        value = value.strip().lower()
        if value in ("true", "1", "yes", "是", "启用", "有效"):
            return True
        if value in ("false", "0", "no", "否", "禁用", "无效"):
            return False
    return default


def safe_str(value: Any, default: str = "") -> str:
    """安全转换为字符串"""
    if value is None or pd.isna(value):
        return default
    return str(value).strip()


def normalize_probability(probabilities: List[float]) -> List[float]:
    """
    归一化概率列表，确保和为1
    返回归一化后的概率列表
    """
    total = sum(probabilities)
    if total <= 0:
        raise ValueError("概率总和必须大于0")
    return [p / total for p in probabilities]


def check_probability_normalization(
    probabilities: List[float],
    tolerance: float = 1e-6
) -> Tuple[bool, float]:
    """
    检查概率是否归一化
    返回 (是否归一化, 总和与1的差值)
    """
    total = sum(probabilities)
    diff = abs(total - 1.0)
    return diff <= tolerance, diff


def calculate_confidence_interval(
    success: int,
    trials: int,
    confidence_level: float = 0.95
) -> Tuple[float, float, float]:
    """
    计算二项分布的置信区间（Wilson score interval）
    返回 (概率, 下界, 上界)
    """
    from scipy import stats

    if trials <= 0:
        return 0.0, 0.0, 0.0

    p_hat = success / trials
    alpha = 1 - confidence_level
    z = stats.norm.ppf(1 - alpha / 2)

    denominator = 1 + z**2 / trials
    center = (p_hat + z**2 / (2 * trials)) / denominator
    margin = z * np.sqrt(
        (p_hat * (1 - p_hat) + z**2 / (4 * trials)) / trials
    ) / denominator

    lower = max(0.0, center - margin)
    upper = min(1.0, center + margin)

    return p_hat, lower, upper


def chi_square_test(
    observed_counts: List[int],
    expected_probs: List[float],
    significance_level: float = 0.05
) -> Dict[str, Any]:
    """
    卡方检验，比较观测分布和期望分布
    返回检验结果字典
    """
    from scipy import stats

    total = sum(observed_counts)
    if total <= 0:
        return {
            "chi2_statistic": 0.0,
            "p_value": 1.0,
            "degrees_of_freedom": len(observed_counts) - 1,
            "significant": False,
            "total_trials": 0,
            "expected_counts": [0.0] * len(observed_counts),
        }

    expected_counts = [p * total for p in expected_probs]

    min_expected = min(expected_counts)
    if min_expected < 5:
        pass

    chi2, p_value = stats.chisquare(observed_counts, f_exp=expected_counts)

    return {
        "chi2_statistic": float(chi2),
        "p_value": float(p_value),
        "degrees_of_freedom": len(observed_counts) - 1,
        "significant": p_value < significance_level,
        "total_trials": total,
        "expected_counts": expected_counts,
        "min_expected_count": min_expected,
    }
