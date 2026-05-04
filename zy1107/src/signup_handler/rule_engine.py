from typing import List, Dict, Tuple, Optional
from collections import defaultdict
from decimal import Decimal

from .models import (
    MergedRecord,
    Group,
    TimeSlotRule,
    RulesConfig,
    RecordStatus,
    ValidationIssue,
)


class RuleEngine:
    def __init__(self, rules: RulesConfig):
        self.rules = rules
        self.issues: List[ValidationIssue] = []

    def process(
        self,
        merged_records: List[MergedRecord],
    ) -> Tuple[Dict[str, List[Group]], List[MergedRecord], List[ValidationIssue]]:
        self.issues = []
        
        confirmed_records = [r for r in merged_records if r.status not in [RecordStatus.DUPLICATE]]
        
        slots_to_records = self._group_by_time_slots(confirmed_records)
        
        slot_counts = {}
        for slot_name, records in slots_to_records.items():
            total_people = sum(r.effective_total_people for r in records)
            slot_counts[slot_name] = total_people
        
        self._validate_capacity(slot_counts)
        
        selected_records, waitlist = self._apply_capacity_limits(slots_to_records, slot_counts)
        
        groups = self._create_groups(selected_records)
        
        return groups, waitlist, self.issues

    def _group_by_time_slots(self, records: List[MergedRecord]) -> Dict[str, List[MergedRecord]]:
        slots_to_records: Dict[str, List[MergedRecord]] = defaultdict(list)
        
        for record in records:
            slots = record.effective_time_slots
            if slots:
                for slot in slots:
                    slots_to_records[slot].append(record)
            else:
                default_slot = '周六上午'
                slots_to_records[default_slot].append(record)
                record.warnings.append("未指定时段，默认分配到周六上午")
        
        slot_names = set(slots_to_records.keys())
        for slot_rule in self.rules.time_slots:
            slot_names.add(slot_rule.name)
        
        for slot_name in slot_names:
            if slot_name not in slots_to_records:
                slots_to_records[slot_name] = []
        
        return slots_to_records

    def _validate_capacity(self, slot_counts: Dict[str, int]) -> None:
        for slot_rule in self.rules.time_slots:
            slot_name = slot_rule.name
            count = slot_counts.get(slot_name, 0)
            
            if count > slot_rule.max_capacity:
                self.issues.append(ValidationIssue(
                    severity="error",
                    category="capacity_overflow",
                    message=f"时段 '{slot_name}' 报名人数超员: 报名 {count} 人，容量上限 {slot_rule.max_capacity} 人",
                    suggestion=f"将有 {count - slot_rule.max_capacity} 人进入候补名单，建议联系组织者协调",
                ))
        
        total_count = sum(slot_counts.values())
        if total_count > self.rules.total_max_capacity:
            self.issues.append(ValidationIssue(
                severity="error",
                category="total_capacity_overflow",
                message=f"总报名人数超员: 报名 {total_count} 人，总容量上限 {self.rules.total_max_capacity} 人",
                suggestion=f"将有 {total_count - self.rules.total_max_capacity} 人进入候补名单",
            ))

    def _apply_capacity_limits(
        self,
        slots_to_records: Dict[str, List[MergedRecord]],
        slot_counts: Dict[str, int],
    ) -> Tuple[Dict[str, List[MergedRecord]], List[MergedRecord]]:
        selected: Dict[str, List[MergedRecord]] = defaultdict(list)
        waitlist: List[MergedRecord] = []
        
        slot_to_rule = {sr.name: sr for sr in self.rules.time_slots}
        
        total_remaining = self.rules.total_max_capacity
        
        sorted_slots = sorted(
            slots_to_records.keys(),
            key=lambda s: slot_to_rule.get(s, TimeSlotRule(name=s, max_capacity=999)).priority,
            reverse=True
        )
        
        for slot_name in sorted_slots:
            records = slots_to_records.get(slot_name, [])
            slot_rule = slot_to_rule.get(slot_name, TimeSlotRule(name=slot_name, max_capacity=999))
            
            sorted_records = self._sort_records_by_priority(records)
            
            slot_remaining = min(slot_rule.max_capacity, total_remaining)
            current_slot_size = 0
            current_children = 0
            
            for record in sorted_records:
                record_size = record.effective_total_people
                record_children = record.effective_child_count
                
                if current_slot_size + record_size > slot_remaining:
                    record.is_waitlist = True
                    record.assigned_time_slot = None
                    waitlist.append(record)
                    continue
                
                if slot_rule.max_child_ratio is not None:
                    new_total = current_slot_size + record_size
                    new_children = current_children + record_children
                    new_ratio = new_children / new_total if new_total > 0 else 0.0
                    
                    if new_ratio > slot_rule.max_child_ratio:
                        record.is_waitlist = True
                        record.assigned_time_slot = None
                        record.warnings.append(f"儿童比例超过限制 ({slot_rule.max_child_ratio*100:.0f}%)，进入候补")
                        waitlist.append(record)
                        continue
                
                record.assigned_time_slot = slot_name
                record.is_waitlist = False
                selected[slot_name].append(record)
                current_slot_size += record_size
                current_children += record_children
                total_remaining -= record_size
                
                self._check_child_ratio_warning(slot_name, current_children, current_slot_size, slot_rule)
        
        for slot_name, records in selected.items():
            selected_count = sum(r.effective_total_people for r in records)
            slot_rule = slot_to_rule.get(slot_name, None)
            if slot_rule:
                if selected_count < slot_rule.max_capacity:
                    self.issues.append(ValidationIssue(
                        severity="info",
                        category="slot_under_capacity",
                        message=f"时段 '{slot_name}' 尚有剩余容量: 已确认 {selected_count} 人，容量 {slot_rule.max_capacity} 人，剩余 {slot_rule.max_capacity - selected_count} 个名额",
                    ))
        
        return selected, waitlist

    def _sort_records_by_priority(self, records: List[MergedRecord]) -> List[MergedRecord]:
        def get_priority(record: MergedRecord) -> Tuple[int, int, int]:
            payment_priority = 0
            if record.payment_status.value == "已付款":
                payment_priority = 3
            elif record.payment_status.value == "疑似多付":
                payment_priority = 2
            elif record.payment_status.value == "疑似少付":
                payment_priority = 1
            else:
                payment_priority = 0
            
            size_priority = -record.effective_total_people
            
            early_bird = -record.primary_record.line_number
            
            return (payment_priority, size_priority, early_bird)
        
        return sorted(records, key=get_priority, reverse=True)

    def _check_child_ratio_warning(
        self,
        slot_name: str,
        child_count: int,
        total_count: int,
        slot_rule: TimeSlotRule,
    ) -> None:
        if slot_rule.max_child_ratio is None:
            return
        
        ratio = child_count / total_count if total_count > 0 else 0.0
        threshold = slot_rule.max_child_ratio * 0.9
        
        if ratio >= threshold and ratio < slot_rule.max_child_ratio:
            self.issues.append(ValidationIssue(
                severity="warning",
                category="child_ratio_warning",
                message=f"时段 '{slot_name}' 儿童比例接近上限: 当前 {child_count}/{total_count} = {ratio*100:.1f}%，限制 {slot_rule.max_child_ratio*100:.0f}%",
                suggestion="后续报名的儿童可能会被安排到候补",
            ))

    def _create_groups(
        self,
        selected_records: Dict[str, List[MergedRecord]],
    ) -> Dict[str, List[Group]]:
        all_groups: Dict[str, List[Group]] = defaultdict(list)
        
        for slot_name, records in selected_records.items():
            slot_rule = None
            for sr in self.rules.time_slots:
                if sr.name == slot_name:
                    slot_rule = sr
                    break
            
            sorted_records = self._sort_for_grouping(records)
            
            groups: List[Group] = []
            current_group_idx = 0
            
            for record in sorted_records:
                placed = False
                
                for group in groups:
                    can_add = group.can_add(
                        record,
                        max_child_ratio=slot_rule.max_child_ratio if slot_rule else None
                    )
                    if can_add:
                        group.members.append(record)
                        record.assigned_group = group.group_name
                        placed = True
                        break
                
                if not placed:
                    current_group_idx += 1
                    group_name = f"{slot_name}第{current_group_idx}组"
                    new_group = Group(
                        group_name=group_name,
                        time_slot=slot_name,
                        max_size=self.rules.group_size,
                    )
                    new_group.members.append(record)
                    record.assigned_group = group_name
                    groups.append(new_group)
            
            for group in groups:
                if group.current_size < 3:
                    self.issues.append(ValidationIssue(
                        severity="info",
                        category="small_group",
                        message=f"小组 '{group.group_name}' 人数较少: {group.current_size} 人",
                        suggestion="可考虑与其他小组合并或调整分组",
                    ))
            
            all_groups[slot_name] = groups
        
        return all_groups

    def _sort_for_grouping(self, records: List[MergedRecord]) -> List[MergedRecord]:
        if not self.rules.prefer_same_time_together:
            return sorted(records, key=lambda r: r.display_name)
        
        def group_key(record: MergedRecord) -> Tuple[int, int, str]:
            family_size = record.effective_total_people
            time_slot = record.assigned_time_slot or '未知'
            
            return (-family_size, time_slot, record.display_name)
        
        return sorted(records, key=group_key)

    def get_capacity_summary(self, groups: Dict[str, List[Group]], waitlist: List[MergedRecord]) -> Dict:
        summary = {
            "total_capacity": self.rules.total_max_capacity,
            "by_slot": {},
            "waitlist_count": len(waitlist),
            "waitlist_people": sum(r.effective_total_people for r in waitlist),
        }
        
        slot_to_rule = {sr.name: sr for sr in self.rules.time_slots}
        
        for slot_name, slot_groups in groups.items():
            rule = slot_to_rule.get(slot_name, None)
            
            total_people = sum(g.current_size for g in slot_groups)
            total_adults = sum(g.adult_count for g in slot_groups)
            total_children = sum(g.child_count for g in slot_groups)
            
            child_ratio = total_children / total_people if total_people > 0 else 0.0
            
            summary["by_slot"][slot_name] = {
                "capacity": rule.max_capacity if rule else 999,
                "actual": total_people,
                "remaining": (rule.max_capacity if rule else 999) - total_people,
                "groups_count": len(slot_groups),
                "adults": total_adults,
                "children": total_children,
                "child_ratio": child_ratio,
                "max_child_ratio": rule.max_child_ratio if rule else None,
            }
        
        return summary
