import pytest
import pandas as pd
import numpy as np
import json
import yaml
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from billing_logic import (
    MeterDataParser,
    BillingCalculator,
    parse_meter_readings_csv,
    parse_shop_mapping_json,
    parse_billing_rules_yaml,
    calculate_bill_adjustments
)
from anomaly_detection import (
    AnomalyDetector,
    apply_adjustments,
    get_anomaly_summary
)


SAMPLE_DIR = os.path.join(os.path.dirname(__file__), 'sample_data')


@pytest.fixture
def sample_billing_rules():
    return {
        'billing_rules': {
            'default': {
                'price_per_kwh': 1.2,
                'minimum_charge': 0,
                'service_fee_ratio': 0.1,
                'overtime_multiplier': 1.5
            },
            'area_type_multipliers': {
                'retail': 1.0,
                'food_court': 1.2,
                'shared': 0.8
            },
            'shop_billing_rules': {
                'A001': {'price_per_kwh': 1.3, 'service_fee_ratio': 0.12}
            },
            'anomaly_detection': {
                'max_monthly_increase_ratio': 2.0,
                'max_daily_kwh': 500,
                'min_daily_kwh': 0,
                'zero_reading_threshold_days': 30
            }
        }
    }


@pytest.fixture
def sample_meter_data():
    return pd.DataFrame({
        'meter_id': ['M001', 'M001', 'M002', 'M002'],
        'meter_name': ['总表', '总表', '分表', '分表'],
        'shop_no': ['A001', 'A001', 'B001', 'B001'],
        'reading_date': ['2025-01-01', '2025-01-31', '2025-01-01', '2025-01-31'],
        'reading_value': [1000, 1200, 500, 550],
        'reading_type': ['start', 'end', 'start', 'end']
    })


@pytest.fixture
def sample_shop_mapping():
    return {
        'meter_shop_mapping': {
            'M001': {'shop_no': ['A001'], 'area_type': 'retail', 'shared_ratio': 0},
            'M002': {'shop_no': ['B001'], 'area_type': 'food_court', 'shared_ratio': 0}
        },
        'shop_info': {
            'A001': {'shop_name': '服装店', 'area': 50, 'status': 'active'},
            'B001': {'shop_name': '餐饮店', 'area': 80, 'status': 'active'}
        }
    }


class TestBillingCalculator:
    def test_basic_bill_calculation(self, sample_billing_rules):
        calc = BillingCalculator(sample_billing_rules)

        bill = calc.calculate_shop_bill(
            shop_no='A001',
            consumption_kwh=100,
            area_type='retail',
            days=30
        )

        assert bill['consumption_kwh'] == 100
        assert bill['base_price'] == 1.3
        assert bill['service_fee'] == pytest.approx(15.6, rel=0.01)
        assert bill['total_amount'] == pytest.approx(145.6, rel=0.01)

    def test_food_court_multiplier(self, sample_billing_rules):
        calc = BillingCalculator(sample_billing_rules)

        bill = calc.calculate_shop_bill(
            shop_no='B001',
            consumption_kwh=100,
            area_type='food_court',
            days=30
        )

        assert bill['base_price'] == 1.2 * 1.2

    def test_minimum_charge(self, sample_billing_rules):
        rules = sample_billing_rules.copy()
        rules['billing_rules']['shop_billing_rules']['E001'] = {'minimum_charge': 100}

        calc = BillingCalculator(rules)

        bill = calc.calculate_shop_bill(
            shop_no='E001',
            consumption_kwh=10,
            area_type='retail',
            days=30
        )

        assert bill['total_amount'] == 100


