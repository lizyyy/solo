from dataclasses import dataclass
from datetime import datetime
from typing import List, Dict, Any, Optional

from .base_check import BaseCheck, CheckResult
from app.models import HandoverRecord, Prop, Scene, CheckStatus, DangerLevel, HandoverStatus


@dataclass
class DangerousPropCheckData:
    handovers: List[HandoverRecord]
    props: List[Prop]


class DangerousPropCheck(BaseCheck[DangerousPropCheckData]):

    @property
    def check_name(self) -> str:
        return "危险品复核检查"

    @property
    def check_description(self) -> str:
        return "检查危险道具是否经过必要的复核流程"

    def __init__(self, danger_level_threshold: DangerLevel = DangerLevel.LOW):
        self.danger_level_threshold = danger_level_threshold
        self._danger_priority = {
            DangerLevel.SAFE: 0,
            DangerLevel.LOW: 1,
            DangerLevel.MEDIUM: 2,
            DangerLevel.HIGH: 3,
            DangerLevel.CRITICAL: 4,
        }

    def execute(self, data: DangerousPropCheckData) -> CheckResult:
        violations = []
        warnings = []

        props_by_id = {p.id: p for p in data.props}
        props_by_name = {p.name: p for p in data.props}

        for handover in data.handovers:
            prop = props_by_id.get(handover.prop_id) or props_by_name.get(handover.prop_name)
            
            if prop is None:
                warnings.append(f"无法找到道具信息: {handover.prop_name} (ID: {handover.prop_id})")
                continue

            is_dangerous = prop.is_dangerous or self._is_danger_level_above_threshold(prop.danger_level)
            
            if not is_dangerous:
                continue

            requires_verification = prop.requires_verification
            
            if handover.is_signed_in and not handover.is_verified:
                severity = self._get_severity_by_danger_level(prop.danger_level)
                violation = self._create_violation(
                    violation_type="危险品未复核",
                    description=f"危险道具 '{prop.name}' 归还后未经过复核流程，危险等级: {prop.danger_level.name}",
                    severity=severity,
                    prop_id=prop.id,
                    prop_name=prop.name,
                    scene_id=handover.scene_id,
                    scene_title=handover.scene_title,
                    handover_id=handover.id,
                    actor_id=handover.actor_id,
                    actor_name=handover.actor_name,
                    related_entities=[handover.id, prop.id],
                    metadata={
                        "danger_level": prop.danger_level.name,
                        "is_dangerous": prop.is_dangerous,
                        "requires_verification": requires_verification,
                        "danger_description": prop.danger_description,
                        "is_verified": handover.is_verified,
                        "verification_person": handover.verification_person,
                        "verification_notes": handover.verification_notes,
                    }
                )
                violations.append(violation)

            if prop.requires_verification and not handover.is_signed_out:
                if handover.status not in (HandoverStatus.PENDING, HandoverStatus.READY):
                    severity = self._get_severity_by_danger_level(prop.danger_level)
                    violation = self._create_violation(
                        violation_type="危险品借出未复核",
                        description=f"危险道具 '{prop.name}' 借出前未经过复核确认，危险等级: {prop.danger_level.name}",
                        severity=severity,
                        prop_id=prop.id,
                        prop_name=prop.name,
                        scene_id=handover.scene_id,
                        scene_title=handover.scene_title,
                        handover_id=handover.id,
                        actor_id=handover.actor_id,
                        actor_name=handover.actor_name,
                        related_entities=[handover.id, prop.id],
                        metadata={
                            "danger_level": prop.danger_level.name,
                            "is_dangerous": prop.is_dangerous,
                            "requires_verification": requires_verification,
                            "danger_description": prop.danger_description,
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
                "dangerous_prop_violations": total_violations,
                "danger_level_threshold": self.danger_level_threshold.name,
            }
        )

    def _is_danger_level_above_threshold(self, level: DangerLevel) -> bool:
        return self._danger_priority.get(level, 0) >= self._danger_priority.get(self.danger_level_threshold, 1)

    def _get_severity_by_danger_level(self, level: DangerLevel) -> str:
        priority = self._danger_priority.get(level, 0)
        if priority >= 3:
            return "critical"
        elif priority >= 2:
            return "high"
        elif priority >= 1:
            return "medium"
        else:
            return "low"
