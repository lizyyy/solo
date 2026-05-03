"""规则引擎测试"""

import pytest
from datetime import datetime
from race_timing_validator.models import (
    RaceData,
    Participant,
    ChipBinding,
    Wave,
    Checkpoint,
    CheckpointType,
    CheckpointLog,
    DNFRecord,
    ViolationType,
    ViolationLevel,
)
from race_timing_validator.rules import (
    check_duplicate_chips,
    check_wave_conflicts,
    check_unregistered_chips,
    check_missing_splits,
    check_abnormal_speed,
    check_dnf_finish,
    check_early_start,
    check_wrong_wave,
    build_split_records,
    run_all_checks,
)


class TestDuplicateChips:
    def test_chip_bound_to_multiple_bibs(self):
        """同一芯片绑定到多个号码布 - 严重违规"""
        race_data = RaceData()
        race_data.chip_bindings["TAG001"] = ChipBinding(chip_id="TAG001", bib_number="1001")
        race_data.chip_bindings["TAG002"] = ChipBinding(chip_id="TAG001", bib_number="1002")
        race_data.bib_to_chip["1001"] = ["TAG001"]
        race_data.bib_to_chip["1002"] = ["TAG001"]
        
        violations = check_duplicate_chips(race_data)
        
        assert len(violations) == 1
        assert violations[0].violation_type == ViolationType.DUPLICATE_CHIP
        assert violations[0].level == ViolationLevel.CRITICAL
        assert "TAG001" in violations[0].message

    def test_bib_bound_to_multiple_chips(self):
        """同一号码布绑定多个芯片 - 警告（可能是双芯片）"""
        race_data = RaceData()
        race_data.chip_bindings["TAG001"] = ChipBinding(chip_id="TAG001", bib_number="1001")
        race_data.chip_bindings["TAG002"] = ChipBinding(chip_id="TAG002", bib_number="1001")
        race_data.bib_to_chip["1001"] = ["TAG001", "TAG002"]
        
        violations = check_duplicate_chips(race_data)
        
        assert len(violations) == 1
        assert violations[0].level == ViolationLevel.WARNING
        assert "1001" in violations[0].message

    def test_no_duplicates(self):
        """无重复绑定"""
        race_data = RaceData()
        race_data.chip_bindings["TAG001"] = ChipBinding(chip_id="TAG001", bib_number="1001")
        race_data.chip_bindings["TAG002"] = ChipBinding(chip_id="TAG002", bib_number="1002")
        race_data.bib_to_chip["1001"] = ["TAG001"]
        race_data.bib_to_chip["1002"] = ["TAG002"]
        
        violations = check_duplicate_chips(race_data)
        assert len(violations) == 0


class TestWaveConflicts:
    def test_participant_without_wave(self):
        """选手未分配波次"""
        race_data = RaceData()
        race_data.participants["1001"] = Participant(
            bib_number="1001", name="张三", wave_id=None
        )
        
        violations = check_wave_conflicts(race_data)
        assert len(violations) == 1
        assert violations[0].violation_type == ViolationType.WAVE_CONFLICT
        assert "1001" in violations[0].message

    def test_wave_exceeds_capacity(self):
        """波次人数超限"""
        race_data = RaceData()
        race_data.waves["W1"] = Wave(
            wave_id="W1", wave_name="A",
            start_time="2024-05-01 06:00:00", max_participants=2
        )
        race_data.participants["1001"] = Participant(
            bib_number="1001", name="张三", wave_id="W1"
        )
        race_data.participants["1002"] = Participant(
            bib_number="1002", name="李四", wave_id="W1"
        )
        race_data.participants["1003"] = Participant(
            bib_number="1003", name="王五", wave_id="W1"
        )
        
        violations = check_wave_conflicts(race_data)
        assert any(v.level == ViolationLevel.WARNING and "W1" in v.message for v in violations)


class TestUnregisteredChips:
    def test_unregistered_chip_in_logs(self):
        """日志中出现未绑定的芯片"""
        race_data = RaceData()
        race_data.chip_bindings["TAG001"] = ChipBinding(chip_id="TAG001", bib_number="1001")
        race_data.checkpoint_logs = [
            CheckpointLog(
                log_id="L001", chip_id="TAG001",
                checkpoint_id="CP01", read_time="2024-05-01 06:00:00"
            ),
            CheckpointLog(
                log_id="L002", chip_id="TAG999",
                checkpoint_id="CP01", read_time="2024-05-01 06:00:05"
            ),
        ]
        
        violations = check_unregistered_chips(race_data)
        assert len(violations) == 1
        assert violations[0].violation_type == ViolationType.UNREGISTERED_CHIP
        assert violations[0].level == ViolationLevel.CRITICAL
        assert "TAG999" in violations[0].message


