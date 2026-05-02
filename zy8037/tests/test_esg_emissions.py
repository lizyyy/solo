"""
Pytest tests for ESG Emissions CLI
"""

import pytest
import json
import yaml
import csv
from pathlib import Path
from io import StringIO

from esg_emissions_cli.models.data_models import (
    EnergyBill, OrganizationBoundary, EmissionFactor, AdjustmentItem
)
from esg_emissions_cli.models.validator import InputValidator, ValidationError
from esg_emissions_cli.calculators.emission_calculator import EmissionCalculator


class TestEnergyBill:
    def test_from_dict_basic(self):
        data = {
            'site': 'Shanghai Factory',
            'month': '2024-01',
            'energy_type': 'electricity',
            'consumption': 150000,
            'unit': 'kWh',
            'bill_id': 'ELEC_001'
        }
        bill = EnergyBill.from_dict(data)
        assert bill.site == 'Shanghai Factory'
        assert bill.month == '2024-01'
        assert bill.energy_type == 'electricity'
        assert bill.consumption == 150000
        assert bill.unit == 'kWh'
        assert bill.bill_id == 'ELEC_001'

    def test_get_key(self):
        bill = EnergyBill(
            site='Shanghai', month='2024-01',
            energy_type='electricity', consumption=100,
            unit='kWh', bill_id='B001'
        )
        key = bill.get_key()
        assert 'Shanghai' in key
        assert '2024-01' in key
        assert 'electricity' in key

    def test_is_negative_reversal(self):
        adj = AdjustmentItem(
            site='Shanghai', month='2024-01',
            energy_type='electricity', adjustment_type='reversal',
            amount=-15000, reason='correction'
        )
        assert adj.is_negative_reversal() is True

        adj_positive = AdjustmentItem(
            site='Shanghai', month='2024-01',
            energy_type='electricity', adjustment_type='correction',
            amount=5000, reason='additional'
        )
        assert adj_positive.is_negative_reversal() is False


class TestOrganizationBoundary:
    def test_from_dict(self):
        data = {
            'sites': {
                'Shanghai Factory': {'scope': 'Scope 2'}
            },
            'site_aliases': {
                'Shanghai Factory': ['上海工厂', 'SH']
            }
        }
        org = OrganizationBoundary.from_dict(data)
        assert 'Shanghai Factory' in org.sites
        assert '上海工厂' in org.aliases['Shanghai Factory']

    def test_normalize_site_direct(self):
        org = OrganizationBoundary(
            sites={'Shanghai Factory': {'scope': 'Scope 2'}},
            aliases={}
        )
        result = org.normalize_site('Shanghai Factory')
        assert result == 'Shanghai Factory'

    def test_normalize_site_alias(self):
        org = OrganizationBoundary(
            sites={'Shanghai Factory': {'scope': 'Scope 2'}},
            aliases={'Shanghai Factory': ['上海工厂', 'SH']}
        )
        result = org.normalize_site('上海工厂')
        assert result == 'Shanghai Factory'

    def test_normalize_site_case_insensitive(self):
        org = OrganizationBoundary(
            sites={'Shanghai Factory': {'scope': 'Scope 2'}},
            aliases={'Shanghai Factory': ['上海工厂', 'shanghai']}
        )
        result = org.normalize_site('shanghai')
        assert result == 'Shanghai Factory'

    def test_normalize_site_unknown(self):
        org = OrganizationBoundary(
            sites={'Shanghai Factory': {}},
            aliases={}
        )
        result = org.normalize_site('Unknown Site')
        assert result is None

    def test_get_site_scope(self):
        org = OrganizationBoundary(
            sites={'Shanghai Factory': {'scope': 'Scope 2'}},
            aliases={}
        )
        assert org.get_site_scope('Shanghai Factory') == 'Scope 2'

    def test_is_valid_site(self):
        org = OrganizationBoundary(
            sites={'Shanghai Factory': {}},
            aliases={'Shanghai Factory': ['上海工厂']}
        )
        assert org.is_valid_site('Shanghai Factory') is True
        assert org.is_valid_site('上海工厂') is True
        assert org.is_valid_site('Unknown') is False


class TestEmissionFactor:
    def test_from_dict(self):
        data = {
            'energy_type': 'electricity',
            'factor_value': 0.581,
            'unit': 'kgCO2/kWh',
            'scope': 'Scope 2',
            'version': 'v2024.1',
            'effective_date': '2024-01',
            'source': 'NDRC'
        }
        factor = EmissionFactor.from_dict(data)
        assert factor.energy_type == 'electricity'
        assert factor.factor_value == 0.581
        assert factor.scope == 'Scope 2'

    def test_matches_energy_type(self):
        factor = EmissionFactor(
            energy_type='electricity',
            factor_value=0.581,
            unit='kgCO2/kWh',
            scope='Scope 2',
            version='v1',
            effective_date='2024-01'
        )
        assert factor.matches_energy_type('electricity') is True
        assert factor.matches_energy_type('ELECTRICITY') is True
        assert factor.matches_energy_type('natural_gas') is False


