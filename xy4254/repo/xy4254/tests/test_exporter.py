"""
测试导出模块
"""

import pytest
import tempfile
import os
import json
import csv
from datetime import datetime
from typing import Dict, List, Any

from calibrator.exporter import MarkdownExporter, CSVExporter, JSONExporter
from calibrator.rules.risk_evaluator import RiskResult
from calibrator.rules.action_planner import ActionPlan


class TestMarkdownExporter:
    """测试Markdown导出器"""
    
    def setup_method(self):
        self.exporter = MarkdownExporter()
    
    def _create_test_risk_results(self) -> Dict:
        """创建测试风险评估结果"""
        return {
            'TRAY-01': RiskResult(
                tray_id='TRAY-01',
                overall_risk='critical',
                overall_score=1,
                light_risk={
                    'level': 'critical',
                    'status': '光照严重不足',
                    'score': 1,
                    'details': {
                        'latest_dli': 5.0,
                        'dli_requirements': {
                            'min': 8.0,
                            'optimal_min': 15.0,
                            'optimal_max': 25.0,
                            'max_threshold': 40.0
                        }
                    }
                },
                moisture_risk={
                    'level': 'normal',
                    'status': '水分适宜',
                    'score': 5,
                    'details': {
                        'current_moisture': 70.0,
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
                    'level': 'critical',
                    'score': 1,
                    'weighted_score': 2.8
                },
                warnings=['【严重】TRAY-01 光照严重不足'],
                recommendations=['TRAY-01 建议补光：当前DLI 5.0，目标 15.0，缺口约 10.0 mol/m²/day']
            ),
            'TRAY-02': RiskResult(
                tray_id='TRAY-02',
                overall_risk='normal',
                overall_score=5,
                light_risk={
                    'level': 'normal',
                    'status': '光照适宜',
                    'score': 5,
                    'details': {
                        'latest_dli': 18.0,
                        'dli_requirements': {
                            'min': 8.0,
                            'optimal_min': 15.0,
                            'optimal_max': 25.0,
                            'max_threshold': 40.0
                        }
                    }
                },
                moisture_risk={
                    'level': 'normal',
                    'status': '水分适宜',
                    'score': 5,
                    'details': {
                        'current_moisture': 68.0,
                        'moisture_requirements': {
                            'min': 55.0,
                            'optimal': 70.0,
                            'max': 85.0
                        },
                        'trend': '稳定',
                        'et0': 3.5
                    }
                },
                combined_risk={
                    'level': 'normal',
                    'score': 5,
                    'weighted_score': 5.0
                },
                warnings=[],
                recommendations=[]
            )
        }
    
    def _create_test_action_plans(self) -> Dict:
        """创建测试行动计划"""
        return {
            'TRAY-01': ActionPlan(
                tray_id='TRAY-01',
                light_actions=[{
                    'type': 'supplemental_light',
                    'priority': 'high',
                    'action': '为TRAY-01开启补光灯',
                    'details': {
                        'current_dli': 5.0,
                        'target_dli': 15.0,
                        'deficit': 10.0,
                        'recommended_hours': 9.3,
                        'suggested_time': '早晨8:00-10:00 或 傍晚16:00-18:00',
                        'estimated_energy_kwh': 0.5,
                        'estimated_cost_yuan': 0.4
                    },
                    'urgency': '立即执行'
                }],
                irrigation_actions=[],
                monitoring_actions=[{
                    'type': 'enhanced_monitoring',
                    'priority': 'high',
                    'action': '加强TRAY-01的监测频率',
                    'details': {
                        'check_frequency': '每2小时检查一次'
                    },
                    'urgency': '持续执行直至风险解除'
                }],
                priority='P0 - 紧急',
                estimated_cost=0.4
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
    
    def _create_test_consolidated_actions(self) -> Dict:
        """创建测试整合操作"""
        return {
            'urgent_actions': [
                {
                    'tray_id': 'TRAY-01',
                    'action': {
                        'type': 'supplemental_light',
                        'priority': 'high',
                        'action': '为TRAY-01开启补光灯',
                        'urgency': '立即执行',
                        'details': {}
                    }
                }
            ],
            'light_actions': [
                {
                    'tray_id': 'TRAY-01',
                    'action': {
                        'type': 'supplemental_light',
                        'priority': 'high',
                        'action': '为TRAY-01开启补光灯',
                        'details': {
                            'current_dli': 5.0,
                            'target_dli': 15.0,
                            'recommended_hours': 9.3,
                            'estimated_energy_kwh': 0.5,
                            'estimated_cost_yuan': 0.4
                        },
                        'urgency': '立即执行'
                    }
                }
            ],
            'irrigation_actions': [],
            'monitoring_actions': [],
            'summary': {
                'total_trays': 2,
                'urgent_count': 1,
                'needs_light': 1,
                'needs_water': 0,
                'total_estimated_cost': 0.4
            }
        }
    
    def _create_test_analysis_result(self) -> Dict:
        """创建测试分析结果"""
        return {
            'sensor_summary': {
                'total_records': 144,
                'tray_count': 2,
                'tray_ids': ['TRAY-01', 'TRAY-02'],
                'date_range': {
                    'start': '2026-05-01 00:00:00',
                    'end': '2026-05-01 23:30:00'
                }
            },
            'tray_summary': {
                'tray_count': 2,
                'tray_ids': ['TRAY-01', 'TRAY-02'],
                'stage_distribution': {
                    '幼苗期': 2
                },
                'variety_distribution': {
                    '樱桃番茄': 2
                }
            },
            'weather_summary': {
                'forecast_days': 3,
                'dates': ['2026-05-01', '2026-05-02', '2026-05-03'],
                'avg_temperature': 22.5,
                'avg_humidity': 65.0,
                'avg_irradiance': 450.0
            },
            'inspection_summary': {
                'total_inspections': 4,
                'inspected_tray_count': 2,
                'rating_distribution': {5: 2, 4: 2},
                'moisture_distribution': {'正常': 4}
            }
        }
    
    def test_export_generates_file(self):
        """测试导出生成文件"""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, 'report.md')
            
            risk_results = self._create_test_risk_results()
            action_plans = self._create_test_action_plans()
            analysis_result = self._create_test_analysis_result()
            consolidated = self._create_test_consolidated_actions()
            
            content = self.exporter.export(
                output_path=output_path,
                analysis_result=analysis_result,
                risk_results=risk_results,
                action_plans=action_plans,
                consolidated_actions=consolidated
            )
            
            assert os.path.exists(output_path)
            assert len(content) > 0
    
    def test_export_contains_header(self):
        """测试导出包含头部"""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, 'report.md')
            
            risk_results = self._create_test_risk_results()
            action_plans = self._create_test_action_plans()
            analysis_result = self._create_test_analysis_result()
            
            content = self.exporter.export(
                output_path=output_path,
                analysis_result=analysis_result,
                risk_results=risk_results,
                action_plans=action_plans
            )
            
            assert '# 苗盘补光灌溉校准报告' in content
            assert '**生成时间**:' in content
    
    def test_export_contains_summary(self):
        """测试导出包含摘要"""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, 'report.md')
            
            risk_results = self._create_test_risk_results()
            action_plans = self._create_test_action_plans()
            analysis_result = self._create_test_analysis_result()
            
            content = self.exporter.export(
                output_path=output_path,
                analysis_result=analysis_result,
                risk_results=risk_results,
                action_plans=action_plans
            )
            
            assert '## 摘要' in content
            assert '总体概览' in content
            assert '传感器数据摘要' in content
            assert '苗盘品种分布' in content
    
    def test_export_contains_risk_overview(self):
        """测试导出包含风险概览"""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, 'report.md')
            
            risk_results = self._create_test_risk_results()
            action_plans = self._create_test_action_plans()
            analysis_result = self._create_test_analysis_result()
            
            content = self.exporter.export(
                output_path=output_path,
                analysis_result=analysis_result,
                risk_results=risk_results,
                action_plans=action_plans
            )
            
            assert '## 风险评估概览' in content
            assert '苗盘ID' in content
            assert '总体风险' in content
            assert 'TRAY-01' in content
            assert 'TRAY-02' in content
    
    def test_export_contains_tray_details(self):
        """测试导出包含苗盘详情"""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, 'report.md')
            
            risk_results = self._create_test_risk_results()
            action_plans = self._create_test_action_plans()
            analysis_result = self._create_test_analysis_result()
            
            content = self.exporter.export(
                output_path=output_path,
                analysis_result=analysis_result,
                risk_results=risk_results,
                action_plans=action_plans
            )
            
            assert '## 各苗盘详情' in content
            assert '### TRAY-01' in content
            assert '### TRAY-02' in content
    
    def test_export_contains_action_summary(self):
        """测试导出包含操作汇总"""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, 'report.md')
            
            risk_results = self._create_test_risk_results()
            action_plans = self._create_test_action_plans()
            analysis_result = self._create_test_analysis_result()
            consolidated = self._create_test_consolidated_actions()
            
            content = self.exporter.export(
                output_path=output_path,
                analysis_result=analysis_result,
                risk_results=risk_results,
                action_plans=action_plans,
                consolidated_actions=consolidated
            )
            
            assert '## 今日操作汇总' in content
            assert '紧急操作' in content
            assert '补光建议' in content
    
    def test_export_simple_summary(self):
        """测试导出简化版摘要"""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, 'summary.md')
            
            risk_results = self._create_test_risk_results()
            action_plans = self._create_test_action_plans()
            
            content = self.exporter.export_simple_summary(
                output_path=output_path,
                risk_results=risk_results,
                action_plans=action_plans
            )
            
            assert os.path.exists(output_path)
            assert '# 苗盘状态摘要' in content
            assert '严重风险' in content or '高风险' in content
            assert '正常' in content


