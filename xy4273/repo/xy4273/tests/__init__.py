import pytest
import json
import csv
import yaml
from datetime import datetime, timedelta
from pathlib import Path
import tempfile
import shutil

from firmware_ga.parser_validator import (
    Parser, Validator, DeviceInfo, FirmwareManifest, UpgradeWindow,
    TelemetryEntry, ParserError
)
from firmware_ga.strategy_engine import (
    StrategyEngine, StrategyConfig, BatchPlan, BatchPriority
)
from firmware_ga.state_storage import (
    StateStorage, RollbackState, UpgradeRecord
)
from firmware_ga.telemetry_replay import TelemetryReplay, DeviceTimeline
from firmware_ga.exporter import Exporter


class TestParserValidator:
    @pytest.fixture
    def temp_dir(self):
        temp_path = Path(tempfile.mkdtemp())
        yield temp_path
        shutil.rmtree(temp_path)
    
    @pytest.fixture
    def sample_devices_csv(self, temp_dir):
        csv_path = temp_dir / "devices.csv"
        devices = [
            {
                "device_id": "PAD-001",
                "hardware_batch": "BATCH-2024-A",
                "current_firmware": "v2.1.0",
                "battery_level": 85.5,
                "last_checkin": datetime.now().isoformat(),
                "status": "idle"
            },
            {
                "device_id": "PAD-002",
                "hardware_batch": "BATCH-2024-B",
                "current_firmware": "v2.0.5",
                "battery_level": 15.0,
                "last_checkin": datetime.now().isoformat(),
                "status": "charging"
            }
        ]
        
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=devices[0].keys())
            writer.writeheader()
            writer.writerows(devices)
        
        return csv_path
    
    @pytest.fixture
    def sample_firmware_json(self, temp_dir):
        json_path = temp_dir / "firmware.json"
        firmware = {
            "version": "v2.2.0",
            "hardware_compatible": ["BATCH-2024-A", "BATCH-2024-B"],
            "signature_hash": "SHA256:test123",
            "file_path": "/firmware/update.img",
            "checksum_sha256": "a1b2c3d4e5f6"
        }
        
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(firmware, f)
        
        return json_path
    
    @pytest.fixture
    def sample_windows_yaml(self, temp_dir):
        yaml_path = temp_dir / "windows.yaml"
        windows = {
            "windows": [
                {
                    "window_id": "WINDOW-1",
                    "start_time": (datetime.now().replace(hour=8, minute=0)).isoformat(),
                    "end_time": (datetime.now().replace(hour=12, minute=0)).isoformat(),
                    "allowed_hardware_batches": ["BATCH-2024-A"],
                    "max_devices": 50
                }
            ]
        }
        
        with open(yaml_path, 'w', encoding='utf-8') as f:
            yaml.dump(windows, f)
        
        return yaml_path
    
    @pytest.fixture
    def sample_telemetry_jsonl(self, temp_dir):
        jsonl_path = temp_dir / "telemetry.jsonl"
        entries = [
            {
                "device_id": "PAD-001",
                "timestamp": datetime.now().isoformat(),
                "event_type": "telemetry_report",
                "firmware_version": "v2.1.0",
                "details": {"battery_level": 90}
            }
        ]
        
        with open(jsonl_path, 'w', encoding='utf-8') as f:
            for entry in entries:
                f.write(json.dumps(entry) + '\n')
        
        return jsonl_path
    
    def test_parse_device_list(self, sample_devices_csv):
        devices = Parser.parse_device_list(sample_devices_csv)
        
        assert len(devices) == 2
        assert devices[0].device_id == "PAD-001"
        assert devices[0].hardware_batch == "BATCH-2024-A"
        assert devices[0].battery_level == 85.5
        assert devices[1].battery_level == 15.0
    
    def test_parse_device_list_missing_file(self):
        with pytest.raises(ParserError):
            Parser.parse_device_list(Path("/nonexistent/file.csv"))
    
    def test_parse_firmware_manifest(self, sample_firmware_json):
        manifest = Parser.parse_firmware_manifest(sample_firmware_json)
        
        assert manifest.version == "v2.2.0"
        assert "BATCH-2024-A" in manifest.hardware_compatible
        assert manifest.signature_hash == "SHA256:test123"
    
    def test_parse_upgrade_windows(self, sample_windows_yaml):
        windows = Parser.parse_upgrade_windows(sample_windows_yaml)
        
        assert len(windows) == 1
        assert windows[0].window_id == "WINDOW-1"
        assert windows[0].max_devices == 50
    
    def test_parse_telemetry_logs(self, sample_telemetry_jsonl):
        entries = Parser.parse_telemetry_logs(sample_telemetry_jsonl)
        
        assert len(entries) == 1
        assert entries[0].device_id == "PAD-001"
        assert entries[0].event_type == "telemetry_report"
    
    def test_validate_hardware_compatibility_pass(self):
        device = DeviceInfo(
            device_id="PAD-001",
            hardware_batch="BATCH-2024-A",
            current_firmware="v2.1.0",
            battery_level=85.0,
            last_checkin=datetime.now()
        )
        
        firmware = FirmwareManifest(
            version="v2.2.0",
            hardware_compatible=["BATCH-2024-A", "BATCH-2024-B"],
            signature_hash="test",
            file_path="/test.img",
            checksum_sha256="abc123"
        )
        
        passed, message = Validator.validate_hardware_compatibility(device, firmware)
        assert passed is True
    
    def test_validate_hardware_compatibility_fail(self):
        device = DeviceInfo(
            device_id="PAD-001",
            hardware_batch="BATCH-2024-C",
            current_firmware="v2.1.0",
            battery_level=85.0,
            last_checkin=datetime.now()
        )
        
        firmware = FirmwareManifest(
            version="v2.2.0",
            hardware_compatible=["BATCH-2024-A"],
            signature_hash="test",
            file_path="/test.img",
            checksum_sha256="abc123"
        )
        
        passed, message = Validator.validate_hardware_compatibility(device, firmware)
        assert passed is False
    
    def test_validate_battery_level_pass(self):
        device = DeviceInfo(
            device_id="PAD-001",
            hardware_batch="BATCH-2024-A",
            current_firmware="v2.1.0",
            battery_level=85.0,
            last_checkin=datetime.now()
        )
        
        passed, message = Validator.validate_battery_level(device)
        assert passed is True
    
    def test_validate_battery_level_fail(self):
        device = DeviceInfo(
            device_id="PAD-001",
            hardware_batch="BATCH-2024-A",
            current_firmware="v2.1.0",
            battery_level=15.0,
            last_checkin=datetime.now()
        )
        
        passed, message = Validator.validate_battery_level(device)
        assert passed is False
    
    def test_validate_duplicate_upgrade_no_duplicate(self):
        device = DeviceInfo(
            device_id="PAD-001",
            hardware_batch="BATCH-2024-A",
            current_firmware="v2.1.0",
            battery_level=85.0,
            last_checkin=datetime.now()
        )
        
        firmware = FirmwareManifest(
            version="v2.2.0",
            hardware_compatible=["BATCH-2024-A"],
            signature_hash="test",
            file_path="/test.img",
            checksum_sha256="abc123"
        )
        
        telemetry_entries = []
        
        passed, message = Validator.validate_duplicate_upgrade(device, firmware, telemetry_entries)
        assert passed is True
    
    def test_validate_duplicate_upgrade_already_upgraded(self):
        device = DeviceInfo(
            device_id="PAD-001",
            hardware_batch="BATCH-2024-A",
            current_firmware="v2.1.0",
            battery_level=85.0,
            last_checkin=datetime.now()
        )
        
        firmware = FirmwareManifest(
            version="v2.2.0",
            hardware_compatible=["BATCH-2024-A"],
            signature_hash="test",
            file_path="/test.img",
            checksum_sha256="abc123"
        )
        
        telemetry_entries = [
            TelemetryEntry(
                device_id="PAD-001",
                timestamp=datetime.now() - timedelta(hours=1),
                event_type="upgrade_success",
                firmware_version="v2.2.0",
                details={}
            )
        ]
        
        passed, message = Validator.validate_duplicate_upgrade(device, firmware, telemetry_entries)
        assert passed is False


