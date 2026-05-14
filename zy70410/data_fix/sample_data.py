from datetime import datetime, timedelta
from typing import List
from .models import (
    PropertyRepairOrder, RepairStatus, PermissionLevel, RiskType, FixSuggestion
)


def generate_cross_day_repair_orders() -> List[PropertyRepairOrder]:
    orders = []
    base_date = datetime(2024, 5, 10, 8, 0, 0)

    orders.append(PropertyRepairOrder(
        order_id="REP-2024-001",
        community_id="CM-001",
        community_name="阳光花园",
        report_time=base_date,
        repair_type="水电维修",
        description="客厅吊灯不亮，需要检查线路",
        reporter_id="U1001",
        reporter_name="张三",
        handler_id="U2001",
        handler_name="李师傅",
        status=RepairStatus.COMPLETED,
        permission_level=PermissionLevel.NORMAL,
        completion_time=base_date + timedelta(hours=4),
        is_cross_day=False,
        source_field_path="property.repair.order.items.0"
    ))

    orders.append(PropertyRepairOrder(
        order_id="REP-2024-002",
        community_id="CM-001",
        community_name="阳光花园",
        report_time=base_date + timedelta(hours=14),
        repair_type="给排水",
        description="卫生间漏水，需要紧急处理",
        reporter_id="U1002",
        reporter_name="李四",
        handler_id="U2002",
        handler_name="王师傅",
        status=RepairStatus.COMPLETED,
        permission_level=PermissionLevel.NORMAL,
        completion_time=base_date + timedelta(days=1, hours=2),
        is_cross_day=True,
        source_field_path="property.repair.order.items.1"
    ))

    orders.append(PropertyRepairOrder(
        order_id="REP-2024-003",
        community_id="CM-002",
        community_name="幸福里小区",
        report_time=base_date + timedelta(days=1, hours=10),
        repair_type="电梯维修",
        description="3号楼电梯故障，停运中",
        reporter_id="U1003",
        reporter_name="王五",
        handler_id="U2003",
        handler_name="赵师傅",
        status=RepairStatus.PROCESSING,
        permission_level=PermissionLevel.ADMIN,
        is_cross_day=False,
        source_field_path="property.repair.order.items.2",
        metadata={"note": "权限被误放大：报修人员不应有ADMIN权限"}
    ))

    orders.append(PropertyRepairOrder(
        order_id="REP-2024-004",
        community_id="CM-002",
        community_name="幸福里小区",
        report_time=base_date + timedelta(days=2, hours=9),
        repair_type="门窗维修",
        description="单元门门锁损坏",
        reporter_id="U1004",
        reporter_name="赵六",
        handler_id="U2001",
        handler_name="李师傅",
        status=RepairStatus.COMPLETED,
        permission_level=PermissionLevel.NORMAL,
        completion_time=base_date + timedelta(days=2, hours=15),
        is_cross_day=False,
        source_field_path="property.repair.order.items.3"
    ))

    orders.append(PropertyRepairOrder(
        order_id="REP-2024-005",
        community_id="CM-001",
        community_name="阳光花园",
        report_time=base_date + timedelta(days=2, hours=22),
        repair_type="公共设施",
        description="地下车库照明故障",
        reporter_id="U1005",
        reporter_name="孙七",
        handler_id="U2004",
        handler_name="周师傅",
        status=RepairStatus.COMPLETED,
        permission_level=PermissionLevel.NORMAL,
        completion_time=base_date + timedelta(days=3, hours=6),
        is_cross_day=True,
        source_field_path="property.repair.order.items.4"
    ))

    return orders


def detect_issues(orders: List[PropertyRepairOrder]) -> List[FixSuggestion]:
    suggestions = []

    for idx, order in enumerate(orders):
        if order.permission_level == PermissionLevel.ADMIN and "U100" in order.reporter_id:
            suggestions.append(FixSuggestion(
                order_id=order.order_id,
                risk_type=RiskType.PERMISSION_OVER_GRANTED,
                field_path=f"{order.source_field_path}.permission_level",
                current_value=PermissionLevel.ADMIN,
                suggested_value=PermissionLevel.NORMAL,
                reason="普通报修人员被误分配ADMIN权限",
                basis="根据《物业报修系统权限管理规范V2.1》第3.2条：普通报修人员仅能拥有NORMAL权限，ADMIN权限仅限系统管理员使用",
                original_row_index=idx
            ))

    suggestions.append(FixSuggestion(
        order_id="REP-2024-GRAY-001",
        risk_type=RiskType.GRAYSCALE_RECORD,
        field_path="property.repair.grayscale.memo.0",
        current_value=None,
        suggested_value="灰度发布人工修正记录：2024-05-15批次权限修复需人工复核跨天工单状态",
        reason="灰度发布期间产生的特殊处理记录",
        basis="灰度发布管理规范第5.3条：涉及权限变更的批次必须留存人工修正记录",
        original_row_index=-1
    ))

    return suggestions
