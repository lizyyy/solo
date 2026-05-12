from datetime import datetime
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from .models import WorkOrder, OrderHistory, Recommendation, Knowledge, Feedback
from .schemas import OrderStatus
from .engine import RecommendationEngine


class OrderStateMachine:
    VALID_TRANSITIONS = {
        "CREATED": ["RECOMMEND_GENERATED", "EXCEPTION"],
        "RECOMMEND_GENERATED": ["IN_PROGRESS", "EXCEPTION"],
        "IN_PROGRESS": ["FEEDBACK_SUBMITTED", "RECOMMEND_GENERATED", "EXCEPTION"],
        "FEEDBACK_SUBMITTED": ["COMPLETED", "RECOMMEND_GENERATED", "EXCEPTION"],
        "EXCEPTION": ["RECOMMEND_GENERATED", "FEEDBACK_SUBMITTED"],
        "COMPLETED": []
    }

    def __init__(self, db: Session):
        self.db = db

    def _add_history(
        self,
        order: WorkOrder,
        action: str,
        operator: Optional[str] = None,
        reason: Optional[str] = None,
        data_before: Optional[Dict] = None,
        data_after: Optional[Dict] = None
    ) -> OrderHistory:
        sequence = len(order.histories) + 1
        history = OrderHistory(
            order_no=order.order_no,
            sequence=sequence,
            status=order.status,
            operator=operator,
            action=action,
            reason=reason,
            data_before=data_before,
            data_after=data_after,
            created_at=datetime.utcnow()
        )
        self.db.add(history)
        return history

    def can_transition(self, current_status: str, next_status: str) -> bool:
        valid_next = self.VALID_TRANSITIONS.get(current_status, [])
        return next_status in valid_next

    def create_order(
        self,
        order_no: str,
        model_code: str,
        error_code: str,
        description: str,
        engineer_id: Optional[str] = None
    ) -> WorkOrder:
        existing = (
            self.db.query(WorkOrder)
            .filter(WorkOrder.order_no == order_no)
            .first()
        )
        if existing:
            return existing

        order = WorkOrder(
            order_no=order_no,
            model_code=model_code,
            error_code=error_code,
            description=description,
            engineer_id=engineer_id,
            status="CREATED",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        self.db.add(order)
        self.db.flush()

        self._add_history(
            order,
            action="创建工单",
            operator=engineer_id,
            data_after={
                "model_code": model_code,
                "error_code": error_code,
                "description": description
            }
        )

        self.db.commit()
        return order

    def generate_recommendation(
        self,
        order_no: str,
        operator: Optional[str] = None
    ) -> Dict[str, Any]:
        order = (
            self.db.query(WorkOrder)
            .filter(WorkOrder.order_no == order_no)
            .first()
        )
        if not order:
            raise ValueError(f"工单 {order_no} 不存在")

        if not self.can_transition(order.status, "RECOMMEND_GENERATED"):
            if order.status == "RECOMMEND_GENERATED":
                return {
                    "is_idempotent": True,
                    "message": "工单已有未执行的推荐，重复调用返回幂等结果",
                    "current_status": order.status
                }
            raise ValueError(f"当前状态 {order.status} 不能生成推荐")

        engine = RecommendationEngine(self.db)
        result = engine.generate_recommendation(
            order.order_no,
            order.model_code,
            order.error_code,
            order.description
        )

        if result.get("is_idempotent"):
            return result

        rec = Recommendation(
            order_no=order.order_no,
            round_no=result["round_no"],
            is_idempotent=False,
            status="GENERATED",
            recommended_knowledge=result["knowledge_recommendations"],
            similar_histories=result["similar_histories"],
            part_availability=result["part_availability"],
            created_at=datetime.utcnow()
        )
        self.db.add(rec)
        self.db.flush()

        old_status = order.status
        order.status = "RECOMMEND_GENERATED"
        order.current_recommendation_id = rec.id
        order.updated_at = datetime.utcnow()

        self._add_history(
            order,
            action="生成推荐",
            operator=operator,
            data_before={"status": old_status},
            data_after={
                "status": order.status,
                "recommendation_id": rec.id,
                "round_no": result["round_no"],
                "knowledge_count": len(result["knowledge_recommendations"]),
                "similar_count": len(result["similar_histories"])
            }
        )

        self.db.commit()
        return {
            "is_idempotent": False,
            "recommendation_id": rec.id,
            "round_no": result["round_no"],
            "knowledge_recommendations": result["knowledge_recommendations"],
            "similar_histories": result["similar_histories"],
            "part_availability": result["part_availability"]
        }

    def execute_recommendation(
        self,
        order_no: str,
        operator: Optional[str] = None,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        order = (
            self.db.query(WorkOrder)
            .filter(WorkOrder.order_no == order_no)
            .first()
        )
        if not order:
            raise ValueError(f"工单 {order_no} 不存在")

        if not self.can_transition(order.status, "IN_PROGRESS"):
            if order.status == "IN_PROGRESS":
                return {
                    "is_idempotent": True,
                    "message": "工单已在执行中，重复调用返回幂等结果",
                    "current_status": order.status
                }
            raise ValueError(f"当前状态 {order.status} 不能执行")

        rec = (
            self.db.query(Recommendation)
            .filter(Recommendation.id == order.current_recommendation_id)
            .first()
        )
        if rec:
            rec.status = "EXECUTED"

        old_status = order.status
        order.status = "IN_PROGRESS"
        order.updated_at = datetime.utcnow()

        self._add_history(
            order,
            action="执行推荐",
            operator=operator,
            reason=reason,
            data_before={"status": old_status},
            data_after={"status": order.status}
        )

        self.db.commit()
        return {
            "order_no": order_no,
            "status": order.status,
            "recommendation_id": order.current_recommendation_id
        }

    def submit_feedback(
        self,
        order_no: str,
        feedback_data: Dict[str, Any],
        operator: Optional[str] = None,
        is_manual_correction: bool = False
    ) -> Dict[str, Any]:
        order = (
            self.db.query(WorkOrder)
            .filter(WorkOrder.order_no == order_no)
            .first()
        )
        if not order:
            raise ValueError(f"工单 {order_no} 不存在")

        rec = (
            self.db.query(Recommendation)
            .filter(Recommendation.id == order.current_recommendation_id)
            .first()
        )
        if not rec:
            raise ValueError("当前没有有效的推荐记录")

        if rec.feedback:
            return {
                "is_idempotent": True,
                "message": "该推荐已反馈，重复调用返回幂等结果",
                "current_feedback": rec.feedback
            }

        knowledge_code = feedback_data.get("knowledge_code")
        effectiveness = feedback_data.get("effectiveness", 0)
        comment = feedback_data.get("comment", "")

        kl = (
            self.db.query(Knowledge)
            .filter(Knowledge.knowledge_code == knowledge_code)
            .first()
        )

        data_before = None
        data_after = None
        if kl:
            data_before = {
                "success_count": kl.success_count,
                "total_usage": kl.total_usage
            }
            kl.total_usage += 1
            if effectiveness >= 70:
                kl.success_count += 1
            data_after = {
                "success_count": kl.success_count,
                "total_usage": kl.total_usage
            }

        feedback = Feedback(
            recommendation_id=rec.id,
            knowledge_code=knowledge_code,
            effectiveness=effectiveness,
            comment=comment,
            operator=operator,
            is_manual_correction=is_manual_correction,
            manual_diff_before=feedback_data.get("diff_before"),
            manual_diff_after=feedback_data.get("diff_after"),
            created_at=datetime.utcnow()
        )
        self.db.add(feedback)

        rec.feedback = {
            "knowledge_code": knowledge_code,
            "effectiveness": effectiveness,
            "comment": comment,
            "is_manual_correction": is_manual_correction,
            "operator": operator
        }
        rec.status = "FEEDBACK"

        old_status = order.status
        order.status = "FEEDBACK_SUBMITTED"
        order.updated_at = datetime.utcnow()

        self._add_history(
            order,
            action="提交反馈" if not is_manual_correction else "人工修正",
            operator=operator,
            reason=comment,
            data_before={
                "status": old_status,
                "knowledge_stats": data_before
            },
            data_after={
                "status": order.status,
                "knowledge_stats": data_after,
                "effectiveness": effectiveness,
                "is_manual_correction": is_manual_correction
            }
        )

        self.db.commit()
        return {
            "feedback_id": feedback.id,
            "effectiveness": effectiveness,
            "knowledge_updated": data_after is not None,
            "is_manual_correction": is_manual_correction
        }

    def complete_order(
        self,
        order_no: str,
        operator: Optional[str] = None,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        order = (
            self.db.query(WorkOrder)
            .filter(WorkOrder.order_no == order_no)
            .first()
        )
        if not order:
            raise ValueError(f"工单 {order_no} 不存在")

        if not self.can_transition(order.status, "COMPLETED"):
            if order.status == "COMPLETED":
                return {
                    "is_idempotent": True,
                    "message": "工单已完成",
                    "current_status": order.status
                }
            raise ValueError(f"当前状态 {order.status} 不能完成")

        old_status = order.status
        order.status = "COMPLETED"
        order.updated_at = datetime.utcnow()

        self._add_history(
            order,
            action="完成工单",
            operator=operator,
            reason=reason,
            data_before={"status": old_status},
            data_after={"status": order.status}
        )

        self.db.commit()
        return {
            "order_no": order_no,
            "status": "COMPLETED",
            "completed_at": datetime.utcnow().isoformat()
        }

    def record_exception(
        self,
        order_no: str,
        error_message: str,
        operator: Optional[str] = None
    ) -> Dict[str, Any]:
        order = (
            self.db.query(WorkOrder)
            .filter(WorkOrder.order_no == order_no)
            .first()
        )
        if not order:
            raise ValueError(f"工单 {order_no} 不存在")

        old_status = order.status
        order.status = "EXCEPTION"
        order.updated_at = datetime.utcnow()

        self._add_history(
            order,
            action="异常处理",
            operator=operator,
            reason=error_message,
            data_before={"status": old_status},
            data_after={"status": order.status, "error": error_message}
        )

        self.db.commit()
        return {
            "order_no": order_no,
            "status": "EXCEPTION",
            "error_message": error_message
        }
