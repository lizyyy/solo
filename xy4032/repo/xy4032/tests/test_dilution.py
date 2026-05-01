"""
稀释计算模块测试
"""

import pytest
from plate_planner.models import Sample, SampleStatus
from plate_planner.config import PipetteConfig
from plate_planner.dilution import DilutionCalculator, DilutionError


class TestDilutionCalculator:
    @pytest.fixture
    def calculator(self):
        config = PipetteConfig(
            min_volume_ul=0.5,
            max_volume_ul=1000.0,
            dead_volume_ul=10.0,
        )
        return DilutionCalculator(config)

    @pytest.fixture
    def sample_simple(self):
        return Sample(
            sample_id="S001",
            batch="BATCH001",
            initial_concentration=100.0,
            concentration_unit="ng/ul",
            available_volume=100.0,
            target_concentration=10.0,
            replicate_count=3,
        )

    def test_simple_10x_dilution(self, calculator, sample_simple):
        steps, errors = calculator.calculate_dilution_steps(sample_simple, 20.0)

        assert len(errors) == 0
        assert steps is not None
        assert len(steps) == 1

        step = steps[0]
        assert step.dilution_factor == 10.0
        assert step.source_concentration == 100.0
        assert step.target_concentration == 10.0

        total_required = 3 * 20 + 10
        assert step.total_volume_ul == pytest.approx(total_required)

        assert step.sample_volume_ul == pytest.approx(total_required / 10)
        assert step.diluent_volume_ul == pytest.approx(total_required * 9 / 10)

    def test_no_dilution_needed(self, calculator):
        sample = Sample(
            sample_id="S002",
            batch="BATCH001",
            initial_concentration=10.0,
            concentration_unit="ng/ul",
            available_volume=100.0,
            target_concentration=10.0,
            replicate_count=1,
        )

        steps, errors = calculator.calculate_dilution_steps(sample, 20.0)

        assert len(errors) == 0
        assert steps is not None
        assert len(steps) == 1
        assert steps[0].dilution_factor == 1.0
        assert steps[0].diluent_volume_ul == 0.0

    def test_target_higher_than_initial(self, calculator):
        sample = Sample(
            sample_id="S003",
            batch="BATCH001",
            initial_concentration=10.0,
            concentration_unit="ng/ul",
            available_volume=100.0,
            target_concentration=20.0,
            replicate_count=1,
        )

        steps, errors = calculator.calculate_dilution_steps(sample, 20.0)

        assert steps is None
        assert len(errors) == 1
        assert errors[0].error_type == "target_higher_than_initial"

    def test_insufficient_volume(self, calculator):
        sample = Sample(
            sample_id="S004",
            batch="BATCH001",
            initial_concentration=100.0,
            concentration_unit="ng/ul",
            available_volume=5.0,
            target_concentration=10.0,
            replicate_count=100,
        )

        steps, errors = calculator.calculate_dilution_steps(sample, 20.0)

        assert steps is None
        assert len(errors) == 1
        assert errors[0].error_type == "insufficient_volume"

    def test_volume_too_small(self, calculator):
        sample = Sample(
            sample_id="S005",
            batch="BATCH001",
            initial_concentration=10000.0,
            concentration_unit="ng/ul",
            available_volume=100.0,
            target_concentration=0.01,
            replicate_count=1,
        )

        steps, errors = calculator.calculate_dilution_steps(sample, 20.0)

        assert len(errors) > 0
        assert any(e.error_type == "volume_too_small" for e in errors)

    def test_multistep_dilution(self):
        config = PipetteConfig(
            min_volume_ul=5.0,
            max_volume_ul=100.0,
            dead_volume_ul=10.0,
        )
        calculator = DilutionCalculator(config)

        sample = Sample(
            sample_id="S006",
            batch="BATCH001",
            initial_concentration=10000.0,
            concentration_unit="ng/ul",
            available_volume=100.0,
            target_concentration=1.0,
            replicate_count=3,
        )

        steps, errors = calculator.calculate_dilution_steps(sample, 20.0)

        if len(errors) == 0:
            assert steps is not None
            total_factor = 1.0
            for step in steps:
                total_factor *= step.dilution_factor
            assert total_factor == pytest.approx(10000.0, rel=0.01)

    def test_pg_ul_dilution(self, calculator):
        sample = Sample(
            sample_id="S007",
            batch="BATCH001",
            initial_concentration=500.0,
            concentration_unit="pg/ul",
            available_volume=80.0,
            target_concentration=50.0,
            replicate_count=3,
        )

        steps, errors = calculator.calculate_dilution_steps(sample, 20.0)

        assert len(errors) == 0
        assert steps is not None
        assert steps[0].dilution_factor == 10.0

    def test_um_dilution(self, calculator):
        sample = Sample(
            sample_id="S008",
            batch="BATCH002",
            initial_concentration=10.0,
            concentration_unit="uM",
            available_volume=200.0,
            target_concentration=1.0,
            replicate_count=2,
            molecular_weight=6000.0,
        )

        steps, errors = calculator.calculate_dilution_steps(sample, 20.0)

        assert len(errors) == 0
        assert steps is not None
        assert steps[0].dilution_factor == 10.0
        assert steps[0].unit == "uM"

    def test_nm_dilution(self, calculator):
        sample = Sample(
            sample_id="S009",
            batch="BATCH002",
            initial_concentration=200.0,
            concentration_unit="nM",
            available_volume=100.0,
            target_concentration=20.0,
            replicate_count=2,
        )

        steps, errors = calculator.calculate_dilution_steps(sample, 20.0)

        assert len(errors) == 0
        assert steps is not None
        assert steps[0].dilution_factor == 10.0
        assert steps[0].unit == "nM"
