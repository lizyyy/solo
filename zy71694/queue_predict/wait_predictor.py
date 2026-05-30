from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from .models import (
    PipelineContext,
    Registration,
    SimulationResult,
    PredictionResult,
    AnomalyType,
)


class WaitPredictor:
    def __init__(self, calc_params: Dict[str, Any]):
        self.avg_consult_minutes = calc_params.get("avg_consult_minutes", 10.0)
        self.confidence_sigma = calc_params.get("confidence_interval_sigma", 1.96)
        self.skip_recall_wait_minutes = calc_params.get("skip_recall_wait_minutes", 30)
        self.suspended_doctor_reassign = calc_params.get("suspended_doctor_reassign", True)

    def predict(self, ctx: PipelineContext) -> PipelineContext:
        schedule_map = {s.doctor_id: s for s in ctx.schedules}

        for reg_id, sim in ctx.simulation_results.items():
            reg = self._find_registration(ctx, reg_id)
            if reg is None:
                continue

            if sim.estimated_wait_minutes < 0:
                reason = sim.metadata.get("reason", "unknown")
                ctx.prediction_results[reg_id] = PredictionResult(
                    reg_id=reg_id,
                    predicted_wait_minutes=-1,
                    confidence_low=-1,
                    confidence_high=-1,
                    predicted_start_time=None,
                    factors={},
                    anomaly_explanations=[f"无法预测: {reason}"],
                    param_snapshot_id=ctx.param_snapshot_id,
                )
                continue

            base_wait = sim.estimated_wait_minutes
            factors: Dict[str, float] = {}
            anomaly_explanations: List[str] = []

            schedule = schedule_map.get(reg.doctor_id)

            factors["base_wait"] = base_wait

            if sim.skip_penalty_minutes > 0:
                factors["skip_penalty"] = sim.skip_penalty_minutes
                anomaly_explanations.append(
                    f"过号惩罚: +{sim.skip_penalty_minutes:.1f}分钟"
                )

            if sim.addon_delay_minutes > 0:
                factors["addon_delay"] = sim.addon_delay_minutes
                anomaly_explanations.append(
                    f"加号延迟: +{sim.addon_delay_minutes:.1f}分钟"
                )

            if AnomalyType.DOCTOR_SUSPENDED in reg.anomaly_types:
                factors["suspension_uncertainty"] = self.avg_consult_minutes * 2
                anomaly_explanations.append(
                    "医生停诊: 等待时间不确定性增大，可能需要转诊"
                )

            if AnomalyType.SKIP_DUPLICATE in reg.anomaly_types:
                dup_detail = reg.anomaly_details.get("skip_duplicate", {})
                count = dup_detail.get("skip_count", 2)
                factors["skip_duplicate_uncertainty"] = self.avg_consult_minutes * count * 0.5
                anomaly_explanations.append(
                    f"重复过号({count}次): 等待时间估算波动大"
                )

            if AnomalyType.ADDON_QUEUE_JUMP in reg.anomaly_types:
                factors["queue_jump_uncertainty"] = self.avg_consult_minutes
                anomaly_explanations.append(
                    "加号插队: 排队顺序可能调整，影响等待时间"
                )

            if AnomalyType.MISSING_SCHEDULE in reg.anomaly_types:
                factors["missing_schedule_uncertainty"] = self.avg_consult_minutes * 3
                anomaly_explanations.append(
                    "缺少排班记录: 无法准确估算，使用默认参数"
                )

            variance = self._estimate_variance(reg, sim, schedule)
            std_dev = variance ** 0.5

            confidence_low = max(0, base_wait - self.confidence_sigma * std_dev)
            confidence_high = base_wait + self.confidence_sigma * std_dev

            predicted_start = None
            if sim.estimated_start_time:
                predicted_start = sim.estimated_start_time

            ctx.prediction_results[reg_id] = PredictionResult(
                reg_id=reg_id,
                predicted_wait_minutes=round(base_wait, 1),
                confidence_low=round(confidence_low, 1),
                confidence_high=round(confidence_high, 1),
                predicted_start_time=predicted_start,
                factors=factors,
                anomaly_explanations=anomaly_explanations,
                param_snapshot_id=ctx.param_snapshot_id,
            )

        return ctx

    def _find_registration(self, ctx: PipelineContext, reg_id: str) -> Optional[Registration]:
        for reg in ctx.registrations:
            if reg.reg_id == reg_id:
                return reg
        return None

    def _estimate_variance(
        self,
        reg: Registration,
        sim: SimulationResult,
        schedule: Optional[Any],
    ) -> float:
        base_variance = (self.avg_consult_minutes * 0.3) ** 2

        ahead_variance = (sim.ahead_count * (self.avg_consult_minutes * 0.15) ** 2)

        anomaly_variance = 0.0
        for atype in reg.anomaly_types:
            if atype == AnomalyType.SKIP_DUPLICATE:
                anomaly_variance += (self.avg_consult_minutes * 0.5) ** 2
            elif atype == AnomalyType.DOCTOR_SUSPENDED:
                anomaly_variance += (self.avg_consult_minutes * 2) ** 2
            elif atype == AnomalyType.ADDON_QUEUE_JUMP:
                anomaly_variance += (self.avg_consult_minutes * 0.8) ** 2
            elif atype == AnomalyType.MISSING_SCHEDULE:
                anomaly_variance += (self.avg_consult_minutes * 1.5) ** 2

        return base_variance + ahead_variance + anomaly_variance
