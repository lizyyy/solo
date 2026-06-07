from datetime import datetime
from models import (
    ThresholdNote, ExperimentBucket, StratificationMetric,
    ConflictStatus, MaterialType
)
from auc_anomaly_detector import AUCLayerAnomalyDetector
from errors import (
    DuplicateImportError, ThresholdMismatchError, ConflictUnresolvedError,
    MaterialTypeError, StepOrderError
)


def test_normal_material_flow():
    print("=" * 60)
    print("测试场景1: 正常材料完整流程")
    print("=" * 60)

    detector = AUCLayerAnomalyDetector()

    note = ThresholdNote(
        note_id="NOTE-001",
        version=1,
        thresholds={"分层A": 0.85, "分层B": 0.80, "分层C": 0.75},
        reporter="数据科学家小王",
        report_time=datetime(2024, 1, 15, 10, 30)
    )
    note_id, import_checks = detector.import_threshold_note(note)
    print(f"✓ 第一步: 导入阈值调参笔记 {note_id}")
    for check in import_checks:
        print(f"  自检 [{check.check_name}]: {'通过' if check.passed else '失败'} - {check.message}")

    bucket = ExperimentBucket(
        bucket_id="BUCKET-001",
        bucket_name="线上实验桶A",
        thresholds={"分层A": 0.85, "分层B": 0.80, "分层C": 0.75},
        update_time=datetime(2024, 1, 15, 11, 0)
    )
    bucket_id, conflicts = detector.review_experiment_bucket(bucket, reviewer="阿越")
    print(f"✓ 第二步: 实验平台负责人阿越补看线上实验桶 {bucket_id}")
    print(f"  检测到冲突数: {len(conflicts)}")

    metrics = [
        StratificationMetric(layer_name="分层A", auc=0.88, sample_count=10000),
        StratificationMetric(layer_name="分层B", auc=0.82, sample_count=8000),
        StratificationMetric(layer_name="分层C", auc=0.73, sample_count=5000),
    ]
    record_id, metric_checks = detector.update_stratification_metrics(
        note_id, metrics, MaterialType.NORMAL, bucket_id
    )
    print(f"✓ 第三步: 更新分层指标，记录ID {record_id}")
    for check in metric_checks:
        print(f"  自检 [{check.check_name}]: {'通过' if check.passed else '失败'} - {check.message}")

    record = detector.get_metrics_record(record_id)
    print("\n分层指标结果:")
    for m in record.metrics:
        status = "⚠️ 反常" if m.is_anomaly else "✅ 正常"
        reason = f" ({m.anomaly_reason})" if m.anomaly_reason else ""
        print(f"  {m.layer_name}: AUC={m.auc:.4f}, 样本数={m.sample_count} {status}{reason}")

    export_data = detector.export_metrics(record_id)
    print(f"\n✓ 导出成功，包含 {len(export_data['metrics'])} 个分层指标")

    print("\n操作历史记录:")
    for dt, action, detail in detector.get_history():
        print(f"  [{dt.strftime('%H:%M:%S')}] {action}: {detail}")

    print("✅ 正常材料流程测试通过\n")


