"""样本标注返工系统 - 使用示例"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from annotation_rework.storage import AnnotationStore
from annotation_rework.importer import AnnotationImporter, LabelMapper
from annotation_rework.version_diff import VersionDiffer
from annotation_rework.anomaly_detector import AnomalyDetector
from annotation_rework.workflow import AnnotationWorkflow, ReviewAction
from annotation_rework.exporter import AnnotationExporter
from annotation_rework.models import LabelMapping, ExportConfig, AnomalyType


def create_sample_data():
    """创建示例数据"""
    
    v1_data = [
        {"id": "s001", "text": "这个产品质量很好", "labels": ["positive"], "split": "train", "confidence": 0.95},
        {"id": "s002", "text": "非常不满意，退款", "labels": ["negative"], "split": "train", "confidence": 0.88},
        {"id": "s003", "text": "还可以，一般般", "labels": ["neutral"], "split": "test", "confidence": 0.72},
        {"id": "s004", "text": "推荐购买", "labels": ["positive"], "split": "test", "confidence": 0.91},
        {"id": "s005", "text": "这个产品质量很好", "labels": ["negative"], "split": "train", "confidence": 0.55},
        {"id": "s006", "text": "还没使用，不清楚", "labels": [], "split": "val", "confidence": 0.30},
    ]
    
    v2_data = [
        {"id": "s001", "text": "这个产品质量很好", "labels": ["好评"], "split": "train", "confidence": 0.95},
        {"id": "s002", "text": "非常不满意，退款", "labels": ["差评"], "split": "train", "confidence": 0.88},
        {"id": "s003", "text": "还可以，一般般", "labels": ["中性"], "split": "test", "confidence": 0.72},
        {"id": "s007", "text": "新产品体验不错", "labels": ["好评"], "split": "train", "confidence": 0.82},
        {"id": "s005", "text": "这个产品质量很好", "labels": ["好评"], "split": "train", "confidence": 0.55},
    ]
    
    os.makedirs("./test_data", exist_ok=True)
    with open("./test_data/v1_samples.json", "w", encoding="utf-8") as f:
        json.dump(v1_data, f, ensure_ascii=False, indent=2)
    with open("./test_data/v2_samples.json", "w", encoding="utf-8") as f:
        json.dump(v2_data, f, ensure_ascii=False, indent=2)
    
    print("✅ 示例数据已创建")


def run_full_workflow():
    """运行完整工作流示例"""
    
    print("\n" + "="*60)
    print("  样本标注返工系统 - 完整工作流演示")
    print("="*60)
    
    store = AnnotationStore(base_path="./data_demo")
    importer = AnnotationImporter(store)
    mapper = LabelMapper(store)
    differ = VersionDiffer(store)
    detector = AnomalyDetector(store)
    workflow = AnnotationWorkflow(store)
    exporter = AnnotationExporter(store)
    
    print("\n📦 Step 1: 创建版本并导入V1数据")
    v1_id = importer.create_version("情感标注_v1", "第一版情感分析标注数据",
                                    metric_schema={"confidence": "float", "agreement": "float"})
    count, warnings = importer.import_from_json("./test_data/v1_samples.json", v1_id, label_field="labels")
    print(f"   版本ID: {v1_id}")
    print(f"   导入样本: {count} 条")
    if warnings:
        print(f"   警告: {warnings}")
    
    print("\n🔍 Step 2: V1异常检测")
    results = detector.run_all_checks(v1_id)
    print(f"   检测结果: {results}")
    summary = detector.get_anomaly_summary(v1_id)
    print(f"   待确认样本: {summary['needs_confirmation_count']} 条")
    for anomaly_type, samples in summary['anomaly_samples'].items():
        print(f"   - {anomaly_type}: {samples}")
    
    print("\n👀 Step 3: 获取待复核样本")
    needs_review = workflow.get_samples_for_review(v1_id)
    print(f"   待复核样本数: {len(needs_review)}")
    for s in needs_review[:3]:
        print(f"   - {s.sample_id}: {s.status.value}, 异常: {[a.value for a in s.anomalies]}")
    
    print("\n✏️ Step 4: 复核样本")
    sample_to_fix = needs_review[0].sample_id if needs_review else "s006"
    result = workflow.review_sample(
        version_id=v1_id,
        sample_id=sample_to_fix,
        action=ReviewAction.CORRECT,
        new_labels=["neutral"],
        reviewer="算法同学A",
        comment="补充缺失的中性标签"
    )
    if result:
        print(f"   样本 {sample_to_fix} 复核完成")
        print(f"   新状态: {result.status.value}")
        print(f"   新标签: {result.labels}")
    
    print("\n📋 Step 5: 查看样本历史")
    history = workflow.get_sample_review_history(sample_to_fix)
    print(f"   复核历史记录: {len(history)} 条")
    for h in history:
        print(f"   - {h['created_at'][:19]}: {h['old_status']} → {h['new_status']} ({h.get('reviewer')})")
    
    print("\n📦 Step 6: 导入V2数据（模拟标签口径变化）")
    v2_id = importer.create_version("情感标注_v2", "第二版，标签口径变更",
                                    metric_schema={"confidence": "float", "reviewer_score": "float"})
    count, warnings = importer.import_from_json("./test_data/v2_samples.json", v2_id, label_field="labels")
    print(f"   版本ID: {v2_id}")
    print(f"   导入样本: {count} 条")
    
    print("\n🔄 Step 7: 设置标签映射并应用")
    mappings = [
        LabelMapping(source_label="好评", target_label="positive"),
        LabelMapping(source_label="差评", target_label="negative"),
        LabelMapping(source_label="中性", target_label="neutral"),
    ]
    mapper.set_label_mappings(v2_id, mappings)
    updated, map_warnings = mapper.apply_mappings(v2_id)
    print(f"   映射更新: {updated} 条")
    if map_warnings:
        print(f"   映射警告: {map_warnings}")
    
    print("\n📊 Step 8: V1 vs V2 版本对比")
    diff = differ.compare_versions(v1_id, v2_id)
    print(f"   总变更: {diff.total_changes}")
    print(f"   新增样本: {len(diff.new_samples)}")
    print(f"   移除样本: {len(diff.removed_samples)}")
    print("\n   详细变更:")
    for change in diff.changes[:5]:
        print(f"   - [{change.change_type.value}] {change.sample_id}: {change.explanation}")
    
    print("\n⚠️ Step 9: 标记版本冲突")
    marked = differ.mark_version_conflicts(v2_id, v1_id)
    print(f"   标记冲突样本: {marked} 条")
    
    print("\n🔍 Step 10: V2异常检测")
    results = detector.run_all_checks(v2_id)
    print(f"   检测结果: {results}")
    
    print("\n📈 Step 11: V2工作流摘要")
    summary = workflow.get_workflow_summary(v2_id)
    print(f"   总样本: {summary['total_samples']}")
    print(f"   确认率: {summary['confirmed_rate']}%")
    print(f"   待确认: {summary['needs_confirmation']}")
    print(f"   状态分布: {summary['status_counts']}")
    
    print("\n💾 Step 12: 导出V2数据")
    os.makedirs("./exports", exist_ok=True)
    export_config = ExportConfig(
        include_anomalies=True,
        include_history=True,
        consistency_check=True,
        format="json"
    )
    export_result = exporter.export_samples(v2_id, "./exports/v2_export.json", export_config)
    print(f"   导出总数: {export_result.total_samples}")
    print(f"   实际导出: {export_result.exported_samples}")
    print(f"   含异常: {export_result.anomalies_included}")
    print(f"   一致性评分: {export_result.consistency_score:.2f}")
    if export_result.warnings:
        print(f"   导出警告: {export_result.warnings}")
    
    print("\n✅ Step 13: 验证导出一致性")
    verify_result = exporter.verify_export_consistency("./exports/v2_export.json")
    print(f"   验证通过: {verify_result['valid']}")
    print(f"   样本数: {verify_result['sample_count']}")
    print(f"   哈希匹配: {verify_result['hash_match']}")
    
    print("\n" + "="*60)
    print("  ✅ 工作流演示完成！")
    print("="*60)
    print(f"\n数据存储位置: ./data_demo/")
    print(f"导出文件位置: ./exports/")
    print(f"\n启动API服务: python -m uvicorn annotation_rework.api:app --reload")
    print(f"API文档: http://localhost:8000/docs")


if __name__ == "__main__":
    create_sample_data()
    run_full_workflow()
