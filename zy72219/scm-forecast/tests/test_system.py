#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
系统测试 - 验证供应链账期滚动预测系统的核心功能
"""
import sys
import json
from pathlib import Path
import tempfile

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.io.handlers import ForecastImporter, ForecastExporter, DuplicateDetector
from src.workflow.orchestrator import WorkflowOrchestrator
from src.models import MaterialType, SettlementCycle, ModificationStatus
from src.checks.self_check import SelfCheckEngine


def test_import_and_duplicate_detection():
    """测试导入和重复检测"""
    print("测试1: 导入和重复检测...", end=" ")
    duplicate_detector = DuplicateDetector()
    importer = ForecastImporter(duplicate_detector)

    normal = importer.import_sample(
        "batch_20260530_normal.json",
        MaterialType.NORMAL
    )
    assert normal.batch.batch_id == "BATCH-2026-0530-001"
    assert normal.batch.record_count == 5
    assert len(normal.records) == 5
    assert normal.batch.is_duplicate == False

    wrong = importer.import_sample(
        "batch_20260530_wrong_dimension.json",
        MaterialType.WRONG_DIMENSION
    )
    assert wrong.batch.is_duplicate == True
    assert wrong.batch.duplicate_of_batch == "BATCH-2026-0530-001"

    supplementary = importer.import_sample(
        "batch_20260530_supplementary.json",
        MaterialType.SUPPLEMENTARY
    )
    assert supplementary.batch.is_duplicate == False

    print("✓ 通过")


def test_t1_to_t2_modification_detection():
    """测试T+1到T+2修改检测"""
    print("测试2: T+1→T+2修改检测...", end=" ")
    duplicate_detector = DuplicateDetector()
    importer = ForecastImporter(duplicate_detector)

    wrong = importer.import_sample(
        "batch_20260530_wrong_dimension.json",
        MaterialType.WRONG_DIMENSION
    )

    modified_records = [
        r for r in wrong.records
        if r.original_settlement_cycle == SettlementCycle.T1
        and r.current_settlement_cycle == SettlementCycle.T2
        and r.is_manually_modified
    ]
    assert len(modified_records) == 2

    record_ids = [r.record_id for r in modified_records]
    assert "REC-003" in record_ids
    assert "REC-005" in record_ids

    rec003 = wrong.get_record_by_id("REC-003")
    assert rec003.modification_reason == "儿童节放假，银行不处理对公业务"
    assert rec003.modified_by == "王业务"
    assert rec003.holiday_deferral_applies == True
    assert "儿童节" in rec003.holiday_deferral_explanation

    print("✓ 通过")


def test_workflow_step1_import():
    """测试工作流第一步: 清算批次号导入"""
    print("测试3: 工作流第一步...", end=" ")
    duplicate_detector = DuplicateDetector()
    importer = ForecastImporter(duplicate_detector)
    orchestrator = WorkflowOrchestrator()

    wrong = importer.import_sample(
        "batch_20260530_wrong_dimension.json",
        MaterialType.WRONG_DIMENSION
    )

    orchestrator.initialize_workflow(wrong)
    result = orchestrator.step_1_import_settlement_batch(wrong, "老秦")

    assert result["modified_records"] == 2
    assert result["needs_manager_review"] == True
    assert len(result["conflicts"]) == 2
    assert "REC-003" in result["t1_to_t2_record_ids"]
    assert "REC-005" in result["t1_to_t2_record_ids"]

    pending_conflicts = [c for c in wrong.conflicts if c.resolution_status == "pending"]
    assert len(pending_conflicts) == 2

    print("✓ 通过")


def test_conflict_resolution():
    """测试冲突解决"""
    print("测试4: 冲突解决...", end=" ")
    duplicate_detector = DuplicateDetector()
    importer = ForecastImporter(duplicate_detector)
    orchestrator = WorkflowOrchestrator()

    wrong = importer.import_sample(
        "batch_20260530_wrong_dimension.json",
        MaterialType.WRONG_DIMENSION
    )

    orchestrator.initialize_workflow(wrong)
    orchestrator.step_1_import_settlement_batch(wrong, "老秦")

    conflict_rec003 = [c for c in wrong.conflicts if c.record_id == "REC-003"][0]
    conflict_rec005 = [c for c in wrong.conflicts if c.record_id == "REC-005"][0]

    result1 = orchestrator.resolve_conflict_interactive(
        wrong, conflict_rec003.conflict_id, "reject", "老秦", "儿童节不是法定假日"
    )
    assert result1["success"] == True
    assert conflict_rec003.resolution_status == "rejected"

    rec003 = wrong.get_record_by_id("REC-003")
    assert rec003.current_settlement_cycle == SettlementCycle.T1
    assert rec003.modification_status == ModificationStatus.NORMAL
    assert rec003.is_manually_modified == False

    result2 = orchestrator.resolve_conflict_interactive(
        wrong, conflict_rec005.conflict_id, "confirm", "老秦", "端午节确实放假"
    )
    assert result2["success"] == True
    assert conflict_rec005.resolution_status == "confirmed"

    rec005 = wrong.get_record_by_id("REC-005")
    assert rec005.current_settlement_cycle == SettlementCycle.T2
    assert rec005.modification_status == ModificationStatus.CONFIRMED

    print("✓ 通过")


def test_holiday_deferral_validation():
    """测试节假日顺延验证"""
    print("测试5: 节假日顺延验证...", end=" ")
    from src.core.holiday_validator import HolidayDeferralValidator
    from datetime import date

    validator = HolidayDeferralValidator()

    is_holiday, name = validator._is_holiday(date(2026, 6, 1))
    assert is_holiday == True
    assert name == "端午节"

    is_holiday, name = validator._is_holiday(date(2026, 6, 2))
    assert is_holiday == True
    assert name == "端午节调休"

    is_holiday, name = validator._is_holiday(date(2026, 5, 29))
    assert is_holiday == False

    expected_date, holidays = validator.calculate_expected_arrival(
        date(2026, 5, 30), "T+1"
    )
    assert expected_date == date(2026, 6, 3)
    assert len(holidays) == 3

    is_valid = validator.validate_deferral_explanation(
        date(2026, 5, 31),
        date(2026, 6, 3),
        "因2026-06-01(端午节)、2026-06-02(端午节调休)节假日顺延"
    )
    assert is_valid == True

    is_valid = validator.validate_deferral_explanation(
        date(2026, 5, 31),
        date(2026, 6, 3),
        "因2026-06-01(儿童节)节假日顺延"
    )
    assert is_valid == False

    print("✓ 通过")


def test_self_check_engine():
    """测试自检引擎"""
    print("测试6: 自检引擎...", end=" ")
    duplicate_detector = DuplicateDetector()
    importer = ForecastImporter(duplicate_detector)
    check_engine = SelfCheckEngine()

    normal = importer.import_sample(
        "batch_20260530_normal.json",
        MaterialType.NORMAL
    )
    wrong = importer.import_sample(
        "batch_20260530_wrong_dimension.json",
        MaterialType.WRONG_DIMENSION
    )
    supplementary = importer.import_sample(
        "batch_20260530_supplementary.json",
        MaterialType.SUPPLEMENTARY
    )

    report = check_engine.run_all_checks(wrong, supplementary)

    assert len(report.results) == 4

    duplicate_check = report.get_result("duplicate_import")
    assert duplicate_check.passed == False

    t1t2_check = report.get_result("t1_to_t2_modification")
    assert t1t2_check.passed == False
    assert t1t2_check.severity == "critical"

    supplement_check = report.get_result("supplement_recalculation")
    assert supplement_check.passed == True

    export_check = report.get_result("export_consistency")
    assert export_check.passed == True

    print("✓ 通过")


def test_export_consistency():
    """测试导出一致性"""
    print("测试7: 导出一致性...", end=" ")
    duplicate_detector = DuplicateDetector()
    importer = ForecastImporter(duplicate_detector)
    exporter = ForecastExporter()

    normal = importer.import_sample(
        "batch_20260530_normal.json",
        MaterialType.NORMAL
    )

    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        temp_path = f.name

    try:
        export_path = exporter.export_to_json(normal, temp_path)

        with open(export_path, 'r', encoding='utf-8') as f:
            exported = json.load(f)

        assert exported["batch"]["batch_id"] == normal.batch.batch_id
        assert exported["batch"]["total_amount"] == normal.batch.total_amount
        assert len(exported["records"]) == len(normal.records)

        for mem_rec, exp_rec in zip(normal.records, exported["records"]):
            assert mem_rec.record_id == exp_rec["record_id"]
            assert mem_rec.current_settlement_cycle.value == exp_rec["current_settlement_cycle"]
            assert mem_rec.expected_arrival_date.isoformat() == exp_rec["expected_arrival_date"]

        report_path = exporter.export_report_to_txt(normal)
        assert Path(report_path).exists()

    finally:
        Path(temp_path).unlink(missing_ok=True)

    print("✓ 通过")


def test_reconciliation_manager():
    """测试对账管理"""
    print("测试8: 对账管理...", end=" ")
    from src.core.reconciliation_manager import ReconciliationManager

    duplicate_detector = DuplicateDetector()
    importer = ForecastImporter(duplicate_detector)
    recon_manager = ReconciliationManager()

    wrong = importer.import_sample(
        "batch_20260530_wrong_dimension.json",
        MaterialType.WRONG_DIMENSION
    )

    rec003 = wrong.get_record_by_id("REC-003")
    is_consistent, issues = recon_manager.verify_historical_consistency(wrong, rec003)
    assert is_consistent == False
    assert len(issues) > 0

    result = recon_manager.update_reconciliation_for_batch(wrong, "老秦")
    assert result["total_records"] == 5
    assert result["records_with_notes"] >= 3
    assert result["notes_added"] > 0

    note = recon_manager.add_reconciliation_note(
        wrong, "REC-003",
        "腾讯云服务款，T+1正常结算，驳回T+2修改",
        "manual", "老秦", True
    )
    assert note.note_id is not None
    assert note.is_reconciled == True

    notes = wrong.get_notes_for_record("REC-003")
    assert len(notes) >= 1

    print("✓ 通过")


def test_full_workflow():
    """测试完整工作流"""
    print("测试9: 完整工作流...", end=" ")
    duplicate_detector = DuplicateDetector()
    importer = ForecastImporter(duplicate_detector)
    orchestrator = WorkflowOrchestrator()

    normal = importer.import_sample(
        "batch_20260530_normal.json",
        MaterialType.NORMAL
    )
    supplementary = importer.import_sample(
        "batch_20260530_supplementary.json",
        MaterialType.SUPPLEMENTARY
    )

    result = orchestrator.run_full_workflow(normal, supplementary, "老秦")
    assert "step_1" in result
    assert "step_2" in result
    assert "step_3" in result
    assert "self_check_report" in result
    assert "exported_json" in result
    assert "exported_report" in result

    assert result["step_1"]["status"] == "completed"
    assert result["step_2"]["status"] == "completed"
    assert result["step_3"]["status"] == "completed"
    assert result["final_report_ready"] == True

    summary = orchestrator.get_workflow_summary(normal)
    assert summary["is_complete"] == True
    assert summary["final_report_ready"] == True
    assert len(summary["pending_conflicts"]) == 0

    print("✓ 通过")


def run_all_tests():
    """运行所有测试"""
    print("=" * 60)
    print("  供应链账期滚动预测系统 - 系统测试")
    print("=" * 60 + "\n")

    tests = [
        test_import_and_duplicate_detection,
        test_t1_to_t2_modification_detection,
        test_workflow_step1_import,
        test_conflict_resolution,
        test_holiday_deferral_validation,
        test_self_check_engine,
        test_export_consistency,
        test_reconciliation_manager,
        test_full_workflow,
    ]

    passed = 0
    failed = 0
    failed_tests = []

    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            failed += 1
            failed_tests.append((test.__name__, str(e)))
            print(f"✗ 失败: {e}")

    print("\n" + "=" * 60)
    print(f"  测试结果: {passed} 通过, {failed} 失败")
    print("=" * 60)

    if failed_tests:
        print("\n失败的测试:")
        for name, error in failed_tests:
            print(f"  - {name}: {error}")
        return False

    print("\n🎉 所有测试通过！")
    return True


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
