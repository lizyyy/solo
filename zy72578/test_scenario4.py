import sys
from models import (
    MaterialType, ThresholdNote, OnlineExperimentBucket,
    WorkflowStep, ReviewStatus
)
from material_importer import MaterialImporter
from ensemble_vote_explainer import EnsembleVoteExplainer


def run_tests():
    passed_count = 0
    failed_count = 0
    results = []

    def assert_test(name, condition, detail=""):
        nonlocal passed_count, failed_count
        if condition:
            passed_count += 1
            results.append((name, True, detail))
            print(f"✅ PASS: {name}")
        else:
            failed_count += 1
            results.append((name, False, detail))
            print(f"❌ FAIL: {name}")
            if detail:
                print(f"   详情: {detail}")

    importer = MaterialImporter()
    explainer = EnsembleVoteExplainer()

    print("=" * 70)
    print("  Scenario 4 端到端测试")
    print("=" * 70)

    # Step 1: First import
    print("\n--- Step 1: 首次导入 ---")
    threshold_note = ThresholdNote(
        note_id="NOTE-004",
        model_name="retention_model_v1",
        threshold=0.60,
        imported_by="algorithm_li"
    )

    material1 = importer.import_material(
        material_id="MAT-004",
        material_type=MaterialType.NORMAL,
        model_name="retention_model_v1",
        threshold_notes=[threshold_note],
        experiment_buckets=[]
    )

    result = explainer.process_material(material1)

    assert_test(
        "1. 首次导入后 threshold == 0.60",
        abs(result.final_threshold - 0.60) < 1e-6,
        f"实际值: {result.final_threshold}"
    )
    assert_test(
        "1. 首次导入后 workflow_step == STEP1_THRESHOLD_IMPORT",
        result.workflow_step == WorkflowStep.STEP1_THRESHOLD_IMPORT,
        f"实际值: {result.workflow_step.value}"
    )

    # Step 1 supplement: Supplement import
    print("\n--- Step 1 补录: 补录材料 ---")
    experiment_bucket = OnlineExperimentBucket(
        bucket_id="BUCKET-D",
        model_name="retention_model_v1",
        threshold=0.58,
        sample_count=2000,
        minority_sample_count=300,
        overall_metric=0.80,
        minority_metric=0.75
    )

    material2 = importer.import_material(
        material_id="MAT-004",
        material_type=MaterialType.SUPPLEMENT,
        model_name="retention_model_v1",
        threshold_notes=[],
        experiment_buckets=[experiment_bucket]
    )

    result = explainer.process_material(material2)

    expected_threshold = (0.60 + 0.58) / 2
    assert_test(
        "2. 补录后 threshold == 0.59",
        abs(result.final_threshold - expected_threshold) < 1e-6,
        f"实际值: {result.final_threshold}, 期望值: {expected_threshold}"
    )
    assert_test(
        "2. 补录后 current_batch == 2",
        result.current_batch == 2,
        f"实际值: {result.current_batch}"
    )
    assert_test(
        "2. 补录后 material_batches 长度 == 2",
        len(result.material_batches) == 2,
        f"实际长度: {len(result.material_batches)}"
    )
    assert_test(
        "3. 补录后 review_status == PENDING（冲突检测）",
        result.review_status == ReviewStatus.PENDING,
        f"实际值: {result.review_status.value}"
    )

    export_check = None
    for check in result.self_check_results:
        if check.check_name == "导出一致性检查":
            export_check = check
            break

    assert_test(
        "4. 补录后导出一致性检查 passed=False",
        export_check is not None and export_check.passed is False,
        f"实际值: passed={export_check.passed if export_check else 'N/A'}, message={export_check.message if export_check else 'N/A'}"
    )

    minority_check = None
    for check in result.self_check_results:
        if check.check_name == "少数类样本被总指标盖住检查":
            minority_check = check
            break

    assert_test(
        "10. 少数类样本被总指标盖住检查通过",
        minority_check is not None and minority_check.passed is True,
        f"实际值: passed={minority_check.passed if minority_check else 'N/A'}"
    )

    supplement_check = None
    for check in result.self_check_results:
        if check.check_name == "补录后重算检查":
            supplement_check = check
            break

    assert_test(
        "11. 补录后重算检查通过",
        supplement_check is not None and supplement_check.passed is True,
        f"实际值: passed={supplement_check.passed if supplement_check else 'N/A'}, message={supplement_check.message if supplement_check else 'N/A'}"
    )

    # Step 2: 老唐审核
    print("\n--- Step 2: 老唐审核 ---")
    result = explainer.tang_review_buckets(
        "retention_model_v1",
        reject_conflicts=["NOTE-004"]
    )

    assert_test(
        "5. 老唐审核后 workflow_step == STEP2_TANG_REVIEW",
        result.workflow_step == WorkflowStep.STEP2_TANG_REVIEW,
        f"实际值: {result.workflow_step.value}"
    )
    assert_test(
        "5. 老唐审核后 review_status == CONFIRMED",
        result.review_status == ReviewStatus.CONFIRMED,
        f"实际值: {result.review_status.value}"
    )

    # Step 3: 阈值回放更新
    print("\n--- Step 3: 阈值回放更新 ---")
    result = explainer.update_threshold_playback(
        model_name="retention_model_v1",
        new_threshold=0.595,
        reason="线上效果校准，提升留存目标"
    )

    assert_test(
        "6. 回放更新后 export_trace_id 非空",
        result.export_trace_id is not None and len(result.export_trace_id) > 0,
        f"实际值: '{result.export_trace_id}'"
    )
    assert_test(
        "6. 回放更新后 workflow_step == COMPLETED",
        result.workflow_step == WorkflowStep.COMPLETED,
        f"实际值: {result.workflow_step.value}"
    )

    export_check_after = None
    for check in result.self_check_results:
        if check.check_name == "导出一致性检查":
            export_check_after = check
            break

    assert_test(
        "9. 回放后导出一致性检查 passed=True",
        export_check_after is not None and export_check_after.passed is True,
        f"实际值: passed={export_check_after.passed if export_check_after else 'N/A'}, message={export_check_after.message if export_check_after else 'N/A'}"
    )

    # Export report
    print("\n--- 导出报告 ---")
    report = explainer.export_report("retention_model_v1")

    trace_id = report.get("导出追踪ID", "")
    assert_test(
        "7. 报告中导出追踪ID非空且长度 >= 8",
        isinstance(trace_id, str) and len(trace_id) >= 8,
        f"实际值: '{trace_id}', 长度: {len(trace_id) if isinstance(trace_id, str) else 'N/A'}"
    )

    anti_lookup = report.get("反查键", {})
    change_ids = anti_lookup.get("变更ID列表", [])
    batches = anti_lookup.get("批次号列表", [])
    material_ids = anti_lookup.get("材料ID列表", [])

    assert_test(
        "8. 报告反查键 - change_ids 列表长度 >= 3",
        isinstance(change_ids, list) and len(change_ids) >= 3,
        f"实际长度: {len(change_ids) if isinstance(change_ids, list) else 'N/A'}"
    )
    assert_test(
        "8. 报告反查键 - batches 列表长度 == 2",
        isinstance(batches, list) and len(batches) == 2,
        f"实际长度: {len(batches) if isinstance(batches, list) else 'N/A'}"
    )
    assert_test(
        "8. 报告反查键 - material_ids 是列表",
        isinstance(material_ids, list),
        f"实际类型: {type(material_ids).__name__}"
    )

    print("\n" + "=" * 70)
    print(f"  测试结果: {passed_count} 通过, {failed_count} 失败")
    print("=" * 70)

    if failed_count > 0:
        print("\n失败的测试:")
        for name, passed, detail in results:
            if not passed:
                print(f"  ❌ {name}")
                if detail:
                    print(f"     {detail}")

    return failed_count == 0


if __name__ == "__main__":
    all_passed = run_tests()
    sys.exit(0 if all_passed else 1)
