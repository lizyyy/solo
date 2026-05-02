import pytest
from datetime import datetime
from meeting_screen_inspector.models.models import (
    DeviceType,
    RiskType,
    RiskLevel,
    InspectionSession,
    DeviceInspection,
    DeviceIdentity,
    SerialLog,
    SerialLogEntry,
    SerialPortInfo,
    BluetoothSnapshot,
    BluetoothDevice,
    DeviceConfig,
)
from meeting_screen_inspector.rules import (
    VersionDriftRule,
    RebootLoopRule,
    AddressDuplicateRule,
    ConfigMissingRule,
    RollbackRiskRule,
    BaudrateErrorRule,
    RuleEngine,
)


class TestVersionDriftRule:
    def test_detect_version_drift(self):
        session = InspectionSession(
            session_id="test-001",
            created_at=datetime.now(),
        )
        
        device1 = DeviceInspection(
            identity=DeviceIdentity(
                device_type=DeviceType.MEETING_SCREEN,
                device_id="MS-001",
            ),
            serial_log=SerialLog(
                filename="test.log",
                raw_content="",
                detected_version="2.3.5",
            ),
        )
        
        device2 = DeviceInspection(
            identity=DeviceIdentity(
                device_type=DeviceType.MEETING_SCREEN,
                device_id="MS-002",
            ),
            serial_log=SerialLog(
                filename="test.log",
                raw_content="",
                detected_version="2.3.5",
            ),
        )
        
        device3 = DeviceInspection(
            identity=DeviceIdentity(
                device_type=DeviceType.MEETING_SCREEN,
                device_id="MS-003",
            ),
            serial_log=SerialLog(
                filename="test.log",
                raw_content="",
                detected_version="2.2.1",
            ),
        )
        
        session.devices = [device1, device2, device3]
        
        rule = VersionDriftRule()
        risks = rule.execute(session)
        
        assert len(risks) == 1
        assert risks[0].risk_type == RiskType.VERSION_DRIFT
        assert risks[0].device_id == "MS-003"
    
    def test_no_version_drift_when_all_same(self):
        session = InspectionSession(
            session_id="test-001",
            created_at=datetime.now(),
        )
        
        device1 = DeviceInspection(
            identity=DeviceIdentity(
                device_type=DeviceType.MEETING_SCREEN,
                device_id="MS-001",
            ),
            serial_log=SerialLog(
                filename="test.log",
                raw_content="",
                detected_version="2.3.5",
            ),
        )
        
        device2 = DeviceInspection(
            identity=DeviceIdentity(
                device_type=DeviceType.MEETING_SCREEN,
                device_id="MS-002",
            ),
            serial_log=SerialLog(
                filename="test.log",
                raw_content="",
                detected_version="2.3.5",
            ),
        )
        
        session.devices = [device1, device2]
        
        rule = VersionDriftRule()
        risks = rule.execute(session)
        
        assert len(risks) == 0
    
    def test_version_from_config(self):
        session = InspectionSession(
            session_id="test-001",
            created_at=datetime.now(),
        )
        
        device1 = DeviceInspection(
            identity=DeviceIdentity(
                device_type=DeviceType.MEETING_SCREEN,
                device_id="MS-001",
            ),
            config=DeviceConfig(
                raw_json={"version": "2.3.5"},
                version="2.3.5",
            ),
        )
        
        device2 = DeviceInspection(
            identity=DeviceIdentity(
                device_type=DeviceType.MEETING_SCREEN,
                device_id="MS-002",
            ),
            config=DeviceConfig(
                raw_json={"version": "2.2.0"},
                version="2.2.0",
            ),
        )
        
        session.devices = [device1, device2]
        
        rule = VersionDriftRule()
        risks = rule.execute(session)
        
        assert len(risks) == 1


class TestRebootLoopRule:
    def test_detect_reboot_loop(self):
        session = InspectionSession(
            session_id="test-001",
            created_at=datetime.now(),
        )
        
        device = DeviceInspection(
            identity=DeviceIdentity(
                device_type=DeviceType.MEETING_SCREEN,
                device_id="MS-001",
            ),
            serial_log=SerialLog(
                filename="test.log",
                raw_content="",
                reboot_count=5,
            ),
        )
        
        session.devices = [device]
        
        rule = RebootLoopRule(reboot_threshold=3)
        risks = rule.execute(session)
        
        assert len(risks) == 1
        assert risks[0].risk_type == RiskType.REBOOT_LOOP
        assert risks[0].level == RiskLevel.CRITICAL
    
    def test_no_reboot_loop_below_threshold(self):
        session = InspectionSession(
            session_id="test-001",
            created_at=datetime.now(),
        )
        
        device = DeviceInspection(
            identity=DeviceIdentity(
                device_type=DeviceType.MEETING_SCREEN,
                device_id="MS-001",
            ),
            serial_log=SerialLog(
                filename="test.log",
                raw_content="",
                reboot_count=1,
            ),
        )
        
        session.devices = [device]
        
        rule = RebootLoopRule(reboot_threshold=3)
        risks = rule.execute(session)
        
        assert len(risks) == 0


