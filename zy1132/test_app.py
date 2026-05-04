import pytest
import json
import os
import sys
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import DATA_DIR, SCHEMES_DIR, EXPORTS_DIR
from models import Parcel, Facility, PopulationData, ServiceGap, ConflictIssue, Scheme
from calculator import (
    DataLoader, ServiceCalculator, ConflictChecker, AssessmentEngine,
    haversine_distance, get_parcel_centroid
)


class TestHaversineDistance:
    def test_haversine_distance_same_point(self):
        dist = haversine_distance(116.387, 39.916, 116.387, 39.916)
        assert dist == 0
    
    def test_haversine_distance_approximate(self):
        dist = haversine_distance(116.387, 39.916, 116.388, 39.916)
        assert 0 < dist < 200


class TestModels:
    def test_parcel_creation(self):
        parcel = Parcel(
            id='P001',
            name='测试地块',
            land_use='R2',
            area_sqm=10000,
            current_far=2.0,
            plan_far=3.0,
            max_far=3.5
        )
        assert parcel.id == 'P001'
        assert parcel.land_use == 'R2'
        assert parcel.area_sqm == 10000
    
    def test_parcel_calculate_metrics(self):
        parcel = Parcel(
            id='P001',
            name='测试地块',
            land_use='R2',
            area_sqm=10000,
            current_far=2.0,
            plan_far=3.0,
            max_far=3.5
        )
        parcel.calculate_metrics('plan')
        assert parcel.calculated_building_area == 30000
        assert parcel.estimated_population > 0
    
    def test_facility_creation(self):
        from shapely.geometry import Point
        facility = Facility(
            id='F001',
            name='测试小学',
            type='school_primary',
            lon=116.387,
            lat=39.916,
            capacity=500,
            status='active'
        )
        assert facility.type == 'school_primary'
        assert facility.capacity == 500
    
    def test_population_data_creation(self):
        pop = PopulationData(
            parcel_id='P001',
            total_population=1000,
            age_0_17=150,
            age_18_64=650,
            age_65_plus=200,
            male=510,
            female=490,
            households=350,
            avg_household_size=2.86
        )
        assert pop.total_population == 1000
        assert pop.age_65_plus == 200
    
    def test_scheme_creation(self):
        scheme = Scheme.create_new('测试方案', '这是一个测试方案')
        assert scheme.name == '测试方案'
        assert scheme.created_at is not None
        assert scheme.id.startswith('scheme_')


class TestCalculator:
    def setup_method(self):
        self.parcels = [
            Parcel(
                id='P001', name='居住地块1', land_use='R2',
                area_sqm=12500, current_far=2.5, plan_far=3.0, max_far=3.5,
                existing_population=890
            ),
            Parcel(
                id='P002', name='商业地块', land_use='B1',
                area_sqm=8500, current_far=3.0, plan_far=4.0, max_far=5.0,
                existing_population=0
            )
        ]
        for p in self.parcels:
            p.calculate_metrics('plan')
        
        from shapely.geometry import Point
        self.facilities = [
            Facility(
                id='F001', name='测试小学', type='school_primary',
                lon=116.386, lat=39.919, capacity=800, status='active'
            ),
            Facility(
                id='F002', name='测试公园', type='park',
                lon=116.383, lat=39.913, capacity=22000, status='active'
            )
        ]
        
        self.population_data = {
            'P001': PopulationData(
                parcel_id='P001', total_population=890,
                age_0_17=134, age_18_64=578, age_65_plus=178,
                male=450, female=440, households=320, avg_household_size=2.78
            )
        }
        
        self.plan_rules = {
            'service_radius': {
                'school_primary': {'name': '小学', 'radius_meters': 500, 'capacity_per_1000': 40, 'unit': '学位'},
                'park': {'name': '公园绿地', 'radius_meters': 500, 'capacity_per_1000': 2.0, 'unit': '平方米/人'}
            },
            'land_use_rules': {
                'R2': {'name': '二类居住用地', 'max_far': 3.5, 'max_height': 80, 'max_density': 35}
            },
            'conflict_checks': {
                'far_exceed_max': {'enabled': True, 'severity': 'high', 'description': '容积率超过控规上限'},
                'height_exceed_limit': {'enabled': True, 'severity': 'high', 'description': '高度超过限高'},
                'density_exceed_limit': {'enabled': True, 'severity': 'medium', 'description': '密度超过上限'}
            }
        }
    
    def test_service_calculator_total_population(self):
        calc = ServiceCalculator(self.parcels, self.facilities, self.population_data, self.plan_rules)
        total = calc.calculate_total_population()
        assert total == 890
    
    def test_service_calculator_service_coverage(self):
        calc = ServiceCalculator(self.parcels, self.facilities, self.population_data, self.plan_rules)
        coverage = calc.calculate_service_coverage('school_primary')
        assert 'coverage_percentage' in coverage
        assert 'covered_parcels' in coverage
    
    def test_conflict_checker_far_exceed(self):
        exceed_parcel = Parcel(
            id='P003', name='超标地块', land_use='R2',
            area_sqm=10000, current_far=2.0, plan_far=4.0, max_far=3.5
        )
        
        checker = ConflictChecker([exceed_parcel], self.plan_rules)
        issues = checker.check_far_exceed_max()
        
        assert len(issues) == 1
        assert issues[0].type == 'far_exceed_max'
        assert issues[0].current_value == 4.0
        assert issues[0].limit_value == 3.5
    
    def test_assessment_engine_parcel_metrics(self):
        engine = AssessmentEngine(self.parcels, self.facilities, self.population_data, self.plan_rules)
        metrics = engine.calculate_parcel_metrics()
        
        assert metrics['total_parcels'] == 2
        assert metrics['total_area_sqm'] == 21000
        assert metrics['total_residential_area_sqm'] == 12500
        assert metrics['total_commercial_area_sqm'] == 8500
    
    def test_assessment_engine_service_scores(self):
        engine = AssessmentEngine(self.parcels, self.facilities, self.population_data, self.plan_rules)
        scores = engine.calculate_service_scores()
        
        assert 'total_score' in scores
        assert 'category_scores' in scores