class TestCSVExporter:
    """测试CSV导出器"""
    
    def setup_method(self):
        self.exporter = CSVExporter()
    
    def _create_test_risk_results(self) -> Dict:
        """创建测试风险评估结果"""
        return {
            'TRAY-01': RiskResult(
                tray_id='TRAY-01',
                overall_risk='critical',
                overall_score=1,
                light_risk={
                    'level': 'critical',
                    'status': '光照严重不足',
                    'score': 1,
                    'details': {
                        'latest_dli': 5.0,
                        'dli_requirements': {
                            'min': 8.0,
                            'optimal_min': 15.0,
                            'optimal_max': 25.0,
                            'max_threshold': 40.0
                        }
                    }
                },
                moisture_risk={
                    'level': 'normal',
                    'status': '水分适宜',
                    'score': 5,
                    'details': {
                        'current_moisture': 70.0,
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
                    'level': 'critical',
                    'score': 1,
                    'weighted_score': 2.8
                },
                warnings=['【严重】TRAY-01 光照严重不足'],
                recommendations=['建议补光']
            ),
            'TRAY-02': RiskResult(
                tray_id='TRAY-02',
                overall_risk='normal',
                overall_score=5,
                light_risk={
                    'level': 'normal',
                    'status': '光照适宜',
                    'score': 5,
                    'details': {
                        'latest_dli': 18.0,
                        'dli_requirements': {
                            'min': 8.0,
                            'optimal_min': 15.0,
                            'optimal_max': 25.0,
                            'max_threshold': 40.0
                        }
                    }
                },
                moisture_risk={
                    'level': 'normal',
                    'status': '水分适宜',
                    'score': 5,
                    'details': {
                        'current_moisture': 68.0,
                        'moisture_requirements': {
                            'min': 55.0,
                            'optimal': 70.0,
                            'max': 85.0
                        },
                        'trend': '稳定',
                        'et0': 3.5
                    }
                },
                combined_risk={
                    'level': 'normal',
                    'score': 5,
                    'weighted_score': 5.0
                },
                warnings=[],
                recommendations=[]
            )
        }
    
    def _create_test_action_plans(self) -> Dict:
        """创建测试行动计划"""
        return {
            'TRAY-01': ActionPlan(
                tray_id='TRAY-01',
                light_actions=[{
                    'type': 'supplemental_light',
                    'priority': 'high',
                    'action': '补光',
                    'details': {
                        'estimated_cost_yuan': 0.4
                    },
                    'urgency': '立即执行'
                }],
                irrigation_actions=[],
                monitoring_actions=[],
                priority='P0 - 紧急',
                estimated_cost=0.4
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
    
    def _create_test_consolidated_actions(self) -> Dict:
        """创建测试整合操作"""
        return {
            'urgent_actions': [
                {
                    'tray_id': 'TRAY-01',
                    'action': {
                        'type': 'supplemental_light',
                        'action': '补光',
                        'urgency': '立即执行',
                        'details': {}
                    }
                }
            ],
            'light_actions': [
                {
                    'tray_id': 'TRAY-01',
                    'action': {
                        'type': 'supplemental_light',
                        'action': '补光',
                        'details': {
                            'current_dli': 5.0,
                            'target_dli': 15.0,
                            'recommended_hours': 9.3,
                            'estimated_cost_yuan': 0.4
                        },
                        'urgency': '立即执行'
                    }
                }
            ],
            'irrigation_actions': [],
            'monitoring_actions': [],
            'summary': {
                'total_trays': 2,
                'urgent_count': 1,
                'needs_light': 1,
                'needs_water': 0,
                'total_estimated_cost': 0.4
            }
        }
    
    def test_export_risk_summary_generates_file(self):
        """测试导出风险汇总CSV"""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, 'risk_summary.csv')
            
            risk_results = self._create_test_risk_results()
            action_plans = self._create_test_action_plans()
            
            result = self.exporter.export_risk_summary(
                output_path=output_path,
                risk_results=risk_results,
                action_plans=action_plans
            )
            
            assert os.path.exists(output_path)
            assert result == output_path
            
            with open(output_path, 'r', encoding='utf-8-sig') as f:
                content = f.read()
            
            assert '苗盘ID' in content
            assert '总体风险' in content
            assert 'TRAY-01' in content
            assert 'TRAY-02' in content
    
    def test_export_action_plan_generates_file(self):
        """测试导出行动计划CSV"""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, 'action_plan.csv')
            
            consolidated = self._create_test_consolidated_actions()
            
            result = self.exporter.export_action_plan(
                output_path=output_path,
                consolidated_actions=consolidated
            )
            
            assert os.path.exists(output_path)
            assert result == output_path
            
            with open(output_path, 'r', encoding='utf-8-sig') as f:
                content = f.read()
            
            assert '优先级' in content
            assert '操作类型' in content
            assert '苗盘ID' in content
    
    def test_export_daily_metrics_generates_file(self):
        """测试导出每日指标CSV"""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, 'daily_metrics.csv')
            
            sensor_data = {}
            analysis_results = {
                'daily_stats': {
                    '2026-05-01': {
                        'TRAY-01': {
                        'avg_light': 300.0,
                        'dli': 12.0,
                        'avg_moisture': 65.0,
                        'moisture_change': -3.0,
                        'avg_temp': 22.5,
                        'avg_humidity': 60.0,
                        'et0': 4.0,
                        'risk_level': 'normal'
                    },
                        'TRAY-02': {
                        'avg_light': 400.0,
                        'dli': 18.0,
                        'avg_moisture': 68.0,
                        'moisture_change': -2.0,
                        'avg_temp': 23.0,
                        'avg_humidity': 58.0,
                        'et0': 3.5,
                        'risk_level': 'normal'
                    }
                }
            }
        }
            
            result = self.exporter.export_daily_metrics(
                output_path=output_path,
                sensor_data=sensor_data,
                analysis_results=analysis_results
            )
            
            assert os.path.exists(output_path)
            assert result == output_path
            
            with open(output_path, 'r', encoding='utf-8-sig') as f:
                content = f.read()
            
            assert '日期' in content
            assert '苗盘ID' in content
            assert 'DLI' in content


