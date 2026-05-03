import pytest
import tempfile
from pathlib import Path
from datetime import datetime, timedelta

from app.storage import (
    Database, ActorStore, PropStore, SceneStore, 
    HandoverStore, ViolationStore, StoreManager, StoreStats
)
from app.models import (
    Actor, Prop, Scene, HandoverRecord, Violation,
    HandoverStatus, DangerLevel, CheckStatus
)


class TestDatabase:
    def test_database_creation(self, tmp_path):
        db_path = tmp_path / "test.db"
        db = Database(db_path)
        
        assert db_path.exists()

    def test_database_connection(self, tmp_path):
        db_path = tmp_path / "test.db"
        db = Database(db_path)
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            assert result[0] == 1


class TestActorStore:
    def test_save_and_get(self, tmp_path):
        db = Database(tmp_path / "test.db")
        store = ActorStore(db)

        actor = Actor(name="罗密欧", role="男主角")
        saved = store.save(actor)

        retrieved = store.get_by_id(saved.id)
        assert retrieved is not None
        assert retrieved.name == "罗密欧"
        assert retrieved.role == "男主角"

    def test_get_all(self, tmp_path):
        db = Database(tmp_path / "test.db")
        store = ActorStore(db)

        store.save(Actor(name="罗密欧"))
        store.save(Actor(name="朱丽叶"))

        all_actors = store.get_all()
        assert len(all_actors) == 2

    def test_delete(self, tmp_path):
        db = Database(tmp_path / "test.db")
        store = ActorStore(db)

        actor = store.save(Actor(name="测试"))
        assert store.count() == 1

        store.delete(actor.id)
        assert store.count() == 0


class TestPropStore:
    def test_save_and_get(self, tmp_path):
        db = Database(tmp_path / "test.db")
        store = PropStore(db)

        prop = Prop(
            name="罗密欧之剑",
            category="武器",
            is_dangerous=True,
            danger_level=DangerLevel.MEDIUM
        )
        saved = store.save(prop)

        retrieved = store.get_by_id(saved.id)
        assert retrieved is not None
        assert retrieved.name == "罗密欧之剑"
        assert retrieved.is_dangerous is True

    def test_get_dangerous_props(self, tmp_path):
        db = Database(tmp_path / "test.db")
        store = PropStore(db)

        store.save(Prop(name="安全道具", is_dangerous=False, danger_level=DangerLevel.SAFE))
        store.save(Prop(name="危险道具", is_dangerous=True, danger_level=DangerLevel.HIGH))

        dangerous = store.get_dangerous_props()
        assert len(dangerous) == 1
        assert dangerous[0].name == "危险道具"


class TestSceneStore:
    def test_save_and_get(self, tmp_path):
        db = Database(tmp_path / "test.db")
        store = SceneStore(db)

        scene = Scene(
            act_number=1,
            scene_number=1,
            title="维洛那广场",
            duration_minutes=15
        )
        saved = store.save(scene)

        retrieved = store.get_by_id(saved.id)
        assert retrieved is not None
        assert retrieved.act_number == 1
        assert retrieved.scene_number == 1
        assert retrieved.title == "维洛那广场"

    def test_get_by_act_scene(self, tmp_path):
        db = Database(tmp_path / "test.db")
        store = SceneStore(db)

        scene = Scene(act_number=2, scene_number=3, title="测试场景")
        store.save(scene)

        retrieved = store.get_by_act_scene(2, 3)
        assert retrieved is not None
        assert retrieved.title == "测试场景"


