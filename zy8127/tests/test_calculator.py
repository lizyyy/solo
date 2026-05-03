import pytest
import pandas as pd
from datetime import date, timedelta
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from ration_calculator import (
    NutritionCalculation,
    InventoryConsumption,
    Issue,
    calculate_group_nutrition,
    calculate_inventory_consumption,
    calculate_actual_cost,
    check_nutrient_deviations,
    check_budget_deviation,
    process_all_groups
)


class TestNutritionCalculations:
    @pytest.fixture
    def sample_inventory_df(self):
        return pd.DataFrame([{
            'feed_id': 'F001',
            'feed_name': '玉米青贮',
            'batch_number': 'B001',
            'quantity_kg': 10000.0,
            'unit_cost_cny_kg': 0.5,
            'dry_matter_percent': 35.0,
            'expiry_date': date.today() + timedelta(days=90),
            'storage_location': 'A1'
        }, {
            'feed_id': 'F002',
            'feed_name': '豆粕',
            'batch_number': 'B002',
            'quantity_kg': 5000.0,
            'unit_cost_cny_kg': 3.5,
            'dry_matter_percent': 89.0,
            'expiry_date': date.today() + timedelta(days=180),
            'storage_location': 'A2'
        }])

    @pytest.fixture
    def sample_lab_df(self):
        return pd.DataFrame([{
            'feed_id': 'F001',
            'test_date': date.today() - timedelta(days=7),
            'dry_matter_actual': 34.5,
            'crude_protein_percent': 8.2,
            'net_energy_mcal_kg': 1.55,
            'calcium_percent': 0.45,
            'phosphorus_percent': 0.25
        }, {
            'feed_id': 'F002',
            'test_date': date.today() - timedelta(days=7),
            'dry_matter_actual': 88.5,
            'crude_protein_percent': 44.0,
            'net_energy_mcal_kg': 2.05,
            'calcium_percent': 0.35,
            'phosphorus_percent': 0.65
        }])

    @pytest.fixture
    def sample_herd_df(self):
        return pd.DataFrame([{
            'group_id': 'G001',
            'group_name': '测试牛群',
            'cow_count': 100,
            'average_weight_kg': 650,
            'stage': 'early_lactation'
        }])

    @pytest.fixture
    def sample_ration_plan(self):
        return {
            'version': '1.0',
            'date': date.today(),
            'created_by': 'Test',
            'herd_rations': {
                'G001': {
                    'group_name': '测试牛群',
                    'target_dry_matter_kg': 25.0,
                    'target_crude_protein_percent': 17.0,
                    'target_net_energy_mcal_kg': 1.70,
                    'target_calcium_percent': 0.75,
                    'target_phosphorus_percent': 0.40,
                    'budget_cny_per_head_daily': 80.0,
                    'feeds': [
                        {'feed_id': 'F001', 'as_fed_kg': 20.0},
                        {'feed_id': 'F002', 'as_fed_kg': 5.0}
                    ]
                }
            }
        }

    def test_unit_conversion_as_fed_to_dm(self):
        as_fed_kg = 20.0
        dm_percent = 34.5
        
        expected_dm = as_fed_kg * (dm_percent / 100.0)
        
        assert expected_dm == pytest.approx(6.9, 0.01)
        assert expected_dm == 20.0 * 0.345

    def test_calculate_group_nutrition_basic(self, sample_inventory_df, sample_lab_df):
        group_ration = {
            'group_name': '测试',
            'feeds': [
                {'feed_id': 'F001', 'as_fed_kg': 20.0},
                {'feed_id': 'F002', 'as_fed_kg': 5.0}
            ]
        }
        
        result, issues = calculate_group_nutrition(group_ration, sample_inventory_df, sample_lab_df)
        
        f001_dm = 20.0 * (34.5 / 100.0)
        f002_dm = 5.0 * (88.5 / 100.0)
        expected_total_dm = f001_dm + f002_dm
        
        assert result.total_dry_matter_kg == pytest.approx(expected_total_dm, 0.01)
        assert len(issues) == 0

    def test_calculate_group_nutrition_with_missing_lab_data(self, sample_inventory_df):
        group_ration = {
            'group_name': '测试',
            'feeds': [
                {'feed_id': 'F001', 'as_fed_kg': 20.0},
            ]
        }
        
        empty_lab_df = pd.DataFrame()
        
        result, issues = calculate_group_nutrition(group_ration, sample_inventory_df, empty_lab_df)
        
        assert len(issues) > 0
        
        missing_lab_issues = [i for i in issues if i.issue_type == 'missing_lab_data']
        assert len(missing_lab_issues) > 0
        
        expected_dm = 20.0 * (35.0 / 100.0)
        assert result.total_dry_matter_kg == pytest.approx(expected_dm, 0.01)

    def test_check_nutrient_deviations_within_tolerance(self):
        calculation = NutritionCalculation(
            total_dry_matter_kg=25.5,
            crude_protein_dm_percent=17.2,
            net_energy_mcal_kg_dm=1.72,
            calcium_dm_percent=0.76,
            phosphorus_dm_percent=0.41,
            ca_p_ratio=1.85
        )
        
        group_ration = {
            'group_name': '测试',
            'target_dry_matter_kg': 25.0,
            'target_crude_protein_percent': 17.0,
            'target_net_energy_mcal_kg': 1.70,
            'target_calcium_percent': 0.75,
            'target_phosphorus_percent': 0.40,
        }
        
        issues = check_nutrient_deviations(calculation, group_ration, tolerance_pct=5.0)
        
        assert len(issues) == 0

    def test_check_nutrient_deviations_exceeds_tolerance(self):
        calculation = NutritionCalculation(
            total_dry_matter_kg=20.0,
            crude_protein_dm_percent=17.0,
            net_energy_mcal_kg_dm=1.70,
            calcium_dm_percent=0.75,
            phosphorus_dm_percent=0.40,
            ca_p_ratio=1.875
        )
        
        group_ration = {
            'group_name': '测试',
            'target_dry_matter_kg': 25.0,
            'target_crude_protein_percent': 17.0,
            'target_net_energy_mcal_kg': 1.70,
            'target_calcium_percent': 0.75,
            'target_phosphorus_percent': 0.40,
        }
        
        issues = check_nutrient_deviations(calculation, group_ration, tolerance_pct=5.0)
        
        assert len(issues) > 0
        
        dm_issue = [i for i in issues if '干物质' in i.message]
        assert len(dm_issue) > 0
        
        deviation = ((20.0 - 25.0) / 25.0) * 100
        assert abs(deviation) > 5.0

    def test_ca_p_ratio_normal(self):
        calculation = NutritionCalculation(
            total_dry_matter_kg=25.0,
            crude_protein_dm_percent=17.0,
            net_energy_mcal_kg_dm=1.70,
            calcium_dm_percent=0.75,
            phosphorus_dm_percent=0.40,
            ca_p_ratio=1.875
        )
        
        group_ration = {
            'group_name': '测试',
            'target_dry_matter_kg': 25.0,
        }
        
        issues = check_nutrient_deviations(calculation, group_ration, tolerance_pct=5.0)
        
        ca_p_issues = [i for i in issues if i.issue_type == 'ca_p_ratio_deviation']
        assert len(ca_p_issues) == 0

    def test_ca_p_ratio_abnormal_low(self):
        calculation = NutritionCalculation(
            total_dry_matter_kg=25.0,
            crude_protein_dm_percent=17.0,
            net_energy_mcal_kg_dm=1.70,
            calcium_dm_percent=0.52,
            phosphorus_dm_percent=0.40,
            ca_p_ratio=1.3
        )
        
        group_ration = {
            'group_name': '测试',
            'target_dry_matter_kg': 25.0,
        }
        
        issues = check_nutrient_deviations(calculation, group_ration, tolerance_pct=5.0)
        
        ca_p_issues = [i for i in issues if i.issue_type == 'ca_p_ratio_deviation']
        assert len(ca_p_issues) > 0
        
        assert ca_p_issues[0].severity == 'warning'

    def test_ca_p_ratio_abnormal_critical(self):
        calculation = NutritionCalculation(
            total_dry_matter_kg=25.0,
            crude_protein_dm_percent=17.0,
            net_energy_mcal_kg_dm=1.70,
            calcium_dm_percent=0.44,
            phosphorus_dm_percent=0.40,
            ca_p_ratio=1.1
        )
        
        group_ration = {
            'group_name': '测试',
            'target_dry_matter_kg': 25.0,
        }
        
        issues = check_nutrient_deviations(calculation, group_ration, tolerance_pct=5.0)
        
        ca_p_issues = [i for i in issues if i.issue_type == 'ca_p_ratio_deviation']
        assert len(ca_p_issues) > 0
        
        assert ca_p_issues[0].severity == 'error'

    def test_calculate_actual_cost(self, sample_inventory_df):
        group_ration = {
            'feeds': [
                {'feed_id': 'F001', 'as_fed_kg': 20.0},
                {'feed_id': 'F002', 'as_fed_kg': 5.0}
            ]
        }
        
        cost = calculate_actual_cost(group_ration, sample_inventory_df)
        
        expected = 20.0 * 0.5 + 5.0 * 3.5
        expected = 10.0 + 17.5
        
        assert cost == pytest.approx(expected, 0.01)

    def test_check_budget_deviation_within_budget(self):
        actual_cost = 75.0
        group_ration = {
            'budget_cny_per_head_daily': 80.0
        }
        
        issues = check_budget_deviation(actual_cost, group_ration, '测试牛群')
        
        assert len(issues) == 0

    def test_check_budget_deviation_exceeds_budget(self):
        actual_cost = 90.0
        group_ration = {
            'budget_cny_per_head_daily': 80.0
        }
        
        issues = check_budget_deviation(actual_cost, group_ration, '测试牛群')
        
        assert len(issues) > 0
        
        deviation = ((90.0 - 80.0) / 80.0) * 100
        assert deviation == pytest.approx(12.5, 0.1)
        
        assert issues[0].severity == 'error'


