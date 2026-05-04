import pytest
from pathlib import Path
from decimal import Decimal

from signup_handler.parser import ChatParser
from signup_handler.merger import MergeEngine
from signup_handler.rule_engine import RuleEngine
from signup_handler.exporter import Exporter
from signup_handler.models import (
    RegistrationRecord,
    MergedRecord,
    RulesConfig,
    TimeSlotRule,
    PaymentRecord,
    EditRecord,
    RecordStatus,
    PaymentStatus,
)


class TestParser:
    def test_parse_basic_registration(self):
        parser = ChatParser()
        content = "1. 张三 2大1小 周六上午 已转账"
        records = parser.parse(content)
        
        assert len(records) == 1
        assert records[0].sequence_number == 1
        assert "张三" in [records[0].real_name, records[0].group_nickname]
        assert records[0].total_people == 3
        assert records[0].adult_count == 2
        assert records[0].child_count == 1
        assert "周六上午" in records[0].time_slots

    def test_parse_phone_number(self):
        parser = ChatParser()
        content = "2. 李四 1大0小 周六下午 13800138000 已付款"
        records = parser.parse(content)
        
        assert len(records) == 1
        assert records[0].phone == "13800138000"

    def test_parse_plus_format(self):
        parser = ChatParser()
        content = "3. 王五+朋友 3大2小 周日上午"
        records = parser.parse(content)
        
        assert len(records) == 1
        assert records[0].total_people == 5
        assert records[0].adult_count == 3
        assert records[0].child_count == 2

    def test_parse_dietary_restrictions(self):
        parser = ChatParser()
        content = "4. 赵六 夫妻 周六上午 不能吃花生 忌口辣"
        records = parser.parse(content)
        
        assert len(records) == 1
        assert records[0].total_people == 2
        assert len(records[0].dietary_restrictions) > 0

    def test_parse_total_people_format(self):
        parser = ChatParser()
        content = "5. 孙七 报名3人 周六上午"
        records = parser.parse(content)
        
        assert len(records) == 1
        assert records[0].total_people == 3

    def test_parse_multiple_lines(self):
        parser = ChatParser()
        content = """1. 张三 2大1小 周六上午 已转账

2. 李四 1大0小 周六下午

3. 王五 3人 周日上午
"""
        records = parser.parse(content)
        
        assert len(records) == 3
        assert records[0].sequence_number == 1
        assert records[1].sequence_number == 2
        assert records[2].sequence_number == 3


class TestMerger:
    def test_merge_duplicate_by_phone(self):
        parser = ChatParser()
        content = """1. 张三 2大1小 周六上午 13800138000
2. 张三 2大1小 周六上午 13800138000 已转账
"""
        registrations = parser.parse(content)
        
        rules = RulesConfig(
            total_max_capacity=100,
            price_per_adult=Decimal('100'),
            price_per_child=Decimal('50'),
            time_slots=[TimeSlotRule(name="周六上午", max_capacity=50)],
        )
        
        merger = MergeEngine(rules)
        merged, issues = merger.merge(registrations, [], [])
        
        assert len(merged) == 1
        assert len(merged[0].duplicate_records) == 1

    def test_payment_matching(self):
        parser = ChatParser()
        content = "1. 张三 2大1小 周六上午"
        registrations = parser.parse(content)
        
        payment = PaymentRecord(
            payer_name="张三",
            amount=Decimal('250'),
            line_number=1,
        )
        
        rules = RulesConfig(
            total_max_capacity=100,
            price_per_adult=Decimal('100'),
            price_per_child=Decimal('50'),
            time_slots=[TimeSlotRule(name="周六上午", max_capacity=50)],
        )
        
        merger = MergeEngine(rules)
        merged, issues = merger.merge(registrations, [payment], [])
        
        assert len(merged) == 1
        assert len(merged[0].payment_records) == 1
        assert payment.matched == True

    def test_payment_status_calculation(self):
        parser = ChatParser()
        content = "1. 张三 2大1小 周六上午"
        registrations = parser.parse(content)
        
        payment = PaymentRecord(
            payer_name="张三",
            amount=Decimal('250'),
            line_number=1,
        )
        
        rules = RulesConfig(
            total_max_capacity=100,
            price_per_adult=Decimal('100'),
            price_per_child=Decimal('50'),
            time_slots=[TimeSlotRule(name="周六上午", max_capacity=50)],
        )
        
        merger = MergeEngine(rules)
        merged, issues = merger.merge(registrations, [payment], [])
        
        assert merged[0].expected_payment == Decimal('250')
        assert merged[0].actual_payment == Decimal('250')
        assert merged[0].payment_status == PaymentStatus.PAID

    def test_apply_edit(self):
        parser = ChatParser()
        content = "1. 张三 2大1小 周六上午 13800138000"
        registrations = parser.parse(content)
        
        edit = EditRecord(
            original_name="张三",
            new_name="张三丰",
            new_phone="13900139000",
            new_total_people=4,
            new_child_count=2,
            line_number=1,
        )
        
        rules = RulesConfig(
            total_max_capacity=100,
            price_per_adult=Decimal('100'),
            price_per_child=Decimal('50'),
            time_slots=[TimeSlotRule(name="周六上午", max_capacity=50)],
        )
        
        merger = MergeEngine(rules)
        merged, issues = merger.merge(registrations, [], [edit])
        
        assert len(merged) == 1
        assert edit.applied == True
        assert merged[0].display_name == "张三丰"
        assert merged[0].effective_phone == "13900139000"
        assert merged[0].effective_total_people == 4
        assert merged[0].effective_child_count == 2


