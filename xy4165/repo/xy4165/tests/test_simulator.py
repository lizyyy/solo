import unittest
import pandas as pd
import numpy as np
import tempfile
import shutil
from pathlib import Path

from kiln_analyzer.simulator import (
    CurveSimulator,
    TargetCurveParams,
    SimulationResult
)
from kiln_analyzer.data_parser import ThermocoupleData, GlazeRecipe, KilnPosition
from kiln_analyzer.curve_calculator import CurveCalculator


class TestSimulator(unittest.TestCase):
    
    def setUp(self):
        self.simulator = CurveSimulator()
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        shutil.rmtree(self.temp_dir)
    
    def create_test_thermocouple_data(self, 
                                        start_temp: float = 20.0,
                                        target_temp: float = 1280.0,
                                        heating_minutes: int = 300,
                                        holding_minutes: int = 30,
                                        cooling_minutes: int = 120) -> ThermocoupleData:
        
        total_minutes = heating_minutes + holding_minutes + cooling_minutes
        times = pd.date_range(
            start='2024-01-01 08:00:00',
            periods=total_minutes,
            freq='1min'
        )
        
        temps = []
        
        for i in range(heating_minutes):
            temp = start_temp + (target_temp - start_temp) * (i / heating_minutes)
            temps.append(temp)
        
        for i in range(holding_minutes):
            temps.append(target_temp + np.random.normal(0, 0.5))
        
        for i in range(cooling_minutes):
            temp = target_temp - (target_temp - 200) * (i / cooling_minutes)
            temps.append(temp)
        
        return ThermocoupleData(
            name='test_sim',
            time_series=times,
            temperatures=pd.Series(temps),
            metadata={'test': True}
        )
    
    def test_target_curve_params_default(self):
        params = TargetCurveParams()
        
        self.assertEqual(params.start_temp, 20.0)
        self.assertEqual(params.target_temp, 1280.0)
        self.assertEqual(params.heating_rate, 150.0)
        self.assertEqual(params.holding_time_min, 30.0)
        self.assertEqual(params.cooling_rate, 100.0)
        self.assertEqual(params.end_temp, 200.0)
        self.assertEqual(params.intermediate_holds, [])
    
    def test_generate_target_curve_basic(self):
        params = TargetCurveParams(
            start_temp=20.0,
            target_temp=1280.0,
            heating_rate=150.0,
            holding_time_min=30.0,
            cooling_rate=100.0,
            end_temp=200.0
        )
        
        result = self.simulator.generate_target_curve(params, 'test_curve')
        
        self.assertIsInstance(result, ThermocoupleData)
        self.assertEqual(result.name, 'test_curve')
        self.assertEqual(result.metadata['type'], 'simulated')
        
        df = result.data_frame
        self.assertGreater(len(df), 0)
        
        self.assertAlmostEqual(df['temperature'].max(), 1280.0, delta=5.0)
        self.assertAlmostEqual(df['temperature'].iloc[0], 20.0, delta=5.0)
    
    def test_generate_target_curve_with_intermediate_holds(self):
        params = TargetCurveParams(
            start_temp=20.0,
            target_temp=1280.0,
            heating_rate=150.0,
            holding_time_min=30.0,
            cooling_rate=100.0,
            end_temp=200.0,
            intermediate_holds=[
                {'temperature': 500, 'duration_min': 20},
                {'temperature': 1000, 'duration_min': 15}
            ]
        )
        
        result = self.simulator.generate_target_curve(params, 'test_holds')
        
        self.assertIsInstance(result, ThermocoupleData)
        
        df = result.data_frame
        
        temps_near_500 = df[(df['temperature'] >= 495) & (df['temperature'] <= 505)]
        temps_near_1000 = df[(df['temperature'] >= 995) & (df['temperature'] <= 1005)]
        
        self.assertGreater(len(temps_near_500), 0)
        self.assertGreater(len(temps_near_1000), 0)
    
    def test_adjust_from_actual(self):
        tc_data = self.create_test_thermocouple_data(target_temp=1280.0)
        
        adjustments = {
            'target_temp': 1300.0,
            'heating_rate': 120.0,
            'holding_time_min': 45.0,
            'cooling_rate': 80.0,
            'intermediate_holds': [
                {'temperature': 500, 'duration_min': 20}
            ]
        }
        
        params = self.simulator.adjust_from_actual(tc_data, adjustments)
        
        self.assertEqual(params.target_temp, 1300.0)
        self.assertEqual(params.heating_rate, 120.0)
        self.assertEqual(params.holding_time_min, 45.0)
        self.assertEqual(params.cooling_rate, 80.0)
        self.assertEqual(len(params.intermediate_holds), 1)
        self.assertEqual(params.intermediate_holds[0]['temperature'], 500)
    
    def test_simulate_with_params(self):
        tc_data = self.create_test_thermocouple_data(target_temp=1280.0)
        
        params = TargetCurveParams(
            target_temp=1300.0,
            heating_rate=120.0,
            holding_time_min=45.0,
            cooling_rate=80.0
        )
        
        result = self.simulator.simulate_with_params(
            actual_data=tc_data,
            params=params,
            simulation_id='test_sim_001'
        )
        
        self.assertIsInstance(result, SimulationResult)
        self.assertEqual(result.simulation_id, 'test_sim_001')
        self.assertEqual(result.original_curve_name, 'test_sim')
        
        self.assertIsInstance(result.simulated_data, ThermocoupleData)
        self.assertIsNotNone(result.curve_analysis)
        self.assertIsNotNone(result.comparison)
        
        self.assertIn('actual_stats', result.comparison)
        self.assertIn('simulated_stats', result.comparison)
        self.assertIn('differences', result.comparison)
    
    def test_compare_curves(self):
        tc_actual = self.create_test_thermocouple_data(target_temp=1280.0)
        
        params = TargetCurveParams(
            target_temp=1300.0,
            heating_rate=150.0,
            holding_time_min=30.0,
            cooling_rate=100.0
        )
        
        tc_simulated = self.simulator.generate_target_curve(params, 'simulated')
        
        comparison = self.simulator._compare_curves(tc_actual, tc_simulated)
        
        self.assertIn('actual_stats', comparison)
        self.assertIn('simulated_stats', comparison)
        self.assertIn('differences', comparison)
        
        self.assertIn('max_temp', comparison['actual_stats'])
        self.assertIn('max_temp', comparison['simulated_stats'])
        self.assertIn('max_temp_diff', comparison['differences'])
        
        self.assertGreater(comparison['differences']['max_temp_diff'], 0)
    
    def test_run_multiple_simulations(self):
        tc_data = self.create_test_thermocouple_data(target_temp=1280.0)
        
        variations = [
            {
                'target_temp': 1280.0,
                'heating_rate': 150.0,
                'holding_time_min': 30.0
            },
            {
                'target_temp': 1300.0,
                'heating_rate': 120.0,
                'holding_time_min': 45.0
            },
            {
                'target_temp': 1260.0,
                'heating_rate': 180.0,
                'holding_time_min': 25.0
            }
        ]
        
        results = self.simulator.run_multiple_simulations(
            actual_data=tc_data,
            param_variations=variations
        )
        
        self.assertEqual(len(results), 3)
        
        for result in results:
            self.assertIsInstance(result, SimulationResult)
    
    def test_suggest_improvements_no_risk(self):
        from kiln_analyzer.risk_rules import RiskAnalyzer, GlazeRiskAssessment, RiskLevel
        from kiln_analyzer.data_parser import GlazeRecipe, KilnPosition
        
        tc_data = self.create_test_thermocouple_data(
            target_temp=1280.0,
            holding_minutes=30.0
        )
        
        empty_assessments = []
        
        suggestions = self.simulator.suggest_improvements(empty_assessments, tc_data)
        
        self.assertGreater(len(suggestions), 0)
        
        for suggestion in suggestions:
            self.assertIn('description', suggestion)
            self.assertIn('adjustments', suggestion)
            self.assertIn('expected_benefit', suggestion)
    
    def test_suggest_improvements_with_risks(self):
        from kiln_analyzer.risk_rules import RiskAnalyzer, GlazeRiskAssessment, RiskLevel, RiskType, RiskItem
        from kiln_analyzer.data_parser import GlazeRecipe, KilnPosition
        
        tc_data = self.create_test_thermocouple_data(
            target_temp=1280.0,
            holding_minutes=150.0
        )
        
        risk1 = RiskItem(
            risk_type=RiskType.CRACKING,
            risk_level=RiskLevel.HIGH,
            description='升温过快',
            severity_score=0.8,
            contributing_factors={},
            suggestions=[]
        )
        
        risk2 = RiskItem(
            risk_type=RiskType.GLAZE_RUN,
            risk_level=RiskLevel.MEDIUM,
            description='保温过长',
            severity_score=0.5,
            contributing_factors={},
            suggestions=[]
        )
        
        assessment = GlazeRiskAssessment(
            glaze_id='test',
            glaze_name='测试釉',
            position_id='pos1',
            position_name='位置1',
            overall_risk_level=RiskLevel.HIGH,
            risks=[risk1, risk2],
            summary='有高风险'
        )
        
        suggestions = self.simulator.suggest_improvements([assessment], tc_data)
        
        self.assertGreater(len(suggestions), 0)
        
        descriptions = [s['description'] for s in suggestions]
        
        has_cracking_suggestion = any('开裂' in d for d in descriptions)
        has_glaze_run_suggestion = any('流釉' in d for d in descriptions)
        
        self.assertTrue(has_cracking_suggestion)
        self.assertTrue(has_glaze_run_suggestion)
    
    def test_simulation_result_structure(self):
        tc_data = self.create_test_thermocouple_data()
        params = TargetCurveParams()
        
        result = self.simulator.simulate_with_params(tc_data, params)
        
        self.assertIsInstance(result.simulated_data, ThermocoupleData)
        self.assertIsInstance(result.target_params, TargetCurveParams)
        
        self.assertIn('actual_stats', result.comparison)
        self.assertIn('simulated_stats', result.comparison)
        self.assertIn('differences', result.comparison)


if __name__ == '__main__':
    unittest.main()
