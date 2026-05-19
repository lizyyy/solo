from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set
from ..models.user import TestUser, IdentitySourceUser
from ..models.role import RoleResult
from .validator import UserMappingResult
from ..utils.diff import dict_diff, list_diff
from ..utils.hash import stable_hash, stable_sort


@dataclass
class AttributeDiff:
    field_name: str
    diff_type: str
    expected: Any
    actual: Any

    def to_dict(self) -> Dict[str, Any]:
        return {
            "field_name": self.field_name,
            "diff_type": self.diff_type,
            "expected": self.expected,
            "actual": self.actual,
        }


@dataclass
class PlaybackResult:
    user_id: str
    test_user: TestUser
    mapping_result: Optional[UserMappingResult]
    role_result: Optional[RoleResult]
    attribute_diffs: List[AttributeDiff]
    expected_roles: List[str]
    actual_roles: List[str]
    matched: bool

    @property
    def has_diffs(self) -> bool:
        return len(self.attribute_diffs) > 0 or len(self.expected_roles) != len(self.actual_roles)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "test_user": self.test_user.to_dict(),
            "mapping_result": self.mapping_result.to_dict() if self.mapping_result else None,
            "role_result": self.role_result.to_dict() if self.role_result else None,
            "attribute_diffs": [d.to_dict() for d in self.attribute_diffs],
            "expected_roles": self.expected_roles,
            "actual_roles": self.actual_roles,
            "matched": self.matched,
            "has_diffs": self.has_diffs,
        }


class PlaybackEngine:
    def __init__(self, test_users: List[TestUser]):
        self.test_users = {tu.user_id: tu for tu in test_users}

    def compare_attributes(self, expected: Dict[str, Any], actual: Dict[str, Any]) -> List[AttributeDiff]:
        diffs = []
        all_keys = set(expected.keys()) | set(actual.keys())

        for key in sorted(all_keys):
            exp_val = expected.get(key)
            act_val = actual.get(key)

            if key not in expected:
                diffs.append(AttributeDiff(key, "unexpected", None, act_val))
            elif key not in actual:
                diffs.append(AttributeDiff(key, "missing", exp_val, None))
            elif stable_hash(exp_val) != stable_hash(act_val):
                diffs.append(AttributeDiff(key, "value_mismatch", exp_val, act_val))

        return diffs

    def playback_user(
        self,
        user_id: str,
        mapping_result: Optional[UserMappingResult] = None,
        role_result: Optional[RoleResult] = None,
    ) -> Optional[PlaybackResult]:
        test_user = self.test_users.get(user_id)
        if not test_user:
            return None

        expected_attrs = test_user.expected_attributes
        actual_attrs = mapping_result.mapped_attributes if mapping_result else (role_result.mapped_attributes if role_result else {})

        attribute_diffs = self.compare_attributes(expected_attrs, actual_attrs)

        expected_roles = stable_sort(test_user.expected_roles)
        actual_roles = []
        if role_result:
            actual_roles = stable_sort(role_result.actual_roles)
        elif mapping_result and "roles" in mapping_result.mapped_attributes:
            roles_val = mapping_result.mapped_attributes["roles"]
            if isinstance(roles_val, list):
                actual_roles = stable_sort(roles_val)
            elif isinstance(roles_val, str) and roles_val:
                actual_roles = stable_sort([r.strip() for r in roles_val.split("|") if r.strip()])

        matched = len(attribute_diffs) == 0 and set(expected_roles) == set(actual_roles)

        return PlaybackResult(
            user_id=user_id,
            test_user=test_user,
            mapping_result=mapping_result,
            role_result=role_result,
            attribute_diffs=attribute_diffs,
            expected_roles=expected_roles,
            actual_roles=actual_roles,
            matched=matched,
        )

    def playback_all(
        self,
        mapping_results: List[UserMappingResult],
        role_results: List[RoleResult],
    ) -> List[PlaybackResult]:
        mapping_map = {mr.user_id: mr for mr in mapping_results}
        role_map = {rr.user_id: rr for rr in role_results}

        results = []
        for user_id in sorted(self.test_users.keys(), key=stable_hash):
            result = self.playback_user(
                user_id,
                mapping_map.get(user_id),
                role_map.get(user_id),
            )
            if result:
                results.append(result)

        return results