class TestDataLoader:
    def test_data_loader_directory_exists(self):
        assert os.path.exists(DATA_DIR)
    
    def test_data_loader_loads_sample_data(self):
        parcels_geojson = os.path.join(DATA_DIR, 'parcels.geojson')
        assert os.path.exists(parcels_geojson)
        
        with open(parcels_geojson, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        assert data['type'] == 'FeatureCollection'
        assert len(data['features']) > 0


class TestSchemeAndExporters:
    def test_scheme_comparison_identifies_changes(self):
        from scheme_manager import SchemeManager
        import tempfile
        
        with tempfile.TemporaryDirectory() as tmp_dir:
            manager = SchemeManager(tmp_dir)
            
            scheme1 = manager.create_scheme(
                '方案A', '初始方案',
                base_parcels=[{'id': 'P1', 'name': '地块1', 'plan_far': 2.0, 'land_use': 'R2'}],
                base_facilities=[]
            )
            
            scheme2 = manager.create_scheme(
                '方案B', '修改容积率',
                base_parcels=[{'id': 'P1', 'name': '地块1', 'plan_far': 3.0, 'land_use': 'R2'}],
                base_facilities=[]
            )
            
            comparison = manager.compare_schemes(scheme1['id'], scheme2['id'])
            assert comparison is not None
            assert comparison['assessment_differences'] is not None
    
    def test_report_exporter_generates_markdown(self):
        from report_exporter import ReportExporter
        import tempfile
        
        with tempfile.TemporaryDirectory() as tmp_dir:
            exporter = ReportExporter(tmp_dir)
            
            sample_assessment = {
                'parcel_metrics': {
                    'total_parcels': 2,
                    'total_area_sqm': 21000,
                    'total_residential_area_sqm': 12500,
                    'total_commercial_area_sqm': 8500,
                    'total_green_area_sqm': 0,
                    'green_space_ratio': 0,
                    'existing_total_population': 890,
                    'estimated_total_population': 1000,
                    'land_use_breakdown': {
                        '居住用地': {'count': 1, 'area_sqm': 12500, 'percentage': 59.5},
                        '商业用地': {'count': 1, 'area_sqm': 8500, 'percentage': 40.5}
                    }
                },
                'service_scores': {
                    'total_score': 75.5,
                    'category_scores': {
                        'education': 80,
                        'healthcare_elderly': 70,
                        'green_space': 65,
                        'commerce_market': 85,
                        'transportation': 75,
                        'community_services': 78
                    },
                    'weights': {}
                },
                'service_gaps': [
                    {
                        'facility_type': 'school_primary',
                        'facility_name': '小学',
                        'radius_meters': 500,
                        'demand': 40,
                        'supply': 30,
                        'gap': 10,
                        'gap_percentage': 25,
                        'severity': 'medium',
                        'affected_parcels': ['P001'],
                        'affected_population': 890
                    }
                ],
                'conflicts': [
                    {
                        'type': 'far_exceed_max',
                        'severity': 'high',
                        'description': '容积率超过控规上限',
                        'location': '测试地块',
                        'parcel_id': 'P001',
                        'current_value': 4.0,
                        'limit_value': 3.5,
                        'recommendation': '降低容积率'
                    }
                ]
            }
            
            md_output = exporter.export_markdown(sample_assessment)
            assert '# 城市更新评估报告' in md_output
            assert '小学' in md_output
            assert '容积率' in md_output


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
