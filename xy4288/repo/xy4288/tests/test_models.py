"""测试数据模型"""

import unittest
from datetime import datetime

from nickel_plating_calculator.models.data_models import (
    RiskLevel,
    ApprovalStatus,
    TitrationData,
    TankRecord,
    ProductionRecord,
    ChemicalInventory,
    ProcessParameters,
    CalculatedConcentrations,
    DosageResult,
    SimulatedResult,
    RiskItem,
    RiskAssessment,
    InventoryCheck,
    SolutionPlan,
    ApprovalRecord,
    AuditEntry,
    BatchContext,
)


class TestEnums(unittest.TestCase):
    """测试枚举类型"""
    
    def test_risk_level_values(self):
        self.assertEqual(RiskLevel.LOW.value, "低")
        self.assertEqual(RiskLevel.MEDIUM.value, "中")
        self.assertEqual(RiskLevel.HIGH.value, "高")
        self.assertEqual(RiskLevel.CRITICAL.value, "严重")
    
    def test_approval_status_values(self):
        self.assertEqual(ApprovalStatus.PENDING.value, "待审核")
        self.assertEqual(ApprovalStatus.APPROVED.value, "已放行")
        self.assertEqual(ApprovalStatus.REJECTED.value, "已拒绝")


class TestTitrationData(unittest.TestCase):
    """测试滴定数据模型"""
    
    def setUp(self):
        self.titration = TitrationData(
            batch_id="BATCH_001",
            timestamp=datetime(2026, 5, 3, 8, 30, 0),
            operator="张三",
            nickel_sulfate_edta_volume=18.5,
            nickel_chloride_edta_volume=12.3,
            boric_titrant_volume=8.7,
            ph_value=4.3,
        )
    
    def test_titration_id(self):
        expected_id = "BATCH_001_20260503_083000"
        self.assertEqual(self.titration.titration_id, expected_id)
    
    def test_default_values(self):
        self.assertEqual(self.titration.sample_volume, 2.0)
        self.assertEqual(self.titration.edta_concentration, 0.05)
        self.assertEqual(self.titration.naoh_concentration, 0.1)


class TestProcessParameters(unittest.TestCase):
    """测试工艺参数模型"""
    
    def setUp(self):
        self.params = ProcessParameters()
    
    def test_default_nickel_sulfate_target(self):
        self.assertEqual(self.params.nickel_sulfate_target_g_l, 250.0)
        self.assertEqual(self.params.nickel_sulfate_min_g_l, 220.0)
        self.assertEqual(self.params.nickel_sulfate_max_g_l, 280.0)
    
    def test_default_ph_range(self):
        self.assertEqual(self.params.ph_target, 4.2)
        self.assertEqual(self.params.ph_min, 4.0)
        self.assertEqual(self.params.ph_max, 4.5)
    
    def test_default_purities(self):
        self.assertEqual(self.params.nickel_sulfate_purity, 0.98)
        self.assertEqual(self.params.nickel_chloride_purity, 0.97)
        self.assertEqual(self.params.boric_acid_purity, 0.99)


class TestCalculatedConcentrations(unittest.TestCase):
    """测试计算浓度模型"""
    
    def setUp(self):
        self.concentrations = CalculatedConcentrations(
            batch_id="BATCH_001",
            timestamp=datetime.now(),
            nickel_sulfate_g_l=240.5,
            nickel_chloride_g_l=42.3,
            boric_acid_g_l=38.5,
            ph_value=4.2,
        )
    
    def test_default_status(self):
        self.assertEqual(self.concentrations.nickel_sulfate_status, "normal")
        self.assertEqual(self.concentrations.nickel_chloride_status, "normal")
        self.assertEqual(self.concentrations.boric_acid_status, "normal")
        self.assertEqual(self.concentrations.ph_status, "normal")


class TestDosageResult(unittest.TestCase):
    """测试补加量结果模型"""
    
    def setUp(self):
        self.dosage = DosageResult(
            batch_id="BATCH_001",
            timestamp=datetime.now(),
            tank_volume_liters=1500.0,
            nickel_sulfate_to_add_kg=15.5,
            nickel_chloride_to_add_kg=3.2,
            boric_acid_to_add_kg=2.8,
        )
    
    def test_ph_adjustment_fields(self):
        self.assertIsNone(self.dosage.sulfuric_acid_to_add_ml)
        self.assertIsNone(self.dosage.sodium_hydroxide_to_add_ml)


class TestSimulatedResult(unittest.TestCase):
    """测试模拟结果模型"""
    
    def setUp(self):
        self.simulation = SimulatedResult(
            batch_id="BATCH_001",
            timestamp=datetime.now(),
            scenario_name="标准方案",
            simulated_nickel_sulfate_g_l=250.0,
            simulated_nickel_chloride_g_l=45.0,
            simulated_boric_acid_g_l=40.0,
            simulated_ph=4.2,
            nickel_sulfate_in_range=True,
            nickel_chloride_in_range=True,
            boric_acid_in_range=True,
            ph_in_range=True,
        )
    
    def test_all_in_range_default(self):
        self.assertTrue(self.simulation.all_in_range)


class TestRiskItem(unittest.TestCase):
    """测试风险项模型"""
    
    def setUp(self):
        self.risk_item = RiskItem(
            category="浓度异常",
            description="硫酸镍浓度偏低",
            level=RiskLevel.MEDIUM,
            suggestion="建议补加硫酸镍",
            details={"current": 220.0, "target": 250.0},
        )
    
    def test_risk_item_fields(self):
        self.assertEqual(self.risk_item.category, "浓度异常")
        self.assertEqual(self.risk_item.level, RiskLevel.MEDIUM)
        self.assertEqual(self.risk_item.details["current"], 220.0)


class TestRiskAssessment(unittest.TestCase):
    """测试风险评估模型"""
    
    def setUp(self):
        self.assessment = RiskAssessment(
            batch_id="BATCH_001",
            timestamp=datetime.now(),
            overall_risk=RiskLevel.LOW,
            risks=[],
        )
    
    def test_can_proceed_default(self):
        self.assertFalse(self.assessment.can_proceed)


class TestInventoryCheck(unittest.TestCase):
    """测试库存检查模型"""
    
    def setUp(self):
        self.inventory_check = InventoryCheck(
            batch_id="BATCH_001",
            timestamp=datetime.now(),
            nickel_sulfate_available=True,
            nickel_chloride_available=True,
            boric_acid_available=True,
            nickel_sulfate_shortage_kg=0.0,
            nickel_chloride_shortage_kg=0.0,
            boric_acid_shortage_kg=0.0,
        )
    
    def test_all_available(self):
        self.inventory_check.all_available = True
        self.assertTrue(self.inventory_check.all_available)


class TestBatchContext(unittest.TestCase):
    """测试批次上下文模型"""
    
    def setUp(self):
        self.context = BatchContext(
            batch_id="BATCH_001",
            created_at=datetime.now(),
        )
    
    def test_default_fields(self):
        self.assertIsNone(self.context.titration)
        self.assertIsNone(self.context.tank_record)
        self.assertIsNone(self.context.production)
        self.assertIsNone(self.context.concentrations)
        self.assertIsNone(self.context.process_params)
        self.assertIsNone(self.context.approval)
        self.assertEqual(len(self.context.inventory), 0)
        self.assertEqual(len(self.context.plans), 0)
        self.assertEqual(len(self.context.audit_log), 0)


if __name__ == "__main__":
    unittest.main()
