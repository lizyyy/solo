from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple

from .base_check import BaseCheck, CheckResult
from app.models import HandoverRecord, Prop, Scene, CheckStatus


@dataclass
class TimeConflictCheckData:
    handovers: List[HandoverRecord]
    props: List[Prop]
    scenes: List[Scene]


class TimeConflictCheck(BaseCheck[TimeConflictCheckData]):

    @property
    def check_name(self) -> str:
        return "道具时间冲突检查"

    @property
    def check_description(self) -> str:
        return "检查同一件道具是否在时间冲突的场次中被同时借用"

    def execute(self, data: TimeConflictCheckData) -> CheckResult:
        violations = []
        warnings = []

        prop_handovers: Dict[str, List[HandoverRecord]] = {}
        for handover in data.handovers:
            prop_id = handover.prop_id or handover.prop_name
            if prop_id not in prop_handovers:
                prop_handovers[prop_id] = []
            prop_handovers[prop_id].append(handover)

        for prop_id, handovers in prop_handovers.items():
            if len(handovers) <= 1:
                continue

            for i in range(len(handovers)):
                for j in range(i + 1, len(handovers)):
                    h1 = handovers[i]
                    h2 = handovers[j]

                    if self._check_time_overlap(h1, h2):
                        conflict_description = self._build_conflict_description(h1, h2)
                        
                        violation = self._create_violation(
                            violation_type="道具时间冲突",
                            description=conflict_description,
                            severity="high",
                            prop_id=prop_id,
                            prop_name=h1.prop_name,
                            handover_id=f"{h1.id} & {h2.id}",
                            related_entities=[h1.id, h2.id, h1.scene_id, h2.scene_id],
                            metadata={
                                "handover1": {
                                    "id": h1.id,
                                    "scene_title": h1.scene_title,
                                    "start_time": h1.scheduled_start_time.isoformat() if h1.scheduled_start_time else None,
                                    "end_time": h1.scheduled_end_time.isoformat() if h1.scheduled_end_time else None,
                                },
                                "handover2": {
                                    "id": h2.id,
                                    "scene_title": h2.scene_title,
                                    "start_time": h2.scheduled_start_time.isoformat() if h2.scheduled_start_time else None,
                                    "end_time": h2.scheduled_end_time.isoformat() if h2.scheduled_end_time else None,
                                }
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
                "total_props_checked": len(prop_handovers),
                "conflicts_found": total_violations,
            }
        )

    def _check_time_overlap(self, h1: HandoverRecord, h2: HandoverRecord) -> bool:
        if h1.scheduled_start_time is None or h1.scheduled_end_time is None:
            return False
        if h2.scheduled_start_time is None or h2.scheduled_end_time is None:
            return False

        return (h1.scheduled_start_time < h2.scheduled_end_time) and \
               (h2.scheduled_start_time < h1.scheduled_end_time)

    def _build_conflict_description(self, h1: HandoverRecord, h2: HandoverRecord) -> str:
        def format_time(dt: Optional[datetime]) -> str:
            if dt is None:
                return "未知"
            return dt.strftime("%Y-%m-%d %H:%M")

        return f"道具在以下两个场次中时间冲突: " \
               f"场次1: {h1.scene_title} ({format_time(h1.scheduled_start_time)} - {format_time(h1.scheduled_end_time)}), " \
               f"场次2: {h2.scene_title} ({format_time(h2.scheduled_start_time)} - {format_time(h2.scheduled_end_time)})"
