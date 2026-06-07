#!/usr/bin/env python3
from acceptance import AcceptanceEngine


def print_header(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_step(step_num, title):
    print(f"\n{'─' * 3} Step {step_num}: {title}")
    print("─" * 50)


def main():
    engine = AcceptanceEngine()

    print_header("🎓 向量索引召回验收 - 完整流程演示")
    print("  主讲人：推荐策略老唐")
    print("  场景：评测切片导入 → 补录特征快照 → 实验对比更新")
    print("  关键点：离线线上差一个桶时，别急着归正常，留给评测运营复核")

    print_step(1, "导入评测切片（新人操作")
    print("场景：第一次导入评测切片，发现离线线上分数差了一个桶")
    record = engine.import_slice(
        slice_id="SLICE-DEMO-001",
        name="新人培训演示切片",
        offline_score=0.72,
        online_score=0.58,
        query_count=10000,
        tags=["培训演示", "核心搜索"],
    )
    print(f"  ✅ 导入成功")
    print(f"  记录编号: {record.record_id}")
    print(f"  切片名称: {record.slice.name}")
    print(f"  离线分数: {record.slice.offline_score:.4f} → 分桶: {record.slice.offline_bucket.value}")
    print(f"  线上分数: {record.slice.online_score:.4f} → 分桶: {record.slice.online_bucket.value}")
    print(f"  分桶差异: 差 {record.slice.bucket_diff} 个桶 ⚠️")
    print(f"  当前状态: {record.status.value}")
    print(f"  负责人: {record.assignee}")
    print(f"  下一步: {record.next_step}")
    print()
    print("  💡 注意：这里离线0.72属于0.6-0.8桶，线上0.58属于0.4-0.6桶")
    print("     以前总被当成小备注跳过，现在必须标出！")
    print("     系统没有自动归为正常，而是标记为【分桶不一致】")
    print("     自动指派给：评测运营（复核）")

    print_step(2, "推荐策略老唐补看特征快照编号")
    print("场景：老唐收到通知，补录特征快照编号")
    print("  老唐：让我看看这个切片的特征快照...")
    record = engine.fill_feature_snapshot(
        record_id=record.record_id,
        snapshot_id="FEAT-SNAP-DEMO-20240601",
        feature_version="v3.2.0",
        vector_dim=768,
        index_type="HNSW",
        remark="新人培训用，特征已核对过",
    )
    print(f"  ✅ 特征快照补录完成")
    print(f"  快照编号: {record.feature_snapshot.snapshot_id}")
    print(f"  特征版本: {record.feature_snapshot.feature_version}")
    print()
    print("  💡 注意：补录特征后，系统自动更新实验对比")
    print("     但是，因为还有分桶差异，状态变为【待评测运营复核】")
    print(f"     当前状态: {record.status.value}")
    print(f"     负责人还是：{record.assignee}")
    print(f"     下一步：{record.next_step}")

    print_step(3, "实验对比更新")
    print("场景：查看最新的实验对比报告")
    report = engine.generate_report(record.record_id)
    print(report)

    print_step(4, "一次人工修正 + 一次重跑（演示数据里的场景）")
    print("  老唐：这个我来演示一下人工修正和重跑的流程...")

    engine.manual_correct(
        record_id=record.record_id,
        operator="推荐策略老唐",
        field="特征快照备注",
        before="新人培训用，特征已核对过",
        after="新人培训用，特征已核对过，确认特征版本正确",
        reason="给新人演示人工修正流程",
    )
    print("  ✅ 已记录人工修正")

    print()
    print("  老唐：接下来重跑一次验证...")
    record = engine.re_run(
        record_id=record.record_id,
        operator="推荐策略老唐",
    )
    print(f"  ✅ 已重跑")
    print(f"  重跑后状态: {record.status.value}")
    print(f"  重跑后负责人: {record.assignee}")
    print(f"  重跑后下一步: {record.next_step}")
    print()
    print("  💡 注意：重跑后分桶差异依然存在，")
    print("     系统没有自动归正常，仍然留给评测运营复核")
    print("     这就是我们要的效果！")

    print_step(5, "评测运营复核")
    print("场景：评测运营来复核这个分桶差异")
    record = engine.review_result(
        record_id=record.record_id,
        passed=True,
        reviewer="评测运营小王",
        comment="口径确认过，是离线评估用了旧的样本，线上是新样本，差一个桶属于正常范围",
    )
    print(f"  ✅ 评测运营复核完成")
    print(f"  复核结果: 通过")
    print(f"  复核意见: {record.correction_logs[-1].reason}")
    print(f"  当前状态: {record.status.value}")
    print(f"  下一步: {record.next_step}")

    print_header("🎉 演示结束")
    print("  总结：")
    print("  1. 导入时检测到离线线上差一个桶 → 标记出来，不跳过")
    print("  2. 补录特征快照 → 实验对比自动更新")
    print("  3. 分桶差异不自动归正常 → 留给评测运营复核")
    print("  4. 支持人工修正和重跑，全程留痕")
    print("  5. 报告不是冷冰冰的日志，有说明、有缺件、有下一步")
    print()
    print("  谁找谁：")
    print("  - 分桶差异 → 先找评测运营复核口径")
    print("  - 缺特征快照 → 找推荐策略老唐补录")
    print("=" * 70)


if __name__ == "__main__":
    main()
