from datetime import datetime

import pytest

from offline_merger.conflict.conflict_manager import (
    ConflictItem,
    ConflictManager,
    ConflictType,
    MergePlan,
    ResolutionAction,
    ResolutionStatus,
)


class TestConflictManager:
    def test_add_hash_conflict(self):
        manager = ConflictManager()

        files = [
            {"file_path": "/usb1/test.jpg", "source_package": "平板1"},
            {"file_path": "/usb2/test.jpg", "source_package": "平板2"},
        ]

        conflict = manager.add_hash_conflict(
            file_name="test.jpg",
            files=files,
            conflict_type="hash_mismatch",
            message="文件名称相同但内容不同",
        )

        assert conflict.conflict_id.startswith("hash_conflict_")
        assert conflict.conflict_type == ConflictType.HASH_CONFLICT
        assert conflict.severity == "high"
        assert conflict.status == ResolutionStatus.UNRESOLVED

        all_conflicts = manager.get_all_conflicts()
        assert len(all_conflicts) == 1

    def test_add_duplicate_point(self):
        manager = ConflictManager()

        points = [
            {"point_id": "P001", "source_package": "平板1", "lat": 39.9042},
            {"point_id": "P002", "source_package": "平板2", "lat": 39.9043},
        ]

        conflict = manager.add_duplicate_point(
            group_id="dup_0001",
            points=points,
            distance_meters=0.5,
            suggested_action="review_manually",
            message="发现2个重复点位",
        )

        assert conflict.conflict_type == ConflictType.DUPLICATE_POINT
        assert len(conflict.affected_items) == 2

    def test_resolve_conflict(self):
        manager = ConflictManager()

        conflict = manager.add_hash_conflict(
            file_name="test.jpg",
            files=[{"file_path": "/usb/test.jpg", "source_package": "平板1"}],
            conflict_type="identical",
            message="测试冲突",
        )

        assert conflict.status == ResolutionStatus.UNRESOLVED

        resolved = manager.resolve(
            conflict_id=conflict.conflict_id,
            action=ResolutionAction.KEEP,
            notes="保留平板1的版本",
        )

        assert resolved is not None
        assert resolved.action == ResolutionAction.KEEP
        assert resolved.status in [ResolutionStatus.RESOLVED, ResolutionStatus.AUTO_RESOLVED]
        assert resolved.resolution_notes == "保留平板1的版本"

    def test_get_unresolved_conflicts(self):
        manager = ConflictManager()

        conflict1 = manager.add_hash_conflict(
            file_name="a.jpg",
            files=[],
            conflict_type="identical",
            message="冲突1",
        )

        conflict2 = manager.add_hash_conflict(
            file_name="b.jpg",
            files=[],
            conflict_type="hash_mismatch",
            message="冲突2",
        )

        manager.resolve(conflict1.conflict_id, ResolutionAction.KEEP)

        unresolved = manager.get_unresolved_conflicts()
        assert len(unresolved) == 1
        assert unresolved[0].conflict_id == conflict2.conflict_id

    def test_get_summary(self):
        manager = ConflictManager()

        manager.add_hash_conflict("a.jpg", [], "identical", "冲突1")
        manager.add_duplicate_point("dup_001", [], 1.0, "keep", "冲突2")

        summary = manager.get_summary()

        assert summary["total"] == 2
        assert "hash_conflict" in summary["by_type"]
        assert "duplicate_point" in summary["by_type"]
        assert summary["unresolved"] == 2


class TestConflictItem:
    def test_to_dict(self):
        item = ConflictItem(
            conflict_id="test_001",
            conflict_type=ConflictType.HASH_CONFLICT,
            severity="high",
            source_packages=["平板1", "平板2"],
            affected_items=[],
            message="测试冲突",
        )

        data = item.to_dict()

        assert data["conflict_id"] == "test_001"
        assert data["conflict_type"] == "hash_conflict"
        assert data["severity"] == "high"
        assert data["status"] == "unresolved"

    def test_from_dict(self):
        data = {
            "conflict_id": "test_002",
            "conflict_type": "duplicate_point",
            "severity": "medium",
            "source_packages": ["平板1"],
            "affected_items": [{"point_id": "P001"}],
            "message": "重复点位",
            "action": "keep",
            "status": "resolved",
        }

        item = ConflictItem.from_dict(data)

        assert item.conflict_id == "test_002"
        assert item.conflict_type == ConflictType.DUPLICATE_POINT
        assert item.action == ResolutionAction.KEEP
        assert item.status == ResolutionStatus.RESOLVED


class TestMergePlan:
    def test_to_dict(self):
        plan = MergePlan(
            plan_id="plan_001",
            created_at=datetime.now(),
            source_packages=["平板1", "平板2"],
            total_files=10,
            unique_files=8,
            dry_run=True,
        )

        data = plan.to_dict()

        assert data["plan_id"] == "plan_001"
        assert data["total_files"] == 10
        assert data["unique_files"] == 8
        assert data["dry_run"] is True

    def test_from_dict(self):
        data = {
            "plan_id": "plan_002",
            "created_at": datetime.now().isoformat(),
            "source_packages": ["平板1"],
            "total_files": 5,
            "unique_files": 5,
            "dry_run": False,
            "conflicts": [],
            "files_to_copy": [],
            "files_to_isolate": [],
            "files_to_rename": [],
            "summary": {},
        }

        plan = MergePlan.from_dict(data)

        assert plan.plan_id == "plan_002"
        assert plan.total_files == 5
        assert plan.dry_run is False
