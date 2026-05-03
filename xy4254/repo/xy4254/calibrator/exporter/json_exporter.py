"""
JSON导出器 - 导出分析结果为JSON格式
"""

import json
from datetime import datetime
from typing import Dict, List, Any, Optional
import os


class JSONExporter:
    """
    JSON格式导出器
    
    导出完整的分析结果为结构化JSON，便于程序处理
    """
    
    def __init__(self):
        self.generated_at = datetime.now()
    
    def export_full(self, output_path: str,
                     analysis_result: Dict,
                     risk_results: Dict,
                     action_plans: Dict,
                     consolidated_actions: Optional[Dict] = None) -> str:
        """
        导出完整分析结果
        
        Args:
            output_path: 输出文件路径
            analysis_result: 分析结果
            risk_results: 风险评估结果
            action_plans: 行动计划
            consolidated_actions: 整合的操作汇总
            
        Returns:
            输出文件路径
        """
        full_data = {
            'metadata': {
                'generated_at': self.generated_at.isoformat(),
                'version': '0.1.0',
                'total_trays': len(risk_results)
            },
            'analysis_summary': self._extract_analysis_summary(analysis_result),
            'risk_assessment': self._extract_risk_results(risk_results),
            'action_plans': self._extract_action_plans(action_plans)
        }
        
        if consolidated_actions:
            full_data['consolidated_actions'] = self._extract_consolidated_actions(consolidated_actions)
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True) if os.path.dirname(output_path) else None
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(full_data, f, ensure_ascii=False, indent=2, default=str)
        
        return output_path
    
    def export_risk_only(self, output_path: str,
                          risk_results: Dict) -> str:
        """
        仅导出风险评估结果
        
        Args:
            output_path: 输出文件路径
            risk_results: 风险评估结果
            
        Returns:
            输出文件路径
        """
        data = {
            'metadata': {
                'generated_at': self.generated_at.isoformat(),
                'type': 'risk_assessment'
            },
            'trays': {}
        }
        
        for tray_id, result in risk_results.items():
            data['trays'][tray_id] = {
                'overall_risk': result.overall_risk if hasattr(result, 'overall_risk') else 'normal',
                'overall_score': result.overall_score if hasattr(result, 'overall_score') else 5,
                'light_risk': self._dictify_risk(result.light_risk) if hasattr(result, 'light_risk') else {},
                'moisture_risk': self._dictify_risk(result.moisture_risk) if hasattr(result, 'moisture_risk') else {},
                'combined_risk': self._dictify_combined_risk(result.combined_risk) if hasattr(result, 'combined_risk') else {},
                'warnings': result.warnings if hasattr(result, 'warnings') else [],
                'recommendations': result.recommendations if hasattr(result, 'recommendations') else []
            }
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True) if os.path.dirname(output_path) else None
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
        
        return output_path
    
    def export_actions_only(self, output_path: str,
                             action_plans: Dict,
                             consolidated_actions: Optional[Dict] = None) -> str:
        """
        仅导出行动计划
        
        Args:
            output_path: 输出文件路径
            action_plans: 行动计划
            consolidated_actions: 整合的操作汇总
            
        Returns:
            输出文件路径
        """
        data = {
            'metadata': {
                'generated_at': self.generated_at.isoformat(),
                'type': 'action_plan'
            },
            'plans': {}
        }
        
        for tray_id, plan in action_plans.items():
            data['plans'][tray_id] = {
                'priority': plan.priority if hasattr(plan, 'priority') else 'P3 - 正常',
                'estimated_cost': plan.estimated_cost if hasattr(plan, 'estimated_cost') else 0.0,
                'light_actions': plan.light_actions if hasattr(plan, 'light_actions') else [],
                'irrigation_actions': plan.irrigation_actions if hasattr(plan, 'irrigation_actions') else [],
                'monitoring_actions': plan.monitoring_actions if hasattr(plan, 'monitoring_actions') else []
            }
        
        if consolidated_actions:
            data['consolidated'] = self._extract_consolidated_actions(consolidated_actions)
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True) if os.path.dirname(output_path) else None
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
        
        return output_path
    
    def export_daily_stats(self, output_path: str,
                            daily_stats: Dict) -> str:
        """
        导出每日统计数据
        
        Args:
            output_path: 输出文件路径
            daily_stats: 每日统计数据
            
        Returns:
            输出文件路径
        """
        data = {
            'metadata': {
                'generated_at': self.generated_at.isoformat(),
                'type': 'daily_statistics'
            },
            'daily_data': daily_stats
        }
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True) if os.path.dirname(output_path) else None
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
        
        return output_path
    
    def _extract_analysis_summary(self, analysis_result: Dict) -> Dict:
        """提取分析摘要"""
        if not analysis_result:
            return {}
        
        sensor_summary = analysis_result.get('sensor_summary', {})
        tray_summary = analysis_result.get('tray_summary', {})
        weather_summary = analysis_result.get('weather_summary', {})
        inspection_summary = analysis_result.get('inspection_summary', {})
        
        return {
            'sensor': {
                'total_records': sensor_summary.get('total_records', 0),
                'tray_count': sensor_summary.get('tray_count', 0),
                'tray_ids': sensor_summary.get('tray_ids', []),
                'date_range': sensor_summary.get('date_range', {})
            },
            'trays': {
                'tray_count': tray_summary.get('tray_count', 0),
                'tray_ids': tray_summary.get('tray_ids', []),
                'stage_distribution': tray_summary.get('stage_distribution', {}),
                'variety_distribution': tray_summary.get('variety_distribution', {})
            },
            'weather': {
                'forecast_days': weather_summary.get('forecast_days', 0),
                'dates': weather_summary.get('dates', []),
                'avg_temperature': weather_summary.get('avg_temperature', 0),
                'avg_humidity': weather_summary.get('avg_humidity', 0),
                'avg_irradiance': weather_summary.get('avg_irradiance', 0)
            },
            'inspections': {
                'total_inspections': inspection_summary.get('total_inspections', 0),
                'inspected_tray_count': inspection_summary.get('inspected_tray_count', 0),
                'rating_distribution': inspection_summary.get('rating_distribution', {}),
                'moisture_distribution': inspection_summary.get('moisture_distribution', {})
            }
        }
    
    def _extract_risk_results(self, risk_results: Dict) -> Dict:
        """提取风险评估结果"""
        results = {}
        
        for tray_id, result in risk_results.items():
            results[tray_id] = {
                'overall': {
                    'risk': result.overall_risk if hasattr(result, 'overall_risk') else 'normal',
                    'score': result.overall_score if hasattr(result, 'overall_score') else 5
                },
                'light': self._dictify_risk(result.light_risk) if hasattr(result, 'light_risk') else {},
                'moisture': self._dictify_risk(result.moisture_risk) if hasattr(result, 'moisture_risk') else {},
                'combined': self._dictify_combined_risk(result.combined_risk) if hasattr(result, 'combined_risk') else {},
                'warnings': result.warnings if hasattr(result, 'warnings') else [],
                'recommendations': result.recommendations if hasattr(result, 'recommendations') else []
            }
        
        return results
    
    def _extract_action_plans(self, action_plans: Dict) -> Dict:
        """提取行动计划"""
        plans = {}
        
        for tray_id, plan in action_plans.items():
            plans[tray_id] = {
                'priority': plan.priority if hasattr(plan, 'priority') else 'P3 - 正常',
                'estimated_cost': plan.estimated_cost if hasattr(plan, 'estimated_cost') else 0.0,
                'actions': {
                    'light': plan.light_actions if hasattr(plan, 'light_actions') else [],
                    'irrigation': plan.irrigation_actions if hasattr(plan, 'irrigation_actions') else [],
                    'monitoring': plan.monitoring_actions if hasattr(plan, 'monitoring_actions') else []
                }
            }
        
        return plans
    
    def _extract_consolidated_actions(self, consolidated: Dict) -> Dict:
        """提取整合的操作"""
        return {
            'summary': consolidated.get('summary', {}),
            'urgent_actions': consolidated.get('urgent_actions', []),
            'light_actions': consolidated.get('light_actions', []),
            'irrigation_actions': consolidated.get('irrigation_actions', []),
            'monitoring_actions': consolidated.get('monitoring_actions', [])
        }
    
    def _dictify_risk(self, risk: Dict) -> Dict:
        """将风险对象转换为字典"""
        if not risk:
            return {}
        
        return {
            'level': risk.get('level', 'normal'),
            'status': risk.get('status', '正常'),
            'score': risk.get('score', 5),
            'details': risk.get('details', {})
        }
    
    def _dictify_combined_risk(self, combined_risk: Dict) -> Dict:
        """将综合风险转换为字典"""
        if not combined_risk:
            return {}
        
        return {
            'level': combined_risk.get('level', 'normal'),
            'score': combined_risk.get('score', 5),
            'weighted_score': combined_risk.get('weighted_score', 0),
            'light_contribution': combined_risk.get('light_contribution', 0),
            'moisture_contribution': combined_risk.get('moisture_contribution', 0)
        }
