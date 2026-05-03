"""规则引擎模块测试"""

import pytest
from flow_balancer.core.rules import (
    RuleEngine, RuleSeverity, RuleViolation, RuleEvaluationResult,
    HighPressureDropRule, RatioDeviationRule, DeadVolumeRule,
    ExtremeAspectRatioRule, FlowRateConsistencyRule, ZeroFlowDurationRule
)
from flow_balancer.core.fluidics import (
    Channel, ChannelType, Node, FluidNetwork, FluidicsSimulator, 
    SimulationResult, TimeSegmentResult, MixingRatio
)


class TestRuleSeverity:
    """规则严重程度测试"""
    
    def test_severity_order(self):
        """测试严重程度顺序"""
        assert RuleSeverity.CRITICAL.value > RuleSeverity.HIGH.value
        assert RuleSeverity.HIGH.value > RuleSeverity.MEDIUM.value
        assert RuleSeverity.MEDIUM.value > RuleSeverity.LOW.value
        assert RuleSeverity.LOW.value > RuleSeverity.INFO.value
    
    def test_severity_from_string(self):
        """测试从字符串获取严重程度"""
        assert RuleSeverity("critical") == RuleSeverity.CRITICAL
        assert RuleSeverity("high") == RuleSeverity.HIGH
        assert RuleSeverity("medium") == RuleSeverity.MEDIUM
        assert RuleSeverity("low") == RuleSeverity.LOW
        assert RuleSeverity("info") == RuleSeverity.INFO


class TestRuleViolation:
    """规则违规测试"""
    
    def test_violation_creation(self):
        """测试违规创建"""
        violation = RuleViolation(
            rule_id="TEST_001",
            rule_name="Test Rule",
            severity=RuleSeverity.HIGH,
            message="Test violation",
            value=100.0,
            unit="Pa",
            threshold=50.0,
            location="test_location",
            suggestion="Fix it"
        )
        
        assert violation.rule_id == "TEST_001"
        assert violation.rule_name == "Test Rule"
        assert violation.severity == RuleSeverity.HIGH
        assert violation.message == "Test violation"
        assert violation.value == 100.0
        assert violation.unit == "Pa"
        assert violation.threshold == 50.0
        assert violation.location == "test_location"
        assert violation.suggestion == "Fix it"


class TestRuleEvaluationResult:
    """规则评估结果测试"""
    
    def test_evaluation_result_creation(self):
        """测试评估结果创建"""
        result = RuleEvaluationResult(
            rule_id="TEST_001",
            rule_name="Test Rule",
            is_passed=True,
            violations=[]
        )
        
        assert result.rule_id == "TEST_001"
        assert result.rule_name == "Test Rule"
        assert result.is_passed == True
        assert len(result.violations) == 0


class TestHighPressureDropRule:
    """高压降规则测试"""
    
    def create_mock_segment(self, pressure_drop):
        """创建模拟时间段"""
        class MockSegment:
            channel_pressure_drops = {"ch1": pressure_drop}
            inlet_flow_rates = {}
            mixing_ratios = []
        return MockSegment()
    
    def test_high_pressure_violation(self):
        """测试高压降违规"""
        rule = HighPressureDropRule(threshold_pa=10000)
        
        class MockResult:
            time_segments = [self.create_mock_segment(20000)]
        
        context = {"simulation_result": MockResult()}
        
        result = rule.evaluate(context)
        
        assert result.is_passed == False
        assert len(result.violations) > 0
    
    def test_normal_pressure(self):
        """测试正常压力"""
        rule = HighPressureDropRule(threshold_pa=100000)
        
        class MockResult:
            time_segments = [self.create_mock_segment(50000)]
        
        context = {"simulation_result": MockResult()}
        
        result = rule.evaluate(context)
        
        assert result.is_passed == True


class TestRatioDeviationRule:
    """比例偏差规则测试"""
    
    def create_mock_ratio(self, target, actual, reagent_name="Test"):
        """创建模拟混合比例"""
        class MockRatio:
            target_ratio = target
            actual_ratio = actual
            reagent_id = "test"
            reagent_name = reagent_name
            
            @property
            def relative_deviation(self):
                if self.target_ratio == 0:
                    return 0.0
                return ((self.actual_ratio - self.target_ratio) / self.target_ratio) * 100
        
        return MockRatio()
    
    def create_mock_segment(self, ratios):
        """创建模拟时间段"""
        class MockSegment:
            channel_pressure_drops = {}
            inlet_flow_rates = {}
            mixing_ratios = ratios
        return MockSegment()
    
    def test_high_deviation(self):
        """测试高偏差"""
        rule = RatioDeviationRule(threshold_percent=5.0)
        
        ratio = self.create_mock_ratio(0.5, 0.75)
        
        class MockResult:
            time_segments = [self.create_mock_segment([ratio])]
        
        context = {"simulation_result": MockResult()}
        
        result = rule.evaluate(context)
        
        assert result.is_passed == False
        assert len(result.violations) > 0
    
    def test_normal_deviation(self):
        """测试正常偏差"""
        rule = RatioDeviationRule(threshold_percent=10.0)
        
        ratio = self.create_mock_ratio(0.5, 0.52)
        
        class MockResult:
            time_segments = [self.create_mock_segment([ratio])]
        
        context = {"simulation_result": MockResult()}
        
        result = rule.evaluate(context)
        
        assert result.is_passed == True


