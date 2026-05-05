from typing import List, Optional, Dict, Any
from dataclasses import dataclass

from models import (
    KilnRun, TemperatureLog, BodyThickness, GlazeRecipe,
    KilnPosition, DefectRecord, ReviewConclusion,
    AnalysisResult, HeatingRate, InsulationDeviation,
    ThermalShockRisk, GlazeDefectAssociation
)

from analysis import (
    HeatingRateAnalyzer, InsulationDeviationAnalyzer,
    ThermalShockAnalyzer, GlazeDefectAnalyzer
)


class KilnAnalyzer:
    """窑炉烧成曲线综合分析器"""
    
    def __init__(self):
        """初始化综合分析器"""
        self.heating_rate_analyzer = HeatingRateAnalyzer()
        self.insulation_analyzer = InsulationDeviationAnalyzer()
        self.thermal_shock_analyzer = ThermalShockAnalyzer()
        self.glaze_defect_analyzer = GlazeDefectAnalyzer()
        
        self.analysis_result: Optional[AnalysisResult] = None
    
    def analyze(self,
                kiln_run: KilnRun,
                target_rates: Optional[List[Dict[str, Any]]] = None,
                target_stages: Optional[List[Dict[str, Any]]] = None) -> AnalysisResult:
        """
        综合分析窑次
        
        Args:
            kiln_run: 窑次记录
            target_rates: 目标升温速率配置
            target_stages: 目标保温阶段配置
        
        Returns:
            综合分析结果
        """
        heating_rates = self.heating_rate_analyzer.analyze(
            kiln_run.temperature_logs,
            target_rates
        )
        
        insulation_deviations = []
        if target_stages:
            insulation_deviations = self.insulation_analyzer.analyze(
                kiln_run.temperature_logs,
                target_stages
            )
        
        thermal_shock_risks = self.thermal_shock_analyzer.analyze(
            kiln_run.temperature_logs,
            kiln_run.kiln_positions,
            kiln_run.body_thicknesses
        )
        
        glaze_defect_associations = self.glaze_defect_analyzer.analyze(
            kiln_run.temperature_logs,
            kiln_run.defect_records,
            kiln_run.kiln_positions,
            kiln_run.glaze_recipes
        )
        
        summary = self._generate_summary(
            heating_rates,
            insulation_deviations,
            thermal_shock_risks,
            glaze_defect_associations,
            kiln_run
        )
        
        self.analysis_result = AnalysisResult(
            kiln_run_id=kiln_run.id,
            heating_rates=heating_rates,
            insulation_deviations=insulation_deviations,
            thermal_shock_risks=thermal_shock_risks,
            glaze_defect_associations=glaze_defect_associations,
            summary=summary
        )
        
        return self.analysis_result
    
    def _generate_summary(self,
                          heating_rates: List[HeatingRate],
                          insulation_deviations: List[InsulationDeviation],
                          thermal_shock_risks: List[ThermalShockRisk],
                          glaze_defect_associations: List[GlazeDefectAssociation],
                          kiln_run: KilnRun) -> Dict[str, Any]:
        """生成综合摘要"""
        summary = {}
        
        hr_stats = self.heating_rate_analyzer.get_statistics()
        summary['heating_rate'] = {
            'total_segments': hr_stats.get('count', 0),
            'unacceptable_count': hr_stats.get('unacceptable_count', 0),
            'avg_rate': hr_stats.get('avg_rate'),
            'max_rate': hr_stats.get('max_rate')
        }
        
        ins_stats = self.insulation_analyzer.get_statistics()
        summary['insulation'] = {
            'total_stages': ins_stats.get('count', 0),
            'unacceptable_count': ins_stats.get('unacceptable_count', 0)
        }
        
        ts_stats = self.thermal_shock_analyzer.get_statistics()
        summary['thermal_shock'] = {
            'total_positions': ts_stats.get('count', 0),
            'by_risk_level': ts_stats.get('by_risk_level', {}),
            'high_risk_count': ts_stats.get('high_risk_count', 0)
        }
        
        gd_stats = self.glaze_defect_analyzer.get_statistics()
        summary['glaze_defects'] = {
            'total_defects': gd_stats.get('count', 0),
            'by_type': gd_stats.get('by_defect_type', {}),
            'by_recipe': gd_stats.get('by_recipe', {})
        }
        
        summary['kiln_run'] = {
            'id': kiln_run.id,
            'name': kiln_run.name,
            'start_date': kiln_run.start_date.isoformat() if kiln_run.start_date else None,
            'end_date': kiln_run.end_date.isoformat() if kiln_run.end_date else None,
            'total_positions': len(kiln_run.kiln_positions),
            'total_defects': len(kiln_run.defect_records),
            'total_reviews': len(kiln_run.review_conclusions)
        }
        
        risk_level = '正常'
        warnings = []
        
        if hr_stats.get('unacceptable_count', 0) > 0:
            warnings.append(f'有 {hr_stats["unacceptable_count"]} 个升温速率段异常')
            risk_level = '需关注'
        
        if ins_stats.get('unacceptable_count', 0) > 0:
            warnings.append(f'有 {ins_stats["unacceptable_count"]} 个保温阶段异常')
            risk_level = '需关注'
        
        if ts_stats.get('high_risk_count', 0) > 0:
            warnings.append(f'有 {ts_stats["high_risk_count"]} 个窑位热冲击风险高')
            risk_level = '需关注'
        
        high_severity_defects = [
            d for d in kiln_run.defect_records 
            if d.severity in ['严重', '中等']
        ]
        if high_severity_defects:
            warnings.append(f'有 {len(high_severity_defects)} 个中/严重缺陷')
            risk_level = '需关注'
        
        summary['overall_risk'] = risk_level
        summary['warnings'] = warnings
        
        return summary
    
    def get_position_analysis(self, position_id: str) -> Dict[str, Any]:
        """
        获取指定窑位的详细分析
        
        Args:
            position_id: 窑位ID
        
        Returns:
            窑位分析结果
        """
        result = {
            'position_id': position_id,
            'thermal_shock_risk': None,
            'defects': [],
            'defect_associations': [],
            'review': None
        }
        
        if not self.analysis_result:
            return result
        
        for tsr in self.analysis_result.thermal_shock_risks:
            if tsr.position_id == position_id:
                result['thermal_shock_risk'] = {
                    'risk_level': tsr.risk_level,
                    'risk_factors': tsr.risk_factors,
                    'max_temp_change_rate': tsr.max_temp_change_rate,
                    'body_thickness': tsr.body_thickness,
                    'recommendation': tsr.recommendation
                }
                break
        
        for gda in self.analysis_result.glaze_defect_associations:
            if gda.position_id == position_id:
                result['defect_associations'].append({
                    'defect_type': gda.defect_type,
                    'possible_causes': gda.possible_causes,
                    'related_factors': gda.related_factors,
                    'glaze_recipe_name': gda.glaze_recipe_name,
                    'temp_difference': gda.temp_difference
                })
        
        return result
    
    def get_high_risk_positions(self) -> List[Dict[str, Any]]:
        """获取高风险窑位列表"""
        if not self.analysis_result:
            return []
        
        high_risk = []
        
        for tsr in self.analysis_result.thermal_shock_risks:
            if tsr.risk_level == ThermalShockAnalyzer.RISK_LEVEL_HIGH:
                high_risk.append({
                    'position_id': tsr.position_id,
                    'position_code': tsr.position_code,
                    'risk_level': tsr.risk_level,
                    'risk_factors': tsr.risk_factors,
                    'recommendation': tsr.recommendation
                })
        
        return high_risk
    
    def get_problematic_stages(self) -> Dict[str, List[Dict[str, Any]]]:
        """获取有问题的阶段"""
        if not self.analysis_result:
            return {'heating_rates': [], 'insulation_stages': []}
        
        problematic = {
            'heating_rates': [],
            'insulation_stages': []
        }
        
        for hr in self.analysis_result.heating_rates:
            if not hr.is_acceptable:
                problematic['heating_rates'].append({
                    'segment': hr.time_segment,
                    'rate': hr.rate,
                    'target_rate': hr.target_rate,
                    'deviation': hr.deviation
                })
        
        for ins in self.analysis_result.insulation_deviations:
            if not ins.is_acceptable:
                problematic['insulation_stages'].append({
                    'stage': ins.insulation_stage,
                    'target_temp': ins.target_temp,
                    'actual_temp': ins.actual_temp,
                    'temp_deviation': ins.temp_deviation,
                    'target_duration': ins.target_duration,
                    'actual_duration': ins.actual_duration,
                    'duration_deviation': ins.duration_deviation
                })
        
        return problematic
    
    def get_defect_analysis(self) -> Dict[str, Any]:
        """获取缺陷分析摘要"""
        if not self.analysis_result:
            return {}
        
        return self.glaze_defect_analyzer.get_statistics()
    
    def export_analysis_result(self) -> Dict[str, Any]:
        """导出分析结果为字典"""
        if not self.analysis_result:
            return {}
        
        return self.analysis_result.to_dict()
