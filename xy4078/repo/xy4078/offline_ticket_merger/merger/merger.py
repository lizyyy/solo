"""冲突检测和合并模块"""

from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

from ..models import (
    ConflictType,
    ImportedTicket,
    MergeConflict,
    MergeResult,
    MergeStrategy,
    PhotoItem,
    SparePart,
    WorkOrder,
    WorkOrderSnapshot,
    WorkOrderStatus,
)


def find_duplicate_tickets(work_orders: List[WorkOrder]) -> Dict[str, List[WorkOrder]]:
    ticket_groups: Dict[str, List[WorkOrder]] = defaultdict(list)
    
    for wo in work_orders:
        key = wo.ticket_number.strip() if wo.ticket_number else f"{wo.device_id}_{wo.created_at.date()}"
        ticket_groups[key].append(wo)
    
    duplicates = {k: v for k, v in ticket_groups.items() if len(v) > 1}
    return duplicates


class ConflictDetector:
    def __init__(self, device_ids: Optional[Set[str]] = None):
        self.device_ids = device_ids or set()
        self.known_photos: Dict[str, PhotoItem] = {}
    
    def detect_all(
        self,
        work_orders: List[WorkOrder],
        source_tickets: Optional[Dict[str, str]] = None,
    ) -> List[MergeConflict]:
        conflicts: List[MergeConflict] = []
        
        ticket_groups = find_duplicate_tickets(work_orders)
        for ticket_number, group in ticket_groups.items():
            conflicts.extend(self._detect_ticket_group_conflicts(
                ticket_number, group, source_tickets
            ))
        
        if self.device_ids:
            for wo in work_orders:
                if wo.device_id and wo.device_id not in self.device_ids:
                    conflicts.append(self._create_device_not_found_conflict(wo, source_tickets))
        
        return conflicts
    
    def _detect_ticket_group_conflicts(
        self,
        ticket_number: str,
        group: List[WorkOrder],
        source_tickets: Optional[Dict[str, str]] = None,
    ) -> List[MergeConflict]:
        conflicts: List[MergeConflict] = []
        
        if len(group) > 1:
            first_wo = group[0]
            source_ids = [wo.id for wo in group]
            source_engineers = [wo.engineer_name or wo.engineer_id or "unknown" for wo in group]
            
            conflicts.append(MergeConflict(
                conflict_type=ConflictType.DUPLICATE_TICKET,
                work_order_id=first_wo.id,
                ticket_number=ticket_number,
                source_tickets=source_ids,
                source_engineers=source_engineers,
                description=f"Found {len(group)} duplicate tickets for ticket {ticket_number}",
                severity="warning",
            ))
        
        fields_to_check = [
            "status", "priority", "device_id", "device_name", "device_location",
            "issue_description", "inspection_results", "solution_taken", "temporary_measures",
            "start_time", "end_time", "engineer_id", "engineer_name",
        ]
        
        first_wo = group[0]
        for field in fields_to_check:
            values = []
            for wo in group:
                value = getattr(wo, field, None)
                if value is not None and value != "":
                    values.append({
                        "value": value,
                        "work_order_id": wo.id,
                        "source": source_tickets.get(wo.id, "unknown") if source_tickets else "unknown",
                        "updated_at": wo.updated_at.isoformat() if wo.updated_at else None,
                    })
            
            if len(values) > 1:
                unique_values = {str(v["value"]) for v in values}
                if len(unique_values) > 1:
                    conflicts.append(MergeConflict(
                        conflict_type=ConflictType.FIELD_CONFLICT,
                        work_order_id=first_wo.id,
                        ticket_number=ticket_number,
                        field_name=field,
                        values=values,
                        source_tickets=[v["work_order_id"] for v in values],
                        source_engineers=[wo.engineer_name or "unknown" for wo in group],
                        description=f"Field '{field}' has conflicting values",
                        severity="warning",
                    ))
        
        conflicts.extend(self._detect_timeline_conflicts(first_wo, group, source_tickets))
        conflicts.extend(self._detect_photo_conflicts(first_wo, group, source_tickets))
        
        return conflicts
    
    def _detect_timeline_conflicts(
        self,
        reference_wo: WorkOrder,
        group: List[WorkOrder],
        source_tickets: Optional[Dict[str, str]] = None,
    ) -> List[MergeConflict]:
        conflicts: List[MergeConflict] = []
        
        sorted_by_start = sorted(
            [wo for wo in group if wo.start_time],
            key=lambda x: x.start_time
        )
        
        if len(sorted_by_start) > 1:
            last_end = None
            for wo in sorted_by_start:
                if wo.end_time:
                    if last_end and wo.start_time < last_end:
                        conflicts.append(MergeConflict(
                            conflict_type=ConflictType.TIMELINE_CONFLICT,
                            work_order_id=reference_wo.id,
                            ticket_number=reference_wo.ticket_number,
                            source_tickets=[wo.id for wo in sorted_by_start],
                            source_engineers=[wo.engineer_name or "unknown" for wo in sorted_by_start],
                            description=f"Timeline overlap detected: {wo.start_time} overlaps with previous work ending at {last_end}",
                            severity="warning",
                        ))
                    last_end = max(last_end, wo.end_time) if last_end else wo.end_time
        
        sorted_by_updated = sorted(
            [wo for wo in group if wo.updated_at],
            key=lambda x: x.updated_at
        )
        
        if len(sorted_by_updated) > 1:
            earlier_completed = None
            later_pending = None
            
            for wo in sorted_by_updated:
                if wo.status == WorkOrderStatus.COMPLETED:
                    earlier_completed = wo
                elif wo.status in [WorkOrderStatus.PENDING, WorkOrderStatus.IN_PROGRESS]:
                    if earlier_completed and wo.updated_at > earlier_completed.updated_at:
                        later_pending = wo
                        break
            
            if earlier_completed and later_pending:
                conflicts.append(MergeConflict(
                    conflict_type=ConflictType.TIMELINE_CONFLICT,
                    work_order_id=reference_wo.id,
                    ticket_number=reference_wo.ticket_number,
                    source_tickets=[earlier_completed.id, later_pending.id],
                    source_engineers=[
                        earlier_completed.engineer_name or "unknown",
                        later_pending.engineer_name or "unknown",
                    ],
                    description=f"Status timeline inverted: Ticket was marked completed at {earlier_completed.updated_at}, "
                               f"but later updated to {later_pending.status} at {later_pending.updated_at}",
                    severity="error",
                ))
        
        return conflicts
    
    def _detect_photo_conflicts(
        self,
        reference_wo: WorkOrder,
        group: List[WorkOrder],
        source_tickets: Optional[Dict[str, str]] = None,
    ) -> List[MergeConflict]:
        conflicts: List[MergeConflict] = []
        
        all_photos: Dict[str, List[Tuple[PhotoItem, WorkOrder]]] = defaultdict(list)
        
        for wo in group:
            for photo in wo.photos:
                key = photo.file_hash or photo.filename
                all_photos[key].append((photo, wo))
        
        for key, photo_list in all_photos.items():
            if len(photo_list) > 1:
                descriptions = [p.description for p, _ in photo_list if p.description]
                photo_types = [p.photo_type for p, _ in photo_list]
                
                if len(set(descriptions)) > 1 or len(set(photo_types)) > 1:
                    conflicts.append(MergeConflict(
                        conflict_type=ConflictType.PHOTO_MISMATCH,
                        work_order_id=reference_wo.id,
                        ticket_number=reference_wo.ticket_number,
                        field_name=f"photo.{key}",
                        values=[
                            {
                                "filename": p.filename,
                                "type": p.photo_type,
                                "description": p.description,
                                "from": wo.engineer_name or "unknown",
                            }
                            for p, wo in photo_list
                        ],
                        source_tickets=[wo.id for _, wo in photo_list],
                        source_engineers=[wo.engineer_name or "unknown" for _, wo in photo_list],
                        description=f"Photo '{photo_list[0][0].filename}' has conflicting metadata across versions",
                        severity="warning",
                    ))
        
        return conflicts
    
    def _create_device_not_found_conflict(
        self,
        wo: WorkOrder,
        source_tickets: Optional[Dict[str, str]] = None,
    ) -> MergeConflict:
        return MergeConflict(
            conflict_type=ConflictType.DEVICE_NOT_FOUND,
            work_order_id=wo.id,
            ticket_number=wo.ticket_number,
            field_name="device_id",
            values=[{"value": wo.device_id}],
            source_tickets=[wo.id],
            source_engineers=[wo.engineer_name or "unknown"],
            description=f"Device ID '{wo.device_id}' not found in registered device list",
            severity="error",
        )


