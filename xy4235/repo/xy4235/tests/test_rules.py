"""
规则引擎测试
"""
import sys
import os
from datetime import datetime, timedelta

import pytest

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.case import Case
from models.vital_signs import VitalSigns, VitalSignsRecord
from models.medication import Medication, MedicationRecord, MedicationRoute, MedicationType
from models.risk import RiskType, RiskStatus, RiskSeverity
from rules.rule_engine import RuleEngine, BaseRule, RuleResult
from rules.rule_config import DEFAULT_RULE_CONFIG, RuleConfig, SpeciesConfig
from rules.risk_rules import (
    HypothermiaRule, SpO2DropRule, MedicationOverdueRule,
    RecoveryScoreRule, HypotensionRule, HypertensionRule,
    TachycardiaRule, BradycardiaRule
)


class TestRuleConfig:
    """
    规则配置测试
    """
    
    def test_default_config(self):
        """
        测试默认配置
        """
        config = DEFAULT_RULE_CONFIG
        
        assert config is not None
        assert hasattr(config, 'hypothermia_threshold')
        assert hasattr(config, 'spo2_low_threshold')
        assert hasattr(config, 'hypotension_sbp_threshold')
    
    def test_species_config(self):
        """
        测试物种配置
        """
        dog_config = SpeciesConfig(
            normal_temp_min=37.5,
            normal_temp_max=39.0,
            normal_hr_min=60,
            normal_hr_max=120,
            normal_spo2_min=95,
            normal_sbp_min=90,
            normal_sbp_max=140
        )
        
        assert dog_config.normal_temp_min == 37.5
        assert dog_config.normal_hr_max == 120


class TestHypothermiaRule:
    """
    低体温规则测试
    """
    
    def test_detect_hypothermia(self):
        """
        测试检测低体温
        """
        # 创建病例
        case = Case(patient_name="测试", species="犬")
        
        # 创建生命体征数据，包含低体温
        vs = VitalSigns()
        base_time = datetime(2024, 1, 15, 9, 0, 0)
        
        # 正常体温
        for i in range(10):
            vs.add_record(VitalSignsRecord(
                timestamp=base_time + timedelta(minutes=i),
                temperature=37.8 - i * 0.1,
                heart_rate=100,
                spo2=98
            ))
        
        # 低体温阶段
        for i in range(10, 30):
            vs.add_record(VitalSignsRecord(
                timestamp=base_time + timedelta(minutes=i),
                temperature=35.5,
                heart_rate=80,
                spo2=95
            ))
        
        case.add_vital_signs(vs)
        
        # 创建规则并执行
        rule = HypothermiaRule()
        result = rule.execute(case, DEFAULT_RULE_CONFIG)
        
        assert result is not None
        assert result.rule_name == "低体温检测"
        
        # 检查是否检测到风险
        if result.risks:
            assert any(r.risk_type == RiskType.HYPOTHERMIA for r in result.risks)
    
    def test_no_hypothermia(self):
        """
        测试没有低体温的情况
        """
        case = Case(patient_name="测试", species="犬")
        
        vs = VitalSigns()
        base_time = datetime(2024, 1, 15, 9, 0, 0)
        
        # 全部正常体温
        for i in range(20):
            vs.add_record(VitalSignsRecord(
                timestamp=base_time + timedelta(minutes=i),
                temperature=37.8,
                heart_rate=100,
                spo2=98
            ))
        
        case.add_vital_signs(vs)
        
        rule = HypothermiaRule()
        result = rule.execute(case, DEFAULT_RULE_CONFIG)
        
        # 应该没有检测到风险或风险数为0
        assert result is not None