class TestInputValidator:
    def test_validate_bills_valid(self):
        bills = [{
            'site': 'Shanghai',
            'month': '2024-01',
            'energy_type': 'electricity',
            'consumption': 100,
            'bill_id': 'B001'
        }]
        validator = InputValidator()
        validator.validate_energy_bills(bills)

    def test_validate_bills_empty(self):
        validator = InputValidator()
        with pytest.raises(ValidationError, match="能源账单不能为空"):
            validator.validate_energy_bills([])

    def test_validate_bills_missing_field(self):
        bills = [{'site': 'Shanghai'}]
        validator = InputValidator()
        with pytest.raises(ValidationError, match="缺少必填字段"):
            validator.validate_energy_bills(bills)

    def test_validate_bills_invalid_consumption(self):
        bills = [{
            'site': 'Shanghai',
            'month': '2024-01',
            'energy_type': 'electricity',
            'consumption': 'not_a_number',
            'bill_id': 'B001'
        }]
        validator = InputValidator()
        with pytest.raises(ValidationError, match="consumption 必须是数字"):
            validator.validate_energy_bills(bills)

    def test_validate_org_valid(self):
        org = {'sites': {'Shanghai': {}}}
        validator = InputValidator()
        validator.validate_org_boundary(org)

    def test_validate_org_empty(self):
        validator = InputValidator()
        with pytest.raises(ValidationError, match="组织边界配置不能为空"):
            validator.validate_org_boundary({})

    def test_validate_factors_valid(self):
        factors = [{
            'energy_type': 'electricity',
            'factor_value': 0.581,
            'unit': 'kgCO2/kWh',
            'scope': 'Scope 2'
        }]
        validator = InputValidator()
        validator.validate_emission_factors(factors)

    def test_validate_factors_empty(self):
        validator = InputValidator()
        with pytest.raises(ValidationError, match="排放因子不能为空"):
            validator.validate_emission_factors([])


