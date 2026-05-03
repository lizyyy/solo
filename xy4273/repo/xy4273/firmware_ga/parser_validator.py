import csv
import json
import hashlib
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field


@dataclass
class DeviceInfo:
    device_id: str
    hardware_batch: str
    current_firmware: str
    battery_level: float
    last_checkin: datetime
    status: str = "idle"
    hardware_model: str = "default"
    serial_number: str = ""


@dataclass
class FirmwareManifest:
    version: str
    hardware_compatible: List[str]
    signature_hash: str
    file_path: str
    checksum_sha256: str
    release_notes: str = ""
    rollback_version: str = ""


@dataclass
class UpgradeWindow:
    window_id: str
    start_time: datetime
    end_time: datetime
    allowed_hardware_batches: List[str]
    max_devices: int
    priority: int = 1


@dataclass
class TelemetryEntry:
    device_id: str
    timestamp: datetime
    event_type: str
    firmware_version: str
    details: Dict[str, Any]


class ParserError(Exception):
    pass


class ValidationError(Exception):
    pass


class Parser:
    @staticmethod
    def parse_device_list(csv_path: Path) -> List[DeviceInfo]:
        devices = []
        try:
            with open(csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        battery = float(row.get('battery_level', 100.0))
                        last_checkin = datetime.fromisoformat(
                            row.get('last_checkin', datetime.now().isoformat())
                        )
                        device = DeviceInfo(
                            device_id=row['device_id'],
                            hardware_batch=row.get('hardware_batch', 'unknown'),
                            current_firmware=row.get('current_firmware', 'unknown'),
                            battery_level=battery,
                            last_checkin=last_checkin,
                            status=row.get('status', 'idle'),
                            hardware_model=row.get('hardware_model', 'default'),
                            serial_number=row.get('serial_number', '')
                        )
                        devices.append(device)
                    except KeyError as e:
                        raise ParserError(f"设备清单缺少必要列: {e}")
                    except ValueError as e:
                        raise ParserError(f"设备清单数据格式错误: {e}")
        except FileNotFoundError:
            raise ParserError(f"设备清单文件不存在: {csv_path}")
        return devices

    @staticmethod
    def parse_firmware_manifest(json_path: Path) -> FirmwareManifest:
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            required_fields = ['version', 'hardware_compatible', 'signature_hash', 'file_path', 'checksum_sha256']
            for field in required_fields:
                if field not in data:
                    raise ParserError(f"固件Manifest缺少必要字段: {field}")
            
            return FirmwareManifest(
                version=data['version'],
                hardware_compatible=data['hardware_compatible'],
                signature_hash=data['signature_hash'],
                file_path=data['file_path'],
                checksum_sha256=data['checksum_sha256'],
                release_notes=data.get('release_notes', ''),
                rollback_version=data.get('rollback_version', '')
            )
        except FileNotFoundError:
            raise ParserError(f"固件Manifest文件不存在: {json_path}")
        except json.JSONDecodeError as e:
            raise ParserError(f"固件Manifest JSON格式错误: {e}")

    @staticmethod
    def parse_upgrade_windows(yaml_path: Path) -> List[UpgradeWindow]:
        import yaml
        
        try:
            with open(yaml_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
            
            windows = []
            if not data or 'windows' not in data:
                raise ParserError("升级窗口YAML格式错误：缺少'windows'字段")
            
            for win_data in data['windows']:
                try:
                    start_time = datetime.fromisoformat(win_data['start_time'])
                    end_time = datetime.fromisoformat(win_data['end_time'])
                    
                    if start_time >= end_time:
                        raise ParserError(f"升级窗口 {win_data.get('window_id')} 开始时间晚于结束时间")
                    
                    window = UpgradeWindow(
                        window_id=win_data['window_id'],
                        start_time=start_time,
                        end_time=end_time,
                        allowed_hardware_batches=win_data.get('allowed_hardware_batches', []),
                        max_devices=win_data.get('max_devices', 100),
                        priority=win_data.get('priority', 1)
                    )
                    windows.append(window)
                except KeyError as e:
                    raise ParserError(f"升级窗口缺少必要字段: {e}")
                except ValueError as e:
                    raise ParserError(f"升级窗口时间格式错误: {e}")
            
            return windows
        except FileNotFoundError:
            raise ParserError(f"升级窗口文件不存在: {yaml_path}")
        except yaml.YAMLError as e:
            raise ParserError(f"升级窗口YAML格式错误: {e}")

    @staticmethod
    def parse_telemetry_logs(jsonl_path: Path) -> List[TelemetryEntry]:
        entries = []
        try:
            with open(jsonl_path, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        entry = TelemetryEntry(
                            device_id=data['device_id'],
                            timestamp=datetime.fromisoformat(data['timestamp']),
                            event_type=data['event_type'],
                            firmware_version=data.get('firmware_version', 'unknown'),
                            details=data.get('details', {})
                        )
                        entries.append(entry)
                    except KeyError as e:
                        raise ParserError(f"遥测日志第{line_num}行缺少必要字段: {e}")
                    except ValueError as e:
                        raise ParserError(f"遥测日志第{line_num}行时间格式错误: {e}")
                    except json.JSONDecodeError as e:
                        raise ParserError(f"遥测日志第{line_num}行JSON格式错误: {e}")
        except FileNotFoundError:
            raise ParserError(f"遥测日志文件不存在: {jsonl_path}")
        return entries


class Validator:
    MIN_BATTERY_THRESHOLD = 20.0
    
    @staticmethod
    def validate_hardware_compatibility(
        device: DeviceInfo,
        firmware: FirmwareManifest
    ) -> Tuple[bool, str]:
        if device.hardware_batch in firmware.hardware_compatible:
            return True, "硬件批次兼容"
        if '*' in firmware.hardware_compatible:
            return True, "硬件批次兼容（通配符匹配）"
        return False, f"硬件批次不兼容: 设备批次 {device.hardware_batch} 不在兼容列表 {firmware.hardware_compatible} 中"

    @staticmethod
    def validate_signature_hash(
        firmware: FirmwareManifest,
        actual_file_path: Optional[Path] = None
    ) -> Tuple[bool, str]:
        if actual_file_path is None or not actual_file_path.exists():
            return True, "跳过文件签名验证（文件未提供）"
        
        try:
            sha256_hash = hashlib.sha256()
            with open(actual_file_path, 'rb') as f:
                for byte_block in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(byte_block)
            actual_hash = sha256_hash.hexdigest()
            
            if actual_hash == firmware.checksum_sha256:
                return True, "固件校验通过"
            return False, f"校验不匹配: 期望 {firmware.checksum_sha256}, 实际 {actual_hash}"
        except Exception as e:
            return False, f"签名校验失败: {e}"

    @staticmethod
    def validate_battery_level(device: DeviceInfo) -> Tuple[bool, str]:
        if device.battery_level >= Validator.MIN_BATTERY_THRESHOLD:
            return True, f"电量充足: {device.battery_level}%"
        return False, f"电量不足: {device.battery_level}%, 最低要求 {Validator.MIN_BATTERY_THRESHOLD}%"

    @staticmethod
    def validate_upgrade_window(
        device: DeviceInfo,
        window: UpgradeWindow,
        check_time: Optional[datetime] = None
    ) -> Tuple[bool, str]:
        if check_time is None:
            check_time = datetime.now()
        
        if not (window.start_time <= check_time <= window.end_time):
            return False, f"不在升级窗口内: 当前时间 {check_time} 不在 [{window.start_time}, {window.end_time}]"
        
        if window.allowed_hardware_batches:
            if device.hardware_batch not in window.allowed_hardware_batches and '*' not in window.allowed_hardware_batches:
                return False, f"硬件批次 {device.hardware_batch} 不在窗口允许列表中"
        
        return True, "在升级窗口内且硬件批次允许"

    @staticmethod
    def validate_duplicate_upgrade(
        device: DeviceInfo,
        firmware: FirmwareManifest,
        telemetry_entries: List[TelemetryEntry]
    ) -> Tuple[bool, str]:
        device_entries = [
            e for e in telemetry_entries 
            if e.device_id == device.device_id
        ]
        
        upgrade_success_entries = [
            e for e in device_entries 
            if e.event_type == 'upgrade_success' and e.firmware_version == firmware.version
        ]
        
        if upgrade_success_entries:
            latest = max(upgrade_success_entries, key=lambda x: x.timestamp)
            return False, f"设备已成功升级到此版本: 时间 {latest.timestamp}"
        
        in_progress_entries = [
            e for e in device_entries 
            if e.event_type == 'upgrade_start' and e.firmware_version == firmware.version
        ]
        
        for start_entry in in_progress_entries:
            success_entries = [
                e for e in device_entries
                if e.event_type in ['upgrade_success', 'upgrade_failed', 'upgrade_rollback']
                and e.timestamp > start_entry.timestamp
            ]
            if not success_entries:
                return False, f"设备已有进行中的升级任务: 开始时间 {start_entry.timestamp}"
        
        return True, "无重复升级"

    @staticmethod
    def validate_window_conflicts(
        windows: List[UpgradeWindow]
    ) -> List[Tuple[UpgradeWindow, UpgradeWindow, str]]:
        conflicts = []
        sorted_windows = sorted(windows, key=lambda w: w.start_time)
        
        for i, w1 in enumerate(sorted_windows):
            for j, w2 in enumerate(sorted_windows[i+1:], i+1):
                if w1.window_id == w2.window_id:
                    continue
                
                if w1.end_time > w2.start_time:
                    overlap_hours = (min(w1.end_time, w2.end_time) - max(w1.start_time, w2.start_time)).total_seconds() / 3600
                    
                    batches_w1 = set(w1.allowed_hardware_batches)
                    batches_w2 = set(w2.allowed_hardware_batches)
                    batch_overlap = batches_w1 & batches_w2
                    
                    if batch_overlap or '*' in batches_w1 or '*' in batches_w2:
                        conflicts.append((
                            w1, w2, 
                            f"窗口冲突: {w1.window_id} 和 {w2.window_id} 重叠 {overlap_hours:.2f} 小时, "
                            f"硬件批次重叠: {batch_overlap if batch_overlap else '通配符'}"
                        ))
        
        return conflicts

    @staticmethod
    def validate_all(
        device: DeviceInfo,
        firmware: FirmwareManifest,
        window: UpgradeWindow,
        telemetry_entries: List[TelemetryEntry],
        actual_firmware_path: Optional[Path] = None,
        check_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        results = {
            "device_id": device.device_id,
            "validations": [],
            "passed": True
        }
        
        checks = [
            ("hardware_compatibility", lambda: Validator.validate_hardware_compatibility(device, firmware)),
            ("signature_hash", lambda: Validator.validate_signature_hash(firmware, actual_firmware_path)),
            ("battery_level", lambda: Validator.validate_battery_level(device)),
            ("upgrade_window", lambda: Validator.validate_upgrade_window(device, window, check_time)),
            ("duplicate_upgrade", lambda: Validator.validate_duplicate_upgrade(device, firmware, telemetry_entries)),
        ]
        
        for check_name, check_func in checks:
            passed, message = check_func()
            results["validations"].append({
                "check": check_name,
                "passed": passed,
                "message": message
            })
            if not passed:
                results["passed"] = False
        
        results["summary"] = "所有校验通过" if results["passed"] else "存在校验失败"
        
        return results
