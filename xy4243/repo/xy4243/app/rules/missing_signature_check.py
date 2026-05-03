from dataclasses import dataclass
from datetime import datetime
from typing import List, Dict, Any, Optional

from .base_check import BaseCheck, CheckResult
from app.models import HandoverRecord, Prop, Scene, CheckStatus, HandoverStatus


@dataclass
class MissingSignatureCheckData:
    handovers: List[HandoverRecord]


class MissingSignatureCheck(BaseCheck[MissingSignatureCheckData]):

    @property
    def check_name(self) -> str:
        return "交接缺签检查"

    @property
    def check_description(self) -> str:
        return "检查道具交接是否缺少借出或归还签名"

    def __init__(self, check_only_completed: bool = True):
        self.check_only_completed = check_only_completed

    def execute(self, data: MissingSignatureCheckData) -> CheckResult:
        violations = []
        warnings = []

        for handover in data.handovers:
            issues = []

            if self.check_only_completed:
                if handover.status in (HandoverStatus.RETURNED, HandoverStatus.VERIFIED) or handover.is_signed_in:
                    if not handover.is_signed_out:
                        issues.append("缺少借出签名")
                    if not handover.is_signed_in:
                        issues.append("缺少归还签名")
            else:
                if handover.actual_end_time and not handover.is_signed_in:
                    issues.append("缺少归还签名")
                if handover.actual_start_time and not handover.is_signed_out:
                    issues.append("缺少借出签名")

            if issues:
                description = "、".join(issues)
                violation = self._create_violation(
                    violation_type="交接缺签",
                    description=f"道具交接{description}",
                    severity="medium",
                    prop_id=handover.prop_id,
                    prop_name=handover.prop_name,
                    scene_id=handover.scene_id,
                    scene_title=handover.scene_title,
                    handover_id=handover.id,
                    actor_id=handover.actor_id,
                    actor_name=handover.actor_name,
                    related_entities=[handover.id],
                    metadata={
                        "is_signed_out": handover.is_signed_out,
                        "is_signed_in": handover.is_signed_in,
                        "handover_person": handover.handover_person,
                        "return_person": handover.return_person,
                        "status": handover.status.name if hasattr(handover.status, 'name') else str(handover.status),
                    }
                )
                violations.append(violation)

        total_violations = len(violations)
        check_status = CheckStatus.WARNING if total_violations > 0 else CheckStatus.OK

        return CheckResult(
            check_name=self.check_name,
            check_status=check_status,
            violations=violations,
            warnings=warnings,
            metadata={
                "total_handovers_checked": len(data.handovers),
                "missing_signatures_found": total_violations,
                "check_only_completed": self.check_only_completed,
            }
        )
