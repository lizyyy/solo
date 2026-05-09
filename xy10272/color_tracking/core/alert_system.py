from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime
from ..models import SampleRecord, AlertLevel, WorkflowStatus, ColorDelta
from .color_engine import DEFAULT_TOLERANCE


@dataclass
class AlertConfig:
    delta_e2000_warning: float = 2.0
    delta_e2000_critical: float = 4.0
    delta_l_threshold: float = 2.0
    delta_a_threshold: float = 2.0
    delta_b_threshold: float = 2.0
    consecutive_warning_limit: int = 3
    paper_batch_change_check: bool = True

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AlertConfig":
        return cls(
            delta_e2000_warning=data.get("delta_e2000_warning", 2.0),
            delta_e2000_critical=data.get("delta_e2000_critical", 4.0),
            delta_l_threshold=data.get("delta_l_threshold", 2.0),
            delta_a_threshold=data.get("delta_a_threshold", 2.0),
            delta_b_threshold=data.get("delta_b_threshold", 2.0),
            consecutive_warning_limit=data.get("consecutive_warning_limit", 3),
            paper_batch_change_check=data.get("paper_batch_change_check", True),
        )


@dataclass
class Alert:
    alert_id: str
    level: AlertLevel
    category: str
    message: str
    record_id: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "alert_id": self.alert_id,
            "level": self.level.value,
            "category": self.category,
            "message": self.message,
            "record_id": self.record_id,
            "details": self.details,
            "timestamp": self.timestamp.isoformat(),
        }


