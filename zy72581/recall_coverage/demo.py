from .models import FeatureSnapshot, SliceSource
from .storage import DataStore
from .analyzer import CoverageAnalyzer
from .replay import ThresholdReplayEngine


class DemoDataGenerator:
    def __init__(self, store: DataStore):
        self.store = store

    def generate_feature_snapshots(self):
        snapshot1 = FeatureSnapshot(
            snapshot_id="FS-2024-001",
            snapshot_name="V1.2 基线阈值",
            threshold_config={
                "recall_bonus": 0.0,
                "sensitivity": 1.0,
                "min_confidence": 0.5
            },
            recall_target=0.90,
            note="基线版本，无特殊调整"
        )

        snapshot2 = FeatureSnapshot(
            snapshot_id="FS-2024-002",
            snapshot_name="V1.3 长尾优化阈值",
            threshold_config={
                "recall_bonus": 0.25,
                "sensitivity": 1.2,
                "min_confidence": 0.3
            },
            recall_target=0.88,
            note="针对长尾少数类做了降阈值处理，人工修正后使用"
        )

        snapshot3 = FeatureSnapshot(
            snapshot_id="FS-2023-045",
            snapshot_name="V1.1 旧口径阈值",
            threshold_config={
                "recall_bonus": 0.15,
                "sensitivity": 0.9,
                "min_confidence": 0.6
            },
            recall_target=0.85,
            note="2023年Q4使用的旧口径，历史数据补录时参考"
        )

        self.store.save_feature_snapshot(snapshot1)
        self.store.save_feature_snapshot(snapshot2)
        self.store.save_feature_snapshot(snapshot3)

        return [snapshot1, snapshot2, snapshot3]

    def generate_initial_slices(self):
        slice1 = {
            "slice_id": "SL-001",
            "slice_name": "主流类目-手机数码",
            "category": "3C数码",
            "total_samples": 10000,
            "positive_samples": 8500,
            "negative_samples": 1500,
            "recall": 0.92,
            "precision": 0.88,
            "source": "initial_import",
            "feature_snapshot_id": "FS-2024-001",
            "note": "大样本主流类目，表现稳定"
        }

        slice2 = {
            "slice_id": "SL-002",
            "slice_name": "主流类目-服装鞋包",
            "category": "服饰鞋包",
            "total_samples": 8000,
            "positive_samples": 6800,
            "negative_samples": 1200,
            "recall": 0.89,
            "precision": 0.85,
            "source": "initial_import",
            "feature_snapshot_id": "FS-2024-001",
            "note": "大样本主流类目，表现正常"
        }

        slice3 = {
            "slice_id": "SL-003",
            "slice_name": "长尾类目-古董收藏",
            "category": "收藏爱好",
            "total_samples": 800,
            "positive_samples": 520,
            "negative_samples": 280,
            "recall": 0.65,
            "precision": 0.72,
            "source": "initial_import",
            "feature_snapshot_id": None,
            "note": "少数类样本，注意总指标可能掩盖问题"
        }

        slice4 = {
            "slice_id": "SL-004",
            "slice_name": "长尾类目-乐器配件",
            "category": "乐器",
            "total_samples": 500,
            "positive_samples": 300,
            "negative_samples": 200,
            "recall": 0.58,
            "precision": 0.68,
            "source": "initial_import",
            "feature_snapshot_id": None,
            "note": "超小样本，待补录特征快照"
        }

        slice5 = {
            "slice_id": "SL-005",
            "slice_name": "主流类目-食品生鲜",
            "category": "食品饮料",
            "total_samples": 6000,
            "positive_samples": 5100,
            "negative_samples": 900,
            "recall": 0.90,
            "precision": 0.86,
            "source": "initial_import",
            "feature_snapshot_id": "FS-2024-001",
            "note": "正常类目，无特殊问题"
        }

        slices = []
        for s in [slice1, slice2, slice3, slice4, slice5]:
            slices.append(self.store.import_slice(s))

        return slices

    def generate_manual_correction(self):
        corrected_slice = {
            "slice_id": "SL-003-FIX",
            "slice_name": "长尾类目-古董收藏(人工修正)",
            "category": "收藏爱好",
            "total_samples": 800,
            "positive_samples": 520,
            "negative_samples": 280,
            "recall": 0.65,
            "precision": 0.72,
            "source": "manual_correction",
            "feature_snapshot_id": "FS-2024-002",
            "parent_slice_id": "SL-003",
            "note": "数据科学家林姐人工修正：关联长尾优化阈值快照，待回放"
        }
        return self.store.import_slice(corrected_slice)

    def generate_old_caliber_rerun(self):
        rerun_slice = {
            "slice_id": "SL-004-RERUN",
            "slice_name": "长尾类目-乐器配件(旧口径补录)",
            "category": "乐器",
            "total_samples": 500,
            "positive_samples": 300,
            "negative_samples": 200,
            "recall": 0.58,
            "precision": 0.68,
            "source": "rerun",
            "feature_snapshot_id": "FS-2023-045",
            "parent_slice_id": "SL-004",
            "note": "从特征快照FS-2023-045补来的旧口径，需阈值回放验证"
        }
        return self.store.import_slice(rerun_slice)

    def run_full_demo(self) -> dict:
        print("\n" + "=" * 70)
        print("     🚀 召 回 覆 盖 率 缺 口 分 析 - 完 整 演 示 流 程")
        print("=" * 70)

        self.store.clear_all()

        print("\n📌 步骤 1: 初始化特征快照库")
        snapshots = self.generate_feature_snapshots()
        print(f"   ✓ 已加载 {len(snapshots)} 个特征快照")
        for s in snapshots:
            print(f"     - {s.snapshot_id}: {s.snapshot_name}")

        print("\n📌 步骤 2: 第一次导入评测切片")
        initial_slices = self.generate_initial_slices()
        print(f"   ✓ 已导入 {len(initial_slices)} 条评测切片记录")
        for s in initial_slices:
            status = "✅ 已关联快照" if s.feature_snapshot_id else "⚠️  待补录快照"
            print(f"     - {s.slice_id}: {s.slice_name} {status}")

        print("\n📌 步骤 3: 执行召回覆盖率缺口分析")
        analyzer = CoverageAnalyzer()
        gap_records = analyzer.analyze(initial_slices)
        for gap in gap_records:
            self.store.save_gap_record(gap)

        report = analyzer.generate_report(gap_records, initial_slices)
        print(report["report_text"])

        print("\n📌 步骤 4: 数据科学家林姐补看特征快照编号")
        print("   🔍 林姐发现 SL-003 和 SL-004 缺少特征快照关联")
        print("   📝 林姐补录操作:")

        self.store.update_slice_feature_snapshot("SL-003", "FS-2024-002")
        print(f"     ✓ SL-003 → 关联 FS-2024-002 (长尾优化阈值)")

        self.store.update_slice_feature_snapshot("SL-004", "FS-2023-045")
        print(f"     ✓ SL-004 → 关联 FS-2023-045 (旧口径阈值)")

        manual_slice = self.generate_manual_correction()
        print(f"     ✓ 新增人工修正记录: {manual_slice.slice_id}")

        old_caliber_slice = self.generate_old_caliber_rerun()
        print(f"     ✓ 新增旧口径重跑记录: {old_caliber_slice.slice_id}")

        print("\n📌 步骤 5: 阈值回放更新")
        replay_engine = ThresholdReplayEngine(self.store)

        all_slices = self.store.list_slices()
        replay_results = []

        for slice_obj in all_slices:
            if slice_obj.feature_snapshot_id:
                is_old = slice_obj.feature_snapshot_id == "FS-2023-045"
                replay = replay_engine.replay_with_snapshot(
                    slice_obj.slice_id,
                    slice_obj.feature_snapshot_id,
                    is_old_caliber=is_old,
                    note=f"自动回放: {slice_obj.slice_name}"
                )
                if replay:
                    replay_results.append(replay)

        print(f"   ✓ 已执行 {len(replay_results)} 次阈值回放")

        replay_report = replay_engine.generate_replay_report(replay_results, all_slices)
        print(replay_report)

        print("\n📌 步骤 6: 更新缺口分析状态（回放后）")
        all_gaps = self.store.list_gap_records()
        updated_slices = self.store.list_slices()
        new_gap_records = analyzer.analyze(updated_slices)

        final_report = analyzer.generate_report(new_gap_records, updated_slices)
        print("\n" + final_report["report_text"])

        print("\n🎯 三种典型场景总结:")
        print("   1️⃣  顺利记录 (如 SL-001 手机数码): 召回率达标，总指标可靠")
        print("   2️⃣  少数类被总指标盖住 (如 SL-003 古董收藏): 总召回率89%，但该类只有65%，")
        print("      已标记为 NEED_REVIEW，留给算法工程师复核，不急于归正常")
        print("   3️⃣  旧口径补录 (如 SL-004 乐器配件): 从 FS-2023-045 补来，")
        print("      阈值回放在旧口径下验证，状态标记为 OLD_CALIBER")

        print("\n✅ 演示流程完成！")
        print("=" * 70 + "\n")

        return {
            "snapshots": snapshots,
            "initial_slices": initial_slices,
            "gap_records": gap_records,
            "replay_results": replay_results,
            "final_report": final_report
        }
