"""核心业务逻辑"""
from datetime import date, datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
import hashlib

from .models import (
    Building, Elevator, Technician, Vacation, MaintenanceOrder,
    ORDER_TYPE_PERIODIC, ORDER_TYPE_FAULT,
    ORDER_STATUS_PENDING, ORDER_STATUS_ASSIGNED, ORDER_STATUS_COMPLETED,
    ORDER_STATUS_OVERDUE, ORDER_STATUS_ESCALATED,
    ORDER_STATUS_CANCELLED, ORDER_STATUS_SUSPENDED,
    now_date
)
from .storage import DataStore


class ServiceException(Exception):
    """业务异常"""
    def __init__(self, message: str, reason: str = ""):
        super().__init__(message)
        self.reason = reason or message


class MaintenanceService:
    """维保服务"""

    ESCALATE_DAYS = 7

    def __init__(self, store: DataStore):
        self.store = store

    # ==================== 基础信息管理 ====================

    def create_building(self, name: str, floors: int = 0) -> Building:
        if not name:
            raise ServiceException("楼栋名称不能为空")
        existing = self.store.buildings.find(lambda b: b.name == name)
        if existing:
            raise ServiceException(
                f"楼栋 [{name}] 已存在",
                reason=f"不能重复创建相同名称的楼栋"
            )
        building = Building(name=name, floors=floors)
        return self.store.buildings.add(building)

    def create_elevator(self, building_name: str, code: str, cycle_days: int = 30) -> Elevator:
        buildings = self.store.buildings.find(lambda b: b.name == building_name)
        if not buildings:
            raise ServiceException(
                f"楼栋 [{building_name}] 不存在",
                reason=f"请先创建楼栋：python -m elevator_cli building add '{building_name}'"
            )
        building = buildings[0]
        existing = self.store.elevators.find(
            lambda e: e.building_id == building.id and e.code == code
        )
        if existing:
            raise ServiceException(
                f"楼栋 [{building_name}] 已存在电梯 [{code}]",
                reason=f"不能重复创建相同编号的电梯"
            )
        if cycle_days <= 0:
            raise ServiceException(
                f"维保周期 [{cycle_days}] 天无效",
                reason=f"维保周期必须大于0天"
            )
        elevator = Elevator(
            building_id=building.id,
            code=code,
            maintenance_cycle_days=cycle_days
        )
        return self.store.elevators.add(elevator)

    def create_technician(self, name: str, phone: str = "") -> Technician:
        if not name:
            raise ServiceException("师傅姓名不能为空")
        existing = self.store.technicians.find(lambda t: t.name == name and t.is_active)
        if existing:
            raise ServiceException(
                f"师傅 [{name}] 已存在",
                reason=f"在职师傅不能重复创建"
            )
        tech = Technician(name=name, phone=phone)
        return self.store.technicians.add(tech)

    def add_vacation(self, tech_name: str, start_date: date, end_date: date, reason: str = "") -> Vacation:
        techs = self.store.technicians.find(lambda t: t.name == tech_name)
        if not techs:
            raise ServiceException(
                f"师傅 [{tech_name}] 不存在",
                reason=f"请先添加师傅：python -m elevator_cli tech add '{tech_name}'"
            )
        tech = techs[0]
        if start_date > end_date:
            raise ServiceException(
                f"开始日期 [{start_date}] 晚于结束日期 [{end_date}]",
                reason=f"休假开始日期必须早于或等于结束日期"
            )
        conflicts = self.store.vacations.find(
            lambda v: (
                v.technician_id == tech.id and
                not (end_date < v.start_date or start_date > v.end_date)
            )
        )
        if conflicts:
            conflict = conflicts[0]
            raise ServiceException(
                f"师傅 [{tech_name}] 已有休假记录冲突",
                reason=f"已有休假：{conflict.start_date} ~ {conflict.end_date}，新休假与该时间段重叠"
            )
        vac = Vacation(
            technician_id=tech.id,
            start_date=start_date,
            end_date=end_date,
            reason=reason
        )
        return self.store.vacations.add(vac)

    # ==================== 冲突检测 ====================

    def check_duplicate_order(self, elevator_id: str) -> Optional[MaintenanceOrder]:
        """检查同一电梯是否有未完成的维保单"""
        active = self.store.orders.find(
            lambda o: (
                o.elevator_id == elevator_id and
                o.status in [ORDER_STATUS_PENDING, ORDER_STATUS_ASSIGNED, ORDER_STATUS_ESCALATED]
            )
        )
        return active[0] if active else None

    def check_technician_on_vacation(self, technician_id: str, check_date: date) -> Optional[Vacation]:
        """检查师傅在指定日期是否休假"""
        vacations = self.store.vacations.find(
            lambda v: v.technician_id == technician_id and v.covers(check_date)
        )
        return vacations[0] if vacations else None

    def check_duplicate_import(self, import_hash: str) -> Optional[MaintenanceOrder]:
        """检查是否已存在相同导入记录"""
        if not import_hash:
            return None
        existing = self.store.orders.find(lambda o: o.import_hash == import_hash)
        return existing[0] if existing else None

    # ==================== 维保单管理 ====================

    def generate_order_no(self, order_type: str) -> str:
        today = date.today()
        prefix = "P" if order_type == ORDER_TYPE_PERIODIC else "F"
        date_str = today.strftime("%Y%m%d")
        count = len(self.store.orders.find(
            lambda o: o.created_at == today and o.type == order_type
        )) + 1
        return f"{prefix}{date_str}{count:03d}"

    def create_periodic_order(self, elevator_code: str, building_name: str = "",
                               planned_date: Optional[date] = None,
                               import_hash: str = "") -> MaintenanceOrder:
        """创建周期维保单"""
        if building_name:
            buildings = self.store.buildings.find(lambda b: b.name == building_name)
            if not buildings:
                raise ServiceException(
                    f"楼栋 [{building_name}] 不存在",
                    reason=f"请先确认楼栋名称是否正确"
                )
            building_id = buildings[0].id
            elevators = self.store.elevators.find(
                lambda e: e.building_id == building_id and e.code == elevator_code
            )
        else:
            elevators = self.store.elevators.find(lambda e: e.code == elevator_code)

        if not elevators:
            raise ServiceException(
                f"电梯 [{elevator_code}] 不存在",
                reason=f"请先添加电梯：python -m elevator_cli elevator add"
            )
        elevator = elevators[0]

        if import_hash:
            dup = self.check_duplicate_import(import_hash)
            if dup:
                raise ServiceException(
                    f"导入记录已存在（单号：{dup.order_no}）",
                    reason=f"import_hash=[{import_hash}] 已被使用，避免重复导入"
                )

        dup_order = self.check_duplicate_order(elevator.id)
        if dup_order:
            raise ServiceException(
                f"电梯 [{elevator_code}] 已有未完成的维保单",
                reason=f"当前未完成单号：{dup_order.order_no}，状态：{dup_order.status}，"
                       f"必须先完成该单才能新建"
            )

        if planned_date is None:
            if elevator.last_maintenance_date:
                planned_date = elevator.last_maintenance_date + timedelta(days=elevator.maintenance_cycle_days)
            else:
                planned_date = now_date()

        due_date = planned_date + timedelta(days=5)

        order = MaintenanceOrder(
            order_no=self.generate_order_no(ORDER_TYPE_PERIODIC),
            elevator_id=elevator.id,
            type=ORDER_TYPE_PERIODIC,
            planned_date=planned_date,
            due_date=due_date,
            status=ORDER_STATUS_PENDING,
            import_hash=import_hash
        )
        return self.store.orders.add(order)

    def create_fault_order(self, elevator_code: str, building_name: str = "",
                            fault_description: str = "",
                            planned_date: Optional[date] = None,
                            import_hash: str = "") -> MaintenanceOrder:
        """创建故障报修单"""
        if building_name:
            buildings = self.store.buildings.find(lambda b: b.name == building_name)
            if not buildings:
                raise ServiceException(
                    f"楼栋 [{building_name}] 不存在",
                    reason=f"请先确认楼栋名称是否正确"
                )
            building_id = buildings[0].id
            elevators = self.store.elevators.find(
                lambda e: e.building_id == building_id and e.code == elevator_code
            )
        else:
            elevators = self.store.elevators.find(lambda e: e.code == elevator_code)

        if not elevators:
            raise ServiceException(
                f"电梯 [{elevator_code}] 不存在",
                reason=f"请先添加电梯：python -m elevator_cli elevator add"
            )
        elevator = elevators[0]

        if import_hash:
            dup = self.check_duplicate_import(import_hash)
            if dup:
                raise ServiceException(
                    f"导入记录已存在（单号：{dup.order_no}）",
                    reason=f"import_hash=[{import_hash}] 已被使用，避免重复导入"
                )

        dup_order = self.check_duplicate_order(elevator.id)
        if dup_order:
            if dup_order.type == ORDER_TYPE_PERIODIC:
                raise ServiceException(
                    f"电梯 [{elevator_code}] 已有周期维保计划冲突",
                    reason=f"当前周期单：{dup_order.order_no}（计划：{dup_order.planned_date}），状态：{dup_order.status}。"
                           f"故障单优先级高，请先处理周期单："
                           f"1) 若不做了：python3 -m elevator_cli order cancel {dup_order.order_no}"
                           f"2) 若之后要做：python3 -m elevator_cli order suspend {dup_order.order_no}（故障处理完可恢复）"
                )
            else:
                raise ServiceException(
                    f"电梯 [{elevator_code}] 已有未处理的故障单",
                    reason=f"当前故障单：{dup_order.order_no}，描述：{dup_order.fault_description}，状态：{dup_order.status}。"
                           f"同一电梯不能同时有两张未完成的故障单，请先处理已有故障单。"
                )

        if planned_date is None:
            planned_date = now_date()
        due_date = planned_date + timedelta(days=2)

        order = MaintenanceOrder(
            order_no=self.generate_order_no(ORDER_TYPE_FAULT),
            elevator_id=elevator.id,
            type=ORDER_TYPE_FAULT,
            planned_date=planned_date,
            due_date=due_date,
            status=ORDER_STATUS_PENDING,
            fault_description=fault_description,
            import_hash=import_hash
        )
        return self.store.orders.add(order)

    def assign_order(self, order_no: str, tech_name: str) -> MaintenanceOrder:
        """派单给师傅"""
        orders = self.store.orders.find(lambda o: o.order_no == order_no)
        if not orders:
            raise ServiceException(
                f"维保单 [{order_no}] 不存在",
                reason=f"请核对单号是否正确"
            )
        order = orders[0]

        if order.status == ORDER_STATUS_COMPLETED:
            raise ServiceException(
                f"维保单 [{order_no}] 已完成",
                reason=f"已完成的工单不能重新派单"
            )

        techs = self.store.technicians.find(lambda t: t.name == tech_name)
        if not techs:
            raise ServiceException(
                f"师傅 [{tech_name}] 不存在",
                reason=f"请先添加师傅"
            )
        tech = techs[0]
        if not tech.is_active:
            raise ServiceException(
                f"师傅 [{tech_name}] 已离职",
                reason=f"不能派单给离职人员"
            )

        planned_date = order.planned_date or now_date()
        vac = self.check_technician_on_vacation(tech.id, planned_date)
        if vac:
            raise ServiceException(
                f"师傅 [{tech_name}] 在 [{planned_date}] 休假",
                reason=f"休假期间：{vac.start_date} ~ {vac.end_date}，原因：{vac.reason or '未说明'}，"
                       f"请更换师傅或调整派单日期"
            )

        order.technician_id = tech.id
        order.status = ORDER_STATUS_ASSIGNED
        order.assigned_at = now_date()
        return self.store.orders.update(order)

    def complete_order(self, order_no: str, proof_url: str = "",
                        proof_notes: str = "",
                        completed_date: Optional[date] = None) -> MaintenanceOrder:
        """完成维保单"""
        orders = self.store.orders.find(lambda o: o.order_no == order_no)
        if not orders:
            raise ServiceException(
                f"维保单 [{order_no}] 不存在",
                reason=f"请核对单号是否正确"
            )
        order = orders[0]

        if order.status == ORDER_STATUS_COMPLETED:
            raise ServiceException(
                f"维保单 [{order_no}] 已完成",
                reason=f"不能重复提交完成"
            )

        if order.technician_id is None:
            raise ServiceException(
                f"维保单 [{order_no}] 尚未派单",
                reason=f"请先派单：python -m elevator_cli order assign {order_no} <师傅姓名>"
            )

        if completed_date is None:
            completed_date = now_date()

        if order.due_date and completed_date > order.due_date:
            overdue_days = (completed_date - order.due_date).days
            raise ServiceException(
                f"维保单 [{order_no}] 已逾期 {overdue_days} 天，不能标记为正常完成",
                reason=f"到期日期：{order.due_date}，实际完成：{completed_date}，"
                       f"逾期工单需要走升级流程：python -m elevator_cli order escalate {order_no}"
            )

        elevator = self.store.elevators.get_by_id(order.elevator_id)
        if elevator:
            elevator.last_maintenance_date = completed_date
            self.store.elevators.update(elevator)

        order.status = ORDER_STATUS_COMPLETED
        order.completed_date = completed_date
        order.proof_url = proof_url
        order.proof_notes = proof_notes
        return self.store.orders.update(order)

    def escalate_order(self, order_no: str, notes: str = "") -> MaintenanceOrder:
        """升级工单"""
        orders = self.store.orders.find(lambda o: o.order_no == order_no)
        if not orders:
            raise ServiceException(
                f"维保单 [{order_no}] 不存在",
                reason=f"请核对单号是否正确"
            )
        order = orders[0]

        if order.status == ORDER_STATUS_COMPLETED:
            raise ServiceException(
                f"维保单 [{order_no}] 已完成",
                reason=f"已完成的工单不需要升级"
            )
        if order.status == ORDER_STATUS_CANCELLED:
            raise ServiceException(
                f"维保单 [{order_no}] 已取消",
                reason=f"已取消的工单不能升级"
            )
        if order.status == ORDER_STATUS_SUSPENDED:
            raise ServiceException(
                f"维保单 [{order_no}] 已暂停",
                reason=f"已暂停的工单请先恢复：python3 -m elevator_cli order resume {order_no}"
            )

        order.status = ORDER_STATUS_ESCALATED
        if notes:
            order.notes = (order.notes + " | " if order.notes else "") + notes
        return self.store.orders.update(order)

    def cancel_order(self, order_no: str, reason: str = "") -> MaintenanceOrder:
        """取消工单（用于突发故障优先处理场景）"""
        orders = self.store.orders.find(lambda o: o.order_no == order_no)
        if not orders:
            raise ServiceException(
                f"维保单 [{order_no}] 不存在",
                reason=f"请核对单号是否正确"
            )
        order = orders[0]

        if order.status == ORDER_STATUS_COMPLETED:
            raise ServiceException(
                f"维保单 [{order_no}] 已完成",
                reason=f"已完成的工单不能取消"
            )
        if order.status == ORDER_STATUS_CANCELLED:
            raise ServiceException(
                f"维保单 [{order_no}] 已取消",
                reason=f"不能重复取消"
            )

        order.status = ORDER_STATUS_CANCELLED
        if reason:
            order.notes = (order.notes + " | " if order.notes else "") + f"取消原因：{reason}"
        return self.store.orders.update(order)

    def suspend_order(self, order_no: str, reason: str = "") -> MaintenanceOrder:
        """暂停工单（故障处理完后可恢复）"""
        orders = self.store.orders.find(lambda o: o.order_no == order_no)
        if not orders:
            raise ServiceException(
                f"维保单 [{order_no}] 不存在",
                reason=f"请核对单号是否正确"
            )
        order = orders[0]

        if order.status == ORDER_STATUS_COMPLETED:
            raise ServiceException(
                f"维保单 [{order_no}] 已完成",
                reason=f"已完成的工单不需要暂停"
            )
        if order.status == ORDER_STATUS_CANCELLED:
            raise ServiceException(
                f"维保单 [{order_no}] 已取消",
                reason=f"已取消的工单不能暂停"
            )
        if order.status == ORDER_STATUS_SUSPENDED:
            raise ServiceException(
                f"维保单 [{order_no}] 已暂停",
                reason=f"不能重复暂停"
            )

        order.status = ORDER_STATUS_SUSPENDED
        if reason:
            order.notes = (order.notes + " | " if order.notes else "") + f"暂停原因：{reason}"
        return self.store.orders.update(order)

    def resume_order(self, order_no: str) -> MaintenanceOrder:
        """恢复已暂停的工单"""
        orders = self.store.orders.find(lambda o: o.order_no == order_no)
        if not orders:
            raise ServiceException(
                f"维保单 [{order_no}] 不存在",
                reason=f"请核对单号是否正确"
            )
        order = orders[0]

        if order.status != ORDER_STATUS_SUSPENDED:
            status_names = {
                ORDER_STATUS_PENDING: "待派单",
                ORDER_STATUS_ASSIGNED: "已派单",
                ORDER_STATUS_COMPLETED: "已完成",
                ORDER_STATUS_OVERDUE: "已逾期",
                ORDER_STATUS_ESCALATED: "已升级",
                ORDER_STATUS_CANCELLED: "已取消"
            }
            current_status = status_names.get(order.status, order.status)
            raise ServiceException(
                f"维保单 [{order_no}] 不是暂停状态",
                reason=f"当前状态：{current_status}，只有已暂停的工单才能恢复"
            )

        if order.technician_id:
            order.status = ORDER_STATUS_ASSIGNED
        else:
            order.status = ORDER_STATUS_PENDING
        order.notes = (order.notes + " | " if order.notes else "") + f"已恢复"
        return self.store.orders.update(order)

    def update_order_statuses(self):
        """检查并更新逾期状态"""
        today = now_date()
        updated = []
        for order in self.store.orders.get_all():
            if order.status in [ORDER_STATUS_PENDING, ORDER_STATUS_ASSIGNED]:
                if order.due_date and today > order.due_date:
                    order.status = ORDER_STATUS_OVERDUE
                    self.store.orders.update(order)
                    updated.append(order)
        return updated

    # ==================== 查询辅助 ====================

    def get_building_name(self, building_id: str) -> str:
        b = self.store.buildings.get_by_id(building_id)
        return b.name if b else ""

    def get_elevator_info(self, elevator_id: str) -> Tuple[str, str]:
        e = self.store.elevators.get_by_id(elevator_id)
        if not e:
            return "", ""
        b_name = self.get_building_name(e.building_id)
        return b_name, e.code

    def get_tech_name(self, tech_id: str) -> str:
        if not tech_id:
            return ""
        t = self.store.technicians.get_by_id(tech_id)
        return t.name if t else ""


def calc_import_hash(elevator_code: str, building_name: str,
                     fault_desc: str = "", planned_date: str = "",
                     order_type: str = ORDER_TYPE_PERIODIC) -> str:
    """计算导入哈希，防止重复导入"""
    key = f"{order_type}|{building_name}|{elevator_code}|{planned_date}|{fault_desc}"
    return hashlib.md5(key.encode('utf-8')).hexdigest()[:16]
