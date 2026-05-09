import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from graders.config import EXPORT_DIR
from graders.models import ReviewStatus


class ResultExporter:
    def __init__(self, batch_manager):
        self.batch_manager = batch_manager
    
    def export_to_csv(self, batch_id: str) -> Optional[str]:
        results = self.batch_manager.get_batch_results(batch_id)
        if not results:
            return None
        
        export_path = EXPORT_DIR / f"results_{batch_id}.csv"
        
        fieldnames = [
            "样本编号", "叶片面积(cm²)", "病斑面积(cm²)", "病斑颜色",
            "病斑比例", "病斑颜色分类", "褐色指数", "黄色指数",
            "规则分级", "规则得分", "人工复核状态", "最终分级",
            "复核人", "复核时间", "复核意见", "版本号"
        ]
        
        with open(export_path, mode='w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for sample_id, result_data in sorted(results.items()):
                raw_sample = result_data.get('raw_sample', {})
                features = result_data.get('features', {})
                area_features = features.get('area_features', {})
                color_features = features.get('color_features', {})
                rule_grade = result_data.get('rule_grade', {})
                review_info = result_data.get('review_info', {})
                
                row = {
                    "样本编号": sample_id,
                    "叶片面积(cm²)": raw_sample.get('leaf_area_cm2', ''),
                    "病斑面积(cm²)": raw_sample.get('lesion_area_cm2', ''),
                    "病斑颜色": raw_sample.get('lesion_color', ''),
                    "病斑比例": f"{area_features.get('lesion_ratio', 0)*100:.2f}%" if area_features.get('lesion_ratio') else '',
                    "病斑颜色分类": color_features.get('color_category', ''),
                    "褐色指数": f"{color_features.get('brown_index', 0):.2f}" if color_features.get('brown_index') else '',
                    "黄色指数": f"{color_features.get('yellow_index', 0):.2f}" if color_features.get('yellow_index') else '',
                    "规则分级": rule_grade.get('grade', ''),
                    "规则得分": f"{rule_grade.get('score', 0):.2f}" if rule_grade.get('score') else '',
                    "人工复核状态": result_data.get('review_status', ReviewStatus.PENDING.value),
                    "最终分级": result_data.get('final_grade', '') or '',
                    "复核人": review_info.get('reviewer_id', '') if review_info else '',
                    "复核时间": review_info.get('reviewed_at', '') if review_info else '',
                    "复核意见": review_info.get('comment', '') if review_info else '',
                    "版本号": result_data.get('version', 1)
                }
                writer.writerow(row)
        
        return str(export_path)
    
    def export_summary(self, batch_id: str) -> Optional[str]:
        results = self.batch_manager.get_batch_results(batch_id)
        state = self.batch_manager.get_batch_state(batch_id)
        if not results:
            return None
        
        summary_path = EXPORT_DIR / f"summary_{batch_id}.txt"
        
        stats = state.get('review_stats', {}) if state else {}
        
        grade_distribution = {
            "轻度": 0, "中度": 0, "严重": 0, "极严重": 0
        }
        
        for result_data in results.values():
            final_grade = result_data.get('final_grade')
            rule_grade = result_data.get('rule_grade', {}).get('grade')
            
            grade = final_grade or rule_grade
            if grade in grade_distribution:
                grade_distribution[grade] += 1
        
        lines = []
        lines.append("=" * 60)
        lines.append("小麦病斑样本分级报告")
        lines.append("=" * 60)
        lines.append("")
        lines.append(f"批次编号：{batch_id}")
        lines.append(f"报告生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("-" * 40)
        lines.append("一、处理统计")
        lines.append("-" * 40)
        lines.append(f"总样本数：{len(results)}")
        lines.append(f"待复核：{stats.get('pending', 0)}")
        lines.append(f"已确认：{stats.get('approved', 0)}")
        lines.append(f"已驳回：{stats.get('rejected', 0)}")
        lines.append(f"已修正：{stats.get('modified', 0)}")
        lines.append("")
        lines.append("-" * 40)
        lines.append("二、病情分布")
        lines.append("-" * 40)
        for grade, count in grade_distribution.items():
            percentage = count / len(results) * 100 if len(results) > 0 else 0
            lines.append(f"{grade}：{count} 个样本 ({percentage:.1f}%)")
        lines.append("")
        lines.append("-" * 40)
        lines.append("三、样本详情")
        lines.append("-" * 40)
        
        for sample_id, result_data in sorted(results.items()):
            rule_grade = result_data.get('rule_grade', {})
            features = result_data.get('features', {})
            area_features = features.get('area_features', {})
            color_features = features.get('color_features', {})
            review_status = result_data.get('review_status', ReviewStatus.PENDING.value)
            final_grade = result_data.get('final_grade')
            rule_score = rule_grade.get('score', 0)
            
            lines.append(f"")
            lines.append(f"【{sample_id}】")
            lines.append(f"  病斑比例：{area_features.get('lesion_ratio', 0)*100:.2f}%")
            lines.append(f"  病斑颜色：{color_features.get('color_category', '')}")
            lines.append(f"  规则分级：{rule_grade.get('grade', '')} (得分：{rule_score:.2f})")
            lines.append(f"  复核状态：{review_status}")
            if final_grade:
                lines.append(f"  最终分级：{final_grade}")
            if result_data.get('review_info'):
                review = result_data['review_info']
                lines.append(f"  复核意见：{review.get('comment', '')}")
        
        with open(summary_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(lines))
        
        return str(summary_path)
    
    def export_full_report(self, batch_id: str) -> Dict:
        csv_path = self.export_to_csv(batch_id)
        summary_path = self.export_summary(batch_id)
        
        return {
            'csv_path': csv_path,
            'summary_path': summary_path
        }
