from typing import List, Dict
from sqlalchemy.orm import Session
from app.models import Arrangement, Member


class PositionConflictDetector:
    def __init__(self, db: Session):
        self.db = db

    def detect_conflicts(self, rehearsal_id: int) -> Dict:
        arrangements = self.db.query(Arrangement).filter(
            Arrangement.rehearsal_id == rehearsal_id
        ).all()

        position_map = {}
        conflicts = []

        for arr in arrangements:
            if arr.position_row is None or arr.position_col is None:
                continue

            pos_key = (arr.position_row, arr.position_col)
            member = self.db.query(Member).filter(
                Member.id == arr.member_id
            ).first()

            if pos_key in position_map:
                existing = position_map[pos_key]
                conflicts.append({
                    "type": "position_occupied",
                    "position": {"row": arr.position_row, "col": arr.position_col},
                    "conflicting_members": [
                        {
                            "member_id": existing["member_id"],
                            "member_name": existing["member_name"],
                            "arrangement_id": existing["arrangement_id"]
                        },
                        {
                            "member_id": arr.member_id,
                            "member_name": member.name if member else "Unknown",
                            "arrangement_id": arr.id
                        }
                    ],
                    "message": f"位置(排{arr.position_row}, 列{arr.position_col})被[{existing['member_name']}]和[{member.name if member else 'Unknown'}]同时占用"
                })
            else:
                position_map[pos_key] = {
                    "member_id": arr.member_id,
                    "member_name": member.name if member else "Unknown",
                    "arrangement_id": arr.id
                }

        substitute_count = {}
        for arr in arrangements:
            if arr.is_substitute and arr.substituted_for:
                if arr.substituted_for not in substitute_count:
                    substitute_count[arr.substituted_for] = []
                member = self.db.query(Member).filter(
                    Member.id == arr.member_id
                ).first()
                substitute_count[arr.substituted_for].append({
                    "substitute_id": arr.member_id,
                    "substitute_name": member.name if member else "Unknown",
                    "arrangement_id": arr.id
                })

        for substituted_for_id, subs in substitute_count.items():
            if len(subs) > 1:
                substituted_member = self.db.query(Member).filter(
                    Member.id == substituted_for_id
                ).first()
                conflicts.append({
                    "type": "duplicate_substitute",
                    "substituted_for_id": substituted_for_id,
                    "substituted_for_name": substituted_member.name if substituted_member else "Unknown",
                    "duplicate_substitutes": subs,
                    "message": f"成员[{substituted_member.name if substituted_member else 'Unknown'}]有{len(subs)}个替补：{', '.join([s['substitute_name'] for s in subs])}"
                })

        return {
            "rehearsal_id": rehearsal_id,
            "total_arrangements": len(arrangements),
            "conflicts": conflicts,
            "has_conflicts": len(conflicts) > 0,
            "position_count": len(position_map)
        }

    def validate_position(self, rehearsal_id: int, position_row: int, position_col: int, exclude_arrangement_id: int = None) -> Dict:
        query = self.db.query(Arrangement).filter(
            Arrangement.rehearsal_id == rehearsal_id,
            Arrangement.position_row == position_row,
            Arrangement.position_col == position_col
        )

        if exclude_arrangement_id:
            query = query.filter(Arrangement.id != exclude_arrangement_id)

        existing = query.first()

        if existing:
            member = self.db.query(Member).filter(
                Member.id == existing.member_id
            ).first()
            return {
                "valid": False,
                "conflict": {
                    "arrangement_id": existing.id,
                    "member_id": existing.member_id,
                    "member_name": member.name if member else "Unknown"
                },
                "message": f"位置(排{position_row}, 列{position_col})已被[{member.name if member else 'Unknown'}]占用"
            }

        return {
            "valid": True,
            "message": "位置可用"
        }