def test_wrong_caliber_material():
    print("=" * 60)
    print("测试场景2: 错口径材料（阈值与实验桶冲突）")
    print("=" * 60)

    detector = AUCLayerAnomalyDetector()

    note = ThresholdNote(
        note_id="NOTE-002",
        version=1,
        thresholds={"分层A": 0.90, "分层B": 0.85, "分层C": 0.80},
        reporter="数据科学家小李",
        report_time=datetime(2024, 1, 16, 9, 0)
    )
    note_id, _ = detector.import_threshold_note(note)
    print(f"✓ 导入阈值调参笔记 {note_id} (阈值偏高)")

    bucket = ExperimentBucket(
        bucket_id="BUCKET-002",
        bucket_name="线上实验桶B",
        thresholds={"分层A": 0.85, "分层B": 0.80, "分层C": 0.75},
        update_time=datetime(2024, 1, 16, 9, 30)
    )
    bucket_id, conflicts = detector.review_experiment_bucket(bucket, reviewer="阿越")
    print(f"✓ 阿越补看线上实验桶 {bucket_id}")
    print(f"⚠️  检测到 {len(conflicts)} 处冲突:")
    for conflict in conflicts:
        print(f"  冲突ID: {conflict.conflict_id}")
        for evidence in conflict.evidences:
            print(f"    - {evidence.description}")

    pending = detector.get_pending_conflicts()
    assert len(pending) > 0, "应该有待处理冲突"

    try:
        metrics = [
            StratificationMetric(layer_name="分层A", auc=0.88, sample_count=10000),
        ]
        detector.update_stratification_metrics(note_id, metrics, MaterialType.WRONG_CALIBER, bucket_id)
        print("❌ 应该报错但没有")
    except ConflictUnresolvedError as e:
        print(f"✅ 正确阻止: {e.user_message}")

    for conflict in conflicts:
        detector.handle_conflict(
            conflict.conflict_id,
            ConflictStatus.CONFIRMED,
            handler="阿越",
            comment="确认以笔记为准，是错口径实验"
        )
    print("✓ 阿越已确认所有冲突")

    metrics = [
        StratificationMetric(layer_name="分层A", auc=0.88, sample_count=10000),
        StratificationMetric(layer_name="分层B", auc=0.86, sample_count=8000),
        StratificationMetric(layer_name="分层C", auc=0.82, sample_count=5000),
    ]
    record_id, checks = detector.update_stratification_metrics(
        note_id, metrics, MaterialType.WRONG_CALIBER, bucket_id
    )
    print(f"✓ 冲突处理完成，成功更新分层指标 {record_id}")

    try:
        detector.validate_material_type(record_id, MaterialType.NORMAL)
        print("❌ 材料类型验证应该失败")
    except MaterialTypeError as e:
        print(f"✅ 材料类型验证正确: {e.user_message}")

    print("✅ 错口径材料流程测试通过\n")


def test_supplementary_material():
    print("=" * 60)
    print("测试场景3: 补录材料流程")
    print("=" * 60)

    detector = AUCLayerAnomalyDetector()

    original_note = ThresholdNote(
        note_id="NOTE-003",
        version=1,
        thresholds={"分层A": 0.85, "分层B": 0.80},
        reporter="数据科学家小张",
        report_time=datetime(2024, 1, 17, 10, 0)
    )
    original_note_id, _ = detector.import_threshold_note(original_note)
    print(f"✓ 导入原始笔记 {original_note_id}")

    bucket = ExperimentBucket(
        bucket_id="BUCKET-003",
        bucket_name="线上实验桶C",
        thresholds={"分层A": 0.85, "分层B": 0.80},
        update_time=datetime(2024, 1, 17, 10, 30)
    )
    bucket_id, conflicts = detector.review_experiment_bucket(bucket, reviewer="阿越")
    print(f"✓ 阿越补看实验桶 {bucket_id}，冲突数: {len(conflicts)}")

    original_metrics = [
        StratificationMetric(layer_name="分层A", auc=0.87, sample_count=10000),
        StratificationMetric(layer_name="分层B", auc=0.81, sample_count=8000),
    ]
    original_record_id, _ = detector.update_stratification_metrics(
        original_note_id, original_metrics, MaterialType.NORMAL, bucket_id
    )
    print(f"✓ 原始指标记录 {original_record_id}")

    print("\n--- 发现漏了分层C，进行补录 ---")
    supp_note = ThresholdNote(
        note_id="NOTE-003",
        version=2,
        thresholds={"分层A": 0.85, "分层B": 0.80, "分层C": 0.75},
        reporter="数据科学家小张",
        report_time=datetime(2024, 1, 17, 14, 0),
        comment="补充分层C的阈值"
    )
    supp_note_id, _ = detector.import_supplementary_note(supp_note, original_note_id)
    print(f"✓ 补录笔记 {supp_note_id}")

    bucket2 = ExperimentBucket(
        bucket_id="BUCKET-003",
        bucket_name="线上实验桶C",
        thresholds={"分层A": 0.85, "分层B": 0.80, "分层C": 0.75},
        update_time=datetime(2024, 1, 17, 14, 30)
    )
    bucket_id2, conflicts2 = detector.review_experiment_bucket(bucket2, reviewer="阿越")
    print(f"✓ 阿越重新补看实验桶，冲突数: {len(conflicts2)}")

    new_metrics = [
        StratificationMetric(layer_name="分层A", auc=0.87, sample_count=10000),
        StratificationMetric(layer_name="分层B", auc=0.81, sample_count=8000),
        StratificationMetric(layer_name="分层C", auc=0.72, sample_count=3000),
    ]
    new_record_id = detector.recalculate_after_supplement(original_record_id, new_metrics)
    print(f"✓ 补录后重算，新记录ID: {new_record_id}")

    new_record = detector.get_metrics_record(new_record_id)
    assert new_record.is_recalculated == True
    assert new_record.original_record_id == original_record_id
    print(f"✓ 验证: is_recalculated={new_record.is_recalculated}, 关联原始记录正确")

    print("\n补录后的分层指标:")
    for m in new_record.metrics:
        status = "⚠️ 反常" if m.is_anomaly else "✅ 正常"
        print(f"  {m.layer_name}: AUC={m.auc:.4f} {status}")

    print("✅ 补录材料流程测试通过\n")