class TestInventoryCalculations:
    @pytest.fixture
    def sample_inventory_df(self):
        return pd.DataFrame([{
            'feed_id': 'F001',
            'feed_name': '玉米青贮',
            'batch_number': 'B001',
            'quantity_kg': 1000.0,
            'unit_cost_cny_kg': 0.5,
            'dry_matter_percent': 35.0,
            'expiry_date': date.today() + timedelta(days=90),
            'storage_location': 'A1'
        }])

    @pytest.fixture
    def sample_herd_df(self):
        return pd.DataFrame([{
            'group_id': 'G001',
            'group_name': '测试牛群',
            'cow_count': 100,
            'average_weight_kg': 650,
            'stage': 'early_lactation'
        }])

    @pytest.fixture
    def sample_ration_plan(self):
        return {
            'herd_rations': {
                'G001': {
                    'group_name': '测试牛群',
                    'feeds': [
                        {'feed_id': 'F001', 'as_fed_kg': 20.0}
                    ]
                }
            }
        }

    def test_inventory_consumption_calculation(self, sample_inventory_df, sample_herd_df, sample_ration_plan):
        consumptions, issues = calculate_inventory_consumption(
            sample_ration_plan, sample_inventory_df, sample_herd_df, projection_days=30
        )
        
        assert len(consumptions) == 1
        
        inv = consumptions[0]
        expected_daily = 20.0 * 100
        assert inv.daily_consumption_kg == pytest.approx(expected_daily, 0.01)
        
        expected_days = 1000.0 / expected_daily
        assert inv.days_remaining == pytest.approx(expected_days, 0.01)

    def test_inventory_shortfall_detection(self, sample_herd_df):
        low_inventory_df = pd.DataFrame([{
            'feed_id': 'F001',
            'feed_name': '玉米青贮',
            'batch_number': 'B001',
            'quantity_kg': 100.0,
            'unit_cost_cny_kg': 0.5,
            'dry_matter_percent': 35.0,
            'expiry_date': date.today() + timedelta(days=90),
            'storage_location': 'A1'
        }])
        
        ration_plan = {
            'herd_rations': {
                'G001': {
                    'group_name': '测试牛群',
                    'feeds': [
                        {'feed_id': 'F001', 'as_fed_kg': 20.0}
                    ]
                }
            }
        }
        
        consumptions, issues = calculate_inventory_consumption(
            ration_plan, low_inventory_df, sample_herd_df, projection_days=30
        )
        
        assert len(issues) > 0
        
        shortfall_issues = [i for i in issues if i.issue_type == 'inventory_shortfall']
        assert len(shortfall_issues) > 0
        
        daily_use = 20.0 * 100
        days_available = 100.0 / daily_use
        assert days_available < 30

    def test_negative_inventory_boundary(self, sample_herd_df):
        negative_inventory_df = pd.DataFrame([{
            'feed_id': 'F001',
            'feed_name': '玉米青贮',
            'batch_number': 'B001',
            'quantity_kg': -500.0,
            'unit_cost_cny_kg': 0.5,
            'dry_matter_percent': 35.0,
            'expiry_date': date.today() + timedelta(days=90),
            'storage_location': 'A1'
        }])
        
        ration_plan = {
            'herd_rations': {
                'G001': {
                    'group_name': '测试牛群',
                    'feeds': [
                        {'feed_id': 'F001', 'as_fed_kg': 20.0}
                    ]
                }
            }
        }
        
        consumptions, issues = calculate_inventory_consumption(
            ration_plan, negative_inventory_df, sample_herd_df, projection_days=30
        )
        
        inv = consumptions[0]
        assert inv.current_inventory_kg == -500.0
        assert inv.days_remaining < 0
        
        shortfall_issues = [i for i in issues if i.issue_type == 'inventory_shortfall']
        assert len(shortfall_issues) > 0
        
        assert inv.projected_shortfall_kg > 0

    def test_expired_batch_detection(self, sample_herd_df):
        expired_inventory_df = pd.DataFrame([{
            'feed_id': 'F001',
            'feed_name': '玉米青贮',
            'batch_number': 'B001',
            'quantity_kg': 1000.0,
            'unit_cost_cny_kg': 0.5,
            'dry_matter_percent': 35.0,
            'expiry_date': date.today() - timedelta(days=7),
            'storage_location': 'A1'
        }])
        
        ration_plan = {
            'herd_rations': {
                'G001': {
                    'group_name': '测试牛群',
                    'feeds': [
                        {'feed_id': 'F001', 'as_fed_kg': 20.0}
                    ]
                }
            }
        }
        
        consumptions, issues = calculate_inventory_consumption(
            ration_plan, expired_inventory_df, sample_herd_df, projection_days=30
        )
        
        expired_issues = [i for i in issues if i.issue_type == 'expired_batch']
        assert len(expired_issues) > 0
        assert expired_issues[0].severity == 'error'

    def test_expiring_soon_detection(self, sample_herd_df):
        soon_expire_inventory_df = pd.DataFrame([{
            'feed_id': 'F001',
            'feed_name': '玉米青贮',
            'batch_number': 'B001',
            'quantity_kg': 1000.0,
            'unit_cost_cny_kg': 0.5,
            'dry_matter_percent': 35.0,
            'expiry_date': date.today() + timedelta(days=7),
            'storage_location': 'A1'
        }])
        
        ration_plan = {
            'herd_rations': {
                'G001': {
                    'group_name': '测试牛群',
                    'feeds': [
                        {'feed_id': 'F001', 'as_fed_kg': 20.0}
                    ]
                }
            }
        }
        
        consumptions, issues = calculate_inventory_consumption(
            ration_plan, soon_expire_inventory_df, sample_herd_df, projection_days=30
        )
        
        expiring_issues = [i for i in issues if i.issue_type == 'expiring_soon']
        assert len(expiring_issues) > 0
        assert expiring_issues[0].severity == 'warning'


