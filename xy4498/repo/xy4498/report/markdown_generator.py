from typing import List, Optional, Dict, Any
from datetime import datetime

from models import (
    KilnRun, KilnPosition, DefectRecord, ReviewConclusion,
    AnalysisResult, HeatingRate, InsulationDeviation,
    ThermalShockRisk, GlazeDefectAssociation
)


class MarkdownGenerator:
    """Markdown报告生成器"""
    
    def __init__(self):
        """初始化Markdown报告生成器"""
        self.report_content = []
    
    def generate_report(self,
                        kiln_run: KilnRun,
                        analysis_result: AnalysisResult,
                        include_details: bool = True) -> str:
        """
        生成完整的Markdown报告
        
        Args:
            kiln_run: 窑次记录
            analysis_result: 分析结果
            include_details: 是否包含详细信息
        
        Returns:
            Markdown格式的报告字符串
        """
        self.report_content = []
        
        self._add_header(kiln_run)
        self._add_summary(analysis_result)
        self._add_heating_rate_analysis(analysis_result)
        self._add_insulation_analysis(analysis_result)
        self._add_thermal_shock_analysis(analysis_result)
        self._add_glaze_defect_analysis(analysis_result)
        self._add_position_details(kiln_run, analysis_result)
        self._add_review_conclusions(kiln_run)
        self._add_footer()
        
        return '\n'.join(self.report_content)
    
    def _add_header(self, kiln_run: KilnRun):
        """添加报告标题"""
        self.report_content.append(f'# 窑炉烧成曲线复盘报告')
        self.report_content.append('')
        self.report_content.append(f'## 窑次基本信息')
        self.report_content.append('')
        self.report_content.append(f'- **窑次编号**: {kiln_run.id}')
        self.report_content.append(f'- **窑次名称**: {kiln_run.name}')
        
        if kiln_run.start_date:
            start_time = kiln_run.start_date.strftime('%Y-%m-%d %H:%M:%S')
            self.report_content.append(f'- **开始时间**: {start_time}')
        
        if kiln_run.end_date:
            end_time = kiln_run.end_date.strftime('%Y-%m-%d %H:%M:%S')
            self.report_content.append(f'- **结束时间**: {end_time}')
        
        self.report_content.append(f'- **窑位数量**: {len(kiln_run.kiln_positions)}')
        self.report_content.append(f'- **缺陷记录数**: {len(kiln_run.defect_records)}')
        self.report_content.append(f'- **复核结论数**: {len(kiln_run.review_conclusions)}')
        
        if kiln_run.notes:
            self.report_content.append(f'- **备注**: {kiln_run.notes}')
        
        self.report_content.append('')
    
    def _add_summary(self, analysis_result: AnalysisResult):
        """添加分析摘要"""
        self.report_content.append('## 分析摘要')
        self.report_content.append('')
        
        summary = analysis_result.summary
        
        overall_risk = summary.get('overall_risk', '未知')
        self.report_content.append(f'### 总体风险评估: **{overall_risk}**')
        self.report_content.append('')
        
        warnings = summary.get('warnings', [])
        if warnings:
            self.report_content.append('⚠️ **警告事项**:')
            self.report_content.append('')
            for warning in warnings:
                self.report_content.append(f'- {warning}')
            self.report_content.append('')
        
        hr_summary = summary.get('heating_rate', {})
        self.report_content.append('### 升温速率分析')
        self.report_content.append('')
        self.report_content.append(f'- 总分析段数: {hr_summary.get("total_segments", 0)}')
        self.report_content.append(f'- 异常段数: {hr_summary.get("unacceptable_count", 0)}')
        if hr_summary.get('avg_rate'):
            self.report_content.append(f'- 平均升温速率: {hr_summary["avg_rate"]:.2f} °C/分钟')
        if hr_summary.get('max_rate'):
            self.report_content.append(f'- 最大升温速率: {hr_summary["max_rate"]:.2f} °C/分钟')
        self.report_content.append('')
        
        ins_summary = summary.get('insulation', {})
        self.report_content.append('### 保温偏差分析')
        self.report_content.append('')
        self.report_content.append(f'- 总保温阶段数: {ins_summary.get("total_stages", 0)}')
        self.report_content.append(f'- 异常阶段数: {ins_summary.get("unacceptable_count", 0)}')
        self.report_content.append('')
        
        ts_summary = summary.get('thermal_shock', {})
        self.report_content.append('### 热冲击风险分析')
        self.report_content.append('')
        self.report_content.append(f'- 分析窑位数: {ts_summary.get("total_positions", 0)}')
        self.report_content.append(f'- 高风险窑位数: {ts_summary.get("high_risk_count", 0)}')
        by_risk = ts_summary.get('by_risk_level', {})
        if by_risk:
            self.report_content.append(f'- 风险分布: {by_risk}')
        self.report_content.append('')
        
        gd_summary = summary.get('glaze_defects', {})
        self.report_content.append('### 釉面缺陷分析')
        self.report_content.append('')
        self.report_content.append(f'- 总缺陷数: {gd_summary.get("total_defects", 0)}')
        by_type = gd_summary.get('by_type', {})
        if by_type:
            self.report_content.append(f'- 按缺陷类型分布: {by_type}')
        self.report_content.append('')
    
    def _add_heating_rate_analysis(self, analysis_result: AnalysisResult):
        """添加升温速率详细分析"""
        if not analysis_result.heating_rates:
            return
        
        self.report_content.append('## 升温速率详细分析')
        self.report_content.append('')
        
        self.report_content.append('| 时间区间 | 起始温度(°C) | 结束温度(°C) | 升温速率(°C/分钟) | 目标速率 | 偏差 | 状态 |')
        self.report_content.append('|---------|------------|------------|-----------------|--------|------|------|')
        
        for hr in analysis_result.heating_rates:
            status = '✅ 正常' if hr.is_acceptable else '⚠️ 异常'
            target = f'{hr.target_rate:.2f}' if hr.target_rate else '-'
            deviation = f'{hr.deviation:.2f}' if hr.deviation is not None else '-'
            
            self.report_content.append(
                f'| {hr.time_segment} | {hr.start_temp:.1f} | {hr.end_temp:.1f} | '
                f'{hr.rate:.2f} | {target} | {deviation} | {status} |'
            )
        
        self.report_content.append('')
    
    def _add_insulation_analysis(self, analysis_result: AnalysisResult):
        """添加保温偏差详细分析"""
        if not analysis_result.insulation_deviations:
            return
        
        self.report_content.append('## 保温偏差详细分析')
        self.report_content.append('')
        
        self.report_content.append('| 保温阶段 | 目标温度(°C) | 实际温度(°C) | 温度偏差(°C) | 目标时长(分钟) | 实际时长(分钟) | 时长偏差(分钟) | 状态 |')
        self.report_content.append('|---------|-------------|-------------|-------------|--------------|--------------|----------------|------|')
        
        for ins in analysis_result.insulation_deviations:
            status = '✅ 正常' if ins.is_acceptable else '⚠️ 异常'
            
            self.report_content.append(
                f'| {ins.insulation_stage} | {ins.target_temp:.1f} | {ins.actual_temp:.1f} | '
                f'{ins.temp_deviation:.1f} | {ins.target_duration:.1f} | {ins.actual_duration:.1f} | '
                f'{ins.duration_deviation:.1f} | {status} |'
            )
        
        self.report_content.append('')
    
    def _add_thermal_shock_analysis(self, analysis_result: AnalysisResult):
        """添加热冲击风险详细分析"""
        if not analysis_result.thermal_shock_risks:
            return
        
        self.report_content.append('## 热冲击风险详细分析')
        self.report_content.append('')
        
        self.report_content.append('| 窑位编码 | 风险等级 | 最大升温速率(°C/分钟) | 坯体厚度(cm) | 风险因素 |')
        self.report_content.append('|---------|---------|----------------------|------------|----------|')
        
        for tsr in analysis_result.thermal_shock_risks:
            risk_level_display = {
                '低': '🟢 低',
                '中': '🟡 中',
                '高': '🔴 高'
            }.get(tsr.risk_level, tsr.risk_level)
            
            risk_factors = '; '.join(tsr.risk_factors) if tsr.risk_factors else '-'
            thickness = f'{tsr.body_thickness:.1f}' if tsr.body_thickness else '-'
            
            self.report_content.append(
                f'| {tsr.position_code} | {risk_level_display} | {tsr.max_temp_change_rate:.2f} | '
                f'{thickness} | {risk_factors} |'
            )
        
        self.report_content.append('')
        
        high_risk = [tsr for tsr in analysis_result.thermal_shock_risks if tsr.risk_level == '高']
        if high_risk:
            self.report_content.append('### 高风险窑位建议')
            self.report_content.append('')
            for tsr in high_risk:
                self.report_content.append(f'#### 窑位: {tsr.position_code}')
                self.report_content.append('')
                if tsr.recommendation:
                    for line in tsr.recommendation.split('\n'):
                        self.report_content.append(f'{line}')
                self.report_content.append('')
    
    def _add_glaze_defect_analysis(self, analysis_result: AnalysisResult):
        """添加釉面缺陷关联详细分析"""
        if not analysis_result.glaze_defect_associations:
            return
        
        self.report_content.append('## 釉面缺陷关联分析')
        self.report_content.append('')
        
        self.report_content.append('| 窑位编码 | 缺陷类型 | 釉料配方 | 熔融温度(°C) | 实际最高温(°C) | 温差(°C) |')
        self.report_content.append('|---------|---------|---------|------------|--------------|--------|')
        
        for gda in analysis_result.glaze_defect_associations:
            recipe_name = gda.glaze_recipe_name if gda.glaze_recipe_name else '-'
            melt_temp = f'{gda.glaze_melting_temp:.1f}' if gda.glaze_melting_temp else '-'
            max_temp = f'{gda.actual_max_temp:.1f}' if gda.actual_max_temp else '-'
            temp_diff = f'{gda.temp_difference:.1f}' if gda.temp_difference else '-'
            
            self.report_content.append(
                f'| {gda.position_code} | {gda.defect_type} | {recipe_name} | '
                f'{melt_temp} | {max_temp} | {temp_diff} |'
            )
        
        self.report_content.append('')
        
        self.report_content.append('### 缺陷可能原因分析')
        self.report_content.append('')
        
        for gda in analysis_result.glaze_defect_associations:
            if gda.possible_causes:
                self.report_content.append(f'#### 窑位 {gda.position_code} - {gda.defect_type}')
                self.report_content.append('')
                for cause in gda.possible_causes:
                    self.report_content.append(f'- {cause}')
                self.report_content.append('')
    
    def _add_position_details(self, kiln_run: KilnRun, analysis_result: AnalysisResult):
        """添加各窑位详细信息"""
        if not kiln_run.kiln_positions:
            return
        
        self.report_content.append('## 各窑位详细信息')
        self.report_content.append('')
        
        for position in kiln_run.kiln_positions:
            self.report_content.append(f'### 窑位: {position.code}')
            self.report_content.append('')
            self.report_content.append(f'- **行**: {position.row}')
            self.report_content.append(f'- **列**: {position.column}')
            if position.shelf:
                self.report_content.append(f'- **层架**: {position.shelf}')
            if position.notes:
                self.report_content.append(f'- **备注**: {position.notes}')
            
            defects = kiln_run.get_defects_by_position(position.id)
            if defects:
                self.report_content.append('')
                self.report_content.append('**缺陷记录**:')
                self.report_content.append('')
                for defect in defects:
                    severity_display = {
                        '轻微': '🟡 轻微',
                        '中等': '🟠 中等',
                        '严重': '🔴 严重'
                    }.get(defect.severity, defect.severity)
                    
                    self.report_content.append(f'- **{defect.defect_type}** ({severity_display})')
                    if defect.description:
                        self.report_content.append(f'  - 描述: {defect.description}')
            
            review = kiln_run.get_review_by_position(position.id)
            if review:
                self.report_content.append('')
                self.report_content.append('**复核结论**:')
                self.report_content.append('')
                self.report_content.append(f'- **结论**: {review.conclusion}')
                self.report_content.append(f'- **复核人**: {review.reviewer}')
                if review.review_date:
                    review_time = review.review_date.strftime('%Y-%m-%d %H:%M:%S')
                    self.report_content.append(f'- **复核时间**: {review_time}')
                if review.root_cause:
                    self.report_content.append(f'- **根本原因**: {review.root_cause}')
                if review.corrective_action:
                    self.report_content.append(f'- **纠正措施**: {review.corrective_action}')
            
            self.report_content.append('')
    
    def _add_review_conclusions(self, kiln_run: KilnRun):
        """添加复核结论汇总"""
        if not kiln_run.review_conclusions:
            return
        
        self.report_content.append('## 复核结论汇总')
        self.report_content.append('')
        
        conclusion_counts = {}
        for review in kiln_run.review_conclusions:
            conclusion_counts[review.conclusion] = conclusion_counts.get(review.conclusion, 0) + 1
        
        self.report_content.append('### 结论统计')
        self.report_content.append('')
        for conclusion, count in conclusion_counts.items():
            self.report_content.append(f'- {conclusion}: {count} 件')
        self.report_content.append('')
        
        self.report_content.append('### 详细复核记录')
        self.report_content.append('')
        self.report_content.append('| 窑位编码 | 结论 | 复核人 | 根本原因 | 纠正措施 |')
        self.report_content.append('|---------|------|--------|----------|----------|')
        
        for review in kiln_run.review_conclusions:
            position = kiln_run.get_position_by_code(review.position_id)
            position_code = position.code if position else review.position_id
            
            root_cause = review.root_cause if review.root_cause else '-'
            corrective_action = review.corrective_action if review.corrective_action else '-'
            
            self.report_content.append(
                f'| {position_code} | {review.conclusion} | {review.reviewer} | '
                f'{root_cause} | {corrective_action} |'
            )
        
        self.report_content.append('')
    
    def _add_footer(self):
        """添加报告页脚"""
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        self.report_content.append('---')
        self.report_content.append('')
        self.report_content.append(f'*报告生成时间: {current_time}*')
        self.report_content.append('')
    
    def save_report(self, content: str, file_path: str):
        """
        保存报告到文件
        
        Args:
            content: Markdown内容
            file_path: 文件路径
        """
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
