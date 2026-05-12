from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from .models import Knowledge, WorkOrder, SparePart, Recommendation, Feedback
from .schemas import KnowledgeSnippet, SimilarHistory, PartAvailability


class RecommendationEngine:
    def __init__(self, db: Session):
        self.db = db

    def calculate_knowledge_score(
        self,
        knowledge: Knowledge,
        model_code: str,
        current_time: datetime
    ) -> Dict[str, Any]:
        base_score = 100.0
        model_match = False
        is_expired = False
        score_details = []

        if knowledge.model_codes and model_code in knowledge.model_codes:
            model_match = True
            score_details.append("机型匹配 +30分")
        elif knowledge.model_codes:
            base_score -= 25
            score_details.append("机型不匹配 -25分")
            if model_code.startswith(tuple(m[:3] for m in knowledge.model_codes if m)):
                base_score += 10
                score_details.append("同产品线 +10分")
        else:
            model_match = True
            score_details.append("通用知识")

        if knowledge.expiration_date and current_time > knowledge.expiration_date:
            is_expired = True
            base_score -= 50
            score_details.append("知识过期 -50分")
        elif knowledge.effective_date and current_time < knowledge.effective_date:
            base_score -= 10
            score_details.append("知识未生效 -10分")
        else:
            score_details.append("知识有效")

        if knowledge.total_usage > 0:
            success_rate = knowledge.success_count / knowledge.total_usage
            base_score += success_rate * 20
            score_details.append(f"成功率{success_rate:.0%} +{success_rate*20:.0f}分")
        else:
            score_details.append("无历史数据")

        return {
            "score": max(base_score, 0),
            "model_match": model_match,
            "is_expired": is_expired,
            "details": score_details
        }

    def find_similar_histories(
        self,
        model_code: str,
        error_code: str,
        description: str,
        current_order_no: str,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        histories = (
            self.db.query(WorkOrder)
            .filter(
                WorkOrder.order_no != current_order_no,
                WorkOrder.status.in_(["COMPLETED", "FEEDBACK_SUBMITTED"]),
                WorkOrder.error_code == error_code
            )
            .order_by(WorkOrder.updated_at.desc())
            .limit(limit * 2)
            .all()
        )

        result = []
        for hist in histories:
            similarity = 50.0
            if hist.model_code == model_code:
                similarity += 30
            elif hist.model_code[:3] == model_code[:3]:
                similarity += 15

            words = set(description.lower().split())
            hist_words = set(hist.description.lower().split())
            if words and hist_words:
                jaccard = len(words & hist_words) / len(words | hist_words)
                similarity += jaccard * 20

            feedback = (
                self.db.query(Feedback)
                .join(Recommendation)
                .filter(Recommendation.order_no == hist.order_no)
                .order_by(Feedback.created_at.desc())
                .first()
            )

            result.append({
                "order_no": hist.order_no,
                "model_code": hist.model_code,
                "error_code": hist.error_code,
                "description": hist.description,
                "solution": feedback.knowledge_code if feedback else "未知",
                "resolved": hist.status == "COMPLETED",
                "similarity": round(similarity, 2)
            })

        result.sort(key=lambda x: x["similarity"], reverse=True)
        return result[:limit]

    def check_part_availability(
        self,
        part_codes: List[str],
        model_code: str
    ) -> List[Dict[str, Any]]:
        result = []
        for part_code in part_codes:
            part = (
                self.db.query(SparePart)
                .filter(SparePart.part_code == part_code)
                .first()
            )
            if part:
                available = part.stock_quantity > part.safety_stock
                model_compatible = (
                    not part.model_compatible or
                    model_code in part.model_compatible
                )
                result.append({
                    "part_code": part.part_code,
                    "part_name": part.part_name,
                    "available": available and model_compatible,
                    "stock_quantity": part.stock_quantity,
                    "safety_stock": part.safety_stock,
                    "model_compatible": model_compatible
                })
        return result

    def generate_recommendation(
        self,
        order_no: str,
        model_code: str,
        error_code: str,
        description: str
    ) -> Dict[str, Any]:
        current_time = datetime.utcnow()

        existing_rec = (
            self.db.query(Recommendation)
            .filter(
                Recommendation.order_no == order_no,
                Recommendation.status.in_(["GENERATED", "EXECUTED"])
            )
            .order_by(Recommendation.round_no.desc())
            .first()
        )

        if existing_rec and existing_rec.status == "GENERATED":
            return {
                "is_idempotent": True,
                "existing_recommendation_id": existing_rec.id,
                "message": "该工单已有未执行的推荐，返回幂等结果"
            }

        knowledges = (
            self.db.query(Knowledge)
            .filter(
                Knowledge.error_code == error_code,
                Knowledge.is_active == True
            )
            .all()
        )

        scored_knowledges = []
        for kl in knowledges:
            score_data = self.calculate_knowledge_score(kl, model_code, current_time)
            success_rate = (
                kl.success_count / kl.total_usage if kl.total_usage > 0 else 0.0
            )
            scored_knowledges.append({
                "knowledge_code": kl.knowledge_code,
                "title": kl.title,
                "content": kl.content,
                "match_score": score_data["score"],
                "model_match": score_data["model_match"],
                "is_expired": score_data["is_expired"],
                "success_rate": success_rate,
                "suggested_parts": kl.suggested_parts or [],
                "score_details": score_data["details"]
            })

        scored_knowledges.sort(key=lambda x: x["match_score"], reverse=True)

        all_part_codes = []
        for kl in scored_knowledges:
            for p in kl["suggested_parts"]:
                if p not in all_part_codes:
                    all_part_codes.append(p)

        similar_histories = self.find_similar_histories(
            model_code, error_code, description, order_no
        )
        part_availability = self.check_part_availability(all_part_codes, model_code)

        round_no = 1
        last_rec = (
            self.db.query(Recommendation)
            .filter(Recommendation.order_no == order_no)
            .order_by(Recommendation.round_no.desc())
            .first()
        )
        if last_rec:
            round_no = last_rec.round_no + 1

        return {
            "is_idempotent": False,
            "round_no": round_no,
            "knowledge_recommendations": scored_knowledges,
            "similar_histories": similar_histories,
            "part_availability": part_availability
        }