class TestDeadVolumeRule:
    """死体积规则测试"""
    
    def test_high_dead_volume(self):
        """测试高死体积"""
        rule = DeadVolumeRule(threshold_ul=10.0)
        
        class MockResult:
            total_dead_volume = 20e-9
        
        context = {"simulation_result": MockResult()}
        
        result = rule.evaluate(context)
        
        assert result.is_passed == False
    
    def test_normal_dead_volume(self):
        """测试正常死体积"""
        rule = DeadVolumeRule(threshold_ul=10.0)
        
        class MockResult:
            total_dead_volume = 5e-9
        
        context = {"simulation_result": MockResult()}
        
        result = rule.evaluate(context)
        
        assert result.is_passed == True


class TestRuleEngine:
    """规则引擎测试"""
    
    def test_create_default(self):
        """测试创建默认规则引擎"""
        engine = RuleEngine.create_default()
        
        assert len(engine.rules) > 0
    
    def test_add_rule(self):
        """测试添加规则"""
        engine = RuleEngine()
        
        rule = HighPressureDropRule()
        engine.add_rule(rule)
        
        assert len(engine.rules) == 1
    
    def test_evaluate_all(self):
        """测试评估所有规则"""
        engine = RuleEngine()
        engine.add_rule(HighPressureDropRule(threshold_pa=10000))
        engine.add_rule(RatioDeviationRule(threshold_percent=5.0))
        
        class MockSegment:
            channel_pressure_drops = {"ch1": 20000}
            inlet_flow_rates = {}
            mixing_ratios = []
        
        class MockResult:
            time_segments = [MockSegment()]
        
        context = {"simulation_result": MockResult()}
        
        results = engine.evaluate_all(context)
        
        assert len(results) == 2
    
    def test_get_all_violations(self):
        """测试获取所有违规"""
        engine = RuleEngine()
        engine.add_rule(HighPressureDropRule(threshold_pa=10000))
        
        class MockSegment:
            channel_pressure_drops = {"ch1": 20000}
            inlet_flow_rates = {}
            mixing_ratios = []
        
        class MockResult:
            time_segments = [MockSegment()]
        
        context = {"simulation_result": MockResult()}
        
        results = engine.evaluate_all(context)
        violations = engine.get_all_violations(results)
        
        assert len(violations) > 0


class TestExtremeAspectRatioRule:
    """极端宽高比规则测试"""
    
    def test_extreme_ratio(self):
        """测试极端宽高比"""
        rule = ExtremeAspectRatioRule()
        
        network = FluidNetwork()
        network.add_node(Node(id="in1", type="inlet"))
        network.add_node(Node(id="out1", type="outlet"))
        
        ch = Channel(
            id="ch1",
            name="Test",
            channel_type=ChannelType.RECTANGULAR,
            width=1000e-6,
            height=10e-6,
            length=10e-3,
            from_node="in1",
            to_node="out1"
        )
        network.add_channel(ch)
        
        context = {"fluid_network": network}
        
        result = rule.evaluate(context)
        
        assert result.is_passed == False
    
    def test_normal_ratio(self):
        """测试正常宽高比"""
        rule = ExtremeAspectRatioRule()
        
        network = FluidNetwork()
        network.add_node(Node(id="in1", type="inlet"))
        network.add_node(Node(id="out1", type="outlet"))
        
        ch = Channel(
            id="ch1",
            name="Test",
            channel_type=ChannelType.RECTANGULAR,
            width=100e-6,
            height=50e-6,
            length=10e-3,
            from_node="in1",
            to_node="out1"
        )
        network.add_channel(ch)
        
        context = {"fluid_network": network}
        
        result = rule.evaluate(context)
        
        assert result.is_passed == True


class TestZeroFlowDurationRule:
    """零流量时长规则测试"""
    
    def test_long_zero_flow(self):
        """测试长时间零流量"""
        rule = ZeroFlowDurationRule(threshold_sec=60)
        
        class MockSegment:
            duration = 120.0
            duration_unit = "s"
            pump_flows = {"in1": (0.0, "μL/min"), "in2": (0.0, "μL/min")}
        
        class MockProgram:
            segments = [MockSegment()]
        
        context = {"pump_program": MockProgram()}
        
        result = rule.evaluate(context)
        
        assert result.is_passed == False
    
    def test_short_zero_flow(self):
        """测试短时间零流量"""
        rule = ZeroFlowDurationRule(threshold_sec=60)
        
        class MockSegment:
            duration = 30.0
            duration_unit = "s"
            pump_flows = {"in1": (0.0, "μL/min")}
        
        class MockProgram:
            segments = [MockSegment()]
        
        context = {"pump_program": MockProgram()}
        
        result = rule.evaluate(context)
        
        assert result.is_passed == True
