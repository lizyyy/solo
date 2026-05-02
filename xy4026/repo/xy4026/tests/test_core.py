"""核心功能测试"""
import tempfile
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from unittest import TestCase

from offline_gate_reconciler.config import ConfigManager, ReconcilerConfig, EntryRule, DeviceTimeOffset
from offline_gate_reconciler.csv_parser import CSVParser, ScanAction, TicketRosterEntry, ScanLogEntry
from offline_gate_reconciler.models import (
    AnomalyType,
    TicketStatus,
    TicketLedgerEntry,
)
from offline_gate_reconciler.reconciler import Reconciler
from offline_gate_reconciler.rules import RuleEngine


class TestConfig(TestCase):
    """配置模块测试"""
    
    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp())
    
    def tearDown(self):
        shutil.rmtree(self.test_dir)
    
    def test_init_project(self):
        """测试初始化项目"""
        config_manager = ConfigManager(self.test_dir)
        
        # 初始化前配置不存在
        self.assertFalse(config_manager.exists())
        
        # 初始化项目
        config = config_manager.init_project(
            project_name="测试展会",
            event_date="2026-05-01",
            reentry_allowed_types=["VIP"],
        )
        
        # 验证配置
        self.assertEqual(config.project_name, "测试展会")
        self.assertEqual(config.event_date, "2026-05-01")
        self.assertIn("VIP", config.reentry_allowed_ticket_types)
        
        # 验证配置文件已创建
        self.assertTrue(config_manager.exists())
        
        # 验证目录结构已创建
        self.assertTrue((self.test_dir / "data" / "rosters").exists())
        self.assertTrue((self.test_dir / "data" / "logs").exists())
        self.assertTrue((self.test_dir / "output" / "reports").exists())
        self.assertTrue((self.test_dir / "output" / "ledgers").exists())
        self.assertTrue((self.test_dir / "history").exists())
        self.assertTrue((self.test_dir / "quarantine").exists())
    
    def test_reentry_allowed(self):
        """测试二次入场权限检查"""
        config = ReconcilerConfig(
            project_name="测试",
            event_date="2026-05-01",
            reentry_allowed_ticket_types=["VIP", "媒体"],
        )
        
        self.assertTrue(config.is_reentry_allowed("VIP"))
        self.assertTrue(config.is_reentry_allowed("媒体"))
        self.assertFalse(config.is_reentry_allowed("普通"))
    
    def test_entry_rules(self):
        """测试入口规则"""
        config = ReconcilerConfig(
            project_name="测试",
            event_date="2026-05-01",
            entry_rules=[
                EntryRule(entry_id="A1", entry_name="主入口", allowed_ticket_types=["VIP", "普通"]),
                EntryRule(entry_id="A2", entry_name="VIP入口", allowed_ticket_types=["VIP"], is_vip_only=True),
            ],
        )
        
        # 主入口允许所有票种
        self.assertTrue(config.can_enter_at("VIP", "A1"))
        self.assertTrue(config.can_enter_at("普通", "A1"))
        
        # VIP入口只允许VIP
        self.assertTrue(config.can_enter_at("VIP", "A2"))
        self.assertFalse(config.can_enter_at("普通", "A2"))
    
    def test_device_time_offset(self):
        """测试设备时间偏移"""
        config = ReconcilerConfig(
            project_name="测试",
            event_date="2026-05-01",
            device_time_offsets=[
                DeviceTimeOffset(device_id="DEV001", offset_seconds=60),  # 快60秒
                DeviceTimeOffset(device_id="DEV002", offset_seconds=-30),  # 慢30秒
            ],
        )
        
        self.assertEqual(config.get_device_offset("DEV001"), 60)
        self.assertEqual(config.get_device_offset("DEV002"), -30)
        self.assertEqual(config.get_device_offset("DEV003"), 0)  # 未配置的设备偏移为0