class TestAddressDuplicateRule:
    def test_detect_duplicate_address(self):
        session = InspectionSession(
            session_id="test-001",
            created_at=datetime.now(),
        )
        
        device1 = DeviceInspection(
            identity=DeviceIdentity(
                device_type=DeviceType.MEETING_SCREEN,
                device_id="MS-001",
            ),
            bluetooth_snapshot=BluetoothSnapshot(
                timestamp=datetime.now(),
                devices=[
                    BluetoothDevice(address="AA:BB:CC:DD:EE:01"),
                ],
            ),
        )
        
        device2 = DeviceInspection(
            identity=DeviceIdentity(
                device_type=DeviceType.MEETING_SCREEN,
                device_id="MS-002",
            ),
            bluetooth_snapshot=BluetoothSnapshot(
                timestamp=datetime.now(),
                devices=[
                    BluetoothDevice(address="AA:BB:CC:DD:EE:01"),
                ],
            ),
        )
        
        session.devices = [device1, device2]
        
        rule = AddressDuplicateRule()
        risks = rule.execute(session)
        
        assert len(risks) == 2
        assert all(r.risk_type == RiskType.ADDRESS_DUPLICATE for r in risks)
        assert all(r.level == RiskLevel.CRITICAL for r in risks)
    
    def test_no_duplicate_address(self):
        session = InspectionSession(
            session_id="test-001",
            created_at=datetime.now(),
        )
        
        device1 = DeviceInspection(
            identity=DeviceIdentity(
                device_type=DeviceType.MEETING_SCREEN,
                device_id="MS-001",
            ),
            bluetooth_snapshot=BluetoothSnapshot(
                timestamp=datetime.now(),
                devices=[
                    BluetoothDevice(address="AA:BB:CC:DD:EE:01"),
                ],
            ),
        )
        
        device2 = DeviceInspection(
            identity=DeviceIdentity(
                device_type=DeviceType.MEETING_SCREEN,
                device_id="MS-002",
            ),
            bluetooth_snapshot=BluetoothSnapshot(
                timestamp=datetime.now(),
                devices=[
                    BluetoothDevice(address="11:22:33:44:55:66"),
                ],
            ),
        )
        
        session.devices = [device1, device2]
        
        rule = AddressDuplicateRule()
        risks = rule.execute(session)
        
        assert len(risks) == 0


class TestConfigMissingRule:
    def test_detect_missing_config(self):
        session = InspectionSession(
            session_id="test-001",
            created_at=datetime.now(),
        )
        
        device = DeviceInspection(
            identity=DeviceIdentity(
                device_type=DeviceType.MEETING_SCREEN,
                device_id="MS-001",
            ),
            config=DeviceConfig(
                raw_json={"device_id": "MS-001"},
                device_id="MS-001",
            ),
        )
        
        session.devices = [device]
        
        rule = ConfigMissingRule(required_keys=["version", "device_id", "network"])
        risks = rule.execute(session)
        
        assert len(risks) == 1
        assert risks[0].risk_type == RiskType.CONFIG_MISSING
    
    def test_complete_config_no_risk(self):
        session = InspectionSession(
            session_id="test-001",
            created_at=datetime.now(),
        )
        
        device = DeviceInspection(
            identity=DeviceIdentity(
                device_type=DeviceType.MEETING_SCREEN,
                device_id="MS-001",
            ),
            config=DeviceConfig(
                raw_json={
                    "version": "2.3.5",
                    "device_id": "MS-001",
                    "network": {"wifi": "Test"},
                },
                version="2.3.5",
                device_id="MS-001",
                network_config={"wifi": "Test"},
            ),
        )
        
        session.devices = [device]
        
        rule = ConfigMissingRule(required_keys=["version", "device_id", "network"])
        risks = rule.execute(session)
        
        assert len(risks) == 0


class TestRollbackRiskRule:
    def test_no_config_rollback_risk(self):
        session = InspectionSession(
            session_id="test-001",
            created_at=datetime.now(),
        )
        
        device = DeviceInspection(
            identity=DeviceIdentity(
                device_type=DeviceType.MEETING_SCREEN,
                device_id="MS-001",
            ),
        )
        
        session.devices = [device]
        
        rule = RollbackRiskRule()
        risks = rule.execute(session)
        
        assert len(risks) == 1
        assert risks[0].risk_type == RiskType.ROLLBACK_RISK
        assert risks[0].level == RiskLevel.HIGH


class TestBaudrateErrorRule:
    def test_detect_baudrate_error(self):
        session = InspectionSession(
            session_id="test-001",
            created_at=datetime.now(),
        )
        
        device = DeviceInspection(
            identity=DeviceIdentity(
                device_type=DeviceType.MEETING_SCREEN,
                device_id="MS-001",
            ),
            serial_log=SerialLog(
                filename="test.log",
                raw_content="",
                port_info=SerialPortInfo(
                    baud_rate=115200,
                    detected_baud_rate=9600,
                ),
            ),
        )
        
        session.devices = [device]
        
        rule = BaudrateErrorRule(expected_baudrate=115200)
        risks = rule.execute(session)
        
        assert len(risks) == 1
        assert risks[0].risk_type == RiskType.BAUDRATE_ERROR


class TestRuleEngine:
    def test_run_all_rules(self):
        engine = RuleEngine()
        
        session = InspectionSession(
            session_id="test-001",
            created_at=datetime.now(),
        )
        
        device1 = DeviceInspection(
            identity=DeviceIdentity(
                device_type=DeviceType.MEETING_SCREEN,
                device_id="MS-001",
            ),
            serial_log=SerialLog(
                filename="test.log",
                raw_content="",
                detected_version="2.3.5",
                reboot_count=5,
                port_info=SerialPortInfo(
                    baud_rate=115200,
                    detected_baud_rate=9600,
                ),
            ),
        )
        
        session.devices = [device1]
        
        results = engine.run_all(session)
        
        assert len(results) > 0
