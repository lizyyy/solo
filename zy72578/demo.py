import json
from models import (
    MaterialType, ThresholdNote, OnlineExperimentBucket,
    WorkflowStep, ReviewStatus
)
from material_importer import MaterialImporter
from ensemble_vote_explainer import EnsembleVoteExplainer
from errors import FriendlyError


def print_separator(title=""):
    print("\n" + "=" * 78)
    if title:
        print(f"  {title}")
        print("=" * 78)


def print_result(result, show_batches=False, show_history=False):
    print(f"\n📊 模型：{result.model_name}")
    print(f"   最终阈值：{result.final_threshold:.4f}")
    if result.final_minority_threshold:
        print(f"   少数类阈值：{result.final_minority_threshold:.4f}")
    print(f"   置信度：{result.confidence:.2%}")
    print(f"   当前批次：第 {result.current_batch} 批")
    print(f"   工作流步骤：{result.workflow_step.value}")
    print(f"   审核状态：{result.review_status.value}")
    print(f"   少数类是否被掩盖：{'是 ⚠️' if result.is_minority_masked else '否'}")
    if result.export_trace_id:
        print(f"   导出追踪ID：{result.export_trace_id}")
    
    if result.conflict_evidences:
        print("\n   ❗ 冲突证据：")
        for i, conflict in enumerate(result.conflict_evidences, 1):
            print(f"   {i}. {conflict.description}")
    
    print("\n   🧪 自检结果：")
    for check in result.self_check_results:
        status = "✅ 通过" if check.passed else "❌ 未通过"
        print(f"   - {check.check_name}: {status}")
        print(f"     {check.message}")
    
    if show_batches and result.material_batches:
        print("\n   📦 历史批次明细：")
        for batch in result.material_batches:
            print(f"   - 第{batch.batch_number}批 | {batch.material_type.value} | "
                  f"笔记{len(batch.threshold_notes)}条 | "
                  f"实验桶{len(batch.experiment_buckets)}个 | "
                  f"导入时间：{batch.imported_at.strftime('%H:%M:%S')}")
    
    if show_history and result.change_history:
        print("\n   📜 阈值变更历史：")
        for i, record in enumerate(result.change_history, 1):
            old_val = f"{record.old_threshold:.4f}" if record.old_threshold is not None else "无"
            print(f"   [{i}] 批次{record.batch_number} | 来源：{record.change_source}")
            print(f"       操作人：{record.operator}")
            print(f"       阈值：{old_val} → {record.new_threshold:.4f}")
            print(f"       原因：{record.change_reason}")
            print(f"       影响：{', '.join(record.affected_items)}")


def demo_normal_workflow():
    print_separator("场景一：正常材料 + 完整三步工作流")
    
    importer = MaterialImporter()
    explainer = EnsembleVoteExplainer()
    
    print("\n📝 第一步：阈值调参笔记第一次导入（正常材料）")
    threshold_note = ThresholdNote(
        note_id="NOTE-001",
        model_name="ctr_model_v1",
        threshold=0.65,
        minority_threshold=0.45,
        imported_by="algorithm_zhang"
    )
    
    experiment_bucket = OnlineExperimentBucket(
        bucket_id="BUCKET-A",
        model_name="ctr_model_v1",
        threshold=0.65,
        minority_threshold=0.45,
        sample_count=5000,
        minority_sample_count=800,
        overall_metric=0.85,
        minority_metric=0.78
    )
    
    material = importer.import_material(
        material_id="MAT-001",
        material_type=MaterialType.NORMAL,
        model_name="ctr_model_v1",
        threshold_notes=[threshold_note],
        experiment_buckets=[experiment_bucket]
    )
    
    result = explainer.process_material(material)
    print_result(result, show_batches=True, show_history=True)
    
    print("\n👴 第二步：推荐策略老唐补看线上实验桶")
    result = explainer.tang_review_buckets("ctr_model_v1")
    print_result(result, show_history=True)
    
    print("\n🔄 第三步：阈值回放更新")
    result = explainer.update_threshold_playback(
        model_name="ctr_model_v1",
        new_threshold=0.66,
        new_minority_threshold=0.46,
        reason="线上效果校准，提升CTR目标"
    )
    print_result(result, show_history=True)
    
    print("\n📋 导出报告（可反查）：")
    report = explainer.export_report("ctr_model_v1")
    print(f"   模型：{report['模型名称']}")
    print(f"   导出追踪ID：{report['导出追踪ID']}")
    print(f"   当前批次：第{report['当前批次']}批")
    print(f"   阈值变更历史共 {len(report['阈值变更历史'])} 条")