class TestStrategyEngine:
    @pytest.fixture
    def sample_devices(self):
        return [
            DeviceInfo(
                device_id=f"PAD-{i:03d}",
                hardware_batch="BATCH-2024-A" if i % 2 == 0 else "BATCH-2024-B",
                current_firmware="v2.1.0",
                battery_level=float(50 + i),
                last_checkin=datetime.now() - timedelta(hours=i)
            )
            for i in range(20)
        ]
    
    @pytest.fixture
    def sample_firmware(self):
        return FirmwareManifest(
            version="v2.2.0",
            hardware_compatible=["BATCH-2024-A", "BATCH-2024-B"],
            signature_hash="test",
            file_path="/test.img",
            checksum_sha256="abc123",
            rollback_version="v2.1.0"
        )
    
    @pytest.fixture
    def sample_windows(self):
        return [
            UpgradeWindow(
                window_id="WINDOW-1",
                start_time=datetime.now(),
                end_time=datetime.now() + timedelta(hours=4),
                allowed_hardware_batches=["*"],
                max_devices=100,
                priority=1
            )
        ]
    
    def test_generate_batching_plan(self, sample_devices, sample_firmware, sample_windows):
        engine = StrategyEngine(StrategyConfig())
        
        batches, stats = engine.generate_batching_plan(
            devices=sample_devices,
            firmware=sample_firmware,
            windows=sample_windows,
            telemetry_entries=[]
        )
        
        assert len(batches) > 0
        assert stats["eligible_devices"] == 20
        
        total_devices = sum(len(b.devices) for b in batches)
        assert total_devices == 20
    
    def test_batch_priority_order(self, sample_devices, sample_firmware, sample_windows):
        engine = StrategyEngine(StrategyConfig())
        
        batches, stats = engine.generate_batching_plan(
            devices=sample_devices,
            firmware=sample_firmware,
            windows=sample_windows,
            telemetry_entries=[]
        )
        
        priorities = [b.batch_priority for b in batches]
        
        assert BatchPriority.CANARY in priorities or len(batches) == 1
    
    def test_delay_between_batches(self, sample_devices, sample_firmware, sample_windows):
        config = StrategyConfig(delay_between_batches_hours=12.0)
        engine = StrategyEngine(config)
        
        batches, stats = engine.generate_batching_plan(
            devices=sample_devices,
            firmware=sample_firmware,
            windows=sample_windows,
            telemetry_entries=[]
        )
        
        if len(batches) > 1:
            assert batches[0].delay_hours == 0.0
            assert batches[1].delay_hours >= 12.0
    
    def test_check_batch_proceed_ok(self):
        batch = BatchPlan(
            batch_id="test_batch",
            batch_priority=BatchPriority.PHASE_1,
            devices=["PAD-001", "PAD-002"],
            window_id="W1",
            firmware_version="v2.2.0",
            batch_size=2,
            max_failures=0
        )
        
        telemetry_entries = [
            TelemetryEntry(
                device_id="PAD-001",
                timestamp=datetime.now(),
                event_type="upgrade_success",
                firmware_version="v2.2.0",
                details={}
            ),
            TelemetryEntry(
                device_id="PAD-002",
                timestamp=datetime.now(),
                event_type="upgrade_success",
                firmware_version="v2.2.0",
                details={}
            )
        ]
        
        engine = StrategyEngine()
        can_proceed, message, result = engine.check_batch_proceed(batch, telemetry_entries)
        
        assert can_proceed is True
        assert result["failures_in_batch"] == 0
    
    def test_check_batch_proceed_failures_exceeded(self):
        batch = BatchPlan(
            batch_id="test_batch",
            batch_priority=BatchPriority.CANARY,
            devices=["PAD-001", "PAD-002"],
            window_id="W1",
            firmware_version="v2.2.0",
            batch_size=2,
            max_failures=0
        )
        
        telemetry_entries = [
            TelemetryEntry(
                device_id="PAD-001",
                timestamp=datetime.now(),
                event_type="upgrade_failed",
                firmware_version="v2.2.0",
                details={"error": "download failed"}
            ),
            TelemetryEntry(
                device_id="PAD-002",
                timestamp=datetime.now(),
                event_type="upgrade_success",
                firmware_version="v2.2.0",
                details={}
            )
        ]
        
        engine = StrategyEngine()
        can_proceed, message, result = engine.check_batch_proceed(batch, telemetry_entries)
        
        assert can_proceed is False
        assert result["failures_in_batch"] == 1