class WorkOrderMerger:
    def __init__(self, default_strategy: MergeStrategy = MergeStrategy.TIMELINE_ORDER):
        self.default_strategy = default_strategy
    
    def merge(
        self,
        work_orders: List[WorkOrder],
        strategy: Optional[MergeStrategy] = None,
    ) -> Tuple[WorkOrderSnapshot, List[MergeConflict]]:
        actual_strategy = strategy or self.default_strategy
        
        if not work_orders:
            raise ValueError("No work orders to merge")
        
        conflicts: List[MergeConflict] = []
        detector = ConflictDetector()
        
        ticket_groups = find_duplicate_tickets(work_orders)
        
        if len(ticket_groups) == 0:
            ticket_groups = {work_orders[0].ticket_number: work_orders}
        
        merged_snapshots: List[WorkOrderSnapshot] = []
        all_conflicts: List[MergeConflict] = []
        
        for ticket_number, group in ticket_groups.items():
            group_conflicts = detector._detect_ticket_group_conflicts(ticket_number, group)
            all_conflicts.extend(group_conflicts)
            
            merged_wo = self._merge_single_group(group, actual_strategy)
            
            snapshot = WorkOrderSnapshot(
                work_order=merged_wo,
                source_tickets=[wo.id for wo in group],
                merge_strategy_used=actual_strategy,
                resolved_conflicts=[
                    c.id for c in group_conflicts 
                    if self._is_conflict_resolvable(c, actual_strategy)
                ],
                unresolved_conflicts=[
                    c.id for c in group_conflicts 
                    if not self._is_conflict_resolvable(c, actual_strategy)
                ],
            )
            merged_snapshots.append(snapshot)
        
        return merged_snapshots, all_conflicts
    
    def _merge_single_group(
        self,
        group: List[WorkOrder],
        strategy: MergeStrategy,
    ) -> WorkOrder:
        if len(group) == 1:
            return group[0]
        
        base = self._select_base(group, strategy)
        merged = WorkOrder(**base.model_dump())
        
        if strategy == MergeStrategy.TIMELINE_ORDER:
            sorted_by_time = sorted(group, key=lambda x: x.updated_at or x.created_at)
            for wo in sorted_by_time:
                merged = self._merge_fields(merged, wo, strategy)
        
        elif strategy == MergeStrategy.LAST_WINS:
            sorted_by_time = sorted(group, key=lambda x: x.updated_at or x.created_at)
            latest = sorted_by_time[-1]
            merged = WorkOrder(**latest.model_dump())
        
        elif strategy == MergeStrategy.FIRST_WINS:
            sorted_by_time = sorted(group, key=lambda x: x.created_at or x.updated_at)
            first = sorted_by_time[0]
            merged = WorkOrder(**first.model_dump())
        
        elif strategy == MergeStrategy.MAJORITY_VOTE:
            merged = self._merge_by_majority(group)
        
        merged.photos = self._merge_photos([wo.photos for wo in group])
        merged.spare_parts = self._merge_spare_parts([wo.spare_parts for wo in group])
        
        return merged
    
    def _select_base(self, group: List[WorkOrder], strategy: MergeStrategy) -> WorkOrder:
        if strategy in [MergeStrategy.LAST_WINS, MergeStrategy.TIMELINE_ORDER]:
            return sorted(group, key=lambda x: x.updated_at or x.created_at)[-1]
        elif strategy == MergeStrategy.FIRST_WINS:
            return sorted(group, key=lambda x: x.created_at or x.updated_at)[0]
        else:
            return group[0]
    
    def _merge_fields(
        self,
        target: WorkOrder,
        source: WorkOrder,
        strategy: MergeStrategy,
    ) -> WorkOrder:
        target_dict = target.model_dump()
        source_dict = source.model_dump()
        
        fields_to_merge = [
            "status", "priority", "device_name", "device_location",
            "issue_description", "inspection_results", "solution_taken", "temporary_measures",
            "start_time", "end_time", "engineer_id", "engineer_name",
            "estimated_duration",
        ]
        
        for field in fields_to_merge:
            source_value = source_dict.get(field)
            target_value = target_dict.get(field)
            
            if source_value is not None and source_value != "":
                if target_value is None or target_value == "":
                    target_dict[field] = source_value
                elif strategy == MergeStrategy.TIMELINE_ORDER:
                    if source.updated_at and target.updated_at:
                        if source.updated_at > target.updated_at:
                            target_dict[field] = source_value
        
        target_dict["updated_at"] = max(
            target.updated_at or target.created_at,
            source.updated_at or source.created_at,
        )
        
        return WorkOrder(**target_dict)
    
    def _merge_by_majority(self, group: List[WorkOrder]) -> WorkOrder:
        base = group[0].model_dump()
        fields_to_vote = [
            "status", "priority", "device_name", "device_location",
            "issue_description", "inspection_results", "solution_taken", "temporary_measures",
        ]
        
        for field in fields_to_vote:
            votes: Dict[Any, int] = defaultdict(int)
            for wo in group:
                value = getattr(wo, field, None)
                if value is not None and value != "":
                    votes[value] += 1
            
            if votes:
                majority = max(votes.items(), key=lambda x: x[1])
                base[field] = majority[0]
        
        return WorkOrder(**base)
    
    def _merge_photos(self, photo_lists: List[List[PhotoItem]]) -> List[PhotoItem]:
        seen: Set[str] = set()
        result: List[PhotoItem] = []
        
        for photos in photo_lists:
            for photo in photos:
                key = photo.file_hash or photo.filename
                if key not in seen:
                    seen.add(key)
                    result.append(photo)
        
        return result
    
    def _merge_spare_parts(self, part_lists: List[List[SparePart]]) -> List[SparePart]:
        merged: Dict[str, SparePart] = {}
        
        for parts in part_lists:
            for part in parts:
                key = part.part_number
                
                if key not in merged:
                    merged[key] = SparePart(**part.model_dump())
                else:
                    existing = merged[key]
                    existing.quantity += part.quantity
                    if part.notes and not existing.notes:
                        existing.notes = part.notes
        
        return list(merged.values())
    
    def _is_conflict_resolvable(
        self,
        conflict: MergeConflict,
        strategy: MergeStrategy,
    ) -> bool:
        if conflict.conflict_type in [
            ConflictType.DUPLICATE_TICKET,
            ConflictType.FIELD_CONFLICT,
            ConflictType.PHOTO_MISMATCH,
        ]:
            return strategy != MergeStrategy.MANUAL
        
        return False


