from typing import List, Dict
from sqlalchemy.orm import Session
from app.models import Member, Absence, SubstitutePool


class SubstituteRecommender:
    def __init__(self, db: Session):
        self.db = db

    def get_recommendations(self, rehearsal_date: str) -> Dict:
        absences = self.db.query(Absence).filter(
            Absence.rehearsal_date == rehearsal_date
        ).all()

        absent_member_ids = [a.member_id for a in absences]

        available_substitutes = self.db.query(SubstitutePool).filter(
            SubstitutePool.is_available == True,
            SubstitutePool.member_id.notin_(absent_member_ids)
        ).all()

        recommendations = []
        duplicate_warnings = []

        substitutes_by_voice = {}
        for sub in available_substitutes:
            member = self.db.query(Member).filter(
                Member.id == sub.member_id
            ).first()
            if not member:
                continue

            voice = sub.voice_part.lower()
            if voice not in substitutes_by_voice:
                substitutes_by_voice[voice] = []
            substitutes_by_voice[voice].append({
                "substitute_id": sub.id,
                "member_id": sub.member_id,
                "member_name": member.name,
                "voice_part": voice,
                "priority": sub.priority,
                "current_voice_part": member.voice_part
            })

        assigned_substitutes = set()

        for absence in absences:
            absent_member = self.db.query(Member).filter(
                Member.id == absence.member_id
            ).first()

            if not absent_member:
                continue

            if not absent_member.voice_part:
                recommendations.append({
                    "absent_member_id": absent_member.id,
                    "absent_member_name": absent_member.name,
                    "voice_part": None,
                    "recommended_substitutes": [],
                    "reason": "缺勤成员未分配声部，无法匹配替补",
                    "needs_manual": True
                })
                continue

            target_voice = absent_member.voice_part.lower()
            voice_subs = substitutes_by_voice.get(target_voice, [])

            sorted_subs = sorted(
                voice_subs,
                key=lambda x: (-x["priority"], x["member_name"])
            )

            available_for_this = [
                s for s in sorted_subs
                if s["member_id"] not in assigned_substitutes
            ]

            if not available_for_this:
                other_voice_subs = []
                for voice, subs in substitutes_by_voice.items():
                    if voice != target_voice:
                        for s in subs:
                            if s["member_id"] not in assigned_substitutes:
                                other_voice_subs.append(s)

                recommendations.append({
                    "absent_member_id": absent_member.id,
                    "absent_member_name": absent_member.name,
                    "voice_part": target_voice,
                    "recommended_substitutes": other_voice_subs[:3],
                    "reason": f"声部[{target_voice}]无可用替补，推荐跨声部替补",
                    "needs_manual": True,
                    "cross_voice": True
                })
            else:
                top_subs = available_for_this[:2]
                for sub in top_subs[:1]:
                    if sub["member_id"] in assigned_substitutes:
                        duplicate_warnings.append({
                            "substitute_member_id": sub["member_id"],
                            "substitute_name": sub["member_name"],
                            "conflict_with": absent_member.name,
                            "message": f"替补[{sub['member_name']}]被重复推荐"
                        })
                    else:
                        assigned_substitutes.add(sub["member_id"])

                recommendations.append({
                    "absent_member_id": absent_member.id,
                    "absent_member_name": absent_member.name,
                    "voice_part": target_voice,
                    "recommended_substitutes": top_subs,
                    "reason": f"声部[{target_voice}]匹配成功，按优先级排序",
                    "needs_manual": False
                })

        return {
            "rehearsal_date": rehearsal_date,
            "total_absences": len(absences),
            "recommendations": recommendations,
            "duplicate_warnings": duplicate_warnings,
            "assigned_substitutes": list(assigned_substitutes),
            "unfilled_positions": len([r for r in recommendations if not r["recommended_substitutes"]])
        }
