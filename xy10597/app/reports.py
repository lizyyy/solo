from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from .models import WorkOrder, Knowledge, Feedback, Recommendation, SparePart


class ReportService:
    def __init__(self, db: Session):
        self.db = db

    def get_knowledge_improvement_report(self) -> Dict[str, Any]:
        all_kl = self.db.query(Knowledge).all()
        all_feedback = self.db.query(Feedback).all()
        all_orders = self.db.query(WorkOrder).all()

        knowledge_stats = []
        for kl in all_kl:
            success_rate = (
                kl.success_count / kl.total_usage if kl.total_usage > 0 else 0
            )
            feedbacks = [
                f for f in all_feedback if f.knowledge_code == kl.knowledge_code
            ]
            avg_effectiveness = (
                sum(f.effectiveness for f in feedbacks) / len(feedbacks)
                if feedbacks else 0
            )

            knowledge_stats.append({
                "knowledge_code": kl.knowledge_code,
                "error_code": kl.error_code,
                "title": kl.title,
                "total_usage": kl.total_usage,
                "success_count": kl.success_count,
                "success_rate": round(success_rate * 100, 2),
                "avg_effectiveness": round(avg_effectiveness, 2),
                "is_expired": (
                    kl.expiration_date and datetime.utcnow() > kl.expiration_date
                ),
                "model_codes": kl.model_codes
            })

        manual_corrections = [
            f for f in all_feedback if f.is_manual_correction
        ]

        return {
            "generated_at": datetime.utcnow().isoformat(),
            "summary": {
                "total_knowledge": len(all_kl),
                "expired_knowledge": len([
                    k for k in all_kl
                    if k.expiration_date and datetime.utcnow() > k.expiration_date
                ]),
                "total_orders": len(all_orders),
                "completed_orders": len([
                    o for o in all_orders if o.status == "COMPLETED"
                ]),
                "manual_corrections": len(manual_corrections)
            },
            "knowledge_performance": sorted(
                knowledge_stats,
                key=lambda x: x["success_rate"],
                reverse=True
            ),
            "manual_correction_details": [
                {
                    "id": f.id,
                    "operator": f.operator,
                    "knowledge_code": f.knowledge_code,
                    "effectiveness": f.effectiveness,
                    "diff_before": f.manual_diff_before,
                    "diff_after": f.manual_diff_after,
                    "created_at": f.created_at.isoformat()
                }
                for f in manual_corrections
            ]
        }

    def get_order_detail_report(self, order_no: str) -> Dict[str, Any]:
        order = (
            self.db.query(WorkOrder)
            .filter(WorkOrder.order_no == order_no)
            .first()
        )
        if not order:
            return None

        recommendations = (
            self.db.query(Recommendation)
            .filter(Recommendation.order_no == order_no)
            .order_by(Recommendation.round_no)
            .all()
        )

        feedbacks = []
        for rec in recommendations:
            f_list = (
                self.db.query(Feedback)
                .filter(Feedback.recommendation_id == rec.id)
                .all()
            )
            feedbacks.extend(f_list)

        return {
            "order_basic": {
                "order_no": order.order_no,
                "model_code": order.model_code,
                "error_code": order.error_code,
                "description": order.description,
                "status": order.status,
                "engineer_id": order.engineer_id,
                "created_at": order.created_at.isoformat(),
                "updated_at": order.updated_at.isoformat()
            },
            "history_timeline": [
                {
                    "sequence": h.sequence,
                    "status": h.status,
                    "action": h.action,
                    "operator": h.operator,
                    "reason": h.reason,
                    "created_at": h.created_at.isoformat(),
                    "data_before": h.data_before,
                    "data_after": h.data_after
                }
                for h in order.histories
            ],
            "recommendations": [
                {
                    "round_no": r.round_no,
                    "status": r.status,
                    "knowledge_count": len(r.recommended_knowledge or []),
                    "top_knowledge": (
                        r.recommended_knowledge[0]
                        if r.recommended_knowledge else None
                    ),
                    "similar_count": len(r.similar_histories or []),
                    "parts_checked": len(r.part_availability or []),
                    "feedback": r.feedback,
                    "created_at": r.created_at.isoformat()
                }
                for r in recommendations
            ],
            "feedback_chain": [
                {
                    "knowledge_code": f.knowledge_code,
                    "effectiveness": f.effectiveness,
                    "is_manual": f.is_manual_correction,
                    "operator": f.operator,
                    "comment": f.comment,
                    "created_at": f.created_at.isoformat()
                }
                for f in feedbacks
            ]
        }