def test_threshold_old_value_detection():
    print("=" * 60)
    print("测试场景4: 阈值改过但报告仍写旧值检测")
    print("=" * 60)

    detector = AUCLayerAnomalyDetector()

    note_orig = ThresholdNote(
        note_id="NOTE-004",
        version=1,
        thresholds={"分层A": 0.85, "分层B": 0.80},
        reporter="数据科学家小陈",
        report_time=datetime(2024, 1, 18, 9, 0)
    )
    orig_id, _ = detector.import_threshold_note(note_orig)
    print(f"✓ 导入原始笔记 v1: 分层A=0.85, 分层B=0.80")

    bucket_orig = ExperimentBucket(
        bucket_id="BUCKET-004",
        bucket_name="线上实验桶D",
        thresholds={"分层A": 0.85, "分层B": 0.80},
        update_time=datetime(2024, 1, 18, 9, 30)
    )
    bucket_id, conflicts = detector.review_experiment_bucket(bucket_orig, reviewer="阿越")
    print(f"✓ 阿越补看实验桶 v1，冲突数: {len(conflicts)}")

    print("\n--- 阈值调整：通过补录更新阈值 (0.85/0.80 → 0.88/0.82) ---")
    note_supp = ThresholdNote(
        note_id="NOTE-004",
        version=2,
        thresholds={"分层A": 0.88, "分层B": 0.82},
        reporter="数据科学家小陈",
        report_time=datetime(2024, 1, 18, 10, 0),
        comment="阈值调高补录"
    )
    supp_id, _ = detector.import_supplementary_note(note_supp, orig_id)
    print(f"✓ 补录笔记 v2: 分层A=0.88, 分层B=0.82")

    bucket_new = ExperimentBucket(
        bucket_id="BUCKET-004",
        bucket_name="线上实验桶D",
        thresholds={"分层A": 0.88, "分层B": 0.82},
        update_time=datetime(2024, 1, 18, 10, 30)
    )
    bucket_id2, conflicts2 = detector.review_experiment_bucket(bucket_new, reviewer="阿越")
    print(f"✓ 阿越重新补看实验桶 v2，冲突数: {len(conflicts2)}")
    for c in conflicts2:
        detector.handle_conflict(c.conflict_id, ConflictStatus.CONFIRMED, "阿越", "阈值更新确认")

    print("\n--- 模拟：报告里还写着旧版本的指标数据（按旧阈值是正常，按新阈值应该反常） ---")
    old_metrics = [
        StratificationMetric(layer_name="分层A", auc=0.86, sample_count=10000),
        StratificationMetric(layer_name="分层B", auc=0.81, sample_count=8000),
    ]
    print(f"  提交的指标:")
    print(f"    分层A=0.86 → 旧阈值0.85: ✅正常, 新阈值0.88: ⚠️反常")
    print(f"    分层B=0.81 → 旧阈值0.80: ✅正常, 新阈值0.82: ⚠️反常")

    try:
        detector.update_stratification_metrics(supp_id, old_metrics, MaterialType.NORMAL, bucket_id2)
        print("⚠️  未触发阈值旧值检测")
    except ThresholdMismatchError as e:
        print(f"✅ 正确检测到阈值旧值问题: {e.user_message}")

    print("\n--- 复核后，按新阈值重新提交正确的反常标记 ---")
    fixed_metrics = [
        StratificationMetric(layer_name="分层A", auc=0.86, sample_count=10000, is_anomaly=True, anomaly_reason="AUC低于新阈值0.88"),
        StratificationMetric(layer_name="分层B", auc=0.81, sample_count=8000, is_anomaly=True, anomaly_reason="AUC低于新阈值0.82"),
    ]
    record_id, checks = detector.update_stratification_metrics(supp_id, fixed_metrics, MaterialType.NORMAL, bucket_id2)
    print(f"✓ 数据科学家复核后，正确标记反常，记录ID: {record_id}")

    print("✅ 阈值旧值检测测试完成\n")


