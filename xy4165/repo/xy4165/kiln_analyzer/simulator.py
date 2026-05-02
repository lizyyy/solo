import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from copy import deepcopy

from .data_parser import ThermocoupleData, GlazeRecipe, KilnPosition
from .curve_calculator import CurveCalculator, CurveCalculationResult
from .risk_rules import RiskAnalyzer, GlazeRiskAssessment


@dataclass
class TargetCurveParams:
    """目标曲线参数"""
    start_temp: float = 20.0
    target_temp: float = 1280.0
    heating_rate: float = 150.0
    holding_time_min: float = 30.0
    cooling_rate: float = 100.0
    end_temp: float = 200.0
    intermediate_holds: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class SimulationResult:
    """模拟结果"""
    simulation_id: str
    original_curve_name: str
    target_params: TargetCurveParams
    simulated_data: ThermocoupleData
    curve_analysis: CurveCalculationResult
    risk_assessments: List[GlazeRiskAssessment]
    comparison: Dict[str, Any]


class CurveSimulator:
    """
    曲线模拟器 - 支持调整目标曲线参数进行模拟复盘
    
    主要功能:
    1. 基于目标参数生成模拟曲线
    2. 对比实际曲线和模拟曲线
    3. 评估模拟曲线的风险
    """
    
    def __init__(self):
        """初始化模拟器"""
        self.curve_calculator = CurveCalculator()
        self.risk_analyzer = RiskAnalyzer()
        
    def generate_target_curve(self, params: TargetCurveParams, 
                                name: str = "simulated_curve") -> ThermocoupleData:
        """
        基于目标参数生成模拟曲线
        
        Args:
            params: 目标曲线参数
            name: 曲线名称
            
        Returns:
            模拟的热电偶数据
        """
        time_points = []
        temp_points = []
        
        current_time = pd.Timestamp('2024-01-01 00:00:00')
        current_temp = params.start_temp
        
        time_points.append(current_time)
        temp_points.append(current_temp)
        
        for hold in params.intermediate_holds:
            hold_temp = hold.get('temperature', 500)
            hold_duration = hold.get('duration_min', 15)
            
            if current_temp < hold_temp:
                time_needed = (hold_temp - current_temp) / params.heating_rate * 60
                steps = max(int(time_needed), 10)
                
                for i in range(1, steps + 1):
                    temp_step = current_temp + (hold_temp - current_temp) * i / steps
                    time_step = current_time + timedelta(minutes=time_needed * i / steps)
                    time_points.append(time_step)
                    temp_points.append(temp_step)
                
                current_temp = hold_temp
                current_time = time_step
            elif current_temp > hold_temp:
                time_needed = (current_temp - hold_temp) / params.cooling_rate * 60
                steps = max(int(time_needed), 10)
                
                for i in range(1, steps + 1):
                    temp_step = current_temp - (current_temp - hold_temp) * i / steps
                    time_step = current_time + timedelta(minutes=time_needed * i / steps)
                    time_points.append(time_step)
                    temp_points.append(temp_step)
                
                current_temp = hold_temp
                current_time = time_step
            
            hold_steps = max(int(hold_duration), 5)
            for i in range(1, hold_steps + 1):
                time_step = current_time + timedelta(minutes=hold_duration * i / hold_steps)
                time_points.append(time_step)
                temp_points.append(current_temp)
            
            current_time = time_step
        
        if current_temp < params.target_temp:
            time_needed = (params.target_temp - current_temp) / params.heating_rate * 60
            steps = max(int(time_needed), 20)
            
            for i in range(1, steps + 1):
                temp_step = current_temp + (params.target_temp - current_temp) * i / steps
                time_step = current_time + timedelta(minutes=time_needed * i / steps)
                time_points.append(time_step)
                temp_points.append(temp_step)
            
            current_temp = params.target_temp
            current_time = time_step
        
        hold_steps = max(int(params.holding_time_min), 10)
        for i in range(1, hold_steps + 1):
            time_step = current_time + timedelta(minutes=params.holding_time_min * i / hold_steps)
            time_points.append(time_step)
            temp_points.append(current_temp + np.random.normal(0, 1))
        
        current_time = time_step
        
        if current_temp > params.end_temp:
            time_needed = (current_temp - params.end_temp) / params.cooling_rate * 60
            steps = max(int(time_needed), 20)
            
            for i in range(1, steps + 1):
                temp_step = current_temp - (current_temp - params.end_temp) * i / steps
                time_step = current_time + timedelta(minutes=time_needed * i / steps)
                time_points.append(time_step)
                temp_points.append(temp_step)
        
        time_index = pd.DatetimeIndex(time_points)
        temp_series = pd.Series(temp_points, name='temperature')
        
        return ThermocoupleData(
            name=name,
            time_series=time_index,
            temperatures=temp_series,
            metadata={
                'type': 'simulated',
                'target_params': {
                    'start_temp': params.start_temp,
                    'target_temp': params.target_temp,
                    'heating_rate': params.heating_rate,
                    'holding_time_min': params.holding_time_min,
                    'cooling_rate': params.cooling_rate,
                    'end_temp': params.end_temp,
                    'intermediate_holds': params.intermediate_holds
                }
            }
        )
    
    def adjust_from_actual(self, actual_data: ThermocoupleData,
                            adjustments: Dict[str, Any]) -> TargetCurveParams:
        """
        基于实际曲线和调整参数生成目标曲线参数
        
        Args:
            actual_data: 实际热电偶数据
            adjustments: 调整参数字典
            
        Returns:
            目标曲线参数
        """
        df = actual_data.data_frame.copy()
        
        actual_max = df['temperature'].max()
        actual_min = df['temperature'].min()
        
        target_temp = adjustments.get('target_temp', actual_max)
        heating_rate = adjustments.get('heating_rate', 150.0)
        holding_time = adjustments.get('holding_time_min', 30.0)
        cooling_rate = adjustments.get('cooling_rate', 100.0)
        
        intermediate_holds = adjustments.get('intermediate_holds', [])
        
        return TargetCurveParams(
            start_temp=actual_min,
            target_temp=target_temp,
            heating_rate=heating_rate,
            holding_time_min=holding_time,
            cooling_rate=cooling_rate,
            end_temp=200.0,
            intermediate_holds=intermediate_holds
        )
    
    def simulate_with_params(self, actual_data: ThermocoupleData,
                              params: TargetCurveParams,
                              glaze_recipes: Optional[Dict[str, GlazeRecipe]] = None,
                              positions: Optional[Dict[str, KilnPosition]] = None,
                              simulation_id: Optional[str] = None) -> SimulationResult:
        """
        使用指定参数进行模拟
        
        Args:
            actual_data: 实际热电偶数据
            params: 目标曲线参数
            glaze_recipes: 釉料配方字典(可选)
            positions: 窑位字典(可选)
            simulation_id: 模拟ID(可选)
            
        Returns:
            模拟结果
        """
        if simulation_id is None:
            simulation_id = f"sim_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        simulated_data = self.generate_target_curve(params, name=f"{actual_data.name}_simulated")
        
        curve_analysis = self.curve_calculator.calculate_full_curve(
            simulated_data, params.target_temp
        )
        
        risk_assessments = []
        if glaze_recipes and positions:
            simulated_thermocouples = {simulated_data.name: simulated_data}
            risk_assessments = self.risk_analyzer.analyze_all_positions(
                simulated_thermocouples, positions, glaze_recipes
            )
        
        comparison = self._compare_curves(actual_data, simulated_data)
        
        return SimulationResult(
            simulation_id=simulation_id,
            original_curve_name=actual_data.name,
            target_params=params,
            simulated_data=simulated_data,
            curve_analysis=curve_analysis,
            risk_assessments=risk_assessments,
            comparison=comparison
        )
    
    def _compare_curves(self, actual: ThermocoupleData, 
                        simulated: ThermocoupleData) -> Dict[str, Any]:
        """
        比较实际曲线和模拟曲线
        
        Args:
            actual: 实际热电偶数据
            simulated: 模拟热电偶数据
            
        Returns:
            比较结果字典
        """
        actual_df = actual.data_frame.copy()
        simulated_df = simulated.data_frame.copy()
        
        actual_stats = {
            'max_temp': float(actual_df['temperature'].max()),
            'min_temp': float(actual_df['temperature'].min()),
            'avg_temp': float(actual_df['temperature'].mean()),
            'duration_min': (actual_df.index[-1] - actual_df.index[0]).total_seconds() / 60
        }
        
        simulated_stats = {
            'max_temp': float(simulated_df['temperature'].max()),
            'min_temp': float(simulated_df['temperature'].min()),
            'avg_temp': float(simulated_df['temperature'].mean()),
            'duration_min': (simulated_df.index[-1] - simulated_df.index[0]).total_seconds() / 60
        }
        
        differences = {
            'max_temp_diff': simulated_stats['max_temp'] - actual_stats['max_temp'],
            'min_temp_diff': simulated_stats['min_temp'] - actual_stats['min_temp'],
            'avg_temp_diff': simulated_stats['avg_temp'] - actual_stats['avg_temp'],
            'duration_diff': simulated_stats['duration_min'] - actual_stats['duration_min']
        }
        
        return {
            'actual_stats': actual_stats,
            'simulated_stats': simulated_stats,
            'differences': differences
        }
    
    def run_multiple_simulations(self, actual_data: ThermocoupleData,
                                   param_variations: List[Dict[str, Any]],
                                   glaze_recipes: Optional[Dict[str, GlazeRecipe]] = None,
                                   positions: Optional[Dict[str, KilnPosition]] = None) -> List[SimulationResult]:
        """
        运行多个模拟，对比不同参数组合
        
        Args:
            actual_data: 实际热电偶数据
            param_variations: 参数变化列表
            glaze_recipes: 釉料配方字典(可选)
            positions: 窑位字典(可选)
            
        Returns:
            模拟结果列表
        """
        results = []
        
        for i, variations in enumerate(param_variations):
            base_params = self.adjust_from_actual(actual_data, variations)
            
            result = self.simulate_with_params(
                actual_data=actual_data,
                params=base_params,
                glaze_recipes=glaze_recipes,
                positions=positions,
                simulation_id=f"sim_variation_{i}"
            )
            results.append(result)
        
        return results
    
    def suggest_improvements(self, actual_risks: List[GlazeRiskAssessment],
                              actual_data: ThermocoupleData) -> List[Dict[str, Any]]:
        """
        基于实际风险评估，建议改进的参数组合
        
        Args:
            actual_risks: 实际风险评估列表
            actual_data: 实际热电偶数据
            
        Returns:
            建议的参数调整列表
        """
        suggestions = []
        
        has_cracking_risk = False
        has_glaze_run_risk = False
        has_under_fired_risk = False
        has_over_fired_risk = False
        
        for assessment in actual_risks:
            for risk in assessment.risks:
                if '开裂' in risk.risk_type.value or '热震' in risk.risk_type.value:
                    has_cracking_risk = True
                if '流釉' in risk.risk_type.value:
                    has_glaze_run_risk = True
                if '欠烧' in risk.risk_type.value:
                    has_under_fired_risk = True
                if '过烧' in risk.risk_type.value:
                    has_over_fired_risk = True
        
        df = actual_data.data_frame.copy()
        current_max = df['temperature'].max()
        
        if has_cracking_risk:
            suggestions.append({
                'description': '降低升温速率以减少开裂风险',
                'adjustments': {
                    'heating_rate': 100.0,
                    'intermediate_holds': [
                        {'temperature': 500, 'duration_min': 20},
                        {'temperature': 800, 'duration_min': 15}
                    ]
                },
                'expected_benefit': '降低石英相变区域的热应力，减少坯体开裂'
            })
        
        if has_glaze_run_risk:
            suggestions.append({
                'description': '缩短保温时间以减少流釉风险',
                'adjustments': {
                    'holding_time_min': 20.0,
                    'target_temp': current_max - 10.0
                },
                'expected_benefit': '减少釉料过度熔融，降低流釉概率'
            })
        
        if has_under_fired_risk:
            suggestions.append({
                'description': '增加保温时间和温度以避免欠烧',
                'adjustments': {
                    'holding_time_min': 45.0,
                    'target_temp': current_max + 10.0
                },
                'expected_benefit': '确保釉料充分熔融和坯体瓷化'
            })
        
        if has_over_fired_risk:
            suggestions.append({
                'description': '降低最高温度以避免过烧',
                'adjustments': {
                    'target_temp': current_max - 20.0,
                    'holding_time_min': 25.0
                },
                'expected_benefit': '防止釉料起泡、流釉和坯体过烧'
            })
        
        if not suggestions:
            suggestions.append({
                'description': '当前参数基本合理，可微调优化',
                'adjustments': {
                    'heating_rate': 140.0,
                    'holding_time_min': 30.0
                },
                'expected_benefit': '保持当前良好烧成效果，微调以获得更稳定的结果'
            })
        
        return suggestions
