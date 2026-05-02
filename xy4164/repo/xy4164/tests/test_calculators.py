"""DLI计算测试"""

import unittest
from datetime import time, datetime

from ..lighting_previewer.models import (
    CropZone, LightThreshold,
    LEDSpectrum, SpectrumChannel,
    SensorData, SensorReading,
    ElectricityPrice, PriceTier,
    LightPlan, SupplementInterval, PriorityLevel
)
from ..lighting_previewer.calculators import (
    DLICalculator, SpectrumAnalyzer, EnergyCostCalculator, CalculationEngine
)


class TestDLICalculator(unittest.TestCase):
    
    def setUp(self):
        self.calculator = DLICalculator()
    
    def test_calculate_dli_from_ppfd(self):
        ppfd = 300.0
        duration_hours = 12.0
        
        dli = self.calculator.calculate_dli_from_ppfd(ppfd, duration_hours)
        
        expected = 300.0 * 12.0 * 0.0036
        self.assertAlmostEqual(dli, expected, places=2)
    
    def test_calculate_required_ppfd_for_dli(self):
        target_dli = 15.0
        available_hours = 12.0
        
        ppfd = self.calculator.calculate_required_ppfd_for_dli(target_dli, available_hours)
        
        expected = 15.0 / (12.0 * 0.0036)
        self.assertAlmostEqual(ppfd, expected, places=2)
    
    def test_calculate_supplemental_ppfd(self):
        channels = [
            SpectrumChannel("Blue", 450, 0.25, 2.5),
            SpectrumChannel("Red", 660, 0.65, 2.8),
            SpectrumChannel("Far-Red", 730, 0.10, 2.5)
        ]
        
        spectrum = LEDSpectrum(
            spectrum_id="SPEC001",
            spectrum_name="测试",
            manufacturer="Test",
            model="Model-100",
            total_power=100.0,
            photon_flux_density=280.0,
            channels=channels
        )
        
        ppfd_100 = self.calculator.calculate_supplemental_ppfd(spectrum, 100.0)
        self.assertEqual(ppfd_100, 280.0)
        
        ppfd_50 = self.calculator.calculate_supplemental_ppfd(spectrum, 50.0)
        self.assertEqual(ppfd_50, 140.0)
    
    def test_calculate_natural_dli(self):
        readings = []
        for hour in range(24):
            ppfd = 0.0
            if 6 <= hour < 18:
                ppfd = 200.0
            
            readings.append(SensorReading(
                timestamp=datetime(2024, 5, 1, hour, 0, 0),
                ppfd=ppfd
            ))
        
        sensor = SensorData(
            sensor_id="S001",
            sensor_name="测试",
            location="测试区",
            readings=readings
        )
        
        dli = self.calculator.calculate_natural_dli_from_sensor(
            sensor,
            photoperiod_start_hour=6,
            photoperiod_end_hour=18
        )
        
        expected = 200.0 * 12.0 * 0.0036
        self.assertAlmostEqual(dli, expected, places=2)


class TestSpectrumAnalyzer(unittest.TestCase):
    
    def setUp(self):
        self.analyzer = SpectrumAnalyzer()
    
    def test_analyze_spectrum(self):
        channels = [
            SpectrumChannel("Blue", 450, 0.25, 2.5),
            SpectrumChannel("Red", 660, 0.65, 2.8),
            SpectrumChannel("Far-Red", 730, 0.10, 2.5)
        ]
        
        spectrum = LEDSpectrum(
            spectrum_id="SPEC001",
            spectrum_name="测试",
            manufacturer="Test",
            model="Model-100",
            total_power=100.0,
            photon_flux_density=280.0,
            channels=channels
        )
        
        analysis = self.analyzer.analyze_spectrum(spectrum)
        
        self.assertAlmostEqual(analysis["blue_ratio"], 0.25, places=2)
        self.assertAlmostEqual(analysis["red_ratio"], 0.65, places=2)
        self.assertAlmostEqual(analysis["blue_red_ratio"], 0.25 / 0.65, places=2)
    
    def test_get_recommended_spectrum(self):
        lettuce_rec = self.analyzer.get_recommended_spectrum("leafy_lettuce")
        self.assertEqual(lettuce_rec["blue_ratio"], 0.25)
        
        tomato_rec = self.analyzer.get_recommended_spectrum("tomato")
        self.assertEqual(tomato_rec["blue_ratio"], 0.20)
        
        general_rec = self.analyzer.get_recommended_spectrum("unknown")
        self.assertEqual(general_rec["blue_ratio"], 0.20)


class TestEnergyCostCalculator(unittest.TestCase):
    
    def setUp(self):
        self.calculator = EnergyCostCalculator()
        
        self.threshold = LightThreshold(10.0, 20.0, 15.0)
        self.zone = CropZone(
            zone_id="Z001",
            zone_name="测试区",
            crop_type="test",
            shelf_count=5,
            shelf_height=0.5,
            shelf_width=1.2,
            led_spectrum_id="SPEC001",
            sensor_id="S001",
            light_threshold=self.threshold,
            installed_power=800.0,
            photoperiod_start=time(6, 0),
            photoperiod_end=time(22, 0)
        )
        
        self.electricity_price = ElectricityPrice(
            price_id="PRICE001",
            price_name="测试电价",
            region="测试",
            effective_date="2024-05-01",
            tiers=[
                PriceTier("谷电", 0.25, time(23, 0), time(8, 0)),
                PriceTier("峰电", 0.85, time(8, 0), time(23, 0))
            ]
        )
    
    def test_calculate_interval_energy(self):
        interval = SupplementInterval(
            zone_id="Z001",
            start_hour=20,
            end_hour=22,
            power_percentage=100.0
        )
        
        energy = self.calculator.calculate_interval_energy(self.zone, interval)
        
        expected = (800.0 / 1000.0) * 1.0 * 2.0
        self.assertEqual(energy, expected)
    
    def test_calculate_interval_cost(self):
        energy = 1.6
        
        cost_peak = self.calculator.calculate_interval_cost(
            energy, 12, self.electricity_price
        )
        self.assertEqual(cost_peak, 1.6 * 0.85)
        
        cost_offpeak = self.calculator.calculate_interval_cost(
            energy, 0, self.electricity_price
        )
        self.assertEqual(cost_offpeak, 1.6 * 0.25)
    
    def test_calculate_hourly_energy_cost(self):
        zones = [self.zone]
        
        plan = LightPlan(
            plan_id="PLAN001",
            plan_name="测试",
            created_at=datetime.now().isoformat(),
            base_date="2024-05-01",
            intervals=[
                SupplementInterval("Z001", 0, 4, 100.0, PriorityLevel.HIGH),
                SupplementInterval("Z001", 20, 22, 50.0, PriorityLevel.MEDIUM)
            ]
        )
        
        hourly_data = self.calculator.calculate_hourly_energy_cost(
            zones, plan, self.electricity_price
        )
        
        self.assertEqual(hourly_data[0]["total_power_kw"], 0.8)
        self.assertEqual(hourly_data[20]["total_power_kw"], 0.4)
        self.assertEqual(hourly_data[12]["total_power_kw"], 0.0)


if __name__ == "__main__":
    unittest.main()
