import pytest
from datetime import datetime
import math

from app.calculators.shading import ShadingCalculator
from app.calculators.generation import GenerationCalculator
from app.calculators.revenue import RevenueCalculator


class TestShadingCalculator:
    def setup_method(self):
        self.calc = ShadingCalculator(latitude=30.0, longitude=120.0)
    
    def test_solar_position_summer_solstice(self):
        dt = datetime(2024, 6, 21, 12, 0, 0)
        elevation, azimuth = self.calc.calculate_solar_position(dt)
        
        assert elevation > 0, "夏至中午太阳高度角应大于0"
        assert elevation < 90, "太阳高度角应小于90"
    
    def test_solar_position_winter_solstice(self):
        dt = datetime(2024, 12, 21, 12, 0, 0)
        elevation, azimuth = self.calc.calculate_solar_position(dt)
        
        assert elevation > 0, "冬至中午太阳高度角应大于0"
    
    def test_solar_position_night(self):
        dt = datetime(2024, 6, 21, 0, 0, 0)
        elevation, azimuth = self.calc.calculate_solar_position(dt)
        
        assert elevation == 0.0, "夜间太阳高度角应为0"
    
    def test_calculate_polygon_area(self):
        from shapely.geometry import Polygon
        
        coords = [(0, 0), (10, 0), (10, 10), (0, 10)]
        poly = Polygon(coords)
        
        assert abs(poly.area - 100.0) < 0.01
    
    def test_generate_shading_map_basic(self):
        roof_coords = [
            {"x": 0, "y": 0},
            {"x": 20, "y": 0},
            {"x": 20, "y": 15},
            {"x": 0, "y": 15}
        ]
        obstacles = []
        
        result = self.calc.generate_shading_map(
            roof_coords=roof_coords,
            obstacles=obstacles,
            grid_size=1.0
        )
        
        assert "points" in result
        assert len(result["points"]) > 0


class TestGenerationCalculator:
    def setup_method(self):
        self.calc = GenerationCalculator()
    
    def test_calculate_effective_irradiance_basic(self):
        irradiance = 1000
        effective = self.calc.calculate_effective_irradiance(
            global_irradiance=irradiance,
            shading_ratio=0.0,
            inclination=0.0
        )
        
        assert effective == irradiance
    
    def test_calculate_effective_irradiance_with_shading(self):
        irradiance = 1000
        effective = self.calc.calculate_effective_irradiance(
            global_irradiance=irradiance,
            shading_ratio=0.5,
            inclination=0.0
        )
        
        assert effective == 500
    
    def test_calculate_effective_irradiance_with_inclination(self):
        irradiance = 1000
        effective = self.calc.calculate_effective_irradiance(
            global_irradiance=irradiance,
            shading_ratio=0.0,
            inclination=30.0
        )
        
        expected = irradiance * math.cos(math.radians(30))
        assert abs(effective - expected) < 0.01
    
    def test_calculate_power_output_zero_irradiance(self):
        power = self.calc.calculate_power_output(
            rated_power=450,
            efficiency=0.21,
            irradiance=0,
            panel_temp=25
        )
        
        assert power == 0
    
    def test_calculate_power_output_stc(self):
        power = self.calc.calculate_power_output(
            rated_power=450,
            efficiency=0.21,
            irradiance=1000,
            panel_temp=25
        )
        
        assert power > 0
        assert power < 450
    
    def test_calculate_installable_capacity(self):
        result = self.calc.calculate_installable_capacity(
            roof_area=100,
            panel_width=1.65,
            panel_height=0.992,
            panel_power=450,
            spacing_ratio=0.1
        )
        
        assert result['max_panels'] > 0
        assert result['installable_capacity_kw'] > 0
        assert result['panel_area'] > 0


class TestRevenueCalculator:
    def setup_method(self):
        self.calc = RevenueCalculator()
    
    def test_calculate_hourly_revenue_basic(self):
        hourly_data = [
            {'timestamp': '2024-01-01T10:00:00', 'electricity_price': 0.8, 'feed_in_tariff': 0.45}
        ]
        hourly_generation = [
            {'kwh': 10}
        ]
        
        result = self.calc.calculate_hourly_revenue(
            hourly_data=hourly_data,
            hourly_generation=hourly_generation,
            self_consumption_ratio=0.7
        )
        
        assert result['total_revenue'] > 0
        assert result['total_self_consumed'] == 7
        assert result['total_grid_exported'] == 3
    
    def test_calculate_financial_metrics_positive_case(self):
        result = self.calc.calculate_financial_metrics(
            initial_investment=100000,
            annual_revenue=15000,
            lifetime=25,
            discount_rate=0.05
        )
        
        assert result['payback_period_years'] is not None
        assert result['payback_period_years'] > 0
        assert result['cumulative_cash_flow'] > 0
    
    def test_calculate_risk_factors_high_shading(self):
        risks = self.calc.calculate_risk_factors(
            shading_loss_ratio=0.5,
            installable_capacity=10,
            actual_capacity=8,
            annual_generation=8000,
            payback_period=8
        )
        
        assert len(risks) > 0
        
        shading_risk = next((r for r in risks if r['type'] == 'shading'), None)
        assert shading_risk is not None
        assert shading_risk['severity'] in ['high', 'medium']
    
    def test_calculate_risk_factors_low_risk(self):
        risks = self.calc.calculate_risk_factors(
            shading_loss_ratio=0.05,
            installable_capacity=10,
            actual_capacity=9,
            annual_generation=12000,
            payback_period=6
        )
        
        assert len(risks) > 0
        assert all(r['severity'] == 'low' for r in risks)
