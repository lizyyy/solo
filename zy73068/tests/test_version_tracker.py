from blade_review.models import SupplementaryMaterial
from blade_review.version_tracker import VersionTracker


def _make_material(name="材料A", content="口径v1"):
    return SupplementaryMaterial(
        current_name=name,
        original_name=name,
        content=content,
    )


class TestVersionTrackerCapture:
    def test_first_capture_creates_history(self):
        tracker = VersionTracker()
        mat = _make_material()
        snap = tracker.capture(mat)
        assert snap.version == 1
        assert snap.name == "材料A"
        history = tracker.get_history(mat.material_id)
        assert len(history) == 1

    def test_multiple_captures_build_history(self):
        tracker = VersionTracker()
        mat = _make_material()
        tracker.capture(mat)
        mat.version = 2
        mat.current_name = "材料A-v2"
        tracker.capture(mat)
        history = tracker.get_history(mat.material_id)
        assert len(history) == 2


class TestVersionTrackerStanceChange:
    def test_detect_content_change(self):
        tracker = VersionTracker()
        mat = _make_material(content="口径v1")
        tracker.capture(mat)
        mat.content = "口径v2"
        change = tracker.detect_stance_change(mat)
        assert change is not None
        assert change.field_name == "content"
        assert change.old_value == "口径v1"
        assert change.new_value == "口径v2"

    def test_detect_name_change(self):
        tracker = VersionTracker()
        mat = _make_material(name="旧名称")
        tracker.capture(mat)
        mat.current_name = "新名称"
        change = tracker.detect_stance_change(mat)
        assert change is not None
        assert change.field_name == "current_name"

    def test_no_change_returns_none(self):
        tracker = VersionTracker()
        mat = _make_material()
        tracker.capture(mat)
        change = tracker.detect_stance_change(mat)
        assert change is None


class TestVersionTrackerApplyUpdate:
    def test_apply_name_update(self):
        tracker = VersionTracker()
        mat = _make_material(name="旧名称")
        tracker.capture(mat)
        changes = tracker.apply_update(mat, new_name="新名称", operator="小宋")
        assert len(changes) == 1
        assert mat.current_name == "新名称"
        assert mat.name_changed is True
        assert mat.version == 2

    def test_apply_content_update(self):
        tracker = VersionTracker()
        mat = _make_material(content="口径v1")
        tracker.capture(mat)
        changes = tracker.apply_update(mat, new_content="口径v2", operator="小宋")
        assert len(changes) == 1
        assert mat.content == "口径v2"
        assert mat.stance_changed is True
        assert mat.previous_stance == "口径v1"

    def test_apply_both_updates(self):
        tracker = VersionTracker()
        mat = _make_material()
        tracker.capture(mat)
        changes = tracker.apply_update(
            mat, new_name="新名称", new_content="新口径", operator="小宋"
        )
        assert len(changes) == 2
        assert mat.version == 2


class TestVersionTrackerDiff:
    def test_diff_between_versions(self):
        tracker = VersionTracker()
        mat = _make_material(name="v1名称", content="v1口径")
        tracker.capture(mat)
        mat.version = 2
        mat.current_name = "v2名称"
        mat.content = "v2口径"
        tracker.capture(mat)
        diffs = tracker.diff_versions(mat.material_id, 1, 2)
        assert len(diffs) == 2
