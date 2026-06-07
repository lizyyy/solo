#!/usr/bin/env python3
import os
import sys
import shutil
import tempfile
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from review_engine import ReviewEngine, NegativeSample, RecallCandidate, ReviewStatus


def test_three_step_workflow():
    print("=" * 70)
    print("端到端测试：验证三步完整流程")
    print("=" * 70)

    with tempfile.TemporaryDirectory() as tmpdir:
        storage = os.path.join(tmpdir, "review_data")
        engine = ReviewEngine(storage_path=storage)

        print("\n[第一步] 导入负样本列表")
        print("-" * 70)
        negative_samples = [
            NegativeSample(
                sample_id="test_s001",
                main_process_id="mp_test",
                main_process_name="测试主流程A",
                timestamp=datetime(2024, 6, 15, 14, 30, 0),
                feature_values={"f1": 1, "f2": 2},
                ground_truth_label="negative",
                model_prediction_score=0.91,
                source="测试数据",
                time_window_tag="疑似虚高",
                notes="预测分很高但是负样本",
            ),
            NegativeSample(
                sample_id="test_s002",
                main_process_id="mp_test",
                main_process_name="测试主流程B",
                timestamp=datetime(2024, 6, 15, 10, 0, 0),
                feature_values={"f1": 3, "f2": 4},
                ground_truth_label="negative",
                model_prediction_score=0.45,
                source="测试数据",
                time_window_tag="",
                notes="普通负样本",
            ),
        ]

        anomalies = engine.import_negative_samples(negative_samples)
        print(f"✓ 导入了 {len(negative_samples)} 条负样本")
        print(f"✓ 生成了 {len(anomalies)} 条异常记录")

        assert len(anomalies) == 2, "应该生成2条异常记录"

        anomaly_a = next(a for a in anomalies if a.sample_id == "test_s001")
        anomaly_b = next(a for a in anomalies if a.sample_id == "test_s002")

        print(f"\n样本A状态: {anomaly_a.status.value}")
        print(f"样本A是否有时间窗问题: {anomaly_a.has_time_window_inflation()}")
        print(f"样本A为什么被留下: {anomaly_a.why_kept[:50]}...")

        assert anomaly_a.has_time_window_inflation(), "样本A应该检测到时间窗问题"
        assert anomaly_a.status == ReviewStatus.PENDING_EXPERT_REVIEW, "有时间窗问题应待专家复核"
        assert anomaly_a.next_action is not None, "应该有下一步行动"
        assert "实验平台" in anomaly_a.get_owner_display(), "时间窗问题应找实验平台"

        print(f"\n样本B状态: {anomaly_b.status.value}")
        print(f"样本B缺什么材料: {anomaly_b.missing_materials}")
        print(f"样本B下一步找谁: {anomaly_b.get_owner_display()}")

        assert not anomaly_b.has_time_window_inflation(), "样本B不应有时间窗问题"
        assert anomaly_b.status == ReviewStatus.IMPORTED
        assert "召回候选" in str(anomaly_b.missing_materials), "应该提示缺召回候选"
        assert "老唐" in anomaly_b.get_owner_display(), "缺召回候选应找老唐"

        print("\n✓ 第一步通过 ✓")

        print("\n[第二步] 推荐策略老唐补录召回候选表")
        print("-" * 70)

        recall_candidates = [
            RecallCandidate(
                candidate_id="test_r001",
                sample_id="test_s001",
                scene_description="用户后续点击了同类型内容",
                timestamp=datetime(2024, 6, 15, 14, 30, 0),
                recall_source="人工审核",
                field_evidence="有证据表明特征穿越了时间窗",
                confidence_score=0.88,
                added_by="recommend_strategy_tang",
                notes="老唐补的现场说法",
            ),
            RecallCandidate(
                candidate_id="test_r002",
                sample_id="test_s002",
                scene_description="正常曝光未点击，无异常",
                timestamp=datetime(2024, 6, 15, 10, 0, 0),
                recall_source="人工审核",
                field_evidence="现场确认是正常负样本",
                confidence_score=0.95,
                added_by="recommend_strategy_tang",
                notes="老唐确认没问题",
            ),
        ]

        updated = engine.add_recall_candidates(recall_candidates)
        print(f"✓ 补录了 {len(recall_candidates)} 条召回候选")
        print(f"✓ 更新了 {len(updated)} 条异常记录")

        assert len(updated) == 2, "应该更新2条异常记录"

        print("\n✓ 第二步通过 ✓")

        print("\n[第三步] 异常样本页自动更新")
        print("-" * 70)

        anomaly_a_updated = engine.get_anomaly_detail(anomaly_a.anomaly_id)
        anomaly_b_updated = engine.get_anomaly_detail(anomaly_b.anomaly_id)

        print(f"\n样本A更新后:")
        print(f"  召回候选数: {len(anomaly_a_updated.recall_candidates)}")
        print(f"  证据合并: {'有' if anomaly_a_updated.evidence_merge else '无'}")
        print(f"  状态: {anomaly_a_updated.status.value}")
        print(f"  标签: {anomaly_a_updated.tags}")

        assert len(anomaly_a_updated.recall_candidates) == 1, "样本A应该有1条召回"
        assert anomaly_a_updated.evidence_merge is not None, "应该有证据合并结果"
        assert anomaly_a_updated.status == ReviewStatus.PENDING_EXPERT_REVIEW, "有时间窗问题仍需专家复核"
        assert "待实验平台复核" in anomaly_a_updated.tags, "应该保留待复核标签"

        print(f"\n样本B更新后:")
        print(f"  召回候选数: {len(anomaly_b_updated.recall_candidates)}")
        print(f"  缺材料: {anomaly_b_updated.missing_materials}")
        print(f"  下一步找谁: {anomaly_b_updated.get_owner_display()}")
        print(f"  状态: {anomaly_b_updated.status.value}")

        assert len(anomaly_b_updated.recall_candidates) == 1, "样本B应该有1条召回"
        assert "召回候选" not in str(anomaly_b_updated.missing_materials), "补录后不应再缺召回"
        assert "老唐" not in anomaly_b_updated.get_owner_display(), "补录后下一步不应再找老唐"
        assert anomaly_b_updated.status == ReviewStatus.RECALL_ADDED, "状态应为已补召回"

        print("\n✓ 第三步通过 ✓")

        print("\n[额外验证] 时间窗穿越问题不会被自动归为正常")
        print("-" * 70)

        stats = engine.get_statistics()
        print(f"待专家复核数: {stats['pending_expert_review']}")
        print(f"有时间窗问题数: {stats['with_time_window_issues']}")

        assert stats["pending_expert_review"] >= 1, "至少应该有1条待专家复核"
        assert stats["with_time_window_issues"] >= 1, "至少应该有1条有时间窗问题"

        pending_list = engine.get_anomaly_list(status=ReviewStatus.PENDING_EXPERT_REVIEW)
        print(f"待复核列表中的样本: {[a.sample_id for a in pending_list]}")
        assert any(a.sample_id == "test_s001" for a in pending_list), "样本A应该在待复核列表中"

        print("\n✓ 时间窗问题保留验证通过 ✓")

        print("\n[统计概览]")
        print("-" * 70)
        print(f"总异常数: {stats['total_anomalies']}")
        print(f"已补召回数: {stats['with_recall_candidates']}")
        print(f"状态分布: {stats['by_status']}")

        print("\n" + "=" * 70)
        print("🎉 所有端到端测试通过！三步流程完整验证成功")
        print("=" * 70)
        return True


