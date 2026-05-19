from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from database import FeatureFlag, ConflictRecord, ResolutionLog
from datetime import datetime


class ConditionMatcher:
    @staticmethod
    def match_condition(flag_conditions: Dict[str, Any], user_context: Dict[str, Any]) -> Tuple[bool, List[str]]:
        matched_rules = []
        all_matched = True

        for key, expected_value in flag_conditions.items():
            if key not in user_context:
                all_matched = False
                break

            user_value = user_context[key]

            if isinstance(expected_value, dict) and "operator" in expected_value:
                op = expected_value["operator"]
                value = expected_value["value"]

                if op == "in":
                    if user_value not in value:
                        all_matched = False
                        break
                    matched_rules.append(f"{key} {user_value} in {value}")
                elif op == "not_in":
                    if user_value in value:
                        all_matched = False
                        break
                    matched_rules.append(f"{key} {user_value} not in {value}")
                elif op == "gte":
                    if user_value < value:
                        all_matched = False
                        break
                    matched_rules.append(f"{key} {user_value} >= {value}")
                elif op == "lte":
                    if user_value > value:
                        all_matched = False
                        break
                    matched_rules.append(f"{key} {user_value} <= {value}")
                elif op == "eq":
                    if user_value != value:
                        all_matched = False
                        break
                    matched_rules.append(f"{key} {user_value} == {value}")
                elif op == "contains":
                    if value not in user_value:
                        all_matched = False
                        break
                    matched_rules.append(f"{key} contains {value}")
            else:
                if user_value != expected_value:
                    all_matched = False
                    break
                matched_rules.append(f"{key} == {expected_value}")

        return all_matched, matched_rules


class PriorityCalculator:
    @staticmethod
    def calculate_effective_priority(flag: FeatureFlag, user_context: Dict[str, Any]) -> int:
        base_priority = flag.priority
        user_group = user_context.get("user_group", "")

        if flag.user_group and flag.user_group == user_group:
            base_priority += 100

        if "vip" in user_group.lower():
            base_priority += 50

        return base_priority


