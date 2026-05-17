from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from collections import defaultdict
from .models import (
    ParentConfirmation, ConfirmationStatus, ReroutePlan, 
    BusStop, RecoveryStatus, RecoveryCheck
)


class RulesEngine:
    def __init__(self):
        self.confirmation_dedupe_key = lambda c: (c.student_id, c.reroute_id)

    def apply_stop_replacement(self, reroute: ReroutePlan, original_stop_id: str) -> Optional[BusStop]:
        return reroute.original_stop_replacements.get(original_stop_id)

    def batch_apply_stop_replacement(self, reroute: ReroutePlan, 
                                     confirmations: List[ParentConfirmation]) -> List[ParentConfirmation]:
        for conf in confirmations:
            if conf.original_stop_id and not conf.new_stop_id:
                new_stop = self.apply_stop_replacement(reroute, conf.original_stop_id)
                if new_stop:
                    conf.new_stop_id = new_stop.stop_id
        return confirmations

    def deduplicate_confirmations(self, confirmations: List[ParentConfirmation]) -> Tuple[List[ParentConfirmation], List[ParentConfirmation]]:
        seen = {}
        duplicates = []
        unique = []
        
        sorted_confs = sorted(
            confirmations,
            key=lambda c: (c.confirmed_at or datetime.min, c.status != ConfirmationStatus.CONFIRMED)
        )
        
        for conf in sorted_confs:
            key = self.confirmation_dedupe_key(conf)
            if key in seen:
                conf.status = ConfirmationStatus.DUPLICATE
                duplicates.append(conf)
            else:
                seen[key] = conf
                unique.append(conf)
        
        return unique, duplicates

    def mark_late_confirmations(self, confirmations: List[ParentConfirmation], 
                                 deadline: datetime) -> List[ParentConfirmation]:
        for conf in confirmations:
            if conf.confirmed_at and conf.confirmed_at > deadline:
                conf.is_late = True
        return confirmations

    def validate_confirmation_data(self, conf: ParentConfirmation) -> List[str]:
        errors = []
        if not conf.student_id:
            errors.append("缺少学生ID")
        if not conf.reroute_id:
            errors.append("缺少改线ID")
        if not conf.parent_name:
            errors.append("缺少家长姓名")
        if conf.status == ConfirmationStatus.CONFIRMED and not conf.confirmed_at:
            errors.append("已确认回执缺少确认时间")
        return errors

    def find_conflicts(self, confirmations: List[ParentConfirmation]) -> Dict[str, List[str]]:
        student_conflicts = defaultdict(list)
        
        for conf in confirmations:
            if conf.status != ConfirmationStatus.DUPLICATE:
                key = f"{conf.student_id}_{conf.reroute_id}"
                student_conflicts[key].append(conf.confirmation_id)
        
        actual_conflicts = {k: v for k, v in student_conflicts.items() if len(v) > 1}
        return actual_conflicts

    def get_students_without_confirmation(self, student_ids: List[str], 
                                           confirmations: List[ParentConfirmation],
                                           reroute_id: str) -> List[str]:
        confirmed_students = set(
            c.student_id for c in confirmations 
            if c.reroute_id == reroute_id and c.status in [ConfirmationStatus.CONFIRMED, ConfirmationStatus.REJECTED]
        )
        return [sid for sid in student_ids if sid not in confirmed_students]
