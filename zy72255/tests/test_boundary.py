import pytest
from mine_support_marker.boundary import (
    BoundaryRuleId,
    get_all_boundary_rules,
    get_boundary_rule,
    validate_boundary,
)


class TestBoundaryRules:
    def test_all_rules_defined(self):
        rules = get_all_boundary_rules()
        assert len(rules) == 9
        rule_ids = {r.rule_id for r in rules}
        assert BoundaryRuleId.Z_AXIS_REVERSAL_DETECTION in rule_ids
        assert BoundaryRuleId.Z_AXIS_NO_AUTO_NORMALIZE in rule_ids
        assert BoundaryRuleId.Z_AXIS_FIELD_TEAM_REVIEW in rule_ids
        assert BoundaryRuleId.Z_AXIS_ROLLBACK_ALLOWED in rule_ids
        assert BoundaryRuleId.CONFIRMED_FIELD_IMMUTABLE in rule_ids
        assert BoundaryRuleId.DEDUP_ON_REIMPORT in rule_ids
        assert BoundaryRuleId.LATE_MATERIAL_NO_OVERWRITE in rule_ids
        assert BoundaryRuleId.STATUS_TRANSITION_ORDER in rule_ids
        assert BoundaryRuleId.CHANGE_HISTORY_RETENTION in rule_ids

    def test_get_specific_rule(self):
        rule = get_boundary_rule(BoundaryRuleId.Z_AXIS_NO_AUTO_NORMALIZE)
        assert rule is not None
        assert "不急归正常" in rule.title
        assert rule.detect
        assert rule.correct
        assert rule.rollback

    def test_get_nonexistent_rule(self):
        with pytest.raises(ValueError):
            BoundaryRuleId("nonexistent")

    def test_rule_has_all_fields(self):
        for rule in get_all_boundary_rules():
            assert rule.rule_id
            assert rule.title
            assert rule.description
            assert rule.detect
            assert rule.correct
            assert rule.rollback
            assert isinstance(rule.examples, list)

    def test_validate_dedup_on_reimport(self):
        ok, msg = validate_boundary(
            BoundaryRuleId.DEDUP_ON_REIMPORT, {"already_exists": True}
        )
        assert ok
        assert "跳过" in msg

        ok, msg = validate_boundary(
            BoundaryRuleId.DEDUP_ON_REIMPORT, {"already_exists": False}
        )
        assert ok
        assert "允许" in msg

    def test_validate_confirmed_field_immutable(self):
        ok, msg = validate_boundary(
            BoundaryRuleId.CONFIRMED_FIELD_IMMUTABLE, {"is_confirmed": True}
        )
        assert not ok
        assert "不可覆盖" in msg

        ok, msg = validate_boundary(
            BoundaryRuleId.CONFIRMED_FIELD_IMMUTABLE, {"is_confirmed": False}
        )
        assert ok

    def test_validate_z_axis_no_auto_normalize(self):
        ok, msg = validate_boundary(
            BoundaryRuleId.Z_AXIS_NO_AUTO_NORMALIZE,
            {"z_axis_flagged": True, "auto_correct": True},
        )
        assert not ok
        assert "不自动归正常" in msg

        ok, msg = validate_boundary(
            BoundaryRuleId.Z_AXIS_NO_AUTO_NORMALIZE,
            {"z_axis_flagged": False, "auto_correct": True},
        )
        assert ok

    def test_validate_late_material_no_overwrite(self):
        ok, msg = validate_boundary(
            BoundaryRuleId.LATE_MATERIAL_NO_OVERWRITE,
            {"confirmed_fields": {"conclusion"}, "target_field": "conclusion"},
        )
        assert not ok
        assert "不可覆盖" in msg

        ok, msg = validate_boundary(
            BoundaryRuleId.LATE_MATERIAL_NO_OVERWRITE,
            {"confirmed_fields": {"conclusion"}, "target_field": "cad_layer_name"},
        )
        assert ok

    def test_validate_unregistered_rule(self):
        fake_id = BoundaryRuleId.DEDUP_ON_REIMPORT
        BOUNDARY_RULES_BACKUP = None
        from mine_support_marker import boundary
        BOUNDARY_RULES_BACKUP = boundary.BOUNDARY_RULES.pop(fake_id)
        try:
            ok, msg = validate_boundary(fake_id, {})
            assert not ok
            assert "不存在" in msg
        finally:
            boundary.BOUNDARY_RULES[fake_id] = BOUNDARY_RULES_BACKUP