class TestBuildSplitRecords:
    def test_build_basic_chain(self):
        """构建基本计时链"""
        race_data = RaceData()
        
        race_data.participants["1001"] = Participant(
            bib_number="1001", name="张三", wave_id="W1"
        )
        race_data.chip_bindings["TAG001"] = ChipBinding(chip_id="TAG001", bib_number="1001")
        race_data.bib_to_chip["1001"] = ["TAG001"]
        
        race_data.waves["W1"] = Wave(
            wave_id="W1", wave_name="A",
            start_time="2024-05-01 06:00:00"
        )
        
        race_data.checkpoints["CP01"] = Checkpoint(
            checkpoint_id="CP01", name="起点", cp_type=CheckpointType.START,
            distance_from_start=0, order=1
        )
        race_data.checkpoints["CP02"] = Checkpoint(
            checkpoint_id="CP02", name="CP1", cp_type=CheckpointType.CP,
            distance_from_start=5, order=2
        )
        race_data.checkpoints["CP03"] = Checkpoint(
            checkpoint_id="CP03", name="终点", cp_type=CheckpointType.FINISH,
            distance_from_start=10, order=3
        )
        
        race_data.checkpoint_logs = [
            CheckpointLog(
                log_id="L001", chip_id="TAG001",
                checkpoint_id="CP01", read_time="2024-05-01 06:00:15"
            ),
            CheckpointLog(
                log_id="L002", chip_id="TAG001",
                checkpoint_id="CP02", read_time="2024-05-01 06:45:00"
            ),
            CheckpointLog(
                log_id="L003", chip_id="TAG001",
                checkpoint_id="CP03", read_time="2024-05-01 07:30:00"
            ),
        ]
        
        splits = build_split_records(race_data)
        
        assert "1001" in splits
        assert len(splits["1001"]) == 3
        
        split_times = [s.split_time for s in splits["1001"]]
        assert all(t is not None for t in split_times)

    def test_no_binding_for_log(self):
        """日志中的芯片没有绑定关系"""
        race_data = RaceData()
        race_data.checkpoint_logs = [
            CheckpointLog(
                log_id="L001", chip_id="TAG001",
                checkpoint_id="CP01", read_time="2024-05-01 06:00:00"
            ),
        ]
        
        splits = build_split_records(race_data)
        assert len(splits) == 0


class TestMissingSplits:
    def test_finisher_missing_start(self):
        """完赛选手缺少起点"""
        race_data = RaceData()
        race_data.checkpoints["CP01"] = Checkpoint(
            checkpoint_id="CP01", name="起点", cp_type=CheckpointType.START,
            distance_from_start=0, order=1
        )
        race_data.checkpoints["CP02"] = Checkpoint(
            checkpoint_id="CP02", name="终点", cp_type=CheckpointType.FINISH,
            distance_from_start=10, order=2
        )
        
        participant_splits = self._create_test_splits(race_data, missing_start=True)
        
        violations = check_missing_splits(race_data, participant_splits)
        
        assert len(violations) == 1
        assert violations[0].violation_type == ViolationType.MISSING_SPLIT
        assert violations[0].level == ViolationLevel.CRITICAL

    def test_finisher_missing_cp(self):
        """完赛选手缺少中间检查点"""
        race_data = RaceData()
        race_data.checkpoints["CP01"] = Checkpoint(
            checkpoint_id="CP01", name="起点", cp_type=CheckpointType.START,
            distance_from_start=0, order=1
        )
        race_data.checkpoints["CP02"] = Checkpoint(
            checkpoint_id="CP02", name="CP1", cp_type=CheckpointType.CP,
            distance_from_start=5, order=2
        )
        race_data.checkpoints["CP03"] = Checkpoint(
            checkpoint_id="CP03", name="终点", cp_type=CheckpointType.FINISH,
            distance_from_start=10, order=3
        )
        
        participant_splits = self._create_test_splits(race_data, missing_cp=True)
        
        violations = check_missing_splits(race_data, participant_splits)
        
        assert len(violations) == 1
        assert "CP1" in violations[0].message

    def _create_test_splits(self, race_data, missing_start=False, missing_cp=False):
        """辅助方法创建测试分段数据"""
        from race_timing_validator.models import SplitRecord, Participant, Wave
        
        p = Participant(bib_number="1001", name="张三", wave_id="W1")
        wave = Wave(wave_id="W1", wave_name="A", start_time="2024-05-01 06:00:00")
        
        splits = []
        base_time = datetime(2024, 5, 1, 6, 0, 0)
        
        checkpoints = race_data.get_sorted_checkpoints()
        
        for i, cp in enumerate(checkpoints):
            if missing_start and cp.cp_type == CheckpointType.START:
                continue
            if missing_cp and cp.cp_type == CheckpointType.CP:
                continue
            
            from datetime import timedelta
            log_time = base_time + timedelta(minutes=i * 45)
            
            split = SplitRecord(
                participant=p,
                chip_id="TAG001",
                checkpoint=cp,
                wave=wave,
                log_time=log_time,
                split_time=timedelta(minutes=i * 45),
                segment_time=timedelta(minutes=45) if i > 0 else None,
            )
            splits.append(split)
        
        return {"1001": splits}