class ConflictResolver:
    def resolve(
        self,
        conflict: MergeConflict,
        strategy: MergeStrategy,
        work_orders: List[WorkOrder],
    ) -> MergeConflict:
        if conflict.is_resolved:
            return conflict
        
        resolution = None
        
        if conflict.conflict_type == ConflictType.DUPLICATE_TICKET:
            resolution = f"Resolved using {strategy.value} strategy"
        
        elif conflict.conflict_type == ConflictType.FIELD_CONFLICT:
            if strategy == MergeStrategy.TIMELINE_ORDER:
                sorted_values = sorted(
                    conflict.values,
                    key=lambda x: x.get("updated_at", ""),
                    reverse=True
                )
                resolution = f"Selected latest value: {sorted_values[0].get('value')}"
            
            elif strategy == MergeStrategy.LAST_WINS:
                resolution = f"Selected last value: {conflict.values[-1].get('value')}"
            
            elif strategy == MergeStrategy.FIRST_WINS:
                resolution = f"Selected first value: {conflict.values[0].get('value')}"
            
            elif strategy == MergeStrategy.MAJORITY_VOTE:
                votes: Dict[str, int] = defaultdict(int)
                for v in conflict.values:
                    val = str(v.get("value", ""))
                    votes[val] += 1
                majority = max(votes.items(), key=lambda x: x[1])[0]
                resolution = f"Selected majority value: {majority}"
        
        if resolution:
            conflict.resolution = resolution
            conflict.resolved_at = datetime.now()
            conflict.is_resolved = True
        
        return conflict


