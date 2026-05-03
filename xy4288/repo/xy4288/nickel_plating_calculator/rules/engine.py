"""规则引擎 - pH调整冲突检测、库存检查、风险评估"""

from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

from nickel_plating_calculator.models.data_models import (
    RiskLevel,
    RiskItem,
    RiskAssessment,
    InventoryCheck,
    CalculatedConcentrations,
    DosageResult,
    SimulatedResult,
    ChemicalInventory,
    ProcessParameters,
    SolutionPlan,
)
from nickel_plating_calculator.models.config import ConfigManager


class RuleEngine:
    """规则引擎"""
    
    def __init__(
        self,
        params: Optional[ProcessParameters] = None,
        risk_thresholds: Optional[Dict[str, Any]] = None,
    ):
        self.params = params or ProcessParameters()
        self.risk_thresholds = risk_thresholds or self._get_default_thresholds()
    
    @classmethod
    def from_config(cls, config_manager: Optional[ConfigManager] = None) -> "RuleEngine":
        """从配置创建规则引擎"""
        cm = config_manager or ConfigManager()
        return cls(
            params=cm.get_process_parameters(),
            risk_thresholds=cm.get_risk_thresholds(),
        )
    
    @staticmethod
    def _get_default_thresholds() -> Dict[str, Any]:
        """获取默认风险阈值"""
        return {
            "nickel_sulfate_deviation_warning_pct": 10.0,
            "nickel_sulfate_deviation_critical_pct": 20.0,
            "nickel_chloride_deviation_warning_pct": 15.0,
            "nickel_chloride_deviation_critical_pct": 25.0,
            "boric_acid_deviation_warning_pct": 20.0,
            "boric_acid_deviation_critical_pct": 35.0,
            "ph_deviation_warning": 0.3,
            "ph_deviation_critical": 0.5,
        }
    
    def check_inventory(
        self,
        dosage: DosageResult,
        inventory: Dict[str, ChemicalInventory],
    ) -> InventoryCheck:
        """检查库存是否足够"""
        ns_needed = dosage.nickel_sulfate_to_add_kg
        nc_needed = dosage.nickel_chloride_to_add_kg
        ba_needed = dosage.boric_acid_to_add_kg
        
        ns_available = self._check_chemical_available(inventory, "硫酸镍", ns_needed)
        nc_available = self._check_chemical_available(inventory, "氯化镍", nc_needed)
        ba_available = self._check_chemical_available(inventory, "硼酸", ba_needed)
        
        ns_shortage = self._calculate_shortage(inventory, "硫酸镍", ns_needed)
        nc_shortage = self._calculate_shortage(inventory, "氯化镍", nc_needed)
        ba_shortage = self._calculate_shortage(inventory, "硼酸", ba_needed)
        
        all_available = ns_available and nc_available and ba_available
        
        return InventoryCheck(
            batch_id=dosage.batch_id,
            timestamp=datetime.now(),
            nickel_sulfate_available=ns_available,
            nickel_chloride_available=nc_available,
            boric_acid_available=ba_available,
            nickel_sulfate_shortage_kg=round(ns_shortage, 3),
            nickel_chloride_shortage_kg=round(nc_shortage, 3),
            boric_acid_shortage_kg=round(ba_shortage, 3),
            all_available=all_available,
        )
    
    def _check_chemical_available(
        self,
        inventory: Dict[str, ChemicalInventory],
        chemical_name: str,
        needed_kg: float,
    ) -> bool:
        """检查单个化学品是否可用"""
        if needed_kg <= 0:
            return True
        
        inv = self._find_inventory(inventory, chemical_name)
        if inv is None:
            return False
        
        return inv.current_quantity_kg >= needed_kg
    
    def _calculate_shortage(
        self,
        inventory: Dict[str, ChemicalInventory],
        chemical_name: str,
        needed_kg: float,
    ) -> float:
        """计算缺货量"""
        if needed_kg <= 0:
            return 0.0
        
        inv = self._find_inventory(inventory, chemical_name)
        if inv is None:
            return needed_kg
        
        return max(0.0, needed_kg - inv.current_quantity_kg)
    
    def _find_inventory(
        self,
        inventory: Dict[str, ChemicalInventory],
        chemical_name: str,
    ) -> Optional[ChemicalInventory]:
        """查找库存记录（支持中英文名称）"""
        name_mappings = {
            "硫酸镍": ["硫酸镍", "nickel sulfate", "nickel_sulfate"],
            "氯化镍": ["氯化镍", "nickel chloride", "nickel_chloride"],
            "硼酸": ["硼酸", "boric acid", "boric_acid"],
        }
        
        possible_names = name_mappings.get(chemical_name, [chemical_name])
        
        for name in possible_names:
            if name in inventory:
                return inventory[name]
        
        for key, inv in inventory.items():
            if inv.chemical_name in possible_names:
                return inv
        
        return None
    
    def detect_ph_conflict(
        self,
        dosage: DosageResult,
        current_ph: float,
    ) -> Tuple[bool, Optional[RiskItem]]:
        """检测pH调整冲突
        
        冲突情况：
        1. 同时需要酸和碱（不可能，但计算错误可能导致）
        2. 当前pH很低却要加更多酸
        3. 当前pH很高却要加更多碱
        """
        has_conflict = False
        conflict_details = {}
        
        if (dosage.sulfuric_acid_to_add_ml is not None and dosage.sulfuric_acid_to_add_ml > 0 and
            dosage.sodium_hydroxide_to_add_ml is not None and dosage.sodium_hydroxide_to_add_ml > 0):
            has_conflict = True
            conflict_details["type"] = "simultaneous_acid_base"
            conflict_details["sulfuric_acid_ml"] = dosage.sulfuric_acid_to_add_ml
            conflict_details["sodium_hydroxide_ml"] = dosage.sodium_hydroxide_to_add_ml
            conflict_details["message"] = "同时计算出需要酸和碱，请检查数据"
        
        if (dosage.sulfuric_acid_to_add_ml is not None and dosage.sulfuric_acid_to_add_ml > 0 and
            current_ph < self.params.ph_min):
            has_conflict = True
            conflict_details["type"] = "acid_when_already_low"
            conflict_details["current_ph"] = current_ph
            conflict_details["ph_min"] = self.params.ph_min
            conflict_details["sulfuric_acid_ml"] = dosage.sulfuric_acid_to_add_ml
            conflict_details["message"] = f"当前pH {current_ph:.2f} 已低于下限 {self.params.ph_min:.1f}，仍建议加酸"
        
        if (dosage.sodium_hydroxide_to_add_ml is not None and dosage.sodium_hydroxide_to_add_ml > 0 and
            current_ph > self.params.ph_max):
            has_conflict = True
            conflict_details["type"] = "base_when_already_high"
            conflict_details["current_ph"] = current_ph
            conflict_details["ph_max"] = self.params.ph_max
            conflict_details["sodium_hydroxide_ml"] = dosage.sodium_hydroxide_to_add_ml
            conflict_details["message"] = f"当前pH {current_ph:.2f} 已高于上限 {self.params.ph_max:.1f}，仍建议加碱"
        
        if has_conflict:
            risk_item = RiskItem(
                category="pH调整冲突",
                description=conflict_details.get("message", "pH调整存在冲突"),
                level=RiskLevel.CRITICAL,
                suggestion="请检查滴定数据和目标pH设置，必要时进行人工调整",
                details=conflict_details,
            )
            return True, risk_item
        
        return False, None
    
    def assess_risk(
        self,
        concentrations: CalculatedConcentrations,
        dosage: DosageResult,
        simulation: SimulatedResult,
        inventory: InventoryCheck,
        current_ph: float,
    ) -> RiskAssessment:
        """综合风险评估"""
        risks: List[RiskItem] = []
        
        self._assess_concentration_risks(risks, concentrations)
        self._assess_dosage_risks(risks, dosage, concentrations)
        self._assess_simulation_risks(risks, simulation)
        self._assess_inventory_risks(risks, inventory)
        
        ph_conflict, ph_risk = self.detect_ph_conflict(dosage, current_ph)
        if ph_conflict and ph_risk:
            risks.append(ph_risk)
        
        overall_risk = self._calculate_overall_risk(risks)
        
        can_proceed = (
            overall_risk not in (RiskLevel.HIGH, RiskLevel.CRITICAL) and
            inventory.all_available and
            not ph_conflict
        )
        
        return RiskAssessment(
            batch_id=concentrations.batch_id,
            timestamp=datetime.now(),
            overall_risk=overall_risk,
            risks=risks,
            can_proceed=can_proceed,
        )
    
    def _assess_concentration_risks(
        self,
        risks: List[RiskItem],
        concentrations: CalculatedConcentrations,
    ):
        """评估浓度风险"""
        thresholds = self.risk_thresholds
        
        ns_deviation_pct = self._calculate_deviation_pct(
            concentrations.nickel_sulfate_g_l,
            self.params.nickel_sulfate_target_g_l,
        )
        if ns_deviation_pct > thresholds["nickel_sulfate_deviation_critical_pct"]:
            risks.append(RiskItem(
                category="浓度异常",
                description=f"硫酸镍浓度偏离目标 {ns_deviation_pct:.1f}%",
                level=RiskLevel.CRITICAL,
                suggestion="请重新检查滴定数据，考虑是否需要紧急补加",
                details={
                    "current": concentrations.nickel_sulfate_g_l,
                    "target": self.params.nickel_sulfate_target_g_l,
                    "deviation_pct": ns_deviation_pct,
                },
            ))
        elif ns_deviation_pct > thresholds["nickel_sulfate_deviation_warning_pct"]:
            risks.append(RiskItem(
                category="浓度异常",
                description=f"硫酸镍浓度偏离目标 {ns_deviation_pct:.1f}%",
                level=RiskLevel.MEDIUM,
                suggestion="按标准流程补加，注意观察后续变化",
                details={
                    "current": concentrations.nickel_sulfate_g_l,
                    "target": self.params.nickel_sulfate_target_g_l,
                    "deviation_pct": ns_deviation_pct,
                },
            ))
        
        nc_deviation_pct = self._calculate_deviation_pct(
            concentrations.nickel_chloride_g_l,
            self.params.nickel_chloride_target_g_l,
        )
        if nc_deviation_pct > thresholds["nickel_chloride_deviation_critical_pct"]:
            risks.append(RiskItem(
                category="浓度异常",
                description=f"氯化镍浓度偏离目标 {nc_deviation_pct:.1f}%",
                level=RiskLevel.CRITICAL,
                suggestion="氯化镍影响导电和分散能力，请立即检查",
                details={
                    "current": concentrations.nickel_chloride_g_l,
                    "target": self.params.nickel_chloride_target_g_l,
                    "deviation_pct": nc_deviation_pct,
                },
            ))
        elif nc_deviation_pct > thresholds["nickel_chloride_deviation_warning_pct"]:
            risks.append(RiskItem(
                category="浓度异常",
                description=f"氯化镍浓度偏离目标 {nc_deviation_pct:.1f}%",
                level=RiskLevel.MEDIUM,
                suggestion="逐步补加，避免浓度突变",
                details={
                    "current": concentrations.nickel_chloride_g_l,
                    "target": self.params.nickel_chloride_target_g_l,
                    "deviation_pct": nc_deviation_pct,
                },
            ))
        
        ba_deviation_pct = self._calculate_deviation_pct(
            concentrations.boric_acid_g_l,
            self.params.boric_acid_target_g_l,
        )
        if ba_deviation_pct > thresholds["boric_acid_deviation_critical_pct"]:
            risks.append(RiskItem(
                category="浓度异常",
                description=f"硼酸浓度偏离目标 {ba_deviation_pct:.1f}%",
                level=RiskLevel.HIGH,
                suggestion="硼酸是重要缓冲剂，低浓度会导致pH不稳定",
                details={
                    "current": concentrations.boric_acid_g_l,
                    "target": self.params.boric_acid_target_g_l,
                    "deviation_pct": ba_deviation_pct,
                },
            ))
        elif ba_deviation_pct > thresholds["boric_acid_deviation_warning_pct"]:
            risks.append(RiskItem(
                category="浓度异常",
                description=f"硼酸浓度偏离目标 {ba_deviation_pct:.1f}%",
                level=RiskLevel.LOW,
                suggestion="按标准补加，注意溶解情况",
                details={
                    "current": concentrations.boric_acid_g_l,
                    "target": self.params.boric_acid_target_g_l,
                    "deviation_pct": ba_deviation_pct,
                },
            ))
        
        ph_deviation = abs(concentrations.ph_value - self.params.ph_target)
        if ph_deviation > thresholds["ph_deviation_critical"]:
            risks.append(RiskItem(
                category="pH异常",
                description=f"pH偏离目标 {ph_deviation:.2f} 单位",
                level=RiskLevel.HIGH,
                suggestion="pH异常会严重影响镀层质量，请优先调整",
                details={
                    "current": concentrations.ph_value,
                    "target": self.params.ph_target,
                    "deviation": ph_deviation,
                },
            ))
        elif ph_deviation > thresholds["ph_deviation_warning"]:
            risks.append(RiskItem(
                category="pH异常",
                description=f"pH偏离目标 {ph_deviation:.2f} 单位",
                level=RiskLevel.MEDIUM,
                suggestion="本次补加时同步调整pH",
                details={
                    "current": concentrations.ph_value,
                    "target": self.params.ph_target,
                    "deviation": ph_deviation,
                },
            ))
    
    def _assess_dosage_risks(
        self,
        risks: List[RiskItem],
        dosage: DosageResult,
        concentrations: CalculatedConcentrations,
    ):
        """评估补加量风险"""
        if dosage.nickel_sulfate_to_add_kg > 50:
            risks.append(RiskItem(
                category="补加量异常",
                description=f"硫酸镍补加量较大: {dosage.nickel_sulfate_to_add_kg:.1f}kg",
                level=RiskLevel.MEDIUM,
                suggestion="建议分批次补加，避免浓度突变",
                details={
                    "dosage_kg": dosage.nickel_sulfate_to_add_kg,
                    "current_g_l": concentrations.nickel_sulfate_g_l,
                },
            ))
        
        if dosage.nickel_chloride_to_add_kg > 20:
            risks.append(RiskItem(
                category="补加量异常",
                description=f"氯化镍补加量较大: {dosage.nickel_chloride_to_add_kg:.1f}kg",
                level=RiskLevel.MEDIUM,
                suggestion="建议分批次补加，注意氯离子浓度变化",
                details={
                    "dosage_kg": dosage.nickel_chloride_to_add_kg,
                    "current_g_l": concentrations.nickel_chloride_g_l,
                },
            ))
        
        if dosage.boric_acid_to_add_kg > 15:
            risks.append(RiskItem(
                category="补加量异常",
                description=f"硼酸补加量较大: {dosage.boric_acid_to_add_kg:.1f}kg",
                level=RiskLevel.HIGH,
                suggestion="硼酸溶解度有限，请用热水溶解后缓慢添加，避免析出",
                details={
                    "dosage_kg": dosage.boric_acid_to_add_kg,
                    "current_g_l": concentrations.boric_acid_g_l,
                },
            ))
    
    def _assess_simulation_risks(
        self,
        risks: List[RiskItem],
        simulation: SimulatedResult,
    ):
        """评估模拟结果风险"""
        if not simulation.nickel_sulfate_in_range:
            risks.append(RiskItem(
                category="模拟结果",
                description="补加后硫酸镍仍不在工艺范围内",
                level=RiskLevel.HIGH,
                suggestion="可能目标浓度设置不合理，或补加计算有误",
                details={
                    "simulated_g_l": simulation.simulated_nickel_sulfate_g_l,
                    "min_g_l": self.params.nickel_sulfate_min_g_l,
                    "max_g_l": self.params.nickel_sulfate_max_g_l,
                },
            ))
        
        if not simulation.nickel_chloride_in_range:
            risks.append(RiskItem(
                category="模拟结果",
                description="补加后氯化镍仍不在工艺范围内",
                level=RiskLevel.MEDIUM,
                suggestion="检查目标浓度和当前数据",
                details={
                    "simulated_g_l": simulation.simulated_nickel_chloride_g_l,
                    "min_g_l": self.params.nickel_chloride_min_g_l,
                    "max_g_l": self.params.nickel_chloride_max_g_l,
                },
            ))
        
        if not simulation.boric_acid_in_range:
            risks.append(RiskItem(
                category="模拟结果",
                description="补加后硼酸仍不在工艺范围内",
                level=RiskLevel.MEDIUM,
                suggestion="硼酸溶解度有限，可能需要多次补加",
                details={
                    "simulated_g_l": simulation.simulated_boric_acid_g_l,
                    "min_g_l": self.params.boric_acid_min_g_l,
                    "max_g_l": self.params.boric_acid_max_g_l,
                },
            ))
        
        if not simulation.ph_in_range:
            risks.append(RiskItem(
                category="模拟结果",
                description="补加后pH仍不在工艺范围内",
                level=RiskLevel.HIGH,
                suggestion="pH调整是估算值，请小量添加后复测",
                details={
                    "simulated_ph": simulation.simulated_ph,
                    "min_ph": self.params.ph_min,
                    "max_ph": self.params.ph_max,
                },
            ))
    
    def _assess_inventory_risks(
        self,
        risks: List[RiskItem],
        inventory: InventoryCheck,
    ):
        """评估库存风险"""
        if not inventory.all_available:
            if inventory.nickel_sulfate_shortage_kg > 0:
                risks.append(RiskItem(
                    category="库存不足",
                    description=f"硫酸镍库存不足，短缺 {inventory.nickel_sulfate_shortage_kg:.3f}kg",
                    level=RiskLevel.CRITICAL,
                    suggestion="请紧急采购或调整生产计划",
                    details={
                        "shortage_kg": inventory.nickel_sulfate_shortage_kg,
                    },
                ))
            
            if inventory.nickel_chloride_shortage_kg > 0:
                risks.append(RiskItem(
                    category="库存不足",
                    description=f"氯化镍库存不足，短缺 {inventory.nickel_chloride_shortage_kg:.3f}kg",
                    level=RiskLevel.HIGH,
                    suggestion="请尽快采购，可考虑暂时减少补加量",
                    details={
                        "shortage_kg": inventory.nickel_chloride_shortage_kg,
                    },
                ))
            
            if inventory.boric_acid_shortage_kg > 0:
                risks.append(RiskItem(
                    category="库存不足",
                    description=f"硼酸库存不足，短缺 {inventory.boric_acid_shortage_kg:.3f}kg",
                    level=RiskLevel.MEDIUM,
                    suggestion="请尽快采购，硼酸短缺影响pH稳定性",
                    details={
                        "shortage_kg": inventory.boric_acid_shortage_kg,
                    },
                ))
    
    def _calculate_deviation_pct(self, current: float, target: float) -> float:
        """计算偏离百分比（绝对值）"""
        if target == 0:
            return 100.0
        return abs((current - target) / target) * 100
    
    def _calculate_overall_risk(self, risks: List[RiskItem]) -> RiskLevel:
        """计算整体风险等级"""
        if not risks:
            return RiskLevel.LOW
        
        has_critical = any(r.level == RiskLevel.CRITICAL for r in risks)
        has_high = any(r.level == RiskLevel.HIGH for r in risks)
        has_medium = any(r.level == RiskLevel.MEDIUM for r in risks)
        
        if has_critical:
            return RiskLevel.CRITICAL
        elif has_high:
            return RiskLevel.HIGH
        elif has_medium:
            return RiskLevel.MEDIUM
        else:
            return RiskLevel.LOW
    
    def compare_plans(
        self,
        plan_a: SolutionPlan,
        plan_b: SolutionPlan,
    ) -> Dict[str, Any]:
        """对比两套方案
        
        返回对比结果，包括：
        - 成本差异
        - 风险等级对比
        - 模拟结果差异
        - 推荐方案
        """
        comparison = {
            "plan_a": {
                "name": plan_a.plan_name,
                "risk_level": plan_a.risks.overall_risk.value,
                "can_proceed": plan_a.risks.can_proceed,
                "inventory_ok": plan_a.inventory.all_available,
            },
            "plan_b": {
                "name": plan_b.plan_name,
                "risk_level": plan_b.risks.overall_risk.value,
                "can_proceed": plan_b.risks.can_proceed,
                "inventory_ok": plan_b.inventory.all_available,
            },
            "differences": [],
            "recommendation": None,
        }
        
        dosage_diff = {
            "nickel_sulfate_kg_diff": (
                plan_a.dosage.nickel_sulfate_to_add_kg - plan_b.dosage.nickel_sulfate_to_add_kg
            ),
            "nickel_chloride_kg_diff": (
                plan_a.dosage.nickel_chloride_to_add_kg - plan_b.dosage.nickel_chloride_to_add_kg
            ),
            "boric_acid_kg_diff": (
                plan_a.dosage.boric_acid_to_add_kg - plan_b.dosage.boric_acid_to_add_kg
            ),
        }
        comparison["dosage_differences"] = dosage_diff
        
        simulation_diff = {
            "nickel_sulfate_g_l_diff": (
                plan_a.simulation.simulated_nickel_sulfate_g_l - 
                plan_b.simulation.simulated_nickel_sulfate_g_l
            ),
            "nickel_chloride_g_l_diff": (
                plan_a.simulation.simulated_nickel_chloride_g_l - 
                plan_b.simulation.simulated_nickel_chloride_g_l
            ),
            "ph_diff": (
                plan_a.simulation.simulated_ph - plan_b.simulation.simulated_ph
            ),
        }
        comparison["simulation_differences"] = simulation_diff
        
        risks_a = plan_a.risks
        risks_b = plan_b.risks
        
        risk_order = {RiskLevel.LOW: 0, RiskLevel.MEDIUM: 1, RiskLevel.HIGH: 2, RiskLevel.CRITICAL: 3}
        a_risk_level = risk_order.get(risks_a.overall_risk, 0)
        b_risk_level = risk_order.get(risks_b.overall_risk, 0)
        
        recommended_plan = None
        
        if a_risk_level < b_risk_level and risks_a.can_proceed:
            recommended_plan = "plan_a"
            comparison["differences"].append(
                f"方案A风险更低 ({risks_a.overall_risk.value} vs {risks_b.overall_risk.value})"
            )
        elif b_risk_level < a_risk_level and risks_b.can_proceed:
            recommended_plan = "plan_b"
            comparison["differences"].append(
                f"方案B风险更低 ({risks_b.overall_risk.value} vs {risks_a.overall_risk.value})"
            )
        elif risks_a.can_proceed and not risks_b.can_proceed:
            recommended_plan = "plan_a"
            comparison["differences"].append("方案A可执行，方案B不可执行")
        elif risks_b.can_proceed and not risks_a.can_proceed:
            recommended_plan = "plan_b"
            comparison["differences"].append("方案B可执行，方案A不可执行")
        else:
            if plan_a.inventory.all_available and not plan_b.inventory.all_available:
                recommended_plan = "plan_a"
                comparison["differences"].append("方案A库存充足，方案B库存不足")
            elif plan_b.inventory.all_available and not plan_a.inventory.all_available:
                recommended_plan = "plan_b"
                comparison["differences"].append("方案B库存充足，方案A库存不足")
        
        comparison["recommendation"] = recommended_plan
        
        return comparison