class TestAbnormalSpeed:
    def test_too_fast_speed(self):
        """速度过快"""
        from race_timing_validator.models import SplitRecord, Participant, Wave, Checkpoint, CheckpointType
        from datetime import datetime, timedelta
        
        race_data = RaceData()
        race_data.checkpoints["CP01"] = Checkpoint(
            checkpoint_id="CP01", name="起点", cp_type=CheckpointType.START,
            distance_from_start=0, order=1
        )
        race_data.checkpoints["CP02"] = Checkpoint(
            checkpoint_id="CP02", name="CP1", cp_type=CheckpointType.CP,
            distance_from_start=5, order=2
        )
        
        p = Participant(bib_number="1001", name="张三", wave_id="W1")
        wave = Wave(wave_id="W1", wave_name="A", start_time="2024-05-01 06:00:00")
        
        split1 = SplitRecord(
            participant=p, chip_id="TAG001",
            checkpoint=race_data.checkpoints["CP01"],
            wave=wave,
            log_time=datetime(2024, 5, 1, 6, 0, 0),
            split_time=timedelta(0),
            segment_time=None,
        )
        
        split2 = SplitRecord(
            participant=p, chip_id="TAG001",
            checkpoint=race_data.checkpoints["CP02"],
            wave=wave,
            log_time=datetime(2024, 5, 1, 6, 5, 0),
            split_time=timedelta(minutes=5),
            segment_time=timedelta(minutes=5),
        )
        
        participant_splits = {"1001": [split1, split2]}
        
        violations = check_abnormal_speed(race_data, participant_splits, max_speed_kmh=25)
        
        assert len(violations) == 1
        assert violations[0].violation_type == ViolationType.ABNORMAL_SPEED
        assert violations[0].level == ViolationLevel.CRITICAL

    def test_normal_speed(self):
        """正常速度"""
        from race_timing_validator.models import SplitRecord, Participant, Wave, Checkpoint, CheckpointType
        from datetime import datetime, timedelta
        
        race_data = RaceData()
        race_data.checkpoints["CP01"] = Checkpoint(
            checkpoint_id="CP01", name="起点", cp_type=CheckpointType.START,
            distance_from_start=0, order=1
        )
        race_data.checkpoints["CP02"] = Checkpoint(
            checkpoint_id="CP02", name="CP1", cp_type=CheckpointType.CP,
            distance_from_start=5, order=2
        )
        
        p = Participant(bib_number="1001", name="张三", wave_id="W1")
        wave = Wave(wave_id="W1", wave_name="A", start_time="2024-05-01 06:00:00")
        
        split1 = SplitRecord(
            participant=p, chip_id="TAG001",
            checkpoint=race_data.checkpoints["CP01"],
            wave=wave,
            log_time=datetime(2024, 5, 1, 6, 0, 0),
            split_time=timedelta(0),
            segment_time=None,
        )
        
        split2 = SplitRecord(
            participant=p, chip_id="TAG001",
            checkpoint=race_data.checkpoints["CP02"],
            wave=wave,
            log_time=datetime(2024, 5, 1, 6, 45, 0),
            split_time=timedelta(minutes=45),
            segment_time=timedelta(minutes=45),
        )
        
        participant_splits = {"1001": [split1, split2]}
        
        violations = check_abnormal_speed(race_data, participant_splits, max_speed_kmh=25)
        assert len(violations) == 0


class TestDnfFinish:
    def test_dnf_but_finished(self):
        """已标记退赛但有终点记录"""
        from race_timing_validator.models import SplitRecord, Participant, Wave, Checkpoint, CheckpointType, DNFRecord
        from datetime import datetime, timedelta
        
        race_data = RaceData()
        race_data.checkpoints["CP01"] = Checkpoint(
            checkpoint_id="CP01", name="起点", cp_type=CheckpointType.START,
            distance_from_start=0, order=1
        )
        race_data.checkpoints["CP02"] = Checkpoint(
            checkpoint_id="CP02", name="终点", cp_type=CheckpointType.FINISH,
            distance_from_start=10, order=2
        )
        race_data.dnf_records["1001"] = DNFRecord(bib_number="1001")
        
        p = Participant(bib_number="1001", name="张三", wave_id="W1")
        wave = Wave(wave_id="W1", wave_name="A", start_time="2024-05-01 06:00:00")
        
        split = SplitRecord(
            participant=p, chip_id="TAG001",
            checkpoint=race_data.checkpoints["CP02"],
            wave=wave,
            log_time=datetime(2024, 5, 1, 8, 0, 0),
            split_time=timedelta(hours=2),
            segment_time=None,
        )
        
        participant_splits = {"1001": [split]}
        
        violations = check_dnf_finish(race_data, participant_splits)
        
        assert len(violations) == 1
        assert violations[0].violation_type == ViolationType.DNF_FINISH
        assert violations[0].level == ViolationLevel.CRITICAL


