import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import EvaluationSlice, FeatureSnapshot, ThresholdRecord
from app.schemas import EvaluationSliceCreate, FeatureSnapshotCreate, ThresholdUpdate, ExportRequest
from app.services import CheckService, WorkflowService, ExportService

TEST_DATABASE_URL = "sqlite:///./test_feature_leak_check.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)


def test_step1_import_evaluation_slice():
    db = TestingSessionLocal()
    workflow = WorkflowService(db)

    slice_data = EvaluationSliceCreate(
        original_row_number=1,
        main_process_data={
            "metric_name": "转化率",
            "metric_value": 0.125,
            "report_threshold": 0.1,
            "slice_id": "SLICE_001",
        },
        import_batch_id="BATCH_001",
    )

    eval_slice, check_results = workflow.step1_import_evaluation_slice(slice_data, "数据工程师")

    assert eval_slice.id is not None
    assert eval_slice.original_row_number == 1
    assert eval_slice.import_batch_id == "BATCH_001"
    assert eval_slice.current_status == "reviewing"

    workflow_steps = workflow.get_workflow_status(eval_slice.id)
    assert len(workflow_steps) == 3
    assert workflow_steps[0].step_number == 1
    assert workflow_steps[0].step_status == "completed"
    assert workflow_steps[1].step_status == "pending"
    assert workflow_steps[2].step_status == "pending"

    print("✅ 测试1通过：步骤1-导入评测切片，工作流初始化成功")
    db.close()
    return eval_slice


def test_duplicate_import_check():
    db = TestingSessionLocal()
    workflow = WorkflowService(db)

    slice_data = EvaluationSliceCreate(
        original_row_number=1,
        main_process_data={
            "metric_name": "转化率",
            "metric_value": 0.125,
            "report_threshold": 0.1,
            "slice_id": "SLICE_001",
        },
        import_batch_id="BATCH_001",
    )

    eval_slice, check_results = workflow.step1_import_evaluation_slice(slice_data, "数据工程师")

    duplicate_checks = [c for c in check_results if c.check_type == "duplicate_import"]
    assert len(duplicate_checks) == 1
    assert duplicate_checks[0].check_status == "abnormal"
    assert duplicate_checks[0].severity == "medium"
    assert "检测到重复导入" in duplicate_checks[0].result_detail["message"]

    evidence = duplicate_checks[0].evidence_chain
    assert evidence["original_row_number"] == 1
    assert "main_process_summary" in evidence

    print("✅ 测试2通过：重复导入检查正常工作，证据链包含原始行号")
    db.close()


def test_step2_supplement_feature_snapshot():
    db = TestingSessionLocal()
    workflow = WorkflowService(db)

    slice_data = EvaluationSliceCreate(
        original_row_number=2,
        main_process_data={
            "metric_name": "点击率",
            "metric_value": 0.05,
            "report_threshold": 0.03,
            "slice_id": "SLICE_002",
        },
        import_batch_id="BATCH_002",
    )
    eval_slice, _ = workflow.step1_import_evaluation_slice(slice_data, "数据工程师")

    snapshot_data = FeatureSnapshotCreate(
        evaluation_slice_id=eval_slice.id,
        snapshot_number="SNAP_002",
        on_site_statement="现场确认数据口径无误，用户行为正常",
        feature_data={"metric_value": 0.05, "threshold": 0.03},
        supplemented_by="老唐",
    )

    feature_snapshot, check_results = workflow.step2_supplement_feature_snapshot(
        snapshot_data, "老唐", is_resupplement=False
    )

    assert feature_snapshot.id is not None
    assert feature_snapshot.snapshot_number == "SNAP_002"
    assert feature_snapshot.supplemented_by == "老唐"
    assert feature_snapshot.is_resupplemented == False

    workflow_steps = workflow.get_workflow_status(eval_slice.id)
    assert workflow_steps[1].step_status == "completed"
    assert workflow_steps[2].step_status == "pending"

    print("✅ 测试3通过：步骤2-补看特征快照（老唐）成功，数据关联正确")
    db.close()
    return eval_slice, feature_snapshot


