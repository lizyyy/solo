from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.models import (
    RepairOrder, StatusLog, DeviceCategory, SparePart, SpareUsage,
    RepairWorker, AcceptanceRecord,
)
from app.schemas import (
    RepairOrderCreate, AssignRequest, CompleteRequest, AcceptRequest,
    SpareUsageCreate,
)
from app.state_machine import (
    StateMachine, RepairStatus, RepairAction, STATUS_DISPLAY, ACTION_DISPLAY,
    StatusTransitionError, DuplicateOperationError, IdempotencyGuard,
)
from app.dispatch_engine import DispatchRuleEngine


class RepairService:
    def __init__(self, db: Session):
        self.db = db
        self.dispatch_engine = DispatchRuleEngine()

    def _generate_order_no(self) -> str:
        today = datetime.utcnow().strftime("%Y%m%d")
        count = self.db.query(RepairOrder).filter(
            RepairOrder.order_no.like(f"R{today}%")
        ).count()
        return f"R{today}{count + 1:04d}"

    def _get_category_name(self, code: str) -> str:
        cat = self.db.query(DeviceCategory).filter(
            DeviceCategory.code == code
        ).first()
        return cat.name if cat else code

    def _format_order_response(self, order: RepairOrder) -> Dict[str, Any]:
        return {
            "id": order.id,
            "order_no": order.order_no,
            "classroom": order.classroom,
            "device_category_code": order.device_category_code,
            "device_category_name": self._get_category_name(order.device_category_code),
            "reported_by": order.reported_by,
            "reporter_phone": order.reporter_phone,
            "fault_description": order.fault_description,
            "fault_level": order.fault_level,
            "priority": order.priority,
            "status": order.status,
            "status_display": STATUS_DISPLAY.get(order.status, order.status),
            "assigned_to": order.assigned_to,
            "assigned_at": order.assigned_at,
            "completed_at": order.completed_at,
            "accepted_at": order.accepted_at,
            "created_at": order.created_at,
            "updated_at": order.updated_at,
        }

    def create_order(self, data: RepairOrderCreate) -> Dict[str, Any]:
        category = self.db.query(DeviceCategory).filter(
            DeviceCategory.code == data.device_category_code,
            DeviceCategory.is_active == True,
        ).first()
        if not category:
            return {
                "success": False,
                "message": f"设备分类「{data.device_category_code}」不存在或已停用",
                "code": "CATEGORY_NOT_FOUND",
            }

        pending_orders = self.db.query(RepairOrder).filter(
            RepairOrder.status.in_([
                RepairStatus.PENDING,
                RepairStatus.ASSIGNED,
                RepairStatus.PROCESSING,
            ])
        ).all()

        priority_info = self.dispatch_engine.calculate_priority(
            fault_level=data.fault_level,
            category_weight=category.priority_weight,
            same_classroom_concurrent=len([
                o for o in pending_orders if o.classroom == data.classroom
            ]),
        )

        order = RepairOrder(
            order_no=self._generate_order_no(),
            classroom=data.classroom,
            device_category_code=data.device_category_code,
            reported_by=data.reported_by,
            reporter_phone=data.reporter_phone,
            fault_description=data.fault_description,
            fault_level=data.fault_level,
            priority=priority_info["priority_value"],
            status=RepairStatus.PENDING,
        )
        self.db.add(order)
        self.db.flush()

        log = StatusLog(
            repair_order_id=order.id,
            from_status=None,
            to_status=RepairStatus.PENDING,
            operator=data.reported_by,
            remark="报修单创建",
            operation_key="create",
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(order)

        concurrent_analysis = self.dispatch_engine.analyze_concurrent_repairs(
            classroom=data.classroom,
            device_category_code=data.device_category_code,
            pending_orders=pending_orders,
        )

        result = self._format_order_response(order)
        result["priority_info"] = priority_info
        if concurrent_analysis["should_combine"]:
            result["concurrent_warning"] = concurrent_analysis["combine_advice"]
            result["concurrent_devices"] = concurrent_analysis["concurrent_devices"]

        return {
            "success": True,
            "message": f"报修单「{order.order_no}」创建成功，当前状态：待派单",
            "data": result,
        }

    def assign_order(
        self,
        order_id: int,
        data: AssignRequest,
        operator: str,
    ) -> Dict[str, Any]:
        return self._execute_transition(
            order_id=order_id,
            action=RepairAction.ASSIGN,
            operator=operator,
            extra_action=lambda order: self._do_assign(order, data.assigned_to),
            remark=f"派单给：{data.assigned_to}",
        )

    def _do_assign(self, order: RepairOrder, worker_name: str) -> None:
        worker = self.db.query(RepairWorker).filter(
            RepairWorker.name == worker_name
        ).first()

        if worker:
            if not worker.is_available:
                raise ValueError(f"维修人员「{worker_name}」当前不可用")
            worker.current_load += 1

        order.assigned_to = worker_name
        order.assigned_at = datetime.utcnow()

    def start_process(
        self,
        order_id: int,
        operator: str,
    ) -> Dict[str, Any]:
        return self._execute_transition(
            order_id=order_id,
            action=RepairAction.START_PROCESS,
            operator=operator,
            remark="维修人员开始现场维修",
        )

    def complete_order(
        self,
        order_id: int,
        data: CompleteRequest,
    ) -> Dict[str, Any]:
        def extra(order: RepairOrder) -> None:
            order.completed_at = datetime.utcnow()

        return self._execute_transition(
            order_id=order_id,
            action=RepairAction.COMPLETE,
            operator=data.completed_by,
            extra_action=extra,
            remark=f"维修完成。解决方案：{data.solution}",
        )

    def accept_order(
        self,
        order_id: int,
        data: AcceptRequest,
    ) -> Dict[str, Any]:
        if data.result == "passed":
            action = RepairAction.ACCEPT
        elif data.result == "failed":
            action = RepairAction.REJECT
        else:
            return {
                "success": False,
                "message": "验收结果只能是 passed（通过）或 failed（不通过）",
                "code": "INVALID_ACCEPT_RESULT",
            }

        def extra(order: RepairOrder) -> None:
            record = AcceptanceRecord(
                repair_order_id=order.id,
                result="通过" if data.result == "passed" else "不通过",
                accepted_by=data.accepted_by,
                comment=data.comment,
                solution_summary="",
            )
            self.db.add(record)

            if data.result == "passed":
                order.accepted_at = datetime.utcnow()
                if order.assigned_to:
                    worker = self.db.query(RepairWorker).filter(
                        RepairWorker.name == order.assigned_to
                    ).first()
                    if worker and worker.current_load > 0:
                        worker.current_load -= 1

        result_remark = "验收通过" if data.result == "passed" else "验收不通过，需重新维修"
        if data.comment:
            result_remark += f"。验收意见：{data.comment}"

        return self._execute_transition(
            order_id=order_id,
            action=action,
            operator=data.accepted_by,
            extra_action=extra,
            remark=result_remark,
        )

    def cancel_order(
        self,
        order_id: int,
        operator: str,
        reason: str = "",
    ) -> Dict[str, Any]:
        remark = "报修单取消"
        if reason:
            remark += f"。原因：{reason}"

        return self._execute_transition(
            order_id=order_id,
            action=RepairAction.CANCEL,
            operator=operator,
            remark=remark,
        )

    def _execute_transition(
        self,
        order_id: int,
        action: str,
        operator: str,
        extra_action=None,
        remark: str = "",
    ) -> Dict[str, Any]:
        order = self.db.query(RepairOrder).filter(RepairOrder.id == order_id).first()
        if not order:
            return {
                "success": False,
                "message": f"报修单 ID {order_id} 不存在",
                "code": "ORDER_NOT_FOUND",
            }

        try:
            can, reason = StateMachine.can_transition(order.status, action)
            if not can:
                raise StatusTransitionError(order.status, action, reason)

            last_logs = self.db.query(StatusLog).filter(
                StatusLog.repair_order_id == order.id
            ).order_by(StatusLog.created_at.desc()).limit(10).all()

            target_status = StateMachine._transitions[order.status][action]
            is_dup, dup_error = IdempotencyGuard.check_duplicate(
                current_status=order.status,
                target_status=target_status,
                action=action,
                last_logs=[{
                    "to_status": log.to_status,
                    "operation_key": log.operation_key,
                    "created_at": log.created_at,
                } for log in last_logs],
            )
            if is_dup and dup_error:
                return {
                    "success": False,
                    "message": dup_error.get_user_message(),
                    "code": "DUPLICATE_OPERATION",
                }

            from_status = order.status
            next_status = StateMachine.get_next_status(from_status, action)
            order.status = next_status

            if extra_action:
                extra_action(order)

            log = StatusLog(
                repair_order_id=order.id,
                from_status=from_status,
                to_status=next_status,
                operator=operator,
                remark=remark,
                operation_key=action,
            )
            self.db.add(log)

            self.db.commit()
            self.db.refresh(order)

            action_display = ACTION_DISPLAY.get(action, action)
            status_display = STATUS_DISPLAY.get(next_status, next_status)

            return {
                "success": True,
                "message": f"「{action_display}」成功，报修单「{order.order_no}」状态更新为：{status_display}",
                "data": self._format_order_response(order),
            }

        except StatusTransitionError as e:
            self.db.rollback()
            return {
                "success": False,
                "message": e.get_user_message(),
                "code": "STATUS_TRANSITION_ERROR",
            }
        except Exception as e:
            self.db.rollback()
            return {
                "success": False,
                "message": f"操作失败：{str(e)}",
                "code": "OPERATION_ERROR",
            }

    def get_order(self, order_id: int) -> Dict[str, Any]:
        order = self.db.query(RepairOrder).filter(RepairOrder.id == order_id).first()
        if not order:
            return {
                "success": False,
                "message": f"报修单 ID {order_id} 不存在",
                "code": "ORDER_NOT_FOUND",
            }

        result = self._format_order_response(order)

        status_logs = []
        for log in order.status_logs:
            status_logs.append({
                "id": log.id,
                "from_status": STATUS_DISPLAY.get(log.from_status, log.from_status) if log.from_status else None,
                "to_status": STATUS_DISPLAY.get(log.to_status, log.to_status),
                "operator": log.operator,
                "remark": log.remark,
                "created_at": log.created_at,
            })
        result["status_logs"] = status_logs

        spare_usages = []
        for usage in order.spare_usage:
            spare = usage.spare_part
            spare_usages.append({
                "id": usage.id,
                "spare_part_code": spare.code,
                "spare_part_name": spare.name,
                "quantity": usage.quantity,
                "unit": spare.unit,
                "unit_price": spare.unit_price,
                "total_price": usage.quantity * spare.unit_price,
                "used_by": usage.used_by,
                "remark": usage.remark,
                "created_at": usage.created_at,
            })
        result["spare_usage"] = spare_usages

        if order.acceptance:
            result["acceptance"] = {
                "id": order.acceptance.id,
                "result": order.acceptance.result,
                "accepted_by": order.acceptance.accepted_by,
                "comment": order.acceptance.comment,
                "solution_summary": order.acceptance.solution_summary,
                "created_at": order.acceptance.created_at,
            }

        available_actions = StateMachine.get_available_actions(order.status)
        result["available_actions"] = [
            {
                "code": a,
                "name": ACTION_DISPLAY.get(a, a),
            }
            for a in available_actions
        ]

        return {
            "success": True,
            "data": result,
        }

    def list_orders(
        self,
        status: Optional[str] = None,
        classroom: Optional[str] = None,
        category: Optional[str] = None,
    ) -> Dict[str, Any]:
        query = self.db.query(RepairOrder)

        if status:
            valid_statuses = [s.value for s in RepairStatus]
            if status not in valid_statuses:
                return {
                    "success": False,
                    "message": f"未知状态「{status}」，有效状态：{', '.join(valid_statuses)}",
                    "code": "INVALID_STATUS",
                }
            query = query.filter(RepairOrder.status == status)
        if classroom:
            query = query.filter(RepairOrder.classroom.contains(classroom))
        if category:
            query = query.filter(RepairOrder.device_category_code == category)

        orders = query.order_by(RepairOrder.priority.desc(), RepairOrder.created_at.desc()).all()

        return {
            "success": True,
            "count": len(orders),
            "data": [self._format_order_response(o) for o in orders],
        }


class SpareService:
    def __init__(self, db: Session):
        self.db = db

    def use_spare(
        self,
        order_id: int,
        data: SpareUsageCreate,
    ) -> Dict[str, Any]:
        order = self.db.query(RepairOrder).filter(RepairOrder.id == order_id).first()
        if not order:
            return {
                "success": False,
                "message": f"报修单 ID {order_id} 不存在",
                "code": "ORDER_NOT_FOUND",
            }

        if order.status not in [RepairStatus.PROCESSING, RepairStatus.ASSIGNED]:
            return {
                "success": False,
                "message": f"当前状态「{STATUS_DISPLAY.get(order.status, order.status)}」不能领用备件，需先开始维修",
                "code": "INVALID_STATUS_FOR_SPARE",
            }

        spare = self.db.query(SparePart).filter(
            SparePart.code == data.spare_part_code
        ).first()
        if not spare:
            return {
                "success": False,
                "message": f"备件编码「{data.spare_part_code}」不存在",
                "code": "SPARE_NOT_FOUND",
            }

        if spare.stock_quantity < data.quantity:
            return {
                "success": False,
                "message": f"备件「{spare.name}」库存不足，当前库存：{spare.stock_quantity} {spare.unit}，需领用：{data.quantity} {spare.unit}",
                "code": "INSUFFICIENT_STOCK",
                "data": {
                    "spare_name": spare.name,
                    "current_stock": spare.stock_quantity,
                    "requested": data.quantity,
                },
            }

        usage = SpareUsage(
            repair_order_id=order.id,
            spare_part_id=spare.id,
            quantity=data.quantity,
            used_by=data.used_by,
            remark=data.remark,
        )
        self.db.add(usage)

        spare.stock_quantity -= data.quantity

        self.db.commit()
        self.db.refresh(usage)
        self.db.refresh(spare)

        total_cost = data.quantity * spare.unit_price

        return {
            "success": True,
            "message": f"备件「{spare.name}」领用成功，数量：{data.quantity} {spare.unit}，价值：¥{total_cost:.2f}",
            "data": {
                "id": usage.id,
                "spare_part_code": spare.code,
                "spare_part_name": spare.name,
                "quantity": data.quantity,
                "unit": spare.unit,
                "unit_price": spare.unit_price,
                "total_price": total_cost,
                "remaining_stock": spare.stock_quantity,
                "used_by": data.used_by,
                "remark": data.remark,
                "created_at": usage.created_at,
            },
        }

    def list_spare_parts(self) -> Dict[str, Any]:
        parts = self.db.query(SparePart).order_by(SparePart.stock_quantity.asc()).all()
        return {
            "success": True,
            "count": len(parts),
            "data": [{
                "id": p.id,
                "code": p.code,
                "name": p.name,
                "model": p.model,
                "unit": p.unit,
                "stock_quantity": p.stock_quantity,
                "unit_price": p.unit_price,
                "total_value": p.stock_quantity * p.unit_price,
                "low_stock_warning": p.stock_quantity < 3,
            } for p in parts],
        }


class StatisticsService:
    def __init__(self, db: Session):
        self.db = db

    def get_campus_stats(self) -> Dict[str, Any]:
        total = self.db.query(RepairOrder).count()

        status_counts = {}
        for status in RepairStatus:
            count = self.db.query(RepairOrder).filter(
                RepairOrder.status == status
            ).count()
            status_counts[STATUS_DISPLAY.get(status, status)] = count

        category_stats_raw = self.db.query(
            RepairOrder.device_category_code,
            func.count(RepairOrder.id).label("count"),
        ).group_by(RepairOrder.device_category_code).all()

        category_stats = []
        for code, count in category_stats_raw:
            cat_name = code
            cat = self.db.query(DeviceCategory).filter(
                DeviceCategory.code == code
            ).first()
            if cat:
                cat_name = cat.name

            completed = self.db.query(RepairOrder).filter(
                RepairOrder.device_category_code == code,
                RepairOrder.status.in_([RepairStatus.ACCEPTED, RepairStatus.COMPLETED]),
            ).count()

            category_stats.append({
                "category_code": code,
                "category_name": cat_name,
                "total_count": count,
                "completed_count": completed,
                "completion_rate": f"{(completed / count * 100):.1f}%" if count > 0 else "0%",
            })

        classroom_stats = self.db.query(
            RepairOrder.classroom,
            func.count(RepairOrder.id).label("count"),
        ).group_by(RepairOrder.classroom).order_by(func.count(RepairOrder.id).desc()).limit(5).all()

        classroom_top = [{
            "classroom": cr,
            "issue_count": cnt,
            "description": f"累计报修 {cnt} 次，建议重点巡检",
        } for cr, cnt in classroom_stats]

        accepted_orders = self.db.query(RepairOrder).filter(
            RepairOrder.status == RepairStatus.ACCEPTED,
            RepairOrder.accepted_at.isnot(None),
            RepairOrder.created_at.isnot(None),
        ).all()

        total_hours = 0.0
        completed_count = 0
        for order in accepted_orders:
            if order.accepted_at and order.created_at:
                delta = order.accepted_at - order.created_at
                total_hours += delta.total_seconds() / 3600
                completed_count += 1

        avg_hours = total_hours / completed_count if completed_count > 0 else 0.0

        total_cost = 0.0
        usages = self.db.query(SpareUsage).all()
        for usage in usages:
            if usage.spare_part:
                total_cost += usage.quantity * usage.spare_part.unit_price

        pending = status_counts.get("待派单", 0) + status_counts.get("已派单", 0)
        processing = status_counts.get("维修中", 0)

        return {
            "success": True,
            "data": {
                "overview": {
                    "total_reports": total,
                    "pending_assign": status_counts.get("待派单", 0),
                    "in_progress": processing,
                    "pending_acceptance": status_counts.get("待验收", 0),
                    "accepted": status_counts.get("已验收通过", 0),
                    "rejected": status_counts.get("验收不通过", 0),
                    "cancelled": status_counts.get("已取消", 0),
                },
                "status_summary": status_counts,
                "efficiency": {
                    "avg_completion_hours": round(avg_hours, 1),
                    "avg_completion_days": round(avg_hours / 8, 1),
                    "description": f"平均 {avg_hours:.1f} 小时（约 {avg_hours/8:.1f} 个工作日）完成验收",
                },
                "cost": {
                    "total_spare_cost": round(total_cost, 2),
                    "description": f"备件累计消耗：¥{total_cost:.2f}",
                },
                "category_breakdown": category_stats,
                "classroom_hotspots": classroom_top,
            },
        }


class ReferenceDataService:
    def __init__(self, db: Session):
        self.db = db

    def list_categories(self) -> Dict[str, Any]:
        cats = self.db.query(DeviceCategory).filter(
            DeviceCategory.is_active == True
        ).order_by(DeviceCategory.priority_weight.desc()).all()

        return {
            "success": True,
            "count": len(cats),
            "data": [{
                "id": c.id,
                "code": c.code,
                "name": c.name,
                "description": c.description,
                "priority_weight": c.priority_weight,
                "priority_hint": f"权重 {c.priority_weight}（越高越优先）",
            } for c in cats],
        }

    def list_workers(self) -> Dict[str, Any]:
        workers = self.db.query(RepairWorker).order_by(
            RepairWorker.is_available.desc(),
            RepairWorker.current_load.asc(),
        ).all()

        return {
            "success": True,
            "count": len(workers),
            "data": [{
                "id": w.id,
                "name": w.name,
                "phone": w.phone,
                "specialty_category": w.specialty_category,
                "is_available": w.is_available,
                "current_load": w.current_load,
                "status_display": "可用" if w.is_available else "不可用",
                "load_description": f"当前负责 {w.current_load} 项维修",
            } for w in workers],
        }
