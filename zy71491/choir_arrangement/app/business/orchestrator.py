from typing import Dict
from sqlalchemy.orm import Session
from app.models import Rehearsal, Arrangement, Member
from app.business.absence_aggregator import AbsenceAggregator
from app.business.voice_balance import VoiceBalanceChecker
from app.business.substitute_recommender import SubstituteRecommender
from app.business.position_conflict import PositionConflictDetector
from app.business.history_tracker import HistoryTracker


class ArrangementOrchestrator:
    def __init__(self, db: Session):
        self.db = db
        self.absence_aggregator = AbsenceAggregator(db)
        self.balance_checker = VoiceBalanceChecker(db)
        self.substitute_recommender = SubstituteRecommender(db)
        self.conflict_detector = PositionConflictDetector(db)
        self.history_tracker = HistoryTracker(db)

    def generate_arrangement(self, rehearsal_date: str) -> Dict:
        rehearsal = self.db.query(Rehearsal).filter(
            Rehearsal.rehearsal_date == rehearsal_date
        ).first()

        if not rehearsal:
            return {
                "success": False,
                "error": f"排练日期[{rehearsal_date}]不存在，请先创建排练记录",
                "needs_manual": True,
                "missing_data": ["rehearsal"]
            }

        absence_summary = self.absence_aggregator.aggregate_by_rehearsal(rehearsal_date)
        balance_result = self.balance_checker.check_balance(
            rehearsal_date, rehearsal.difficulty
        )
        substitute_result = self.substitute_recommender.get_recommendations(rehearsal_date)

        missing_data = []
        if absence_summary["members_without_voice_part"]:
            missing_data.append({
                "type": "voice_part",
                "member_ids": absence_summary["members_without_voice_part"],
                "message": "缺勤成员缺少声部信息"
            })

        if balance_result["members_without_voice"]:
            missing_data.append({
                "type": "voice_part",
                "member_ids": [m["id"] for m in balance_result["members_without_voice"]],
                "message": "出勤成员缺少声部信息"
            })

        arrangement_plan = self._build_arrangement_plan(
            rehearsal, balance_result, substitute_result
        )

        return {
            "success": True,
            "rehearsal_id": rehearsal.id,
            "rehearsal_date": rehearsal_date,
            "status": "generated",
            "absence_summary": absence_summary,
            "balance_result": balance_result,
            "substitute_result": substitute_result,
            "arrangement_plan": arrangement_plan,
            "missing_data": missing_data,
            "needs_manual": len(missing_data) > 0 or substitute_result["unfilled_positions"] > 0
        }

    def _build_arrangement_plan(self, rehearsal: Rehearsal, balance_result: Dict,
                                substitute_result: Dict) -> Dict:
        plan = {
            "attending_members": [],
            "substitutes": [],
            "position_suggestions": []
        }

        row = 1
        col = 1
        max_cols = 8

        for voice, members in balance_result["voice_members"].items():
            for member in members:
                plan["attending_members"].append({
                    **member,
                    "voice_part": voice,
                    "suggested_position": {"row": row, "col": col}
                })
                col += 1
                if col > max_cols:
                    col = 1
                    row += 1

        for rec in substitute_result["recommendations"]:
            if rec["recommended_substitutes"] and not rec.get("cross_voice"):
                sub = rec["recommended_substitutes"][0]
                plan["substitutes"].append({
                    "substitute": sub,
                    "substituted_for": {
                        "id": rec["absent_member_id"],
                        "name": rec["absent_member_name"]
                    }
                })

        return plan

    def save_arrangement(self, rehearsal_id: int, arrangements: list, is_manual: bool = False) -> Dict:
        rehearsal = self.db.query(Rehearsal).filter(
            Rehearsal.id == rehearsal_id
        ).first()

        if not rehearsal:
            return {"success": False, "error": "排练不存在"}

        self.db.query(Arrangement).filter(
            Arrangement.rehearsal_id == rehearsal_id
        ).delete()

        saved_arrangements = []
        for arr_data in arrangements:
            arr = Arrangement(
                rehearsal_id=rehearsal_id,
                member_id=arr_data["member_id"],
                position_row=arr_data.get("position_row"),
                position_col=arr_data.get("position_col"),
                is_substitute=arr_data.get("is_substitute", False),
                substituted_for=arr_data.get("substituted_for"),
                is_manual=is_manual
            )
            self.db.add(arr)
            self.db.flush()
            saved_arrangements.append(arr)

            self.history_tracker.log_arrangement_create(
                rehearsal_id=rehearsal_id,
                member_id=arr.member_id,
                position_row=arr.position_row,
                position_col=arr.position_col,
                is_manual=is_manual
            )

        self.db.commit()

        conflict_result = self.conflict_detector.detect_conflicts(rehearsal_id)

        return {
            "success": True,
            "rehearsal_id": rehearsal_id,
            "saved_count": len(saved_arrangements),
            "conflicts": conflict_result["conflicts"],
            "has_conflicts": conflict_result["has_conflicts"]
        }
