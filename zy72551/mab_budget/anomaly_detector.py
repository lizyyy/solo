"""异常检测模块 - 核心是时间窗穿越检测"""
from datetime import datetime
from typing import List, Tuple, Optional
from .models import (
    RecallCandidate, ParamsConfig, AnomalySample,
    generate_id, current_timestamp
)


class AnomalyDetector:
    def __init__(self, params: Optional[ParamsConfig] = None):
        self.params = params

    def update_params(self, params: ParamsConfig):
        self.params = params

    def detect_all(self, candidates: List[RecallCandidate]) -> List[AnomalySample]:
        """对所有候选执行检测，返回异常样本列表"""
        anomalies = []
        for candidate in candidates:
            candidate_anomalies = self.detect_candidate(candidate)
            anomalies.extend(candidate_anomalies)
            if candidate_anomalies:
                candidate.is_anomaly = True
                candidate.anomaly_tags = list({a.anomaly_type for a in candidate_anomalies})
        return anomalies

    def detect_candidate(self, candidate: RecallCandidate) -> List[AnomalySample]:
        """检测单个候选的所有异常类型"""
        anomalies = []

        time_anomaly = self._detect_time_window_cross(candidate)
        if time_anomaly:
            anomalies.append(time_anomaly)

        ctr_anomaly = self._detect_ctr_outlier(candidate)
        if ctr_anomaly:
            anomalies.append(ctr_anomaly)

        budget_anomaly = self._detect_budget_overrun(candidate)
        if budget_anomaly:
            anomalies.append(budget_anomaly)

        return anomalies

    def _detect_time_window_cross(self, candidate: RecallCandidate) -> Optional[AnomalySample]:
        """检测时间窗穿越 - 这是导致效果虚高的关键原因"""
        if not candidate.time_window_start or not candidate.time_window_end:
            return None

        try:
            start = datetime.strptime(candidate.time_window_start, "%Y-%m-%d %H:%M:%S")
            end = datetime.strptime(candidate.time_window_end, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return None

        start_date = start.date()
        end_date = end.date()

        expected_hours = self.params.time_window_size_hours if self.params else 24
        actual_hours = (end - start).total_seconds() / 3600

        if start_date != end_date or abs(actual_hours - expected_hours) > 1:
            sample = AnomalySample(
                sample_id=generate_id("anom_"),
                candidate_id=candidate.candidate_id,
                candidate=candidate,
                detected_at=current_timestamp(),
                anomaly_type="time_window_cross",
                severity="high",
                reason_description=self._build_time_cross_reason(candidate, start, end, start_date, end_date, actual_hours, expected_hours),
                missing_materials=self._build_time_cross_missing_materials(),
                next_step_owner="实验平台负责人",
                next_step_action="复核时间窗口配置，确认是否为真实跨天活动",
                is_verified=False,
                params_snapshot=self.params.__dict__ if self.params else None
            )
            return sample
        return None

    def _build_time_cross_reason(self, candidate: RecallCandidate, start, end, start_date, end_date, actual_hours, expected_hours) -> str:
        reason_parts = [
            f"候选 [{candidate.candidate_id}] 策略 [{candidate.strategy_name}] 存在时间窗穿越问题：",
            f"时间范围：{candidate.time_window_start} ~ {candidate.time_window_end}",
        ]
        if start_date != end_date:
            reason_parts.append(f"- 时间窗口跨天：从 {start_date} 穿越到 {end_date}")
        if abs(actual_hours - expected_hours) > 1:
            reason_parts.append(f"- 窗口时长异常：实际 {actual_hours:.1f} 小时，预期 {expected_hours} 小时")
        reason_parts.append(f"当前CTR={candidate.ctr:.4f}，曝光={candidate.impression}，可能因时间窗穿越导致效果虚高，结论不可直接使用")
        return "\n".join(reason_parts)

    def _build_time_cross_missing_materials(self) -> List[str]:
        return [
            "该时间窗口对应的活动排期表",
            "数据上报的时间戳对齐记录",
            "是否存在手动补数据的操作记录",
            "同期其他策略是否也有类似穿越"
        ]

    def _detect_ctr_outlier(self, candidate: RecallCandidate) -> Optional[AnomalySample]:
        """检测CTR异常偏高"""
        if not self.params:
            return None
        threshold = None
        for rule in self.params.anomaly_detection_rules:
            if rule.get("rule_type") == "ctr_outlier" and rule.get("enabled", True):
                threshold = rule.get("threshold", 0.08)
                break
        if threshold and candidate.ctr > threshold:
            sample = AnomalySample(
                sample_id=generate_id("anom_"),
                candidate_id=candidate.candidate_id,
                candidate=candidate,
                detected_at=current_timestamp(),
                anomaly_type="ctr_outlier",
                severity="medium",
                reason_description=(
                    f"候选 [{candidate.candidate_id}] CTR={candidate.ctr:.4f} 超过阈值 {threshold}，"
                    f"可能存在点击作弊或统计异常，需要人工复核"
                ),
                missing_materials=["点击详情日志抽样", "反作弊检测报告"],
                next_step_owner="推荐策略老唐",
                next_step_action="排查CTR异常来源，确认是否为真实效果",
                is_verified=False,
                params_snapshot=self.params.__dict__ if self.params else None
            )
            return sample
        return None

    def _detect_budget_overrun(self, candidate: RecallCandidate) -> Optional[AnomalySample]:
        """检测预算超支预警"""
        if not self.params:
            return None
        threshold = None
        for rule in self.params.anomaly_detection_rules:
            if rule.get("rule_type") == "budget_overrun" and rule.get("enabled", True):
                threshold = rule.get("threshold", 0.95)
                break
        if threshold and candidate.budget_utilization > threshold:
            sample = AnomalySample(
                sample_id=generate_id("anom_"),
                candidate_id=candidate.candidate_id,
                candidate=candidate,
                detected_at=current_timestamp(),
                anomaly_type="budget_overrun",
                severity="low",
                reason_description=(
                    f"候选 [{candidate.candidate_id}] 预算利用率={candidate.budget_utilization:.2%} "
                    f"超过预警线 {threshold:.0%}，即将触顶"
                ),
                missing_materials=["未来一小时流量预估", "该策略ROI趋势"],
                next_step_owner="推荐策略老唐",
                next_step_action="评估是否需要追加预算或调整出价",
                is_verified=False,
                params_snapshot=self.params.__dict__ if self.params else None
            )
            return sample
        return None