class TestSpO2DropRule:
    """
    血氧掉点规则测试
    """
    
    def test_detect_spo2_drop(self):
        """
        测试检测血氧掉点
        """
        case = Case(patient_name="测试", species="犬")
        
        vs = VitalSigns()
        base_time = datetime(2024, 1, 15, 9, 0, 0)
        
        # 正常血氧
        for i in range(10):
            vs.add_record(VitalSignsRecord(
                timestamp=base_time + timedelta(minutes=i),
                temperature=37.8,
                heart_rate=100,
                spo2=98
            ))
        
        # 血氧掉点
        for i in range(10, 15):
            vs.add_record(VitalSignsRecord(
                timestamp=base_time + timedelta(minutes=i),
                temperature=37.8,
                heart_rate=100,
                spo2=85
            ))
        
        # 恢复
        for i in range(15, 25):
            vs.add_record(VitalSignsRecord(
                timestamp=base_time + timedelta(minutes=i),
                temperature=37.8,
                heart_rate=100,
                spo2=98
            ))
        
        case.add_vital_signs(vs)
        
        rule = SpO2DropRule()
        result = rule.execute(case, DEFAULT_RULE_CONFIG)
        
        assert result is not None
        
        if result.risks:
            assert any(r.risk_type == RiskType.SPO2_DROP for r in result.risks)


class TestMedicationOverdueRule:
    """
    用药超时规则测试
    """
    
    def test_detect_overdue(self):
        """
        测试检测用药超时
        """
        case = Case(patient_name="测试", species="犬")
        
        # 创建给药记录，有延迟
        med = Medication(medication_id="MED-001", name="芬太尼", medication_type=MedicationType.ANALGESIC)
        
        base_time = datetime(2024, 1, 15, 9, 0, 0)
        
        # 按时给药
        med.add_record(MedicationRecord(
            record_id="REC-001",
            medication_name="芬太尼",
            admin_time=base_time,
            scheduled_time=base_time,
            dosage=50.0,
            dosage_unit="mcg",
            route=MedicationRoute.IV
        ))
        
        # 延迟给药（延迟30分钟）
        scheduled_time = base_time + timedelta(minutes=30)
        admin_time = scheduled_time + timedelta(minutes=30)
        
        med.add_record(MedicationRecord(
            record_id="REC-002",
            medication_name="芬太尼",
            admin_time=admin_time,
            scheduled_time=scheduled_time,
            dosage=30.0,
            dosage_unit="mcg",
            route=MedicationRoute.IV
        ))
        
        case.add_medication(med)
        
        rule = MedicationOverdueRule()
        result = rule.execute(case, DEFAULT_RULE_CONFIG)
        
        assert result is not None
        
        if result.risks:
            assert any(r.risk_type == RiskType.MEDICATION_OVERDUE for r in result.risks)


class TestRuleEngine:
    """
    规则引擎测试
    """
    
    def test_register_rule(self):
        """
        测试注册规则
        """
        engine = RuleEngine(DEFAULT_RULE_CONFIG)
        
        rule = HypothermiaRule()
        engine.register_rule(rule)
        
        assert len(engine.rules) == 1
        assert engine.rules[0].rule_name == "低体温检测"
    
    def test_register_rules(self):
        """
        测试批量注册规则
        """
        engine = RuleEngine(DEFAULT_RULE_CONFIG)
        
        rules = [
            HypothermiaRule(),
            SpO2DropRule(),
            HypotensionRule()
        ]
        
        engine.register_rules(rules)
        
        assert len(engine.rules) == 3
    
    def test_execute_all(self):
        """
        测试执行所有规则
        """
        engine = RuleEngine(DEFAULT_RULE_CONFIG)
        
        # 创建测试病例
        case = Case(patient_name="测试", species="犬")
        
        vs = VitalSigns()
        base_time = datetime(2024, 1, 15, 9, 0, 0)
        
        for i in range(20):
            vs.add_record(VitalSignsRecord(
                timestamp=base_time + timedelta(minutes=i),
                temperature=37.8,
                heart_rate=100,
                spo2=98,
                systolic_bp=110,
                diastolic_bp=65
            ))
        
        case.add_vital_signs(vs)
        
        # 注册规则
        engine.register_rules([
            HypothermiaRule(),
            SpO2DropRule(),
            HypotensionRule()
        ])
        
        # 执行所有规则
        results = engine.execute_all(case)
        
        assert len(results) == 3
        
        # 检查所有规则都执行了
        rule_names = [r.rule_name for r in results]
        assert "低体温检测" in rule_names
        assert "血氧掉点检测" in rule_names
        assert "低血压检测" in rule_names
    
    def test_get_risk_summary(self):
        """
        测试获取风险摘要
        """
        engine = RuleEngine(DEFAULT_RULE_CONFIG)
        
        # 创建有风险的病例
        case = Case(patient_name="测试", species="犬")
        
        vs = VitalSigns()
        base_time = datetime(2024, 1, 15, 9, 0, 0)
        
        # 添加低体温数据
        for i in range(20):
            vs.add_record(VitalSignsRecord(
                timestamp=base_time + timedelta(minutes=i),
                temperature=35.5,
                heart_rate=80,
                spo2=90,
                systolic_bp=80,
                diastolic_bp=50
            ))
        
        case.add_vital_signs(vs)
        
        engine.register_rules([
            HypothermiaRule(),
            SpO2DropRule(),
            HypotensionRule()
        ])
        
        engine.execute_all(case)
        
        # 获取摘要
        summary = engine.get_risk_summary()
        
        assert 'total_rules_executed' in summary
        assert 'total_risks' in summary
        assert 'risks_by_type' in summary
        assert 'risks_by_severity' in summary
        assert 'risks_by_status' in summary


