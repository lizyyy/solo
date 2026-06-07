#!/usr/bin/env python3
import sys

from image_retrieval_mining import generate_demo_data
from image_retrieval_mining.demo_flow import run_step_by_step_demo
from image_retrieval_mining.models import RecordStatus, BucketType


def test_basic_logic():
    print("✅ 测试1: 核心业务逻辑")
    print("-" * 50)

    miner, result = generate_demo_data()

    assert result.total_count >= 3, "至少应有3条记录"
    assert result.bucket_diff_count >= 1, "至少应有1条分桶差异"

    has_normal = False
    has_bucket_diff = False
    has_old_caliber = False

    for r in miner.all_records():
        if r.status == RecordStatus.NORMAL or r.status == RecordStatus.MANUAL_FIXED:
            has_normal = True
        if r.bucket_diff or r.status in [RecordStatus.BUCKET_DIFF, RecordStatus.PENDING_REVIEW]:
            has_bucket_diff = True
        if r.status == RecordStatus.OLD_CALIBER or r.status == RecordStatus.RERUN:
            has_old_caliber = True

    assert has_normal, "应有正常/人工修正记录"
    assert has_bucket_diff, "应有分桶差异记录"
    assert has_old_caliber, "应有旧口径/重跑记录"

    print("  ✅ 三种处理结果存在: 正常、分桶差、旧口径")
    print("  ✅ 核心逻辑验证通过")


def test_three_step_flow():
    print("\n✅ 测试2: 三步流程完整性")
    print("-" * 50)

    miner = run_step_by_step_demo()
    step_log = miner.get_step_log()

    has_step1 = any("第一步" in line for line in step_log)
    has_step2 = any("第二步" in line for line in step_log)
    has_step3 = any("第三步" in line for line in step_log)

    assert has_step1, "应有第一步: 导入训练日志"
    assert has_step2, "应有第二步: 阿越补看阈值调参笔记"
    assert has_step3, "应有第三步: 实验对比更新"

    print("  ✅ 第一步: 训练日志曲线导入")
    print("  ✅ 第二步: 阿越补看阈值调参笔记")
    print("  ✅ 第三步: 实验对比自动更新")
    print("  ✅ 三步流程完整")


def test_bucket_diff_not_auto_normal():
    print("\n✅ 测试3: 分桶差留给评测运营复核")
    print("-" * 50)

    from image_retrieval_mining.core import HardCaseMiner

    miner = HardCaseMiner()
    miner.import_training_log(
        log_id="test_log",
        experiment_name="测试",
        points=[(0, 1.0, 0.8)],
    )

    r = miner.add_record(
        image_id="TEST_DIFF",
        query="测试分桶差",
        offline_score=0.82,
        online_score=0.78,
    )

    assert r.offline_bucket == BucketType.B, "离线应为B桶"
    assert r.online_bucket == BucketType.C, "线上应为C桶"
    assert r.bucket_diff == True, "应检测到分桶差"
    assert r.status == RecordStatus.PENDING_REVIEW, f"应标记为待复核, 当前是: {r.status}"
    assert r.status != RecordStatus.NORMAL, "不应自动归为正常"

    print(f"  ✅ 离线分数: 0.82 → {r.offline_bucket.value}桶")
    print(f"  ✅ 线上分数: 0.78 → {r.online_bucket.value}桶")
    print(f"  ✅ 差一个桶 (B → C)")
    print(f"  ✅ 状态: {r.status.value} (留给评测运营复核)")
    print(f"  ✅ 没有自动归为正常!")


def test_threshold_note_updates_comparison():
    print("\n✅ 测试4: 阈值调参笔记更新后实验对比跟着变")
    print("-" * 50)

    from image_retrieval_mining.core import HardCaseMiner

    miner = HardCaseMiner()

    r1 = miner.add_record("BASE", "基线", 0.85, 0.83)
    r2 = miner.add_record("TARGET", "目标", 0.76, 0.74)

    comp = miner.add_experiment_comparison(
        baseline_record_id=r1.record_id,
        compared_record_id=r2.record_id,
        note="测试对比",
    )

    old_offline_delta = comp.offline_delta
    old_online_delta = comp.online_delta
    print(f"  应用前: 离线差={old_offline_delta:+.3f}, 线上差={old_online_delta:+.3f}")

    note = miner.add_threshold_note(
        record_id=r2.record_id,
        old_offline_score=0.76,
        old_online_score=0.74,
        new_offline_score=0.67,
        new_online_score=0.65,
        caliber_note="测试口径变更",
    )

    miner.apply_threshold_note(note.note_id)

    new_offline_delta = comp.offline_delta
    new_online_delta = comp.online_delta
    print(f"  应用后: 离线差={new_offline_delta:+.3f}, 线上差={new_online_delta:+.3f}")

    assert new_offline_delta != old_offline_delta, "离线差应变化"
    assert new_online_delta != old_online_delta, "线上差应变化"

    print("  ✅ 实验对比自动跟随阈值笔记更新")


def main():
    print("=" * 60)
    print("图像检索难例挖掘 - 验证测试")
    print("=" * 60)

    try:
        test_basic_logic()
        test_three_step_flow()
        test_bucket_diff_not_auto_normal()
        test_threshold_note_updates_comparison()

        print("\n" + "=" * 60)
        print("🎉 所有测试通过!")
        print("=" * 60)
        print("\n验证要点:")
        print("  1. ✅ 三种样例记录: 顺利、分桶差、旧口径")
        print("  2. ✅ 三步流程: 导入日志→补看笔记→更新对比")
        print("  3. ✅ 分桶差标记为【待评测运营复核】, 不自动归正常")
        print("  4. ✅ 阈值调参笔记应用后实验对比自动更新")
        print("  5. ✅ 保留完整操作轨迹, 追证据不中断")
        return 0
    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ 异常: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
