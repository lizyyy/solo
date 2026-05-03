"""
行动计划器 - 根据风险评估结果生成补光和灌溉建议
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass
class ActionPlan:
    """行动计划数据类"""
    tray_id: str
    light_actions: List[Dict]
    irrigation_actions: List[Dict]
    monitoring_actions: List[Dict]
    priority: str
    estimated_cost: float


class ActionPlanner:
    """
    行动计划器
    
    根据风险评估结果生成具体的补光、灌溉和监测建议
    """
    
    LIGHT_EFFICIENCY_LED = 2.3
    LIGHT_EFFICIENCY_FLUORESCENT = 1.5
    ELECTRICITY_COST = 0.8
    
    def __init__(self):
        self.supplemental_light_schedule = {}
    
    def generate_plan(self, tray_id: str,
                       risk_result: Any,
                       dli_data: Dict,
                       moisture_analysis: Dict,
                       et0_data: Dict,
                       requirements: Dict,
                       weather_forecast: Optional[List[Dict]] = None) -> ActionPlan:
        """
        为单个苗盘生成行动计划
        
        Args:
            tray_id: 苗盘ID
            risk_result: 风险评估结果
            dli_data: DLI计算数据
            moisture_analysis: 水分分析数据
            et0_data: 蒸散数据
            requirements: 品种需求参数
            weather_forecast: 天气预报数据（可选）
            
        Returns:
            ActionPlan对象，包含具体的操作建议
        """
        light_actions = self._generate_light_actions(
            tray_id, risk_result, dli_data, requirements, weather_forecast
        )
        
        irrigation_actions = self._generate_irrigation_actions(
            tray_id, risk_result, moisture_analysis, et0_data, requirements, weather_forecast
        )
        
        monitoring_actions = self._generate_monitoring_actions(
            tray_id, risk_result, dli_data, moisture_analysis
        )
        
        priority = self._determine_priority(risk_result)
        
        estimated_cost = self._estimate_cost(light_actions, irrigation_actions)
        
        return ActionPlan(
            tray_id=tray_id,
            light_actions=light_actions,
            irrigation_actions=irrigation_actions,
            monitoring_actions=monitoring_actions,
            priority=priority,
            estimated_cost=estimated_cost
        )
    
    def _generate_light_actions(self, tray_id: str,
                                  risk_result: Any,
                                  dli_data: Dict,
                                  requirements: Dict,
                                  weather_forecast: Optional[List[Dict]]) -> List[Dict]:
        """生成补光相关的操作建议"""
        actions = []
        
        light_risk = risk_result.light_risk if hasattr(risk_result, 'light_risk') else {}
        light_level = light_risk.get('level', 'normal')
        
        if light_level in ['critical', 'high']:
            light_details = light_risk.get('details', {})
            latest_dli = light_details.get('latest_dli', 0)
            dli_req = light_details.get('dli_requirements', {})
            
            if '不足' in light_risk.get('status', ''):
                target_dli = dli_req.get('optimal_min', 15)
                deficit = max(0, target_dli - latest_dli)
                
                if deficit > 0:
                    recommended_hours = self._calculate_supplement_hours(deficit)
                    
                    estimated_energy = self._estimate_light_energy(deficit, recommended_hours)
                    estimated_cost = estimated_energy * self.ELECTRICITY_COST
                    
                    action = {
                        'type': 'supplemental_light',
                        'priority': 'high' if light_level == 'critical' else 'medium',
                        'action': f'为{tray_id}开启补光灯',
                        'details': {
                            'current_dli': round(latest_dli, 1),
                            'target_dli': target_dli,
                            'deficit': round(deficit, 1),
                            'recommended_hours': recommended_hours,
                            'suggested_time': '早晨8:00-10:00 或 傍晚16:00-18:00',
                            'estimated_energy_kwh': round(estimated_energy, 2),
                            'estimated_cost_yuan': round(estimated_cost, 2)
                        },
                        'urgency': '立即执行' if light_level == 'critical' else '今日执行'
                    }
                    actions.append(action)
                    
                    if weather_forecast:
                        next_days = weather_forecast[:3]
                        cloudy_days = sum(1 for day in next_days if day.get('cloud_cover', 50) > 60)
                        
                        if cloudy_days >= 2:
                            actions.append({
                                'type': 'light_forecast_alert',
                                'priority': 'medium',
                                'action': f'未来{cloudy_days}天预报多云，建议持续补光',
                                'urgency': '关注'
                            })
            else:
                actions.append({
                    'type': 'shade',
                    'priority': 'medium',
                    'action': f'为{tray_id}提供适当遮阴',
                    'details': {
                        'current_dli': round(latest_dli, 1),
                        'max_threshold': dli_req.get('max_threshold', 40)
                    },
                    'urgency': '今日执行'
                })
        
        return actions
    
    def _generate_irrigation_actions(self, tray_id: str,
                                       risk_result: Any,
                                       moisture_analysis: Dict,
                                       et0_data: Dict,
                                       requirements: Dict,
                                       weather_forecast: Optional[List[Dict]]) -> List[Dict]:
        """生成灌溉相关的操作建议"""
        actions = []
        
        moisture_risk = risk_result.moisture_risk if hasattr(risk_result, 'moisture_risk') else {}
        moisture_level = moisture_risk.get('level', 'normal')
        
        moisture_details = moisture_risk.get('details', {})
        current_moisture = moisture_details.get('current_moisture', 0)
        moisture_req = moisture_details.get('moisture_requirements', {})
        
        et0 = moisture_details.get('et0', 0)
        trend = moisture_details.get('trend', '稳定')
        
        if moisture_level in ['critical', 'high']:
            status = moisture_risk.get('status', '')
            
            if '干' in status or '旱' in status:
                target_moisture = moisture_req.get('optimal', 70)
                irrigation_needed = self._calculate_irrigation_amount(
                    current_moisture, target_moisture
                )
                
                action = {
                    'type': 'irrigation',
                    'priority': 'high' if moisture_level == 'critical' else 'medium',
                    'action': f'为{tray_id}浇水',
                    'details': {
                        'current_moisture': round(current_moisture, 1),
                        'target_moisture': target_moisture,
                        'recommended_amount_liters': round(irrigation_needed, 1),
                        'daily_et0_mm': round(et0, 2),
                        'method': '慢浇，确保基质均匀吸水',
                        'best_time': '早晨浇水最佳'
                    },
                    'urgency': '立即执行' if moisture_level == 'critical' else '今日执行'
                }
                actions.append(action)
                
                if '下降' in trend:
                    actions.append({
                        'type': 'irrigation_frequency',
                        'priority': 'medium',
                        'action': f'增加{tray_id}的浇水频率',
                        'details': {
                            'current_trend': trend,
                            'suggested_check_interval': '每4-6小时检查一次'
                        },
                        'urgency': '关注'
                    })
            
            elif '湿' in status or '积水' in status:
                action = {
                    'type': 'reduce_irrigation',
                    'priority': 'high' if moisture_level == 'critical' else 'medium',
                    'action': f'停止{tray_id}浇水并增加通风',
                    'details': {
                        'current_moisture': round(current_moisture, 1),
                        'max_threshold': moisture_req.get('max', 85),
                        'action_items': [
                            '停止浇水直至湿度下降到适宜范围',
                            '增加通风降低湿度',
                            '检查排水是否良好'
                        ]
                    },
                    'urgency': '立即执行' if '积水' in status else '今日执行'
                }
                actions.append(action)
        
        elif moisture_level == 'normal' and '下降' in trend:
            actions.append({
                'type': 'moisture_trend_alert',
                'priority': 'low',
                'action': f'注意{tray_id}水分呈{trend}趋势',
                'details': {
                    'current_moisture': round(current_moisture, 1),
                    'next_check': '建议明天早上检查湿度'
                },
                'urgency': '关注'
            })
        
        if weather_forecast:
            next_day = weather_forecast[0] if weather_forecast else {}
            precip = next_day.get('precipitation', 0)
            
            if precip > 50:
                actions.append({
                    'type': 'rain_alert',
                    'priority': 'medium',
                    'action': '明天预报有雨，注意调整浇水量',
                    'details': {
                        'precipitation_probability': precip,
                        'reduction_suggestion': '考虑减少30-50%的浇水量'
                    },
                    'urgency': '明天注意'
                })
        
        return actions
    
    def _generate_monitoring_actions(self, tray_id: str,
                                       risk_result: Any,
                                       dli_data: Dict,
                                       moisture_analysis: Dict) -> List[Dict]:
        """生成监测相关的操作建议"""
        actions = []
        
        overall_risk = risk_result.overall_risk if hasattr(risk_result, 'overall_risk') else 'normal'
        
        if overall_risk == 'critical':
            actions.append({
                'type': 'enhanced_monitoring',
                'priority': 'high',
                'action': f'加强{tray_id}的监测频率',
                'details': {
                    'check_frequency': '每2小时检查一次',
                    'parameters_to_check': ['湿度', '光照', '幼苗状态'],
                    'record_requirement': '记录每次检查的数值和状态'
                },
                'urgency': '持续执行直至风险解除'
            })
        elif overall_risk == 'high':
            actions.append({
                'type': 'regular_monitoring',
                'priority': 'medium',
                'action': f'增加{tray_id}的监测频率',
                'details': {
                    'check_frequency': '每日检查2-3次',
                    'key_indicators': ['湿度是否下降过快', '光照是否充足']
                },
                'urgency': '今日开始'
            })
        
        daily_stats = moisture_analysis.get('daily_stats', [])
        if daily_stats:
            latest_day = daily_stats[-1]
            daily_change = latest_day.get('daily_change', 0)
            
            if abs(daily_change) > 15:
                actions.append({
                    'type': 'variation_alert',
                    'priority': 'medium',
                    'action': f'{tray_id}水分日变化较大，建议关注',
                    'details': {
                        'daily_change': round(daily_change, 1),
                        'morning_value': latest_day.get('morning_moisture'),
                        'evening_value': latest_day.get('evening_moisture')
                    },
                    'urgency': '关注'
                })
        
        return actions
    
    def _calculate_supplement_hours(self, dli_deficit: float, ppfd: float = 150) -> float:
        """
        计算需要的补光时长
        
        Args:
            dli_deficit: DLI缺口（mol/m²/day）
            ppfd: 补光灯PPFD（μmol/m²/s），典型LED为100-200
            
        Returns:
            需要的补光小时数
        """
        if ppfd <= 0:
            return 0.0
        
        seconds_needed = (dli_deficit * 1e6) / ppfd
        hours_needed = seconds_needed / 3600
        
        return round(hours_needed, 1)
    
    def _estimate_light_energy(self, dli_deficit: float, hours: float, 
                                 efficiency: float = None) -> float:
        """
        估算补光能耗
        
        Args:
            dli_deficit: DLI缺口
            hours: 补光时长（小时）
            efficiency: 灯具效率（μmol/J）
            
        Returns:
            能耗（kWh）
        """
        if efficiency is None:
            efficiency = self.LIGHT_EFFICIENCY_LED
        
        total_photons = dli_deficit * 1e6
        
        energy_joules = total_photons / efficiency
        energy_kwh = energy_joules / (1000 * 3600)
        
        return energy_kwh
    
    def _calculate_irrigation_amount(self, current_moisture: float, 
                                       target_moisture: float,
                                       tray_area: float = 0.3,
                                       substrate_depth: float = 0.1) -> float:
        """
        计算需要的灌溉量
        
        Args:
            current_moisture: 当前湿度（体积%）
            target_moisture: 目标湿度（体积%）
            tray_area: 苗盘面积（m²）
            substrate_depth: 基质深度（m）
            
        Returns:
            需要的灌溉量（升）
        """
        moisture_deficit = max(0, target_moisture - current_moisture) / 100
        
        substrate_volume = tray_area * substrate_depth
        
        water_needed_m3 = substrate_volume * moisture_deficit
        water_needed_liters = water_needed_m3 * 1000
        
        water_needed_liters *= 1.2
        
        return max(0.1, water_needed_liters)
    
    def _determine_priority(self, risk_result: Any) -> str:
        """确定优先级"""
        overall_risk = risk_result.overall_risk if hasattr(risk_result, 'overall_risk') else 'normal'
        
        if overall_risk == 'critical':
            return 'P0 - 紧急'
        elif overall_risk == 'high':
            return 'P1 - 高优先级'
        elif overall_risk == 'medium':
            return 'P2 - 中优先级'
        else:
            return 'P3 - 正常'
    
    def _estimate_cost(self, light_actions: List[Dict], 
                        irrigation_actions: List[Dict]) -> float:
        """估算执行计划的成本"""
        total_cost = 0.0
        
        for action in light_actions:
            if action['type'] == 'supplemental_light':
                details = action.get('details', {})
                cost = details.get('estimated_cost_yuan', 0)
                total_cost += cost
        
        for action in irrigation_actions:
            if action['type'] == 'irrigation':
                total_cost += 0.5
        
        return round(total_cost, 2)
    
    def generate_batch_plans(self, trays_data: Dict, risk_results: Dict) -> Dict[str, ActionPlan]:
        """
        批量生成行动计划
        
        Args:
            trays_data: 所有苗盘的数据
            risk_results: 所有苗盘的风险评估结果
            
        Returns:
            苗盘ID到ActionPlan的映射
        """
        plans = {}
        
        for tray_id, risk_result in risk_results.items():
            data = trays_data.get(tray_id, {})
            
            plan = self.generate_plan(
                tray_id=tray_id,
                risk_result=risk_result,
                dli_data=data.get('dli_data', {}),
                moisture_analysis=data.get('moisture_analysis', {}),
                et0_data=data.get('et0_data', {}),
                requirements=data.get('requirements', {}),
                weather_forecast=data.get('weather_forecast')
            )
            
            plans[tray_id] = plan
        
        return plans
    
    def consolidate_actions(self, plans: Dict[str, ActionPlan]) -> Dict:
        """
        整合所有行动计划，按类型分组
        
        Args:
            plans: 所有苗盘的行动计划
            
        Returns:
            按类型分组的操作汇总
        """
        consolidated = {
            'urgent_actions': [],
            'light_actions': [],
            'irrigation_actions': [],
            'monitoring_actions': [],
            'summary': {
                'total_trays': len(plans),
                'urgent_count': 0,
                'needs_light': 0,
                'needs_water': 0,
                'total_estimated_cost': 0.0
            }
        }
        
        for tray_id, plan in plans.items():
            consolidated['summary']['total_estimated_cost'] += plan.estimated_cost
            
            if 'P0' in plan.priority or 'P1' in plan.priority:
                consolidated['summary']['urgent_count'] += 1
            
            for action in plan.light_actions:
                if action.get('type') == 'supplemental_light':
                    consolidated['summary']['needs_light'] += 1
                    consolidated['light_actions'].append({
                        'tray_id': tray_id,
                        'action': action
                    })
            
            for action in plan.irrigation_actions:
                if action.get('type') in ['irrigation', 'reduce_irrigation']:
                    consolidated['summary']['needs_water'] += 1
                    consolidated['irrigation_actions'].append({
                        'tray_id': tray_id,
                        'action': action
                    })
            
            all_actions = plan.light_actions + plan.irrigation_actions + plan.monitoring_actions
            for action in all_actions:
                if '紧急' in action.get('urgency', '') or '立即' in action.get('urgency', ''):
                    consolidated['urgent_actions'].append({
                        'tray_id': tray_id,
                        'action': action
                    })
        
        return consolidated
