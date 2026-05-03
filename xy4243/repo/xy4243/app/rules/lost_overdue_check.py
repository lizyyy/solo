from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from .base_check import BaseCheck, CheckResult
from app.models import HandoverRecord, Prop, Scene, CheckStatus, HandoverStatus


@dataclass
class LostOverdueCheckData:
    handovers: List[HandoverRecord]
    current_time: Optional[datetime] = None


class LostOverdueCheck(BaseCheck[LostOverdueCheckData]):

    @property
    def check_name(self) -> str:
        return "遗失超时检查"

    @property
    def check_description(self) -> str:
        return "检查道具是否超期未归还或已标记为遗失"

    def __init__(self, grace_hours: int = 24, critical_hours: int = 72):
        self.grace_hours = grace_hours
        self.critical_hours = critical_hours

    def execute(self, data: LostOverdueCheckData) -> CheckResult:
        violations = []
        warnings = []
        current_time = data.current_time or datetime.now()

        for handover in data.handovers:
            if handover.status in (HandoverStatus.RETURNED, HandoverStatus.VERIFIED):
                continue

            if handover.status == HandoverStatus.LOST:
                violation = self._create_violation(
                    violation_type="道具遗失",
                    description=f"道具 '{handover.prop_name}' 已标记为遗失状态",
                    severity="critical",
                    prop_id=handover.prop_id,
                    prop_name=handover.prop_name,
                    scene_id=handover.scene_id,
                    scene_title=handover.scene_title,
                    handover_id=handover.id,
                    actor_id=handover.actor_id,
                    actor_name=handover.actor_name,
                    related_entities=[handover.id],
                    metadata={
                        "status": handover.status.name if hasattr(handover.status, 'name') else str(handover.status),
                        "actual_start_time": handover.actual_start_time.isoformat() if handover.actual_start_time else None,
                        "actor_name": handover.actor_name,
                    }
                )
                violations.append(violation)
                continue

            if handover.status == HandoverStatus.MISSING:
                violation = self._create_violation(
                    violation_type="道具丢失",
                    description=f"道具 '{handover.prop_name}' 已标记为丢失状态",
                    severity="high",
                    prop_id=handover.prop_id,
                    prop_name=handover.prop_name,
                    scene_id=handover.scene_id,
                    scene_title=handover.scene_title,
                    handover_id=handover.id,
                    actor_id=handover.actor_id,
                    actor_name=handover.actor_name,
                    related_entities=[handover.id],
                    metadata={
                        "status": handover.status.name if hasattr(handover.status, 'name') else str(handover.status),
                        "actual_start_time": handover.actual_start_time.isoformat() if handover.actual_start_time else None,
                        "actor_name": handover.actor_name,
                    }
                )
                violations.append(violation)
                continue

            if handover.scheduled_end_time:
                overdue_hours = self._calculate_overdue_hours(handover.scheduled_end_time, current_time)
                
                if overdue_hours > 0:
                    severity, violation_type = self._determine_severity_and_type(overdue_hours)
                    
                    violation = self._create_violation(
                        violation_type=violation_type,
                        description=f"道具 '{handover.prop_name}' 已超期 {overdue_hours:.1f} 小时未归还，"
                                   f"计划归还时间: {handover.scheduled_end_time.strftime('%Y-%m-%d %H:%M')}",
                        severity=severity,
                        prop_id=handover.prop_id,
                        prop_name=handover.prop_name,
                        scene_id=handover.scene_id,
                        scene_title=handover.scene_title,
                        handover_id=handover.id,
                        actor_id=handover.actor_id,
                        actor_name=handover.actor_name,
                        related_entities=[handover.id],
                        metadata={
                            "overdue_hours": overdue_hours,
                            "scheduled_end_time": handover.scheduled_end_time.isoformat() if handover.scheduled_end_time else None,
                            "current_time": current_time.isoformat(),
                            "grace_hours": self.grace_hours,
                            "critical_hours": self.critical_hours,
                            "status": handover.status.name if hasattr(handover.status, 'name') else str(handover.status),
                            "actor_name": handover.actor_name,
                            "is_signed_out": handover.is_signed_out,
                            "handover_person": handover.handover_person,
                        }
                    )
                    violations.append(violation)

        total_violations = len(violations)
        check_status = CheckStatus.ERROR if total_violations > 0 else CheckStatus.OK

        return CheckResult(
            check_name=self.check_name,
            check_status=check_status,
            violations=violations,
            warnings=warnings,
            metadata={
                "total_handovers_checked": len(data.handovers),
                "lost_overdue_violations": total_violations,
                "grace_hours": self.grace_hours,
                "critical_hours": self.critical_hours,
                "current_time": current_time.isoformat(),
            }
        )

    def _calculate_overdue_hours(self, scheduled_end: datetime, current_time: datetime) -> float:
        delta = current_time - scheduled_end
        total_seconds = delta.total_seconds()
        if total_seconds <= 0:
            return 0.0
        return total_seconds / 3600.0

    def _determine_severity_and_type(self, overdue_hours: float) -> tuple[str, str]:
        if overdue_hours >= self.critical_hours:
            return "critical", "道具严重超时"
        elif overdue_hours >= self.grace_hours:
            return "high", "道具超时"
        else:
            return "low", "道具即将超时"