class TestCSVParser(TestCase):
    """CSV 解析测试"""
    
    def setUp(self):
        self.test_dir = Path(tempfile.mkdtemp())
        self.parser = CSVParser()
    
    def tearDown(self):
        shutil.rmtree(self.test_dir)
    
    def test_parse_roster(self):
        """测试解析票务名单"""
        # 创建测试 CSV
        csv_content = """票号,姓名,手机号后四位,票种,允许入口,是否黑名单
T001,张三,1234,VIP,A1,A2,否
T002,李四,5678,普通,A1,否
"""
        csv_path = self.test_dir / "test_roster.csv"
        csv_path.write_text(csv_content, encoding="utf-8")
        
        result = self.parser.parse_roster(csv_path)
        
        self.assertEqual(result.success_count, 2)
        self.assertEqual(result.failed_count, 0)
        
        entry = result.success_entries[0]
        self.assertEqual(entry.ticket_number, "T001")
        self.assertEqual(entry.name, "张三")
        self.assertEqual(entry.phone_last_four, "1234")
        self.assertEqual(entry.ticket_type, "VIP")
        self.assertFalse(entry.is_blacklisted)
    
    def test_parse_scan_log(self):
        """测试解析扫码日志"""
        csv_content = """设备号,入口,时间戳,票号,动作,操作员
DEV001,A1,2026-05-01 09:00:00,T001,入场,操作员甲
DEV001,A1,2026-05-01 09:30:00,T001,退场,操作员甲
"""
        csv_path = self.test_dir / "test_log.csv"
        csv_path.write_text(csv_content, encoding="utf-8")
        
        result = self.parser.parse_scan_log(csv_path)
        
        self.assertEqual(result.success_count, 2)
        
        entry1 = result.success_entries[0]
        self.assertEqual(entry1.device_id, "DEV001")
        self.assertEqual(entry1.entry, "A1")
        self.assertEqual(entry1.ticket_number, "T001")
        self.assertEqual(entry1.action, ScanAction.ENTRY)
        
        entry2 = result.success_entries[1]
        self.assertEqual(entry2.action, ScanAction.EXIT)
    
    def test_parse_timestamp_formats(self):
        """测试多种时间戳格式解析"""
        from offline_gate_reconciler.csv_parser import ScanLogEntry
        
        # 测试多种格式
        test_cases = [
            ("2026-05-01 09:00:00", True),
            ("2026-05-01 09:00", True),
            ("2026/05/01 09:00:00", True),
            ("01-05-2026 09:00:00", True),
            ("1746080400", True),  # Unix 时间戳
            ("invalid", False),
        ]
        
        for ts_str, should_parse in test_cases:
            result = ScanLogEntry._parse_timestamp(ts_str)
            if should_parse:
                self.assertIsNotNone(result, f"应该能解析: {ts_str}")
            else:
                self.assertIsNone(result, f"不应该解析: {ts_str}")
    
    def test_action_parsing(self):
        """测试动作类型解析"""
        from offline_gate_reconciler.csv_parser import ScanLogEntry
        
        test_cases = [
            ("入场", ScanAction.ENTRY),
            ("进场", ScanAction.ENTRY),
            ("entry", ScanAction.ENTRY),
            ("退场", ScanAction.EXIT),
            ("离场", ScanAction.EXIT),
            ("exit", ScanAction.EXIT),
            ("二次入场", ScanAction.REENTRY),
            ("reentry", ScanAction.REENTRY),
        ]
        
        for action_str, expected in test_cases:
            result = ScanLogEntry._parse_action(action_str)
            self.assertEqual(result, expected, f"解析 {action_str} 失败")