def demo_conflict_scenario():
    print_separator("场景二：阈值调参笔记 vs 线上实验桶 冲突")
    
    importer = MaterialImporter()
    explainer = EnsembleVoteExplainer()
    
    print("\n📝 导入有冲突的材料（笔记0.7 vs 实验桶0.62）")
    threshold_note = ThresholdNote(
        note_id="NOTE-002",
        model_name="cvr_model_v2",
        threshold=0.70,
        minority_threshold=0.50
    )
    
    experiment_bucket = OnlineExperimentBucket(
        bucket_id="BUCKET-B",
        model_name="cvr_model_v2",
        threshold=0.62,
        minority_threshold=0.48,
        sample_count=3000,
        minority_sample_count=200,
        overall_metric=0.82,
        minority_metric=0.75
    )
    
    material = importer.import_material(
        material_id="MAT-002",
        material_type=MaterialType.NORMAL,
        model_name="cvr_model_v2",
        threshold_notes=[threshold_note],
        experiment_buckets=[experiment_bucket]
    )
    
    result = explainer.process_material(material)
    print_result(result, show_history=True)
    
    print("\n👴 老唐选择：驳回笔记阈值，以线上实验桶为准")
    print("   （系统只列出冲突证据，不自动拍板，由老唐确认/驳回）")
    result = explainer.tang_review_buckets(
        "cvr_model_v2",
        reject_conflicts=["NOTE-002"]
    )
    print_result(result, show_history=True)


def demo_minority_masked():
    print_separator("场景三：少数类样本被总指标盖住")
    
    importer = MaterialImporter()
    explainer = EnsembleVoteExplainer()
    
    print("\n📝 导入材料（少数类占比5%，总指标92%，少数类只有60%）")
    threshold_note = ThresholdNote(
        note_id="NOTE-003",
        model_name="fraud_model_v1",
        threshold=0.55
    )
    
    experiment_bucket = OnlineExperimentBucket(
        bucket_id="BUCKET-C",
        model_name="fraud_model_v1",
        threshold=0.55,
        sample_count=10000,
        minority_sample_count=500,
        overall_metric=0.92,
        minority_metric=0.60
    )
    
    material = importer.import_material(
        material_id="MAT-003",
        material_type=MaterialType.NORMAL,
        model_name="fraud_model_v1",
        threshold_notes=[threshold_note],
        experiment_buckets=[experiment_bucket]
    )
    
    result = explainer.process_material(material)
    print_result(result, show_history=True)
    
    print("\n💡 重点说明：")
    print("   1. 系统检测到少数类样本被总指标盖住（占比<10% 且 指标差>20%）")
    print("   2. 自动标记为【需算法工程师复核】，没有自动归为正常")
    print("   3. 留给算法工程师检查少数类阈值是否合理，不急着下结论")


def demo_supplement_material():
    print_separator("场景四：补录材料 + 合并历史重算（重点对齐场景）")
    
    importer = MaterialImporter()
    explainer = EnsembleVoteExplainer()
    
    # ── 第一阶段：首次导入（样例入口） ──
    print("\n📥 【第1批】样例入口：首次导入阈值调参笔记")
    print("   材料ID：MAT-004")
    print("   材料类型：正常材料")
    print("   阈值笔记：1条（NOTE-004，阈值=0.60）")
    print("   实验桶：0个（暂时没有线上数据）")
    
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
    
    print("\n   处理状态：第1批导入完成")
    print(f"   计算结果：阈值 = {result.final_threshold:.4f}（只有笔记1条：0.60）")
    print(f"   置信度：{result.confidence:.2%}（样本量不足，扣减）")
    
    # ── 第二阶段：补录材料 ──
    print("\n📥 【第2批】补录材料：新增线上实验桶数据")
    print("   材料ID：MAT-004（同一份材料，补录）")
    print("   材料类型：补录材料")
    print("   阈值笔记：0条")
    print("   实验桶：1个（BUCKET-D，阈值=0.58）")
    print("   ⚙️  系统会合并历史批次重算，不是只算当前批次")
    
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
    
    print("\n   处理状态：第2批补录完成，已合并历史重算")
    print(f"   计算结果：阈值 = {result.final_threshold:.4f}")
    print(f"   计算过程：(NOTE-004的0.60 + BUCKET-D的0.58) ÷ 2 = 0.59")
    print(f"   置信度：{result.confidence:.2%}（样本量充足，恢复）")
    
    # ── 第三阶段：明细刷新 ──
    print("\n🔍 【明细刷新】查看批次明细和阈值变更历史")
    print_result(result, show_batches=True, show_history=True)
    
    # ── 第四阶段：报告说明 ──
    print("\n📋 【报告说明】导出报告（可反查到同一条记录）")
    report = explainer.export_report("retention_model_v1")
    
    print(f"   模型名称：{report['模型名称']}")
    print(f"   当前批次：第{report['当前批次']}批")
    print(f"   最终阈值：{report['最终阈值']:.4f}")
    print(f"   审核状态：{report['审核状态']}")
    print(f"   工作流阶段：{report['工作流阶段']}")
    
    print("\n   历史批次明细：")
    for b in report['历史批次明细']:
        print(f"   - 第{b['批次号']}批 | {b['材料类型']} | "
              f"笔记{b['阈值笔记数']}条 | 实验桶{b['实验桶数']}个")
    
    print(f"\n   阈值变更历史：共 {len(report['阈值变更历史'])} 条")
    for h in report['阈值变更历史']:
        old = f"{h['旧阈值']:.4f}" if h['旧阈值'] is not None else "无"
        print(f"   [{h['序号']}] 批次{h['批次号']} | {h['变更来源']}")
        print(f"        操作人：{h['操作人']}")
        print(f"        阈值：{old} → {h['新阈值']:.4f}")
        print(f"        原因：{h['变更原因']}")
        print(f"        影响：{', '.join(h['影响项'])}")
    
    print("\n   💡 报告反查说明：")
    print("   - 每一条阈值变更都有变更ID和批次号，可追溯")
    print("   - 操作人、变更原因、影响项一一对应")
    print("   - 历史批次明细记录了每次导入的内容")
    print("   - 导出追踪ID可用于跨系统对账")