class ConflictResolver:
    def __init__(self, db: Session):
        self.db = db

    def evaluate_flags_for_user(self, user_id: str, user_context: Dict[str, Any]) -> Dict[str, Any]:
        active_flags = self.db.query(FeatureFlag).filter(FeatureFlag.is_active == True).all()

        matched_flags = []
        matched_details = {}

        for flag in active_flags:
            is_match, rules = ConditionMatcher.match_condition(flag.conditions, user_context)
            if is_match:
                effective_priority = PriorityCalculator.calculate_effective_priority(flag, user_context)
                matched_flags.append({
                    "id": flag.id,
                    "name": flag.name,
                    "priority": flag.priority,
                    "effective_priority": effective_priority,
                    "user_group": flag.user_group,
                    "matched_rules": rules
                })
                matched_details[str(flag.id)] = rules

        if len(matched_flags) <= 1:
            return {
                "has_conflict": False,
                "matched_flags": matched_flags,
                "winning_flag": matched_flags[0] if matched_flags else None
            }

        sorted_flags = sorted(matched_flags, key=lambda x: x["effective_priority"], reverse=True)
        winning_flag = sorted_flags[0]
        other_flags = sorted_flags[1:]

        conflict_explanation = self._generate_conflict_explanation(sorted_flags)

        conflict_record = ConflictRecord(
            user_id=user_id,
            conflicting_flags=[f["id"] for f in sorted_flags],
            matched_conditions=matched_details,
            original_input={"user_id": user_id, "user_context": user_context},
            status="pending",
            final_result={
                "winning_flag": winning_flag,
                "overridden_flags": other_flags,
                "explanation": conflict_explanation
            }
        )
        self.db.add(conflict_record)
        self.db.commit()
        self.db.refresh(conflict_record)

        return {
            "has_conflict": True,
            "conflict_id": conflict_record.id,
            "matched_flags": sorted_flags,
            "winning_flag": winning_flag,
            "overridden_flags": other_flags,
            "conflict_explanation": conflict_explanation
        }

    def _generate_conflict_explanation(self, sorted_flags: List[Dict]) -> List[str]:
        explanations = []
        winning = sorted_flags[0]

        for i, flag in enumerate(sorted_flags[1:], 1):
            reason_parts = []
            if flag["effective_priority"] < winning["effective_priority"]:
                reason_parts.append(f"优先级较低({flag['effective_priority']} < {winning['effective_priority']})")

            if flag["user_group"] and not winning["user_group"]:
                reason_parts.append("无用户组匹配加成")

            reason = "、".join(reason_parts) if reason_parts else "默认排序"
            explanations.append(f"{flag['name']} 被 {winning['name']} 覆盖，原因：{reason}")

        return explanations

    def resolve_conflict(self, conflict_id: int, resolution: str, operator: str,
                         final_result: Dict = None, selected_flag_id: int = None) -> ConflictRecord:
        conflict = self.db.query(ConflictRecord).filter(ConflictRecord.id == conflict_id).first()
        if not conflict:
            raise ValueError("Conflict not found")

        previous_status = conflict.status

        if selected_flag_id is not None:
            all_flags = self.db.query(FeatureFlag).filter(
                FeatureFlag.id.in_(conflict.conflicting_flags)
            ).all()
            flag_map = {f.id: f for f in all_flags}
            selected_flag = flag_map.get(selected_flag_id)

            if selected_flag:
                overridden = [
                    {"id": fid, "name": flag_map[fid].name}
                    for fid in conflict.conflicting_flags
                    if fid != selected_flag_id
                ]
                final_result = {
                    "winning_flag": {
                        "id": selected_flag.id,
                        "name": selected_flag.name,
                        "priority": selected_flag.priority
                    },
                    "overridden_flags": overridden,
                    "explanation": [f"人工选择 {selected_flag.name} 作为最终结果"],
                    "resolution_note": resolution
                }

        conflict.status = "resolved"
        conflict.resolution = resolution
        conflict.resolved_by = operator
        conflict.resolved_at = datetime.utcnow()
        if final_result:
            conflict.final_result = final_result

        log = ResolutionLog(
            conflict_id=conflict_id,
            action="resolve",
            operator=operator,
            conclusion=resolution,
            previous_status=previous_status,
            new_status="resolved"
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(conflict)

        return conflict

    def withdraw_conflict(self, conflict_id: int, operator: str, reason: str) -> ConflictRecord:
        conflict = self.db.query(ConflictRecord).filter(ConflictRecord.id == conflict_id).first()
        if not conflict:
            raise ValueError("Conflict not found")

        previous_status = conflict.status
        conflict.status = "withdrawn"
        conflict.resolution = reason
        conflict.resolved_by = operator
        conflict.resolved_at = datetime.utcnow()

        log = ResolutionLog(
            conflict_id=conflict_id,
            action="withdraw",
            operator=operator,
            conclusion=reason,
            previous_status=previous_status,
            new_status="withdrawn"
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(conflict)

        return conflict

    def close_conflict(self, conflict_id: int, operator: str, reason: str) -> ConflictRecord:
        conflict = self.db.query(ConflictRecord).filter(ConflictRecord.id == conflict_id).first()
        if not conflict:
            raise ValueError("Conflict not found")

        previous_status = conflict.status
        conflict.status = "closed"
        conflict.resolution = reason
        conflict.resolved_by = operator
        conflict.resolved_at = datetime.utcnow()

        log = ResolutionLog(
            conflict_id=conflict_id,
            action="close",
            operator=operator,
            conclusion=reason,
            previous_status=previous_status,
            new_status="closed"
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(conflict)

        return conflict

    def generate_report(self, conflict_id: int) -> Dict[str, Any]:
        conflict = self.db.query(ConflictRecord).filter(ConflictRecord.id == conflict_id).first()
        if not conflict:
            raise ValueError("Conflict not found")

        flags = self.db.query(FeatureFlag).filter(
            FeatureFlag.id.in_(conflict.conflicting_flags)
        ).all()
        flag_details = {f.id: {"name": f.name, "priority": f.priority, "conditions": f.conditions} for f in flags}

        logs = self.db.query(ResolutionLog).filter(ResolutionLog.conflict_id == conflict_id).all()

        return {
            "conflict_id": conflict.id,
            "user_id": conflict.user_id,
            "status": conflict.status,
            "created_at": conflict.created_at.isoformat() if conflict.created_at else None,
            "resolved_at": conflict.resolved_at.isoformat() if conflict.resolved_at else None,
            "resolved_by": conflict.resolved_by,
            "original_input": conflict.original_input,
            "conflicting_flags": [
                {
                    "id": fid,
                    **flag_details.get(fid, {}),
                    "matched_conditions": conflict.matched_conditions.get(str(fid), [])
                }
                for fid in conflict.conflicting_flags
            ],
            "final_result": conflict.final_result,
            "resolution": conflict.resolution,
            "audit_logs": [
                {
                    "action": log.action,
                    "operator": log.operator,
                    "conclusion": log.conclusion,
                    "previous_status": log.previous_status,
                    "new_status": log.new_status,
                    "created_at": log.created_at.isoformat()
                }
                for log in logs
            ]
        }
