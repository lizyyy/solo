from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from ..models.role import RoleResult, RoleConflict, ConflictType
from ..models.correction import CorrectionRecord
from ..utils.hash import stable_hash, stable_sort


@dataclass
class ConflictDetectionResult:
    user_id: str
    conflicts: List[RoleConflict]
    applied_corrections: List[CorrectionRecord]

    @property
    def has_conflicts(self) -> bool:
        return len(self.conflicts) > 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "conflicts": [c.to_dict() for c in self.conflicts],
            "applied_corrections": [c.to_dict() for c in self.applied_corrections],
            "has_conflicts": self.has_conflicts,
        }


class ConflictDetector:
    def __init__(self, corrections: List[CorrectionRecord]):
        self.corrections = corrections
        self.user_corrections: Dict[str, List[CorrectionRecord]] = {}
        for corr in corrections:
            if corr.user_id not in self.user_corrections:
                self.user_corrections[corr.user_id] = []
            self.user_corrections[corr.user_id].append(corr)

    def apply_corrections(self, user_id: str, roles: List[str], attributes: Dict[str, Any]) -> tuple[List[str], Dict[str, Any], List[CorrectionRecord]]:
        applied = []
        corrected_roles = list(roles)
        corrected_attrs = dict(attributes)

        for corr in self.user_corrections.get(user_id, []):
            if not corr.applied:
                continue

            if corr.correction_type == "role":
                if corr.old_value and corr.old_value in corrected_roles:
                    corrected_roles.remove(corr.old_value)
                if corr.new_value:
                    corrected_roles.append(corr.new_value)
            elif corr.correction_type == "attribute":
                if corr.field_name:
                    corrected_attrs[corr.field_name] = corr.new_value
            elif corr.correction_type == "role_add":
                if corr.new_value and corr.new_value not in corrected_roles:
                    corrected_roles.append(corr.new_value)
            elif corr.correction_type == "role_remove":
                if corr.old_value and corr.old_value in corrected_roles:
                    corrected_roles.remove(corr.old_value)

            applied.append(corr)

        return stable_sort(corrected_roles), corrected_attrs, applied

    def detect_for_user(
        self,
        role_result: RoleResult,
        expected_roles: Optional[List[str]] = None,
        expected_attrs: Optional[Dict[str, Any]] = None,
    ) -> ConflictDetectionResult:
        conflicts: List[RoleConflict] = []

        corrected_roles, corrected_attrs, applied = self.apply_corrections(
            role_result.user_id,
            role_result.actual_roles,
            role_result.mapped_attributes,
        )

        if expected_roles is not None:
            expected_set = set(expected_roles)
            actual_set = set(corrected_roles)

            missing_roles = expected_set - actual_set
            for role in stable_sort(missing_roles):
                conflicts.append(RoleConflict(
                    user_id=role_result.user_id,
                    conflict_type=ConflictType.MISSING_ROLE,
                    expected=role,
                    actual=None,
                    role_name=role,
                    description=f"角色缺失: {role}",
                    severity="error",
                    source_trace={
                        "source_file": role_result.source_file,
                        "line_number": role_result.line_number,
                    },
                ))

            extra_roles = actual_set - expected_set
            for role in stable_sort(extra_roles):
                conflicts.append(RoleConflict(
                    user_id=role_result.user_id,
                    conflict_type=ConflictType.EXTRA_ROLE,
                    expected=None,
                    actual=role,
                    role_name=role,
                    description=f"多余角色: {role}",
                    severity="warning",
                    source_trace={
                        "source_file": role_result.source_file,
                        "line_number": role_result.line_number,
                    },
                ))

        duplicates = set()
        seen = set()
        for role in corrected_roles:
            if role in seen:
                duplicates.add(role)
            seen.add(role)
        for role in stable_sort(duplicates):
            conflicts.append(RoleConflict(
                user_id=role_result.user_id,
                conflict_type=ConflictType.DUPLICATE_ROLE,
                expected=None,
                actual=role,
                role_name=role,
                description=f"重复角色: {role}",
                severity="warning",
                source_trace={
                    "source_file": role_result.source_file,
                    "line_number": role_result.line_number,
                },
            ))

        return ConflictDetectionResult(
            user_id=role_result.user_id,
            conflicts=conflicts,
            applied_corrections=applied,
        )

    def detect_all(
        self,
        role_results: List[RoleResult],
        expected_roles_map: Optional[Dict[str, List[str]]] = None,
    ) -> List[ConflictDetectionResult]:
        results = []
        for role_result in stable_sort(role_results, key=lambda x: x.user_id):
            expected_roles = expected_roles_map.get(role_result.user_id) if expected_roles_map else None
            result = self.detect_for_user(role_result, expected_roles)
            results.append(result)
        return results
