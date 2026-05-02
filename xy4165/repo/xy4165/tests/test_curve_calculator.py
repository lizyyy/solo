import unittest
import pandas as pd
import numpy as np
from datetime import timedelta

from kiln_analyzer.curve_calculator import (
    CurveCalculator,
    CurveCalculationResult,
    HeatingRateResult,
    HoldingSegment,
    ThermalExposureResult
)
from kiln_analyzer.data_parser import ThermocoupleData


class TestCurveCalculator(unittest.TestCase):
    
    def setUp(self):
        self.calculator = CurveCalculator(target_holding_temp=1280.0)
    
    def create_test_thermocouple_data(self, 
                                        start_temp: float = 20.0,
                                        target_temp: float = 1280.0,
                                        heating_minutes: int = 300,
                                        holding_minutes: int = 30,
                                        cooling_minutes: int = 120) -> ThermocoupleData:
        
        times = pd.date_range(
            start='2024-01-01 08:00:00',
            periods=heating_minutes + holding_minutes + cooling_minutes,
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
            name='test_curve',
            time_series=times,
            temperatures=pd.Series(temps),
            metadata={'test': True}
        )
    
    def test_calculate_heating_rate_basic(self):
        tc_data = self.create_test_thermocouple_data()
        
        result = self.calculator.calculate_heating_rate(tc_data, time_unit='hour')
        
        self.assertIsInstance(result, HeatingRateResult)
        self.assertGreater(result.max_rate, 0)
        self.assertGreater(result.avg_rate, 0)
    
    def test_calculate_heating_rate_units(self):
        tc_data = self.create_test_thermocouple_data()
        
        result_hour = self.calculator.calculate_heating_rate(tc_data, time_unit='hour')
        result_min = self.calculator.calculate_heating_rate(tc_data, time_unit='minute')
        
        expected_ratio = 60.0
        actual_ratio = result_hour.avg_rate / result_min.avg_rate if result_min.avg_rate != 0 else 0
        
        self.assertAlmostEqual(actual_ratio, expected_ratio, delta=5.0)
    
    def test_identify_rate_periods(self):
        tc_data = self.create_test_thermocouple_data()
        result = self.calculator.calculate_heating_rate(tc_data)
        
        self.assertGreater(len(result.rate_periods), 0)
        
        phases = [p['phase'] for p in result.rate_periods]
        self.assertIn('heating', phases)
        self.assertIn('holding', phases)
        self.assertIn('cooling', phases)
    
    def test_detect_holding_segments(self):
        tc_data = self.create_test_thermocouple_data()
        
        segments = self.calculator.detect_holding_segments(tc_data, target_temp=1280.0)
        
        self.assertGreater(len(segments), 0)
        
        for seg in segments:
            self.assertIsInstance(seg, HoldingSegment)
            self.assertGreater(seg.duration_minutes, 0)
            self.assertAlmostEqual(seg.target_temp, 1280.0, delta=5.0)
    
    def test_detect_holding_segments_sufficient(self):
        tc_data = self.create_test_thermocouple_data(holding_minutes=40)
        
        segments = self.calculator.detect_holding_segments(tc_data, target_temp=1280.0)
        
        for seg in segments:
            if seg.duration_minutes >= 10:
                self.assertTrue(seg.is_sufficient)
    
    def test_calculate_thermal_exposure(self):
        tc_data = self.create_test_thermocouple_data()
        
        result = self.calculator.calculate_thermal_exposure(
            tc_data, position_id='pos_1',
            thresholds=[500, 800, 1000, 1200]
        )
        
        self.assertIsInstance(result, ThermalExposureResult)
        self.assertEqual(result.position_id, 'pos_1')
        self.assertGreater(result.peak_temperature, 0)
        self.assertGreater(result.total_heat_exposure, 0)
        
        for key in ['above_500C', 'above_800C', 'above_1000C', 'above_1200C']:
            self.assertIn(key, result.time_above_threshold)
    
    def test_calculate_full_curve(self):
        tc_data = self.create_test_thermocouple_data()
        
        result = self.calculator.calculate_full_curve(tc_data, target_holding_temp=1280.0)
        
        self.assertIsInstance(result, CurveCalculationResult)
        self.assertEqual(result.thermocouple_name, 'test_curve')
        
        self.assertIsNotNone(result.heating_rates)
        self.assertIsInstance(result.heating_rates, HeatingRateResult)
        
        self.assertGreater(len(result.holding_segments), 0)
        
        self.assertIn('max_temperature', result.thermal_summary)
        self.assertIn('total_duration_minutes', result.thermal_summary)
    
    def test_calculate_full_curve_thermal_summary(self):
        tc_data = self.create_test_thermocouple_data()
        
        result = self.calculator.calculate_full_curve(tc_data, target_holding_temp=1280.0)
        
        self.assertAlmostEqual(
            result.thermal_summary['max_temperature'],
            1280.0,
            delta=5.0
        )
        self.assertGreater(result.thermal_summary['total_duration_minutes'], 0)
    
    def test_compare_multiple_thermocouples(self):
        from kiln_analyzer.data_parser import KilnPosition
        
        tc1 = self.create_test_thermocouple_data(target_temp=1280.0)
        tc2 = self.create_test_thermocouple_data(target_temp=1260.0)
        
        thermocouples = {
            'tc1': tc1,
            'tc2': tc2
        }
        
        positions = {
            'pos1': KilnPosition(
                id='pos1', name='位置1',
                position_x=0.0, position_y=0.0, position_z=0.0,
                thermocouple_id='tc1',
                items=[]
            ),
            'pos2': KilnPosition(
                id='pos2', name='位置2',
                position_x=1.0, position_y=1.0, position_z=1.0,
                thermocouple_id='tc2',
                items=[]
            )
        }
        
        result = self.calculator.compare_multiple_thermocouples(thermocouples, positions)
        
        self.assertIn('individual_exposures', result)
        self.assertIn('comparison', result)
        self.assertIn('max_peak_difference', result['comparison'])
        self.assertGreater(result['comparison']['max_peak_difference'], 0)
    
    def test_heating_rate_period_duration(self):
        tc_data = self.create_test_thermocouple_data(
            heating_minutes=300,
            holding_minutes=30,
            cooling_minutes=120
        )
        
        result = self.calculator.calculate_heating_rate(tc_data)
        
        for period in result.rate_periods:
            self.assertIn('duration_minutes', period)
            self.assertGreater(period['duration_minutes'], 0)


if __name__ == '__main__':
    unittest.main()