class TestEmissionCalculator:
    @pytest.fixture
    def sample_factors(self):
        return [
            EmissionFactor(
                energy_type='electricity',
                factor_value=0.581,
                unit='kgCO2/kWh',
                scope='Scope 2',
                version='v2024.1',
                effective_date='2024-01'
            ),
            EmissionFactor(
                energy_type='natural_gas',
                factor_value=2.02,
                unit='kgCO2/m³',
                scope='Scope 1',
                version='v2024.1',
                effective_date='2024-01'
            ),
            EmissionFactor(
                energy_type='diesel',
                factor_value=2.68,
                unit='kgCO2/L',
                scope='Scope 1',
                version='v2024.1',
                effective_date='2024-01'
            ),
        ]

    @pytest.fixture
    def sample_org(self):
        return OrganizationBoundary(
            sites={
                'Shanghai Factory': {'scope': 'Scope 2'},
                'Beijing Office': {'scope': 'Scope 2'},
                'Guangzhou Site': {'scope': 'Scope 1'},
            },
            aliases={
                'Shanghai Factory': ['上海工厂', 'SH'],
                'Beijing Office': ['北京办公室', 'BJ'],
            }
        )

    def test_unit_conversion_kwh_to_mwh(self, sample_factors, sample_org):
        calculator = EmissionCalculator(sample_factors, sample_org)
        result, converted = calculator._convert_unit(1000, 'kWh', 'MWh')
        assert converted is True
        assert result == 1.0

    def test_unit_conversion_same_unit(self, sample_factors, sample_org):
        calculator = EmissionCalculator(sample_factors, sample_org)
        result, converted = calculator._convert_unit(100, 'kWh', 'kWh')
        assert converted is True
        assert result == 100

    def test_unit_conversion_unknown(self, sample_factors, sample_org):
        calculator = EmissionCalculator(sample_factors, sample_org)
        result, converted = calculator._convert_unit(100, 'unknown', 'kWh')
        assert converted is False
        assert result == 100

    def test_find_factor_exact_match(self, sample_factors, sample_org):
        calculator = EmissionCalculator(sample_factors, sample_org)
        factor = calculator._find_factor('electricity', '2024-01', 'Scope 2')
        assert factor is not None
        assert factor.factor_value == 0.581

    def test_find_factor_with_aliases(self, sample_factors, sample_org):
        calculator = EmissionCalculator(sample_factors, sample_org)
        normalized = calculator._normalize_bill_site(
            EnergyBill('上海工厂', '2024-01', 'electricity', 100, 'kWh', 'B001')
        )
        assert normalized == 'Shanghai Factory'

    def test_detect_duplicates(self, sample_factors, sample_org):
        bills = [
            EnergyBill('Shanghai', '2024-01', 'electricity', 100, 'kWh', 'B001'),
            EnergyBill('Shanghai', '2024-01', 'electricity', 100, 'kWh', 'B002'),
            EnergyBill('Shanghai', '2024-01', 'electricity', 200, 'kWh', 'B003'),
        ]
        calculator = EmissionCalculator(sample_factors, sample_org)
        duplicates = calculator._detect_duplicates(bills)
        assert len(duplicates) == 1

    def test_calculate_basic(self, sample_factors, sample_org):
        bills = [
            EnergyBill('Shanghai Factory', '2024-01', 'electricity', 150000, 'kWh', 'B001'),
        ]
        adjustments = []
        anomalies = []
        calculator = EmissionCalculator(sample_factors, sample_org)
        results = calculator.calculate(bills, adjustments, anomalies)

        assert len(results) == 1
        assert results[0]['site'] == 'Shanghai Factory'
        assert results[0]['scope'] == 'Scope 2'
        assert results[0]['emissions'] > 0

    def test_calculate_with_duplicate_detection(self, sample_factors, sample_org):
        bills = [
            EnergyBill('Shanghai Factory', '2024-01', 'electricity', 150000, 'kWh', 'B001'),
            EnergyBill('Shanghai Factory', '2024-01', 'electricity', 150000, 'kWh', 'B001_DUP'),
        ]
        adjustments = []
        anomalies = []
        calculator = EmissionCalculator(sample_factors, sample_org)
        results = calculator.calculate(bills, adjustments, anomalies)

        dup_anomalies = [a for a in anomalies if a['type'] == '重复账单']
        assert len(dup_anomalies) >= 1

    def test_calculate_with_negative_reversal(self, sample_factors, sample_org):
        bills = [
            EnergyBill('Shanghai Factory', '2024-01', 'electricity', 150000, 'kWh', 'B001'),
        ]
        adjustments = [
            AdjustmentItem(
                site='Shanghai Factory',
                month='2024-01',
                energy_type='electricity',
                adjustment_type='reversal',
                amount=-10000,
                reason='correction'
            )
        ]
        anomalies = []
        calculator = EmissionCalculator(sample_factors, sample_org)
        results = calculator.calculate(bills, adjustments, anomalies)

        rev_anomalies = [a for a in anomalies if a['type'] == '负数冲回']
        assert len(rev_anomalies) >= 1

    def test_calculate_missing_factor(self, sample_factors, sample_org):
        bills = [
            EnergyBill('Shanghai Factory', '2024-01', 'electricity', 150000, 'kWh', 'B001'),
            EnergyBill('Guangzhou Site', '2024-01', 'lng', 1000, 'm³', 'B002'),
        ]
        adjustments = []
        anomalies = []
        calculator = EmissionCalculator(sample_factors, sample_org)
        results = calculator.calculate(bills, adjustments, anomalies)

        missing_anomalies = [a for a in anomalies if a['type'] == '因子缺失']
        assert len(missing_anomalies) >= 1

    def test_generate_summary(self, sample_factors, sample_org):
        bills = [
            EnergyBill('Shanghai Factory', '2024-01', 'electricity', 150000, 'kWh', 'B001'),
            EnergyBill('Beijing Office', '2024-01', 'electricity', 50000, 'kWh', 'B002'),
        ]
        calculator = EmissionCalculator(sample_factors, sample_org)
        results = calculator.calculate(bills, [], [])
        summary = calculator.generate_summary(results, '2024-01')

        assert summary['month'] == '2024-01'
        assert summary['site_count'] == 2
        assert summary['total_emissions'] > 0
        assert 'Scope 2' in summary['by_scope']


class TestBusinessRules:
    def test_cross_month_adjustment_detection(self):
        from esg_emissions_cli.calculators.emission_calculator import EmissionCalculator
        from esg_emissions_cli.models.data_models import OrganizationBoundary, EmissionFactor

        factors = [
            EmissionFactor(
                energy_type='electricity',
                factor_value=0.581,
                unit='kgCO2/kWh',
                scope='Scope 2',
                version='v1',
                effective_date='2024-01'
            )
        ]
        org = OrganizationBoundary(
            sites={'Shanghai': {'scope': 'Scope 2'}},
            aliases={}
        )

        bills = [
            EnergyBill('Shanghai', '2024-01', 'electricity', 100, 'kWh', 'B001'),
            EnergyBill('Shanghai', '2024-02', 'electricity', 100, 'kWh', 'B002'),
        ]
        adjustments = [
            AdjustmentItem('Shanghai', '2024-01', 'electricity', 'correction', 100, 'reason'),
            AdjustmentItem('Shanghai', '2024-02', 'electricity', 'correction', 100, 'reason'),
            AdjustmentItem('Shanghai', '2024-03', 'electricity', 'correction', 100, 'reason'),
        ]

        calculator = EmissionCalculator(factors, org)
        cross_month = calculator._match_cross_month_adjustments(bills, adjustments)

        assert 'Shanghai|electricity' in cross_month
        assert len(cross_month['Shanghai|electricity']) == 3
