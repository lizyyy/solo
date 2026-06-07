from models import (
    MaterialType, ThresholdNote, OnlineExperimentBucket,
    WorkflowStep, ReviewStatus
)
from material_importer import MaterialImporter
from ensemble_vote_explainer import EnsembleVoteExplainer
from errors import FriendlyError


def print_separator(title=""):
    print("\n" + "=" * 70)
    if title:
        print(f"  {title}")
        print("=" * 70)


def print_result(result):
    print(f"\n📊 模型：{result.model_name}")
    print(f"   最终阈值：{result.final_threshold:.4f}")
    if result.final_minority_threshold:
        print(f"   少数类阈值：{result.final_minority_threshold:.4f}")
    print(f"   置信度：{result.confidence:.2%}")
    print(f"   工作流步骤：{result.workflow_step.value}")
    print(f"   审核状态：{result.review_status.value}")
    print(f"   少数类是否被掩盖：{'是 ⚠️' if result.is_minority_masked else '否'}")
    
    if result.conflict_evidences:
        print("\n   ❗ 冲突证据：")
        for i, conflict in enumerate(result.conflict_evidences, 1):
            print(f"   {i}. {conflict.description}")
    
    print("\n   🧪 自检结果：")
    for check in result.self_check_results:
        status = "✅ 通过" if check.passed else "❌ 未通过"
        print(f"   - {check.check_name}: {status}")
        if not check.passed:
            print(f"     {check.message}")


def demo_normal_workflow():
    print_separator("场景一：正常材料 + 完整三步工作流")
    
    importer = MaterialImporter()
    explainer = EnsembleVoteExplainer()
    
    print("\n📝 第一步：导入阈值调参笔记（正常材料）")
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
    print_result(result)
    
    print("\n👴 第二步：推荐策略老唐补看线上实验桶")
    result = explainer.tang_review_buckets("ctr_model_v1")
    print_result(result)
    
    print("\n🔄 第三步：阈值回放更新")
    result = explainer.update_threshold_playback(
        model_name="ctr_model_v1",
        new_threshold=0.66,
        new_minority_threshold=0.46
    )
    print_result(result)
    
    print("\n📜 阈值历史回放记录：")
    history = explainer.playback_validator.get_history("ctr_model_v1")
    for i, (th, minority, source) in enumerate(history, 1):
        print(f"   {i}. 阈值={th:.4f}, 少数类阈值={minority}, 来源={source}")


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
    print_result(result)
    
    print("\n👴 老唐选择：驳回笔记阈值，以线上实验桶为准")
    result = explainer.tang_review_buckets(
        "cvr_model_v2",
        reject_conflicts=["NOTE-002"]
    )
    print_result(result)


def demo_minority_masked():
    print_separator("场景三：少数类样本被总指标盖住")
    
    importer = MaterialImporter()
    explainer = EnsembleVoteExplainer()
    
    print("\n📝 导入材料（少数类占比5%，指标差30%）")
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
    print_result(result)
    print("\n💡 注意：系统自动标记为【需算法工程师复核】，没有自动归为正常")


def demo_supplement_material():
    print_separator("场景四：补录材料 + 自动重算")
    
    importer = MaterialImporter()
    explainer = EnsembleVoteExplainer()
    
    print("\n📝 第一次导入（正常材料）")
    threshold_note = ThresholdNote(
        note_id="NOTE-004",
        model_name="retention_model_v1",
        threshold=0.60
    )
    
    material1 = importer.import_material(
        material_id="MAT-004",
        material_type=MaterialType.NORMAL,
        model_name="retention_model_v1",
        threshold_notes=[threshold_note],
        experiment_buckets=[]
    )
    
    result = explainer.process_material(material1)
    print_result(result)
    
    print("\n📝 第二次导入（补录材料，新增实验桶数据）")
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
    print_result(result)
    print("\n💡 注意：阈值从0.60重算为0.59（笔记和实验桶的平均值）")


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
    print_result(result)
    print("\n💡 注意：错口径材料会被记录，但可以单独跟踪不影响主流程")


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


if __name__ == "__main__":
    print("\n" + "🚀" * 35)
    print("            模型集成投票解释系统 DEMO")
    print("🚀" * 35)
    
    demo_normal_workflow()
    demo_conflict_scenario()
    demo_minority_masked()
    demo_supplement_material()
    demo_wrong_caliber()
    demo_workflow_order()
    
    print_separator("总结")
    print("""
✅ 已覆盖的核心能力：
   1. 三种材料类型导入（正常/错口径/补录）
   2. 阈值回放与历史记录校验
   3. 阈值调参笔记 vs 线上实验桶 冲突检测
   4. 冲突时列出证据，等老唐确认/驳回，不自动拍板
   5. 四项基本自检（重复导入/少数类掩盖/补录重算/导出一致）
   6. 三步工作流严格顺序（导入→老唐看桶→阈值回放更新）
   7. 少数类样本被总指标盖住时，标记需算法复核，不急着归正常
   8. 所有错误提示说人话，带操作建议
    """)
