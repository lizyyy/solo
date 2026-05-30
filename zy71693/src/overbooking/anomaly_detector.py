"""异常检测与处理模块。

检测并处理超售优化过程中的各种异常情况：
- 爽约率误估（与历史偏差过大）
- 补偿漏算（补偿规则缺失或不完整）
- 舱位越界（超售超出合理范围）
- 数据不一致（跨表数据不匹配）
- 历史数据异常（突然波动）

处理策略：
- 自动标记并给出建议操作（退回、补材料、人工确认）
- 不强制自动修复，保留人工干预空间
- 异常记录随报告一起导出，业务同事可见
"""
from __future__ import annotations

import logging
import uuid
from typing import List, Dict, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta

import numpy as np

from .models import (
    FlightOrder, NoShowHistory, FlightInfo, Passenger,
    CompensateRule, CabinClass, DataIssue, OptimizationResult
)
from .probability_model import NoShowPrediction
from .data_loader import DataLoader

logger = logging.getLogger(__name__)


@dataclass
class AnomalyRecord:
    """异常记录 - 业务可见的异常信息。"""
    anomaly_id: str
    anomaly_type: str
    severity: str
    category: str
    description: str
    human_explanation: str
    affected_records: List[Dict[str, Any]]
    suggested_action: str
    action_options: List[str]
    detected_at: datetime
    resolved: bool = False
    resolution_notes: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "anomaly_id": self.anomaly_id,
            "anomaly_type": self.anomaly_type,
            "severity": self.severity,
            "category": self.category,
            "description": self.description,
            "human_explanation": self.human_explanation,
            "affected_records": self.affected_records,
            "suggested_action": self.suggested_action,
            "action_options": self.action_options,
            "detected_at": self.detected_at.isoformat(),
            "resolved": self.resolved,
            "resolution_notes": self.resolution_notes,
            "resolved_by": self.resolved_by,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None
        }