class TestEndToEnd:
    def test_full_process_flow(self):
        inventory_df = pd.DataFrame([{
            'feed_id': 'F001',
            'feed_name': '玉米青贮',
            'batch_number': 'B001',
            'quantity_kg': 10000.0,
            'unit_cost_cny_kg': 0.5,
            'dry_matter_percent': 35.0,
            'expiry_date': date.today() + timedelta(days=90),
            'storage_location': 'A1'
        }, {
            'feed_id': 'F002',
            'feed_name': '豆粕',
            'batch_number': 'B002',
            'quantity_kg': 5000.0,
            'unit_cost_cny_kg': 3.5,
            'dry_matter_percent': 89.0,
            'expiry_date': date.today() + timedelta(days=180),
            'storage_location': 'A2'
        }])
        
        lab_df = pd.DataFrame([{
            'feed_id': 'F001',
            'test_date': date.today() - timedelta(days=7),
            'dry_matter_actual': 34.5,
            'crude_protein_percent': 8.2,
            'net_energy_mcal_kg': 1.55,
            'calcium_percent': 0.45,
            'phosphorus_percent': 0.25
        }, {
            'feed_id': 'F002',
            'test_date': date.today() - timedelta(days=7),
            'dry_matter_actual': 88.5,
            'crude_protein_percent': 44.0,
            'net_energy_mcal_kg': 2.05,
            'calcium_percent': 0.35,
            'phosphorus_percent': 0.65
        }])
        
        herd_df = pd.DataFrame([{
            'group_id': 'G001',
            'group_name': '测试牛群',
            'cow_count': 100,
            'average_weight_kg': 650,
            'stage': 'early_lactation'
        }])
        
        ration_plan = {
            'version': '1.0',
            'date': date.today(),
            'created_by': 'Test',
            'herd_rations': {
                'G001': {
                    'group_name': '测试牛群',
                    'target_dry_matter_kg': 12.0,
                    'target_crude_protein_percent': 20.0,
                    'target_net_energy_mcal_kg': 1.70,
                    'target_calcium_percent': 0.75,
                    'target_phosphorus_percent': 0.40,
                    'budget_cny_per_head_daily': 30.0,
                    'feeds': [
                        {'feed_id': 'F001', 'as_fed_kg': 20.0},
                        {'feed_id': 'F002', 'as_fed_kg': 5.0}
                    ]
                }
            }
        }
        
        group_results, all_issues, inventory_consumptions = process_all_groups(
            ration_plan, inventory_df, lab_df, herd_df,
            projection_days=30,
            tolerance_pct=5.0
        )
        
        assert 'G001' in group_results
        
        result = group_results['G001']
        assert result['cow_count'] == 100
        assert result['actual']['dry_matter_kg'] > 0
        
        assert len(inventory_consumptions) == 2
        
        assert isinstance(all_issues, list)
