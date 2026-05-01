# -*- coding: utf-8 -*-
"""
数值计算模块
负责Gran法端点估计和总碱度计算
"""

import math
from dataclasses import dataclass, field
from typing import List, Optional, Tuple, Dict
import numpy as np
from scipy import stats

from .csv_parser import TitrationReading


@dataclass
class GranFitResult:
    """Gran法拟合结果"""
    endpoint_volume_ml: float
    slope: float
    intercept: float
    r_squared: float
    used_points: int
    ph_range_used: Tuple[float, float]
    fit_x: List[float] = field(default_factory=list)
    fit_y: List[float] = field(default_factory=list)


@dataclass
class AlkalinityResult:
    """碱度计算结果"""
    sample_id: str
    total_alkalinity_mg_l_caco3: float
    endpoint_volume_ml: float
    blank_corrected_volume_ml: float
    standard_concentration_mol_l: float
    sample_volume_used_ml: float
    temperature_c: Optional[float]
    dilution_factor: float
    gran_fit: Optional[GranFitResult]
    calculation_notes: List[str] = field(default_factory=list)


class GranEndpointCalculator:
    """Gran法端点计算器"""

    PH_LOWER_LIMIT = 3.0
    PH_UPPER_LIMIT = 5.0
    MIN_POINTS_FOR_FIT = 3

    def calculate(self, readings: List[TitrationReading], 
                  sample_volume_ml: float = 50.0) -> GranFitResult:
        """
        使用Gran法估算滴定端点
        
        原理：
        对于强酸滴定总碱度，在pH 3-5区域，使用Gran函数：
        F1 = (V0 + V) * 10^(-pH)
        其中：V0是样品体积，V是滴定剂体积
        
        对V作图，线性外推到F1=0，得到的体积就是终点体积。
        
        Args:
            readings: 滴定读数列表
            sample_volume_ml: 样品体积（ml），默认50ml
            
        Returns:
            GranFitResult: 拟合结果
            
        Raises:
            ValueError: 数据不足或无法计算
        """
        if len(readings) < self.MIN_POINTS_FOR_FIT:
            raise ValueError(f"需要至少 {self.MIN_POINTS_FOR_FIT} 个读数点，当前只有 {len(readings)} 个")

        # 按体积排序（确保顺序正确）
        sorted_readings = sorted(readings, key=lambda r: r.volume_ml)
        
        # 提取体积和pH数据
        volumes = np.array([r.volume_ml for r in sorted_readings])
        ph_values = np.array([r.ph for r in sorted_readings])
        
        # 选择pH在合适范围内的点（Gran图的线性区域）
        # 通常选择pH 3.0到4.5之间的点进行线性拟合
        mask = (ph_values >= self.PH_LOWER_LIMIT) & (ph_values <= self.PH_UPPER_LIMIT)
        
        # 如果这个范围内点不够，稍微放宽范围
        if np.sum(mask) < self.MIN_POINTS_FOR_FIT:
            # 尝试找最低的几个pH点
            lowest_ph_indices = np.argsort(ph_values)[:max(self.MIN_POINTS_FOR_FIT, 5)]
            mask = np.zeros(len(ph_values), dtype=bool)
            mask[lowest_ph_indices] = True
            print(f"警告: pH 3-5范围内点不足，使用最低 {np.sum(mask)} 个pH点进行拟合")

        selected_volumes = volumes[mask]
        selected_ph = ph_values[mask]
        
        if len(selected_volumes) < self.MIN_POINTS_FOR_FIT:
            raise ValueError(
                f"无法找到足够的点进行Gran拟合。"
                f"需要至少 {self.MIN_POINTS_FOR_FIT} 个pH在 {self.PH_LOWER_LIMIT}-{self.PH_UPPER_LIMIT} 范围内的点。"
            )

        # 计算Gran函数值
        # F1 = (V0 + V) * 10^(-pH)
        # 其中V0是样品体积，V是滴定剂体积
        gran_values = (sample_volume_ml + selected_volumes) * np.power(10, -selected_ph)

        # 线性拟合: F1 = slope * V + intercept
        # 终点体积是当F1=0时的V值: V_endpoint = -intercept / slope
        slope, intercept, r_value, p_value, std_err = stats.linregress(
            selected_volumes, gran_values
        )

        # 计算终点体积
        # 当F1=0时: 0 = slope * V + intercept => V = -intercept / slope
        if abs(slope) < 1e-10:
            raise ValueError("斜率接近于0，无法计算端点体积")
        
        endpoint_volume = -intercept / slope

        # 验证端点体积的合理性
        if endpoint_volume < 0:
            raise ValueError(f"计算得到的端点体积为负 ({endpoint_volume:.4f} ml)，数据可能有问题")

        return GranFitResult(
            endpoint_volume_ml=float(endpoint_volume),
            slope=float(slope),
            intercept=float(intercept),
            r_squared=float(r_value ** 2),
            used_points=len(selected_volumes),
            ph_range_used=(float(selected_ph.min()), float(selected_ph.max())),
            fit_x=[float(v) for v in selected_volumes],
            fit_y=[float(g) for g in gran_values]
        )