class TestStateStorage:
    @pytest.fixture
    def temp_storage(self, tmp_path):
        storage_dir = tmp_path / "test_storage"
        storage = StateStorage(storage_dir)
        return storage
    
    def test_record_and_get_rollback(self, temp_storage):
        rollback = RollbackState(
            device_id="PAD-001",
            rollback_time=datetime.now(),
            from_version="v2.2.0",
            to_version="v2.1.0",
            reason="升级失败",
            rollback_id="RB-TEST-001",
            details={"error_code": "E_DOWNLOAD"}
        )
        
        temp_storage.record_rollback(rollback)
        
        history = temp_storage.get_device_rollback_history("PAD-001")
        assert len(history) == 1
        assert history[0]["rollback_id"] == "RB-TEST-001"
    
    def test_record_import(self, temp_storage, tmp_path):
        test_file = tmp_path / "test.csv"
        test_file.write_text("test content")
        
        temp_storage.record_import(
            import_type="devices",
            file_path=test_file,
            record_count=10,
            metadata={"test": "value"}
        )
        
        history = temp_storage.get_import_history("devices")
        assert len(history) == 1
        assert history[0]["record_count"] == 10
    
    def test_get_statistics(self, temp_storage):
        stats = temp_storage.get_statistics()
        
        assert "upgrade_records" in stats
        assert "rollback_states" in stats
        assert "storage_path" in stats


