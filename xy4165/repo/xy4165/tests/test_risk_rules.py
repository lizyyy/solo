import unittest
import pandas as pd
import numpy as np

from kiln_analyzer.risk_rules import (
    RiskAnalyzer,
    RiskLevel,
    RiskType,
    RiskItem,
    GlazeRiskAssessment,
    DefaultRiskRules
)
from kiln_analyzer.data_parser import ThermocoupleData, GlazeRecipe, KilnPosition


class TestRiskRules(unittest.TestCase):
    
    def setUp(self):
        self.analyzer = RiskAnalyzer()
    
    def create_test_thermocouple_data(self, 
                                        target_temp: float = 1280.0,
                                        max_heating_rate: float = 150.0,
                                        max_cooling_rate: float = -100.0,
                                        holding_minutes: float = 30.0) -> ThermocoupleData:
        
        times = pd.date_range(
            start='2024-01-01 08:00:00',
            periods=500,
            freq='1min'
        )
        
        temps = []
        
        heating_minutes = 300
        for i in range(heating_minutes):
            temp = 20 + (target_temp - 20) * (i / heating_minutes)
            temps.append(temp)
        
        holding_minutes_int = int(holding_minutes)
        for i in range(holding_minutes_int):
            temps.append(target_temp + np.random.normal(0, 0.5))
        
        cooling_minutes = 200 - holding_minutes_int
        for i in range(cooling_minutes):
            temp = target_temp - (target_temp - 200) * (i / cooling_minutes)
            temps.append(temp)
        
        temps = temps[:500]
        
        return ThermocoupleData(
            name='test_risk',
            time_series=times,
            temperatures=pd.Series(temps),
            metadata={'test': True}
        )
    
    def create_test_glaze_recipe(self,
                                   max_heating_rate: float = 150.0,
                                   max_cooling_rate: float = -100.0,
                                   target_temp: float = 1280.0,
                                   holding_time: float = 30.0) -> GlazeRecipe:
        
        return GlazeRecipe(
            id='test_glaze',
            name='测试釉料',
            components={'长石': 40.0, '石英': 30.0},
            firing_profile={
                'max_temp': target_temp,
                'holding_time_min': holding_time
            },
            risk_rules={
                'max_heating_rate': max_heating_rate,
                'max_cooling_rate': max_cooling_rate,
                'critical_cooling_range': [573, 300]
            }
        )
    
    def test_default_rules_exist(self):
        rules = DefaultRiskRules.get_default_rules()
        
        self.assertGreater(len(rules), 0)
        
        rule_types = [r.rule_id for r in rules]
        self.assertIn('fast_heating_cracking', rule_types)
        self.assertIn('fast_cooling_cracking', rule_types)
        self.assertIn('insufficient_holding', rule_types)
        self.assertIn('excessive_holding', rule_types)
    
    def test_analyze_heating_risk_normal(self):
        tc_data = self.create_test_thermocouple_data()
        from kiln_analyzer.curve_calculator import CurveCalculator
        calculator = CurveCalculator()
        ca = calculator.calculate_full_curve(tc_data)
        
        glaze = self.create_test_glaze_recipe(max_heating_rate=500.0)
        
        risks = self.analyzer.analyze_heating_risk(ca.heating_rates, glaze.risk_rules)
        
        for risk in risks:
            self.assertNotEqual(risk.risk_level, RiskLevel.HIGH)
            self.assertNotEqual(risk.risk_level, RiskLevel.CRITICAL)
    
    def test_analyze_heating_risk_high(self):
        tc_data = self.create_test_thermocouple_data()
        from kiln_analyzer.curve_calculator import CurveCalculator
        calculator = CurveCalculator()
        ca = calculator.calculate_full_curve(tc_data)
        
        glaze = self.create_test_glaze_recipe(max_heating_rate=1.0)
        
        risks = self.analyzer.analyze_heating_risk(ca.heating_rates, glaze.risk_rules)
        
        self.assertGreater(len(risks), 0)
        risk_types = [r.risk_type for r in risks]
        self.assertIn(RiskType.CRACKING, risk_types)
    
    def test_analyze_holding_risk_insufficient(self):
        tc_data = self.create_test_thermocouple_data(holding_minutes=5.0)
        from kiln_analyzer.curve_calculator import CurveCalculator
        calculator = CurveCalculator(target_holding_temp=1280.0)
        ca = calculator.calculate_full_curve(tc_data)
        
        glaze = self.create_test_glaze_recipe(holding_time=30.0)
        
        risks = self.analyzer.analyze_holding_risk(ca, glaze.firing_profile, glaze.risk_rules)
        
        risk_types = [r.risk_type for r in risks]
        self.assertIn(RiskType.UNDER_FIRED, risk_types)
    
    def test_analyze_holding_risk_excessive(self):
        tc_data = self.create_test_thermocouple_data(holding_minutes=150.0)
        from kiln_analyzer.curve_calculator import CurveCalculator
        calculator = CurveCalculator(target_holding_temp=1280.0)
        ca = calculator.calculate_full_curve(tc_data)
        
        glaze = self.create_test_glaze_recipe(holding_time=30.0)
        
        risks = self.analyzer.analyze_holding_risk(ca, glaze.firing_profile, glaze.risk_rules)
        
        risk_types = [r.risk_type for r in risks]
        self.assertIn(RiskType.GLAZE_RUN, risk_types)
    
    def test_analyze_temperature_risk_too_high(self):
        tc_data = self.create_test_thermocouple_data(target_temp=1350.0)
        from kiln_analyzer.curve_calculator import CurveCalculator
        calculator = CurveCalculator(target_holding_temp=1350.0)
        ca = calculator.calculate_full_curve(tc_data)
        
        glaze = self.create_test_glaze_recipe(target_temp=1280.0)
        
        risks = self.analyzer.analyze_temperature_risk(ca, glaze.firing_profile)
        
        risk_types = [r.risk_type for r in risks]
        self.assertIn(RiskType.OVER_FIRED, risk_types)
    
    def test_analyze_temperature_risk_too_low(self):
        tc_data = self.create_test_thermocouple_data(target_temp=1200.0)
        from kiln_analyzer.curve_calculator import CurveCalculator
        calculator = CurveCalculator(target_holding_temp=1200.0)
        ca = calculator.calculate_full_curve(tc_data)
        
        glaze = self.create_test_glaze_recipe(target_temp=1280.0)
        
        risks = self.analyzer.analyze_temperature_risk(ca, glaze.firing_profile)
        
        risk_types = [r.risk_type for r in risks]
        self.assertIn(RiskType.UNDER_FIRED, risk_types)
    
    def test_analyze_glaze_risk(self):
        tc_data = self.create_test_thermocouple_data(
            target_temp=1280.0,
            holding_minutes=30.0
        )
        glaze = self.create_test_glaze_recipe(
            max_heating_rate=300.0,
            max_cooling_rate=-200.0,
            target_temp=1280.0,
            holding_time=30.0
        )
        position = KilnPosition(
            id='pos_1',
            name='测试位置',
            position_x=0.5,
            position_y=0.5,
            position_z=0.5,
            thermocouple_id='test_risk',
            items=[]
        )
        
        assessment = self.analyzer.analyze_glaze_risk(tc_data, glaze, position)
        
        self.assertIsInstance(assessment, GlazeRiskAssessment)
        self.assertEqual(assessment.glaze_id, 'test_glaze')
        self.assertEqual(assessment.glaze_name, '测试釉料')
        self.assertEqual(assessment.position_name, '测试位置')
        self.assertIsInstance(assessment.overall_risk_level, RiskLevel)
        self.assertIsInstance(assessment.risks, list)
    
    def test_get_risk_summary(self):
        tc_data = self.create_test_thermocouple_data()
        glaze = self.create_test_glaze_recipe(
            max_heating_rate=300.0,
            max_cooling_rate=-200.0,
            target_temp=1280.0,
            holding_time=30.0
        )
        position = KilnPosition(
            id='pos_1',
            name='测试位置',
            position_x=0.5,
            position_y=0.5,
            position_z=0.5,
            thermocouple_id='test_risk',
            items=[]
        )
        
        assessments = [
            self.analyzer.analyze_glaze_risk(tc_data, glaze, position)
        ]
        
        summary = self.analyzer.get_risk_summary(assessments)
        
        self.assertIn('total_assessments', summary)
        self.assertIn('risk_distribution', summary)
        self.assertIn('highest_risk_level', summary)
        self.assertIn('has_high_risk', summary)
        
        self.assertEqual(summary['total_assessments'], 1)
    
    def test_risk_level_enum(self):
        self.assertEqual(RiskLevel.LOW.value, '低风险')
        self.assertEqual(RiskLevel.MEDIUM.value, '中等风险')
        self.assertEqual(RiskLevel.HIGH.value, '高风险')
        self.assertEqual(RiskLevel.CRITICAL.value, '临界风险')
    
    def test_risk_type_enum(self):
        risk_types = [
            RiskType.CRACKING,
            RiskType.GLAZE_RUN,
            RiskType.UNDER_FIRED,
            RiskType.OVER_FIRED,
            RiskType.THERMAL_SHOCK
        ]
        
        for rt in risk_types:
            self.assertIsInstance(rt.value, str)
    
    def test_analyze_all_positions(self):
        tc_data = self.create_test_thermocouple_data()
        thermocouples = {'test_risk': tc_data}
        
        glaze1 = self.create_test_glaze_recipe(target_temp=1280.0)
        glaze2 = self.create_test_glaze_recipe(target_temp=1300.0)
        glaze_recipes = {
            'glaze_001': glaze1,
            'glaze_002': glaze2
        }
        
        positions = {
            'pos_1': KilnPosition(
                id='pos_1',
                name='位置1',
                position_x=0.2,
                position_y=0.2,
                position_z=0.5,
                thermocouple_id='test_risk',
                items=[{'glaze_id': 'glaze_001', 'count': 1}]
            ),
            'pos_2': KilnPosition(
                id='pos_2',
                name='位置2',
                position_x=0.8,
                position_y=0.8,
                position_z=0.5,
                thermocouple_id='test_risk',
                items=[{'glaze_id': 'glaze_002', 'count': 1}]
            )
        }
        
        assessments = self.analyzer.analyze_all_positions(
            thermocouples,
            positions,
            glaze_recipes
        )
        
        self.assertEqual(len(assessments), 2)
        
        glaze_names = [a.glaze_name for a in assessments]
        self.assertIn('测试釉料', glaze_names)


if __name__ == '__main__':
    unittest.main()
