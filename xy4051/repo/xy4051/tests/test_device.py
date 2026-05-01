import tempfile
from pathlib import Path

import pytest

from firmware_delivery.device import Device, DeviceRegistry


class TestDevice:
    def test_device_from_dict(self):
        device = Device.from_dict({
            "device_id": "INS001",
            "model": "巡检终端X1",
            "region": "华东区域",
            "current_firmware": "v1.0.0",
            "current_calibration": "v1.0",
            "owner": "张工"
        })
        
        assert device.device_id == "INS001"
        assert device.model == "巡检终端X1"
        assert device.region == "华东区域"
        assert device.current_firmware == "v1.0.0"
        assert device.current_calibration == "v1.0"
        assert device.owner == "张工"
    
    def test_device_from_csv_row_chinese(self):
        device = Device.from_csv_row({
            "设备号": "INS001",
            "型号": "巡检终端X1",
            "区域": "华东区域",
            "当前固件": "v1.0.0",
            "当前校准版本": "v1.0",
            "负责人": "张工"
        })
        
        assert device.device_id == "INS001"
        assert device.model == "巡检终端X1"
    
    def test_device_from_csv_row_english(self):
        device = Device.from_csv_row({
            "device_id": "INS001",
            "model": "巡检终端X1",
            "region": "华东区域",
            "current_firmware": "v1.0.0",
            "owner": "张工"
        })
        
        assert device.device_id == "INS001"
    
    def test_device_to_dict(self):
        device = Device.from_dict({
            "device_id": "INS001",
            "model": "巡检终端X1",
            "region": "华东区域"
        })
        
        data = device.to_dict()
        
        assert data["device_id"] == "INS001"
        assert data["model"] == "巡检终端X1"


class TestDeviceRegistry:
    def setup_method(self):
        self.tmpdir = tempfile.mkdtemp()
        self.csv_path = Path(self.tmpdir) / "devices.csv"
    
    def test_create_registry(self):
        registry = DeviceRegistry.create(self.csv_path)
        
        assert self.csv_path.exists()
        assert len(registry.devices) == 0
    
    def test_add_device(self):
        registry = DeviceRegistry.create(self.csv_path)
        
        device = Device.from_dict({
            "device_id": "INS001",
            "model": "巡检终端X1",
            "region": "华东区域"
        })
        
        registry.add_device(device)
        
        assert "INS001" in registry.devices
        assert registry.get_device("INS001") is not None
    
    def test_get_device_nonexistent(self):
        registry = DeviceRegistry.create(self.csv_path)
        
        assert registry.get_device("nonexistent") is None
    
    def test_get_devices_by_region(self):
        registry = DeviceRegistry.create(self.csv_path)
        
        devices = [
            Device.from_dict({
                "device_id": f"INS{i:03d}",
                "model": "巡检终端X1",
                "region": region
            })
            for i, region in enumerate(["华东区域", "华北区域", "华东区域"])
        ]
        
        for device in devices:
            registry.add_device(device)
        
        east_devices = registry.get_devices_by_region("华东区域")
        assert len(east_devices) == 2
    
    def test_get_devices_by_model(self):
        registry = DeviceRegistry.create(self.csv_path)
        
        devices = [
            Device.from_dict({
                "device_id": f"INS{i:03d}",
                "model": model,
                "region": "华东区域"
            })
            for i, model in enumerate(["巡检终端X1", "传感器网关G2", "巡检终端X1"])
        ]
        
        for device in devices:
            registry.add_device(device)
        
        x1_devices = registry.get_devices_by_model("巡检终端X1")
        assert len(x1_devices) == 2
    
    def test_all_devices(self):
        registry = DeviceRegistry.create(self.csv_path)
        
        devices = [
            Device.from_dict({
                "device_id": f"INS{i:03d}",
                "model": "巡检终端X1",
                "region": "华东区域"
            })
            for i in range(3)
        ]
        
        for device in devices:
            registry.add_device(device)
        
        all_devices = registry.all_devices()
        assert len(all_devices) == 3
    
    def test_load_from_csv(self):
        csv_content = """设备号,型号,区域,当前固件,当前校准版本,最后上线时间,负责人
INS001,巡检终端X1,华东区域,v1.0.0,v1.0,2026-04-20T08:30:00,张工
INS002,传感器网关G2,华北区域,v2.1.0,v2.0,,李工"""
        
        with open(self.csv_path, "w", encoding="utf-8") as f:
            f.write(csv_content)
        
        registry = DeviceRegistry.load(self.csv_path)
        
        assert len(registry.devices) == 2
        
        device1 = registry.get_device("INS001")
        assert device1 is not None
        assert device1.model == "巡检终端X1"
        assert device1.owner == "张工"
        
        device2 = registry.get_device("INS002")
        assert device2 is not None
        assert device2.model == "传感器网关G2"