class AlertSystem:
    def __init__(self, config: AlertConfig = None):
        self.config = config or AlertConfig()
        self.alerts: List[Alert] = []

    def analyze_record(self, record: SampleRecord) -> List[Alert]:
        new_alerts = []

        if not record.color_delta:
            return new_alerts

        delta = record.color_delta

        alert_id = f"ALERT_{datetime.now().strftime('%Y%m%d%H%M%S')}_{len(self.alerts)}"

        if delta.delta_e2000 >= self.config.delta_e2000_critical:
            alert = Alert(
                alert_id=alert_id,
                level=AlertLevel.CRITICAL,
                category="color_difference",
                message=f"色差严重超标！ΔE2000 = {delta.delta_e2000:.2f}",
                record_id=record.record_id,
                details={
                    "delta_e2000": delta.delta_e2000,
                    "threshold": self.config.delta_e2000_critical,
                    "action_required": "立即停止生产，需重新调整"
                }
            )
            new_alerts.append(alert)
        elif delta.delta_e2000 >= self.config.delta_e2000_warning:
            alert = Alert(
                alert_id=alert_id,
                level=AlertLevel.WARNING,
                category="color_difference",
                message=f"色差接近警告值 ΔE2000 = {delta.delta_e2000:.2f}",
                record_id=record.record_id,
                details={
                    "delta_e2000": delta.delta_e2000,
                    "threshold": self.config.delta_e2000_warning,
                    "action_required": "建议微调油墨"
                }
            )
            new_alerts.append(alert)

        channel_alerts = self._check_color_channels(delta, record)
        new_alerts.extend(channel_alerts)

        self.alerts.extend(new_alerts)
        return new_alerts

    def _check_color_channels(self, delta: ColorDelta, record: SampleRecord) -> List[Alert]:
        alerts = []
        base_id = f"ALERT_{datetime.now().strftime('%Y%m%d%H%M%S')}"

        if abs(delta.delta_l) >= self.config.delta_l_threshold:
            direction = "偏亮" if delta.delta_l > 0 else "偏暗"
            alerts.append(Alert(
                alert_id=f"{base_id}_L",
                level=AlertLevel.WARNING,
                category="lightness",
                message=f"明度差异过大：{direction} {abs(delta.delta_l):.2f}",
                record_id=record.record_id,
                details={"delta_l": delta.delta_l, "threshold": self.config.delta_l_threshold}
            ))

        if abs(delta.delta_a) >= self.config.delta_a_threshold:
            direction = "偏红" if delta.delta_a > 0 else "偏绿"
            alerts.append(Alert(
                alert_id=f"{base_id}_A",
                level=AlertLevel.WARNING,
                category="chroma_a",
                message=f"红绿色相差异过大：{direction} {abs(delta.delta_a):.2f}",
                record_id=record.record_id,
                details={"delta_a": delta.delta_a, "threshold": self.config.delta_a_threshold}
            ))

        if abs(delta.delta_b) >= self.config.delta_b_threshold:
            direction = "偏黄" if delta.delta_b > 0 else "偏蓝"
            alerts.append(Alert(
                alert_id=f"{base_id}_B",
                level=AlertLevel.WARNING,
                category="chroma_b",
                message=f"黄蓝色相差异过大：{direction} {abs(delta.delta_b):.2f}",
                record_id=record.record_id,
                details={"delta_b": delta.delta_b, "threshold": self.config.delta_b_threshold}
            ))

        return alerts

    def check_consecutive_warnings(self, records: List[SampleRecord]) -> List[Alert]:
        alerts = []
        consecutive_count = 0

        for record in records:
            if record.alert_level in [AlertLevel.WARNING, AlertLevel.CRITICAL]:
                consecutive_count += 1
            else:
                consecutive_count = 0

            if consecutive_count >= self.config.consecutive_warning_limit:
                alerts.append(Alert(
                    alert_id=f"ALERT_CONSEC_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    level=AlertLevel.CRITICAL,
                    category="consecutive_warning",
                    message=f"连续 {consecutive_count} 次打样出现色差问题",
                    details={
                        "consecutive_count": consecutive_count,
                        "limit": self.config.consecutive_warning_limit
                    }
                ))
                break

        return alerts

    def check_paper_batch_change(
        self,
        current_record: SampleRecord,
        previous_records: List[SampleRecord]
    ) -> List[Alert]:
        if not self.config.paper_batch_change_check or not previous_records:
            return []

        alerts = []
        prev_record = previous_records[-1]

        if current_record.paper_batch.batch_code != prev_record.paper_batch.batch_code:
            alerts.append(Alert(
                alert_id=f"ALERT_PAPER_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                level=AlertLevel.WARNING,
                category="paper_batch_change",
                message=f"纸张批次变更：{prev_record.paper_batch.batch_code} -> {current_record.paper_batch.batch_code}",
                record_id=current_record.record_id,
                details={
                    "old_batch": prev_record.paper_batch.batch_code,
                    "new_batch": current_record.paper_batch.batch_code,
                    "old_whiteness": prev_record.paper_batch.whiteness,
                    "new_whiteness": current_record.paper_batch.whiteness,
                    "action_required": "注意纸张特性变化可能影响颜色"
                }
            ))

        return alerts

    def determine_record_status(self, record: SampleRecord) -> tuple:
        if not record.color_delta:
            return WorkflowStatus.PENDING, AlertLevel.NORMAL

        delta = record.color_delta

        if delta.delta_e2000 >= self.config.delta_e2000_critical:
            return WorkflowStatus.NEEDS_REVIEW, AlertLevel.CRITICAL
        elif delta.delta_e2000 >= self.config.delta_e2000_warning:
            return WorkflowStatus.ADJUSTMENT_RECOMMENDED, AlertLevel.WARNING
        else:
            return WorkflowStatus.COMPARISON_DONE, AlertLevel.NORMAL

    def get_alerts_by_level(self, level: AlertLevel) -> List[Alert]:
        return [alert for alert in self.alerts if alert.level == level]

    def get_critical_alerts(self) -> List[Alert]:
        return self.get_alerts_by_level(AlertLevel.CRITICAL)

    def get_warning_alerts(self) -> List[Alert]:
        return self.get_alerts_by_level(AlertLevel.WARNING)

    def clear_alerts(self):
        self.alerts = []
