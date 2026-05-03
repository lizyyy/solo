#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
光伏计算核心模块 - PV Calculation Core Module

核心计算模块：
- TemperatureCorrector: 温度修正计算
- IVCalculator: I-V特性计算
- ShadingCalculator: 遮挡损失计算
- CableLossCalculator: 线缆压降计算
"""

from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass, asdict
import numpy as np

from pvchecker import PVModule, StringConfig


class CalculationError(Exception):
    """计算错误"""
    pass


@dataclass
class TemperatureCorrectedParams:
    """温度修正后的参数"""
    temperature: float
    voc: float
    isc: float
    v_mp: float
    i_mp: float
    p_max: float
    fill_factor: float


class TemperatureCorrector:
    """温度修正计算器
    
    基于光伏组件温度系数，计算不同温度下的电参数修正值。
    
    计算原理：
    - 开路电压: Voc(T) = Voc_STC * (1 + β/100 * (T - 25))
    - 短路电流: Isc(T) = Isc_STC * (1 + α/100 * (T - 25))
    - 最大功率点电压: Vmp(T) ≈ Vmp_STC * (1 + β/100 * (T - 25))
    - 最大功率点电流: Imp(T) ≈ Imp_STC * (1 + α/100 * (T - 25))
    - 最大功率: Pmax(T) ≈ Pmax_STC * (1 + γ/100 * (T - 25))
    
    其中：
    - β: 开路电压温度系数 (%/°C，负值)
    - α: 短路电流温度系数 (%/°C，正值)
    - γ: 最大功率温度系数 (%/°C，负值)
    """
    
    STC_TEMPERATURE = 25.0
    
    def __init__(self, module: PVModule):
        """
        Args:
            module: 光伏组件参数
        """
        self._module = module
        self._validate_module()
    
    def _validate_module(self):
        """验证组件参数有效性"""
        if self._module.temp_coeff_voc >= 0:
            raise CalculationError("开路电压温度系数应为负值")
        if self._module.temp_coeff_isc <= 0:
            raise CalculationError("短路电流温度系数应为正值")
        if self._module.temp_coeff_pmax >= 0:
            raise CalculationError("最大功率温度系数应为负值")
    
    def calculate(self, temperature: float) -> TemperatureCorrectedParams:
        """计算指定温度下的修正参数
        
        Args:
            temperature: 电池温度 (°C)
            
        Returns:
            TemperatureCorrectedParams对象
        """
        delta_T = temperature - self.STC_TEMPERATURE
        
        beta = self._module.temp_coeff_voc / 100.0
        alpha = self._module.temp_coeff_isc / 100.0
        gamma = self._module.temp_coeff_pmax / 100.0
        
        voc = self._module.voc * (1 + beta * delta_T)
        isc = self._module.isc * (1 + alpha * delta_T)
        
        v_mp = self._module.v_mp * (1 + beta * delta_T)
        i_mp = self._module.i_mp * (1 + alpha * delta_T)
        
        p_max = self._module.p_max * (1 + gamma * delta_T)
        
        if v_mp * i_mp > 0:
            fill_factor = p_max / (v_mp * i_mp)
        else:
            fill_factor = 0.75
        
        return TemperatureCorrectedParams(
            temperature=temperature,
            voc=voc,
            isc=isc,
            v_mp=v_mp,
            i_mp=i_mp,
            p_max=p_max,
            fill_factor=fill_factor
        )
    
    def calculate_range(
        self, 
        min_temp: float, 
        max_temp: float, 
        step: float = 5.0
    ) -> Dict[float, TemperatureCorrectedParams]:
        """计算温度范围内的所有参数
        
        Args:
            min_temp: 最低温度
            max_temp: 最高温度
            step: 温度步长
            
        Returns:
            温度到参数的映射字典
        """
        results = {}
        temp = min_temp
        while temp <= max_temp:
            results[temp] = self.calculate(temp)
            temp += step
        return results
    
    def get_low_temp_voc(self, min_temp: float = -10.0) -> float:
        """获取低温下的开路电压（用于风险评估）
        
        Args:
            min_temp: 最低环境温度 (°C)，默认-10°C
            
        Returns:
            低温下的开路电压
        """
        params = self.calculate(min_temp)
        return params.voc
    
    def get_high_temp_voc(self, max_temp: float = 60.0) -> float:
        """获取高温下的开路电压（用于逆变器匹配）
        
        Args:
            max_temp: 最高环境温度 (°C)，默认60°C
            
        Returns:
            高温下的开路电压
        """
        params = self.calculate(max_temp)
        return params.voc
    
    def estimate_cell_temperature(
        self, 
        ambient_temp: float, 
        irradiance: float = 1000.0,
        wind_speed: float = 1.0
    ) -> float:
        """估算电池工作温度
        
        使用简化模型：
        T_cell = T_ambient + (NOCT - 20) * (G / 800) * (1 - 0.05 * wind_speed)
        
        Args:
            ambient_temp: 环境温度 (°C)
            irradiance: 辐照度 (W/m²)
            wind_speed: 风速 (m/s)
            
        Returns:
            估算的电池温度
        """
        delta_temp = (self._module.noct - 20.0) * (irradiance / 800.0)
        wind_factor = max(0.5, 1.0 - 0.05 * wind_speed)
        
        cell_temp = ambient_temp + delta_temp * wind_factor
        return cell_temp


@dataclass
class IVPoint:
    """I-V曲线上的点"""
    voltage: float
    current: float
    power: float


@dataclass
class IVCurve:
    """I-V曲线"""
    points: List[IVPoint]
    v_mp: float
    i_mp: float
    p_max: float
    voc: float
    isc: float
    fill_factor: float


class IVCalculator:
    """I-V特性计算器
    
    计算光伏组件和组串的I-V特性曲线。
    
    单二极管模型简化实现：
    I = Iph - I0 * (exp(q*(V+I*Rs)/(n*k*T)) - 1) - (V+I*Rs)/Rsh
    
    对于工程应用，使用简化的五参数模型或经验公式即可。
    """
    
    def __init__(self, module: PVModule):
        """
        Args:
            module: 光伏组件参数
        """
        self._module = module
        self._temp_corrector = TemperatureCorrector(module)
    
    def calculate_module_iv(
        self, 
        temperature: float = 25.0,
        irradiance: float = 1000.0,
        num_points: int = 100
    ) -> IVCurve:
        """计算单块组件的I-V曲线
        
        使用简化的经验模型，基于STC参数和温度修正。
        
        Args:
            temperature: 电池温度 (°C)
            irradiance: 辐照度 (W/m²)
            num_points: 曲线上的点数
            
        Returns:
            IVCurve对象
        """
        temp_params = self._temp_corrector.calculate(temperature)
        
        irradiance_factor = irradiance / 1000.0
        
        voc = temp_params.voc
        isc = temp_params.isc * irradiance_factor
        v_mp = temp_params.v_mp
        i_mp = temp_params.i_mp * irradiance_factor
        p_max = v_mp * i_mp
        
        if voc * isc > 0:
            fill_factor = p_max / (voc * isc)
        else:
            fill_factor = 0.75
        
        points = self._generate_iv_points(
            voc=voc,
            isc=isc,
            v_mp=v_mp,
            i_mp=i_mp,
            fill_factor=fill_factor,
            num_points=num_points
        )
        
        return IVCurve(
            points=points,
            v_mp=v_mp,
            i_mp=i_mp,
            p_max=p_max,
            voc=voc,
            isc=isc,
            fill_factor=fill_factor
        )
    
    def _generate_iv_points(
        self,
        voc: float,
        isc: float,
        v_mp: float,
        i_mp: float,
        fill_factor: float,
        num_points: int
    ) -> List[IVPoint]:
        """生成I-V曲线上的点
        
        使用简化的指数模型生成I-V曲线点。
        """
        points = []
        
        voltages = np.linspace(0, voc, num_points)
        
        for v in voltages:
            if v < v_mp:
                i = isc * (1 - (1 - i_mp/isc) * (v / v_mp) ** 2)
            else:
                if voc - v_mp > 0:
                    ratio = (v - v_mp) / (voc - v_mp)
                    i = i_mp * (1 - ratio ** 1.5)
                else:
                    i = i_mp * (1 - min(1.0, (v - v_mp) / 10.0))
            
            i = max(0, min(i, isc))
            p = v * i
            
            points.append(IVPoint(voltage=v, current=i, power=p))
        
        return points
    
    def calculate_string_iv(
        self,
        modules_per_string: int,
        temperature: float = 25.0,
        irradiance: float = 1000.0,
        module_shading_factors: Optional[List[float]] = None,
        num_points: int = 100
    ) -> IVCurve:
        """计算串联组串的I-V曲线
        
        串联时：
        - 总电压 = 各组件电压之和
        - 电流 = 各组件中最小的电流（瓶颈效应）
        
        Args:
            modules_per_string: 组串中组件数量
            temperature: 电池温度
            irradiance: 辐照度
            module_shading_factors: 各组件的遮挡系数列表（None表示无遮挡）
            num_points: 曲线上的点数
            
        Returns:
            组串的IVCurve对象
        """
        if module_shading_factors is None:
            module_shading_factors = [1.0] * modules_per_string
        
        if len(module_shading_factors) != modules_per_string:
            raise CalculationError("遮挡系数列表长度必须等于组件数量")
        
        module_curves = []
        for i in range(modules_per_string):
            shading_factor = module_shading_factors[i]
            effective_irradiance = irradiance * shading_factor
            
            curve = self.calculate_module_iv(
                temperature=temperature,
                irradiance=effective_irradiance,
                num_points=num_points
            )
            module_curves.append(curve)
        
        return self._combine_series_curves(module_curves, num_points)
    
    def _combine_series_curves(
        self,
        module_curves: List[IVCurve],
        num_points: int
    ) -> IVCurve:
        """组合串联的I-V曲线
        
        串联时，找到各组件的公共电流范围，然后电压相加。
        """
        if not module_curves:
            raise CalculationError("没有组件曲线可组合")
        
        min_isc = min(curve.isc for curve in module_curves)
        
        currents = np.linspace(0, min_isc, num_points)
        
        string_points = []
        for i in currents:
            total_v = 0.0
            valid = True
            
            for curve in module_curves:
                v = self._get_voltage_at_current(curve, i)
                if v < 0:
                    valid = False
                    break
                total_v += v
            
            if not valid:
                continue
            
            p = total_v * i
            string_points.append(IVPoint(voltage=total_v, current=i, power=p))
        
        if not string_points:
            raise CalculationError("无法计算串联曲线")
        
        p_max = max(p.power for p in string_points)
        mp_point = max(string_points, key=lambda p: p.power)
        
        voc_points = [p for p in string_points if abs(p.current) < 1e-6]
        if voc_points:
            voc = max(p.voltage for p in voc_points)
        else:
            voc = string_points[-1].voltage
        
        isc_points = [p for p in string_points if abs(p.voltage) < 1e-6]
        if isc_points:
            isc = max(p.current for p in isc_points)
        else:
            isc = string_points[0].current
        
        if voc * isc > 0:
            fill_factor = p_max / (voc * isc)
        else:
            fill_factor = 0.0
        
        return IVCurve(
            points=string_points,
            v_mp=mp_point.voltage,
            i_mp=mp_point.current,
            p_max=p_max,
            voc=voc,
            isc=isc,
            fill_factor=fill_factor
        )
    
    def _get_voltage_at_current(self, curve: IVCurve, target_current: float) -> float:
        """从I-V曲线获取指定电流对应的电压"""
        if target_current <= 0:
            return curve.voc
        
        if target_current >= curve.isc:
            return 0.0
        
        for i in range(1, len(curve.points)):
            p_prev = curve.points[i-1]
            p_curr = curve.points[i]
            
            if p_prev.current >= target_current >= p_curr.current:
                if abs(p_prev.current - p_curr.current) < 1e-10:
                    return (p_prev.voltage + p_curr.voltage) / 2
                
                t = (target_current - p_curr.current) / (p_prev.current - p_curr.current)
                v = p_curr.voltage + t * (p_prev.voltage - p_curr.voltage)
                return v
        
        return 0.0
    
    def calculate_parallel_iv(
        self,
        string_curves: List[IVCurve],
        num_points: int = 100
    ) -> IVCurve:
        """计算并联组串的I-V曲线
        
        并联时：
        - 总电流 = 各组串电流之和
        - 电压 = 各组串相同的电压
        
        Args:
            string_curves: 各组串的I-V曲线列表
            num_points: 曲线上的点数
            
        Returns:
            并联后的IVCurve对象
        """
        if not string_curves:
            raise CalculationError("没有组串曲线可组合")
        
        min_voc = min(curve.voc for curve in string_curves)
        
        voltages = np.linspace(0, min_voc, num_points)
        
        parallel_points = []
        for v in voltages:
            total_i = 0.0
            
            for curve in string_curves:
                i = self._get_current_at_voltage(curve, v)
                total_i += max(0, i)
            
            p = v * total_i
            parallel_points.append(IVPoint(voltage=v, current=total_i, power=p))
        
        p_max = max(p.power for p in parallel_points)
        mp_point = max(parallel_points, key=lambda p: p.power)
        voc = max(p.voltage for p in parallel_points if abs(p.current) < 1e-6)
        if voc == 0:
            voc = parallel_points[-1].voltage
        
        isc = max(p.current for p in parallel_points if abs(p.voltage) < 1e-6)
        if isc == 0:
            isc = parallel_points[0].current
        
        if voc * isc > 0:
            fill_factor = p_max / (voc * isc)
        else:
            fill_factor = 0.0
        
        return IVCurve(
            points=parallel_points,
            v_mp=mp_point.voltage,
            i_mp=mp_point.current,
            p_max=p_max,
            voc=voc,
            isc=isc,
            fill_factor=fill_factor
        )
    
    def _get_current_at_voltage(self, curve: IVCurve, target_voltage: float) -> float:
        """从I-V曲线获取指定电压对应的电流"""
        if target_voltage <= 0:
            return curve.isc
        
        if target_voltage >= curve.voc:
            return 0.0
        
        for i in range(1, len(curve.points)):
            p_prev = curve.points[i-1]
            p_curr = curve.points[i]
            
            if p_prev.voltage <= target_voltage <= p_curr.voltage:
                if abs(p_prev.voltage - p_curr.voltage) < 1e-10:
                    return (p_prev.current + p_curr.current) / 2
                
                t = (target_voltage - p_prev.voltage) / (p_curr.voltage - p_prev.voltage)
                i = p_prev.current + t * (p_curr.current - p_prev.current)
                return i
        
        return 0.0


@dataclass
class ShadingLossResult:
    """遮挡损失计算结果"""
    module_count: int
    shading_factors: List[float]
    min_shading_factor: float
    average_shading_factor: float
    estimated_power_loss_percent: float
    bottleneck_modules: List[int]


class ShadingCalculator:
    """遮挡损失计算器
    
    计算光伏组件和组串因遮挡造成的功率损失。
    
    关键原理：
    1. 串联组串中，电流由遮挡最严重的组件决定（瓶颈效应）
    2. 并联组串中，各组串独立工作，电流相加
    3. 旁路二极管可以缓解遮挡影响，但仍有损失
    """
    
    SHADING_THRESHOLD = 0.9
    BOTTLENECK_THRESHOLD = 0.7
    
    def __init__(self, module: PVModule):
        """
        Args:
            module: 光伏组件参数
        """
        self._module = module
        self._iv_calculator = IVCalculator(module)
    
    def calculate_string_shading_loss(
        self,
        modules_per_string: int,
        shading_factors: List[float],
        temperature: float = 25.0,
        irradiance: float = 1000.0
    ) -> ShadingLossResult:
        """计算串联组串的遮挡损失
        
        Args:
            modules_per_string: 组串中组件数量
            shading_factors: 各组件的遮挡系数列表 (0-1，1表示无遮挡)
            temperature: 电池温度
            irradiance: 辐照度
            
        Returns:
            ShadingLossResult对象
        """
        if len(shading_factors) != modules_per_string:
            raise CalculationError("遮挡系数列表长度必须等于组件数量")
        
        min_shading = min(shading_factors)
        avg_shading = sum(shading_factors) / len(shading_factors)
        
        bottleneck_indices = [
            i for i, sf in enumerate(shading_factors)
            if sf < self.BOTTLENECK_THRESHOLD
        ]
        
        no_shading_curve = self._iv_calculator.calculate_string_iv(
            modules_per_string=modules_per_string,
            temperature=temperature,
            irradiance=irradiance,
            module_shading_factors=[1.0] * modules_per_string
        )
        p_max_no_shading = no_shading_curve.p_max
        
        shaded_curve = self._iv_calculator.calculate_string_iv(
            modules_per_string=modules_per_string,
            temperature=temperature,
            irradiance=irradiance,
            module_shading_factors=shading_factors
        )
        p_max_shaded = shaded_curve.p_max
        
        if p_max_no_shading > 0:
            loss_percent = ((p_max_no_shading - p_max_shaded) / p_max_no_shading) * 100
        else:
            loss_percent = 0.0
        
        return ShadingLossResult(
            module_count=modules_per_string,
            shading_factors=shading_factors.copy(),
            min_shading_factor=min_shading,
            average_shading_factor=avg_shading,
            estimated_power_loss_percent=loss_percent,
            bottleneck_modules=bottleneck_indices
        )
    
    def calculate_system_shading_loss(
        self,
        string_configs: List[Dict],
        temperature: float = 25.0,
        irradiance: float = 1000.0
    ) -> Dict[str, Any]:
        """计算整个系统的遮挡损失
        
        Args:
            string_configs: 各组串配置列表，每项包含：
                - modules_per_string: 每串组件数
                - shading_factors: 遮挡系数列表
                - parallel_count: 并联路数（可选，默认为1）
            temperature: 电池温度
            irradiance: 辐照度
            
        Returns:
            包含系统级遮挡损失的字典
        """
        total_loss = 0.0
        total_power_no_shading = 0.0
        total_power_shaded = 0.0
        string_results = []
        
        for config in string_configs:
            modules_per_string = config['modules_per_string']
            shading_factors = config['shading_factors']
            parallel_count = config.get('parallel_count', 1)
            
            result = self.calculate_string_shading_loss(
                modules_per_string=modules_per_string,
                shading_factors=shading_factors,
                temperature=temperature,
                irradiance=irradiance
            )
            
            string_p_no_shading = self._module.p_max * modules_per_string * parallel_count
            string_p_shaded = string_p_no_shading * (1 - result.estimated_power_loss_percent / 100)
            
            total_power_no_shading += string_p_no_shading
            total_power_shaded += string_p_shaded
            
            string_results.append({
                'modules_per_string': modules_per_string,
                'shading_factors': shading_factors,
                'parallel_count': parallel_count,
                'loss_percent': result.estimated_power_loss_percent,
                'bottleneck_modules': result.bottleneck_modules
            })
        
        if total_power_no_shading > 0:
            system_loss_percent = ((total_power_no_shading - total_power_shaded) 
                                    / total_power_no_shading * 100)
        else:
            system_loss_percent = 0.0
        
        return {
            'total_power_no_shading': total_power_no_shading,
            'total_power_shaded': total_power_shaded,
            'system_loss_percent': system_loss_percent,
            'string_results': string_results
        }
    
    def estimate_shading_from_hourly(
        self,
        shading_matrix: np.ndarray,
        month: int,
        hour_range: Tuple[int, int] = (6, 18)
    ) -> float:
        """从逐小时遮挡系数估算白天平均遮挡
        
        Args:
            shading_matrix: 形状为 (12, 24) 的遮挡系数矩阵
            month: 月份 (1-12)
            hour_range: 白天小时范围，默认为6点到18点
            
        Returns:
            平均遮挡系数
        """
        if shading_matrix.shape != (12, 24):
            raise CalculationError(f"遮挡矩阵形状应为 (12, 24)，实际为 {shading_matrix.shape}")
        
        month_idx = month - 1
        start_hour, end_hour = hour_range
        
        day_hours = list(range(start_hour, end_hour + 1))
        day_shadings = []
        
        for hour in day_hours:
            if 0 <= hour < 24:
                day_shadings.append(shading_matrix[month_idx, hour])
        
        if not day_shadings:
            return 1.0
        
        return float(np.mean(day_shadings))
    
    def check_current_mismatch(
        self,
        string_shading_factors: List[List[float]]
    ) -> Dict[str, Any]:
        """检查并联组串间的电流不匹配
        
        当不同组串的遮挡情况不同时，它们的短路电流也会不同，
        这会导致并联时的额外损失。
        
        Args:
            string_shading_factors: 各组串的遮挡系数列表的列表
            
        Returns:
            包含不匹配分析的字典
        """
        if len(string_shading_factors) < 2:
            return {
                'mismatch': False,
                'max_current_diff_percent': 0.0,
                'string_avg_shadings': [],
                'risk_level': 'low'
            }
        
        string_avg_shadings = []
        for sfs in string_shading_factors:
            avg = sum(sfs) / len(sfs) if sfs else 1.0
            string_avg_shadings.append(avg)
        
        min_shading = min(string_avg_shadings)
        max_shading = max(string_avg_shadings)
        
        if max_shading > 0:
            current_diff_percent = ((max_shading - min_shading) / max_shading) * 100
        else:
            current_diff_percent = 0.0
        
        if current_diff_percent > 15:
            risk_level = 'high'
        elif current_diff_percent > 10:
            risk_level = 'medium'
        else:
            risk_level = 'low'
        
        return {
            'mismatch': current_diff_percent > 10,
            'max_current_diff_percent': current_diff_percent,
            'string_avg_shadings': string_avg_shadings,
            'risk_level': risk_level
        }


@dataclass
class CableLossResult:
    """线缆损失计算结果"""
    cable_length: float
    cross_section: float
    current: float
    voltage_drop: float
    voltage_drop_percent: float
    power_loss: float
    power_loss_percent: float
    wire_type: str


class CableLossCalculator:
    """线缆压降和损失计算器
    
    计算直流和交流线缆的压降和功率损失。
    
    计算公式：
    1. 直流电阻: R = ρ * L / A
       - ρ: 电阻率（铜: 0.0172 Ω·mm²/m，铝: 0.0282 Ω·mm²/m）
       - L: 线缆长度（往返距离）
       - A: 线缆截面积
    
    2. 压降: V_drop = I * R
    
    3. 功率损失: P_loss = I² * R 或 P_loss = V_drop * I
    
    4. 压降百分比: V_drop% = (V_drop / V_nom) * 100
    """
    
    COPPER_RESISTIVITY = 0.0172
    ALUMINUM_RESISTIVITY = 0.0282
    
    STANDARD_CABLE_SIZES = {
        1.5: 12.1,
        2.5: 7.41,
        4.0: 4.61,
        6.0: 3.08,
        10.0: 1.83,
        16.0: 1.15,
        25.0: 0.74,
        35.0: 0.52,
        50.0: 0.39,
        70.0: 0.28,
    }
    
    def __init__(self, wire_type: str = 'copper'):
        """
        Args:
            wire_type: 线缆类型 ('copper' 或 'aluminum')
        """
        if wire_type.lower() not in ['copper', 'aluminum']:
            raise CalculationError(f"不支持的线缆类型: {wire_type}，支持 'copper' 或 'aluminum'")
        
        self._wire_type = wire_type.lower()
        self._resistivity = (
            self.COPPER_RESISTIVITY if self._wire_type == 'copper' 
            else self.ALUMINUM_RESISTIVITY
        )
    
    def calculate(
        self,
        current: float,
        voltage: float,
        cable_length: float,
        cross_section: float,
        round_trip: bool = True
    ) -> CableLossResult:
        """计算线缆损失
        
        Args:
            current: 工作电流 (A)
            voltage: 标称电压 (V)，用于计算压降百分比
            cable_length: 线缆长度 (m)
            cross_section: 线缆截面积 (mm²)
            round_trip: 是否为往返距离（直流线缆通常需要考虑正负极往返）
            
        Returns:
            CableLossResult对象
        """
        if current < 0:
            raise CalculationError(f"电流不能为负值: {current}")
        if voltage <= 0:
            raise CalculationError(f"电压必须为正值: {voltage}")
        if cable_length < 0:
            raise CalculationError(f"线缆长度不能为负值: {cable_length}")
        if cross_section <= 0:
            raise CalculationError(f"线缆截面积必须为正值: {cross_section}")
        
        actual_length = cable_length * 2 if round_trip else cable_length
        
        resistance_per_km = self._get_resistance_per_km(cross_section)
        total_resistance = (resistance_per_km / 1000) * actual_length
        
        voltage_drop = current * total_resistance
        
        if voltage > 0:
            voltage_drop_percent = (voltage_drop / voltage) * 100
        else:
            voltage_drop_percent = 0
        
        power_loss = current ** 2 * total_resistance
        
        if voltage * current > 0:
            power_loss_percent = (power_loss / (voltage * current)) * 100
        else:
            power_loss_percent = 0
        
        return CableLossResult(
            cable_length=actual_length,
            cross_section=cross_section,
            current=current,
            voltage_drop=voltage_drop,
            voltage_drop_percent=voltage_drop_percent,
            power_loss=power_loss,
            power_loss_percent=power_loss_percent,
            wire_type=self._wire_type
        )
    
    def _get_resistance_per_km(self, cross_section: float) -> float:
        """获取指定截面积的每公里电阻值
        
        优先使用标准规格表中的值，否则使用电阻率计算
        """
        for size, resistance in self.STANDARD_CABLE_SIZES.items():
            if abs(cross_section - size) < 0.01:
                return resistance
        
        return (self._resistivity / cross_section) * 1000
    
    def calculate_dc_string_loss(
        self,
        string_config: StringConfig,
        operating_voltage: float,
        operating_current: float,
        round_trip: bool = True
    ) -> CableLossResult:
        """计算直流组串的线缆损失
        
        Args:
            string_config: 组串配置
            operating_voltage: 工作电压 (V)
            operating_current: 工作电流 (A)
            round_trip: 是否为往返距离
            
        Returns:
            CableLossResult对象
        """
        return self.calculate(
            current=operating_current,
            voltage=operating_voltage,
            cable_length=string_config.cable_length,
            cross_section=string_config.cable_cross_section,
            round_trip=round_trip
        )
    
    def calculate_ac_loss(
        self,
        power: float,
        voltage: float,
        cable_length: float,
        cross_section: float,
        power_factor: float = 0.95
    ) -> CableLossResult:
        """计算交流线缆损失
        
        Args:
            power: 传输功率 (W)
            voltage: 交流电压 (V)，相电压
            cable_length: 线缆长度 (m)
            cross_section: 线缆截面积 (mm²)
            power_factor: 功率因数
            
        Returns:
            CableLossResult对象
        """
        if voltage <= 0 or power_factor <= 0:
            raise CalculationError("电压和功率因数必须为正值")
        
        current = power / (voltage * power_factor)
        
        return self.calculate(
            current=current,
            voltage=voltage,
            cable_length=cable_length,
            cross_section=cross_section,
            round_trip=True
        )
    
    def recommend_cable_size(
        self,
        current: float,
        voltage: float,
        cable_length: float,
        max_voltage_drop_percent: float = 2.0,
        round_trip: bool = True
    ) -> Dict[str, Any]:
        """推荐线缆规格
        
        根据最大允许压降百分比，推荐合适的线缆截面积。
        
        Args:
            current: 工作电流 (A)
            voltage: 标称电压 (V)
            cable_length: 线缆长度 (m)
            max_voltage_drop_percent: 最大允许压降百分比，默认2%
            round_trip: 是否为往返距离
            
        Returns:
            包含推荐规格的字典
        """
        actual_length = cable_length * 2 if round_trip else cable_length
        
        max_voltage_drop = voltage * (max_voltage_drop_percent / 100)
        
        if current <= 0:
            return {
                'recommended_size': 2.5,
                'min_required_size': 0,
                'options': [],
                'note': '电流为0，使用最小规格'
            }
        
        max_resistance = max_voltage_drop / current
        
        resistance_per_km = (max_resistance / actual_length) * 1000
        
        min_cross_section = self._resistivity * 1000 / resistance_per_km if resistance_per_km > 0 else float('inf')
        
        suitable_sizes = []
        for size in sorted(self.STANDARD_CABLE_SIZES.keys()):
            res_per_km = self._get_resistance_per_km(size)
            if res_per_km <= resistance_per_km:
                suitable_sizes.append({
                    'size': size,
                    'resistance_per_km': res_per_km,
                    'estimated_drop_percent': self._estimate_drop_percent(
                        size, current, voltage, actual_length
                    )
                })
        
        if suitable_sizes:
            recommended = suitable_sizes[0]
        else:
            max_size = max(self.STANDARD_CABLE_SIZES.keys())
            recommended = {
                'size': max_size,
                'resistance_per_km': self._get_resistance_per_km(max_size),
                'estimated_drop_percent': self._estimate_drop_percent(
                    max_size, current, voltage, actual_length
                )
            }
            suitable_sizes.append(recommended)
        
        return {
            'recommended_size': recommended['size'],
            'min_required_size': min_cross_section,
            'options': suitable_sizes,
            'max_allowed_drop_percent': max_voltage_drop_percent,
            'note': '压降超过限制时选择了最大可用规格' if recommended['estimated_drop_percent'] > max_voltage_drop_percent else ''
        }
    
    def _estimate_drop_percent(
        self,
        cross_section: float,
        current: float,
        voltage: float,
        length: float
    ) -> float:
        """估算压降百分比"""
        res_per_km = self._get_resistance_per_km(cross_section)
        total_res = (res_per_km / 1000) * length
        drop = current * total_res
        return (drop / voltage) * 100 if voltage > 0 else 0
    
    def check_cable_loss_risk(
        self,
        cable_loss_result: CableLossResult,
        warning_threshold: float = 2.0,
        critical_threshold: float = 5.0
    ) -> Dict[str, Any]:
        """检查线缆损失风险等级
        
        Args:
            cable_loss_result: 线缆损失计算结果
            warning_threshold: 警告阈值（压降百分比），默认2%
            critical_threshold: 严重阈值（压降百分比），默认5%
            
        Returns:
            包含风险评估的字典
        """
        drop_percent = cable_loss_result.voltage_drop_percent
        
        if drop_percent >= critical_threshold:
            risk_level = 'high'
            status = 'critical'
            message = f"线缆压降严重 ({drop_percent:.2f}%)，超过 {critical_threshold}% 的临界阈值"
        elif drop_percent >= warning_threshold:
            risk_level = 'medium'
            status = 'warning'
            message = f"线缆压降较高 ({drop_percent:.2f}%)，超过 {warning_threshold}% 的警告阈值"
        else:
            risk_level = 'low'
            status = 'ok'
            message = f"线缆压降正常 ({drop_percent:.2f}%)"
        
        return {
            'risk_level': risk_level,
            'status': status,
            'message': message,
            'voltage_drop_percent': drop_percent,
            'power_loss_percent': cable_loss_result.power_loss_percent,
            'warning_threshold': warning_threshold,
            'critical_threshold': critical_threshold
        }
