"""数据模型测试"""

import unittest
from datetime import time, datetime

from ..lighting_previewer.models import (
    CropZone, LightThreshold,
    LEDSpectrum, SpectrumChannel,
    SensorData, SensorReading,
    ElectricityPrice, PriceTier,
    LightPlan, SupplementInterval, PriorityLevel
)


class TestLightThreshold(unittest.TestCase):
    
    def test_valid_threshold(self):
        threshold = LightThreshold(
            min_dli=10.0,
            max_dli=20.0,
            target_dli=15.0
        )
        errors = threshold.validate()
        self.assertEqual(len(errors), 0)
    
    def test_invalid_negative_min_dli(self):
        threshold = LightThreshold(
            min_dli=-5.0,
            max_dli=20.0,
            target_dli=15.0
        )
        errors = threshold.validate()
        self.assertGreater(len(errors), 0)
    
    def test_invalid_max_less_than_min(self):
        threshold = LightThreshold(
            min_dli=20.0,
            max_dli=10.0,
            target_dli=15.0
        )
        errors = threshold.validate()
        self.assertGreater(len(errors), 0)
    
    def test_target_out_of_range(self):
        threshold = LightThreshold(
            min_dli=10.0,
            max_dli=20.0,
            target_dli=25.0
        )
        errors = threshold.validate()
        self.assertGreater(len(errors), 0)