def test_step3_threshold_update_and_mismatch_check():
    db = TestingSessionLocal()
    workflow = WorkflowService(db)
    check_service = CheckService(db)

    slice_data = EvaluationSliceCreate(
        original_row_number=3,
        main_process_data={
            "metric_name": "转化率",
            "metric_value": 0.125,
            "report_threshold": 0.1,
            "slice_id": "SLICE_003",
        },
        import_batch_id="BATCH_003",
    )
    eval_slice, _ = workflow.step1_import_evaluation_slice(slice_data, "数据工程师")

    threshold_updates = [
        ThresholdUpdate(
            threshold_name="转化率",
            new_value=0.15,
            changed_by="推荐策略",
            apply_to_report=False,
        )
    ]

    threshold_records, check_results = workflow.step3_update_hierarchical_metrics(
        eval_slice.id, threshold_updates, "推荐策略"
    )

    assert len(threshold_records) == 1
    assert threshold_records[0].threshold_name == "转化率"
    assert threshold_records[0].old_value is None
    assert threshold_records[0].new_value == 0.15
    assert threshold_records[0].is_applied_in_report == False

    threshold_mismatch = [c for c in check_results if c.check_type == "threshold_mismatch"]
    assert len(threshold_mismatch) == 1
    assert threshold_mismatch[0].check_status == "pending_review"
    assert threshold_mismatch[0].needs_data_scientist_review == True
    assert threshold_mismatch[0].severity == "high"
    assert threshold_mismatch[0].threshold_old_value == 0.1
    assert threshold_mismatch[0].threshold_new_value == 0.15
    assert threshold_mismatch[0].report_threshold_value == 0.1

    workflow_steps = workflow.get_workflow_status(eval_slice.id)
    assert workflow_steps[2].step_status == "completed"
    assert eval_slice.current_status == "pending"

    all_results = check_service.get_check_results()
    api_results = [CheckService(db).get_check_results() for _ in range(3)]
    export_data = ExportService(db).get_export_data_for_api()
    export_ids = [d["检查结果ID"] for d in export_data]
    result_ids = [r.id for r in all_results]
    assert set(export_ids) == set(result_ids)

    print("✅ 测试4通过：步骤3-分层指标更新成功，阈值不匹配标记为待数据科学家复核，不自动归为正常")
    print("✅ 测试5通过：接口、页面、导出读取同一份CheckResult数据，数据一致")
    db.close()


def test_cross_leak_check():
    db = TestingSessionLocal()
    workflow = WorkflowService(db)

    slice_data = EvaluationSliceCreate(
        original_row_number=4,
        main_process_data={
            "metric_name": "转化率",
            "metric_value": 0.125,
            "report_threshold": 0.1,
            "slice_id": "SLICE_004",
        },
        import_batch_id="BATCH_004",
    )
    eval_slice, _ = workflow.step1_import_evaluation_slice(slice_data, "数据工程师")

    snapshot_data = FeatureSnapshotCreate(
        evaluation_slice_id=eval_slice.id,
        snapshot_number="SNAP_004",
        on_site_statement="数据有偏差，需要复核",
        feature_data={"metric_value": 0.135, "threshold": 0.12},
        supplemented_by="老唐",
    )

    feature_snapshot, check_results = workflow.step2_supplement_feature_snapshot(
        snapshot_data, "老唐"
    )

    cross_leak = [c for c in check_results if c.check_type == "cross_leak"]
    assert len(cross_leak) == 1
    assert cross_leak[0].check_status == "pending_review"
    assert cross_leak[0].needs_data_scientist_review == True
    assert len(cross_leak[0].result_detail["cross_leak_indicators"]) >= 2

    evidence = cross_leak[0].evidence_chain
    assert evidence["original_row_number"] == 4
    assert evidence["feature_snapshot"]["snapshot_number"] == "SNAP_004"
    assert evidence["feature_snapshot"]["on_site_statement"] == "数据有偏差，需要复核"

    print("✅ 测试6通过：特征交叉泄漏检查整合了评测切片（主流程）和特征快照（现场说法）两边证据")
    db.close()


