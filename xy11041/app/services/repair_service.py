from datetime import datetime
from typing import List, Dict, Optional, Tuple
from app.models.database import (
    repair_orders_db,
    alarms_db,
    RepairStatus,
    TeamType
)
from app.schemas.repair_order import (
    RepairOrderCreate,
    RepairOrderAccept,
    RepairOrderProcess,
    RepairOrderComplete,
    RepairOrderVerify,
    RepairOrderReject,
    RepairOrderClose
)

class BusinessRuleError(Exception):
    def __init__(self, error_code: str, message: str, detail: dict):
        self.error_code = error_code
        self.message = message
        self.detail = detail
        super().__init__(message)

class RepairOrderService:
    @staticmethod
    def _generate_order_id() -> str:
        date_str = datetime.now().strftime("%Y%m%d")
        count = len([oid for oid in repair_orders_db.keys() if date_str in oid]) + 1
        return f"RO-{date_str}-{count:03d}"

    @staticmethod
    def _check_duplicate_accept(alarm_id: str, exclude_order_id: Optional[str] = None) -> Tuple[bool, List[Dict]]:
        existing_orders = []
        for order_id, order in repair_orders_db.items():
            if exclude_order_id and order_id == exclude_order_id:
                continue
            if order["alarm_id"] == alarm_id and order["status"] in [
                RepairStatus.ACCEPTED,
                RepairStatus.IN_PROGRESS,
                RepairStatus.PENDING_REVIEW
            ]:
                existing_orders.append(order)
        return len(existing_orders) > 0, existing_orders

    @staticmethod
    def _check_consistency_before_close(order: Dict) -> Tuple[bool, List[str]]:
        issues = []
        
        if not order.get("arrival_time"):
            issues.append("缺少到达现场时间")
        
        if not order.get("repair_start_time"):
            issues.append("缺少维修开始时间")
        
        if not order.get("repair_end_time"):
            issues.append("缺少维修结束时间")
        
        if not order.get("repair_content") or len(order["repair_content"].strip()) < 10:
            issues.append("维修内容描述不充分，至少需要10个字符")
        
        if not order.get("verification_result"):
            issues.append("缺少故障验证结果")
        
        if not order.get("verification_user"):
            issues.append("缺少验证人信息")
        
        if order.get("repair_start_time") and order.get("repair_end_time"):
            if order["repair_end_time"] < order["repair_start_time"]:
                issues.append("维修结束时间不能早于开始时间")
        
        return len(issues) == 0, issues

    @classmethod
    async def create_order(cls, order_data: RepairOrderCreate) -> Dict:
        has_duplicate, existing_orders = cls._check_duplicate_accept(order_data.alarm_id)
        
        if has_duplicate:
            accepted_teams = [o["assigned_team"] for o in existing_orders]
            raise BusinessRuleError(
                error_code="DUPLICATE_ACCEPT",
                message="该告警已有班组接单处理",
                detail={
                    "intercept_reason": f"告警 {order_data.alarm_id} 已被以下班组接单：{', '.join(accepted_teams)}",
                    "suggestions": [
                        "确认是否为同一故障的重复派单",
                        "联系已接单班组协调处理",
                        "如故障已解决请关闭当前告警",
                        "转人工调度进行协调"
                    ],
                    "existing_orders": [
                        {
                            "order_id": o["order_id"],
                            "team": o["assigned_team"],
                            "status": o["status"],
                            "accept_time": o.get("accept_time", "")
                        } for o in existing_orders
                    ]
                }
            )
        
        order_id = cls._generate_order_id()
        order_dict = order_data.model_dump()
        order_dict.update({
            "order_id": order_id,
            "dispatch_time": datetime.now(),
            "status": RepairStatus.DISPATCHED,
            "accept_time": None,
            "accept_user": None,
            "arrival_time": None,
            "repair_start_time": None,
            "repair_end_time": None,
            "repair_content": None,
            "replaced_parts": None,
            "verification_result": None,
            "verification_user": None,
            "verification_time": None,
            "close_time": None,
            "close_user": None,
            "reject_reason": None
        })
        
        repair_orders_db[order_id] = order_dict
        return order_dict

    @classmethod
    async def accept_order(cls, order_id: str, accept_data: RepairOrderAccept) -> Dict:
        if order_id not in repair_orders_db:
            raise BusinessRuleError(
                error_code="ORDER_NOT_FOUND",
                message="派修单不存在",
                detail={
                    "intercept_reason": f"派修单 {order_id} 不存在",
                    "suggestions": ["检查派修单号是否正确", "重新查询派修单列表"]
                }
            )
        
        order = repair_orders_db[order_id]
        
        if order["status"] != RepairStatus.DISPATCHED:
            raise BusinessRuleError(
                error_code="INVALID_STATUS",
                message="当前状态不允许接单",
                detail={
                    "intercept_reason": f"派修单 {order_id} 当前状态为 {order['status']}，仅 '已派单' 状态可接单",
                    "suggestions": ["确认派修单状态", "联系调度员核实情况"]
                }
            )
        
        has_duplicate, existing_orders = cls._check_duplicate_accept(
            order["alarm_id"],
            exclude_order_id=order_id
        )
        
        if has_duplicate:
            accepted_teams = [o["assigned_team"] for o in existing_orders]
            raise BusinessRuleError(
                error_code="DUPLICATE_ACCEPT",
                message="该告警已有其他班组接单",
                detail={
                    "intercept_reason": f"告警 {order['alarm_id']} 已被 {', '.join(accepted_teams)} 接单，禁止重复接单",
                    "suggestions": [
                        "联系已接单班组确认是否需要协助",
                        "退回本班组派修单",
                        "转人工调度进行资源协调"
                    ],
                    "existing_orders": [
                        {
                            "order_id": o["order_id"],
                            "team": o["assigned_team"],
                            "status": o["status"]
                        } for o in existing_orders
                    ]
                }
            )
        
        order.update({
            "status": RepairStatus.ACCEPTED,
            "accept_time": datetime.now(),
            "accept_user": accept_data.accept_user
        })
        
        return order

    @classmethod
    async def start_process(cls, order_id: str, process_data: RepairOrderProcess) -> Dict:
        if order_id not in repair_orders_db:
            raise BusinessRuleError(
                error_code="ORDER_NOT_FOUND",
                message="派修单不存在",
                detail={
                    "intercept_reason": f"派修单 {order_id} 不存在",
                    "suggestions": ["检查派修单号是否正确"]
                }
            )
        
        order = repair_orders_db[order_id]
        
        if order["status"] != RepairStatus.ACCEPTED:
            raise BusinessRuleError(
                error_code="INVALID_STATUS",
                message="当前状态不允许开始处理",
                detail={
                    "intercept_reason": f"派修单 {order_id} 当前状态为 {order['status']}，仅 '已接单' 状态可开始处理",
                    "suggestions": ["确认是否已完成接单操作"]
                }
            )
        
        order.update({
            "status": RepairStatus.IN_PROGRESS,
            "arrival_time": process_data.arrival_time,
            "repair_start_time": process_data.repair_start_time
        })
        
        return order

    @classmethod
    async def complete_repair(cls, order_id: str, complete_data: RepairOrderComplete) -> Dict:
        if order_id not in repair_orders_db:
            raise BusinessRuleError(
                error_code="ORDER_NOT_FOUND",
                message="派修单不存在",
                detail={
                    "intercept_reason": f"派修单 {order_id} 不存在",
                    "suggestions": ["检查派修单号是否正确"]
                }
            )
        
        order = repair_orders_db[order_id]
        
        if order["status"] != RepairStatus.IN_PROGRESS:
            raise BusinessRuleError(
                error_code="INVALID_STATUS",
                message="当前状态不允许完成维修",
                detail={
                    "intercept_reason": f"派修单 {order_id} 当前状态为 {order['status']}，仅 '处理中' 状态可完成维修",
                    "suggestions": ["确认维修是否已开始处理"]
                }
            )
        
        order.update({
            "status": RepairStatus.PENDING_REVIEW,
            "repair_end_time": complete_data.repair_end_time,
            "repair_content": complete_data.repair_content,
            "replaced_parts": complete_data.replaced_parts
        })
        
        return order

    @classmethod
    async def verify_repair(cls, order_id: str, verify_data: RepairOrderVerify) -> Dict:
        if order_id not in repair_orders_db:
            raise BusinessRuleError(
                error_code="ORDER_NOT_FOUND",
                message="派修单不存在",
                detail={
                    "intercept_reason": f"派修单 {order_id} 不存在",
                    "suggestions": ["检查派修单号是否正确"]
                }
            )
        
        order = repair_orders_db[order_id]
        
        if order["status"] != RepairStatus.PENDING_REVIEW:
            raise BusinessRuleError(
                error_code="INVALID_STATUS",
                message="当前状态不允许验证",
                detail={
                    "intercept_reason": f"派修单 {order_id} 当前状态为 {order['status']}，仅 '待复核' 状态可验证",
                    "suggestions": ["确认维修是否已提交完成"]
                }
            )
        
        order.update({
            "verification_result": verify_data.verification_result,
            "verification_user": verify_data.verification_user,
            "verification_time": datetime.now()
        })
        
        return order

    @classmethod
    async def reject_order(cls, order_id: str, reject_data: RepairOrderReject) -> Dict:
        if order_id not in repair_orders_db:
            raise BusinessRuleError(
                error_code="ORDER_NOT_FOUND",
                message="派修单不存在",
                detail={
                    "intercept_reason": f"派修单 {order_id} 不存在",
                    "suggestions": ["检查派修单号是否正确"]
                }
            )
        
        order = repair_orders_db[order_id]
        
        if order["status"] not in [RepairStatus.DISPATCHED, RepairStatus.PENDING_REVIEW]:
            raise BusinessRuleError(
                error_code="INVALID_STATUS",
                message="当前状态不允许驳回",
                detail={
                    "intercept_reason": f"派修单 {order_id} 当前状态为 {order['status']}，仅 '已派单' 或 '待复核' 状态可驳回",
                    "suggestions": [
                        "确认派修单状态",
                        "如需取消处理请联系调度员"
                    ]
                }
            )
        
        order.update({
            "status": RepairStatus.REJECTED,
            "reject_reason": reject_data.reject_reason
        })
        
        return order

    @classmethod
    async def close_order(cls, order_id: str, close_data: RepairOrderClose) -> Dict:
        if order_id not in repair_orders_db:
            raise BusinessRuleError(
                error_code="ORDER_NOT_FOUND",
                message="派修单不存在",
                detail={
                    "intercept_reason": f"派修单 {order_id} 不存在",
                    "suggestions": ["检查派修单号是否正确"]
                }
            )
        
        order = repair_orders_db[order_id]
        
        if order["status"] != RepairStatus.PENDING_REVIEW:
            raise BusinessRuleError(
                error_code="INVALID_STATUS",
                message="当前状态不允许闭环",
                detail={
                    "intercept_reason": f"派修单 {order_id} 当前状态为 {order['status']}，仅 '待复核' 状态可闭环",
                    "suggestions": ["确认是否已完成维修验证"]
                }
            )
        
        is_consistent, issues = cls._check_consistency_before_close(order)
        
        if not is_consistent:
            raise BusinessRuleError(
                error_code="INCONSISTENT_CLOSURE",
                message="故障闭环信息不完整",
                detail={
                    "intercept_reason": f"派修单 {order_id} 闭环前校验失败，存在 {len(issues)} 项问题",
                    "issues": issues,
                    "suggestions": [
                        "补充缺失的维修记录",
                        "完善故障验证结果",
                        "检查时间逻辑是否正确",
                        "转人工审核进行强制闭环"
                    ]
                }
            )
        
        order.update({
            "status": RepairStatus.CLOSED,
            "close_time": datetime.now(),
            "close_user": close_data.close_user
        })
        
        return order

    @staticmethod
    async def get_order(order_id: str) -> Optional[Dict]:
        return repair_orders_db.get(order_id)

    @staticmethod
    async def list_orders(status: Optional[RepairStatus] = None) -> List[Dict]:
        orders = list(repair_orders_db.values())
        if status:
            orders = [o for o in orders if o["status"] == status]
        return orders