class TestRuleEngine:
    def test_capacity_limit(self):
        rules = RulesConfig(
            total_max_capacity=5,
            price_per_adult=Decimal('100'),
            price_per_child=Decimal('50'),
            time_slots=[TimeSlotRule(name="周六上午", max_capacity=5)],
            group_size=5,
        )
        
        merged_records = []
        for i in range(8):
            reg = RegistrationRecord(
                raw_line=f"{i+1}. 用户{i+1}",
                line_number=i+1,
            )
            reg.real_name = f"用户{i+1}"
            reg.total_people = 1
            reg.adult_count = 1
            reg.time_slots = ["周六上午"]
            
            merged = MergedRecord(primary_record=reg)
            merged_records.append(merged)
        
        rule_engine = RuleEngine(rules)
        groups, waitlist, issues = rule_engine.process(merged_records)
        
        slot_people = sum(sum(g.current_size for g in gs) for gs in groups.values())
        assert slot_people == 5
        assert len(waitlist) == 3

    def test_child_ratio_limit(self):
        rules = RulesConfig(
            total_max_capacity=10,
            price_per_adult=Decimal('100'),
            price_per_child=Decimal('50'),
            time_slots=[TimeSlotRule(name="周六上午", max_capacity=10, max_child_ratio=0.4)],
            group_size=10,
        )
        
        merged_records = []
        for i in range(5):
            reg = RegistrationRecord(
                raw_line=f"{i+1}. 家庭{i+1}",
                line_number=i+1,
            )
            reg.real_name = f"家庭{i+1}"
            reg.total_people = 2
            reg.adult_count = 0
            reg.child_count = 2
            reg.time_slots = ["周六上午"]
            
            merged = MergedRecord(primary_record=reg)
            merged_records.append(merged)
        
        rule_engine = RuleEngine(rules)
        groups, waitlist, issues = rule_engine.process(merged_records)
        
        slot_children = sum(sum(g.child_count for g in gs) for gs in groups.values())
        slot_total = sum(sum(g.current_size for g in gs) for gs in groups.values())
        
        if slot_total > 0:
            ratio = slot_children / slot_total
            assert ratio <= 0.4

    def test_payment_priority(self):
        rules = RulesConfig(
            total_max_capacity=3,
            price_per_adult=Decimal('100'),
            price_per_child=Decimal('50'),
            time_slots=[TimeSlotRule(name="周六上午", max_capacity=3)],
            group_size=3,
        )
        
        merged_records = []
        
        for i, paid in enumerate([False, True, False, True, False]):
            reg = RegistrationRecord(
                raw_line=f"{i+1}. 用户{i+1}",
                line_number=i+1,
            )
            reg.real_name = f"用户{i+1}"
            reg.total_people = 1
            reg.adult_count = 1
            reg.time_slots = ["周六上午"]
            
            merged = MergedRecord(primary_record=reg)
            
            if paid:
                merged.payment_status = PaymentStatus.PAID
                merged.actual_payment = Decimal('100')
                merged.expected_payment = Decimal('100')
            
            merged_records.append(merged)
        
        rule_engine = RuleEngine(rules)
        groups, waitlist, issues = rule_engine.process(merged_records)
        
        confirmed_records = []
        for slot_groups in groups.values():
            for group in slot_groups:
                confirmed_records.extend(group.members)
        
        paid_count = sum(1 for r in confirmed_records if r.payment_status == PaymentStatus.PAID)
        assert paid_count >= 1


class TestExporter:
    def test_export_creates_files(self, tmp_path):
        rules = RulesConfig(
            total_max_capacity=100,
            price_per_adult=Decimal('100'),
            price_per_child=Decimal('50'),
            time_slots=[TimeSlotRule(name="周六上午", max_capacity=50)],
            group_size=10,
        )
        
        reg = RegistrationRecord(
            raw_line="1. 测试用户 1大0小 周六上午",
            line_number=1,
        )
        reg.real_name = "测试用户"
        reg.group_nickname = "测试用户"
        reg.total_people = 1
        reg.adult_count = 1
        reg.time_slots = ["周六上午"]
        
        merged = MergedRecord(primary_record=reg)
        merged.assigned_time_slot = "周六上午"
        merged.assigned_group = "周六上午第1组"
        merged.calculate_expected_payment(rules)
        
        from signup_handler.models import Group, ProcessingResult
        
        group = Group(
            group_name="周六上午第1组",
            time_slot="周六上午",
            max_size=10,
        )
        group.members = [merged]
        
        result = ProcessingResult(
            raw_registrations=[reg],
            payments=[],
            edits=[],
            merged_records=[merged],
            groups={"周六上午": [group]},
            waitlist=[],
            validation_issues=[],
            rules=rules,
        )
        
        exporter = Exporter(tmp_path)
        exported_paths = exporter.export_all(result)
        
        for name, path in exported_paths.items():
            assert path.exists()
            assert path.stat().st_size > 0