class TestCropZone(unittest.TestCase):
    
    def setUp(self):
        self.threshold = LightThreshold(
            min_dli=10.0,
            max_dli=20.0,
            target_dli=15.0
        )
    
    def test_valid_zone(self):
        zone = CropZone(
            zone_id="Z001",
            zone_name="叶菜区",
            crop_type="lettuce",
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
        errors = zone.validate()
        self.assertEqual(len(errors), 0)
    
    def test_zone_properties(self):
        zone = CropZone(
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
        
        self.assertEqual(zone.area_per_shelf, 1.2)
        self.assertEqual(zone.total_area, 6.0)
        self.assertEqual(zone.photoperiod_hours, 16.0)
    
    def test_invalid_zone_id(self):
        zone = CropZone(
            zone_id="",
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
        errors = zone.validate()
        self.assertGreater(len(errors), 0)
    
    def test_to_dict_and_from_dict(self):
        zone = CropZone(
            zone_id="Z001",
            zone_name="叶菜区",
            crop_type="lettuce",
            shelf_count=5,
            shelf_height=0.5,
            shelf_width=1.2,
            led_spectrum_id="SPEC001",
            sensor_id="S001",
            light_threshold=self.threshold,
            installed_power=800.0,
            photoperiod_start=time(6, 0),
            photoperiod_end=time(22, 0),
            notes="测试备注"
        )
        
        zone_dict = zone.to_dict()
        restored_zone = CropZone.from_dict(zone_dict)
        
        self.assertEqual(restored_zone.zone_id, zone.zone_id)
        self.assertEqual(restored_zone.zone_name, zone.zone_name)
        self.assertEqual(restored_zone.shelf_count, zone.shelf_count)
        self.assertEqual(
            restored_zone.light_threshold.target_dli,
            zone.light_threshold.target_dli
        )


class TestLEDSpectrum(unittest.TestCase):
    
    def test_valid_spectrum(self):
        channels = [
            SpectrumChannel(
                wavelength_range="Blue",
                wavelength_nm=450,
                intensity_ratio=0.25,
                photon_efficiency=2.5
            ),
            SpectrumChannel(
                wavelength_range="Red",
                wavelength_nm=660,
                intensity_ratio=0.65,
                photon_efficiency=2.8
            ),
            SpectrumChannel(
                wavelength_range="Far-Red",
                wavelength_nm=730,
                intensity_ratio=0.10,
                photon_efficiency=2.5
            )
        ]
        
        spectrum = LEDSpectrum(
            spectrum_id="SPEC001",
            spectrum_name="全光谱灯",
            manufacturer="Test",
            model="TEST-100",
            total_power=100.0,
            photon_flux_density=280.0,
            channels=channels
        )
        
        errors = spectrum.validate()
        self.assertEqual(len(errors), 0)
    
    def test_spectrum_ratios(self):
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
        
        self.assertAlmostEqual(spectrum.blue_ratio, 0.25, places=2)
        self.assertAlmostEqual(spectrum.red_ratio, 0.65, places=2)
        self.assertAlmostEqual(spectrum.far_red_ratio, 0.10, places=2)
        self.assertAlmostEqual(spectrum.blue_red_ratio, 0.25 / 0.65, places=2)


class TestSensorData(unittest.TestCase):
    
    def test_sensor_reading(self):
        reading = SensorReading(
            timestamp=datetime(2024, 5, 1, 12, 0, 0),
            ppfd=300.0,
            temp=25.0,
            humidity=60.0,
            co2=700.0
        )
        
        self.assertEqual(reading.ppfd, 300.0)
        self.assertEqual(reading.hour_of_day, 12)
        self.assertTrue(reading.is_daylight)
    
    def test_sensor_data(self):
        readings = []
        for hour in range(24):
            readings.append(SensorReading(
                timestamp=datetime(2024, 5, 1, hour, 0, 0),
                ppfd=100.0 if 6 <= hour < 18 else 0.0
            ))
        
        sensor = SensorData(
            sensor_id="S001",
            sensor_name="测试传感器",
            location="测试区域",
            readings=readings
        )
        
        hourly_profile = sensor.get_daily_ppfd_profile()
        self.assertEqual(hourly_profile[12], 100.0)
        self.assertEqual(hourly_profile[0], 0.0)


class TestElectricityPrice(unittest.TestCase):
    
    def test_price_tier(self):
        tier = PriceTier(
            tier_name="谷电",
            price_per_kwh=0.25,
            start_time=time(23, 0),
            end_time=time(8, 0)
        )
        
        self.assertTrue(tier.contains_hour(0))
        self.assertTrue(tier.contains_hour(7))
        self.assertFalse(tier.contains_hour(12))
        self.assertEqual(tier.duration_hours, 9.0)
    
    def test_electricity_price(self):
        tiers = [
            PriceTier("峰电", 0.85, time(8, 0), time(11, 0)),
            PriceTier("平电", 0.55, time(11, 0), time(18, 0)),
            PriceTier("峰电", 0.85, time(18, 0), time(23, 0)),
            PriceTier("谷电", 0.25, time(23, 0), time(8, 0))
        ]
        
        price = ElectricityPrice(
            price_id="PRICE001",
            price_name="工业分时电价",
            region="华东",
            effective_date="2024-05-01",
            tiers=tiers
        )
        
        errors = price.validate()
        self.assertEqual(len(errors), 0)
        
        self.assertEqual(price.get_price_for_hour(9), 0.85)
        self.assertEqual(price.get_price_for_hour(12), 0.55)
        self.assertEqual(price.get_price_for_hour(0), 0.25)


class TestLightPlan(unittest.TestCase):
    
    def test_supplement_interval(self):
        interval = SupplementInterval(
            zone_id="Z001",
            start_hour=20,
            end_hour=22,
            power_percentage=100.0,
            priority=PriorityLevel.HIGH,
            estimated_ppfd=280.0,
            estimated_dli_contribution=2.0,
            estimated_energy=1.6,
            estimated_cost=0.4
        )
        
        self.assertEqual(interval.duration_hours, 2)
        self.assertEqual(interval.priority, PriorityLevel.HIGH)
    
    def test_light_plan(self):
        intervals = [
            SupplementInterval("Z001", 20, 22, 100.0, PriorityLevel.HIGH),
            SupplementInterval("Z002", 21, 23, 80.0, PriorityLevel.MEDIUM)
        ]
        
        plan = LightPlan(
            plan_id="PLAN001",
            plan_name="测试方案",
            created_at=datetime.now().isoformat(),
            base_date="2024-05-01",
            intervals=intervals,
            total_estimated_energy=2.5,
            total_estimated_cost=0.625,
            budget_limit=100.0
        )
        
        zone_intervals = plan.get_intervals_for_zone("Z001")
        self.assertEqual(len(zone_intervals), 1)
        self.assertCountEqual(plan.get_zones(), ["Z001", "Z002"])


if __name__ == "__main__":
    unittest.main()
