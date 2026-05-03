"""
测试规则引擎模块
"""

import pytest
import tempfile
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any

from calibrator.rules import RiskEvaluator, ActionPlanner
from calibrator.rules.risk_evaluator import RiskResult


class TestRiskEvaluator:
    """测试风险评估器"""
    
    def setup_method(self):
        self.evaluator = RiskEvaluator()
    
    def _create_test_dli_data(self, latest_dli: float = 15.0, days: int = 3) -> Dict:
        """创建测试DLI数据"""
        daily_dli = {}
        base_date = datetime(2026, 5, 1)
        for i in range(days):
            date_str = (base_date + timedelta(days=i)).strftime('%Y-%m-%d')
            daily_dli[date_str] = latest_dli + (i - 1) * 2
        
        return {
            'daily_dli': daily_dli,
            'weekly_stats': {
                'weekly_total': sum(daily_dli.values()),
                'weekly_avg': sum(daily_dli.values()) / len(daily_dli)
            }
        }
    
    def _create_test_moisture_analysis(self, current_moisture: float = 65.0, 
                                         risk_level: str = 'normal',
                                         trend_direction: str = 'stable') -> Dict:
        """创建测试水分分析数据"""
        status_map = {
            'critical': '严重干旱',
            'high': '偏干',
            'medium': '水分正常',
            'normal': '适宜'
        }
        
        return {
            'risk': {
                'current_risk': risk_level,
                'current_status': status_map.get(risk_level, '适宜'),
                'current_moisture': current_moisture,
                'distribution': {
                    'below_wilting_point': 0,
                    'below_min_threshold': 0,
                    'within_optimal': 10,
                    'above_optimal': 0,
                    'above_field_capacity': 0,
                    'total': 10
                }
            },
            'trend': {
                'direction': trend_direction,
                'description': '稳定' if trend_direction == 'stable' else '下降',
                'slope_per_hour': -0.5 if 'decreasing' in trend_direction else 0
            },
            'daily_stats': [
                {
                    'date': '2026-05-01',
                    'morning_moisture': 68.0,
                    'evening_moisture': 62.0,
                    'daily_change': -6.0
                }
            ]
        }
    
    def _create_test_requirements(self) -> Dict:
        """创建测试品种需求参数"""
        return {
            'dli_min': 8.0,
            'dli_optimal': 15.0,
            'dli_max': 25.0,
            'moisture_min': 55.0,
            'moisture_optimal': 70.0,
            'moisture_max': 85.0,
            'temp_min': 20.0,
            'temp_optimal': 25.0,
            'temp_max': 30.0
        }
    
    def _create_test_et0_data(self, et0: float = 4.0) -> Dict:
        """创建测试蒸散数据"""
        return {
            'et0': et0,
            'actual_evapotranspiration': et0 * 0.8,
            'water_deficit': {
                'current_moisture': 65.0,
                'field_capacity': 70.0,
                'depletion_percent': 15.0,
                'irrigation_needed_mm': 2.5
            }
        }
    
    def test_evaluate_tray_normal_case(self):
        """测试正常情况下的风险评估"""
        tray_id = 'TRAY-01'
        dli_data = self._create_test_dli_data(latest_dli=18.0)
        moisture_analysis = self._create_test_moisture_analysis(
            current_moisture=70.0,
            risk_level='normal'
        )
        et0_data = self._create_test_et0_data(et0=3.5)
        requirements = self._create_test_requirements()
        
        result = self.evaluator.evaluate_tray(
            tray_id=tray_id,
            dli_data=dli_data,
            moisture_analysis=moisture_analysis,
            et0_data=et0_data,
            tray_requirements=requirements
        )
        
        assert result.tray_id == tray_id
        assert result.overall_risk == 'normal'
        assert result.overall_score == 5
        assert len(result.warnings) == 0
    
    def test_evaluate_tray_light_critical(self):
        """测试光照严重不足的情况"""
        tray_id = 'TRAY-01'
        dli_data = self._create_test_dli_data(latest_dli=5.0)
        moisture_analysis = self._create_test_moisture_analysis(
            current_moisture=70.0,
            risk_level='normal'
        )
        et0_data = self._create_test_et0_data(et0=3.5)
        requirements = self._create_test_requirements()
        
        result = self.evaluator.evaluate_tray(
            tray_id=tray_id,
            dli_data=dli_data,
            moisture_analysis=moisture_analysis,
            et0_data=et0_data,
            tray_requirements=requirements
        )
        
        assert result.overall_risk == 'critical'
        assert result.light_risk['level'] == 'critical'
        assert '严重' in result.light_risk['status']
        assert len(result.warnings) > 0
    
    def test_evaluate_tray_moisture_critical(self):
        """测试水分严重不足的情况"""
        tray_id = 'TRAY-01'
        dli_data = self._create_test_dli_data(latest_dli=18.0)
        moisture_analysis = self._create_test_moisture_analysis(
            current_moisture=25.0,
            risk_level='critical'
        )
        et0_data = self._create_test_et0_data(et0=5.0)
        requirements = self._create_test_requirements()
        
        result = self.evaluator.evaluate_tray(
            tray_id=tray_id,
            dli_data=dli_data,
            moisture_analysis=moisture_analysis,
            et0_data=et0_data,
            tray_requirements=requirements
        )
        
        assert result.overall_risk == 'critical'
        assert result.moisture_risk['level'] == 'critical'
        assert len(result.recommendations) > 0
    
    def test_evaluate_tray_both_high_risk(self):
        """测试光照和水分同时高风险的情况"""
        tray_id = 'TRAY-01'
        dli_data = self._create_test_dli_data(latest_dli=6.0)
        moisture_analysis = self._create_test_moisture_analysis(
            current_moisture=45.0,
            risk_level='high'
        )
        et0_data = self._create_test_et0_data(et0=5.0)
        requirements = self._create_test_requirements()
        
        result = self.evaluator.evaluate_tray(
            tray_id=tray_id,
            dli_data=dli_data,
            moisture_analysis=moisture_analysis,
            et0_data=et0_data,
            tray_requirements=requirements
        )
        
        assert result.overall_risk in ['critical', 'high']
        assert result.combined_risk['weighted_score'] < 3.0
    
    def test_evaluate_light_risk_above_max(self):
        """测试光照过强的情况"""
        tray_id = 'TRAY-01'
        dli_data = self._create_test_dli_data(latest_dli=45.0)
        moisture_analysis = self._create_test_moisture_analysis(
            current_moisture=70.0,
            risk_level='normal'
        )
        et0_data = self._create_test_et0_data(et0=3.5)
        requirements = self._create_test_requirements()
        
        result = self.evaluator.evaluate_tray(
            tray_id=tray_id,
            dli_data=dli_data,
            moisture_analysis=moisture_analysis,
            et0_data=et0_data,
            tray_requirements=requirements
        )
        
        assert result.light_risk['level'] == 'high'
        assert '过强' in result.light_risk['status']
    
    def test_evaluate_moisture_risk_too_wet(self):
        """测试水分过湿的情况"""
        tray_id = 'TRAY-01'
        dli_data = self._create_test_dli_data(latest_dli=18.0)
        moisture_analysis = {
            'risk': {
                'current_risk': 'high',
                'current_status': '水分过湿',
                'current_moisture': 88.0,
                'distribution': {
                    'below_wilting_point': 0,
                    'below_min_threshold': 0,
                    'within_optimal': 5,
                    'above_optimal': 0,
                    'above_field_capacity': 5,
                    'total': 10
                }
            },
            'trend': {
                'direction': 'increasing',
                'description': '上升',
                'slope_per_hour': 1.0
            },
            'daily_stats': []
        }
        et0_data = self._create_test_et0_data(et0=2.0)
        requirements = self._create_test_requirements()
        
        result = self.evaluator.evaluate_tray(
            tray_id=tray_id,
            dli_data=dli_data,
            moisture_analysis=moisture_analysis,
            et0_data=et0_data,
            tray_requirements=requirements
        )
        
        assert result.moisture_risk['level'] == 'high'
        assert '湿' in result.moisture_risk['status']
    
    def test_batch_evaluate(self):
        """测试批量评估"""
        trays_data = {
            'TRAY-01': {
                'dli_data': self._create_test_dli_data(latest_dli=6.0),
                'moisture_analysis': self._create_test_moisture_analysis(current_moisture=45.0, risk_level='high'),
                'et0_data': self._create_test_et0_data(et0=5.0),
                'requirements': self._create_test_requirements(),
                'inspection': {}
            },
            'TRAY-02': {
                'dli_data': self._create_test_dli_data(latest_dli=18.0),
                'moisture_analysis': self._create_test_moisture_analysis(current_moisture=70.0, risk_level='normal'),
                'et0_data': self._create_test_et0_data(et0=3.5),
                'requirements': self._create_test_requirements(),
                'inspection': {}
            }
        }
        
        results = self.evaluator.batch_evaluate(trays_data)
        
        assert len(results) == 2
        assert 'TRAY-01' in results
        assert 'TRAY-02' in results
        assert isinstance(results['TRAY-01'], RiskResult)
        assert isinstance(results['TRAY-02'], RiskResult)
    
    def test_get_priority_trays(self):
        """测试获取优先处理苗盘"""
        results = {
            'TRAY-01': RiskResult(
                tray_id='TRAY-01',
                overall_risk='critical',
                overall_score=1,
                light_risk={'level': 'critical'},
                moisture_risk={'level': 'normal'},
                combined_risk={'level': 'critical', 'score': 1},
                warnings=['光照严重不足'],
                recommendations=['建议补光']
            ),
            'TRAY-02': RiskResult(
                tray_id='TRAY-02',
                overall_risk='normal',
                overall_score=5,
                light_risk={'level': 'normal'},
                moisture_risk={'level': 'normal'},
                combined_risk={'level': 'normal', 'score': 5},
                warnings=[],
                recommendations=[]
            ),
            'TRAY-03': RiskResult(
                tray_id='TRAY-03',
                overall_risk='high',
                overall_score=2,
                light_risk={'level': 'high'},
                moisture_risk={'level': 'normal'},
                combined_risk={'level': 'high', 'score': 2},
                warnings=['光照偏低'],
                recommendations=['建议补光']
            )
        }
        
        priority = self.evaluator.get_priority_trays(results, limit=3)
        
        assert len(priority) == 3
        assert priority[0].tray_id == 'TRAY-01'
        assert priority[1].tray_id == 'TRAY-03'
        assert priority[2].tray_id == 'TRAY-02'


