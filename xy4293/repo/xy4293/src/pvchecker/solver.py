#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
方案搜索模块 - Solver Module

自动生成优化方案：
- ConfigurationSolver: 串并联方案求解器
- Optimizer: 方案优化器
"""

from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass, asdict, field
from enum import Enum
import math

from pvchecker import PVModule, RoofZone, InverterMPPT, StringConfig
from pvchecker.pvcalc import (
    TemperatureCorrector, 
    ShadingCalculator, 
    CableLossCalculator,
    CalculationError
)


class SolutionType(Enum):
    """方案类型枚举"""
    MIN_SERIES = "min_series"
    OPTIMAL = "optimal"
    MAX_SERIES = "max_series"


@dataclass
class SolutionScore:
    """方案评分"""
    total_score: float
    efficiency_score: float
    cost_score: float
    risk_score: float
    voltage_match_score: float


@dataclass
class ConfigurationSolution:
    """串并联方案解决方案"""
    solution_id: str
    solution_type: SolutionType
    name: str
    modules_per_string: int
    strings_in_parallel: int
    total_modules: int
    estimated_voc_low_temp: float
    estimated_voc_high_temp: float
    estimated_v_mp: float
    estimated_i_mp: float
    estimated_total_power: float
    voltage_in_mppt_range: bool
    estimated_shading_loss_percent: float
    estimated_cable_loss_percent: float
    score: SolutionScore
    cable_config: Dict[str, float] = field(default_factory=dict)
    notes: str = ""


class ConfigurationSolver:
    """串并联方案求解器
    
    基于逆变器MPPT范围和组件参数，自动计算合理的串并联方案。
    
    核心计算逻辑：
    1. 串联块数计算
       - 最大串联数 = floor(MPPT_max / (Voc_STC * 1.15))
       - 最小串联数 = ceil(MPPT_min / (Voc_STC * 0.85))
       
    2. 并联路数计算
       - 并联路数 = ceil(总组件数 / 每串组件数)
       
    3. 生成3个候选方案
       - 方案A：最小串联（更多并联，适合遮挡严重场景）
       - 方案B：最优串联（MPPT电压区间中点附近）
       - 方案C：最大串联（更少并联，适合无遮挡场景）
    """
    
    LOW_TEMP_MARGIN = 1.15
    HIGH_TEMP_MARGIN = 0.85
    
    def __init__(
        self,
        module: PVModule,
        inverter: InverterMPPT,
        roof_zones: List[RoofZone],
        min_temp: float = -10.0,
        max_temp: float = 60.0
    ):
        """
        Args:
            module: 光伏组件参数
            inverter: 逆变器MPPT参数
            roof_zones: 屋面分区列表
            min_temp: 最低环境温度 (°C)，用于电压超限检测
            max_temp: 最高环境温度 (°C)，用于逆变器匹配
        """
        self._module = module
        self._inverter = inverter
        self._roof_zones = roof_zones
        self._min_temp = min_temp
        self._max_temp = max_temp
        
        self._temp_corrector = TemperatureCorrector(module)
        self._shading_calc = ShadingCalculator(module)
        self._cable_calc = CableLossCalculator('copper')
        
        self._total_modules = sum(z.module_count for z in roof_zones)
    
    def solve(self) -> List[ConfigurationSolution]:
        """求解并生成所有候选方案
        
        Returns:
            ConfigurationSolution对象列表，通常包含2-3个方案
        """
        solutions = []
        
        valid_series_range = self._calculate_valid_series_range()
        
        if valid_series_range is None:
            raise CalculationError("无法找到有效的串联块数范围，请检查组件和逆变器参数")
        
        min_series, max_series = valid_series_range
        
        if min_series > max_series:
            raise CalculationError(f"有效串联范围无效: min={min_series} > max={max_series}")
        
        solutions.append(self._create_min_series_solution(min_series))
        
        if min_series < max_series:
            optimal_series = self._find_optimal_series(min_series, max_series)
            if optimal_series != min_series and optimal_series != max_series:
                solutions.append(self._create_optimal_solution(optimal_series))
        
        if max_series > min_series:
            solutions.append(self._create_max_series_solution(max_series))
        
        solutions = self._score_and_sort_solutions(solutions)
        
        return solutions
    
    def _calculate_valid_series_range(self) -> Optional[Tuple[int, int]]:
        """计算有效的串联块数范围
        
        Returns:
            (最小串联数, 最大串联数) 元组，如果无法计算则返回None
        """
        voc_stc = self._module.voc
        v_mp_stc = self._module.v_mp
        
        voc_low_temp = self._temp_corrector.get_low_temp_voc(self._min_temp)
        voc_high_temp = self._temp_corrector.get_high_temp_voc(self._max_temp)
        
        mppt_min = self._inverter.v_min
        mppt_max = self._inverter.v_max
        
        max_series_by_voc = int(math.floor(mppt_max / voc_low_temp))
        
        min_series_by_mp = int(math.ceil(mppt_min / (v_mp_stc * self.HIGH_TEMP_MARGIN)))
        
        absolute_min = max(1, min_series_by_mp)
        absolute_max = max(absolute_min, max_series_by_voc)
        
        if absolute_max < 1:
            return None
        
        return (absolute_min, absolute_max)
    
    def _find_optimal_series(self, min_series: int, max_series: int) -> int:
        """寻找最优串联数
        
        最优策略：
        1. 优先考虑MPPT电压区间的中点
        2. 考虑组件总数的整除性
        3. 权衡效率和风险
        """
        v_nom = self._inverter.v_nom
        v_mp_stc = self._module.v_mp
        
        optimal_by_voltage = int(round(v_nom / v_mp_stc))
        
        optimal_by_voltage = max(min_series, min(max_series, optimal_by_voltage))
        
        best_series = optimal_by_voltage
        best_remainder = self._total_modules
        
        for series in range(min_series, max_series + 1):
            remainder = self._total_modules % series
            if remainder < best_remainder:
                best_remainder = remainder
                best_series = series
        
        if best_remainder == 0:
            return best_series
        
        return optimal_by_voltage
    
    def _create_min_series_solution(self, modules_per_string: int) -> ConfigurationSolution:
        """创建最小串联方案
        
        特点：
        - 每串组件少，并联路数多
        - 适合遮挡较严重的场景（单串受影响小）
        - 线缆用量较多，线损可能较高
        """
        strings_in_parallel = int(math.ceil(self._total_modules / modules_per_string))
        actual_modules = modules_per_string * strings_in_parallel
        
        return self._create_solution(
            solution_type=SolutionType.MIN_SERIES,
            name="方案A - 最小串联",
            modules_per_string=modules_per_string,
            strings_in_parallel=strings_in_parallel,
            actual_modules=actual_modules,
            notes="每串组件数量最少，适合遮挡较严重场景；但并联路数多，线缆用量增加"
        )
    
    def _create_optimal_solution(self, modules_per_string: int) -> ConfigurationSolution:
        """创建最优串联方案
        
        特点：
        - 工作电压接近MPPT中点，逆变器效率最高
        - 综合考虑电压匹配、成本、风险
        """
        strings_in_parallel = int(math.ceil(self._total_modules / modules_per_string))
        actual_modules = modules_per_string * strings_in_parallel
        
        return self._create_solution(
            solution_type=SolutionType.OPTIMAL,
            name="方案B - 最优串联",
            modules_per_string=modules_per_string,
            strings_in_parallel=strings_in_parallel,
            actual_modules=actual_modules,
            notes="工作电压接近MPPT区间中点，逆变器效率最优；综合平衡各方面因素"
        )
    
    def _create_max_series_solution(self, modules_per_string: int) -> ConfigurationSolution:
        """创建最大串联方案
        
        特点：
        - 每串组件多，并联路数少
        - 适合无遮挡或遮挡均匀的场景
        - 线缆用量少，线损低
        - 但低温时需注意电压超限
        """
        strings_in_parallel = int(math.ceil(self._total_modules / modules_per_string))
        actual_modules = modules_per_string * strings_in_parallel
        
        return self._create_solution(
            solution_type=SolutionType.MAX_SERIES,
            name="方案C - 最大串联",
            modules_per_string=modules_per_string,
            strings_in_parallel=strings_in_parallel,
            actual_modules=actual_modules,
            notes="每串组件数量最多，并联路数最少；适合无遮挡场景，线缆用量最省；需注意低温电压超限风险"
        )
    
    def _create_solution(
        self,
        solution_type: SolutionType,
        name: str,
        modules_per_string: int,
        strings_in_parallel: int,
        actual_modules: int,
        notes: str = ""
    ) -> ConfigurationSolution:
        """创建方案对象
        
        计算方案的各项指标：
        1. 电压指标（低温Voc、高温Voc、工作电压）
        2. 功率指标
        3. 损失估算（遮挡、线缆）
        4. 风险评估
        """
        voc_low_temp = self._temp_corrector.get_low_temp_voc(self._min_temp) * modules_per_string
        voc_high_temp = self._temp_corrector.get_high_temp_voc(self._max_temp) * modules_per_string
        
        temp_params = self._temp_corrector.calculate(45.0)
        v_mp_string = temp_params.v_mp * modules_per_string
        i_mp_string = temp_params.i_mp
        
        estimated_total_power = self._module.p_max * actual_modules * 0.95
        
        voltage_in_range = (
            voc_high_temp <= self._inverter.v_max and
            v_mp_string >= self._inverter.v_min
        )
        
        shading_loss = self._estimate_shading_loss(modules_per_string, strings_in_parallel)
        
        cable_loss = self._estimate_cable_loss(
            modules_per_string, 
            strings_in_parallel, 
            v_mp_string, 
            i_mp_string
        )
        
        score = self._calculate_solution_score(
            modules_per_string=modules_per_string,
            strings_in_parallel=strings_in_parallel,
            voc_low_temp=voc_low_temp,
            v_mp_string=v_mp_string,
            shading_loss=shading_loss,
            cable_loss=cable_loss,
            voltage_in_range=voltage_in_range
        )
        
        cable_config = {
            'recommended_cross_section': 6.0,
            'estimated_length': 50.0 * strings_in_parallel,
            'round_trip': True
        }
        
        solution_id = f"{solution_type.value}_{modules_per_string}x{strings_in_parallel}"
        
        return ConfigurationSolution(
            solution_id=solution_id,
            solution_type=solution_type,
            name=name,
            modules_per_string=modules_per_string,
            strings_in_parallel=strings_in_parallel,
            total_modules=actual_modules,
            estimated_voc_low_temp=voc_low_temp,
            estimated_voc_high_temp=voc_high_temp,
            estimated_v_mp=v_mp_string,
            estimated_i_mp=i_mp_string * strings_in_parallel,
            estimated_total_power=estimated_total_power,
            voltage_in_mppt_range=voltage_in_range,
            estimated_shading_loss_percent=shading_loss,
            estimated_cable_loss_percent=cable_loss,
            score=score,
            cable_config=cable_config,
            notes=notes
        )
    
    def _estimate_shading_loss(
        self, 
        modules_per_string: int, 
        strings_in_parallel: int
    ) -> float:
        """估算遮挡损失百分比
        
        简化估算：
        - 更多并联 = 更好的遮挡容错
        - 假设不同屋面分区有不同遮挡特性
        """
        base_loss = 2.0
        
        series_factor = modules_per_string / 20.0
        parallel_factor = 1.0 / max(1, strings_in_parallel)
        
        estimated_loss = base_loss + (series_factor * 3.0) + (parallel_factor * 2.0)
        
        return min(15.0, max(1.0, estimated_loss))
    
    def _estimate_cable_loss(
        self,
        modules_per_string: int,
        strings_in_parallel: int,
        v_mp_string: float,
        i_mp_string: float
    ) -> float:
        """估算线缆损失百分比
        
        简化估算：
        - 每串长度约50米
        - 使用6mm²线缆
        """
        try:
            cable_length_per_string = 50.0
            cross_section = 6.0
            
            total_current = i_mp_string * strings_in_parallel
            
            dc_result = self._cable_calc.calculate(
                current=i_mp_string,
                voltage=v_mp_string,
                cable_length=cable_length_per_string,
                cross_section=cross_section,
                round_trip=True
            )
            
            return dc_result.voltage_drop_percent
            
        except Exception:
            if v_mp_string > 0 and i_mp_string > 0:
                resistance = (0.0172 / 6.0) * 100
                drop = i_mp_string * resistance
                return (drop / v_mp_string) * 100
            return 2.0
    
    def _calculate_solution_score(
        self,
        modules_per_string: int,
        strings_in_parallel: int,
        voc_low_temp: float,
        v_mp_string: float,
        shading_loss: float,
        cable_loss: float,
        voltage_in_range: bool
    ) -> SolutionScore:
        """计算方案综合评分
        
        评分维度：
        1. 效率评分：考虑MPPT匹配程度
        2. 成本评分：考虑线缆用量
        3. 风险评分：考虑电压超限风险
        4. 电压匹配评分：工作电压与MPPT区间的匹配度
        """
        mppt_min = self._inverter.v_min
        mppt_max = self._inverter.v_max
        mppt_nom = self._inverter.v_nom
        mppt_range = mppt_max - mppt_min
        
        if mppt_range > 0:
            voltage_position = (v_mp_string - mppt_min) / mppt_range
            voltage_position = max(0, min(1, voltage_position))
            voltage_match_score = 100 * (1 - abs(voltage_position - 0.5) * 2)
        else:
            voltage_match_score = 50
        
        if not voltage_in_range:
            voltage_match_score = max(0, voltage_match_score - 30)
        
        voc_margin = (self._inverter.v_max - voc_low_temp) / self._inverter.v_max * 100
        if voc_margin >= 10:
            risk_score = 100
        elif voc_margin >= 0:
            risk_score = 50 + (voc_margin / 10) * 50
        else:
            risk_score = max(0, 50 + voc_margin * 2)
        
        total_strings = strings_in_parallel
        cost_score = max(0, 100 - total_strings * 5)
        
        total_loss = shading_loss + cable_loss
        efficiency_score = max(0, 100 - total_loss * 3)
        
        weights = {
            'efficiency': 0.35,
            'cost': 0.20,
            'risk': 0.25,
            'voltage_match': 0.20
        }
        
        total_score = (
            efficiency_score * weights['efficiency'] +
            cost_score * weights['cost'] +
            risk_score * weights['risk'] +
            voltage_match_score * weights['voltage_match']
        )
        
        return SolutionScore(
            total_score=round(total_score, 2),
            efficiency_score=round(efficiency_score, 2),
            cost_score=round(cost_score, 2),
            risk_score=round(risk_score, 2),
            voltage_match_score=round(voltage_match_score, 2)
        )
    
    def _score_and_sort_solutions(
        self, 
        solutions: List[ConfigurationSolution]
    ) -> List[ConfigurationSolution]:
        """对方案进行评分排序"""
        return sorted(
            solutions,
            key=lambda s: s.score.total_score,
            reverse=True
        )
    
    def adjust_solution(
        self,
        solution: ConfigurationSolution,
        new_modules_per_string: Optional[int] = None,
        new_strings_in_parallel: Optional[int] = None,
        cable_length: Optional[float] = None,
        cable_cross_section: Optional[float] = None
    ) -> ConfigurationSolution:
        """人工调整方案参数
        
        允许用户手动调整：
        1. 每串组件数
        2. 并联路数
        3. 线缆参数
        """
        modules_per_string = new_modules_per_string or solution.modules_per_string
        strings_in_parallel = new_strings_in_parallel or solution.strings_in_parallel
        
        if new_modules_per_string is None and new_strings_in_parallel is None:
            voc_low_temp = solution.estimated_voc_low_temp
            voc_high_temp = solution.estimated_voc_high_temp
            v_mp_string = solution.estimated_v_mp
            i_mp_string = solution.estimated_i_mp / solution.strings_in_parallel
            total_modules = solution.total_modules
            estimated_power = solution.estimated_total_power
            voltage_in_range = solution.voltage_in_mppt_range
        else:
            total_modules = modules_per_string * strings_in_parallel
            voc_low_temp = self._temp_corrector.get_low_temp_voc(self._min_temp) * modules_per_string
            voc_high_temp = self._temp_corrector.get_high_temp_voc(self._max_temp) * modules_per_string
            
            temp_params = self._temp_corrector.calculate(45.0)
            v_mp_string = temp_params.v_mp * modules_per_string
            i_mp_string = temp_params.i_mp
            
            estimated_power = self._module.p_max * total_modules * 0.95
            
            voltage_in_range = (
                voc_high_temp <= self._inverter.v_max and
                v_mp_string >= self._inverter.v_min
            )
        
        shading_loss = self._estimate_shading_loss(modules_per_string, strings_in_parallel)
        
        if cable_length is not None or cable_cross_section is not None:
            cable_length = cable_length or solution.cable_config.get('estimated_length', 50.0)
            cable_cross_section = cable_cross_section or solution.cable_config.get('recommended_cross_section', 6.0)
            
            try:
                dc_result = self._cable_calc.calculate(
                    current=i_mp_string,
                    voltage=v_mp_string,
                    cable_length=cable_length / strings_in_parallel if strings_in_parallel > 0 else 50.0,
                    cross_section=cable_cross_section,
                    round_trip=True
                )
                cable_loss = dc_result.voltage_drop_percent
            except Exception:
                cable_loss = self._estimate_cable_loss(
                    modules_per_string, strings_in_parallel, v_mp_string, i_mp_string
                )
        else:
            cable_loss = solution.estimated_cable_loss_percent
        
        score = self._calculate_solution_score(
            modules_per_string=modules_per_string,
            strings_in_parallel=strings_in_parallel,
            voc_low_temp=voc_low_temp,
            v_mp_string=v_mp_string,
            shading_loss=shading_loss,
            cable_loss=cable_loss,
            voltage_in_range=voltage_in_range
        )
        
        cable_config = {
            'recommended_cross_section': cable_cross_section or solution.cable_config.get('recommended_cross_section', 6.0),
            'estimated_length': cable_length or solution.cable_config.get('estimated_length', 50.0),
            'round_trip': True
        }
        
        return ConfigurationSolution(
            solution_id=f"adjusted_{modules_per_string}x{strings_in_parallel}",
            solution_type=SolutionType.OPTIMAL,
            name=f"{solution.name} (已调整)",
            modules_per_string=modules_per_string,
            strings_in_parallel=strings_in_parallel,
            total_modules=total_modules,
            estimated_voc_low_temp=voc_low_temp,
            estimated_voc_high_temp=voc_high_temp,
            estimated_v_mp=v_mp_string,
            estimated_i_mp=i_mp_string * strings_in_parallel,
            estimated_total_power=estimated_power,
            voltage_in_mppt_range=voltage_in_range,
            estimated_shading_loss_percent=shading_loss,
            estimated_cable_loss_percent=cable_loss,
            score=score,
            cable_config=cable_config,
            notes=f"{solution.notes} | 已人工调整参数"
        )
    
    @property
    def total_modules(self) -> int:
        """获取总组件数"""
        return self._total_modules


class Optimizer:
    """方案优化器
    
    对生成的方案进行多目标优化分析，提供综合建议。
    
    优化维度：
    1. 效率优化：最大化发电效率
    2. 成本优化：最小化初始投资
    3. 风险优化：最小化运行风险
    """
    
    def __init__(self, solutions: List[ConfigurationSolution]):
        """
        Args:
            solutions: 候选方案列表
        """
        self._solutions = solutions
        
        if not solutions:
            raise CalculationError("没有可供优化的方案")
    
    def get_recommendation(self) -> Dict[str, Any]:
        """获取综合推荐
        
        Returns:
            包含推荐方案和分析的字典
        """
        if not self._solutions:
            return {
                'recommended': None,
                'analysis': '没有可用方案',
                'comparison': []
            }
        
        sorted_by_score = sorted(
            self._solutions, 
            key=lambda s: s.score.total_score,
            reverse=True
        )
        
        recommended = sorted_by_score[0]
        
        analysis = self._generate_analysis(recommended)
        
        comparison = self._generate_comparison()
        
        return {
            'recommended': recommended,
            'analysis': analysis,
            'comparison': comparison,
            'all_solutions': self._solutions
        }
    
    def _generate_analysis(self, solution: ConfigurationSolution) -> Dict[str, Any]:
        """生成方案分析"""
        strengths = []
        weaknesses = []
        suggestions = []
        
        if solution.score.efficiency_score >= 80:
            strengths.append("发电效率优秀")
        elif solution.score.efficiency_score >= 60:
            strengths.append("发电效率良好")
        else:
            weaknesses.append("发电效率较低，需检查电压匹配")
        
        if solution.score.cost_score >= 80:
            strengths.append("成本控制优秀，线缆用量少")
        elif solution.score.cost_score >= 60:
            strengths.append("成本控制良好")
        else:
            weaknesses.append("成本较高，并联路数较多")
        
        if solution.score.risk_score >= 80:
            strengths.append("运行风险低，电压裕度充足")
        elif solution.score.risk_score >= 50:
            strengths.append("运行风险中等")
        else:
            weaknesses.append("存在电压超限风险，低温时需特别注意")
            suggestions.append("建议低温季节监测直流电压，必要时减少串联块数")
        
        if solution.voltage_in_mppt_range:
            strengths.append("工作电压在MPPT范围内")
        else:
            weaknesses.append("工作电压可能超出MPPT范围")
            suggestions.append("建议调整串联块数，确保工作电压在逆变器MPPT范围内")
        
        if solution.estimated_cable_loss_percent > 3:
            weaknesses.append(f"线缆压降较高 ({solution.estimated_cable_loss_percent:.1f}%)")
            suggestions.append("建议增大线缆截面积或缩短线缆长度")
        
        if solution.estimated_shading_loss_percent > 5:
            weaknesses.append(f"遮挡损失较大 ({solution.estimated_shading_loss_percent:.1f}%)")
            suggestions.append("建议优化组件布局，减少遮挡影响")
        
        return {
            'strengths': strengths,
            'weaknesses': weaknesses,
            'suggestions': suggestions,
            'overall_score': solution.score.total_score,
            'score_breakdown': {
                'efficiency': solution.score.efficiency_score,
                'cost': solution.score.cost_score,
                'risk': solution.score.risk_score,
                'voltage_match': solution.score.voltage_match_score
            }
        }
    
    def _generate_comparison(self) -> List[Dict[str, Any]]:
        """生成方案对比表"""
        comparison = []
        
        for sol in self._solutions:
            comparison.append({
                'name': sol.name,
                'solution_type': sol.solution_type.value,
                'modules_per_string': sol.modules_per_string,
                'strings_in_parallel': sol.strings_in_parallel,
                'total_modules': sol.total_modules,
                'estimated_power_kw': round(sol.estimated_total_power / 1000, 2),
                'voc_low_temp': round(sol.estimated_voc_low_temp, 1),
                'v_mp_string': round(sol.estimated_v_mp, 1),
                'voltage_in_range': sol.voltage_in_mppt_range,
                'shading_loss_pct': round(sol.estimated_shading_loss_percent, 1),
                'cable_loss_pct': round(sol.estimated_cable_loss_percent, 1),
                'total_score': sol.score.total_score,
                'rank': 0
            })
        
        comparison = sorted(comparison, key=lambda x: x['total_score'], reverse=True)
        for i, item in enumerate(comparison):
            item['rank'] = i + 1
        
        return comparison
    
    def get_solution_by_type(self, solution_type: SolutionType) -> Optional[ConfigurationSolution]:
        """按方案类型获取方案"""
        for sol in self._solutions:
            if sol.solution_type == solution_type:
                return sol
        return None
    
    def compare_solutions(
        self, 
        solution_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """比较指定方案
        
        Args:
            solution_ids: 要比较的方案ID列表，None表示比较所有方案
            
        Returns:
            包含对比分析的字典
        """
        if solution_ids:
            solutions = [s for s in self._solutions if s.solution_id in solution_ids]
        else:
            solutions = self._solutions
        
        if len(solutions) < 2:
            return {
                'comparison': '需要至少2个方案进行对比',
                'solutions': [s.solution_id for s in solutions]
            }
        
        max_modules = max(s.modules_per_string for s in solutions)
        min_modules = min(s.modules_per_string for s in solutions)
        
        max_score = max(s.score.total_score for s in solutions)
        min_score = min(s.score.total_score for s in solutions)
        
        best_by_efficiency = max(solutions, key=lambda s: s.score.efficiency_score)
        best_by_cost = max(solutions, key=lambda s: s.score.cost_score)
        best_by_risk = max(solutions, key=lambda s: s.score.risk_score)
        
        return {
            'solutions_compared': len(solutions),
            'range_modules_per_string': (min_modules, max_modules),
            'range_scores': (min_score, max_score),
            'best_by': {
                'efficiency': best_by_efficiency.name,
                'cost': best_by_cost.name,
                'risk': best_by_risk.name
            },
            'detailed_comparison': [
                {
                    'name': s.name,
                    'configuration': f"{s.modules_per_string}串x{s.strings_in_parallel}并",
                    'total_power_kw': round(s.estimated_total_power / 1000, 2),
                    'efficiency_score': s.score.efficiency_score,
                    'cost_score': s.score.cost_score,
                    'risk_score': s.score.risk_score,
                    'total_score': s.score.total_score
                }
                for s in solutions
            ]
        }