class TestJSONExporter:
    """测试JSON导出器"""
    
    def setup_method(self):
        self.exporter = JSONExporter()
    
    def _create_test_risk_results(self) -> Dict:
        """创建测试风险评估结果"""
        return {
            'TRAY-01': RiskResult(
                tray_id='TRAY-01',
                overall_risk='critical',
                overall_score=1,
                light_risk={
                    'level': 'critical',
                    'status': '光照严重不足',
                    'score': 1,
                    'details': {
                        'latest_dli': 5.0,
                        'dli_requirements': {
                            'min': 8.0,
                            'optimal_min': 15.0,
                            'optimal_max': 25.0,
                            'max_threshold': 40.0
                        }
                    }
                },
                moisture_risk={
                    'level': 'normal',
                    'status': '水分适宜',
                    'score': 5,
                    'details': {
                        'current_moisture': 70.0,
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
                    'level': 'critical',
                    'score': 1,
                    'weighted_score': 2.8
                },
                warnings=['【严重】TRAY-01 光照严重不足'],
                recommendations=['建议补光']
            ),
            'TRAY-02': RiskResult(
                tray_id='TRAY-02',
                overall_risk='normal',
                overall_score=5,
                light_risk={
                    'level': 'normal',
                    'status': '光照适宜',
                    'score': 5,
                    'details': {
                        'latest_dli': 18.0,
                        'dli_requirements': {
                            'min': 8.0,
                            'optimal_min': 15.0,
                            'optimal_max': 25.0,
                            'max_threshold': 40.0
                        }
                    }
                },
                moisture_risk={
                    'level': 'normal',
                    'status': '水分适宜',
                    'score': 5,
                    'details': {
                        'current_moisture': 68.0,
                        'moisture_requirements': {
                            'min': 55.0,
                            'optimal': 70.0,
                            'max': 85.0
                        },
                        'trend': '稳定',
                        'et0': 3.5
                    }
                },
                combined_risk={
                    'level': 'normal',
                    'score': 5,
                    'weighted_score': 5.0
                },
                warnings=[],
                recommendations=[]
            )
        }
    
    def _create_test_action_plans(self) -> Dict:
        """创建测试行动计划"""
        return {
            'TRAY-01': ActionPlan(
                tray_id='TRAY-01',
                light_actions=[{
                    'type': 'supplemental_light',
                    'priority': 'high',
                    'action': '补光',
                    'details': {
                        'estimated_cost_yuan': 0.4
                    },
                    'urgency': '立即执行'
                }],
                irrigation_actions=[],
                monitoring_actions=[],
                priority='P0 - 紧急',
                estimated_cost=0.4
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
    
    def _create_test_analysis_result(self) -> Dict:
        """创建测试分析结果"""
        return {
            'sensor_summary': {
                'total_records': 144,
                'tray_count': 2
            },
            'tray_summary': {
                'tray_count': 2
            },
            'weather_summary': {
                'forecast_days': 3
            },
            'inspection_summary': {
                'total_inspections': 4
            }
        }
    
    def test_export_full_generates_file(self):
        """测试导出完整JSON"""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, 'report.json')
            
            risk_results = self._create_test_risk_results()
            action_plans = self._create_test_action_plans()
            analysis_result = self._create_test_analysis_result()
            
            result = self.exporter.export_full(
                output_path=output_path,
                analysis_result=analysis_result,
                risk_results=risk_results,
                action_plans=action_plans
            )
            
            assert os.path.exists(output_path)
            assert result == output_path
            
            with open(output_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            assert 'metadata' in data
            assert 'analysis_summary' in data
            assert 'risk_assessment' in data
            assert 'action_plans' in data
            assert data['metadata']['total_trays'] == 2
    
    def test_export_risk_only_generates_file(self):
        """测试仅导出风险JSON"""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, 'risk.json')
            
            risk_results = self._create_test_risk_results()
            
            result = self.exporter.export_risk_only(
                output_path=output_path,
                risk_results=risk_results
            )
            
            assert os.path.exists(output_path)
            assert result == output_path
            
            with open(output_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            assert 'metadata' in data
            assert 'trays' in data
            assert 'TRAY-01' in data['trays']
            assert 'TRAY-02' in data['trays']
    
    def test_export_actions_only_generates_file(self):
        """测试仅导出行动计划JSON"""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, 'actions.json')
            
            action_plans = self._create_test_action_plans()
            
            result = self.exporter.export_actions_only(
                output_path=output_path,
                action_plans=action_plans
            )
            
            assert os.path.exists(output_path)
            assert result == output_path
            
            with open(output_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            assert 'metadata' in data
            assert 'plans' in data
            assert 'TRAY-01' in data['plans']
            assert 'TRAY-02' in data['plans']
    
    def test_export_daily_stats_generates_file(self):
        """测试导出每日统计JSON"""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, 'daily_stats.json')
            
            daily_stats = {
                '2026-05-01': {
                    'TRAY-01': {
                        'avg_light': 300.0,
                        'dli': 12.0,
                        'avg_moisture': 65.0
                    },
                    'TRAY-02': {
                        'avg_light': 400.0,
                        'dli': 18.0,
                        'avg_moisture': 68.0
                    }
                }
            }
            
            result = self.exporter.export_daily_stats(
                output_path=output_path,
                daily_stats=daily_stats
            )
            
            assert os.path.exists(output_path)
            assert result == output_path
            
            with open(output_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            assert 'metadata' in data
            assert 'daily_data' in data
            assert '2026-05-01' in data['daily_data']
