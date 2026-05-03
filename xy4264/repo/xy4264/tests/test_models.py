"""数据模型测试"""

import pytest
from datetime import datetime, timedelta
from race_timing_validator.models import (
    Participant,
    ChipBinding,
    Wave,
    Checkpoint,
    CheckpointType,
    CheckpointLog,
    DNFRecord,
    SplitRecord,
    Violation,
    ViolationType,
    ViolationLevel,
    RaceData,
)


class TestParticipant:
    def test_create_participant(self):
        p = Participant(
            bib_number="1001",
            name="张三",
            gender="M",
            age=35,
            category="50公里组",
            wave_id="W1",
        )
        assert p.bib_number == "1001"
        assert p.name == "张三"
        assert p.gender == "M"
        assert p.age == 35
        assert p.category == "50公里组"
        assert p.wave_id == "W1"

    def test_participant_optional_fields(self):
        p = Participant(
            bib_number="1001",
            name="张三",
        )
        assert p.gender is None
        assert p.age is None
        assert p.wave_id is None


class TestChipBinding:
    def test_create_binding(self):
        binding = ChipBinding(
            chip_id="TAG001",
            bib_number="1001",
            bind_time="2024-05-01 08:00:00",
        )
        assert binding.chip_id == "TAG001"
        assert binding.bib_number == "1001"
        assert isinstance(binding.bind_time, datetime)

    def test_binding_no_time(self):
        binding = ChipBinding(
            chip_id="TAG001",
            bib_number="1001",
        )
        assert binding.bind_time is None


class TestWave:
    def test_create_wave(self):
        wave = Wave(
            wave_id="W1",
            wave_name="精英",
            start_time="2024-05-01 06:00:00",
            max_participants=100,
        )
        assert wave.wave_id == "W1"
        assert wave.max_participants == 100
        assert isinstance(wave.start_time, datetime)

    def test_wave_enum_validation(self):
        from race_timing_validator.models import WaveType
        wave = Wave(
            wave_id="W1",
            wave_name="A",
            start_time="2024-05-01 06:00:00",
        )
        assert wave.wave_name == WaveType.A


class TestCheckpoint:
    def test_create_checkpoint(self):
        cp = Checkpoint(
            checkpoint_id="CP01",
            name="起点",
            cp_type="START",
            distance_from_start=0.0,
            order=1,
        )
        assert cp.checkpoint_id == "CP01"
        assert cp.name == "起点"
        assert cp.cp_type == CheckpointType.START
        assert cp.distance_from_start == 0.0

    def test_checkpoint_types(self):
        cp_start = Checkpoint(
            checkpoint_id="CP01", name="起点", cp_type="START",
            distance_from_start=0, order=1
        )
        cp_cp = Checkpoint(
            checkpoint_id="CP02", name="CP1", cp_type="CP",
            distance_from_start=5, order=2
        )
        cp_finish = Checkpoint(
            checkpoint_id="CP03", name="终点", cp_type="FINISH",
            distance_from_start=25, order=3
        )
        assert cp_start.cp_type == CheckpointType.START
        assert cp_cp.cp_type == CheckpointType.CP
        assert cp_finish.cp_type == CheckpointType.FINISH


class TestCheckpointLog:
    def test_create_log(self):
        log = CheckpointLog(
            log_id="L001",
            chip_id="TAG001",
            checkpoint_id="CP01",
            read_time="2024-05-01 06:00:00",
            device_id="RDR01",
        )
        assert log.log_id == "L001"
        assert isinstance(log.read_time, datetime)
        assert log.signal_strength is None


class TestViolation:
    def test_create_violation(self):
        v = Violation(
            violation_id="V001",
            violation_type=ViolationType.DUPLICATE_CHIP,
            level=ViolationLevel.CRITICAL,
            bib_number="1001",
            chip_id="TAG001",
            message="芯片 TAG001 被重复绑定",
        )
        assert v.violation_id == "V001"
        assert v.violation_type == ViolationType.DUPLICATE_CHIP
        assert v.level == ViolationLevel.CRITICAL
        assert not v.reviewed

    def test_violation_levels(self):
        critical = Violation(
            violation_id="V1",
            violation_type=ViolationType.DUPLICATE_CHIP,
            level=ViolationLevel.CRITICAL,
            message="test",
        )
        warning = Violation(
            violation_id="V2",
            violation_type=ViolationType.DUPLICATE_CHIP,
            level=ViolationLevel.WARNING,
            message="test",
        )
        info = Violation(
            violation_id="V3",
            violation_type=ViolationType.DUPLICATE_CHIP,
            level=ViolationLevel.INFO,
            message="test",
        )
        assert critical.level == ViolationLevel.CRITICAL
        assert warning.level == ViolationLevel.WARNING
        assert info.level == ViolationLevel.INFO


class TestRaceData:
    def test_empty_race_data(self):
        rd = RaceData(race_name="测试赛事")
        assert rd.race_name == "测试赛事"
        assert len(rd.participants) == 0
        assert len(rd.violations) == 0

    def test_add_participant(self):
        rd = RaceData()
        p = Participant(bib_number="1001", name="张三")
        rd.participants["1001"] = p
        assert rd.get_participant_by_bib("1001") == p
        assert rd.get_participant_by_bib("9999") is None

    def test_is_dnf(self):
        rd = RaceData()
        rd.dnf_records["1001"] = DNFRecord(bib_number="1001")
        assert rd.is_dnf("1001") is True
        assert rd.is_dnf("1002") is False

    def test_add_violation(self):
        rd = RaceData()
        v = Violation(
            violation_id="V001",
            violation_type=ViolationType.DUPLICATE_CHIP,
            level=ViolationLevel.CRITICAL,
            message="test",
        )
        rd.add_violation(v)
        assert len(rd.violations) == 1
        assert rd.get_violations_by_type(ViolationType.DUPLICATE_CHIP)[0] == v
        assert rd.get_violations_by_level(ViolationLevel.CRITICAL)[0] == v
        assert len(rd.get_unreviewed_violations()) == 1


class TestSplitRecord:
    def test_create_split(self):
        p = Participant(bib_number="1001", name="张三", wave_id="W1")
        cp = Checkpoint(
            checkpoint_id="CP01", name="起点", cp_type="START",
            distance_from_start=0, order=1
        )
        wave = Wave(
            wave_id="W1", wave_name="A", start_time="2024-05-01 06:00:00"
        )
        
        split = SplitRecord(
            participant=p,
            chip_id="TAG001",
            checkpoint=cp,
            wave=wave,
            log_time=datetime(2024, 5, 1, 6, 0, 15),
            split_time=timedelta(seconds=15),
            segment_time=timedelta(seconds=15),
        )
        
        assert split.participant.bib_number == "1001"
        assert split.chip_id == "TAG001"
        assert split.split_time == timedelta(seconds=15)