class TestHandoverStore:
    def test_save_and_get(self, tmp_path):
        db = Database(tmp_path / "test.db")
        store = HandoverStore(db)

        handover = HandoverRecord(
            prop_id="prop_001",
            prop_name="罗密欧之剑",
            scene_id="scene_1_1",
            scene_title="维洛那广场",
            actor_name="罗密欧",
            status=HandoverStatus.PENDING
        )
        saved = store.save(handover)

        retrieved = store.get_by_id(saved.id)
        assert retrieved is not None
        assert retrieved.prop_name == "罗密欧之剑"
        assert retrieved.status == HandoverStatus.PENDING

    def test_get_by_status(self, tmp_path):
        db = Database(tmp_path / "test.db")
        store = HandoverStore(db)

        store.save(HandoverRecord(prop_name="道具1", status=HandoverStatus.IN_USE))
        store.save(HandoverRecord(prop_name="道具2", status=HandoverStatus.RETURNED))
        store.save(HandoverRecord(prop_name="道具3", status=HandoverStatus.IN_USE))

        in_use = store.get_by_status(HandoverStatus.IN_USE)
        assert len(in_use) == 2

    def test_get_active_handovers(self, tmp_path):
        db = Database(tmp_path / "test.db")
        store = HandoverStore(db)

        store.save(HandoverRecord(prop_name="道具1", status=HandoverStatus.PENDING))
        store.save(HandoverRecord(prop_name="道具2", status=HandoverStatus.IN_USE))
        store.save(HandoverRecord(prop_name="道具3", status=HandoverStatus.RETURNED))
        store.save(HandoverRecord(prop_name="道具4", status=HandoverStatus.LOST))

        active = store.get_active_handovers()
        assert len(active) == 2


class TestViolationStore:
    def test_save_and_get(self, tmp_path):
        db = Database(tmp_path / "test.db")
        store = ViolationStore(db)

        violation = Violation(
            violation_type="道具时间冲突",
            severity="high",
            description="测试问题",
            prop_name="罗密欧之剑"
        )
        saved = store.save(violation)

        retrieved = store.get_by_id(saved.id)
        assert retrieved is not None
        assert retrieved.violation_type == "道具时间冲突"
        assert retrieved.resolved is False

    def test_resolve(self, tmp_path):
        db = Database(tmp_path / "test.db")
        store = ViolationStore(db)

        violation = store.save(Violation(violation_type="测试", severity="medium"))
        assert violation.resolved is False

        store.resolve(violation.id, "处理人", "已解决")
        retrieved = store.get_by_id(violation.id)
        
        assert retrieved.resolved is True
        assert retrieved.resolved_by == "处理人"

    def test_get_unresolved(self, tmp_path):
        db = Database(tmp_path / "test.db")
        store = ViolationStore(db)

        store.save(Violation(violation_type="问题1", severity="high", resolved=False))
        store.save(Violation(violation_type="问题2", severity="medium", resolved=True))
        store.save(Violation(violation_type="问题3", severity="low", resolved=False))

        unresolved = store.get_unresolved()
        assert len(unresolved) == 2


class TestStoreManager:
    def test_get_stats(self, tmp_path):
        db_path = tmp_path / "test.db"
        manager = StoreManager(db_path)

        manager.actors.save(Actor(name="罗密欧"))
        manager.props.save(Prop(name="安全道具"))
        manager.props.save(Prop(name="危险道具", is_dangerous=True, danger_level=DangerLevel.HIGH))
        manager.scenes.save(Scene(act_number=1, scene_number=1))
        manager.handovers.save(HandoverRecord(prop_name="测试", status=HandoverStatus.IN_USE))
        manager.violations.save(Violation(violation_type="测试", severity="high"))

        stats = manager.get_stats()

        assert stats.actor_count == 1
        assert stats.prop_count == 2
        assert stats.scene_count == 1
        assert stats.handover_count == 1
        assert stats.active_handover_count == 1
        assert stats.unresolved_violation_count == 1
        assert stats.dangerous_prop_count == 1

    def test_clear_all_data(self, tmp_path):
        db_path = tmp_path / "test.db"
        manager = StoreManager(db_path)

        manager.actors.save(Actor(name="罗密欧"))
        manager.props.save(Prop(name="道具"))
        manager.scenes.save(Scene(act_number=1, scene_number=1))
        manager.handovers.save(HandoverRecord(prop_name="测试"))
        manager.violations.save(Violation(violation_type="测试", severity="high"))

        counts = manager.clear_all_data()

        assert counts["actors"] == 1
        assert counts["props"] == 1
        assert counts["scenes"] == 1
        assert counts["handovers"] == 1
        assert counts["violations"] == 1

        stats = manager.get_stats()
        assert stats.actor_count == 0
        assert stats.prop_count == 0
