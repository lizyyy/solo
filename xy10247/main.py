#!/usr/bin/env python3
import sys
from datetime import datetime

from graders.sample_data import generate_sample_data, save_sample_data_to_csv
from graders.importer import SampleImporter, BatchManager
from graders.feature_extractor import FeatureExtractor
from graders.rule_grader import RuleGrader
from graders.reviewer import ReviewManager
from graders.exporter import ResultExporter
from graders.models import SeverityLevel


def run_full_pipeline():
    print("=" * 60)
    print("小麦病斑样本分级器 - 样例运行")
    print("=" * 60)
    
    print("\n[步骤 1] 生成样例数据...")
    samples = generate_sample_data()
    print(f"  生成了 {len(samples)} 个样本")
    
    temp_batch_id = "demo"
    csv_path = save_sample_data_to_csv(samples, temp_batch_id)
    print(f"  数据已保存到: {csv_path}")
    
    print("\n[步骤 2] 导入数据并创建批次...")
    batch_manager = BatchManager()
    batch_id = batch_manager.get_or_create_batch(csv_path)
    print(f"  批次编号: {batch_id}")
    
    imported_samples = SampleImporter.import_from_csv(csv_path)
    print(f"  成功导入 {len(imported_samples)} 个样本")
    
    existing_results = batch_manager.get_batch_results(batch_id)
    if existing_results:
        print(f"  发现已处理结果，复用现有数据...")
        results = existing_results
    else:
        results = {}
    
    print("\n[步骤 3] 特征提取...")
    feature_extractor = FeatureExtractor()
    
    for sample in imported_samples:
        if sample.sample_id in results and results[sample.sample_id].get('features'):
            continue
        
        features = feature_extractor.extract(sample)
        print(f"  {sample.sample_id}: 病斑比例 {features.area_features.lesion_ratio:.2%}, "
              f"颜色 {features.color_features.color_category}")
        
        if sample.sample_id not in results:
            results[sample.sample_id] = {
                'raw_sample': {
                    'sample_id': sample.sample_id,
                    'leaf_area_cm2': sample.leaf_area_cm2,
                    'lesion_area_cm2': sample.lesion_area_cm2,
                    'lesion_color': sample.lesion_color,
                    'collected_at': sample.collected_at,
                    'technician_id': sample.technician_id,
                    'field_id': sample.field_id,
                },
                'review_status': '待复核',
                'final_grade': None,
                'version': 1
            }
        
        results[sample.sample_id]['features'] = {
            'sample_id': features.sample_id,
            'area_features': {
                'lesion_area_cm2': features.area_features.lesion_area_cm2,
                'leaf_area_cm2': features.area_features.leaf_area_cm2,
                'lesion_ratio': features.area_features.lesion_ratio
            },
            'color_features': {
                'r': features.color_features.r,
                'g': features.color_features.g,
                'b': features.color_features.b,
                'h': features.color_features.h,
                's': features.color_features.s,
                'v': features.color_features.v,
                'color_category': features.color_features.color_category,
                'brown_index': features.color_features.brown_index,
                'yellow_index': features.color_features.yellow_index
            },
            'extracted_at': features.extracted_at
        }
        results[sample.sample_id]['processed_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    batch_manager.save_batch_results(batch_id, results)
    
    print("\n[步骤 4] 规则分级...")
    rule_grader = RuleGrader()
    
    for sample_id, result_data in results.items():
        if result_data.get('rule_grade'):
            continue
        
        features = result_data['features']
        from graders.models import ExtractedFeatures, AreaFeature, ColorFeature
        
        feature_obj = ExtractedFeatures(
            sample_id=features['sample_id'],
            area_features=AreaFeature(**features['area_features']),
            color_features=ColorFeature(**features['color_features']),
            extracted_at=features['extracted_at']
        )
        
        rule_result = rule_grader.grade(feature_obj)
        print(f"\n  {sample_id}:")
        print(f"    规则分级: {rule_result.grade.value}")
        print(f"    得分: {rule_result.score:.2f}")
        print(f"    理由:")
        for line in rule_result.explanation.split('\n'):
            print(f"      {line}")
        
        result_data['rule_grade'] = {
            'grade': rule_result.grade.value,
            'score': rule_result.score,
            'rules_applied': rule_result.rules_applied,
            'explanation': rule_result.explanation
        }
    
    batch_manager.save_batch_results(batch_id, results)
    
    print("\n[步骤 5] 人工复核模拟...")
    reviewer = ReviewManager(batch_manager)
    
    pending = reviewer.list_pending(batch_id)
    print(f"  待复核样本: {len(pending)} 个")
    
    for p in pending[:3]:
        print(f"\n  复核样本 {p['sample_id']}:")
        print(f"    规则分级: {p['rule_grade']} (得分 {p['rule_score']:.2f})")
        print(f"    病斑比例: {p['lesion_ratio']:.2%}, 颜色: {p['lesion_color']}")
        print(f"    操作: 确认规则结果")
        
        reviewer.approve(batch_id, p['sample_id'], "REVIEWER001", "规则分级准确")
    
    if len(pending) > 3:
        p = pending[3]
        print(f"\n  复核样本 {p['sample_id']}:")
        print(f"    规则分级: {p['rule_grade']}")
        print(f"    操作: 修正分级（轻度改为中度）")
        
        reviewer.modify(batch_id, p['sample_id'], "REVIEWER001", 
                       SeverityLevel.MODERATE, "考虑到植株整体情况，病情实际上更严重")
    
    if len(pending) > 4:
        p = pending[4]
        print(f"\n  复核样本 {p['sample_id']}:")
        print(f"    规则分级: {p['rule_grade']}")
        print(f"    操作: 驳回（需要进一步检查）")
        
        reviewer.reject(batch_id, p['sample_id'], "REVIEWER001", 
                       "该样本病斑特征不典型，需要重新采集数据")
    
    state = batch_manager.get_batch_state(batch_id)
    if state and 'review_stats' in state:
        stats = state['review_stats']
        print(f"\n  复核统计: 总{stats['total']} | 待复核{stats['pending']} | "
              f"已确认{stats['approved']} | 已修正{stats['modified']} | 已驳回{stats['rejected']}")
    
    print("\n[步骤 6] 导出结果...")
    exporter = ResultExporter(batch_manager)
    export_result = exporter.export_full_report(batch_id)
    
    print(f"  CSV结果: {export_result['csv_path']}")
    print(f"  汇总报告: {export_result['summary_path']}")
    
    print("\n" + "=" * 60)
    print("运行完成！")
    print("=" * 60)
    print(f"\n批次编号: {batch_id}")
    print(f"样例数据: {csv_path}")
    print(f"CSV结果: {export_result['csv_path']}")
    print(f"汇总报告: {export_result['summary_path']}")
    print("\n请查看 exports/ 目录下的输出文件。")
    
    return batch_id


def show_batch_status(batch_id: str):
    from graders.importer import BatchManager
    from graders.reviewer import ReviewManager
    
    batch_manager = BatchManager()
    state = batch_manager.get_batch_state(batch_id)
    results = batch_manager.get_batch_results(batch_id)
    
    if not state or not results:
        print(f"未找到批次 {batch_id}")
        return
    
    print(f"\n批次状态: {batch_id}")
    print(f"总样本数: {len(results)}")
    
    if 'review_stats' in state:
        stats = state['review_stats']
        print(f"\n复核统计:")
        print(f"  待复核: {stats['pending']}")
        print(f"  已确认: {stats['approved']}")
        print(f"  已修正: {stats['modified']}")
        print(f"  已驳回: {stats['rejected']}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        if sys.argv[1] == "status" and len(sys.argv) > 2:
            show_batch_status(sys.argv[2])
        else:
            print("用法: python main.py              运行完整样例")
            print("     python main.py status <批次号>  查看批次状态")
    else:
        run_full_pipeline()