def detect_conflicts(
    work_orders: List[WorkOrder],
    device_ids: Optional[Set[str]] = None,
) -> List[MergeConflict]:
    detector = ConflictDetector(device_ids=device_ids)
    return detector.detect_all(work_orders)


def merge_tickets(
    imported_tickets: List[ImportedTicket],
    strategy: MergeStrategy = MergeStrategy.TIMELINE_ORDER,
    device_ids: Optional[Set[str]] = None,
) -> MergeResult:
    all_work_orders: List[WorkOrder] = []
    source_map: Dict[str, str] = {}
    
    for imported in imported_tickets:
        for wo in imported.work_orders:
            all_work_orders.append(wo)
            source_map[wo.id] = imported.original_filename
    
    detector = ConflictDetector(device_ids=device_ids)
    conflicts = detector.detect_all(all_work_orders, source_tickets=source_map)
    
    merger = WorkOrderMerger(default_strategy=strategy)
    merged_snapshots, merge_conflicts = merger.merge(all_work_orders, strategy)
    
    all_conflicts = conflicts + merge_conflicts
    
    unique_tickets = set()
    for snapshot in merged_snapshots:
        unique_tickets.add(snapshot.work_order.ticket_number)
    
    result = MergeResult(
        total_input_tickets=len(imported_tickets),
        total_work_orders=len(all_work_orders),
        unique_tickets=len(unique_tickets),
        merged_work_orders=merged_snapshots,
        conflicts=all_conflicts,
        inventory_checks=[],
        duplicate_tickets_found=len([c for c in all_conflicts if c.conflict_type == ConflictType.DUPLICATE_TICKET]),
        field_conflicts_found=len([c for c in all_conflicts if c.conflict_type == ConflictType.FIELD_CONFLICT]),
        inventory_issues_found=0,
        is_complete=True,
    )
    
    return result


def resolve_conflict(
    conflict: MergeConflict,
    strategy: MergeStrategy,
    work_orders: List[WorkOrder],
) -> MergeConflict:
    resolver = ConflictResolver()
    return resolver.resolve(conflict, strategy, work_orders)
