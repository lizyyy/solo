import os
import sys
import unittest
from datetime import date

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

from models import ElderlyPerson, CoolingStation, HeatForecast, HourlyForecast
from risk_algorithm import RiskCalculator, HeatIndexCalculator, identify_risk_hotspots


class TestRiskCalculator(unittest.TestCase):
    def setUp(self):
        self.calculator = RiskCalculator()
        
        self.elderly_critical = ElderlyPerson(
            id="E001",
            name="测试老人1",
            age=88,
            gender="男",
            address="测试地址",
            district="测试区",
            community="测试社区",
            latitude=30.65,
            longitude=104.08,
            phone="13800000000",
            contact_person="联系人",
            contact_phone="13800000001",
            health_conditions=["高血压", "糖尿病", "心脏病"],
            living_alone=True,
            mobility="卧床",
            has_air_conditioning=False,
            needs_special_care=True,
        )
        
        self.elderly_low = ElderlyPerson(
            id="E002",
            name="测试老人2",
            age=66,
            gender="女",
            address="测试地址2",
            district="测试区",
            community="测试社区",
            latitude=30.65,
            longitude=104.08,
            phone="13800000002",
            contact_person="联系人2",
            contact_phone="13800000003",
            health_conditions=[],
            living_alone=False,
            mobility="正常",
            has_air_conditioning=True,
            needs_special_care=False,
        )
        
        self.forecast = HeatForecast(
            id="F001",
            forecast_date=date.today(),
            district="测试区",
            hourly_forecasts=[
                HourlyForecast(hour=12, temperature=36.0, feels_like=40.0, humidity=60, wind_speed=1.0, uv_index=10)
            ],
            max_temperature=36.5,
            min_temperature=26.0,
            heat_warning_level="橙色预警",
        )

    def test_age_score(self):
        score_critical = self.calculator.calculate_age_score(88)
        self.assertGreater(score_critical, 0.7)
        
        score_low = self.calculator.calculate_age_score(66)
        self.assertLess(score_low, 0.3)

    def test_health_score(self):
        score_high = self.calculator.calculate_health_score(["高血压", "糖尿病", "心脏病"])
        self.assertAlmostEqual(score_high, 0.9, places=5)
        
        score_low = self.calculator.calculate_health_score(["关节炎", "骨质疏松"])
        self.assertAlmostEqual(score_low, 0.3, places=5)
        
        score_none = self.calculator.calculate_health_score([])
        self.assertEqual(score_none, 0.0)

    def test_living_alone_score(self):
        score_high = self.calculator.calculate_living_alone_score(True, True)
        self.assertEqual(score_high, 1.0)
        
        score_medium = self.calculator.calculate_living_alone_score(True, False)
        self.assertEqual(score_medium, 0.6)
        
        score_low = self.calculator.calculate_living_alone_score(False, False)
        self.assertEqual(score_low, 0.0)

    def test_mobility_score(self):
        score_critical = self.calculator.calculate_mobility_score("卧床")
        self.assertEqual(score_critical, 1.0)
        
        score_medium = self.calculator.calculate_mobility_score("轮椅")
        self.assertEqual(score_medium, 0.7)
        
        score_low = self.calculator.calculate_mobility_score("正常")
        self.assertEqual(score_low, 0.0)

    def test_heat_exposure_score(self):
        hourly_data_critical = [{"feels_like": 40.0}]
        
        score_high = self.calculator.calculate_heat_exposure_score(
            has_air_conditioning=False,
            hourly_forecasts=hourly_data_critical,
            walking_time_to_nearest_station=40,
        )
        self.assertGreater(score_high, 0.5)
        
        hourly_data_safe = [{"feels_like": 32.0}]
        
        score_low = self.calculator.calculate_heat_exposure_score(
            has_air_conditioning=True,
            hourly_forecasts=hourly_data_safe,
            walking_time_to_nearest_station=10,
        )
        self.assertLess(score_low, 0.5)

    def test_calculate_person_risk(self):
        risk_factors = self.calculator.calculate_person_risk(
            self.elderly_critical,
            self.forecast,
        )
        
        self.assertGreater(risk_factors.total_score, 0.5)
        self.assertIn(risk_factors.risk_level, ["高风险", "极高风险"])
        
        risk_factors_low = self.calculator.calculate_person_risk(
            self.elderly_low,
            self.forecast,
        )
        
        self.assertLess(risk_factors_low.total_score, 0.5)

    def test_update_person_risk(self):
        updated_person = self.calculator.update_person_risk(
            self.elderly_critical,
            self.forecast,
        )
        
        self.assertGreater(updated_person.risk_score, 0.0)
        self.assertIn(updated_person.risk_level, ["高风险", "极高风险"])

    def test_calculate_community_risk_stats(self):
        persons = [self.elderly_critical, self.elderly_low]
        
        stats = self.calculator.calculate_community_risk_stats(persons)
        
        self.assertIn("risk_distribution", stats)
        self.assertIn("community_stats", stats)
        self.assertEqual(stats["total_persons"], 2)


class TestHeatIndexCalculator(unittest.TestCase):
    def test_calculate_heat_index(self):
        hi = HeatIndexCalculator.calculate_heat_index(30, 70)
        self.assertGreater(hi, 30)
        
        hi_low_temp = HeatIndexCalculator.calculate_heat_index(25, 50)
        self.assertEqual(hi_low_temp, 25)

    def test_feels_like_to_risk(self):
        risk_extreme = HeatIndexCalculator.feels_like_to_risk(55)
        self.assertEqual(risk_extreme, "极端危险")
        
        risk_danger = HeatIndexCalculator.feels_like_to_risk(42)
        self.assertEqual(risk_danger, "危险")
        
        risk_warning = HeatIndexCalculator.feels_like_to_risk(35)
        self.assertEqual(risk_warning, "警告")
        
        risk_safe = HeatIndexCalculator.feels_like_to_risk(26)
        self.assertEqual(risk_safe, "安全")


class TestIdentifyRiskHotspots(unittest.TestCase):
    def setUp(self):
        self.persons = [
            ElderlyPerson(
                id=f"E{i:03d}",
                name=f"测试{i}",
                age=75 + i,
                gender="男",
                address=f"地址{i}",
                district="测试区",
                community="测试社区",
                latitude=30.65 + i * 0.001,
                longitude=104.08 + i * 0.001,
                phone="13800000000",
                contact_person="联系人",
                contact_phone="13800000001",
                health_conditions=["高血压", "糖尿病"] if i < 3 else [],
                living_alone=True if i < 3 else False,
                mobility="卧床" if i < 2 else "正常",
                has_air_conditioning=False if i < 2 else True,
                needs_special_care=True if i < 3 else False,
                risk_score=0.8 if i < 2 else 0.3,
                risk_level="极高风险" if i < 2 else "低风险",
            )
            for i in range(5)
        ]
        
        self.stations = [
            CoolingStation(
                id="S001",
                name="测试站点",
                address="站点地址",
                district="测试区",
                community="测试社区",
                latitude=30.655,
                longitude=104.085,
                capacity=50,
            )
        ]

    def test_identify_hotspots(self):
        hotspots = identify_risk_hotspots(self.persons, self.stations)
        
        self.assertIsInstance(hotspots, list)
        
        if hotspots:
            self.assertIn("severity", hotspots[0])
            self.assertIn("center_lat", hotspots[0])
            self.assertIn("center_lon", hotspots[0])
            self.assertIn("total_count", hotspots[0])
            self.assertIn("high_risk_total", hotspots[0])


if __name__ == "__main__":
    unittest.main()