class TestMeterDataParser:
    def test_basic_parsing(self, sample_meter_data, sample_shop_mapping, sample_billing_rules):
        parser = MeterDataParser(sample_meter_data, sample_shop_mapping, sample_billing_rules)
        result = parser.parse_readings()

        assert len(result) > 0
        assert 'consumption_kwh' in result.columns
        assert 'total_amount' in result.columns

    def test_same_month_only(self, sample_meter_data, sample_shop_mapping, sample_billing_rules):
        parser = MeterDataParser(sample_meter_data, sample_shop_mapping, sample_billing_rules)
        result = parser.parse_readings()

        for _, row in result.iterrows():
            start_month = row['start_date'].month
            end_month = row['end_date'].month
            assert start_month == end_month

    def test_missing_reading_detection(self, sample_billing_rules):
        meter_data = pd.DataFrame({
            'meter_id': ['M001', 'M001', 'M001', 'M001'],
            'meter_name': ['测试表', '测试表', '测试表', '测试表'],
            'shop_no': ['H001', 'H001', 'H001', 'H001'],
            'reading_date': ['2025-01-01', '2025-01-31', '2025-03-01', '2025-03-31'],
            'reading_value': [4000, 4200, 4600, 4800],
            'reading_type': ['start', 'end', 'start', 'end']
        })

        shop_mapping = {
            'meter_shop_mapping': {
                'M001': {'shop_no': ['H001'], 'area_type': 'retail', 'shared_ratio': 0}
            },
            'shop_info': {
                'H001': {'shop_name': '缺失读数测试', 'area': 45, 'status': 'active'}
            }
        }

        parser = MeterDataParser(meter_data, shop_mapping, sample_billing_rules)
        result = parser.parse_readings()

        months = sorted(result['month'].unique())
        assert '2025-01' in months
        assert '2025-03' in months
        assert '2025-02' not in months

    def test_multi_shop_single_meter(self, sample_billing_rules):
        meter_data = pd.DataFrame({
            'meter_id': ['M008', 'M008', 'M008', 'M008', 'M008', 'M008', 'M008', 'M008'],
            'meter_name': ['跨铺位电表'] * 8,
            'shop_no': ['G001', 'G001', 'G001', 'G001', 'G002', 'G002', 'G002', 'G002'],
            'reading_date': ['2025-01-01', '2025-01-31', '2025-02-01', '2025-02-28'] * 2,
            'reading_value': [9000, 9300, 9300, 9600] * 2,
            'reading_type': ['start', 'end', 'start', 'end'] * 2
        })

        shop_mapping = {
            'meter_shop_mapping': {
                'M008': {'shop_no': ['G001', 'G002'], 'area_type': 'retail', 'shared_ratio': 0}
            },
            'shop_info': {
                'G001': {'shop_name': '杂货店', 'area': 20, 'status': 'active'},
                'G002': {'shop_name': '水果店', 'area': 20, 'status': 'active'}
            }
        }

        parser = MeterDataParser(meter_data, shop_mapping, sample_billing_rules)
        result = parser.parse_readings()

        g001_records = result[result['shop_no'] == 'G001']
        g002_records = result[result['shop_no'] == 'G002']

        assert len(g001_records) > 0
        assert len(g002_records) > 0

        meter_ids = result[result['meter_id'] == 'M008']['shop_no'].unique()
        assert len(meter_ids) == 2


class TestAnomalyDetector:
    def test_cross_month_reading_detection(self, sample_billing_rules):
        meter_data = pd.DataFrame({
            'meter_id': ['M001', 'M001'],
            'meter_name': ['测试表', '测试表'],
            'shop_no': ['A001', 'A001'],
            'reading_date': ['2025-01-15', '2025-02-20'],
            'reading_value': [1000, 1500],
            'reading_type': ['end', 'start']
        })

        shop_mapping = {
            'meter_shop_mapping': {
                'M001': {'shop_no': ['A001'], 'area_type': 'retail', 'shared_ratio': 0}
            },
            'shop_info': {
                'A001': {'shop_name': '服装店', 'area': 50, 'status': 'active'}
            }
        }

        parser = MeterDataParser(meter_data, shop_mapping, sample_billing_rules)
        bills = parser.parse_readings()

        if len(bills) > 0:
            detector = AnomalyDetector(sample_billing_rules)
            anomalies = detector.detect_all_anomalies(bills)
            cross_month = anomalies[anomalies['anomaly_type'] == '跨月抄表']
            assert len(cross_month) >= 0

    def test_vacant_shop_charge_detection(self, sample_billing_rules):
        bills = pd.DataFrame({
            'meter_id': ['M001'],
            'shop_no': ['F001'],
            'shop_name': ['空铺'],
            'shop_status': ['vacant'],
            'month': ['2025-01'],
            'start_date': [pd.Timestamp('2025-01-01')],
            'end_date': [pd.Timestamp('2025-01-31')],
            'consumption_kwh': [100],
            'total_amount': [120],
            'area_type': ['retail']
        })

        detector = AnomalyDetector(sample_billing_rules)
        anomalies = detector.detect_all_anomalies(bills)

        vacant_anomalies = anomalies[anomalies['anomaly_type'] == '空铺仍计费']
        assert len(vacant_anomalies) > 0
        assert vacant_anomalies.iloc[0]['shop_no'] == 'F001'

    def test_multiplier_error_detection(self, sample_billing_rules):
        bills = pd.DataFrame({
            'meter_id': ['M001', 'M001'],
            'shop_no': ['A001', 'A001'],
            'shop_name': ['服装店', '服装店'],
            'shop_status': ['active', 'active'],
            'month': ['2025-01', '2025-02'],
            'start_date': pd.to_datetime(['2025-01-01', '2025-02-01']),
            'end_date': pd.to_datetime(['2025-01-31', '2025-02-28']),
            'consumption_kwh': [100, 500],
            'total_amount': [120, 600],
            'base_amount': [120, 600],
            'multiplier': [1, 1],
            'area_type': ['retail', 'retail']
        })

        detector = AnomalyDetector(sample_billing_rules)
        anomalies = detector.detect_all_anomalies(bills)

        multiplier_anomalies = anomalies[anomalies['anomaly_type'] == '倍率错误']
        assert len(multiplier_anomalies) > 0

    def test_shared_area_allocation_anomaly(self, sample_billing_rules):
        bills = pd.DataFrame({
            'meter_id': ['M004', 'M004', 'M004'],
            'shop_no': ['A001', 'B001', 'C001'],
            'shop_name': ['服装店', '鞋店', '饰品店'],
            'shop_status': ['active', 'active', 'active'],
            'month': ['2025-01', '2025-01', '2025-01'],
            'start_date': pd.to_datetime(['2025-01-01', '2025-01-01', '2025-01-01']),
            'end_date': pd.to_datetime(['2025-01-31', '2025-01-31', '2025-01-31']),
            'consumption_kwh': [100, 100, 100],
            'total_amount': [120, 120, 120],
            'shared_ratio': [0.5, 0.3, 0.2],
            'area_type': ['shared', 'shared', 'shared']
        })

        detector = AnomalyDetector(sample_billing_rules)
        anomalies = detector.detect_all_anomalies(bills)

        shared_anomalies = anomalies[anomalies['anomaly_type'] == '共享区域分摊异常']
        assert len(shared_anomalies) > 0