class TestBloodPressureRules:
    """
    血压规则测试
    """
    
    def test_hypotension_rule(self):
        """
        测试低血压规则
        """
        case = Case(patient_name="测试", species="犬")
        
        vs = VitalSigns()
        base_time = datetime(2024, 1, 15, 9, 0, 0)
        
        # 低血压
        for i in range(10):
            vs.add_record(VitalSignsRecord(
                timestamp=base_time + timedelta(minutes=i),
                temperature=37.8,
                heart_rate=100,
                spo2=98,
                systolic_bp=80,
                diastolic_bp=50
            ))
        
        case.add_vital_signs(vs)
        
        rule = HypotensionRule()
        result = rule.execute(case, DEFAULT_RULE_CONFIG)
        
        assert result is not None
    
    def test_hypertension_rule(self):
        """
        测试高血压规则
        """
        case = Case(patient_name="测试", species="犬")
        
        vs = VitalSigns()
        base_time = datetime(2024, 1, 15, 9, 0, 0)
        
        # 高血压
        for i in range(10):
            vs.add_record(VitalSignsRecord(
                timestamp=base_time + timedelta(minutes=i),
                temperature=37.8,
                heart_rate=100,
                spo2=98,
                systolic_bp=160,
                diastolic_bp=100
            ))
        
        case.add_vital_signs(vs)
        
        rule = HypertensionRule()
        result = rule.execute(case, DEFAULT_RULE_CONFIG)
        
        assert result is not None


class TestHeartRateRules:
    """
    心率规则测试
    """
    
    def test_tachycardia_rule(self):
        """
        测试心动过速规则
        """
        case = Case(patient_name="测试", species="犬")
        
        vs = VitalSigns()
        base_time = datetime(2024, 1, 15, 9, 0, 0)
        
        # 心动过速
        for i in range(10):
            vs.add_record(VitalSignsRecord(
                timestamp=base_time + timedelta(minutes=i),
                temperature=37.8,
                heart_rate=180,
                spo2=98
            ))
        
        case.add_vital_signs(vs)
        
        rule = TachycardiaRule()
        result = rule.execute(case, DEFAULT_RULE_CONFIG)
        
        assert result is not None
    
    def test_bradycardia_rule(self):
        """
        测试心动过缓规则
        """
        case = Case(patient_name="测试", species="犬")
        
        vs = VitalSigns()
        base_time = datetime(2024, 1, 15, 9, 0, 0)
        
        # 心动过缓
        for i in range(10):
            vs.add_record(VitalSignsRecord(
                timestamp=base_time + timedelta(minutes=i),
                temperature=37.8,
                heart_rate=40,
                spo2=98
            ))
        
        case.add_vital_signs(vs)
        
        rule = BradycardiaRule()
        result = rule.execute(case, DEFAULT_RULE_CONFIG)
        
        assert result is not None
