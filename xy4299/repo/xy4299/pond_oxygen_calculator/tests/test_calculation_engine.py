import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

from ..data_parser import DataParser
from ..model_params import ModelParameters
from ..calculation_engine import CalculationEngine, OxygenBalanceResult
from ..config import DEFAULT_CONFIG


class TestCalculationEngine:
    def setup_method(self):
        self.model_params = ModelParameters()
        self.calc_engine = CalculationEngine(model_params=self.model_params)

    def test_calculate_single_pond(self):
        df = DataParser.generate_sample_data(pond_count=1, hours=12)

        results = self.calc_engine.calculate_ponds(
            df,
            aerator_count=4,
            pond_area=1.0,
            water_depth=1.5,
            fish_species="tilapia",
        )

        assert len(results) == 1
        pond_result = list(results.values())[0]

        assert len(pond_result.hourly_results) == 12
        assert pond_result.summary is not None

        assert "min_do" in pond_result.summary
        assert "max_do" in pond_result.summary
        assert "avg_do" in pond_result.summary
        assert "overall_risk" in pond_result.summary

    def test_oxygen_balance_calculation(self):
        df = DataParser.generate_sample_data(pond_count=1, hours=6)

        results = self.calc_engine.calculate_ponds(df)
        hourly = list(results.values())[0].hourly_results[0]

        assert isinstance(hourly, OxygenBalanceResult)
        assert hourly.dissolved_oxygen > 0
        assert hourly.saturation_do > 0
        assert hourly.total_oxygen_consumption >= 0
        assert hourly.net_oxygen_change is not None

    def test_saturation_do_calculation(self):
        saturation_25 = self.model_params.calculate_saturation_do(25)
        saturation_30 = self.model_params.calculate_saturation_do(30)
        saturation_20 = self.model_params.calculate_saturation_do(20)

        assert saturation_25 > 7 and saturation_25 < 9
        assert saturation_30 < saturation_25
        assert saturation_20 > saturation_25

    def test_predict_night_do(self):
        df = DataParser.generate_sample_data(pond_count=1, hours=24)
        pond_df = df[df["pond_id"] == df["pond_id"].unique()[0]]

        timestamps, do_values, risk_levels = self.calc_engine.predict_night_do(
            pond_df,
            start_hour=18,
            end_hour=6,
            aerator_count=4,
            pond_area=1.0,
            water_depth=1.5,
            fish_species="tilapia",
        )

        assert len(timestamps) > 0
        assert len(do_values) == len(timestamps)
        assert len(risk_levels) == len(timestamps)
        assert all(do >= 0 for do in do_values)
        assert all(risk in ["normal", "warning", "critical"] for risk in risk_levels)

    def test_results_to_dataframe(self):
        df = DataParser.generate_sample_data(pond_count=2, hours=6)

        results = self.calc_engine.calculate_ponds(df)
        result_df = self.calc_engine.results_to_dataframe(results)

        assert len(result_df) == 2 * 6
        assert "timestamp" in result_df.columns
        assert "pond_id" in result_df.columns
        assert "dissolved_oxygen" in result_df.columns
        assert "risk_level" in result_df.columns

    def test_summary_to_dataframe(self):
        df = DataParser.generate_sample_data(pond_count=3, hours=6)

        results = self.calc_engine.calculate_ponds(df)
        summary_df = self.calc_engine.summary_to_dataframe(results)

        assert len(summary_df) == 3
        assert "pond_id" in summary_df.columns
        assert "min_do" in summary_df.columns
        assert "max_do" in summary_df.columns
        assert "overall_risk" in summary_df.columns

    def test_different_fish_species(self):
        df = DataParser.generate_sample_data(pond_count=1, hours=6)

        species_list = ["tilapia", "carp", "catfish", "shrimp"]

        for species in species_list:
            results = self.calc_engine.calculate_ponds(
                df,
                fish_species=species,
            )
            assert len(results) == 1

    def test_risk_level_assignment(self):
        critical_do = self.model_params.critical_do_level
        warning_do = self.model_params.warning_do_level

        assert self.model_params.get_risk_level(critical_do - 1) == "critical"
        assert self.model_params.get_risk_level((critical_do + warning_do) / 2) == "warning"
        assert self.model_params.get_risk_level(warning_do + 1) == "normal"

    def test_pond_summary_calculation(self):
        df = DataParser.generate_sample_data(pond_count=1, hours=24)

        results = self.calc_engine.calculate_ponds(df)
        summary = list(results.values())[0].summary

        assert summary["min_do"] <= summary["max_do"]
        assert summary["min_night_do"] <= summary["avg_night_do"]
        assert summary["water_volume"] > 0
        assert summary["overall_risk"] in ["normal", "warning", "critical"]
