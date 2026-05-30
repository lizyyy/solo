"""测试用例 - 数据加载模块。"""
import pytest
from datetime import date, datetime
from dateutil import parser

from overbooking.data_loader import DataLoader
from overbooking.models import CabinClass, FlightOrder


class TestDataLoader:
    """数据加载器测试。"""

    def setup_method(self):
        self.loader = DataLoader()

    def test_smart_parse_date_multiple_formats(self):
        """测试智能解析多种日期格式。"""
        test_cases = [
            ("2026-06-15", date(2026, 6, 15)),
            ("2026/06/15", date(2026, 6, 15)),
            ("2026.06.15", date(2026, 6, 15)),
            ("15/06/2026", date(2026, 6, 15)),
            ("2026年06月15日", date(2026, 6, 15)),
            ("06-15-2026", date(2026, 6, 15)),
        ]

        for date_str, expected in test_cases:
            result, error = self.loader._smart_parse_date(date_str)
            assert error is None, f"解析失败: {date_str}, 错误: {error}"
            assert result == expected, f"日期不匹配: {date_str} -> {result}, 期望 {expected}"

    def test_detect_duplicates(self):
        """测试重复记录检测。"""
        records = [
            {"order_id": "ORD001", "name": "张三"},
            {"order_id": "ORD002", "name": "李四"},
            {"order_id": "ORD001", "name": "张三"},
        ]

        duplicates = self.loader._detect_duplicates(records, ["order_id"])
        assert len(duplicates) == 1
        assert duplicates[0]["index"] == 2
        assert duplicates[0]["key"] == "ORD001"

    def test_resolve_name_conflicts(self):
        """测试同名旅客处理。"""
        records = [
            {"passenger_name": "张伟", "passenger_id": "P001", "order_id": "ORD001"},
            {"passenger_name": "张伟", "passenger_id": "P002", "order_id": "ORD002"},
            {"passenger_name": "张伟", "passenger_id": None, "order_id": "ORD003"},
            {"passenger_name": "李四", "passenger_id": None, "order_id": "ORD004"},
        ]

        processed, issues = self.loader._resolve_name_conflicts(
            records, "passenger_name", "passenger_id"
        )

        name_conflict_issues = [i for i in issues if i.issue_type == "name_conflict"]
        assert len(name_conflict_issues) == 1
        assert len(name_conflict_issues[0].affected_records) == 3

    def test_load_flight_orders_with_mixed_date_formats(self):
        """测试加载混合日期格式的订单。"""
        orders_data = [
            {
                "order_id": "ORD001",
                "flight_no": "CA1234",
                "flight_date": "2026-06-15",
                "passenger_name": "张三",
                "passenger_id": "P001",
                "cabin_class": "Y",
                "fare_amount": 800.0,
                "booking_date": "2026/05/01",
                "status": "confirmed"
            },
            {
                "order_id": "ORD002",
                "flight_no": "CA1234",
                "flight_date": "2026年06月15日",
                "passenger_name": "李四",
                "passenger_id": "P002",
                "cabin_class": "C",
                "fare_amount": 2500.0,
                "booking_date": "15/05/2026",
                "status": "confirmed"
            },
            {
                "order_id": "ORD003",
                "flight_no": "CA1234",
                "flight_date": "invalid-date",
                "passenger_name": "王五",
                "cabin_class": "Y",
                "fare_amount": 900.0,
                "booking_date": "2026-05-10",
                "status": "confirmed"
            }
        ]

        orders, issues = self.loader.load_flight_orders(orders_data)

        assert len(orders) == 2
        assert orders[0].flight_date == date(2026, 6, 15)
        assert orders[1].flight_date == date(2026, 6, 15)

        date_issues = [i for i in issues if i.issue_type == "date_format"]
        assert len(date_issues) >= 1

    def test_load_flight_orders_with_duplicate_and_unknown_cabin(self):
        """测试加载含重复记录和未知舱位的订单。"""
        orders_data = [
            {
                "order_id": "ORD001",
                "flight_no": "CA1234",
                "flight_date": "2026-06-15",
                "passenger_name": "张三",
                "cabin_class": "Y",
                "fare_amount": 800.0,
                "booking_date": "2026-05-01",
            },
            {
                "order_id": "ORD001",
                "flight_no": "CA1234",
                "flight_date": "2026-06-15",
                "passenger_name": "张三",
                "cabin_class": "Y",
                "fare_amount": 800.0,
                "booking_date": "2026-05-01",
            },
            {
                "order_id": "ORD002",
                "flight_no": "CA1234",
                "flight_date": "2026-06-15",
                "passenger_name": "李四",
                "cabin_class": "X",
                "fare_amount": 1000.0,
                "booking_date": "2026-05-01",
            }
        ]

        orders, issues = self.loader.load_flight_orders(orders_data)

        assert len(orders) == 2
        duplicate_issues = [i for i in issues if i.issue_type == "duplicate"]
        cabin_issues = [i for i in issues if i.issue_type == "cabin_mismatch"]
        assert len(duplicate_issues) == 1
        assert len(cabin_issues) == 1

    def test_check_data_consistency(self):
        """测试数据一致性检查。"""
        from overbooking.models import FlightInfo, FlightOrder, Passenger, CabinClass

        flight_info = FlightInfo(
            flight_no="CA1234",
            flight_date=date(2026, 6, 15),
            departure="PEK",
            arrival="SHA",
            scheduled_departure=datetime(2026, 6, 15, 10, 0),
            capacity={CabinClass.ECONOMY: 150}
        )

        orders = [
            FlightOrder(
                order_id="ORD001",
                flight_no="CA1234",
                flight_date=date(2026, 6, 15),
                passenger_name="张三",
                passenger_id="P001",
                cabin_class=CabinClass.ECONOMY,
                fare_amount=800,
                booking_date=date(2026, 5, 1)
            ),
            FlightOrder(
                order_id="ORD002",
                flight_no="CA9999",
                flight_date=date(2026, 6, 15),
                passenger_name="李四",
                passenger_id="P999",
                cabin_class=CabinClass.ECONOMY,
                fare_amount=900,
                booking_date=date(2026, 5, 1)
            )
        ]

        passengers = [
            Passenger(passenger_id="P001", name="张三")
        ]

        issues = self.loader.check_data_consistency(orders, [flight_info], passengers)
        assert len(issues) >= 2

    def test_load_no_show_history(self):
        """测试加载爽约历史。"""
        history_data = [
            {
                "history_id": "H001",
                "passenger_name": "张三",
                "passenger_id": "P001",
                "flight_date": "2026-01-15",
                "flight_no": "CA1234",
                "was_no_show": True,
                "reason": "行程变更"
            },
            {
                "history_id": "H002",
                "passenger_name": "李四",
                "flight_date": "2026/01/16",
                "flight_no": "CA5678",
                "was_no_show": False
            }
        ]

        histories, issues = self.loader.load_no_show_history(history_data)
        assert len(histories) == 2
        assert histories[0].flight_date == date(2026, 1, 15)
        assert histories[1].flight_date == date(2026, 1, 16)
        assert histories[0].was_no_show is True