def test_expert_review_workflow():
    print("\n\n" + "=" * 70)
    print("附加测试：专家复核流程验证")
    print("=" * 70)

    with tempfile.TemporaryDirectory() as tmpdir:
        storage = os.path.join(tmpdir, "review_data")
        engine = ReviewEngine(storage_path=storage)

        sample = NegativeSample(
            sample_id="test_expert_001",
            main_process_id="mp_test",
            main_process_name="专家复核测试",
            timestamp=datetime(2024, 6, 15, 14, 30, 0),
            model_prediction_score=0.95,
            ground_truth_label="negative",
            time_window_tag="穿越",
        )
        anomalies = engine.import_negative_samples([sample])
        anomaly = anomalies[0]

        assert anomaly.status == ReviewStatus.PENDING_EXPERT_REVIEW

        result = engine.submit_expert_review(
            anomaly_id=anomaly.anomaly_id,
            reviewer="实验平台负责人",
            approved=True,
            comment="确认是时间窗问题，已在平台修复",
        )

        assert result.status == ReviewStatus.EXPERT_APPROVED
        assert "待实验平台复核" not in result.tags
        assert "已通过专家复核" in result.tags
        assert len(result.review_comments) > 0

        print("✓ 专家复核通过流程验证成功")

        history = engine.get_review_history(anomaly.anomaly_id)
        assert len(history) >= 2, "应该至少有导入和复核两条记录"
        print(f"✓ 复核历史记录数: {len(history)}")

        result2 = engine.archive_anomaly(
            anomaly_id=anomaly.anomaly_id,
            reviewer="系统",
            comment="问题已修复，归档",
        )
        assert result2.status == ReviewStatus.ARCHIVED
        print("✓ 归档流程验证成功")

        print("\n🎉 专家复核附加测试通过！")
        return True


if __name__ == "__main__":
    success = True
    try:
        test_three_step_workflow()
        test_expert_review_workflow()
    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        success = False
    except Exception as e:
        print(f"\n❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        success = False

    if success:
        print("\n" + "=" * 70)
        print("✅ 所有测试全部通过！")
        print("=" * 70)
        sys.exit(0)
    else:
        sys.exit(1)