def test_resupplement_recalc():
    db = TestingSessionLocal()
    workflow = WorkflowService(db)

    slice_data = EvaluationSliceCreate(
        original_row_number=5,
        main_process_data={
            "metric_name": "转化率",
            "metric_value": 0.125,
            "report_threshold": 0.1,
        },
        import_batch_id="BATCH_005",
    )
    eval_slice, _ = workflow.step1_import_evaluation_slice(slice_data, "数据工程师")

    snapshot1 = FeatureSnapshotCreate(
        evaluation_slice_id=eval_slice.id,
        snapshot_number="SNAP_005_V1",
        on_site_statement="第一版数据",
        feature_data={"metric_value": 0.125},
        supplemented_by="老唐",
    )
    workflow.step2_supplement_feature_snapshot(snapshot1, "老唐")

    snapshot2 = FeatureSnapshotCreate(
        evaluation_slice_id=eval_slice.id,
        snapshot_number="SNAP_005_V2",
        on_site_statement="补录更正后的数据",
        feature_data={"metric_value": 0.128},
        supplemented_by="老唐",
    )
    _, check_results = workflow.step2_supplement_feature_snapshot(snapshot2, "老唐", is_resupplement=True)

    resupplement = [c for c in check_results if c.check_type == "resupplement"]
    assert len(resupplement) == 1
    assert resupplement[0].check_status == "normal"
    assert resupplement[0].result_detail["supplement_count"] >= 2
    assert resupplement[0].result_detail["supplemented_by"] == "老唐"

    print("✅ 测试7通过：补录后重算检查正常工作")
    db.close()


def test_review_workflow():
    db = TestingSessionLocal()
    workflow = WorkflowService(db)
    check_service = CheckService(db)

    slice_data = EvaluationSliceCreate(
        original_row_number=6,
        main_process_data={
            "metric_name": "转化率",
            "metric_value": 0.125,
            "report_threshold": 0.1,
        },
        import_batch_id="BATCH_006",
    )
    eval_slice, _ = workflow.step1_import_evaluation_slice(slice_data, "数据工程师")

    threshold_updates = [
        ThresholdUpdate(
            threshold_name="转化率",
            new_value=0.15,
            changed_by="推荐策略",
            apply_to_report=False,
        )
    ]
    _, check_results = workflow.step3_update_hierarchical_metrics(
        eval_slice.id, threshold_updates, "推荐策略"
    )

    pending = [c for c in check_results if c.needs_data_scientist_review]
    assert len(pending) > 0

    reviewed = check_service.review_check_result(
        pending[0].id,
        reviewer="数据科学家",
        review_comment="确认阈值确实需要更新，报告口径需要同步修改",
        new_status="abnormal",
    )

    assert reviewed.needs_data_scientist_review == False
    assert reviewed.reviewer == "数据科学家"
    assert reviewed.check_status == "abnormal"
    assert reviewed.review_comment is not None

    print("✅ 测试8通过：数据科学家复核流程正常工作")
    db.close()


def test_export_consistency():
    db = TestingSessionLocal()
    workflow = WorkflowService(db)
    export_service = ExportService(db)
    check_service = CheckService(db)

    slice_data = EvaluationSliceCreate(
        original_row_number=7,
        main_process_data={
            "metric_name": "转化率",
            "metric_value": 0.125,
            "report_threshold": 0.1,
        },
        import_batch_id="BATCH_007",
    )
    eval_slice, _ = workflow.step1_import_evaluation_slice(slice_data, "数据工程师")

    export_request = ExportRequest(
        export_type="detail",
        exported_by="测试用户",
    )
    export_result = export_service.export_to_excel(export_request)

    assert export_result["record_count"] > 0
    assert export_result["export_hash"] is not None
    assert os.path.exists(export_result["file_path"])

    api_data = export_service.get_export_data_for_api()
    assert len(api_data) == export_result["record_count"]

    all_results = check_service.get_check_results()
    page_data = [r.id for r in all_results]
    export_ids = [d["检查结果ID"] for d in api_data]
    assert set(page_data) == set(export_ids)

    print("✅ 测试9通过：导出功能正常，导出数据与API、页面数据一致")
    db.close()


if __name__ == "__main__":
    print("=" * 60)
    print("开始运行特征交叉泄漏检查系统核心测试")
    print("=" * 60)

    try:
        test_step1_import_evaluation_slice()
        test_duplicate_import_check()
        test_step2_supplement_feature_snapshot()
        test_step3_threshold_update_and_mismatch_check()
        test_cross_leak_check()
        test_resupplement_recalc()
        test_review_workflow()
        test_export_consistency()

        print("=" * 60)
        print("🎉 所有测试通过！核心功能验证完成")
        print("=" * 60)
    except AssertionError as e:
        print(f"❌ 测试失败: {e}")
        raise
    except Exception as e:
        print(f"❌ 测试出错: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        if os.path.exists("./test_feature_leak_check.db"):
            os.remove("./test_feature_leak_check.db")
