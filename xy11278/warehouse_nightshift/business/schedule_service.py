import uuid
from datetime import date, datetime, timedelta
from typing import List, Dict, Tuple, Optional

from warehouse_nightshift.config import MIN_BATTERY_FOR_TASK, CHARGING_TIME_PER_10_PERCENT
from warehouse_nightshift.models import (
    Task, Schedule, TaskStatus, ExceptionType, OperationLog
)
from warehouse_nightshift.storage import UnitOfWork


class ScheduleConflict:
    def __init__(self, conflict_type: ExceptionType, message: str,
                 task_id: Optional[str] = None, forklift_id: Optional[str] = None):
        self.conflict_type = conflict_type
        self.message = message
        self.task_id = task_id
        self.forklift_id = forklift_id


class ScheduleService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    def _generate_id(self) -> str:
        return str(uuid.uuid4())

    def _log_operation(self, action: str, entity_type: str, entity_id: str,
                       details: Dict, operator: str) -> None:
        log = OperationLog(
            id=self._generate_id(),
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            operator=operator
        )
        self.uow.operation_logs.save(log)

    def check_battery_conflict(self, task: Task, forklift_id: str) -> Optional[ScheduleConflict]:
        forklift = self.uow.forklifts.get_by_id(forklift_id)
        if not forklift:
            return ScheduleConflict(
                ExceptionType.FORKLIFT_UNAVAILABLE,
                f'叉车 {forklift_id} 不存在',
                task.id, forklift_id
            )

        if forklift.battery_level < MIN_BATTERY_FOR_TASK:
            charging_needed = MIN_BATTERY_FOR_TASK - forklift.battery_level
            charging_minutes = (charging_needed // 10) * CHARGING_TIME_PER_10_PERCENT
            return ScheduleConflict(
                ExceptionType.LOW_BATTERY,
                f'叉车电量不足({forklift.battery_level}%), 需要充电约{charging_minutes}分钟',
                task.id, forklift_id
            )
        return None

    def check_charging_station_conflict(self, expected_time: datetime) -> Optional[ScheduleConflict]:
        stations = self.uow.charging_stations.get_all()
        occupied = [s for s in stations if s.status == 'occupied' and s.expected_free_time]

        for station in occupied:
            if station.expected_free_time > expected_time:
                return ScheduleConflict(
                    ExceptionType.CHARGING_STATION_OCCUPIED,
                    f'充电桩 {station.name} 预计 {station.expected_free_time} 才能空闲',
                    None, None
                )
        return None

    def check_task_conflict(self, schedule_date: date, shift: str) -> List[ScheduleConflict]:
        conflicts = []
        tasks = self.uow.tasks.get_by_date_and_shift(schedule_date, shift)
        forklift_assignments: Dict[str, List[Task]] = {}

        for task in tasks:
            if task.assigned_forklift:
                if task.assigned_forklift not in forklift_assignments:
                    forklift_assignments[task.assigned_forklift] = []
                forklift_assignments[task.assigned_forklift].append(task)

        for forklift_id, assigned_tasks in forklift_assignments.items():
            if len(assigned_tasks) > 1:
                total_duration = sum(t.estimated_duration for t in assigned_tasks)
                if total_duration > 480:
                    task_ids = ', '.join([t.id for t in assigned_tasks])
                    conflicts.append(ScheduleConflict(
                        ExceptionType.TASK_CONFLICT,
                        f'叉车 {forklift_id} 任务过载, 总时长 {total_duration} 分钟超过8小时',
                        task_ids, forklift_id
                    ))
        return conflicts

    def validate_schedule(self, schedule_date: date, shift: str) -> List[ScheduleConflict]:
        conflicts = []
        tasks = self.uow.tasks.get_by_date_and_shift(schedule_date, shift)

        for task in tasks:
            if task.assigned_forklift:
                battery_conflict = self.check_battery_conflict(task, task.assigned_forklift)
                if battery_conflict:
                    conflicts.append(battery_conflict)

        task_conflicts = self.check_task_conflict(schedule_date, shift)
        conflicts.extend(task_conflicts)

        return conflicts

    def generate_schedule(self, schedule_date: date, shift: str, operator: str) -> Tuple[Schedule, List[ScheduleConflict]]:
        conflicts = self.validate_schedule(schedule_date, shift)
        tasks = self.uow.tasks.get_by_date_and_shift(schedule_date, shift)

        available_forklifts = self.uow.forklifts.get_available()
        forklift_assignments: Dict[str, str] = {}
        task_order: List[str] = []

        sorted_tasks = sorted(tasks, key=lambda t: (-t.priority, t.estimated_duration))

        forklift_idx = 0
        for task in sorted_tasks:
            if not task.assigned_forklift and available_forklifts:
                assigned = False
                for i in range(len(available_forklifts)):
                    forklift = available_forklifts[(forklift_idx + i) % len(available_forklifts)]
                    battery_ok = self.check_battery_conflict(task, forklift.id) is None
                    if battery_ok:
                        task.assigned_forklift = forklift.id
                        self.uow.tasks.save(task)
                        forklift_assignments[forklift.id] = task.id
                        assigned = True
                        forklift_idx = (forklift_idx + i + 1) % len(available_forklifts)
                        break

            task_order.append(task.id)

        schedule = Schedule(
            id=self._generate_id(),
            schedule_date=schedule_date,
            shift=shift,
            forklift_assignments=forklift_assignments,
            task_order=task_order,
            notes=f'自动生成, {len(conflicts)} 个冲突需要处理' if conflicts else '自动生成'
        )
        self.uow.schedules.save(schedule)
        self._log_operation('generate', 'schedule', schedule.id,
                           {'date': str(schedule_date), 'shift': shift}, operator)

        return schedule, conflicts

    def review_schedule(self, schedule_id: str, reviewer: str, notes: Optional[str] = None) -> bool:
        schedule = self.uow.schedules.get_by_id(schedule_id)
        if not schedule:
            return False

        schedule.reviewed_by = reviewer
        schedule.reviewed_at = datetime.now()
        if notes:
            schedule.notes = (schedule.notes or '') + f'\n复核意见: {notes}'

        self.uow.schedules.save(schedule)
        self._log_operation('review', 'schedule', schedule_id, {'reviewer': reviewer}, reviewer)
        return True

    def update_task_status(self, task_id: str, status: TaskStatus, operator: str,
                           exception_type: Optional[ExceptionType] = None,
                           exception_note: Optional[str] = None) -> bool:
        task = self.uow.tasks.get_by_id(task_id)
        if not task:
            return False

        old_status = task.status
        task.status = status

        if status == TaskStatus.IN_PROGRESS:
            task.actual_start = datetime.now()
        elif status in [TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.EXCEPTION]:
            task.actual_end = datetime.now()

        if exception_type:
            task.exception_type = exception_type
        if exception_note:
            task.exception_note = exception_note

        task.updated_at = datetime.now()
        self.uow.tasks.save(task)

        self._log_operation('update_status', 'task', task_id,
                           {'from': old_status.value, 'to': status.value}, operator)
        return True

    def resolve_exception(self, task_id: str, resolution: str, operator: str) -> bool:
        task = self.uow.tasks.get_by_id(task_id)
        if not task:
            return False

        task.status = TaskStatus.PENDING
        task.exception_note = (task.exception_note or '') + f'\n处理方案: {resolution}'
        task.exception_type = None
        task.updated_at = datetime.now()

        self.uow.tasks.save(task)
        self._log_operation('resolve_exception', 'task', task_id,
                           {'resolution': resolution}, operator)
        return True

    def get_exception_summary(self, start_date: date, end_date: date) -> Dict:
        tasks = self.uow.tasks.query(start_date=start_date, end_date=end_date)
        exception_tasks = [t for t in tasks if t.exception_type]

        summary = {
            'total': len(exception_tasks),
            'by_type': {},
            'by_operator': {}
        }

        for task in exception_tasks:
            type_key = task.exception_type.value
            summary['by_type'][type_key] = summary['by_type'].get(type_key, 0) + 1

            if task.assigned_operator:
                summary['by_operator'][task.assigned_operator] = \
                    summary['by_operator'].get(task.assigned_operator, 0) + 1

        return summary
