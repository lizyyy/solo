# -*- coding: utf-8 -*-
"""
排程引擎和冲突检测逻辑
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple, Any
from collections import defaultdict

from .models import (
    WorkOrder, WorkOrderStatus,
    DockSlot, LiftResource, CraftSchedule, TideWindow,
    ScheduledAssignment, ProcessingResult,
    DockType, LiftType, CraftType
)


class ConflictType:
    DOCK_OVERLAP = "坞位时间重叠"
    TIDE_WINDOW_MISS = "潮汐窗口不满足"
    LIFT_UNAVAILABLE = "吊装资源不可用"
    LIFT_CAPACITY = "吊装能力不足"
    CRAFT_UNAVAILABLE = "工种不可用"
    SHIP_SIZE = "船舶尺寸超限"
    DOCK_TYPE = "坞位类型不匹配"
    DEADLINE = "超出截止时间"


class SchedulingEngine:
    """排程引擎"""

    def __init__(self):
        self.dock_slots: List[DockSlot] = []
        self.lift_resources: List[LiftResource] = []
        self.craft_schedules: Dict[CraftType, CraftSchedule] = {}
        self.tide_windows: List[TideWindow] = []
        self.assigned_dock_slots: Dict[str, List[Tuple[datetime, datetime, str]]] = defaultdict(list)
        self.assigned_lifts: Dict[str, List[Tuple[datetime, datetime, str]]] = defaultdict(list)
        self.assigned_crafts: Dict[str, Dict[str, List[Tuple[datetime, datetime]]]] = defaultdict(
            lambda: defaultdict(list)
        )

    def set_resources(
        self,
        dock_slots: List[DockSlot],
        lift_resources: List[LiftResource],
        craft_schedules: Dict[CraftType, CraftSchedule],
        tide_windows: List[TideWindow]
    ):
        """设置资源"""
        self.dock_slots = dock_slots
        self.lift_resources = lift_resources
        self.craft_schedules = craft_schedules
        self.tide_windows = tide_windows
        self.assigned_dock_slots.clear()
        self.assigned_lifts.clear()
        self.assigned_crafts.clear()

    def _check_time_overlap(
        self,
        start1: datetime,
        end1: datetime,
        start2: datetime,
        end2: datetime
    ) -> bool:
        """检查两个时间段是否有重叠"""
        return start1 < end2 and start2 < end1

    def _check_ship_fits_dock(
        self,
        work_order: WorkOrder,
        dock_slot: DockSlot
    ) -> Tuple[bool, Optional[str]]:
        """检查船舶尺寸是否适合坞位"""
        if work_order.ship.length > dock_slot.max_length:
            return False, f"船舶长度({work_order.ship.length}m)超过坞位最大长度({dock_slot.max_length}m)"
        if work_order.ship.width > dock_slot.max_width:
            return False, f"船舶宽度({work_order.ship.width}m)超过坞位最大宽度({dock_slot.max_width}m)"
        if work_order.required_dock_type != dock_slot.dock_type:
            return False, f"需要{dock_slot.dock_type.value}但提供{work_order.required_dock_type.value}"
        return True, None

    def _check_dock_available(
        self,
        dock_slot: DockSlot,
        start_time: datetime,
        end_time: datetime,
        exclude_order: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """检查坞位在指定时间段是否可用"""
        if start_time < dock_slot.start_time:
            return False, f"开始时间早于坞位可用时间({dock_slot.start_time})"
        if end_time > dock_slot.end_time:
            return False, f"结束时间晚于坞位可用时间({dock_slot.end_time})"
        
        for assigned_start, assigned_end, order_id in self.assigned_dock_slots.get(dock_slot.dock_id, []):
            if exclude_order and order_id == exclude_order:
                continue
            if self._check_time_overlap(start_time, end_time, assigned_start, assigned_end):
                return False, (
                    f"坞位{dock_slot.dock_name}已被工单{order_id}占用 "
                    f"({assigned_start.strftime('%Y-%m-%d %H:%M')} ~ {assigned_end.strftime('%Y-%m-%d %H:%M')})"
                )
        return True, None

    def _check_tide_window(
        self,
        work_order: WorkOrder,
        start_time: datetime,
        end_time: datetime
    ) -> Tuple[bool, Optional[str]]:
        """检查潮汐窗口是否满足"""
        if not self.tide_windows:
            return True, None
        
        start_date = start_time.date()
        end_date = end_time.date()
        
        relevant_tides = [
            t for t in self.tide_windows
            if start_date <= t.date <= end_date
        ]
        
        if not relevant_tides:
            return False, (
                f"排程时间段({start_time.date()} ~ {end_time.date()})没有潮汐窗口数据，需要人工确认"
            )
        
        return True, None

    def _check_lift_available(
        self,
        lift_resources: List[LiftResource],
        start_time: datetime,
        end_time: datetime,
        required_lift_types: List[LiftType],
        exclude_order: Optional[str] = None
    ) -> Tuple[bool, Optional[str], List[LiftResource]]:
        """检查并选择可用的吊装资源"""
        available_lifts = []
        matched_types = set()
        
        for lift in lift_resources:
            if lift.lift_type not in required_lift_types:
                continue
            
            is_available = True
            for assigned_start, assigned_end, order_id in self.assigned_lifts.get(lift.lift_id, []):
                if exclude_order and order_id == exclude_order:
                    continue
                if self._check_time_overlap(start_time, end_time, assigned_start, assigned_end):
                    is_available = False
                    break
            
            if is_available:
                available_lifts.append(lift)
                matched_types.add(lift.lift_type)
        
        missing_types = set(required_lift_types) - matched_types
        if missing_types:
            type_names = [LiftType(t).value for t in missing_types]
            return False, f"缺少可用的吊装资源类型: {', '.join(type_names)}", []
        
        return True, None, available_lifts

    def _check_craft_available(
        self,
        craft_schedules: Dict[CraftType, CraftSchedule],
        start_time: datetime,
        end_time: datetime,
        required_crafts: List[CraftType],
        exclude_order: Optional[str] = None
    ) -> Tuple[bool, Optional[str], Dict[str, List[str]]]:
        """检查并选择可用的工种资源"""
        assignments = {}
        
        for craft_type in required_crafts:
            if craft_type not in craft_schedules:
                return False, f"工种{craft_type.value}未配置排班", {}
            
            schedule = craft_schedules[craft_type]
            available_workers = []
            
            for worker in schedule.workers:
                worker_id = worker['id']
                is_available = True
                
                for assigned_start, assigned_end in self.assigned_crafts[craft_type.value].get(worker_id, []):
                    if self._check_time_overlap(start_time, end_time, assigned_start, assigned_end):
                        is_available = False
                        break
                
                if is_available:
                    available_workers.append(worker_id)
            
            if not available_workers:
                return False, f"{craft_type.value}在{start_time.strftime('%Y-%m-%d')}没有可用人员", {}
            
            assignments[craft_type.value] = available_workers[:1]
        
        return True, None, assignments

    def _find_best_slot(
        self,
        work_order: WorkOrder
    ) -> Tuple[Optional[ScheduledAssignment], List[str]]:
        """为工单寻找最佳排程位置"""
        conflicts_set = set()
        duration = timedelta(hours=work_order.estimated_duration_hours)
        
        earliest_start = work_order.earliest_start or datetime.now()
        latest_end = work_order.latest_deadline or (earliest_start + timedelta(days=30))
        
        craft_conflict_seen = set()
        lift_conflict_seen = set()
        tide_conflict_seen = set()
        
        for dock_slot in self.dock_slots:
            ship_ok, ship_reason = self._check_ship_fits_dock(work_order, dock_slot)
            if not ship_ok:
                conflicts_set.add(f"[{dock_slot.dock_name}] {ship_reason}")
                continue
            
            current_time = max(earliest_start, dock_slot.start_time)
            while current_time + duration <= min(latest_end, dock_slot.end_time):
                end_time = current_time + duration
                
                dock_ok, dock_reason = self._check_dock_available(
                    dock_slot, current_time, end_time,
                    exclude_order=work_order.order_id
                )
                if not dock_ok:
                    current_time = end_time
                    continue
                
                tide_ok, tide_reason = self._check_tide_window(work_order, current_time, end_time)
                if not tide_ok and tide_reason not in tide_conflict_seen:
                    conflicts_set.add(tide_reason)
                    tide_conflict_seen.add(tide_reason)
                
                lift_ok, lift_reason, available_lifts = self._check_lift_available(
                    self.lift_resources,
                    current_time,
                    end_time,
                    work_order.required_lift_types,
                    exclude_order=work_order.order_id
                )
                if not lift_ok:
                    if lift_reason not in lift_conflict_seen:
                        conflicts_set.add(lift_reason)
                        lift_conflict_seen.add(lift_reason)
                    current_time += timedelta(hours=1)
                    continue
                
                craft_ok, craft_reason, craft_assignments = self._check_craft_available(
                    self.craft_schedules,
                    current_time,
                    end_time,
                    work_order.required_crafts,
                    exclude_order=work_order.order_id
                )
                if not craft_ok:
                    if craft_reason not in craft_conflict_seen:
                        conflicts_set.add(craft_reason)
                        craft_conflict_seen.add(craft_reason)
                    current_time += timedelta(hours=1)
                    continue
                
                assignment = ScheduledAssignment(
                    order_id=work_order.order_id,
                    dock_id=dock_slot.dock_id,
                    dock_name=dock_slot.dock_name,
                    lift_ids=[lift.lift_id for lift in available_lifts],
                    craft_assignments=craft_assignments,
                    start_time=current_time,
                    end_time=end_time
                )
                return assignment, list(conflicts_set)
                
                current_time += timedelta(hours=1)
        
        return None, list(conflicts_set)

    def schedule_work_orders(
        self,
        work_orders: List[WorkOrder]
    ) -> ProcessingResult:
        """
        排程所有工单
        返回处理结果
        """
        result = ProcessingResult()
        result.total_rows = len(work_orders)
        
        sorted_orders = sorted(
            work_orders,
            key=lambda x: (x.priority, x.estimated_duration_hours),
            reverse=True
        )
        
        for order in sorted_orders:
            assignment, conflicts = self._find_best_slot(order)
            
            if assignment:
                self.assigned_dock_slots[assignment.dock_id].append(
                    (assignment.start_time, assignment.end_time, order.order_id)
                )
                for lift_id in assignment.lift_ids:
                    self.assigned_lifts[lift_id].append(
                        (assignment.start_time, assignment.end_time, order.order_id)
                    )
                for craft_type, workers in assignment.craft_assignments.items():
                    for worker_id in workers:
                        self.assigned_crafts[craft_type][worker_id].append(
                            (assignment.start_time, assignment.end_time)
                        )
                
                order.assigned_dock = assignment.dock_id
                order.assigned_lifts = assignment.lift_ids
                order.assigned_crafts = assignment.craft_assignments
                order.scheduled_start = assignment.start_time
                order.scheduled_end = assignment.end_time
                order.status = WorkOrderStatus.SCHEDULED
                
                result.successful_assignments.append(assignment)
                result.valid_rows += 1
            else:
                if conflicts:
                    if any("需要人工确认" in c for c in conflicts):
                        order.status = WorkOrderStatus.NEED_REVIEW
                        result.need_review_rows.append({
                            'order_id': order.order_id,
                            'ship_name': order.ship.name,
                            'conflicts': conflicts,
                            'reason': '潮汐窗口数据缺失'
                        })
                    else:
                        order.status = WorkOrderStatus.CONFLICT
                        result.conflicts.append({
                            'order_id': order.order_id,
                            'ship_name': order.ship.name,
                            'conflicts': conflicts
                        })
                order.conflicts = conflicts
                result.skipped_rows.append({
                    'order_id': order.order_id,
                    'ship_name': order.ship.name,
                    'reason': '无法排程'
                })
        
        return result

    def get_conflict_explanation(
        self,
        work_order: WorkOrder
    ) -> Dict[str, Any]:
        """获取冲突的详细解释"""
        explanation = {
            'order_id': work_order.order_id,
            'ship_name': work_order.ship.name,
            'status': work_order.status.value,
            'conflicts': work_order.conflicts,
            'details': {}
        }
        
        for conflict in work_order.conflicts:
            if '坞位' in conflict:
                explanation['details']['dock'] = conflict
            if '潮汐' in conflict:
                explanation['details']['tide'] = conflict
            if '吊装' in conflict or '浮吊' in conflict or '龙门吊' in conflict:
                explanation['details']['lift'] = conflict
            if '工' in conflict or '工' in conflict:
                explanation['details']['craft'] = conflict
            if '船舶尺寸' in conflict or '长度' in conflict or '宽度' in conflict:
                explanation['details']['ship_size'] = conflict
        
        return explanation