class AlkalinityCalculator:
    """总碱度计算器"""

    CACO3_MOLAR_MASS = 100.09  # g/mol
    VALENCE_FACTOR = 2  # CaCO3提供2个当量的碱度

    def calculate(
        self,
        sample_id: str,
        endpoint_volume_ml: float,
        standard_concentration_mol_l: float,
        sample_volume_used_ml: float,
        blank_volume_ml: float = 0.0,
        temperature_c: Optional[float] = None,
        dilution_factor: float = 1.0,
        gran_fit: Optional[GranFitResult] = None
    ) -> AlkalinityResult:
        """
        计算总碱度（mg/L as CaCO3）
        
        公式：
        总碱度 (mg/L as CaCO3) = 
            [(V_sample - V_blank) × N × 50000] / V_sample_used
        
        其中：
        - V_sample: 样品的滴定终点体积 (ml)
        - V_blank: 空白的滴定体积 (ml)
        - N: 标准酸的当量浓度 (N) = 浓度 (mol/L) × 化合价
        - 50000: CaCO3的当量质量 (mg/meq) = 100.09 g/mol / 2 × 1000 mg/g
        - V_sample_used: 用于滴定的样品体积 (ml)
        - 稀释倍数: 如果样品被稀释，需要乘以稀释倍数
        
        Args:
            sample_id: 样品ID
            endpoint_volume_ml: 样品的滴定终点体积 (ml)
            standard_concentration_mol_l: 标准液浓度 (mol/L)
            sample_volume_used_ml: 用于滴定的样品体积 (ml)
            blank_volume_ml: 空白的滴定体积 (ml)，默认0
            temperature_c: 样品温度 (°C)，用于记录
            dilution_factor: 稀释倍数，默认1.0
            gran_fit: Gran拟合结果（可选）
            
        Returns:
            AlkalinityResult: 碱度计算结果
        """
        notes = []

        # 计算校正后的体积
        corrected_volume = endpoint_volume_ml - blank_volume_ml
        
        if corrected_volume < 0:
            notes.append("警告：校正后体积为负，可能是空白值大于样品值")
            corrected_volume = 0

        # 计算总碱度
        # 当量浓度 N = mol/L × 化合价（对于HCl，化合价是1）
        # 对于以CaCO3计的碱度，当量质量是 100.09/2 = 50.045 g/eq = 50045 mg/eq
        # 简化使用 50000 mg/L 作为计算因子（标准方法常用值）
        
        # 公式: 碱度 (mg/L CaCO3) = [(V - Vb) × N × 50000] / Vs
        # 其中 N = concentration (mol/L) × 1 (HCl的化合价)
        
        normality = standard_concentration_mol_l  # HCl是1价酸
        equivalent_weight_factor = 50045  # mg/eq (100.09 g/mol / 2 × 1000 mg/g)
        
        if sample_volume_used_ml <= 0:
            raise ValueError("样品体积必须大于0")
        
        # 计算原始样品的碱度
        alkalinity_mg_l = (
            (corrected_volume * normality * equivalent_weight_factor) 
            / sample_volume_used_ml
        )
        
        # 应用稀释倍数
        alkalinity_mg_l *= dilution_factor

        # 添加计算说明
        notes.append(
            f"计算参数: V_sample={endpoint_volume_ml:.4f}ml, "
            f"V_blank={blank_volume_ml:.4f}ml, "
            f"V_corrected={corrected_volume:.4f}ml"
        )
        notes.append(
            f"标准液浓度: {standard_concentration_mol_l:.6f} mol/L, "
            f"样品体积: {sample_volume_used_ml}ml"
        )
        notes.append(
            f"稀释倍数: {dilution_factor}x, "
            f"温度: {temperature_c}°C" if temperature_c else "温度: 未记录"
        )

        return AlkalinityResult(
            sample_id=sample_id,
            total_alkalinity_mg_l_caco3=float(alkalinity_mg_l),
            endpoint_volume_ml=float(endpoint_volume_ml),
            blank_corrected_volume_ml=float(corrected_volume),
            standard_concentration_mol_l=float(standard_concentration_mol_l),
            sample_volume_used_ml=float(sample_volume_used_ml),
            temperature_c=temperature_c,
            dilution_factor=float(dilution_factor),
            gran_fit=gran_fit,
            calculation_notes=notes
        )


