"""测试用例 - 概率建模模块。"""
import pytest
import numpy as np
from datetime import date, datetime

from overbooking.probability_model import ProbabilityModel, NoShowPrediction
from overbooking.models import (
    CabinClass, FlightOrder, NoShowHistory,
    Passenger, FlightInfo
)


class TestProbabilityModel:
    """概率模型测试。"""

    def setup_method(self):
        self.model = ProbabilityModel(alpha_prior=1.0, beta_prior=10.0)

    def test_predict_passenger_no_show_with_history(self):
        """测试有历史数据的旅客爽约率预测。"""
        passenger = Passenger(
            passenger_id="P001",
            name="张三",
            tier="gold",
            historical_no_show_count=2,
            historical_flight_count=20
        )

        rate = self.model.predict_passenger_no_show(passenger, base_rate=0.09)
        expected_personal = 2 / 20
        assert 0.0 < rate < 1.0
        assert rate < expected_personal * 1.1

    def test_predict_passenger_no_show_no_history(self):
        """测试无历史数据的旅客爽约率预测。"""
        passenger = Passenger(
            passenger_id="P002",
            name="李四",
            tier="basic",
            historical_no_show_count=0,
            historical_flight_count=0
        )

        rate = self.model.predict_passenger_no_show(passenger, base_rate=0.09)
        assert abs(rate - 0.09) < 0.01

    def test_predict_passenger_no_show_tier_effect(self):
        """测试会员等级对爽约率的影响。"""
        base_passenger = Passenger(
            passenger_id="P001",
            name="测试",
            tier="basic",
            historical_flight_count=0
        )

        platinum = Passenger(**{**base_passenger.model_dump(), "tier": "platinum", "passenger_id": "P002"})
        gold = Passenger(**{**base_passenger.model_dump(), "tier": "gold", "passenger_id": "P003"})
        silver = Passenger(**{**base_passenger.model_dump(), "tier": "silver", "passenger_id": "P004"})

        rate_basic = self.model.predict_passenger_no_show(base_passenger, base_rate=0.1)
        rate_platinum = self.model.predict_passenger_no_show(platinum, base_rate=0.1)
        rate_gold = self.model.predict_passenger_no_show(gold, base_rate=0.1)
        rate_silver = self.model.predict_passenger_no_show(silver, base_rate=0.1)

        assert rate_platinum < rate_gold < rate_silver < rate_basic

    def test_predict_no_show_rates_multiple_cabins(self):
        """测试多舱位爽约率预测。"""
        np.random.seed(42)
        flight_orders = []
        for i in range(50):
            cabin = CabinClass.ECONOMY if i < 40 else CabinClass.BUSINESS
            flight_orders.append(FlightOrder(
                order_id=f"ORD{i:03d}",
                flight_no="CA1234",
                flight_date=date(2026, 6, 15),
                passenger_name=f"旅客{i}",
                passenger_id=f"P{i:03d}",
                cabin_class=cabin,
                fare_amount=800 if cabin == CabinClass.ECONOMY else 2500,
                booking_date=date(2026, 5, 1)
            ))

        no_show_histories = []
        for i in range(500):
            cabin = CabinClass.ECONOMY if i < 400 else CabinClass.BUSINESS
            was_no_show = np.random.random() < (0.11 if cabin == CabinClass.ECONOMY else 0.05)
            no_show_histories.append(NoShowHistory(
                history_id=f"H{i:03d}",
                passenger_name=f"历史旅客{i}",
                flight_date=date(2026, 1, 1) + __import__('datetime').timedelta(days=i % 90),
                flight_no="CA1234",
                was_no_show=was_no_show
            ))

        passengers = [
            Passenger(passenger_id=f"P{i:03d}", name=f"旅客{i}",
                     historical_no_show_count=np.random.randint(0, 3),
                     historical_flight_count=np.random.randint(5, 50))
            for i in range(50)
        ]

        prediction = self.model.predict_no_show_rates(
            flight_orders=flight_orders,
            no_show_histories=no_show_histories,
            passengers=passengers
        )

        assert CabinClass.ECONOMY in prediction.cabin_level
        assert CabinClass.BUSINESS in prediction.cabin_level
        assert 0.0 < prediction.overall_rate < 1.0
        assert 0.0 < prediction.cabin_level[CabinClass.BUSINESS] < prediction.cabin_level[CabinClass.ECONOMY]

    def test_predict_no_show_rates_with_manual_override(self):
        """测试人工覆盖爽约率。"""
        flight_orders = [
            FlightOrder(
                order_id="ORD001",
                flight_no="CA1234",
                flight_date=date(2026, 6, 15),
                passenger_name="张三",
                cabin_class=CabinClass.ECONOMY,
                fare_amount=800,
                booking_date=date(2026, 5, 1)
            )
        ]

        no_show_histories = [
            NoShowHistory(
                history_id="H001",
                passenger_name="历史旅客",
                flight_date=date(2026, 1, 1),
                flight_no="CA1234",
                was_no_show=False
            )
        ]

        manual_override = {"Y": 0.2, "C": 0.08}

        prediction = self.model.predict_no_show_rates(
            flight_orders=flight_orders,
            no_show_histories=no_show_histories,
            manual_override=manual_override
        )

        assert prediction.cabin_level[CabinClass.ECONOMY] == 0.2
        assert len(prediction.warnings) >= 1
        assert any("人工覆盖" in w for w in prediction.warnings)

    def test_calculate_overbooking_distribution(self):
        """测试超售概率分布计算。"""
        dist = self.model.calculate_overbooking_distribution(
            cabin=CabinClass.ECONOMY,
            booked_seats=140,
            capacity=150,
            overbooking=10,
            no_show_rate=0.08
        )

        assert dist.overbooking_level == 10
        assert dist.denied_probability >= 0.0
        assert dist.denied_probability <= 1.0
        assert dist.expected_denied_boardings >= 0.0
        assert len(dist.boarding_probabilities) == 151

        total_prob = sum(dist.boarding_probabilities.values())
        assert abs(total_prob - 1.0) < 0.01

    def test_calculate_overbooking_risk_metrics(self):
        """测试风险指标计算。"""
        dist = self.model.calculate_overbooking_distribution(
            cabin=CabinClass.ECONOMY,
            booked_seats=145,
            capacity=150,
            overbooking=15,
            no_show_rate=0.08
        )

        metrics = self.model.calculate_overbooking_risk_metrics(
            distribution=dist,
            capacity=150,
            fare_amount=800,
            compensation_per_pax=500
        )

        assert "denied_probability" in metrics
        assert "expected_denied_boardings" in metrics
        assert "expected_net_profit" in metrics
        assert "var_95" in metrics
        assert "cvar_95" in metrics
        assert metrics["denied_probability"] == dist.denied_probability

    def test_simulate_multiple_scenarios(self):
        """测试多情景模拟。"""
        scenarios = self.model.simulate_multiple_scenarios(
            cabin=CabinClass.ECONOMY,
            booked_seats=140,
            capacity=150,
            max_overbooking=15,
            base_no_show_rate=0.08,
            n_scenarios=5
        )

        assert len(scenarios) >= 5
        scenario_names = {s["scenario"] for s in scenarios}
        assert "基准" in scenario_names
        assert "保守" in scenario_names
        assert "乐观" in scenario_names

        for s in scenarios:
            assert "no_show_rate" in s
            assert "overbooking" in s
            assert "denied_probability" in s