class TestEarlyStart:
    def test_significant_early_start(self):
        """明显抢跑（超过60秒）"""
        from race_timing_validator.models import SplitRecord, Participant, Wave, Checkpoint, CheckpointType
        from datetime import datetime, timedelta
        
        race_data = RaceData()
        race_data.checkpoints["CP01"] = Checkpoint(
            checkpoint_id="CP01", name="起点", cp_type=CheckpointType.START,
            distance_from_start=0, order=1
        )
        
        p = Participant(bib_number="1001", name="张三", wave_id="W1")
        wave = Wave(wave_id="W1", wave_name="A", start_time="2024-05-01 06:00:00")
        
        split = SplitRecord(
            participant=p, chip_id="TAG001",
            checkpoint=race_data.checkpoints["CP01"],
            wave=wave,
            log_time=datetime(2024, 5, 1, 5, 58, 0),
            split_time=None,
            segment_time=None,
        )
        
        participant_splits = {"1001": [split]}
        
        violations = check_early_start(race_data, participant_splits, grace_seconds=30)
        
        assert len(violations) == 1
        assert violations[0].violation_type == ViolationType.EARLY_START
        assert violations[0].level == ViolationLevel.CRITICAL

    def test_within_grace_period(self):
        """在宽限期内"""
        from race_timing_validator.models import SplitRecord, Participant, Wave, Checkpoint, CheckpointType
        from datetime import datetime, timedelta
        
        race_data = RaceData()
        race_data.checkpoints["CP01"] = Checkpoint(
            checkpoint_id="CP01", name="起点", cp_type=CheckpointType.START,
            distance_from_start=0, order=1
        )
        
        p = Participant(bib_number="1001", name="张三", wave_id="W1")
        wave = Wave(wave_id="W1", wave_name="A", start_time="2024-05-01 06:00:00")
        
        split = SplitRecord(
            participant=p, chip_id="TAG001",
            checkpoint=race_data.checkpoints["CP01"],
            wave=wave,
            log_time=datetime(2024, 5, 1, 5, 59, 45),
            split_time=None,
            segment_time=None,
        )
        
        participant_splits = {"1001": [split]}
        
        violations = check_early_start(race_data, participant_splits, grace_seconds=30)
        assert len(violations) == 0


class TestAllChecks:
    def test_run_all_checks(self):
        """执行所有校验"""
        race_data = RaceData()
        
        race_data.participants["1001"] = Participant(
            bib_number="1001", name="张三", wave_id="W1"
        )
        race_data.participants["1002"] = Participant(
            bib_number="1002", name="李四", wave_id=None
        )
        
        race_data.chip_bindings["TAG001"] = ChipBinding(chip_id="TAG001", bib_number="1001")
        race_data.chip_bindings["TAG002"] = ChipBinding(chip_id="TAG001", bib_number="1002")
        race_data.bib_to_chip["1001"] = ["TAG001"]
        race_data.bib_to_chip["1002"] = ["TAG001"]
        
        race_data.waves["W1"] = Wave(
            wave_id="W1", wave_name="A",
            start_time="2024-05-01 06:00:00"
        )
        
        race_data.checkpoints["CP01"] = Checkpoint(
            checkpoint_id="CP01", name="起点", cp_type=CheckpointType.START,
            distance_from_start=0, order=1
        )
        race_data.checkpoints["CP02"] = Checkpoint(
            checkpoint_id="CP02", name="终点", cp_type=CheckpointType.FINISH,
            distance_from_start=10, order=2
        )
        
        race_data.checkpoint_logs = [
            CheckpointLog(
                log_id="L001", chip_id="TAG001",
                checkpoint_id="CP01", read_time="2024-05-01 06:00:00"
            ),
            CheckpointLog(
                log_id="L002", chip_id="TAG001",
                checkpoint_id="CP02", read_time="2024-05-01 08:00:00"
            ),
        ]
        
        violations = run_all_checks(race_data)
        
        assert len(violations) > 0
        assert any(v.violation_type == ViolationType.DUPLICATE_CHIP for v in violations)
        assert any(v.violation_type == ViolationType.WAVE_CONFLICT for v in violations)
