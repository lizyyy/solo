import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

from ..data_parser import DataParser
from ..model_params import ModelParameters
from ..calculation_engine import CalculationEngine
from ..scheduling_optimizer import (
    SchedulingOptimizer,
    ElectricityPricing,
    ScheduleResult,
)
from ..config import DEFAULT_CONFIG


class TestElectricityPricing:
    def setup_method(self):
        self.pricing = ElectricityPricing()

    def test_price_periods(self):
        peak_price, peak_type = self.pricing.get_price_for_hour(10)
        assert peak_type == ElectricityPricing.PEAK

        off_peak_price, off_peak_type = self.pricing.get_price_for_hour(2)
        assert off_peak_type == ElectricityPricing.OFF_PEAK

        mid_peak_price, mid_peak_type = self.pricing.get_price_for_hour(14)
        assert mid_peak_type == ElectricityPricing.MID_PEAK

    def test_price_hierarchy(self):
        peak_price, _ = self.pricing.get_price_for_hour(10)
        mid_price, _ = self.pricing.get_price_for_hour(14)
        off_price, _ = self.pricing.get_price_for_hour(2)

        assert peak_price > mid_price > off_price


class TestSchedulingOptimizer:
    def setup_method(self):
        self.model_params = ModelParameters()
        self.calc_engine = CalculationEngine(model_params=self.model_params)
        self.scheduler = SchedulingOptimizer(model_params=self.model_params)

    def test_optimize_schedules(self):
        df = DataParser.generate_sample_data(pond_count=2, hours=12)

        pond_results = self.calc_engine.calculate_ponds(df)

        schedule_results = self.scheduler.optimize_schedules(
            pond_results,
            df,
            aerator_count=4,
            pond_area=1.0,
            water_depth=1.5,
            fish_species="tilapia",
            optimization_strategy="balanced",
        )

        assert len(schedule_results) == 2

        for pond_id, result in schedule_results.items():
            assert isinstance(result, ScheduleResult)
            assert result.total_hours >= 0
            assert result.total_kwh >= 0
            assert result.total_cost >= 0
            assert result.risk_mitigation_score >= 0

    def test_different_optimization_strategies(self):
        df = DataParser.generate_sample_data(pond_count=1, hours=24)

        pond_results = self.calc_engine.calculate_ponds(df)

        strategies = ["balanced", "cost_saving", "safety_first"]

        for strategy in strategies:
            schedule_results = self.scheduler.optimize_schedules(
                pond_results,
                df,
                optimization_strategy=strategy,
            )

            assert len(schedule_results) == 1
            result = list(schedule_results.values())[0]
            assert len(result.optimization_notes) > 0

    def test_schedules_to_dataframe(self):
        df = DataParser.generate_sample_data(pond_count=2, hours=12)

        pond_results = self.calc_engine.calculate_ponds(df)
        schedule_results = self.scheduler.optimize_schedules(
            pond_results, df
        )

        schedule_df = self.scheduler.schedules_to_dataframe(schedule_results)

        if len(schedule_df) > 0:
            assert "pond_id" in schedule_df.columns
            assert "start_time" in schedule_df.columns
            assert "end_time" in schedule_df.columns
            assert "duration_hours" in schedule_df.columns
            assert "estimated_cost" in schedule_df.columns

    def test_summary_to_dataframe(self):
        df = DataParser.generate_sample_data(pond_count=3, hours=12)

        pond_results = self.calc_engine.calculate_ponds(df)
        schedule_results = self.scheduler.optimize_schedules(
            pond_results, df
        )

        summary_df = self.scheduler.summary_to_dataframe(schedule_results)

        assert len(summary_df) == 3
        assert "pond_id" in summary_df.columns
        assert "total_hours" in summary_df.columns
        assert "total_cost" in summary_df.columns
        assert "risk_mitigation_score" in summary_df.columns

    def test_risk_mitigation_score(self):
        df = DataParser.generate_sample_data(pond_count=1, hours=24)

        pond_results = self.calc_engine.calculate_ponds(df)
        schedule_results = self.scheduler.optimize_schedules(
            pond_results, df
        )

        result = list(schedule_results.values())[0]

        assert result.risk_mitigation_score >= 0
        assert result.risk_mitigation_score <= 1

    def test_merge_adjacent_schedules(self):
        df = DataParser.generate_sample_data(pond_count=1, hours=24)

        pond_results = self.calc_engine.calculate_ponds(df)
        schedule_results = self.scheduler.optimize_schedules(
            pond_results, df
        )

        result = list(schedule_results.values())[0]

        for i in range(1, len(result.schedules)):
            prev_end = result.schedules[i-1].end_time
            curr_start = result.schedules[i].start_time
            gap = (curr_start - prev_end).total_seconds() / 3600
            if result.schedules[i-1].aerator_count == result.schedules[i].aerator_count:
                assert gap > 0.5

    def test_schedule_priority(self):
        df = DataParser.generate_sample_data(pond_count=1, hours=24)

        pond_results = self.calc_engine.calculate_ponds(df)
        schedule_results = self.scheduler.optimize_schedules(
            pond_results, df
        )

        result = list(schedule_results.values())[0]

        for schedule in result.schedules:
            assert schedule.priority in [1, 2]