def demo_wrong_caliber():
    print_separator("场景五：错口径材料导入（用于跟踪）")
    
    importer = MaterialImporter()
    explainer = EnsembleVoteExplainer()
    
    print("\n📝 导入错口径材料（标记跟踪，不参与正式投票）")
    threshold_note = ThresholdNote(
        note_id="NOTE-005-WRONG",
        model_name="click_model_v1",
        threshold=0.75
    )
    
    material = importer.import_material(
        material_id="MAT-005",
        material_type=MaterialType.WRONG_CALIBER,
        model_name="click_model_v1",
        threshold_notes=[threshold_note],
        experiment_buckets=[]
    )
    
    result = explainer.process_material(material)
    print_result(result, show_batches=True, show_history=True)
    print("\n💡 注意：错口径材料会被完整记录批次和变更历史，可单独跟踪不影响主流程")


def demo_workflow_order():
    print_separator("场景六：工作流顺序校验（不能跳步）")
    
    importer = MaterialImporter()
    explainer = EnsembleVoteExplainer()
    
    threshold_note = ThresholdNote(
        note_id="NOTE-006",
        model_name="test_model",
        threshold=0.5
    )
    
    material = importer.import_material(
        material_id="MAT-006",
        material_type=MaterialType.NORMAL,
        model_name="test_model",
        threshold_notes=[threshold_note],
        experiment_buckets=[]
    )
    
    result = explainer.process_material(material)
    
    print("\n❌ 尝试跳过老唐审核，直接更新阈值回放：")
    try:
        result = explainer.update_threshold_playback("test_model", new_threshold=0.6)
    except FriendlyError as e:
        print(f"   {e}")
    
    print("\n✅ 正确的三步顺序：")
    print("   第一步：阈值调参笔记第一次导入")
    print("   第二步：推荐策略老唐补看线上实验桶")
    print("   第三步：阈值回放更新")
    print("   （跳步会报错，说人话告诉你该怎么走）")


if __name__ == "__main__":
    print("\n" + "🚀" * 39)
    print("            模型集成投票解释系统 DEMO（修复版）")
    print("🚀" * 39)
    
    demo_normal_workflow()
    demo_conflict_scenario()
    demo_minority_masked()
    demo_supplement_material()
    demo_wrong_caliber()
    demo_workflow_order()
    
    print_separator("修复总结 & 能力对齐")
    print("""
✅ 已修复的问题：
   1. 补录材料合并历史所有批次重算（0.60 + 0.58)÷2 = 0.59 ✓
   2. 区分本次导入和历史批次（每批有批次号、类型、导入内容）
   3. 补录后状态、明细、历史同步刷新（change_history 追加记录）
   4. 报告/导出可反查（导出追踪ID + 变更ID + 批次号三级追溯）

✅ 阈值回放历史增强：
   - 谁改的（操作人）
   - 改了什么（旧阈值 → 新阈值）
   - 为什么改（变更原因）
   - 改完影响了哪些结果（影响项）
   - 第几批改的（批次号）

✅ 场景四四段对齐：
   📥 样例入口  → 第1批正常材料导入，阈值0.60
   🔄 处理状态  → 第2批补录，合并历史重算为0.59
   🔍 明细刷新  → 批次明细+变更历史，完整可追溯
   📋 报告说明  → 导出报告，三级追踪，可反查同一条记录
    """)