class AnomalyDetector:
    """异常检测器 - 扫描数据和计算过程中的各种异常。"""

    def __init__(self):
        self.anomalies: List[AnomalyRecord] = []
        self._config = {
            "no_show_deviation_threshold": 0.15,
            "min_historical_samples": 30,
            "max_no_show_rate": 0.4,
            "min_no_show_rate": 0.02,
            "max_overbooking_ratio": 0.20,
            "fare_deviation_threshold": 0.3,
            "days_back_for_trend": 90,
        }

    def _generate_anomaly_id(self) -> str:
        return f"anomaly_{uuid.uuid4().hex[:12]}"

    def _create_anomaly(
        self,
        anomaly_type: str,
        severity: str,
        category: str,
        description: str,
        human_explanation: str,
        affected_records: List[Dict[str, Any]],
        suggested_action: str,
        action_options: Optional[List[str]] = None
    ) -> AnomalyRecord:
        """创建异常记录。"""
        anomaly = AnomalyRecord(
            anomaly_id=self._generate_anomaly_id(),
            anomaly_type=anomaly_type,
            severity=severity,
            category=category,
            description=description,
            human_explanation=human_explanation,
            affected_records=affected_records,
            suggested_action=suggested_action,
            action_options=action_options or ["reject", "request_more_data", "manual_review", "accept_with_caution"],
            detected_at=datetime.now()
        )
        self.anomalies.append(anomaly)
        logger.warning(f"[{severity.upper()}] {category}: {description}")
        return anomaly

    def detect_no_show_misestimation(
        self,
        prediction: NoShowPrediction,
        no_show_histories: List[NoShowHistory],
        flight_info: FlightInfo
    ) -> List[AnomalyRecord]:
        """检测爽约率误估。

        检查：
        1. 预测值与历史均值偏差过大
        2. 样本量不足导致的估计不可靠
        3. 预测值异常高或异常低
        4. 近期趋势与预测不符
        """
        anomalies: List[AnomalyRecord] = []

        for cabin, pred_rate in prediction.cabin_level.items():
            cabin_histories = [h for h in no_show_histories
                              if hasattr(h, "cabin_class") and h.cabin_class == cabin]
            if not cabin_histories:
                cabin_histories = no_show_histories

            if cabin_histories:
                hist_rate = sum(1 for h in cabin_histories if h.was_no_show) / len(cabin_histories)
                deviation = abs(pred_rate - hist_rate)

                if deviation > self._config["no_show_deviation_threshold"]:
                    affected = [
                        {
                            "cabin": cabin.value,
                            "cabin_name": cabin.name,
                            "predicted_rate": float(pred_rate),
                            "historical_rate": float(hist_rate),
                            "deviation": float(deviation),
                            "historical_samples": len(cabin_histories)
                        }
                    ]
                    anomaly = self._create_anomaly(
                        anomaly_type="no_show_misestimation",
                        severity="warning" if deviation < 0.25 else "error",
                        category="概率模型",
                        description=f"{cabin.name}舱爽约率预测与历史均值偏差 {deviation:.1%}",
                        human_explanation=(
                            f"📊 {cabin.name}舱爽约率预测为 {pred_rate:.1%}，"
                            f"但历史 {len(cabin_histories)} 条记录的实际爽约率为 {hist_rate:.1%}，"
                            f"两者相差 {deviation:.1%}，超过了 {self._config['no_show_deviation_threshold']:.0%} 的警戒阈值。"
                            f"这可能是由于近期出行模式变化、节假日效应或数据样本偏差导致的。"
                        ),
                        affected_records=affected,
                        suggested_action="manual_review",
                        action_options=[
                            "manual_review",
                            "request_more_data",
                            "accept_with_caution",
                            "reject"
                        ]
                    )
                    anomalies.append(anomaly)

            sample_size = prediction.sample_size.get(cabin, 0)
            if sample_size < self._config["min_historical_samples"]:
                affected = [
                    {
                        "cabin": cabin.value,
                        "cabin_name": cabin.name,
                        "sample_size": sample_size,
                        "min_required": self._config["min_historical_samples"]
                    }
                ]
                anomaly = self._create_anomaly(
                    anomaly_type="no_show_misestimation",
                    severity="warning",
                    category="数据质量",
                    description=f"{cabin.name}舱历史样本量不足",
                    human_explanation=(
                        f"📉 {cabin.name}舱仅收集到 {sample_size} 条历史爽约记录，"
                        f"低于建议的最小样本量 {self._config['min_historical_samples']} 条。"
                        f"样本量不足可能导致爽约率预测不够稳定，建议补充更多历史数据或参考同类航线数据。"
                    ),
                    affected_records=affected,
                    suggested_action="request_more_data",
                    action_options=[
                        "request_more_data",
                        "accept_with_caution",
                        "manual_review"
                    ]
                )
                anomalies.append(anomaly)

            if pred_rate > self._config["max_no_show_rate"]:
                affected = [
                    {
                        "cabin": cabin.value,
                        "cabin_name": cabin.name,
                        "predicted_rate": float(pred_rate),
                        "max_allowed": self._config["max_no_show_rate"]
                    }
                ]
                anomaly = self._create_anomaly(
                    anomaly_type="no_show_misestimation",
                    severity="error",
                    category="概率模型",
                    description=f"{cabin.name}舱爽约率预测异常偏高",
                    human_explanation=(
                        f"⚠️ {cabin.name}舱爽约率预测高达 {pred_rate:.1%}，"
                        f"超过正常上限 {self._config['max_no_show_rate']:.0%}。"
                        f"如此高的爽约率在实际运营中非常罕见，请检查：1) 是否混入了特殊时期数据；"
                        f"2) 数据统计是否有误；3) 是否需要人工调整预测值。"
                    ),
                    affected_records=affected,
                    suggested_action="manual_review",
                    action_options=[
                        "manual_review",
                        "reject",
                        "accept_with_caution"
                    ]
                )
                anomalies.append(anomaly)

            elif pred_rate < self._config["min_no_show_rate"]:
                affected = [
                    {
                        "cabin": cabin.value,
                        "cabin_name": cabin.name,
                        "predicted_rate": float(pred_rate),
                        "min_allowed": self._config["min_no_show_rate"]
                    }
                ]
                anomaly = self._create_anomaly(
                    anomaly_type="no_show_misestimation",
                    severity="warning",
                    category="概率模型",
                    description=f"{cabin.name}舱爽约率预测异常偏低",
                    human_explanation=(
                        f"⚠️ {cabin.name}舱爽约率预测仅为 {pred_rate:.1%}，"
                        f"低于正常下限 {self._config['min_no_show_rate']:.0%}。"
                        f"请确认数据是否完整，是否包含了所有类型的旅客（包括散客、团体等）。"
                    ),
                    affected_records=affected,
                    suggested_action="manual_review",
                    action_options=[
                        "manual_review",
                        "accept_with_caution",
                        "reject"
                    ]
                )
                anomalies.append(anomaly)

            trend_anomaly = self._check_recent_trend(no_show_histories, cabin, pred_rate, flight_info)
            if trend_anomaly:
                anomalies.append(trend_anomaly)

        return anomalies

    def _check_recent_trend(
        self,
        histories: List[NoShowHistory],
        cabin: CabinClass,
        pred_rate: float,
        flight_info: FlightInfo
    ) -> Optional[AnomalyRecord]:
        """检查近期爽约率趋势是否与预测一致。"""
        cutoff_date = flight_info.flight_date - timedelta(days=self._config["days_back_for_trend"])

        recent = [h for h in histories if h.flight_date >= cutoff_date]
        older = [h for h in histories if h.flight_date < cutoff_date]

        if len(recent) < 10 or len(older) < 10:
            return None

        recent_rate = sum(1 for h in recent if h.was_no_show) / len(recent)
        older_rate = sum(1 for h in older if h.was_no_show) / len(older)
        trend_diff = recent_rate - older_rate

        if abs(trend_diff) > 0.08:
            direction = "上升" if trend_diff > 0 else "下降"
            affected = [
                {
                    "cabin": cabin.value,
                    "cabin_name": cabin.name,
                    "recent_rate": float(recent_rate),
                    "older_rate": float(older_rate),
                    "trend_difference": float(trend_diff),
                    "predicted_rate": float(pred_rate),
                    "recent_samples": len(recent),
                    "older_samples": len(older)
                }
            ]
            return self._create_anomaly(
                anomaly_type="no_show_misestimation",
                severity="warning",
                category="趋势分析",
                description=f"{cabin.name}舱近期爽约率{direction}趋势明显",
                human_explanation=(
                    f"📈 {cabin.name}舱近期（{self._config['days_back_for_trend']}天内）爽约率为 {recent_rate:.1%}，"
                    f"较前期 {older_rate:.1%} {direction}了 {abs(trend_diff):.1%}。"
                    f"当前预测值为 {pred_rate:.1%}，{'偏高' if pred_rate > recent_rate else '偏低'}于近期实际值。"
                    f"建议关注趋势变化原因，如是否受季节、航线竞争或宏观因素影响。"
                ),
                affected_records=affected,
                suggested_action="manual_review",
                action_options=[
                    "manual_review",
                    "accept_with_caution",
                    "request_more_data"
                ]
            )

        return None

    def detect_compensation_missing(
        self,
        compensation_rules: List[CompensateRule],
        flight_info: FlightInfo,
        hours_before_flight: Optional[float] = None
    ) -> List[AnomalyRecord]:
        """检测补偿规则缺失。

        检查：
        1. 是否所有舱位都有补偿规则
        2. 关键时间段是否有规则覆盖
        3. 补偿金额是否合理
        """
        anomalies: List[AnomalyRecord] = []
        existing_cabins = {r.cabin_class for r in compensation_rules}

        for cabin in flight_info.capacity.keys():
            if cabin not in existing_cabins:
                affected = [
                    {
                        "cabin": cabin.value,
                        "cabin_name": cabin.name,
                        "capacity": flight_info.capacity.get(cabin, 0)
                    }
                ]
                anomaly = self._create_anomaly(
                    anomaly_type="compensation_missing",
                    severity="error",
                    category="补偿规则",
                    description=f"{cabin.name}舱缺失补偿规则",
                    human_explanation=(
                        f"❌ {cabin.name}舱（容量 {flight_info.capacity.get(cabin, 0)} 座）没有配置补偿规则。"
                        f"系统将使用默认补偿金额进行估算，但实际补偿可能与预期有较大偏差。"
                        f"请立即补充该舱位的补偿规则后再执行优化。"
                    ),
                    affected_records=affected,
                    suggested_action="request_more_data",
                    action_options=[
                        "request_more_data",
                        "accept_with_caution",
                        "reject"
                    ]
                )
                anomalies.append(anomaly)

        critical_thresholds = [0, 2, 6, 24, 72]
        if hours_before_flight is not None:
            for cabin in existing_cabins:
                cabin_rules = [r for r in compensation_rules if r.cabin_class == cabin]
                cabin_rules.sort(key=lambda r: r.threshold_hours)

                covered = False
                for rule in cabin_rules:
                    if hours_before_flight <= rule.threshold_hours:
                        covered = True
                        break

                if not covered and cabin_rules:
                    largest_threshold = cabin_rules[-1].threshold_hours
                    affected = [
                        {
                            "cabin": cabin.value,
                            "cabin_name": cabin.name,
                            "hours_before_flight": round(hours_before_flight, 1),
                            "largest_rule_threshold": largest_threshold,
                            "used_rule": cabin_rules[-1].rule_id
                        }
                    ]
                    anomaly = self._create_anomaly(
                        anomaly_type="compensation_missing",
                        severity="warning",
                        category="补偿规则",
                        description=f"{cabin.name}舱距起飞{hours_before_flight:.0f}小时无精确补偿规则",
                        human_explanation=(
                            f"⏰ 当前距航班起飞还有 {hours_before_flight:.0f} 小时，"
                            f"但{cabin.name}舱最大的规则阈值为 {largest_threshold} 小时。"
                            f"系统将使用最远的规则（{cabin_rules[-1].rule_id}）估算补偿，"
                            f"如航班临近起飞可能需要更高的补偿成本，建议补充更精细的时间梯度规则。"
                        ),
                        affected_records=affected,
                        suggested_action="manual_review",
                        action_options=[
                            "manual_review",
                            "accept_with_caution",
                            "request_more_data"
                        ]
                    )
                    anomalies.append(anomaly)

        for cabin in existing_cabins:
            cabin_rules = [r for r in compensation_rules if r.cabin_class == cabin]
            for rule in cabin_rules:
                if rule.compensation_amount <= 0:
                    affected = [
                        {
                            "rule_id": rule.rule_id,
                            "cabin": cabin.value,
                            "cabin_name": cabin.name,
                            "threshold_hours": rule.threshold_hours,
                            "compensation_amount": rule.compensation_amount
                        }
                    ]
                    anomaly = self._create_anomaly(
                        anomaly_type="compensation_missing",
                        severity="warning",
                        category="补偿规则",
                        description=f"补偿规则 {rule.rule_id} 金额为0",
                        human_explanation=(
                            f"💰 补偿规则 {rule.rule_id}（{cabin.name}舱，起飞前{rule.threshold_hours}小时内）"
                            f"的现金补偿金额为0元。这可能是有意为之（仅提供代金券），也可能是配置错误。"
                            f"请确认该规则是否正确，避免实际补偿时出现纠纷。"
                        ),
                        affected_records=affected,
                        suggested_action="manual_review",
                        action_options=[
                            "manual_review",
                            "accept_with_caution",
                            "reject"
                        ]
                    )
                    anomalies.append(anomaly)

        return anomalies

    def detect_cabin_boundary_violation(
        self,
        optimization_result: OptimizationResult,
        flight_info: FlightInfo,
        flight_orders: List[FlightOrder]
    ) -> List[AnomalyRecord]:
        """检测舱位越界（超售超出合理范围）。

        检查：
        1. 超售比例是否超过上限
        2. 超售是否考虑了已售座位
        3. 总售票数是否超出物理极限
        """
        anomalies: List[AnomalyRecord] = []

        for cabin, overbooking in optimization_result.optimal_overbooking.items():
            capacity = flight_info.capacity.get(cabin, 0)
            if capacity <= 0:
                continue

            cabin_orders = [o for o in flight_orders if o.cabin_class == cabin]
            booked = len(cabin_orders)
            total_sold = booked + overbooking
            ratio = overbooking / capacity if capacity > 0 else 0

            if ratio > self._config["max_overbooking_ratio"]:
                affected = [
                    {
                        "cabin": cabin.value,
                        "cabin_name": cabin.name,
                        "capacity": capacity,
                        "booked": booked,
                        "overbooking": overbooking,
                        "total_sold": total_sold,
                        "overbooking_ratio": float(ratio),
                        "max_allowed_ratio": self._config["max_overbooking_ratio"]
                    }
                ]
                anomaly = self._create_anomaly(
                    anomaly_type="cabin_boundary_violation",
                    severity="error",
                    category="舱位限制",
                    description=f"{cabin.name}舱超售比例 {ratio:.1%} 超过上限",
                    human_explanation=(
                        f"🚨 {cabin.name}舱容量 {capacity} 座，已售 {booked} 座，"
                        f"建议超售 {overbooking} 座，超售比例达 {ratio:.1%}，"
                        f"超过 {self._config['max_overbooking_ratio']:.0%} 的安全上限。"
                        f"这将导致极高的超售风险，可能引发大量旅客投诉和运营混乱。"
                        f"建议立即降低超售数量或寻找其他解决方案。"
                    ),
                    affected_records=affected,
                    suggested_action="reject",
                    action_options=[
                        "reject",
                        "manual_review",
                        "accept_with_caution"
                    ]
                )
                anomalies.append(anomaly)

            if total_sold > capacity * 1.25:
                affected = [
                    {
                        "cabin": cabin.value,
                        "cabin_name": cabin.name,
                        "capacity": capacity,
                        "total_sold": total_sold,
                        "load_factor": float(total_sold / capacity)
                    }
                ]
                anomaly = self._create_anomaly(
                    anomaly_type="cabin_boundary_violation",
                    severity="error",
                    category="舱位限制",
                    description=f"{cabin.name}舱总售票数超过容量的125%",
                    human_explanation=(
                        f"🎫 {cabin.name}舱总售票（含超售）达 {total_sold} 张，"
                        f"是实际容量 {capacity} 座的 {total_sold/capacity:.1%}。"
                        f"即使历史最高爽约率下，也几乎必然出现严重超售。"
                        f"请大幅减少超售数量或停止销售该舱位。"
                    ),
                    affected_records=affected,
                    suggested_action="reject",
                    action_options=[
                        "reject",
                        "manual_review"
                    ]
                )
                anomalies.append(anomaly)

            if booked >= capacity and overbooking > 0:
                affected = [
                    {
                        "cabin": cabin.value,
                        "cabin_name": cabin.name,
                        "capacity": capacity,
                        "booked": booked,
                        "overbooking": overbooking
                    }
                ]
                anomaly = self._create_anomaly(
                    anomaly_type="cabin_boundary_violation",
                    severity="warning",
                    category="舱位限制",
                    description=f"{cabin.name}舱已满舱仍建议超售",
                    human_explanation=(
                        f"⚠️ {cabin.name}舱已售出 {booked} 座（满舱 {capacity} 座），"
                        f"但系统仍建议超售 {overbooking} 座。"
                        f"这需要极高的爽约率才能消化，请特别关注该舱位的旅客动向，"
                        f"提前识别可能爽约的旅客，并做好应急方案。"
                    ),
                    affected_records=affected,
                    suggested_action="manual_review",
                    action_options=[
                        "manual_review",
                        "accept_with_caution",
                        "reject"
                    ]
                )
                anomalies.append(anomaly)

        return anomalies

    def detect_data_quality_issues(
        self,
        data_issues: List[DataIssue],
        flight_info: FlightInfo
    ) -> List[AnomalyRecord]:
        """将数据加载阶段的问题转换为业务可见的异常记录。"""
        anomalies: List[AnomalyRecord] = []

        severity_map = {
            "info": "low",
            "warning": "warning",
            "error": "error",
            "critical": "error"
        }

        type_category_map = {
            "duplicate": "数据质量",
            "missing_field": "数据质量",
            "date_format": "数据质量",
            "name_conflict": "数据质量",
            "late_arrival": "数据质量",
            "cabin_mismatch": "数据质量",
            "no_show_misestimation": "概率模型",
            "compensation_missing": "补偿规则"
        }

        human_template = {
            "duplicate": "发现重复记录：{desc}。请确认哪条是准确数据，避免统计偏差。",
            "missing_field": "数据字段缺失：{desc}。缺失字段可能影响计算准确性，请补全数据。",
            "date_format": "日期格式问题：{desc}。不统一的日期格式已尝试自动解析，但建议源头修正。",
            "name_conflict": "同名旅客问题：{desc}。缺少身份信息区分同名旅客，可能影响个人爽约率预测。",
            "late_arrival": "数据延迟：{desc}。附件数据尚未完全到达，结果可能不完整。",
            "cabin_mismatch": "舱位不匹配：{desc}。无法识别的舱位代码已默认处理，请确认。",
            "no_show_misestimation": "爽约率估计问题：{desc}。预测结果可能不可靠，请人工复核。",
            "compensation_missing": "补偿规则问题：{desc}。补偿计算可能不准确。"
        }

        for issue in data_issues:
            if issue.resolved:
                continue

            template = human_template.get(
                issue.issue_type, "数据问题：{desc}。"
            )
            human_exp = template.format(desc=issue.description)

            action_map = {
                "accept": ["accept_with_caution"],
                "reject": ["reject"],
                "manual_review": ["manual_review", "accept_with_caution", "reject"],
                "request_more_data": ["request_more_data", "accept_with_caution", "manual_review"]
            }

            anomaly = self._create_anomaly(
                anomaly_type=issue.issue_type,
                severity=severity_map.get(issue.severity, "warning"),
                category=type_category_map.get(issue.issue_type, "数据质量"),
                description=issue.description,
                human_explanation=human_exp,
                affected_records=issue.affected_records,
                suggested_action=issue.suggested_action,
                action_options=action_map.get(issue.suggested_action, ["manual_review"])
            )
            anomalies.append(anomaly)

        return anomalies

    def detect_all_anomalies(
        self,
        prediction: NoShowPrediction,
        no_show_histories: List[NoShowHistory],
        compensation_rules: List[CompensateRule],
        optimization_result: OptimizationResult,
        flight_info: FlightInfo,
        flight_orders: List[FlightOrder],
        data_issues: Optional[List[DataIssue]] = None,
        hours_before_flight: Optional[float] = None
    ) -> List[AnomalyRecord]:
        """执行所有异常检测。"""
        logger.info("开始全量异常检测...")
        self.anomalies.clear()

        self.detect_no_show_misestimation(prediction, no_show_histories, flight_info)
        self.detect_compensation_missing(compensation_rules, flight_info, hours_before_flight)
        self.detect_cabin_boundary_violation(optimization_result, flight_info, flight_orders)

        if data_issues:
            self.detect_data_quality_issues(data_issues, flight_info)

        logger.info(f"异常检测完成，共发现 {len(self.anomalies)} 条异常记录")
        return self.anomalies

    def get_anomalies_for_report(self) -> List[Dict[str, Any]]:
        """获取用于报告的异常记录（字典格式）。"""
        return [a.to_dict() for a in self.anomalies]

    def summarize_anomalies(self) -> Dict[str, int]:
        """按类型和严重程度汇总异常。"""
        summary = {
            "total": len(self.anomalies),
            "by_severity": {"low": 0, "warning": 0, "error": 0},
            "by_category": {},
            "by_type": {}
        }

        for a in self.anomalies:
            summary["by_severity"][a.severity] = summary["by_severity"].get(a.severity, 0) + 1
            summary["by_category"][a.category] = summary["by_category"].get(a.category, 0) + 1
            summary["by_type"][a.anomaly_type] = summary["by_type"].get(a.anomaly_type, 0) + 1

        return summary

    def resolve_anomaly(
        self,
        anomaly_id: str,
        action: str,
        notes: str,
        resolved_by: str
    ) -> bool:
        """标记异常为已处理。"""
        for anomaly in self.anomalies:
            if anomaly.anomaly_id == anomaly_id:
                anomaly.resolved = True
                anomaly.resolution_notes = notes
                anomaly.resolved_by = resolved_by
                anomaly.resolved_at = datetime.now()
                logger.info(f"异常 {anomaly_id} 已处理: {action} - {notes}")
                return True
        return False
