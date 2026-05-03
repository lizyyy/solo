"""化学计算模块 - 浓度换算和补加量计算"""

from datetime import datetime
from typing import Optional, Tuple, Dict, Any

from nickel_plating_calculator.models.data_models import (
    TitrationData,
    TankRecord,
    ProcessParameters,
    CalculatedConcentrations,
    DosageResult,
    SimulatedResult,
)
from nickel_plating_calculator.models.config import ConfigManager


class ChemistryCalculator:
    """化学计算器"""
    
    NICKEL_SULFATE_MOLAR_MASS = 262.85
    NICKEL_CHLORIDE_MOLAR_MASS = 237.69
    BORIC_ACID_MOLAR_MASS = 61.83
    
    SULFURIC_ACID_DENSITY = 1.84
    SODIUM_HYDROXIDE_SOLUTION_DENSITY = 1.33
    
    def __init__(self, params: Optional[ProcessParameters] = None):
        self.params = params or ProcessParameters()
    
    @classmethod
    def from_config(cls, config_manager: Optional[ConfigManager] = None) -> "ChemistryCalculator":
        """从配置创建计算器"""
        cm = config_manager or ConfigManager()
        return cls(params=cm.get_process_parameters())
    
    def calculate_concentrations(self, titration: TitrationData) -> CalculatedConcentrations:
        """根据滴定数据计算浓度
        
        计算公式:
        - 镍盐浓度 = (EDTA浓度 × EDTA体积 × 摩尔质量) / 样品体积 × 1000
        - 硼酸浓度 = (NaOH浓度 × NaOH体积 × 硼酸摩尔质量) / 样品体积 × 1000
        """
        sample_volume_l = titration.sample_volume / 1000.0
        
        total_nickel_moles = titration.edta_concentration * titration.nickel_sulfate_edta_volume / 1000.0
        chloride_nickel_moles = titration.edta_concentration * titration.nickel_chloride_edta_volume / 1000.0
        sulfate_nickel_moles = total_nickel_moles - chloride_nickel_moles
        
        nickel_sulfate_g = sulfate_nickel_moles * self.NICKEL_SULFATE_MOLAR_MASS
        nickel_chloride_g = chloride_nickel_moles * self.NICKEL_CHLORIDE_MOLAR_MASS
        
        nickel_sulfate_g_l = nickel_sulfate_g / sample_volume_l
        nickel_chloride_g_l = nickel_chloride_g / sample_volume_l
        
        boric_moles = titration.naoh_concentration * titration.boric_titrant_volume / 1000.0
        boric_acid_g = boric_moles * self.BORIC_ACID_MOLAR_MASS
        boric_acid_g_l = boric_acid_g / sample_volume_l
        
        nickel_sulfate_status = self._get_concentration_status(
            nickel_sulfate_g_l,
            self.params.nickel_sulfate_min_g_l,
            self.params.nickel_sulfate_max_g_l
        )
        nickel_chloride_status = self._get_concentration_status(
            nickel_chloride_g_l,
            self.params.nickel_chloride_min_g_l,
            self.params.nickel_chloride_max_g_l
        )
        boric_acid_status = self._get_concentration_status(
            boric_acid_g_l,
            self.params.boric_acid_min_g_l,
            self.params.boric_acid_max_g_l
        )
        ph_status = self._get_ph_status(titration.ph_value)
        
        return CalculatedConcentrations(
            batch_id=titration.batch_id,
            timestamp=datetime.now(),
            nickel_sulfate_g_l=round(nickel_sulfate_g_l, 2),
            nickel_chloride_g_l=round(nickel_chloride_g_l, 2),
            boric_acid_g_l=round(boric_acid_g_l, 2),
            ph_value=titration.ph_value,
            nickel_sulfate_status=nickel_sulfate_status,
            nickel_chloride_status=nickel_chloride_status,
            boric_acid_status=boric_acid_status,
            ph_status=ph_status,
        )
    
    def calculate_dosage(
        self,
        concentrations: CalculatedConcentrations,
        tank_volume_liters: float,
        target_adjustments: Optional[Dict[str, float]] = None,
    ) -> DosageResult:
        """计算补加量
        
        计算公式:
        补加量(kg) = (目标浓度 - 当前浓度) × 槽体积(L) / 纯度 / 1000
        """
        target_ns = target_adjustments.get("nickel_sulfate") if target_adjustments else None
        target_nc = target_adjustments.get("nickel_chloride") if target_adjustments else None
        target_ba = target_adjustments.get("boric_acid") if target_adjustments else None
        target_ph = target_adjustments.get("ph") if target_adjustments else None
        
        if target_ns is None:
            target_ns = self.params.nickel_sulfate_target_g_l
        if target_nc is None:
            target_nc = self.params.nickel_chloride_target_g_l
        if target_ba is None:
            target_ba = self.params.boric_acid_target_g_l
        if target_ph is None:
            target_ph = self.params.ph_target
        
        ns_deficit = target_ns - concentrations.nickel_sulfate_g_l
        nc_deficit = target_nc - concentrations.nickel_chloride_g_l
        ba_deficit = target_ba - concentrations.boric_acid_g_l
        
        ns_to_add_kg = max(0.0, ns_deficit * tank_volume_liters / self.params.nickel_sulfate_purity / 1000)
        nc_to_add_kg = max(0.0, nc_deficit * tank_volume_liters / self.params.nickel_chloride_purity / 1000)
        ba_to_add_kg = max(0.0, ba_deficit * tank_volume_liters / self.params.boric_acid_purity / 1000)
        
        h2so4_ml, naoh_ml = self._calculate_ph_adjustment(
            concentrations.ph_value,
            target_ph,
            tank_volume_liters,
        )
        
        return DosageResult(
            batch_id=concentrations.batch_id,
            timestamp=datetime.now(),
            tank_volume_liters=tank_volume_liters,
            nickel_sulfate_to_add_kg=round(ns_to_add_kg, 3),
            nickel_chloride_to_add_kg=round(nc_to_add_kg, 3),
            boric_acid_to_add_kg=round(ba_to_add_kg, 3),
            sulfuric_acid_to_add_ml=round(h2so4_ml, 2) if h2so4_ml > 0 else None,
            sodium_hydroxide_to_add_ml=round(naoh_ml, 2) if naoh_ml > 0 else None,
        )
    
    def _calculate_ph_adjustment(
        self,
        current_ph: float,
        target_ph: float,
        tank_volume_liters: float,
    ) -> Tuple[float, float]:
        """计算pH调整所需的酸或碱量
        
        这是一个经验公式，基于实际电镀槽液的缓冲特性
        """
        ph_diff = target_ph - current_ph
        
        if abs(ph_diff) < 0.01:
            return 0.0, 0.0
        
        if ph_diff > 0:
            h_ions_needed = self._estimate_hydroxyl_for_ph_increase(
                current_ph, target_ph, tank_volume_liters
            )
            naoh_ml = h_ions_needed / (self.params.sodium_hydroxide_concentration * 10)
            return 0.0, max(0.0, naoh_ml)
        else:
            h_ions_needed = self._estimate_hydrogen_for_ph_decrease(
                current_ph, target_ph, tank_volume_liters
            )
            h2so4_ml = h_ions_needed / (self.params.sulfuric_acid_concentration * 18)
            return max(0.0, h2so4_ml), 0.0
    
    def _estimate_hydrogen_for_ph_decrease(
        self, current_ph: float, target_ph: float, volume_l: float
    ) -> float:
        """估算降低pH所需的H+离子量（mol）
        
        考虑硼酸缓冲体系的特性
        """
        current_h = 10 ** (-current_ph)
        target_h = 10 ** (-target_ph)
        
        free_h_needed = (target_h - current_h) * volume_l
        
        buffer_capacity = self._estimate_boric_buffer_capacity(current_ph, volume_l)
        total_h_needed = free_h_needed + buffer_capacity
        
        return max(0.0, total_h_needed)
    
    def _estimate_hydroxyl_for_ph_increase(
        self, current_ph: float, target_ph: float, volume_l: float
    ) -> float:
        """估算升高pH所需的OH-离子量（mol）"""
        current_h = 10 ** (-current_ph)
        target_h = 10 ** (-target_ph)
        
        oh_needed = (current_h - target_h) * volume_l
        
        buffer_capacity = self._estimate_boric_buffer_capacity(current_ph, volume_l)
        total_oh_needed = oh_needed + buffer_capacity * 0.5
        
        return max(0.0, total_oh_needed)
    
    def _estimate_boric_buffer_capacity(self, ph: float, volume_l: float) -> float:
        """估算硼酸缓冲容量（mol/pH单位）
        
        硼酸的pKa约为9.24，但在电镀镍液中实际缓冲区域在pH 4-6
        """
        if 3.5 <= ph <= 6.5:
            relative_capacity = 1.0 - abs(ph - 5.0) / 1.5
            return max(0.01, relative_capacity * 0.02 * volume_l)
        return 0.01 * volume_l
    
    def simulate_dosage(
        self,
        concentrations: CalculatedConcentrations,
        dosage: DosageResult,
        scenario_name: str = "标准方案",
    ) -> SimulatedResult:
        """模拟补加后的槽液状态"""
        tank_volume = dosage.tank_volume_liters
        
        ns_added_g = dosage.nickel_sulfate_to_add_kg * 1000 * self.params.nickel_sulfate_purity
        nc_added_g = dosage.nickel_chloride_to_add_kg * 1000 * self.params.nickel_chloride_purity
        ba_added_g = dosage.boric_acid_to_add_kg * 1000 * self.params.boric_acid_purity
        
        new_ns_g_l = concentrations.nickel_sulfate_g_l + ns_added_g / tank_volume
        new_nc_g_l = concentrations.nickel_chloride_g_l + nc_added_g / tank_volume
        new_ba_g_l = concentrations.boric_acid_g_l + ba_added_g / tank_volume
        
        new_ph = self._simulate_ph_change(
            concentrations.ph_value,
            dosage.sulfuric_acid_to_add_ml or 0,
            dosage.sodium_hydroxide_to_add_ml or 0,
            tank_volume,
        )
        
        ns_in_range = (
            self.params.nickel_sulfate_min_g_l <= new_ns_g_l <= self.params.nickel_sulfate_max_g_l
        )
        nc_in_range = (
            self.params.nickel_chloride_min_g_l <= new_nc_g_l <= self.params.nickel_chloride_max_g_l
        )
        ba_in_range = (
            self.params.boric_acid_min_g_l <= new_ba_g_l <= self.params.boric_acid_max_g_l
        )
        ph_in_range = self.params.ph_min <= new_ph <= self.params.ph_max
        
        all_in_range = ns_in_range and nc_in_range and ba_in_range and ph_in_range
        
        return SimulatedResult(
            batch_id=concentrations.batch_id,
            timestamp=datetime.now(),
            scenario_name=scenario_name,
            simulated_nickel_sulfate_g_l=round(new_ns_g_l, 2),
            simulated_nickel_chloride_g_l=round(new_nc_g_l, 2),
            simulated_boric_acid_g_l=round(new_ba_g_l, 2),
            simulated_ph=round(new_ph, 2),
            nickel_sulfate_in_range=ns_in_range,
            nickel_chloride_in_range=nc_in_range,
            boric_acid_in_range=ba_in_range,
            ph_in_range=ph_in_range,
            all_in_range=all_in_range,
        )
    
    def _simulate_ph_change(
        self,
        current_ph: float,
        h2so4_ml: float,
        naoh_ml: float,
        tank_volume_liters: float,
    ) -> float:
        """模拟pH变化"""
        if h2so4_ml <= 0 and naoh_ml <= 0:
            return current_ph
        
        h2so4_mol = (h2so4_ml * self.SULFURIC_ACID_DENSITY * 
                     self.params.sulfuric_acid_concentration) / 98.08
        h_ions = h2so4_mol * 2
        
        naoh_mol = (naoh_ml * self.SODIUM_HYDROXIDE_SOLUTION_DENSITY *
                   self.params.sodium_hydroxide_concentration) / 40.0
        oh_ions = naoh_mol
        
        net_h = h_ions - oh_ions
        
        if abs(net_h) < 1e-10:
            return current_ph
        
        buffer_factor = self._estimate_buffer_factor(current_ph, tank_volume_liters)
        
        if net_h > 0:
            ph_change = self._calculate_ph_decrease(current_ph, net_h, tank_volume_liters, buffer_factor)
            return max(0.0, current_ph - ph_change)
        else:
            ph_change = self._calculate_ph_increase(current_ph, -net_h, tank_volume_liters, buffer_factor)
            return min(14.0, current_ph + ph_change)
    
    def _estimate_buffer_factor(self, ph: float, volume_l: float) -> float:
        """估算缓冲因子（用于pH变化计算）"""
        if 4.0 <= ph <= 5.5:
            return 3.0
        elif 3.5 <= ph <= 6.0:
            return 2.0
        else:
            return 1.0
    
    def _calculate_ph_decrease(
        self, current_ph: float, h_moles: float, volume_l: float, buffer_factor: float
    ) -> float:
        """计算pH降低值"""
        effective_h = h_moles / buffer_factor
        current_h = 10 ** (-current_ph)
        new_h = current_h + effective_h / volume_l
        
        if new_h <= 0:
            return 0.0
        
        new_ph = -min(14.0, max(0.0, new_h)) if new_h <= 1 else -14.0
        if new_h > 0:
            import math
            new_ph = -math.log10(new_h)
        
        return current_ph - new_ph
    
    def _calculate_ph_increase(
        self, current_ph: float, oh_moles: float, volume_l: float, buffer_factor: float
    ) -> float:
        """计算pH升高值"""
        effective_oh = oh_moles / buffer_factor
        current_h = 10 ** (-current_ph)
        kw = 1e-14
        current_oh = kw / current_h
        
        new_oh = current_oh + effective_oh / volume_l
        new_h = kw / new_oh if new_oh > 0 else 1.0
        
        if new_h <= 0:
            return 0.0
        
        import math
        new_ph = -math.log10(max(1e-14, min(1.0, new_h)))
        
        return new_ph - current_ph
    
    def _get_concentration_status(self, value: float, min_val: float, max_val: float) -> str:
        """获取浓度状态"""
        if value < min_val:
            return "low"
        elif value > max_val:
            return "high"
        else:
            return "normal"
    
    def _get_ph_status(self, ph: float) -> str:
        """获取pH状态"""
        if ph < self.params.ph_min:
            return "low"
        elif ph > self.params.ph_max:
            return "high"
        else:
            return "normal"