class TestTelemetryReplay:
    @pytest.fixture
    def sample_telemetry_entries(self):
        return [
            TelemetryEntry(
                device_id="PAD-001",
                timestamp=datetime.now() - timedelta(hours=2),
                event_type="upgrade_start",
                firmware_version="v2.1.0",
                details={"target_version": "v2.2.0"}
            ),
            TelemetryEntry(
                device_id="PAD-001",
                timestamp=datetime.now() - timedelta(hours=1),
                event_type="upgrade_success",
                firmware_version="v2.2.0",
                details={"duration": 300}
            ),
            TelemetryEntry(
                device_id="PAD-002",
                timestamp=datetime.now() - timedelta(hours=3),
                event_type="upgrade_start",
                firmware_version="v2.0.5",
                details={"target_version": "v2.1.0"}
            ),
            TelemetryEntry(
                device_id="PAD-002",
                timestamp=datetime.now() - timedelta(hours=2, minutes=45),
                event_type="upgrade_failed",
                firmware_version="v2.0.5",
                details={"error": "network error"}
            ),
            TelemetryEntry(
                device_id="PAD-003",
                timestamp=datetime.now() - timedelta(hours=1),
                event_type="telemetry_report",
                firmware_version="v2.1.0",
                details={"battery_level": 80, "crash_count": 0}
            )
        ]
    
    def test_build_timelines(self, sample_telemetry_entries):
        replay = TelemetryReplay(sample_telemetry_entries)
        
        assert len(replay.device_timelines) == 3
        
        timeline = replay.get_device_timeline("PAD-001")
        assert timeline is not None
        assert len(timeline.events) == 2
    
    def test_get_devices_by_state(self, sample_telemetry_entries):
        replay = TelemetryReplay(sample_telemetry_entries)
        
        failed_devices = replay.get_devices_by_state("upgrade_failed")
        assert "PAD-002" in failed_devices
        
        success_devices = replay.get_devices_by_state("upgrade_success")
        assert "PAD-001" in success_devices
    
    def test_get_upgrade_statistics(self, sample_telemetry_entries):
        replay = TelemetryReplay(sample_telemetry_entries)
        
        stats = replay.get_upgrade_statistics()
        
        assert stats["total_devices"] == 3
        assert stats["upgrade_success_count"] == 1
        assert stats["upgrade_failed_count"] == 1
    
    def test_find_failed_upgrades(self, sample_telemetry_entries):
        replay = TelemetryReplay(sample_telemetry_entries)
        
        failed = replay.find_failed_upgrades()
        
        assert len(failed) == 1
        assert failed[0]["device_id"] == "PAD-002"
    
    def test_filter_events(self, sample_telemetry_entries):
        replay = TelemetryReplay(sample_telemetry_entries)
        
        upgrade_events = replay.filter_events(
            event_types=['upgrade_start', 'upgrade_success', 'upgrade_failed']
        )
        
        assert len(upgrade_events) == 4
        
        pad001_events = replay.filter_events(device_ids=["PAD-001"])
        assert len(pad001_events) == 2


class TestExporter:
    @pytest.fixture
    def temp_output_dir(self, tmp_path):
        return tmp_path / "output"
    
    @pytest.fixture
    def sample_report_data(self):
        return {
            "summary": {
                "total_devices": 10,
                "passed": 8,
                "failed": 2
            },
            "validation_results": [
                {
                    "device_id": "PAD-001",
                    "passed": True,
                    "summary": "所有校验通过",
                    "validations": [
                        {"check": "hardware", "passed": True, "message": "兼容"}
                    ]
                }
            ]
        }
    
    def test_export_to_json(self, temp_output_dir, sample_report_data):
        exporter = Exporter(temp_output_dir)
        
        output_path = exporter.export_to_json(sample_report_data, "test.json")
        
        assert output_path.exists()
        
        with open(output_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        assert data["summary"]["total_devices"] == 10
    
    def test_export_to_csv(self, temp_output_dir):
        exporter = Exporter(temp_output_dir)
        
        data = [
            {"device_id": "PAD-001", "status": "passed", "score": 95},
            {"device_id": "PAD-002", "status": "failed", "score": 45}
        ]
        
        output_path = exporter.export_to_csv(data, "test.csv")
        
        assert output_path.exists()
        
        with open(output_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        
        assert len(rows) == 2
        assert rows[0]["device_id"] == "PAD-001"
    
    def test_export_to_markdown(self, temp_output_dir, sample_report_data):
        exporter = Exporter(temp_output_dir)
        
        output_path = exporter.export_to_markdown(
            sample_report_data,
            "test.md",
            title="测试报告"
        )
        
        assert output_path.exists()
        
        content = output_path.read_text()
        assert "# 测试报告" in content
        assert "total_devices" in content or "10" in content
    
    def test_create_audit_package(self, temp_output_dir, sample_report_data):
        exporter = Exporter(temp_output_dir)
        
        package = exporter.create_audit_package(sample_report_data)
        
        assert "json" in package
        assert "markdown" in package
        assert package["json"].exists()
        assert package["markdown"].exists()