class TestActionPlanner:
    """测试行动计划器"""
    
    def setup_method(self):
        self.planner = ActionPlanner()
        self.evaluator = RiskEvaluator()
    
    def _create_risk_result(self, tray_id: str, overall_risk: str, 
                             light_risk_level: str = 'normal',
                             moisture_risk_level: str = 'normal') -> RiskResult:
        """创建测试风险评估结果"""
        light_status_map = {
            'critical': '光照严重不足',
            'high': '光照偏低',
            'medium': '光照正常',
            'normal': '光照适宜'
        }
        
        moisture_status_map = {
            'critical': '严重干旱',
            'high': '偏干',
            'medium': '水分正常',
            'normal': '水分适宜'
        }
        
        return RiskResult(
            tray_id=tray_id,
            overall_risk=overall_risk,
            overall_score=1 if overall_risk == 'critical' else 5,
            light_risk={
                'level': light_risk_level,
                'status': light_status_map.get(light_risk_level, '正常'),
                'score': 1 if light_risk_level == 'critical' else 5,
                'details': {
                    'latest_dli': 5.0 if light_risk_level == 'critical' else 18.0,
                    'dli_requirements': {
                        'min': 8.0,
                        'optimal_min': 15.0,
                        'optimal_max': 25.0,
                        'max_threshold': 40.0
                    }
                }
            },
            moisture_risk={
                'level': moisture_risk_level,
                'status': moisture_status_map.get(moisture_risk_level, '正常'),
                'score': 1 if moisture_risk_level == 'critical' else 5,
                'details': {
                    'current_moisture': 25.0 if moisture_risk_level == 'critical' else 70.0,
                    'moisture_requirements': {
                        'min': 55.0,
                        'optimal': 70.0,
                        'max': 85.0
                    },
                    'trend': '稳定',
                    'et0': 4.0
                }
            },
            combined_risk={
                'level': overall_risk,
                'score': 1 if overall_risk == 'critical' else 5,
                'weighted_score': 1.0 if overall_risk == 'critical' else 5.0
            },
            warnings=['光照严重不足'] if light_risk_level == 'critical' else [],
            recommendations=['建议补光'] if light_risk_level == 'critical' else []
        )
    
    def test_generate_plan_light_critical(self):
        """测试光照严重不足时的行动计划"""
        tray_id = 'TRAY-01'
        risk_result = self._create_risk_result(
            tray_id=tray_id,
            overall_risk='critical',
            light_risk_level='critical'
        )
        
        dli_data = {'daily_dli': {'2026-05-01': 5.0}}
        moisture_analysis = {
            'risk': {'current_risk': 'normal'},
            'daily_stats': [{'daily_change': -3.0}]
        }
        et0_data = {'et0': 4.0}
        requirements = {
            'dli_min': 8.0,
            'dli_optimal': 15.0,
            'moisture_optimal': 70.0
        }
        
        plan = self.planner.generate_plan(
            tray_id=tray_id,
            risk_result=risk_result,
            dli_data=dli_data,
            moisture_analysis=moisture_analysis,
            et0_data=et0_data,
            requirements=requirements
        )
        
        assert plan.tray_id == tray_id
        assert 'P0' in plan.priority or '紧急' in plan.priority
        assert len(plan.light_actions) > 0
        
        light_action = plan.light_actions[0]
        assert light_action['type'] == 'supplemental_light'
        assert '补光' in light_action['action']
    
    def test_generate_plan_moisture_critical(self):
        """测试水分严重不足时的行动计划"""
        tray_id = 'TRAY-01'
        risk_result = self._create_risk_result(
            tray_id=tray_id,
            overall_risk='critical',
            moisture_risk_level='critical'
        )
        
        dli_data = {'daily_dli': {'2026-05-01': 18.0}}
        moisture_analysis = {
            'risk': {
                'current_risk': 'critical',
                'current_status': '严重缺水'
            },
            'daily_stats': [{'daily_change': -10.0}]
        }
        et0_data = {'et0': 5.5}
        requirements = {
            'dli_optimal': 15.0,
            'moisture_optimal': 70.0
        }
        
        plan = self.planner.generate_plan(
            tray_id=tray_id,
            risk_result=risk_result,
            dli_data=dli_data,
            moisture_analysis=moisture_analysis,
            et0_data=et0_data,
            requirements=requirements
        )
        
        assert plan.tray_id == tray_id
        assert 'P0' in plan.priority or '紧急' in plan.priority
        assert len(plan.irrigation_actions) > 0
        
        irrigation_action = plan.irrigation_actions[0]
        assert irrigation_action['type'] == 'irrigation'
        assert '浇水' in irrigation_action['action']
    
    def test_calculate_supplement_hours(self):
        """测试计算补光时长"""
        dli_deficit = 10.0
        ppfd = 150
        
        hours = self.planner._calculate_supplement_hours(dli_deficit, ppfd)
        
        expected_seconds = (dli_deficit * 1e6) / ppfd
        expected_hours = expected_seconds / 3600
        
        assert hours == pytest.approx(expected_hours, 0.1)
        assert hours > 0
    
    def test_estimate_light_energy(self):
        """测试估算补光能耗"""
        dli_deficit = 10.0
        hours = 5.0
        
        energy = self.planner._estimate_light_energy(dli_deficit, hours)
        
        assert energy > 0
    
    def test_calculate_irrigation_amount(self):
        """测试计算灌溉量"""
        current_moisture = 50.0
        target_moisture = 70.0
        
        amount = self.planner._calculate_irrigation_amount(
            current_moisture, target_moisture
        )
        
        assert amount > 0
        assert amount >= 0.1
    
    def test_determine_priority(self):
        """测试确定优先级"""
        critical_result = self._create_risk_result('TRAY-01', 'critical')
        high_result = self._create_risk_result('TRAY-02', 'high')
        normal_result = self._create_risk_result('TRAY-03', 'normal')
        
        assert 'P0' in self.planner._determine_priority(critical_result)
        assert 'P1' in self.planner._determine_priority(high_result)
        assert 'P3' in self.planner._determine_priority(normal_result)
    
    def test_generate_batch_plans(self):
        """测试批量生成行动计划"""
        risk_results = {
            'TRAY-01': self._create_risk_result('TRAY-01', 'normal'),
            'TRAY-02': self._create_risk_result('TRAY-02', 'normal')
        }
        
        trays_data = {
            'TRAY-01': {
                'dli_data': {'daily_dli': {'2026-05-01': 18.0}},
                'moisture_analysis': {'risk': {'current_risk': 'normal'}, 'daily_stats': []},
                'et0_data': {'et0': 4.0},
                'requirements': {},
                'weather_forecast': None
            },
            'TRAY-02': {
                'dli_data': {'daily_dli': {'2026-05-01': 18.0}},
                'moisture_analysis': {'risk': {'current_risk': 'normal'}, 'daily_stats': []},
                'et0_data': {'et0_data': 4.0},
                'requirements': {},
                'weather_forecast': None
            }
        }
        
        plans = self.planner.generate_batch_plans(trays_data, risk_results)
        
        assert len(plans) == 2
        assert 'TRAY-01' in plans
        assert 'TRAY-02' in plans
    
    def test_consolidate_actions(self):
        """测试整合操作"""
        from calibrator.rules.action_planner import ActionPlan
        
        plans = {
            'TRAY-01': ActionPlan(
                tray_id='TRAY-01',
                light_actions=[{
                    'type': 'supplemental_light',
                    'priority': 'high',
                    'action': '补光',
                    'details': {'estimated_cost_yuan': 2.5},
                    'urgency': '立即执行'
                }],
                irrigation_actions=[{
                    'type': 'irrigation',
                    'priority': 'high',
                    'action': '浇水',
                    'details': {},
                    'urgency': '立即执行'
                }],
                monitoring_actions=[],
                priority='P0 - 紧急',
                estimated_cost=3.0
            ),
            'TRAY-02': ActionPlan(
                tray_id='TRAY-02',
                light_actions=[],
                irrigation_actions=[],
                monitoring_actions=[],
                priority='P3 - 正常',
                estimated_cost=0.0
            )
        }
        
        consolidated = self.planner.consolidate_actions(plans)
        
        assert consolidated['summary']['total_trays'] == 2
        assert consolidated['summary']['urgent_count'] == 1
        assert consolidated['summary']['needs_light'] == 1
        assert consolidated['summary']['needs_water'] == 1
        assert consolidated['summary']['total_estimated_cost'] == 3.0
        assert len(consolidated['light_actions']) == 1
        assert len(consolidated['irrigation_actions']) == 1
