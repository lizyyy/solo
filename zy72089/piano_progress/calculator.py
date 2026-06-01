"""核心计算模块 - 进步曲线计算逻辑"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
import math

from .converter import UnitConverter
from .validator import Validator, ValidationResult
from .tracer import DataTracer


@dataclass
class ProgressScore:
    """进步分数"""
    record_id: str
    date: str
    total_score: float
    component_scores: Dict[str, float]
    raw_values: Dict[str, float]
    validation: ValidationResult
    alerts: List[str] = field(default_factory=list)
    need_manual_confirm: bool = False
    confirm_reason: Optional[str] = None
    source_type: str = "calculated"
    trace_id: Optional[str] = None


class ProgressCalculator:
    """进步曲线计算器"""

    def __init__(self, params: Dict, tracer: Optional[DataTracer] = None):
        self.params = params
        self.weights = params.get("weights", {}).get("main", {})
        self.norm_params = params.get("normalization", {})
        self.validator = Validator(params)
        self.tracer = tracer or DataTracer()
        self.converter = UnitConverter()

        # 验证权重配置
        self._weight_validation = self.validator.validate_weights("main")

    def _normalize(
        self,
        field_name: str,
        value: float,
        record_id: str = "",
    ) -> Tuple[float, List[str]]:
        """
        将原始值归一化到0-100分

        Args:
            field_name: 字段名
            value: 原始值
            record_id: 记录ID

        Returns:
            (归一化分数, 提醒信息)
        """
        alerts = []

        field_config = self.norm_params.get(field_name)
        if not field_config:
            alerts.append(
                f"[归一化提醒] 记录{record_id}: 字段 '{field_name}' 未配置归一化规则，使用原值"
            )
            return value, alerts

        method = field_config.get("method", "linear")
        min_val = field_config.get("min", 0)
        max_val = field_config.get("max", 100)
        inverse = field_config.get("inverse", False)

        # 范围保护
        if value < min_val:
            alerts.append(
                f"[归一化提醒] 记录{record_id}: {field_name}={value} 低于参考下限 {min_val}，已截断"
            )
            value = min_val
        elif value > max_val:
            alerts.append(
                f"[归一化提醒] 记录{record_id}: {field_name}={value} 高于参考上限 {max_val}，已截断"
            )
            value = max_val

        if method == "linear":
            # 线性归一化
            normalized = ((value - min_val) / (max_val - min_val)) * 100
            if inverse:
                normalized = 100 - normalized
        elif method == "log":
            # 对数归一化
            if min_val <= 0:
                adjusted_min = 0.1
            else:
                adjusted_min = min_val
            normalized = (
                (math.log(value + 1) - math.log(adjusted_min + 1))
                / (math.log(max_val + 1) - math.log(adjusted_min + 1))
            ) * 100
            if inverse:
                normalized = 100 - normalized
        else:
            alerts.append(
                f"[归一化提醒] 记录{record_id}: 未知归一化方法 '{method}'，使用线性"
            )
            normalized = ((value - min_val) / (max_val - min_val)) * 100

        # 确保在0-100范围内
        normalized = max(0, min(100, normalized))

        alerts.append(
            f"[归一化] 记录{record_id}: {field_name} 原始值={value:.2f} → 归一化={normalized:.2f}分 "
            f"(方法:{method}, 范围:[{min_val}, {max_val}]{', 反向' if inverse else ''})"
        )

        return normalized, alerts

    def _predict_next(
        self,
        history_scores: List[ProgressScore],
        lookback_days: int = 7,
    ) -> Tuple[float, Dict]:
        """
        预测下一期进步分数

        Args:
            history_scores: 历史分数列表
            lookback_days: 回看天数

        Returns:
            (预测分数, 预测详情)
        """
        if len(history_scores) < 2:
            return 0.0, {"reason": "历史数据不足（至少需要2条）", "method": "无"}

        # 取最近N条
        recent = history_scores[-lookback_days:]

        # 简单移动平均趋势预测
        values = [s.total_score for s in recent]
        avg = sum(values) / len(values)

        # 计算趋势
        if len(values) >= 3:
            # 线性回归斜率
            n = len(values)
            x_sum = sum(range(n))
            y_sum = sum(values)
            xy_sum = sum(i * v for i, v in enumerate(values))
            x2_sum = sum(i * i for i in range(n))

            if n * x2_sum - x_sum * x_sum != 0:
                slope = (n * xy_sum - x_sum * y_sum) / (n * x2_sum - x_sum * x_sum)
                intercept = (y_sum - slope * x_sum) / n

                # 预测下一个值
                predicted = intercept + slope * n

                method = "线性回归趋势预测"
                details = {
                    "method": method,
                    "average": avg,
                    "slope": slope,
                    "intercept": intercept,
                    "trend": "上升" if slope > 0.5 else "下降" if slope < -0.5 else "平稳",
                    "lookback_days": n,
                }
            else:
                predicted = avg
                method = "简单移动平均"
                details = {
                    "method": method,
                    "average": avg,
                    "lookback_days": n,
                }
        else:
            predicted = avg
            method = "简单移动平均"
            details = {
                "method": method,
                "average": avg,
                "lookback_days": len(values),
            }

        # 边界限制
        predicted = max(0, min(100, predicted))

        return predicted, details

    def calculate_record(
        self,
        record: Dict,
        record_id: str,
        source_file: str,
        prev_score: Optional[ProgressScore] = None,
    ) -> ProgressScore:
        """
        计算单条记录的进步分数

        Args:
            record: 记录数据
            record_id: 记录ID
            source_file: 来源文件
            prev_score: 上一期分数（用于波动检查）

        Returns:
            ProgressScore
        """
        all_alerts = []
        component_scores = {}
        raw_values = {}

        # 1. 单位换算
        converted_record = {}
        for field_name, value in record.items():
            if field_name == "date":
                converted_record[field_name] = value
                continue

            field_config = self.params.get("fields", {}).get(field_name, {})
            unit = field_config.get("unit")
            scale = field_config.get("scale")

            if unit == "duration" and isinstance(value, dict):
                converted, alerts = self.converter.convert_duration(
                    value.get("value", 0),
                    value.get("unit", "minutes"),
                    "minutes",
                    record_id,
                )
                all_alerts.extend(alerts)
                converted_record[field_name] = converted
            elif scale and isinstance(value, (str, int, float)):
                converted, alerts = self.converter.convert_difficulty(
                    value, scale, "1-10", record_id
                )
                all_alerts.extend(alerts)
                converted_record[field_name] = converted
            else:
                converted_record[field_name] = value

        # 2. 边界验证
        validation = self.validator.validate_record(converted_record, record_id)
        all_alerts.extend(validation.alerts)
        all_alerts.extend(validation.warnings)
        all_alerts.extend(validation.errors)

        # 3. 归一化
        normalized_scores = {}
        for field_name, value in converted_record.items():
            if field_name == "date" or not isinstance(value, (int, float)):
                continue

            if field_name in self.weights:
                raw_values[field_name] = value
                normalized, alerts = self._normalize(field_name, value, record_id)
                all_alerts.extend(alerts)
                normalized_scores[field_name] = normalized

        # 4. 加权计算总分
        total_score = 0.0
        weight_sum = 0.0

        for field_name, weight in self.weights.items():
            if field_name in normalized_scores:
                component_scores[field_name] = normalized_scores[field_name] * weight / 100
                total_score += component_scores[field_name]
                weight_sum += weight

        # 权重闭合提醒
        if abs(weight_sum - 100) > 0.1:
            all_alerts.append(
                f"[权重提醒] 记录{record_id}: 实际参与计算的权重总和={weight_sum:.2f}，"
                f"与配置的100相差 {abs(weight_sum - 100):.2f}"
            )

        # 5. 波动检查
        if prev_score is not None:
            fluct_result = self.validator.validate_progress_score(
                total_score, prev_score.total_score, record_id
            )
            all_alerts.extend(fluct_result.alerts)
            all_alerts.extend(fluct_result.warnings)
            validation.warnings.extend(fluct_result.warnings)

        # 6. 判断是否需要人工确认
        need_manual_confirm = len(validation.warnings) > 0
        confirm_reason = None
        if need_manual_confirm:
            reasons = [w for w in validation.warnings if "边界警告" in w or "波动警告" in w]
            if reasons:
                confirm_reason = "; ".join(reasons[:2])

        # 7. 创建追溯记录
        trace = self.tracer.create_trace(
            record_id=record_id,
            source_type=record.get("_source_type", "calculated"),
            source_file=source_file,
            original_value=record,
            converted_value={
                "total_score": total_score,
                "component_scores": component_scores,
            },
            conversion_rule="进步曲线加权计算",
            notes=all_alerts,
        )

        result = ProgressScore(
            record_id=record_id,
            date=record.get("date", ""),
            total_score=round(total_score, 2),
            component_scores={k: round(v, 2) for k, v in component_scores.items()},
            raw_values=raw_values,
            validation=validation,
            alerts=all_alerts,
            need_manual_confirm=need_manual_confirm,
            confirm_reason=confirm_reason,
            source_type=record.get("_source_type", "calculated"),
            trace_id=trace.trace_id,
        )

        return result

    def calculate_curve(
        self,
        records: List[Dict],
        source_file: str,
        include_prediction: bool = True,
    ) -> Tuple[List[ProgressScore], Dict]:
        """
        计算进步曲线（批量）

        Args:
            records: 记录列表
            source_file: 来源文件
            include_prediction: 是否包含预测

        Returns:
            (进步分数列表, 汇总信息)
        """
        scores = []
        prev_score = None

        # 按日期排序
        sorted_records = sorted(records, key=lambda r: r.get("date", ""))

        for i, record in enumerate(sorted_records):
            record_id = record.get("record_id", f"REC-{i+1:04d}")
            score = self.calculate_record(
                record,
                record_id,
                source_file,
                prev_score=prev_score,
            )
            scores.append(score)
            prev_score = score

        # 预测
        prediction = {}
        if include_prediction and len(scores) >= 2:
            pred_score, pred_details = self._predict_next(scores)
            prediction = {
                "next_predicted_score": round(pred_score, 2),
                "prediction_details": pred_details,
                "prediction_reason": self._explain_prediction(pred_details, scores),
            }

        summary = self._generate_summary(scores, prediction)

        return scores, {**summary, **prediction}

    def _explain_prediction(self, pred_details: Dict, history: List[ProgressScore]) -> str:
        """生成预测理由说明"""
        method = pred_details.get("method", "未知方法")
        trend = pred_details.get("trend", "")
        lookback = pred_details.get("lookback_days", 0)
        avg = pred_details.get("average", 0)

        if len(history) < 3:
            return (
                f"预测说明: 历史数据仅{len(history)}条，采用简单移动平均法。"
                f"基于最近{lookback}条记录的平均分{avg:.2f}预测下一期数值。"
                f"建议积累更多数据后使用线性回归预测以提高准确性。"
            )

        if method == "线性回归趋势预测":
            slope = pred_details.get("slope", 0)
            if trend == "上升":
                return (
                    f"预测说明: 采用{method}。基于最近{lookback}条记录分析，"
                    f"进步曲线呈{trend}趋势（斜率={slope:.3f}），"
                    f"因此预测下期分数将继续{trend}。"
                    f"近期平均分={avg:.2f}，若保持当前练习强度，预期可维持此趋势。"
                )
            elif trend == "下降":
                return (
                    f"预测说明: 采用{method}。基于最近{lookback}条记录分析，"
                    f"进步曲线呈{trend}趋势（斜率={slope:.3f}），"
                    f"建议关注近期练习效率或难度调整是否合理。"
                    f"近期平均分={avg:.2f}，如无干预，预期趋势将延续。"
                )
            else:
                return (
                    f"预测说明: 采用{method}。基于最近{lookback}条记录分析，"
                    f"进步曲线保持{trend}（斜率={slope:.3f}），"
                    f"近期平均分={avg:.2f}，预期将维持当前水平。"
                    f"可考虑适当提升练习难度以突破平台期。"
                )
        else:
            return (
                f"预测说明: 采用{method}。基于最近{lookback}条记录的"
                f"平均分{avg:.2f}预测下一期数值。"
            )

    def _generate_summary(
        self, scores: List[ProgressScore], prediction: Dict
    ) -> Dict:
        """生成汇总信息"""
        if not scores:
            return {
                "total_records": 0,
                "manual_confirm_count": 0,
                "outlier_count": 0,
                "weight_alerts": self._weight_validation.warnings,
                "avg_score": 0,
                "trend": "无数据",
            }

        values = [s.total_score for s in scores]
        avg_score = sum(values) / len(values)

        # 计算趋势
        if len(values) >= 2:
            first_half = values[: len(values) // 2]
            second_half = values[len(values) // 2 :]
            first_avg = sum(first_half) / len(first_half)
            second_avg = sum(second_half) / len(second_half)
            if second_avg - first_avg > 2:
                trend = "上升"
            elif first_avg - second_avg > 2:
                trend = "下降"
            else:
                trend = "平稳"
        else:
            trend = "数据不足"

        manual_confirm_count = sum(1 for s in scores if s.need_manual_confirm)
        outlier_count = sum(1 for s in scores if not s.validation.is_valid)

        return {
            "total_records": len(scores),
            "manual_confirm_count": manual_confirm_count,
            "outlier_count": outlier_count,
            "weight_alerts": self._weight_validation.warnings,
            "avg_score": round(avg_score, 2),
            "trend": trend,
            "date_range": {
                "start": scores[0].date,
                "end": scores[-1].date,
            },
        }
