#!/usr/bin/env python3
"""验证项目可运行性的测试脚本"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timedelta
from pathlib import Path
import tempfile


def test_module_imports():
    """测试所有模块导入"""
    print("=" * 50)
    print("测试 1: 模块导入")
    print("=" * 50)
    
    from eeg_aligner import __version__
    print(f"  版本: {__version__}")
    
    from eeg_aligner.models import (
        SleepStage, EventType, IssueSeverity, IssueType,
        EEGChannelSummary, StimulusEvent, SleepStageEpoch,
        ClockCalibration, ValidationIssue, AlignmentResult,
        CheckResult, ProjectData
    )
    print("  ✓ 模型模块导入成功")
    
    from eeg_aligner.parsers import (
        EEGCSVParser, EventsJSONLParser, SleepStagesParser,
        ClockCalibrationParser, DataValidator
    )
    print("  ✓ 解析器模块导入成功")
    
    from eeg_aligner.alignment import ClockDriftEstimator, EventAligner
    print("  ✓ 对齐算法模块导入成功")
    
    from eeg_aligner.rules import (
        CheckEngine, CodeRuleEngine, StageRuleEngine, ArtifactRuleEngine
    )
    print("  ✓ 规则引擎模块导入成功")
    
    from eeg_aligner.storage import ProjectStore
    print("  ✓ 存储模块导入成功")
    
    from eeg_aligner.export import (
        MarkdownExporter, CSVExporter, JSONExporter, ReportExporter
    )
    print("  ✓ 导出模块导入成功")
    
    from eeg_aligner.sample_data import SampleDataGenerator
    print("  ✓ 示例数据模块导入成功")
    
    print("\n  所有模块导入成功!")
    return True


def test_data_models():
    """测试数据模型"""
    print("\n" + "=" * 50)
    print("测试 2: 数据模型")
    print("=" * 50)
    
    from eeg_aligner.models import (
        SleepStage, EventType, IssueSeverity, IssueType,
        EEGChannelSummary, StimulusEvent, SleepStageEpoch,
        ClockCalibration, ProjectData
    )
    
    now = datetime.now()
    
    summary = EEGChannelSummary(
        channel_name="F3-M2",
        sampling_rate=256.0,
        start_time=now,
        end_time=now + timedelta(hours=8),
        total_samples=256 * 8 * 3600,
        valid_samples=int(256 * 8 * 3600 * 0.95),
        artifact_percentage=5.0,
    )
    print(f"  ✓ EEGChannelSummary: {summary.channel_name}, {summary.sampling_rate} Hz")
    
    event = StimulusEvent(
        event_id="evt_001",
        event_code=1,
        event_type=EventType.STIMULUS,
        timestamp=now,
        duration_ms=100.0,
    )
    print(f"  ✓ StimulusEvent: code={event.event_code}, type={event.event_type}")
    
    epoch = SleepStageEpoch(
        epoch_number=1,
        stage=SleepStage.N2,
        start_time=now,
        end_time=now + timedelta(seconds=30),
    )
    print(f"  ✓ SleepStageEpoch: epoch={epoch.epoch_number}, stage={epoch.stage}")
    
    calib = ClockCalibration(
        calibration_id="cal_001",
        calibration_time=now,
        eeg_clock_time=now,
        stimulus_clock_time=now + timedelta(milliseconds=250),
        drift_ms=250.0,
        sync_event_code=255,
    )
    print(f"  ✓ ClockCalibration: drift={calib.drift_ms} ms")
    
    project = ProjectData(
        project_id="test_001",
        created_at=now,
        updated_at=now,
    )
    project.eeg_summaries.append(summary)
    project.events.append(event)
    project.sleep_stages.append(epoch)
    project.clock_calibrations.append(calib)
    print(f"  ✓ ProjectData: {project.project_id}")
    
    print("\n  所有数据模型测试成功!")
    return True


def test_sample_data_generator():
    """测试示例数据生成器"""
    print("\n" + "=" * 50)
    print("测试 3: 示例数据生成器")
    print("=" * 50)
    
    from eeg_aligner.sample_data import SampleDataGenerator
    from eeg_aligner.models import EventType
    
    generator = SampleDataGenerator(seed=42)
    
    start_time = datetime.now().replace(hour=22, minute=0, second=0, microsecond=0)
    
    eeg_summaries = generator.generate_eeg_summaries(start_time, duration_minutes=30)
    events = generator.generate_events(start_time, duration_minutes=30, num_events=20)
    sleep_stages = generator.generate_sleep_stages(start_time, num_epochs=10)
    calibrations = generator.generate_clock_calibrations(start_time, num_calibrations=3)
    
    print(f"  EEG 通道数: {len(eeg_summaries)}")
    print(f"  事件数: {len(events)}")
    print(f"  睡眠分期数: {len(sleep_stages)}")
    print(f"  校准点数: {len(calibrations)}")
    
    stimulus_count = sum(1 for e in events if e.event_type == EventType.STIMULUS)
    sync_count = sum(1 for e in events if e.event_type == EventType.SYNC)
    artifact_count = sum(1 for e in events if e.is_artifact)
    
    print(f"  刺激事件: {stimulus_count}")
    print(f"  同步事件: {sync_count}")
    print(f"  伪迹事件: {artifact_count}")
    
    print("\n  检查时钟漂移...")
    drift_events = [e for e in events if e.eeg_timestamp and e.timestamp]
    if drift_events:
        first_drift = (drift_events[0].eeg_timestamp - drift_events[0].timestamp).total_seconds() * 1000
        last_drift = (drift_events[-1].eeg_timestamp - drift_events[-1].timestamp).total_seconds() * 1000
        print(f"  首个事件漂移: {first_drift:.2f} ms")
        print(f"  最后事件漂移: {last_drift:.2f} ms")
        print(f"  漂移变化: {last_drift - first_drift:.2f} ms")
    
    print("\n  示例数据生成器测试成功!")
    return True


def test_alignment():
    """测试对齐算法"""
    print("\n" + "=" * 50)
    print("测试 4: 对齐算法")
    print("=" * 50)
    
    from eeg_aligner.alignment import ClockDriftEstimator, EventAligner
    from eeg_aligner.models import (
        StimulusEvent, ClockCalibration, EEGChannelSummary, EventType
    )
    
    base_time = datetime(2024, 1, 1, 22, 0, 0)
    
    calibrations = [
        ClockCalibration(
            calibration_id="cal_1",
            calibration_time=base_time,
            eeg_clock_time=base_time,
            stimulus_clock_time=base_time,
            drift_ms=0.0,
            sync_event_code=255,
        ),
        ClockCalibration(
            calibration_id="cal_2",
            calibration_time=base_time + timedelta(hours=2),
            eeg_clock_time=base_time + timedelta(hours=2),
            stimulus_clock_time=base_time + timedelta(hours=2, milliseconds=200),
            drift_ms=200.0,
            sync_event_code=255,
        ),
        ClockCalibration(
            calibration_id="cal_3",
            calibration_time=base_time + timedelta(hours=4),
            eeg_clock_time=base_time + timedelta(hours=4),
            stimulus_clock_time=base_time + timedelta(hours=4, milliseconds=400),
            drift_ms=400.0,
            sync_event_code=255,
        ),
    ]
    
    events = [
        StimulusEvent(
            event_id=f"evt_{i}",
            event_code=i + 1,
            event_type=EventType.STIMULUS,
            timestamp=base_time + timedelta(hours=i, milliseconds=i * 50),
        )
        for i in range(3)
    ]
    
    estimator = ClockDriftEstimator()
    drift_estimate = estimator.estimate_drift(
        events=events,
        calibrations=calibrations,
        eeg_summaries=[],
    )
    
    print(f"  漂移估计: {drift_estimate.drift_ms:.2f} ms")
    print(f"  同步点数: {len(drift_estimate.sync_points)}")
    print(f"  置信度: {drift_estimate.drift_confidence:.0%}")
    print(f"  方法: {drift_estimate.method}")
    
    aligner = EventAligner()
    aligned_events, alignment_result = aligner.align_events(
        events=events,
        calibrations=calibrations,
        eeg_summaries=[],
    )
    
    print(f"\n  对齐结果:")
    print(f"    方法: {alignment_result.alignment_method}")
    print(f"    漂移: {alignment_result.drift_estimate_ms:.2f} ms")
    print(f"    已对齐事件: {alignment_result.aligned_events_count}")
    
    for i, event in enumerate(aligned_events):
        if event.aligned_timestamp:
            print(f"    事件 {event.event_code}: 对齐成功")
    
    print("\n  对齐算法测试成功!")
    return True


def test_rules_engine():
    """测试规则引擎"""
    print("\n" + "=" * 50)
    print("测试 5: 规则引擎")
    print("=" * 50)
    
    from eeg_aligner.rules import CheckEngine, CodeRuleEngine, StageRuleEngine, ArtifactRuleEngine
    from eeg_aligner.models import (
        StimulusEvent, SleepStageEpoch, EventType, SleepStage,
        IssueType, IssueSeverity
    )
    
    base_time = datetime(2024, 1, 1, 22, 0, 0)
    
    events = [
        StimulusEvent(
            event_id="evt_1",
            event_code=1,
            event_type=EventType.STIMULUS,
            timestamp=base_time,
            aligned_timestamp=base_time,
        ),
        StimulusEvent(
            event_id="evt_2",
            event_code=2,
            event_type=EventType.STIMULUS,
            timestamp=base_time + timedelta(seconds=5),
            aligned_timestamp=base_time + timedelta(seconds=5),
        ),
        StimulusEvent(
            event_id="evt_2b",
            event_code=2,
            event_type=EventType.STIMULUS,
            timestamp=base_time + timedelta(seconds=5, milliseconds=5),
            aligned_timestamp=base_time + timedelta(seconds=5, milliseconds=5),
        ),
        StimulusEvent(
            event_id="art_1",
            event_code=99,
            event_type=EventType.ARTIFACT,
            timestamp=base_time + timedelta(seconds=10),
            aligned_timestamp=base_time + timedelta(seconds=10),
            duration_ms=5000.0,
            is_artifact=True,
        ),
        StimulusEvent(
            event_id="evt_3",
            event_code=3,
            event_type=EventType.STIMULUS,
            timestamp=base_time + timedelta(seconds=11),
            aligned_timestamp=base_time + timedelta(seconds=11),
            duration_ms=100.0,
        ),
    ]
    
    stages = [
        SleepStageEpoch(
            epoch_number=1,
            stage=SleepStage.WAKE,
            start_time=base_time,
            end_time=base_time + timedelta(seconds=30),
        ),
    ]
    
    expected_codes = [1, 2, 3, 4, 5]
    
    print(f"  期望事件码: {expected_codes}")
    print(f"  实际事件码: {[e.event_code for e in events if not e.is_artifact]}")
    
    code_engine = CodeRuleEngine(expected_codes=expected_codes, min_interval_ms=100.0)
    code_issues, missing_codes, duplicate_codes = code_engine.check_codes(events, use_aligned_timestamps=True)
    
    print(f"\n  事件码问题数: {len(code_issues)}")
    print(f"  缺失事件码: {missing_codes}")
    print(f"  重复事件码: {duplicate_codes}")
    
    for issue in code_issues[:3]:
        severity_icon = "🔴" if issue.severity == IssueSeverity.CRITICAL else "🟡"
        print(f"    {severity_icon} {issue.issue_type.value}: {issue.message}")
    
    check_engine = CheckEngine(
        expected_codes=expected_codes,
        min_interval_ms=100.0,
        max_artifact_overlap_ratio=0.1,
    )
    check_result = check_engine.check_all(events, stages, use_aligned_timestamps=True)
    
    print(f"\n  综合检查结果:")
    print(f"    总事件数: {check_result.total_events}")
    print(f"    有效事件数: {check_result.valid_events}")
    print(f"    🔴 严重问题: {check_result.critical_issue_count}")
    print(f"    🟡 警告问题: {check_result.warning_issue_count}")
    print(f"    🔵 信息提示: {check_result.info_issue_count}")
    
    if check_result.missing_codes:
        print(f"    缺失事件码: {check_result.missing_codes}")
    if check_result.duplicate_codes:
        print(f"    重复事件码: {check_result.duplicate_codes}")
    
    print("\n  规则引擎测试成功!")
    return True


def test_storage():
    """测试存储模块"""
    print("\n" + "=" * 50)
    print("测试 6: 存储模块")
    print("=" * 50)
    
    from eeg_aligner.storage import ProjectStore
    from eeg_aligner.models import (
        ProjectData, EEGChannelSummary, StimulusEvent, SleepStageEpoch,
        ClockCalibration, AlignmentResult, CheckResult, EventType, SleepStage
    )
    
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        print(f"  临时目录: {temp_path}")
        
        store = ProjectStore(temp_path / ".eeg_aligner")
        
        now = datetime.now()
        
        original_project = ProjectData(
            project_id="test_storage_001",
            created_at=now,
            updated_at=now,
        )
        
        original_project.eeg_summaries = [
            EEGChannelSummary(
                channel_name="F3-M2",
                sampling_rate=256.0,
                start_time=now,
                end_time=now + timedelta(hours=8),
                total_samples=256 * 8 * 3600,
                valid_samples=int(256 * 8 * 3600 * 0.95),
                artifact_percentage=5.0,
                quality_metrics={"impedance": 5.2},
            )
        ]
        
        original_project.events = [
            StimulusEvent(
                event_id="evt_001",
                event_code=1,
                event_type=EventType.STIMULUS,
                timestamp=now + timedelta(minutes=5),
                eeg_timestamp=now + timedelta(minutes=5, milliseconds=100),
                aligned_timestamp=now + timedelta(minutes=5),
                duration_ms=100.0,
                description="测试事件",
                is_valid=True,
            )
        ]
        
        original_project.sleep_stages = [
            SleepStageEpoch(
                epoch_number=1,
                stage=SleepStage.WAKE,
                start_time=now,
                end_time=now + timedelta(seconds=30),
                duration_seconds=30.0,
                confidence=1.0,
                is_manual=True,
            )
        ]
        
        original_project.clock_calibrations = [
            ClockCalibration(
                calibration_id="cal_001",
                calibration_time=now,
                eeg_clock_time=now,
                stimulus_clock_time=now + timedelta(milliseconds=100),
                drift_ms=100.0,
                sync_event_code=255,
            )
        ]
        
        original_project.alignment_result = AlignmentResult(
            drift_estimate_ms=100.0,
            drift_confidence=0.95,
            alignment_method="linear",
            aligned_events_count=1,
        )
        
        original_project.check_result = CheckResult(
            total_events=1,
            valid_events=1,
            total_epochs=1,
            critical_issue_count=0,
            warning_issue_count=0,
            info_issue_count=0,
        )
        
        original_project.metadata = {
            "subject_id": "S001",
            "experiment_date": "2024-01-01",
        }
        
        print("  保存项目数据...")
        store.save(original_project)
        
        info = store.get_project_info()
        print(f"  项目存在: {info.get('exists')}")
        print(f"  项目ID: {info.get('project_id', 'N/A')}")
        
        print("  加载项目数据...")
        loaded_project = store.load()
        
        print(f"\n  验证数据一致性:")
        print(f"    项目ID: {loaded_project.project_id} (匹配: {loaded_project.project_id == original_project.project_id})")
        print(f"    EEG通道数: {len(loaded_project.eeg_summaries)} (匹配: {len(loaded_project.eeg_summaries) == len(original_project.eeg_summaries)})")
        print(f"    事件数: {len(loaded_project.events)} (匹配: {len(loaded_project.events) == len(original_project.events)})")
        print(f"    睡眠分期数: {len(loaded_project.sleep_stages)} (匹配: {len(loaded_project.sleep_stages) == len(original_project.sleep_stages)})")
        print(f"    校准点数: {len(loaded_project.clock_calibrations)} (匹配: {len(loaded_project.clock_calibrations) == len(original_project.clock_calibrations)})")
        
        if loaded_project.alignment_result:
            print(f"    对齐方法: {loaded_project.alignment_result.alignment_method}")
            print(f"    漂移估计: {loaded_project.alignment_result.drift_estimate_ms} ms")
        
        if loaded_project.check_result:
            print(f"    总事件数: {loaded_project.check_result.total_events}")
        
        print(f"    元数据: {loaded_project.metadata}")
        
        print("\n  存储模块测试成功!")
        return True


def test_export():
    """测试导出模块"""
    print("\n" + "=" * 50)
    print("测试 7: 导出模块")
    print("=" * 50)
    
    from eeg_aligner.export import MarkdownExporter, CSVExporter, JSONExporter, ReportExporter
    from eeg_aligner.models import (
        ProjectData, EEGChannelSummary, StimulusEvent, SleepStageEpoch,
        ClockCalibration, AlignmentResult, CheckResult, EventType, SleepStage,
        ValidationIssue, IssueType, IssueSeverity
    )
    
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        print(f"  临时目录: {temp_path}")
        
        now = datetime.now()
        
        project = ProjectData(
            project_id="test_export_001",
            created_at=now,
            updated_at=now,
        )
        
        project.eeg_summaries = [
            EEGChannelSummary(
                channel_name="F3-M2",
                sampling_rate=256.0,
                start_time=now,
                end_time=now + timedelta(hours=8),
                total_samples=256 * 8 * 3600,
                valid_samples=int(256 * 8 * 3600 * 0.95),
                artifact_percentage=5.0,
            )
        ]
        
        project.events = [
            StimulusEvent(
                event_id="evt_001",
                event_code=1,
                event_type=EventType.STIMULUS,
                timestamp=now + timedelta(minutes=5),
                aligned_timestamp=now + timedelta(minutes=5),
                duration_ms=100.0,
            ),
            StimulusEvent(
                event_id="evt_002",
                event_code=2,
                event_type=EventType.STIMULUS,
                timestamp=now + timedelta(minutes=10),
                aligned_timestamp=now + timedelta(minutes=10),
                duration_ms=100.0,
            ),
        ]
        
        project.sleep_stages = [
            SleepStageEpoch(
                epoch_number=i + 1,
                stage=SleepStage.N2,
                start_time=now + timedelta(seconds=i * 30),
                end_time=now + timedelta(seconds=(i + 1) * 30),
            )
            for i in range(5)
        ]
        
        project.alignment_result = AlignmentResult(
            drift_estimate_ms=150.5,
            drift_confidence=0.92,
            alignment_method="linear",
            aligned_events_count=2,
        )
        
        project.check_result = CheckResult(
            total_events=2,
            valid_events=2,
            total_epochs=5,
            critical_issue_count=0,
            warning_issue_count=1,
            info_issue_count=2,
            issues=[
                ValidationIssue(
                    issue_id="iss_001",
                    issue_type=IssueType.CLOCK_DRIFT,
                    severity=IssueSeverity.WARNING,
                    message="检测到时钟漂移 150.5 ms",
                ),
                ValidationIssue(
                    issue_id="iss_002",
                    issue_type=IssueType.INVALID_TIMESTAMP,
                    severity=IssueSeverity.INFO,
                    message="时间戳顺序正常",
                ),
            ],
        )
        
        print("\n  测试 Markdown 导出...")
        md_exporter = MarkdownExporter()
        md_path = temp_path / "report.md"
        md_exporter.export(project, md_path)
        print(f"    ✓ Markdown 报告已保存: {md_path}")
        print(f"    文件大小: {md_path.stat().st_size} 字节")
        
        print("\n  测试 CSV 导出...")
        csv_exporter = CSVExporter()
        
        summary_path = temp_path / "summary.csv"
        csv_exporter.export_summary(project, summary_path)
        print(f"    ✓ 摘要 CSV 已保存: {summary_path}")
        
        events_path = temp_path / "events.csv"
        csv_exporter.export_events(project.events, events_path)
        print(f"    ✓ 事件 CSV 已保存: {events_path}")
        
        stages_path = temp_path / "sleep_stages.csv"
        csv_exporter.export_stages(project.sleep_stages, stages_path)
        print(f"    ✓ 分期 CSV 已保存: {stages_path}")
        
        if project.check_result:
            issues_path = temp_path / "issues.csv"
            csv_exporter.export_issues(project.check_result, issues_path)
            print(f"    ✓ 问题 CSV 已保存: {issues_path}")
        
        print("\n  测试 JSON 导出...")
        json_exporter = JSONExporter()
        json_path = temp_path / "project.json"
        json_exporter.export_project(project, json_path)
        print(f"    ✓ JSON 导出已保存: {json_path}")
        print(f"    文件大小: {json_path.stat().st_size} 字节")
        
        print("\n  导出模块测试成功!")
        return True


def main():
    """运行所有测试"""
    print("\n" + "=" * 60)
    print("  脑电事件码对齐员 - 项目验证测试")
    print("=" * 60)
    
    tests = [
        ("模块导入", test_module_imports),
        ("数据模型", test_data_models),
        ("示例数据生成器", test_sample_data_generator),
        ("对齐算法", test_alignment),
        ("规则引擎", test_rules_engine),
        ("存储模块", test_storage),
        ("导出模块", test_export),
    ]
    
    results = []
    
    for name, test_func in tests:
        try:
            success = test_func()
            results.append((name, success, None))
        except Exception as e:
            import traceback
            results.append((name, False, str(e) + "\n" + traceback.format_exc()))
    
    print("\n" + "=" * 60)
    print("  测试结果汇总")
    print("=" * 60)
    
    all_passed = True
    for name, success, error in results:
        status = "✓ 通过" if success else "✗ 失败"
        print(f"  {name}: {status}")
        if error:
            print(f"    错误: {error}")
        if not success:
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("  所有测试通过! 项目可以正常运行。")
    else:
        print("  部分测试失败，请检查错误信息。")
    print("=" * 60)
    
    return all_passed


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