def test_step_order_protection():
    print("=" * 60)
    print("测试场景5: 流程顺序保护")
    print("=" * 60)

    detector = AUCLayerAnomalyDetector()

    try:
        bucket = ExperimentBucket(
            bucket_id="BUCKET-005",
            bucket_name="测试桶",
            thresholds={"分层A": 0.85},
            update_time=datetime.now()
        )
        detector.review_experiment_bucket(bucket)
        print("❌ 应该报错")
    except StepOrderError as e:
        print(f"✅ 正确阻止跳过第一步: {e.user_message}")

    note = ThresholdNote(
        note_id="NOTE-005",
        version=1,
        thresholds={"分层A": 0.85},
        reporter="测试",
        report_time=datetime.now()
    )
    detector.import_threshold_note(note)

    try:
        metrics = [StratificationMetric(layer_name="分层A", auc=0.88, sample_count=1000)]
        detector.update_stratification_metrics("NOTE-005", metrics, MaterialType.NORMAL)
        print("❌ 应该报错")
    except StepOrderError as e:
        print(f"✅ 正确阻止跳过第二步: {e.user_message}")

    print("✅ 流程顺序保护测试通过\n")


def test_duplicate_import_protection():
    print("=" * 60)
    print("测试场景6: 重复导入保护")
    print("=" * 60)

    detector = AUCLayerAnomalyDetector()

    note = ThresholdNote(
        note_id="NOTE-006",
        version=1,
        thresholds={"分层A": 0.85},
        reporter="测试",
        report_time=datetime.now()
    )
    detector.import_threshold_note(note)
    print("✓ 第一次导入成功")

    try:
        note2 = ThresholdNote(
            note_id="NOTE-006",
            version=2,
            thresholds={"分层A": 0.88},
            reporter="测试",
            report_time=datetime.now()
        )
        detector.import_threshold_note(note2)
        print("❌ 应该报错")
    except DuplicateImportError as e:
        print(f"✅ 正确阻止重复导入: {e.user_message}")

    print("✅ 重复导入保护测试通过\n")


if __name__ == "__main__":
    test_normal_material_flow()
    test_wrong_caliber_material()
    test_supplementary_material()
    test_threshold_old_value_detection()
    test_step_order_protection()
    test_duplicate_import_protection()

    print("=" * 60)
    print("🎉 所有测试场景执行完毕!")
    print("=" * 60)
