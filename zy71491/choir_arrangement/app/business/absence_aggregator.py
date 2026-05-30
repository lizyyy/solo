from typing import List, Dict
from sqlalchemy.orm import Session
from app.models import Absence, Member


class AbsenceAggregator:
    def __init__(self, db: Session):
        self.db = db

    def aggregate_by_rehearsal(self, rehearsal_date: str) -> Dict:
        absences = self.db.query(Absence).filter(
            Absence.rehearsal_date == rehearsal_date
        ).all()

        result = {
            "rehearsal_date": rehearsal_date,
            "total_absences": len(absences),
            "absences": [],
            "absences_by_voice": {},
            "members_without_voice_part": []
        }

        for absence in absences:
            member = self.db.query(Member).filter(
                Member.id == absence.member_id
            ).first()

            absence_info = {
                "absence_id": absence.id,
                "member_id": absence.member_id,
                "member_name": member.name if member else "Unknown",
                "voice_part": member.voice_part if member else None,
                "reason": absence.reason
            }
            result["absences"].append(absence_info)

            if member and member.voice_part:
                voice = member.voice_part
                if voice not in result["absences_by_voice"]:
                    result["absences_by_voice"][voice] = 0
                result["absences_by_voice"][voice] += 1
            else:
                result["members_without_voice_part"].append(
                    absence.member_id
                )

        return result

    def get_absent_member_ids(self, rehearsal_date: str) -> List[int]:
        absences = self.db.query(Absence).filter(
            Absence.rehearsal_date == rehearsal_date
        ).all()
        return [a.member_id for a in absences]
