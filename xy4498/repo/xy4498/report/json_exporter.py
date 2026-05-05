import json
from typing import Dict, Any, Optional
from datetime import datetime

from models import KilnRun, AnalysisResult


class JSONExporter:
    """JSON数据导出器"""
    
    @staticmethod
    def export_kiln_run(kiln_run: KilnRun, 
                        include_analysis: bool = False,
                        analysis_result: Optional[AnalysisResult] = None) -> Dict[str, Any]:
        """
        导出窑次数据为JSON格式
        
        Args:
            kiln_run: 窑次记录
            include_analysis: 是否包含分析结果
            analysis_result: 分析结果
        
        Returns:
            JSON格式的字典
        """
        data = kiln_run.to_dict()
        
        if include_analysis and analysis_result:
            data['analysis'] = analysis_result.to_dict()
        
        return data
    
    @staticmethod
    def export_analysis_result(analysis_result: AnalysisResult) -> Dict[str, Any]:
        """
        导出分析结果为JSON格式
        
        Args:
            analysis_result: 分析结果
        
        Returns:
            JSON格式的字典
        """
        return analysis_result.to_dict()
    
    @staticmethod
    def export_position_details(kiln_run: KilnRun,
                                analysis_result: AnalysisResult,
                                position_id: str) -> Dict[str, Any]:
        """
        导出指定窑位的详细信息
        
        Args:
            kiln_run: 窑次记录
            analysis_result: 分析结果
            position_id: 窑位ID
        
        Returns:
            JSON格式的字典
        """
        position = None
        for pos in kiln_run.kiln_positions:
            if pos.id == position_id:
                position = pos
                break
        
        if not position:
            return {'error': f'窑位 {position_id} 不存在'}
        
        defects = kiln_run.get_defects_by_position(position_id)
        review = kiln_run.get_review_by_position(position_id)
        
        thermal_shock_risk = None
        for tsr in analysis_result.thermal_shock_risks:
            if tsr.position_id == position_id:
                thermal_shock_risk = tsr.to_dict()
                break
        
        defect_associations = []
        for gda in analysis_result.glaze_defect_associations:
            if gda.position_id == position_id:
                defect_associations.append(gda.to_dict())
        
        body_thickness = None
        for bt in kiln_run.body_thicknesses:
            if bt.position_id == position_id:
                body_thickness = {
                    'thickness': bt.thickness,
                    'material': bt.material
                }
                break
        
        glaze_recipe = None
        if position.glaze_recipe_id:
            for gr in kiln_run.glaze_recipes:
                if gr.id == position.glaze_recipe_id:
                    glaze_recipe = {
                        'id': gr.id,
                        'name': gr.name,
                        'components': gr.components,
                        'melting_temperature': gr.melting_temperature
                    }
                    break
        
        return {
            'position': {
                'id': position.id,
                'code': position.code,
                'row': position.row,
                'column': position.column,
                'shelf': position.shelf,
                'notes': position.notes
            },
            'body_thickness': body_thickness,
            'glaze_recipe': glaze_recipe,
            'defects': [
                {
                    'id': d.id,
                    'defect_type': d.defect_type,
                    'severity': d.severity,
                    'description': d.description
                } for d in defects
            ],
            'review': {
                'reviewer': review.reviewer,
                'review_date': review.review_date.isoformat() if review.review_date else None,
                'conclusion': review.conclusion,
                'root_cause': review.root_cause,
                'corrective_action': review.corrective_action,
                'notes': review.notes
            } if review else None,
            'thermal_shock_risk': thermal_shock_risk,
            'defect_associations': defect_associations
        }
    
    @staticmethod
    def export_summary(kiln_run: KilnRun,
                       analysis_result: AnalysisResult) -> Dict[str, Any]:
        """
        导出摘要信息
        
        Args:
            kiln_run: 窑次记录
            analysis_result: 分析结果
        
        Returns:
            JSON格式的摘要字典
        """
        summary = analysis_result.summary.copy()
        
        summary['kiln_run_id'] = kiln_run.id
        summary['kiln_run_name'] = kiln_run.name
        
        if kiln_run.start_date:
            summary['start_date'] = kiln_run.start_date.isoformat()
        if kiln_run.end_date:
            summary['end_date'] = kiln_run.end_date.isoformat()
        
        return summary
    
    @staticmethod
    def save_to_file(data: Dict[str, Any], file_path: str, indent: int = 2):
        """
        保存数据到JSON文件
        
        Args:
            data: 要保存的数据
            file_path: 文件路径
            indent: 缩进级别
        """
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=indent, default=JSONExporter._default_serializer)
    
    @staticmethod
    def _default_serializer(obj):
        """自定义JSON序列化器"""
        if isinstance(obj, datetime):
            return obj.isoformat()
        if hasattr(obj, 'to_dict'):
            return obj.to_dict()
        raise TypeError(f'Object of type {obj.__class__.__name__} is not JSON serializable')
    
    @staticmethod
    def export_full_report(kiln_run: KilnRun,
                           analysis_result: AnalysisResult) -> Dict[str, Any]:
        """
        导出完整报告（包含所有数据和分析结果）
        
        Args:
            kiln_run: 窑次记录
            analysis_result: 分析结果
        
        Returns:
            完整的JSON报告
        """
        return {
            'version': '1.0',
            'export_time': datetime.now().isoformat(),
            'kiln_run': kiln_run.to_dict(),
            'analysis': analysis_result.to_dict(),
            'position_details': {
                pos.id: JSONExporter.export_position_details(kiln_run, analysis_result, pos.id)
                for pos in kiln_run.kiln_positions
            }
        }
