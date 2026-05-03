import pytest
from datetime import datetime, timedelta

from app.rules import (
    TimeConflictCheck, TimeConflictCheckData,
    MissingSignatureCheck, MissingSignatureCheckData,
    DangerousPropCheck, DangerousPropCheckData,
    LostOverdueCheck, LostOverdueCheckData,
    RulesEngine, RulesEngineConfig
)
from app.models import (
    Prop, Scene, HandoverRecord, Violation,
    HandoverStatus, DangerLevel
)


class TestTimeConflictCheck:
    def test_no_conflict(self):
        now = datetime.now()
        
        prop = Prop(id="prop_001", name="测试道具")
        scene1 = Scene(id="scene_001", act_number=1, scene_number=1, title="场次1")
        scene2 = Scene(id="scene_002", act_number=1, scene_number=2, title="场次2")

        handover1 = HandoverRecord(
            prop_id="prop_001", prop_name="测试道具",
            scene_id="scene_001", scene_title="场次1",
            scheduled_start_time=now,
            scheduled_end_time=now + timedelta(hours=1)
        )
        handover2 = HandoverRecord(
            prop_id="prop_001", prop_name="测试道具",
            scene_id="scene_002", scene_title="场次2",
            scheduled_start_time=now + timedelta(hours=2),
            scheduled_end_time=now + timedelta(hours=3)
        )

        check = TimeConflictCheck()
        data = TimeConflictCheckData(
            handovers=[handover1, handover2],
            props=[prop],
            scenes=[scene1, scene2]
        )
        result = check.execute(data)

        assert result.check_status.value == 1
        assert len(result.violations) == 0

    def test_has_conflict(self):
        now = datetime.now()
        
        prop = Prop(id="prop_001", name="测试道具")
        scene1 = Scene(id="scene_001", act_number=1, scene_number=1, title="场次1")
        scene2 = Scene(id="scene_002", act_number=1, scene_number=2, title="场次2")

        handover1 = HandoverRecord(
            prop_id="prop_001", prop_name="测试道具",
            scene_id="scene_001", scene_title="场次1",
            scheduled_start_time=now,
            scheduled_end_time=now + timedelta(hours=2)
        )
        handover2 = HandoverRecord(
            prop_id="prop_001", prop_name="测试道具",
            scene_id="scene_002", scene_title="场次2",
            scheduled_start_time=now + timedelta(hours=1),
            scheduled_end_time=now + timedelta(hours=3)
        )

        check = TimeConflictCheck()
        data = TimeConflictCheckData(
            handovers=[handover1, handover2],
            props=[prop],
            scenes=[scene1, scene2]
        )
        result = check.execute(data)

        assert len(result.violations) == 1
        assert result.violations[0].violation_type == "道具时间冲突"


class TestMissingSignatureCheck:
    def test_missing_signature_detected(self):
        handover1 = HandoverRecord(
            is_signed_out=False,
            is_signed_in=True,
            status=HandoverStatus.RETURNED
        )
        handover2 = HandoverRecord(
            is_signed_out=True,
            is_signed_in=False,
            status=HandoverStatus.RETURNED
        )
        handover3 = HandoverRecord(
            is_signed_out=True,
            is_signed_in=True,
            status=HandoverStatus.VERIFIED
        )

        check = MissingSignatureCheck(check_only_completed=True)
        data = MissingSignatureCheckData(handovers=[handover1, handover2, handover3])
        result = check.execute(data)

        assert len(result.violations) == 2

    def test_pending_not_checked(self):
        handover = HandoverRecord(
            is_signed_out=False,
            is_signed_in=False,
            status=HandoverStatus.PENDING
        )

        check = MissingSignatureCheck(check_only_completed=True)
        data = MissingSignatureCheckData(handovers=[handover])
        result = check.execute(data)

        assert len(result.violations) == 0


class TestDangerousPropCheck:
    def test_dangerous_prop_not_verified(self):
        prop = Prop(
            id="prop_001", name="毒药瓶",
            is_dangerous=True,
            danger_level=DangerLevel.HIGH,
            requires_verification=True
        )
        handover = HandoverRecord(
            prop_id="prop_001", prop_name="毒药瓶",
            is_signed_out=True,
            is_signed_in=True,
            is_verified=False,
            status=HandoverStatus.RETURNED
        )

        check = DangerousPropCheck(danger_level_threshold=DangerLevel.LOW)
        data = DangerousPropCheckData(handovers=[handover], props=[prop])
        result = check.execute(data)

        assert len(result.violations) == 1
        assert result.violations[0].violation_type == "危险品未复核"

    def test_safe_prop_not_checked(self):
        prop = Prop(
            id="prop_001", name="面纱",
            is_dangerous=False,
            danger_level=DangerLevel.SAFE
        )
        handover = HandoverRecord(
            prop_id="prop_001", prop_name="面纱",
            is_signed_in=True,
            is_verified=False,
            status=HandoverStatus.RETURNED
        )

        check = DangerousPropCheck(danger_level_threshold=DangerLevel.LOW)
        data = DangerousPropCheckData(handovers=[handover], props=[prop])
        result = check.execute(data)

        assert len(result.violations) == 0


class TestLostOverdueCheck:
    def test_lost_status_detected(self):
        handover = HandoverRecord(status=HandoverStatus.LOST)
        
        check = LostOverdueCheck()
        data = LostOverdueCheckData(handovers=[handover])
        result = check.execute(data)

        assert len(result.violations) == 1
        assert result.violations[0].violation_type == "道具遗失"

    def test_missing_status_detected(self):
        handover = HandoverRecord(status=HandoverStatus.MISSING)
        
        check = LostOverdueCheck()
        data = LostOverdueCheckData(handovers=[handover])
        result = check.execute(data)

        assert len(result.violations) == 1
        assert result.violations[0].violation_type == "道具丢失"

    def test_overdue_detected(self):
        now = datetime.now()
        scheduled_end = now - timedelta(hours=48)
        
        handover = HandoverRecord(
            scheduled_end_time=scheduled_end,
            status=HandoverStatus.IN_USE
        )

        check = LostOverdueCheck(grace_hours=24)
        data = LostOverdueCheckData(handovers=[handover], current_time=now)
        result = check.execute(data)

        assert len(result.violations) == 1
        assert result.violations[0].severity == "high"

    def test_returned_not_overdue(self):
        now = datetime.now()
        scheduled_end = now - timedelta(hours=48)
        
        handover = HandoverRecord(
            scheduled_end_time=scheduled_end,
            status=HandoverStatus.RETURNED
        )

        check = LostOverdueCheck(grace_hours=24)
        data = LostOverdueCheckData(handovers=[handover], current_time=now)
        result = check.execute(data)

        assert len(result.violations) == 0


class TestRulesEngine:
    def test_run_all_checks(self):
        now = datetime.now()
        
        props = [
            Prop(id="prop_001", name="测试道具1", is_dangerous=False),
            Prop(id="prop_002", name="危险道具", is_dangerous=True, danger_level=DangerLevel.HIGH)
        ]
        scenes = [
            Scene(id="scene_001", act_number=1, scene_number=1)
        ]
        handovers = [
            HandoverRecord(
                prop_id="prop_002", prop_name="危险道具",
                scene_id="scene_001",
                scheduled_start_time=now,
                scheduled_end_time=now + timedelta(hours=1),
                is_signed_in=True,
                is_verified=False,
                status=HandoverStatus.RETURNED
            )
        ]

        engine = RulesEngine()
        result = engine.run_all_checks(handovers, props, scenes)

        assert len(result.all_violations) >= 1
