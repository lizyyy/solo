from datetime import datetime
from typing import List, Dict, Optional
from pathlib import Path

from bend_checker.models.part import Part
from bend_checker.geometry.unfold import UnfoldResult
from bend_checker.geometry.sequence import SequenceResult
from bend_checker.rules.interference import InterferenceResult
from bend_checker.rules.tonnage import TonnageResult
from bend_checker.rules.hole_distance import HoleDistanceResult
from bend_checker.rules.duplicate import DuplicateResult


class MarkdownReporter:
    
    @staticmethod
    def generate_full_report(
        parts: List[Part],
        unfold_results: Dict[str, UnfoldResult],
        sequence_results: Dict[str, SequenceResult],
        interference_results: Dict[str, InterferenceResult],
        tonnage_results: Dict[str, TonnageResult],
        hole_results: Dict[str, HoleDistanceResult],
        duplicate_result: Optional[DuplicateResult] = None,
        workshop_info: Optional[Dict] = None
    ) -> str:
        lines = []
        
        lines.append("# 折弯展开复核报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        if workshop_info:
            lines.append("## 车间配置信息")
            lines.append("")
            lines.append(f"- **车间名称**: {workshop_info.get('workshop_name', '未配置')}")
            lines.append(f"- **材料种类**: {workshop_info.get('num_materials', 0)}")
            lines.append(f"- **设备数量**: {workshop_info.get('num_machines', 0)}")
            lines.append(f"- **模具数量**: {workshop_info.get('num_dies', 0)}")
            lines.append("")
        
        total_parts = len(parts)
        parts_with_issues = sum(
            1 for p in parts 
            if (interference_results.get(p.part_number) and interference_results[p.part_number].has_issues) or
               (tonnage_results.get(p.part_number) and tonnage_results[p.part_number].warnings) or
               (hole_results.get(p.part_number) and hole_results[p.part_number].has_risks)
        )
        
        lines.append("## 概览")
        lines.append("")
        lines.append(f"- **零件总数**: {total_parts}")
        lines.append(f"- **存在问题零件**: {parts_with_issues}")
        lines.append(f"- **无问题零件**: {total_parts - parts_with_issues}")
        lines.append("")
        
        if duplicate_result and duplicate_result.duplicates_found > 0:
            lines.append("## 重复零件检测")
            lines.append("")
            lines.append(f"发现 **{duplicate_result.duplicates_found}** 个重复零件")
            lines.append("")
            
            for group in duplicate_result.duplicate_groups:
                lines.append(f"### 零件组: {group.group_id}")
                lines.append("")
                lines.append(f"- **代表零件**: {group.representative_part}")
                lines.append(f"- **重复零件**: {', '.join(group.duplicate_parts)}")
                lines.append(f"- **总数量**: {group.total_quantity}")
                lines.append(f"- **相似度**: {group.similarity_score * 100:.0f}%")
                if group.key_differences:
                    lines.append(f"- **差异**: {', '.join(group.key_differences)}")
                lines.append("")
        
        lines.append("## 零件详情")
        lines.append("")
        
        for part in parts:
            lines.append(f"### 零件: {part.part_number} ({part.part_name})")
            lines.append("")
            
            lines.append("#### 基本信息")
            lines.append("")
            lines.append(f"- **材料**: {part.material_grade}")
            lines.append(f"- **厚度**: {part.material_thickness} mm")
            lines.append(f"- **数量**: {part.quantity}")
            if part.overall_length > 0:
                lines.append(f"- **外形尺寸**: {part.overall_length} x {part.overall_width} mm")
            lines.append("")
            
            unfold_result = unfold_results.get(part.part_number)
            if unfold_result:
                lines.append("#### 展开计算结果")
                lines.append("")
                lines.append(f"- **展开长度**: {unfold_result.unfolded_length} mm")
                lines.append(f"- **展开宽度**: {unfold_result.unfolded_width} mm")
                lines.append(f"- **总折弯扣除**: {unfold_result.total_bend_deduction} mm")
                lines.append("")
                
                if unfold_result.k_factors_used:
                    lines.append("##### K因子使用情况")
                    lines.append("")
                    for bend_id, k_factor in unfold_result.k_factors_used.items():
                        lines.append(f"- 折弯 {bend_id}: K = {k_factor}")
                    lines.append("")
                
                if unfold_result.warnings:
                    lines.append("##### ⚠️ 警告")
                    lines.append("")
                    for warning in unfold_result.warnings:
                        lines.append(f"- {warning}")
                    lines.append("")
            
            sequence_result = sequence_results.get(part.part_number)
            if sequence_result and sequence_result.total_steps > 0:
                lines.append("#### 折弯顺序规划")
                lines.append("")
                lines.append(f"- **推荐顺序**: {' → '.join(sequence_result.recommended_sequence)}")
                lines.append(f"- **总步骤**: {sequence_result.total_steps}")
                lines.append("")
                
                if sequence_result.risks:
                    lines.append("##### ⚠️ 顺序风险")
                    lines.append("")
                    for risk in sequence_result.risks:
                        lines.append(f"- 步骤 {risk['step']} (折弯 {risk['bend_id']}): {risk['risk_level'].upper()}")
                        for desc in risk['description']:
                            lines.append(f"  - {desc}")
                    lines.append("")
            
            tonnage_result = tonnage_results.get(part.part_number)
            if tonnage_result:
                lines.append("#### 吨位计算结果")
                lines.append("")
                lines.append(f"- **总吨位**: {tonnage_result.total_tonnage} 吨 (含{tonnage_result.safety_factor_used}x安全系数)")
                lines.append("")
                
                if tonnage_result.per_bend_tonnage:
                    lines.append("##### 各折弯吨位")
                    lines.append("")
                    for bend_id, tonnage in tonnage_result.per_bend_tonnage.items():
                        lines.append(f"- 折弯 {bend_id}: {tonnage} 吨")
                    lines.append("")
                
                if tonnage_result.suitable_machines:
                    lines.append(f"- **推荐设备**: {', '.join(tonnage_result.suitable_machines)}")
                
                if tonnage_result.warnings:
                    lines.append("")
                    lines.append("##### ⚠️ 吨位警告")
                    lines.append("")
                    for warning in tonnage_result.warnings:
                        lines.append(f"- {warning}")
                lines.append("")
            
            interference_result = interference_results.get(part.part_number)
            if interference_result:
                lines.append("#### 干涉检查结果")
                lines.append("")
                
                if interference_result.has_issues:
                    lines.append(f"**发现 {len(interference_result.issues)} 个问题**")
                    lines.append("")
                    for issue in interference_result.issues:
                        lines.append(f"- **{issue.severity.upper()}** [{issue.issue_type.value}]: {issue.description}")
                        lines.append(f"  - 影响折弯: {', '.join(issue.affected_bends)}")
                        lines.append(f"  - 建议: {issue.suggested_fix}")
                else:
                    lines.append("✅ 未发现干涉问题")
                
                lines.append("")
                
                if interference_result.warnings:
                    lines.append("##### ⚠️ 警告")
                    lines.append("")
                    for warning in interference_result.warnings:
                        lines.append(f"- {warning}")
                    lines.append("")
            
            hole_result = hole_results.get(part.part_number)
            if hole_result and len(part.holes) > 0:
                lines.append("#### 孔边距检查结果")
                lines.append("")
                
                lines.append(f"- **总孔数**: {len(part.holes)}")
                lines.append(f"- **安全孔**: {hole_result.safe_holes}")
                lines.append(f"- **风险孔**: {hole_result.at_risk_holes}")
                lines.append("")
                
                if hole_result.has_risks:
                    lines.append("##### ⚠️ 孔边距风险")
                    lines.append("")
                    for issue in hole_result.issues:
                        lines.append(f"- **{issue.risk_level.value.upper()}**: {issue.description}")
                        lines.append(f"  - 建议: {issue.suggestion}")
                else:
                    lines.append("✅ 所有孔边距符合要求")
                
                lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*报告由折弯展开复核器生成*")
        
        return "\n".join(lines)
    
    @staticmethod
    def write_report(
        output_path: str,
        parts: List[Part],
        unfold_results: Dict[str, UnfoldResult],
        sequence_results: Dict[str, SequenceResult],
        interference_results: Dict[str, InterferenceResult],
        tonnage_results: Dict[str, TonnageResult],
        hole_results: Dict[str, HoleDistanceResult],
        duplicate_result: Optional[DuplicateResult] = None,
        workshop_info: Optional[Dict] = None
    ) -> bool:
        try:
            content = MarkdownReporter.generate_full_report(
                parts=parts,
                unfold_results=unfold_results,
                sequence_results=sequence_results,
                interference_results=interference_results,
                tonnage_results=tonnage_results,
                hole_results=hole_results,
                duplicate_result=duplicate_result,
                workshop_info=workshop_info
            )
            
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(content)
            
            return True
        except Exception:
            return False
    
    @staticmethod
    def generate_summary_table(parts: List[Part], results: Dict[str, Dict]) -> str:
        lines = []
        lines.append("# 复核结果摘要")
        lines.append("")
        lines.append("| 零件号 | 材料 | 厚度(mm) | 折弯数 | 展开长度(mm) | 吨位(吨) | 状态 |")
        lines.append("|--------|------|----------|--------|--------------|----------|------|")
        
        for part in parts:
            part_results = results.get(part.part_number, {})
            status = "✅"
            
            unfold_len = part_results.get('unfolded_length', '-')
            tonnage = part_results.get('total_tonnage', '-')
            
            if part_results.get('has_issues', False):
                status = "⚠️"
            if part_results.get('has_critical', False):
                status = "❌"
            
            lines.append(
                f"| {part.part_number} | {part.material_grade} | {part.material_thickness} | "
                f"{len(part.bends)} | {unfold_len} | {tonnage} | {status} |"
            )
        
        return "\n".join(lines)