class TestRuleEngine(TestCase):
    """规则引擎测试"""
    
    def setUp(self):
        self.config = ReconcilerConfig(
            project_name="测试",
            event_date="2026-05-01",
            reentry_allowed_ticket_types=["VIP"],
            entry_rules=[
                EntryRule(entry_id="A1", entry_name="主入口", allowed_ticket_types=["VIP", "普通"]),
                EntryRule(entry_id="A2", entry_name="VIP入口", allowed_ticket_types=["VIP"], is_vip_only=True),
            ],
            ticket_types={
                "VIP": "VIP票",
                "普通": "普通票",
            },
        )
        self.rule_engine = RuleEngine(self.config)
    
    def test_validate_blacklisted_ticket(self):
        """测试黑名单票验证"""
        from offline_gate_reconciler.csv_parser import ScanLogEntry
        
        roster_entry = TicketRosterEntry(
            ticket_number="T001",
            name="测试",
            phone_last_four="1234",
            ticket_type="普通",
            allowed_entries=["A1"],
            is_blacklisted=True,
        )
        
        log_entry = ScanLogEntry(
            device_id="DEV001",
            entry="A1",
            timestamp=datetime.now(),
            ticket_number="T001",
            action=ScanAction.ENTRY,
            operator="测试",
        )
        
        is_valid, anomalies = self.rule_engine.validate_entry(
            log_entry, roster_entry, TicketStatus.UNUSED, []
        )
        
        # 黑名单票验证不通过
        self.assertFalse(is_valid)
        
        # 应该有黑名单异常
        has_blacklist = any(
            a.anomaly_type == AnomalyType.BLACKLISTED for a in anomalies
        )
        self.assertTrue(has_blacklist)
    
    def test_validate_wrong_entry(self):
        """测试错误入口验证"""
        from offline_gate_reconciler.csv_parser import ScanLogEntry
        
        # 普通票试图进入 VIP 入口
        roster_entry = TicketRosterEntry(
            ticket_number="T002",
            name="测试",
            phone_last_four="5678",
            ticket_type="普通",
            allowed_entries=["A1"],
            is_blacklisted=False,
        )
        
        log_entry = ScanLogEntry(
            device_id="DEV002",
            entry="A2",  # VIP 入口
            timestamp=datetime.now(),
            ticket_number="T002",
            action=ScanAction.ENTRY,
            operator="测试",
        )
        
        is_valid, anomalies = self.rule_engine.validate_entry(
            log_entry, roster_entry, TicketStatus.UNUSED, []
        )
        
        # 错误入口应该产生异常但不阻止验证（因为不是致命错误）
        has_wrong_entry = any(
            a.anomaly_type == AnomalyType.WRONG_ENTRY for a in anomalies
        )
        self.assertTrue(has_wrong_entry)
    
    def test_validate_duplicate_entry(self):
        """测试普通票重复入场"""
        from offline_gate_reconciler.csv_parser import ScanLogEntry
        
        roster_entry = TicketRosterEntry(
            ticket_number="T003",
            name="测试",
            phone_last_four="9012",
            ticket_type="普通",  # 普通票不允许二次入场
            allowed_entries=["A1"],
            is_blacklisted=False,
        )
        
        # 第一次入场
        log_entry1 = ScanLogEntry(
            device_id="DEV001",
            entry="A1",
            timestamp=datetime.now(),
            ticket_number="T003",
            action=ScanAction.ENTRY,
            operator="测试",
        )
        
        is_valid1, _ = self.rule_engine.validate_entry(
            log_entry1, roster_entry, TicketStatus.UNUSED, []
        )
        self.assertTrue(is_valid1)
        
        # 第二次入场（已在场内）
        log_entry2 = ScanLogEntry(
            device_id="DEV001",
            entry="A1",
            timestamp=datetime.now() + timedelta(hours=1),
            ticket_number="T003",
            action=ScanAction.ENTRY,
            operator="测试",
        )
        
        is_valid2, anomalies2 = self.rule_engine.validate_entry(
            log_entry2, roster_entry, TicketStatus.IN_VENUE, []
        )
        
        # 普通票重复入场会记录异常（非阻止性异常，记录但继续处理）
        has_duplicate = any(
            a.anomaly_type == AnomalyType.DUPLICATE_ENTRY for a in anomalies2
        )
        self.assertTrue(has_duplicate, "应该检测到重复入场异常")
    
    def test_validate_vip_reentry(self):
        """测试 VIP 票二次入场"""
        from offline_gate_reconciler.csv_parser import ScanLogEntry
        
        roster_entry = TicketRosterEntry(
            ticket_number="T004",
            name="测试VIP",
            phone_last_four="3456",
            ticket_type="VIP",  # VIP 允许二次入场
            allowed_entries=["A1"],
            is_blacklisted=False,
        )
        
        # 退场后二次入场
        log_entry = ScanLogEntry(
            device_id="DEV001",
            entry="A1",
            timestamp=datetime.now(),
            ticket_number="T004",
            action=ScanAction.REENTRY,
            operator="测试",
        )
        
        is_valid, anomalies = self.rule_engine.validate_reentry(
            log_entry, roster_entry, TicketStatus.EXITED, []
        )
        
        # VIP 票应该允许二次入场
        self.assertTrue(is_valid)


