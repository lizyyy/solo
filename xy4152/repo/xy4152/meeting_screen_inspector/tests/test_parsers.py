import pytest
from pathlib import Path
from meeting_screen_inspector.parsers import SerialLogParser, BluetoothParser, ConfigParser
from meeting_screen_inspector.models.models import DeviceType


class TestSerialLogParser:
    def test_parse_basic_log(self):
        parser = SerialLogParser()
        content = """2024-05-01 08:00:00 INFO System: Starting up...
2024-05-01 08:00:01 INFO System: Firmware version: 2.3.5
2024-05-01 08:00:02 INFO Serial: Baud rate configured as 115200
"""
        log = parser.parse_content(content, "test.log")
        
        assert log.filename == "test.log"
        assert len(log.entries) == 3
        assert log.detected_version == "2.3.5"
        assert log.detected_baudrate == 115200
    
    def test_detect_reboot(self):
        parser = SerialLogParser()
        content = """2024-05-01 08:00:00 INFO System: Rebooting now...
2024-05-01 08:00:10 INFO System: Starting up...
2024-05-01 08:00:20 INFO System: System restart
"""
        log = parser.parse_content(content, "test.log")
        
        assert log.reboot_count >= 3
    
    def test_different_log_formats(self):
        parser = SerialLogParser()
        
        content1 = "2024-05-01 08:00:00 INFO System: Test message"
        log1 = parser.parse_content(content1, "test.log")
        assert len(log1.entries) == 1
        
        content2 = "08:00:00 INFO System: Test message"
        log2 = parser.parse_content(content2, "test.log")
        assert len(log2.entries) == 1
        
        content3 = "[2024-05-01 08:00:00] System: Test message"
        log3 = parser.parse_content(content3, "test.log")
        assert len(log3.entries) == 1
        
        content4 = "Just a simple log line"
        log4 = parser.parse_content(content4, "test.log")
        assert len(log4.entries) == 1


class TestBluetoothParser:
    def test_parse_json_format(self):
        parser = BluetoothParser()
        content = """{
            "timestamp": "2024-05-01T08:00:00Z",
            "devices": [
                {
                    "address": "AA:BB:CC:DD:EE:01",
                    "name": "TestDevice",
                    "rssi": -45
                }
            ]
        }"""
        snapshot = parser.parse_content(content)
        
        assert len(snapshot.devices) == 1
        assert snapshot.devices[0].address == "AA:BB:CC:DD:EE:01"
        assert snapshot.devices[0].name == "TestDevice"
        assert snapshot.devices[0].rssi == -45
    
    def test_parse_text_format(self):
        parser = BluetoothParser()
        content = """AA:BB:CC:DD:EE:01 TestDevice -45 dBm
11:22:33:44:55:66 AnotherDevice -60
"""
        snapshot = parser.parse_content(content)
        
        assert len(snapshot.devices) == 2
        addresses = [d.address for d in snapshot.devices]
        assert "AA:BB:CC:DD:EE:01" in addresses
        assert "11:22:33:44:55:66" in addresses


class TestConfigParser:
    def test_parse_complete_config(self):
        parser = ConfigParser()
        content = """{
            "version": "2.3.5",
            "device_id": "MS-101",
            "network": {
                "wifi": {"ssid": "TestWiFi"},
                "static_ip": {"ip": "192.168.1.100"}
            },
            "bluetooth": {
                "mac_address": "AA:BB:CC:DD:EE:01"
            }
        }"""
        config = parser.parse_content(content)
        
        assert config.version == "2.3.5"
        assert config.device_id == "MS-101"
        assert "wifi" in config.network_config
        assert "mac_address" in config.bluetooth_config
    
    def test_missing_keys(self):
        parser = ConfigParser()
        content = """{
            "device_id": "MS-101"
        }"""
        config = parser.parse_content(content)
        
        missing = parser.get_missing_keys(
            config, 
            ["version", "device_id", "network"]
        )
        
        assert "version" in missing
        assert "network" in missing
        assert "device_id" not in missing
    
    def test_nested_version(self):
        parser = ConfigParser()
        content = """{
            "device_id": "MS-101",
            "system_info": {
                "firmware_version": "2.3.5"
            }
        }"""
        config = parser.parse_content(content)
        
        assert config.version == "2.3.5"
