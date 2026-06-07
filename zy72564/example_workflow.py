from sample_manager import ActiveLearningSampler, SampleStatus, ScoreGapLevel


def print_divider(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def main():
    sampler = ActiveLearningSampler()
    slice_id = "slice_20260601_test"

    # ============================================================
    print_divider("第一步：导入评测切片")
    # ============================================================

    rows = [
        {"original_row_number": 1, "offline_score": 0.75, "remark": "初始导入-样本1"},
        {"original_row_number": 2, "offline_score": 0.55, "remark": "初始导入-样本2"},
        {"original_row_number": 3, "offline_score": 0.82, "remark": "初始导入-样本3"},
        {"original_row_number": 4, "offline_score": 0.30, "remark": "初始导入-样本4"},
    ]

    result = sampler.import_slice(slice_id=slice_id, rows=rows, operator="linjie")
    print(f"导入结果: {result['imported']}条新增, {result['skipped_duplicate']}条跳过")
    print(f"样本ID列表: {result['sample_ids']}")

    # ============================================================
    print_divider("验证：重复导入不翻倍（幂等性）")
    # ============================================================

    rows_again = [
        {"original_row_number": 1, "offline_score": 0.75},
        {"original_row_number": 2, "offline_score": 0.55},
        {"original_row_number": 5, "offline_score": 0.91, "remark": "新增的第5行"},
    ]

    result2 = sampler.import_slice(slice_id=slice_id, rows=rows_again, operator="linjie")
    print(f"再次导入结果: {result2['imported']}条新增, {result2['skipped_duplicate']}条跳过")
    print(f"总共样本数: {len(sampler.store.list_samples(slice_id=slice_id))}")

    # ============================================================
    print_divider("第二步：林姐补看特征快照编号")
    # ============================================================

    sample1_id = f"{slice_id}_row_1"
    sampler.add_feature_snapshot(
        sample_id=sample1_id,
        feature_snapshot_id="feat_v2_20260607_001",
        operator="linjie",
        remark="对照特征快照表第5页确认",
    )

    sample2_id = f"{slice_id}_row_2"
    sampler.add_feature_snapshot(
        sample_id=sample2_id,
        feature_snapshot_id="feat_v2_20260607_002",
        operator="linjie",
    )

    sample3_id = f"{slice_id}_row_3"
    sampler.add_feature_snapshot(
        sample_id=sample3_id,
        feature_snapshot_id="feat_v2_20260607_003",
        operator="linjie",
    )

    s1 = sampler.store.get_sample(sample1_id)
    print(f"样本1状态: {s1.status.value}, 特征快照: {s1.feature_snapshot_id}")

    # ============================================================
    print_divider("第三步：实验对比更新分数")
    # ============================================================

    print("--- 样本1：离线0.75(桶3) vs 线上0.58(桶2) → 差1个桶 → 待复核 ---")
    r1 = sampler.update_experiment_scores(
        sample_id=sample1_id,
        offline_score=0.75,
        online_score=0.58,
        operator="linjie",
    )
    s1 = sampler.store.get_sample(sample1_id)
    print(f"  结果: needs_review={r1['needs_review']}")
    print(f"  状态: {s1.status.value}")
    print(f"  离线桶{s1.score_bucket_offline} vs 线上桶{s1.score_bucket_online}")
    print(f"  分差等级: {s1.score_gap_level.value}")

    print("\n--- 样本2：离线0.55(桶2) vs 线上0.52(桶2) → 分差0 → 正常 ---")
    r2 = sampler.update_experiment_scores(
        sample_id=sample2_id,
        offline_score=0.55,
        online_score=0.52,
        operator="linjie",
    )
    s2 = sampler.store.get_sample(sample2_id)
    print(f"  结果: needs_review={r2['needs_review']}")
    print(f"  状态: {s2.status.value}")

    print("\n--- 样本3：离线0.82(桶4) vs 线上0.45(桶2) → 差2个桶 → 待复核 ---")
    r3 = sampler.update_experiment_scores(
        sample_id=sample3_id,
        offline_score=0.82,
        online_score=0.45,
        operator="linjie",
    )
    s3 = sampler.store.get_sample(sample3_id)
    print(f"  结果: needs_review={r3['needs_review']}")
    print(f"  状态: {s3.status.value}")

    # ============================================================
    print_divider("查看所有待复核的样本（评测运营视角）")
    # ============================================================

    pending = sampler.get_samples_pending_review(slice_id=slice_id)
    print(f"待复核样本数: {len(pending)}")
    for s in pending:
        print(f"  行号{s.original_row_number}: 离线桶{s.score_bucket_offline} vs 线上桶{s.score_bucket_online} ({s.score_gap_level.value})")

    # ============================================================
    print_divider("评测运营复核：样本1通过，样本3驳回")
    # ============================================================

    sampler.review_decision(
        sample_id=sample1_id,
        approved=True,
        operator="operation_zhang",
        review_remark="桶边界正常样本，误差可接受",
    )

    sampler.review_decision(
        sample_id=sample3_id,
        approved=False,
        operator="operation_zhang",
        review_remark="分差过大，需要重新跑实验确认",
    )

    s1 = sampler.store.get_sample(sample1_id)
    s3 = sampler.store.get_sample(sample3_id)
    print(f"样本1复核后状态: {s1.status.value}")
    print(f"样本3复核后状态: {s3.status.value}")

    # ============================================================
    print_divider("林姐只改了一条备注（测试历史追踪）")
    # ============================================================

    sampler.update_remark(
        sample_id=sample1_id,
        remark="这个样本和 feat_v1 对比过，趋势一致，可以作为正例",
        operator="linjie",
    )

    # ============================================================
    print_divider("查看样本1的完整历史（评测运营追问时拿证据）")
    # ============================================================

    history = sampler.get_sample_history(sample1_id)
    print(f"样本1共有 {len(history)} 条变更记录:")
    for h in history:
        field = h.get('field_name') or '整体'
        old = h.get('old_value')
        new = h.get('new_value')
        if isinstance(old, dict):
            old = '[创建时完整数据]'
        print(f"\n  [{h['changed_at'][:19]}] {h['changed_by']} - {h['change_type']}")
        print(f"    {field}: {old} → {new}")
        if h.get('remark'):
            print(f"    备注: {h['remark']}")

    # ============================================================
    print_divider("回滚示例：样本3回滚到重新实验")
    # ============================================================

    sampler.rollback(
        sample_id=sample3_id,
        target_status=SampleStatus.FEATURE_ADDED,
        operator="operation_zhang",
        rollback_remark="驳回后重新跑实验",
    )

    s3 = sampler.store.get_sample(sample3_id)
    print(f"样本3回滚后状态: {s3.status.value}")

    # ============================================================
    print_divider("汇总统计")
    # ============================================================

    all_samples = sampler.store.list_samples(slice_id=slice_id)
    status_counts = {}
    for s in all_samples:
        status_counts[s.status.value] = status_counts.get(s.status.value, 0) + 1

    print(f"总样本数: {len(all_samples)}")
    print("状态分布:")
    for status, count in status_counts.items():
        print(f"  {status}: {count}")

    print("\n✓ 完整流程演示结束")


if __name__ == "__main__":
    main()