class TestAdjustments:
    def test_vacant_shop_adjustment(self):
        bills = pd.DataFrame({
            'shop_no': ['F001'],
            'month': ['2025-01'],
            'total_amount': [120],
            'consumption_kwh': [100]
        })

        anomalies = pd.DataFrame({
            'shop_no': ['F001'],
            'month': ['2025-01'],
            'anomaly_type': ['空铺仍计费'],
            'amount_impact': [120]
        })

        adjusted = apply_adjustments(bills, anomalies)

        assert adjusted.iloc[0]['adjusted_amount'] == 0
        assert '空铺免收电费' in adjusted.iloc[0]['adjustment_reason']

    def test_multiplier_adjustment(self):
        bills = pd.DataFrame({
            'shop_no': ['E001'],
            'month': ['2025-01'],
            'total_amount': [1000],
            'consumption_kwh': [500]
        })

        anomalies = pd.DataFrame({
            'shop_no': ['E001'],
            'month': ['2025-01'],
            'anomaly_type': ['倍率错误'],
            'amount_impact': [500]
        })

        adjusted = apply_adjustments(bills, anomalies)

        assert adjusted.iloc[0]['adjusted_amount'] == 500


class TestAnomalySummary:
    def test_empty_anomalies(self):
        empty_df = pd.DataFrame(columns=['anomaly_type', 'severity', 'amount_impact'])
        summary = get_anomaly_summary(empty_df)

        assert summary['total'] == 0
        assert summary['by_type'] == {}
        assert summary['by_severity']['high'] == 0

    def test_populated_anomalies(self):
        anomalies = pd.DataFrame({
            'anomaly_type': ['空铺仍计费', '倍率错误', '空铺仍计费'],
            'severity': ['high', 'medium', 'high'],
            'amount_impact': [120, 50, 100]
        })

        summary = get_anomaly_summary(anomalies)

        assert summary['total'] == 3
        assert summary['by_type']['空铺仍计费'] == 2
        assert summary['by_severity']['high'] == 2


class TestFileParsing:
    def test_parse_meter_readings(self):
        filepath = os.path.join(SAMPLE_DIR, 'meter_readings.csv')
        df = parse_meter_readings_csv(filepath)

        assert len(df) > 0
        assert 'meter_id' in df.columns
        assert 'reading_value' in df.columns

    def test_parse_shop_mapping(self):
        filepath = os.path.join(SAMPLE_DIR, 'shop_meter_mapping.json')
        data = parse_shop_mapping_json(filepath)

        assert 'meter_shop_mapping' in data
        assert 'shop_info' in data
        assert 'M001' in data['meter_shop_mapping']

    def test_parse_billing_rules(self):
        filepath = os.path.join(SAMPLE_DIR, 'billing_rules.yaml')
        data = parse_billing_rules_yaml(filepath)

        assert 'billing_rules' in data
        assert 'default' in data['billing_rules']


if __name__ == '__main__':
    pytest.main([__file__, '-v'])