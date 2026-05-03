"""
风险评估器 - 综合评估苗盘的光照和水分风险
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Any
from datetime import datetime


@dataclass
class RiskResult:
    """风险评估结果数据类"""
    tray_id: str
    overall_risk: str
    overall_score: int
    light_risk: Dict
    moisture_risk: Dict
    combined_risk: Dict
    warnings: List[str]
    recommendations: List[str]


class RiskEvaluator:
    """
    综合风险评估器
    
    整合光照、水分、蒸散等数据，评估苗盘的整体风险等级
    """
    
    RISK_LEVELS = {
        'critical': {'level': 0, 'description': '严重风险', 'color': 'red'},
        'high': {'level': 1, 'description': '高风险', 'color': 'orange'},
        'medium': {'level': 2, 'description': '中等风险', 'color': 'yellow'},
        'low': {'level': 3, 'description': '低风险', 'color': 'green'},
        'normal': {'level': 4, 'description': '正常', 'color': 'green'}
    }
    
    def __init__(self):
        self.warnings = []
        self.recommendations = []
    
    def evaluate_tray(self, tray_id: str,
                       dli_data: Dict,
                       moisture_analysis: Dict,
                       et0_data: Dict,
                       tray_requirements: Dict,
                       inspection_notes: Optional[Dict] = None) -> RiskResult:
        """
        评估单个苗盘的综合风险
        
        Args:
            tray_id: 苗盘ID
            dli_data: DLI计算结果
            moisture_analysis: 水分分析结果
            et0_data: 蒸散数据
            tray_requirements: 苗盘品种需求参数
            inspection_notes: 人工巡检备注（可选）
            
        Returns:
            RiskResult对象，包含完整的风险评估结果
        """
        light_risk = self._evaluate_light_risk(dli_data, tray_requirements)
        
        moisture_risk = self._evaluate_moisture_risk(moisture_analysis, 
                                                       et0_data, 
                                                       tray_requirements)
        
        combined_risk = self._combine_risks(light_risk, moisture_risk)
        
        warnings = self._generate_warnings(tray_id, light_risk, moisture_risk, inspection_notes)
        
        recommendations = self._generate_recommendations(tray_id, light_risk, moisture_risk, 
                                                          tray_requirements, et0_data)
        
        overall_risk = combined_risk['level']
        overall_score = combined_risk['score']
        
        return RiskResult(
            tray_id=tray_id,
            overall_risk=overall_risk,
            overall_score=overall_score,
            light_risk=light_risk,
            moisture_risk=moisture_risk,
            combined_risk=combined_risk,
            warnings=warnings,
            recommendations=recommendations
        )
    
    def _evaluate_light_risk(self, dli_data: Dict, requirements: Dict) -> Dict:
        """
        评估光照风险
        
        Args:
            dli_data: DLI计算结果
            requirements: 品种光照需求参数
            
        Returns:
            包含光照风险评估的字典
        """
        if not dli_data:
            return {
                'level': 'unknown',
                'status': '数据不足',
                'score': 3,
                'details': '没有光照数据'
            }
        
        dli_min = requirements.get('dli_min', 8)
        dli_optimal_min = requirements.get('dli_optimal', 15)
        dli_optimal_max = requirements.get('dli_max', 25)
        dli_max_threshold = dli_optimal_max + 15
        
        daily_dli = dli_data.get('daily_dli', {})
        if not daily_dli:
            return {
                'level': 'unknown',
                'status': '数据不足',
                'score': 3,
                'details': '没有每日DLI数据'
            }
        
        latest_date = max(daily_dli.keys()) if daily_dli else None
        latest_dli = daily_dli.get(latest_date, 0) if latest_date else 0
        
        below_min_count = sum(1 for dli in daily_dli.values() if dli < dli_min)
        below_optimal_count = sum(1 for dli in daily_dli.values() if dli < dli_optimal_min)
        above_max_count = sum(1 for dli in daily_dli.values() if dli > dli_max_threshold)
        
        total_days = len(daily_dli)
        
        if latest_dli < dli_min:
            level = 'critical'
            status = '光照严重不足'
            score = 1
        elif latest_dli < dli_optimal_min:
            level = 'high'
            status = '光照偏低'
            score = 3
        elif latest_dli > dli_max_threshold:
            level = 'high'
            status = '光照过强'
            score = 2
        elif latest_dli > dli_optimal_max:
            level = 'medium'
            status = '光照偏高'
            score = 4
        else:
            level = 'normal'
            status = '光照适宜'
            score = 5
        
        if below_min_count > 0 and total_days > 0:
            if below_min_count / total_days > 0.3:
                level = 'critical' if level in ['high', 'medium'] else level
                score = min(score, 2)
        
        return {
            'level': level,
            'status': status,
            'score': score,
            'details': {
                'latest_dli': round(latest_dli, 2),
                'dli_requirements': {
                    'min': dli_min,
                    'optimal_min': dli_optimal_min,
                    'optimal_max': dli_optimal_max,
                    'max_threshold': dli_max_threshold
                },
                'days_below_min': below_min_count,
                'days_below_optimal': below_optimal_count,
                'days_above_max': above_max_count
            }
        }
    
    def _evaluate_moisture_risk(self, moisture_analysis: Dict, 
                                  et0_data: Dict, 
                                  requirements: Dict) -> Dict:
        """
        评估水分风险
        
        Args:
            moisture_analysis: 水分分析结果
            et0_data: 蒸散数据
            requirements: 品种水分需求参数
            
        Returns:
            包含水分风险评估的字典
        """
        if not moisture_analysis:
            return {
                'level': 'unknown',
                'status': '数据不足',
                'score': 3,
                'details': '没有水分数据'
            }
        
        risk = moisture_analysis.get('risk', {})
        
        current_risk = risk.get('current_risk', 'normal')
        current_status = risk.get('current_status', '未知')
        current_moisture = risk.get('current_moisture', 0)
        
        trend = moisture_analysis.get('trend', {})
        trend_direction = trend.get('direction', 'stable')
        
        moisture_min = requirements.get('moisture_min', 55)
        moisture_optimal = requirements.get('moisture_optimal', 70)
        moisture_max = requirements.get('moisture_max', 85)
        
        et0 = et0_data.get('et0', 0) if et0_data else 0
        
        if current_risk == 'critical':
            level = 'critical'
            score = 1
        elif current_risk == 'high':
            level = 'high'
            score = 2
        elif current_risk == 'medium':
            level = 'medium'
            score = 3
        else:
            level = 'normal'
            score = 5
        
        if trend_direction in ['decreasing', 'decreasing_fast'] and current_moisture < moisture_optimal:
            if et0 > 4:
                level = 'high' if level == 'normal' else level
                score = min(score, 3)
            elif et0 > 2:
                level = 'medium' if level == 'normal' else level
                score = min(score, 4)
        
        distribution = risk.get('distribution', {})
        below_wp = distribution.get('below_wilting_point', 0)
        above_fc = distribution.get('above_field_capacity', 0)
        total = distribution.get('total', 1)
        
        if below_wp > 0:
            level = 'critical'
            score = 1
        elif above_fc / total > 0.3:
            level = 'high' if level != 'critical' else level
            score = min(score, 2)
        
        return {
            'level': level,
            'status': current_status,
            'score': score,
            'details': {
                'current_moisture': current_moisture,
                'moisture_requirements': {
                    'min': moisture_min,
                    'optimal': moisture_optimal,
                    'max': moisture_max
                },
                'trend': trend.get('description', '稳定'),
                'et0': round(et0, 2) if et0_data else None,
                'risk_distribution': distribution
            }
        }
    
    def _combine_risks(self, light_risk: Dict, moisture_risk: Dict) -> Dict:
        """
        综合光照和水分风险
        
        使用加权评分方法计算整体风险
        """
        light_level = light_risk.get('level', 'normal')
        moisture_level = moisture_risk.get('level', 'normal')
        
        light_score = light_risk.get('score', 5)
        moisture_score = moisture_risk.get('score', 5)
        
        moisture_weight = 0.55
        light_weight = 0.45
        
        weighted_score = (light_score * light_weight) + (moisture_score * moisture_weight)
        
        levels_order = ['critical', 'high', 'medium', 'normal', 'low', 'unknown']
        light_idx = levels_order.index(light_level) if light_level in levels_order else 5
        moisture_idx = levels_order.index(moisture_level) if moisture_level in levels_order else 5
        
        worse_level_idx = min(light_idx, moisture_idx)
        worse_level = levels_order[worse_level_idx]
        
        if light_level == 'critical' or moisture_level == 'critical':
            overall_level = 'critical'
        elif light_level == 'high' or moisture_level == 'high':
            overall_level = 'high'
        elif light_level == 'medium' or moisture_level == 'medium':
            overall_level = 'medium'
        else:
            overall_level = 'normal'
        
        if overall_level == 'critical':
            final_score = 1
        elif overall_level == 'high':
            final_score = 2 if weighted_score < 2.5 else 3
        elif overall_level == 'medium':
            final_score = 3 if weighted_score < 4 else 4
        else:
            final_score = 5
        
        return {
            'level': overall_level,
            'score': final_score,
            'weighted_score': round(weighted_score, 2),
            'light_contribution': round(light_score * light_weight, 2),
            'moisture_contribution': round(moisture_score * moisture_weight, 2)
        }
    
    def _generate_warnings(self, tray_id: str,
                           light_risk: Dict,
                           moisture_risk: Dict,
                           inspection_notes: Optional[Dict] = None) -> List[str]:
        """生成警告信息"""
        warnings = []
        
        light_level = light_risk.get('level', 'normal')
        light_status = light_risk.get('status', '')
        
        if light_level == 'critical':
            warnings.append(f"【严重】{tray_id} {light_status}")
        elif light_level == 'high':
            warnings.append(f"【警告】{tray_id} {light_status}")
        
        moisture_level = moisture_risk.get('level', 'normal')
        moisture_status = moisture_risk.get('status', '')
        
        if moisture_level == 'critical':
            warnings.append(f"【严重】{tray_id} {moisture_status}")
        elif moisture_level == 'high':
            warnings.append(f"【警告】{tray_id} {moisture_status}")
        
        if inspection_notes:
            if inspection_notes.get('has_watering_issue'):
                warnings.append(f"【人工巡检】{tray_id} 存在浇水相关问题标记")
        
        return warnings
    
    def _generate_recommendations(self, tray_id: str,
                                   light_risk: Dict,
                                   moisture_risk: Dict,
                                   requirements: Dict,
                                   et0_data: Dict) -> List[str]:
        """生成建议信息"""
        recommendations = []
        
        light_details = light_risk.get('details', {})
        latest_dli = light_details.get('latest_dli', 0)
        dli_req = light_details.get('dli_requirements', {})
        
        if light_risk.get('level') in ['critical', 'high']:
            if '不足' in light_risk.get('status', ''):
                deficit = dli_req.get('optimal_min', 15) - latest_dli
                recommendations.append(
                    f"{tray_id} 建议补光：当前DLI {round(latest_dli, 1)}，"
                    f"目标 {dli_req.get('optimal_min', 15)}，"
                    f"缺口约 {round(deficit, 1)} mol/m²/day"
                )
            else:
                recommendations.append(f"{tray_id} 建议适当遮阴，光照过强")
        
        moisture_details = moisture_risk.get('details', {})
        current_moisture = moisture_details.get('current_moisture', 0)
        moisture_req = moisture_details.get('moisture_requirements', {})
        
        if moisture_risk.get('level') in ['critical', 'high']:
            status = moisture_risk.get('status', '')
            if '干' in status or '旱' in status:
                et0 = moisture_details.get('et0', 0)
                if et0:
                    recommendations.append(
                        f"{tray_id} 建议立即浇水：当前湿度 {current_moisture}%，"
                        f"今日蒸散量估计 {round(et0, 2)} mm/day"
                    )
                else:
                    recommendations.append(
                        f"{tray_id} 建议立即浇水：当前湿度 {current_moisture}%"
                    )
            elif '湿' in status or '积水' in status:
                recommendations.append(
                    f"{tray_id} 建议减少浇水，增加通风：当前湿度 {current_moisture}%"
                )
        
        trend = moisture_details.get('trend', '')
        if '下降' in trend and moisture_risk.get('level') == 'normal':
            recommendations.append(
                f"{tray_id} 注意：水分呈{trend}趋势，建议密切关注"
            )
        
        return recommendations
    
    def batch_evaluate(self, trays_data: Dict) -> Dict[str, RiskResult]:
        """
        批量评估多个苗盘
        
        Args:
            trays_data: 包含所有苗盘数据的字典
            
        Returns:
            苗盘ID到RiskResult的映射字典
        """
        results = {}
        
        for tray_id, data in trays_data.items():
            result = self.evaluate_tray(
                tray_id=tray_id,
                dli_data=data.get('dli_data', {}),
                moisture_analysis=data.get('moisture_analysis', {}),
                et0_data=data.get('et0_data', {}),
                tray_requirements=data.get('requirements', {}),
                inspection_notes=data.get('inspection', {})
            )
            results[tray_id] = result
        
        return results
    
    def get_priority_trays(self, results: Dict[str, RiskResult], 
                           limit: int = 10) -> List[RiskResult]:
        """
        获取需要优先处理的苗盘
        
        Args:
            results: 评估结果字典
            limit: 返回数量限制
            
        Returns:
            按风险优先级排序的苗盘列表
        """
        sorted_trays = sorted(
            results.values(),
            key=lambda x: (x.overall_score, x.overall_risk != 'critical')
        )
        
        return sorted_trays[:limit]
