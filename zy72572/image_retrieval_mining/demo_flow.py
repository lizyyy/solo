from .core import HardCaseMiner
from .models import RecordStatus


def run_step_by_step_demo() -> HardCaseMiner:
    print("=" * 70)
    print("图像检索难例挖掘 - 三步流程演示")
    print("=" * 70)

    miner = HardCaseMiner()

    print("\n【第一步】导入训练日志曲线")
    print("-" * 70)
    miner.import_training_log(
        log_id="log_v2.1_20260607",
        experiment_name="图像检索模型v2.1评测集",
        points=[
            (0, 2.5, 0.52),
            (2000, 1.2, 0.72),
            (4000, 0.5, 0.82),
            (6000, 0.28, 0.87),
            (8000, 0.18, 0.885),
            (10000, 0.12, 0.892),
        ],
        model_version="v2.1.0",
    )
    for line in miner.get_step_log()[-2:]:
        print(f"  {line}")

    print("\n【导入检索记录】")
    print("-" * 70)

    print("\n  ▸ 记录1: 顺利记录")
    r1 = miner.add_record(
        image_id="IMG_SMOOTH_001",
        query="红色连衣裙 夏季",
        offline_score=0.86,
        online_score=0.84,
        training_log_id="log_v2.1_20260607",
    )
    print(f"    离线分数: {r1.offline_score:.3f} ({r1.offline_bucket.value}桶)")
    print(f"    线上分数: {r1.online_score:.3f} ({r1.online_bucket.value}桶)")
    print(f"    状态: {r1.status.value}")

    print("\n  ▸ 记录2: 离线线上分桶差一个桶 (关键!)")
    r2 = miner.add_record(
        image_id="IMG_DIFF_002",
        query="白色运动鞋 跑步",
        offline_score=0.82,
        online_score=0.78,
        training_log_id="log_v2.1_20260607",
    )
    print(f"    离线分数: {r2.offline_score:.3f} ({r2.offline_bucket.value}桶)")
    print(f"    线上分数: {r2.online_score:.3f} ({r2.online_bucket.value}桶)")
    print(f"    状态: {r2.status.value}")
    print(f"    ⚠️  检测到分桶差: 离线B桶 → 线上C桶, 差1个桶")
    print(f"    ⚠️  自动标记为【待评测运营复核】, 不直接归正常!")

    print("\n  ▸ 记录3: 待补录旧口径")
    r3 = miner.add_record(
        image_id="IMG_OLD_003",
        query="蓝色牛仔裤 直筒",
        offline_score=0.76,
        online_score=0.74,
        training_log_id="log_v2.1_20260607",
    )
    print(f"    离线分数: {r3.offline_score:.3f} ({r3.offline_bucket.value}桶)")
    print(f"    线上分数: {r3.online_score:.3f} ({r3.online_bucket.value}桶)")
    print(f"    状态: {r3.status.value}")

    print("\n【创建初始实验对比】")
    print("-" * 70)
    c1 = miner.add_experiment_comparison(
        baseline_record_id=r1.record_id,
        compared_record_id=r2.record_id,
        note="基线vs分桶差记录(应用前)",
    )
    c2 = miner.add_experiment_comparison(
        baseline_record_id=r1.record_id,
        compared_record_id=r3.record_id,
        note="基线vs旧口径记录(应用前)",
    )
    for c in [c1, c2]:
        print(f"  {c.note}:")
        print(f"    离线差: {c.offline_delta:+.3f}, 线上差: {c.online_delta:+.3f}")

    print("\n【第二步】阿越补看阈值调参笔记")
    print("-" * 70)
    note = miner.add_threshold_note(
        record_id=r3.record_id,
        old_offline_score=0.76,
        old_online_score=0.74,
        new_offline_score=0.67,
        new_online_score=0.65,
        caliber_note="2026Q1旧口径回溯: 特征相似度阈值从0.72下调到0.65",
        operator="阿越",
    )
    print(f"  操作人: {note.operator}")
    print(f"  口径说明: {note.caliber_note}")
    print(f"  原分数: 离线={note.old_offline_score}, 线上={note.old_online_score}")
    print(f"  新分数: 离线={note.new_offline_score}, 线上={note.new_online_score}")

    print("\n【第三步】应用阈值笔记, 实验对比自动更新")
    print("-" * 70)
    r3_updated = miner.apply_threshold_note(note.note_id)
    print(f"  记录 {r3_updated.image_id} 更新后:")
    print(f"    离线分数: {r3_updated.offline_score:.3f} ({r3_updated.offline_bucket.value}桶)")
    print(f"    线上分数: {r3_updated.online_score:.3f} ({r3_updated.online_bucket.value}桶)")
    print(f"    状态: {r3_updated.status.value}")

    print("\n【实验对比自动刷新】")
    for comp in miner.all_comparisons():
        if comp.compared_record_id == r3.record_id:
            print(f"  {comp.note}:")
            print(f"    离线差: {comp.offline_delta:+.3f}, 线上差: {comp.online_delta:+.3f}")
            print(f"    (已自动跟随阈值笔记更新)")

    print("\n" + "=" * 70)
    print("【当前状态汇总】")
    print("=" * 70)
    result = miner.run_mining()
    for k, v in result.summary().items():
        print(f"  {k}: {v}")

    print("\n【关键保证】")
    print(f"  ✅ IMG_DIFF_002 状态仍为: {r2.status.value}")
    print(f"     → 离线B桶 vs 线上C桶, 差一个桶, 留给评测运营复核")
    print(f"     → 没有被自动归为正常!")

    print("\n【完整操作轨迹】")
    print("-" * 70)
    for line in miner.get_step_log():
        print(f"  {line}")

    return miner
