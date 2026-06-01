"""验证模块 - 边界阈值检查、权重闭合检查"""

from typing import Dict, List, Tuple
from dataclasses import dataclass


@dataclass
class ValidationResult:
    """验证结果"""
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    alerts: List[str]


class Validator:
    """验证器 - 检查权重闭合、边界阈值"""

    def __init__(self, params: Dict):
        self.params = params
        self.boundaries = params.get("boundaries", {})
        self.weights = params.get("weights", {})

    def validate_weights(self, weight_key: str = "main") -> ValidationResult:
        """
        验证权重是否闭合（总和应为1.0或100）

        Args:
            weight_key: 权重配置键名

        Returns:
            ValidationResult
        """
        errors = []
        warnings = []
        alerts = []

        weights_config = self.weights.get(weight_key, {})
        if not weights_config:
            errors.append(f"[权重错误] 未找到权重配置 '{weight_key}'")
            return ValidationResult(False, errors, warnings, alerts)

        weight_sum = sum(v for v in weights_config.values() if isinstance(v, (int, float)))

        # 检查闭合性
        if abs(weight_sum - 1.0) < 0.001:
            alerts.append(f"[权重闭合] {weight_key} 权重总和={weight_sum:.4f}，符合小数比例模式")
        elif abs(weight_sum - 100.0) < 0.1:
            alerts.append(f"[权重闭合] {weight_key} 权重总和={weight_sum:.4f}，符合百分比模式")
        else:
            warnings.append(
                f"[权重警告] {weight_key} 权重总和={weight_sum:.4f}，"
                f"既不等于1.0也不等于100，可能存在配置遗漏"
            )
            warnings.append(
                f"  权重明细: {', '.join([f'{k}={v}' for k, v in weights_config.items()])}"
            )

        # 检查负值
        negative_weights = [(k, v) for k, v in weights_config.items() if v < 0]
        if negative_weights:
            errors.append(
                f"[权重错误] 存在负权重: {', '.join([f'{k}={v}' for k, v in negative_weights])}"
            )

        return ValidationResult(len(errors) == 0, errors, warnings, alerts)

    def validate_boundaries(
        self,
        field_name: str,
        value: float,
        record_id: str = "",
        context: str = "",
    ) -> ValidationResult:
        """
        验证单字段边界阈值

        Args:
            field_name: 字段名
            value: 字段值
            record_id: 记录ID
            context: 上下文说明

        Returns:
            ValidationResult
        """
        errors = []
        warnings = []
        alerts = []

        field_config = self.boundaries.get(field_name)
        if not field_config:
            warnings.append(
                f"[边界提醒] 字段 '{field_name}' 未配置边界规则，跳过检查"
            )
            return ValidationResult(True, errors, warnings, alerts)

        min_val = field_config.get("min")
        max_val = field_config.get("max")
        soft_min = field_config.get("soft_min")
        soft_max = field_config.get("soft_max")
        unit = field_config.get("unit", "")

        prefix = f"记录{record_id}" if record_id else ""
        if context:
            prefix = f"{prefix}[{context}]" if prefix else f"[{context}]"

        # 硬边界检查
        if min_val is not None and value < min_val:
            errors.append(
                f"[边界越界] {prefix}: {field_name}={value}{unit} < 下限 {min_val}{unit}"
            )

        if max_val is not None and value > max_val:
            errors.append(
                f"[边界越界] {prefix}: {field_name}={value}{unit} > 上限 {max_val}{unit}"
            )

        # 软边界检查（警告）
        if soft_min is not None and value < soft_min and (min_val is None or value >= min_val):
            warnings.append(
                f"[边界警告] {prefix}: {field_name}={value}{unit} 低于软下限 {soft_min}{unit}，"
                f"需人工确认"
            )

        if soft_max is not None and value > soft_max and (max_val is None or value <= max_val):
            warnings.append(
                f"[边界警告] {prefix}: {field_name}={value}{unit} 高于软上限 {soft_max}{unit}，"
                f"需人工确认"
            )

        # 正常范围提醒
        if not errors and not warnings:
            range_str = f"[{min_val}, {max_val}]" if min_val is not None and max_val is not None else "已配置"
            alerts.append(
                f"[边界正常] {prefix}: {field_name}={value}{unit} 在允许范围 {range_str} 内"
            )

        return ValidationResult(len(errors) == 0, errors, warnings, alerts)

    def validate_record(self, record: Dict, record_id: str = "") -> ValidationResult:
        """
        验证单条记录的所有字段边界

        Args:
            record: 记录数据
            record_id: 记录ID

        Returns:
            ValidationResult
        """
        all_errors = []
        all_warnings = []
        all_alerts = []

        for field_name, value in record.items():
            if field_name in self.boundaries and isinstance(value, (int, float)):
                result = self.validate_boundaries(field_name, value, record_id)
                all_errors.extend(result.errors)
                all_warnings.extend(result.warnings)
                all_alerts.extend(result.alerts)

        return ValidationResult(
            len(all_errors) == 0, all_errors, all_warnings, all_alerts
        )

    def validate_progress_score(
        self, score: float, prev_score: float, record_id: str = ""
    ) -> ValidationResult:
        """
        验证进步分数的合理性（环比波动检查）

        Args:
            score: 当前分数
            prev_score: 上一期分数
            record_id: 记录ID

        Returns:
            ValidationResult
        """
        errors = []
        warnings = []
        alerts = []

        if prev_score is None:
            alerts.append(f"[进步验证] 记录{record_id}: 无上期数据，跳过波动检查")
            return ValidationResult(True, errors, warnings, alerts)

        change_pct = ((score - prev_score) / prev_score) * 100 if prev_score != 0 else 0

        # 从参数获取波动阈值
        fluctuation = self.params.get("analysis", {}).get("max_fluctuation_pct", 30)

        if abs(change_pct) > fluctuation:
            direction = "上升" if change_pct > 0 else "下降"
            warnings.append(
                f"[波动警告] 记录{record_id}: 进步分数环比{direction} {abs(change_pct):.1f}%，"
                f"超过阈值 {fluctuation}%，建议人工复核"
            )
            warnings.append(
                f"  上期: {prev_score:.2f} → 本期: {score:.2f}, "
                f"变化量: {score - prev_score:+.2f}"
            )
        else:
            alerts.append(
                f"[波动正常] 记录{record_id}: 环比变化 {change_pct:+.1f}%，在合理范围内"
            )

        return ValidationResult(True, errors, warnings, alerts)