class SimpleEndpointCalculator:
    """
    简单端点计算器（备选方法）
    当Gran法不适用时，使用pH=4.5作为固定终点
    """

    TARGET_PH = 4.5

    def calculate(self, readings: List[TitrationReading]) -> float:
        """
        用线性插值估算pH=4.5时的体积
        
        Args:
            readings: 滴定读数列表
            
        Returns:
            估算的端点体积 (ml)
            
        Raises:
            ValueError: 无法计算
        """
        if len(readings) < 2:
            raise ValueError("需要至少2个读数点")

        sorted_readings = sorted(readings, key=lambda r: r.volume_ml)
        
        # 找到刚好跨过pH=4.5的两个点
        lower_idx = None
        upper_idx = None
        
        for i in range(len(sorted_readings) - 1):
            ph1 = sorted_readings[i].ph
            ph2 = sorted_readings[i + 1].ph
            
            if (ph1 >= self.TARGET_PH and ph2 <= self.TARGET_PH) or \
               (ph1 <= self.TARGET_PH and ph2 >= self.TARGET_PH):
                lower_idx = i
                upper_idx = i + 1
                break
        
        if lower_idx is None:
            # 没有跨过pH=4.5，找最接近的点
            closest_idx = min(
                range(len(sorted_readings)),
                key=lambda i: abs(sorted_readings[i].ph - self.TARGET_PH)
            )
            closest_ph = sorted_readings[closest_idx].ph
            if abs(closest_ph - self.TARGET_PH) > 0.5:
                raise ValueError(
                    f"读数中没有接近pH={self.TARGET_PH}的点。"
                    f"最接近的是pH={closest_ph:.2f}"
                )
            return sorted_readings[closest_idx].volume_ml
        
        # 线性插值
        v1 = sorted_readings[lower_idx].volume_ml
        ph1 = sorted_readings[lower_idx].ph
        v2 = sorted_readings[upper_idx].volume_ml
        ph2 = sorted_readings[upper_idx].ph
        
        # 计算插值体积
        # (V - V1) / (V2 - V1) = (pH_target - pH1) / (pH2 - pH1)
        if abs(ph2 - ph1) < 1e-10:
            return v1
        
        volume = v1 + (v2 - v1) * (self.TARGET_PH - ph1) / (ph2 - ph1)
        
        return volume
