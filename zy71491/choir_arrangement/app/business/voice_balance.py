from typing import List, Dict
from sqlalchemy.orm import Session
from app.models import Member, Absence, Rehearsal
from app.schemas import BalanceIssue


class VoiceBalanceChecker:
    STANDARD_BALANCE = {
        "soprano": {"min": 4, "max": 8, "ideal": 6},
        "alto": {"min": 4, "max": 8, "ideal": 6},
        "tenor": {"min": 3, "max": 6, "ideal": 4},
        "bass": {"min": 3, "max": 6, "ideal": 4}
    }

    def __init__(self, db: Session):
        self.db = db

    def check_balance(self, rehearsal_date: str, difficulty: int = 1) -> Dict:
        rehearsal = self.db.query(Rehearsal).filter(
            Rehearsal.rehearsal_date == rehearsal_date
        ).first()

        absent_member_ids = self.db.query(Absence.member_id).filter(
            Absence.rehearsal_date == rehearsal_date
        ).all()
        absent_ids = [a[0] for a in absent_member_ids]

        active_members = self.db.query(Member).filter(
            Member.is_active == True,
            Member.id.notin_(absent_ids)
        ).all()

        voice_counts = {}
        members_without_voice = []
        for member in active_members:
            if member.voice_part:
                voice = member.voice_part.lower()
                if voice not in voice_counts:
                    voice_counts[voice] = []
                voice_counts[voice].append({
                    "id": member.id,
                    "name": member.name
                })
            else:
                members_without_voice.append({
                    "id": member.id,
                    "name": member.name
                })

        issues = []
        balance_factor = 1 + (difficulty - 1) * 0.2

        for voice, standard in self.STANDARD_BALANCE.items():
            current_count = len(voice_counts.get(voice, []))
            adjusted_min = int(standard["min"] * balance_factor)
            adjusted_max = int(standard["max"] * balance_factor)

            if current_count < adjusted_min:
                issues.append(BalanceIssue(
                    type="voice_insufficient",
                    voice_part=voice,
                    current_count=current_count,
                    expected_range=f"{adjusted_min}-{adjusted_max}",
                    severity="high" if current_count < standard["min"] else "medium",
                    message=f"声部[{voice}]人数不足：当前{current_count}人，最低需要{adjusted_min}人"
                ))
            elif current_count > adjusted_max:
                issues.append(BalanceIssue(
                    type="voice_excess",
                    voice_part=voice,
                    current_count=current_count,
                    expected_range=f"{adjusted_min}-{adjusted_max}",
                    severity="low",
                    message=f"声部[{voice}]人数偏多：当前{current_count}人，建议范围{adjusted_min}-{adjusted_max}人"
                ))

        if members_without_voice:
            issues.append(BalanceIssue(
                type="missing_voice_part",
                voice_part="unknown",
                current_count=len(members_without_voice),
                expected_range="1-0",
                severity="high",
                message=f"有{len(members_without_voice)}名成员未分配声部：{', '.join([m['name'] for m in members_without_voice])}"
            ))

        total_attending = sum(len(members) for members in voice_counts.values())
        if total_attending == 0:
            issues.append(BalanceIssue(
                type="no_attendance",
                voice_part="all",
                current_count=0,
                expected_range="1+",
                severity="critical",
                message="排练无出勤人员，请检查缺勤记录"
            ))

        return {
            "rehearsal_date": rehearsal_date,
            "difficulty": difficulty,
            "voice_counts": {v: len(m) for v, m in voice_counts.items()},
            "voice_members": voice_counts,
            "members_without_voice": members_without_voice,
            "balance_issues": issues,
            "is_balanced": len([i for i in issues if i.severity in ["high", "critical"]]) == 0
        }