class TestReconciler(TestCase):
    """对账器测试"""
    
    def setUp(self):
        self.config = ReconcilerConfig(
            project_name="测试",
            event_date="2026-05-01",
            reentry_allowed_ticket_types=["VIP"],
            duplicate_scan_window_seconds=90,
        )
        self.reconciler = Reconciler(self.config)
    
    def test_basic_reconciliation(self):
        """测试基本对账流程"""
        from offline_gate_reconciler.csv_parser import ScanLogEntry
        
        # 创建票务名单
        roster = {
            "T001": TicketRosterEntry(
                ticket_number="T001",
                name="张三",
                phone_last_four="1234",
                ticket_type="普通",
                allowed_entries=["A1"],
                is_blacklisted=False,
            ),
            "T002": TicketRosterEntry(
                ticket_number="T002",
                name="李四",
                phone_last_four="5678",
                ticket_type="VIP",
                allowed_entries=["A1", "A2"],
                is_blacklisted=False,
            ),
        }
        
        # 创建扫码日志
        now = datetime.now()
        scan_logs = [
            ScanLogEntry(
                device_id="DEV001",
                entry="A1",
                timestamp=now,
                ticket_number="T001",
                action=ScanAction.ENTRY,
                operator="测试",
            ),
            ScanLogEntry(
                device_id="DEV001",
                entry="A1",
                timestamp=now + timedelta(hours=2),
                ticket_number="T001",
                action=ScanAction.EXIT,
                operator="测试",
            ),
        ]
        
        # 执行对账
        result = self.reconciler.reconcile(roster, scan_logs, [])
        
        # 验证结果
        self.assertEqual(result.total_tickets, 2)
        self.assertEqual(result.tickets_scanned, 1)
        self.assertEqual(result.tickets_exited, 1)
        
        # 验证台账
        self.assertIn("T001", result.ledger)
        ledger_entry = result.ledger["T001"]
        self.assertEqual(ledger_entry.total_entries, 1)
        self.assertEqual(ledger_entry.total_exits, 1)
        self.assertEqual(ledger_entry.current_status, TicketStatus.EXITED)
    
    def test_unknown_ticket(self):
        """测试未知票检测"""
        from offline_gate_reconciler.csv_parser import ScanLogEntry
        
        roster = {}  # 空名单
        
        scan_logs = [
            ScanLogEntry(
                device_id="DEV001",
                entry="A1",
                timestamp=datetime.now(),
                ticket_number="UNKNOWN001",
                action=ScanAction.ENTRY,
                operator="测试",
            ),
        ]
        
        result = self.reconciler.reconcile(roster, scan_logs, [])
        
        # 应该检测到未知票异常
        self.assertGreater(result.total_anomalies, 0)
        self.assertIn(AnomalyType.UNKNOWN_TICKET, result.anomaly_counts)
    
    def test_duplicate_scan_merging(self):
        """测试重复扫码合并"""
        from offline_gate_reconciler.csv_parser import ScanLogEntry
        
        roster = {
            "T001": TicketRosterEntry(
                ticket_number="T001",
                name="测试",
                phone_last_four="1234",
                ticket_type="普通",
                allowed_entries=["A1"],
                is_blacklisted=False,
            ),
        }
        
        now = datetime.now()
        scan_logs = [
            ScanLogEntry(
                device_id="DEV001",
                entry="A1",
                timestamp=now,
                ticket_number="T001",
                action=ScanAction.ENTRY,
                operator="测试",
            ),
            # 5秒后同一设备再次扫码（应该被合并）
            ScanLogEntry(
                device_id="DEV001",
                entry="A1",
                timestamp=now + timedelta(seconds=5),
                ticket_number="T001",
                action=ScanAction.ENTRY,
                operator="测试",
            ),
        ]
        
        result = self.reconciler.reconcile(roster, scan_logs, [])
        
        # 应该有一个重复扫码被合并
        self.assertEqual(result.duplicate_merges, 1)
        
        # 台账中应该只有一条有效记录
        ledger_entry = result.ledger["T001"]
        self.assertEqual(ledger_entry.total_entries, 1)


if __name__ == "__main__":
    import unittest
    unittest.main()
