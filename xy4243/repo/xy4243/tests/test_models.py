import pytest
from datetime import datetime, timedelta
from app.models import (
    Actor, Prop, Scene, HandoverRecord, Violation,
    HandoverStatus, DangerLevel, CheckStatus, BaseEntity
)


class TestBaseEntity:
    def test_id_auto_generation(self):
        entity = BaseEntity()
        assert entity.id is not None
        assert len(entity.id) > 0

    def test_id_specified(self):
        entity = BaseEntity(id="custom_id")
        assert entity.id == "custom_id"

    def test_timestamps(self):
        entity = BaseEntity()
        assert entity.created_at is not None
        assert entity.updated_at is not None


class TestActor:
    def test_actor_creation(self):
        actor = Actor(name="罗密欧", role="男主角", contact_info="123456")
        assert actor.name == "罗密欧"
        assert actor.role == "男主角"
        assert actor.contact_info == "123456"

    def test_actor_from_csv_row(self):
        row = {
            "name": "朱丽叶",
            "role": "女主角",
            "contact_info": "654321",
            "notes": "主角"
        }
        actor = Actor.from_csv_row(row)
        assert actor.name == "朱丽叶"
        assert actor.role == "女主角"
        assert actor.contact_info == "654321"
        assert actor.notes == "主角"


class TestProp:
    def test_prop_creation(self):
        prop = Prop(
            name="罗密欧之剑",
            category="武器",
            is_dangerous=True,
            danger_level=DangerLevel.MEDIUM
        )
        assert prop.name == "罗密欧之剑"
        assert prop.is_dangerous is True
        assert prop.danger_level == DangerLevel.MEDIUM

    def test_prop_from_csv_row(self):
        row = {
            "name": "毒药瓶",
            "category": "容器",
            "danger_level": "HIGH",
            "is_dangerous": "True",
            "danger_description": "仿真毒药",
            "requires_verification": "yes",
            "total_quantity": "2",
            "available_quantity": "2"
        }
        prop = Prop.from_csv_row(row)
        assert prop.name == "毒药瓶"
        assert prop.danger_level == DangerLevel.HIGH
        assert prop.is_dangerous is True
        assert prop.requires_verification is True
        assert prop.total_quantity == 2

    def test_dangerous_prop_requires_verification(self):
        prop = Prop(is_dangerous=True, requires_verification=None)
        assert prop.requires_verification is True


class TestScene:
    def test_scene_creation(self):
        scene = Scene(
            act_number=1,
            scene_number=1,
            title="维洛那广场",
            duration_minutes=15
        )
        assert scene.act_number == 1
        assert scene.scene_number == 1
        assert scene.title == "维洛那广场"
        assert scene.full_title == "第1幕 - 第1场 - 维洛那广场"

    def test_scene_from_csv_row(self):
        row = {
            "act_number": "2",
            "scene_number": "1",
            "title": "阳台场景",
            "duration_minutes": "25"
        }
        scene = Scene.from_csv_row(row)
        assert scene.act_number == 2
        assert scene.scene_number == 1
        assert scene.title == "阳台场景"
        assert scene.duration_minutes == 25

    def test_scene_overlap(self):
        now = datetime.now()
        scene1 = Scene(
            act_number=1, scene_number=1,
            start_time=now,
            end_time=now + timedelta(hours=1)
        )
        scene2 = Scene(
            act_number=1, scene_number=2,
            start_time=now + timedelta(minutes=30),
            end_time=now + timedelta(hours=2)
        )
        scene3 = Scene(
            act_number=1, scene_number=3,
            start_time=now + timedelta(hours=2),
            end_time=now + timedelta(hours=3)
        )

        assert scene1.overlaps_with(scene2) is True
        assert scene1.overlaps_with(scene3) is False


class TestHandoverRecord:
    def test_handover_creation(self):
        handover = HandoverRecord(
            prop_id="prop_001",
            prop_name="罗密欧之剑",
            scene_id="scene_1_1",
            scene_title="维洛那广场",
            actor_name="罗密欧",
            status=HandoverStatus.PENDING
        )
        assert handover.prop_name == "罗密欧之剑"
        assert handover.status == HandoverStatus.PENDING

    def test_sign_out_flow(self):
        handover = HandoverRecord(status=HandoverStatus.PENDING)
        handover.sign_out("场务A")
        
        assert handover.is_signed_out is True
        assert handover.handover_person == "场务A"
        assert handover.status == HandoverStatus.IN_USE

    def test_sign_in_flow(self):
        handover = HandoverRecord(status=HandoverStatus.IN_USE, is_signed_out=True)
        handover.sign_in("场务B")
        
        assert handover.is_signed_in is True
        assert handover.return_person == "场务B"
        assert handover.status == HandoverStatus.RETURNED

    def test_verify_flow(self):
        handover = HandoverRecord(status=HandoverStatus.RETURNED, is_signed_out=True, is_signed_in=True)
        handover.verify("监督", "道具完好")
        
        assert handover.is_verified is True
        assert handover.verification_person == "监督"
        assert handover.verification_notes == "道具完好"
        assert handover.status == HandoverStatus.VERIFIED

    def test_mark_lost(self):
        handover = HandoverRecord(status=HandoverStatus.IN_USE)
        handover.mark_lost()
        assert handover.status == HandoverStatus.LOST

    def test_is_missing_signature(self):
        handover1 = HandoverRecord(is_signed_out=False, is_signed_in=True)
        handover2 = HandoverRecord(is_signed_out=True, is_signed_in=False)
        handover3 = HandoverRecord(is_signed_out=True, is_signed_in=True)

        assert handover1.is_missing_signature() is True
        assert handover2.is_missing_signature() is True
        assert handover3.is_missing_signature() is False

    def test_is_overdue(self):
        now = datetime.now()
        scheduled_end = now - timedelta(hours=48)
        
        handover = HandoverRecord(
            scheduled_end_time=scheduled_end,
            status=HandoverStatus.IN_USE
        )
        
        assert handover.is_overdue(now, grace_hours=24) is True
        assert handover.is_overdue(now, grace_hours=72) is False


class TestViolation:
    def test_violation_creation(self):
        violation = Violation(
            violation_type="道具时间冲突",
            severity="high",
            description="道具在两个场次中时间冲突",
            prop_name="罗密欧之剑"
        )
        assert violation.violation_type == "道具时间冲突"
        assert violation.severity == "high"
        assert violation.resolved is False

    def test_resolve_violation(self):
        violation = Violation(violation_type="测试问题", severity="medium")
        violation.resolve("处理人A", "已解决")
        
        assert violation.resolved is True
        assert violation.resolved_by == "处理人A"
        assert violation.resolution_notes == "已解决"
