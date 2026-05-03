import random
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

from .parser_validator import (
    DeviceInfo, FirmwareManifest, UpgradeWindow, TelemetryEntry,
    Validator
)


class BatchPriority(Enum):
    CANARY = "canary"
    PHASE_1 = "phase_1"
    PHASE_2 = "phase_2"
    PHASE_3 = "phase_3"
    FULL = "full"


@dataclass
class BatchPlan:
    batch_id: str
    batch_priority: BatchPriority
    devices: List[str]
    window_id: str
    firmware_version: str
    batch_size: int
    max_failures: int
    delay_hours: float = 0.0


@dataclass
class StrategyConfig:
    canary_percentage: float = 5.0
    phase_1_percentage: float = 15.0
    phase_2_percentage: float = 30.0
    phase_3_percentage: float = 50.0
    canary_max_failures: int = 0
    phase_max_failures_ratio: float = 0.05
    delay_between_batches_hours: float = 24.0
    group_by_hardware_batch: bool = True
    prioritize_low_battery: bool = False
    prioritize_recent_checkin: bool = True
    minimum_batch_size: int = 1
    maximum_batch_size: int = 100


class StrategyEngine:
    def __init__(self, config: Optional[StrategyConfig] = None):
        self.config = config or StrategyConfig()
    
    def generate_batching_plan(
        self,
        devices: List[DeviceInfo],
        firmware: FirmwareManifest,
        windows: List[UpgradeWindow],
        telemetry_entries: List[TelemetryEntry],
        validation_results: Optional[Dict[str, Dict[str, Any]]] = None
    ) -> Tuple[List[BatchPlan], Dict[str, Any]]:
        stats = {
            "total_devices": len(devices),
            "eligible_devices": 0,
            "excluded_devices": [],
            "batches": [],
            "windows_used": []
        }
        
        eligible_devices = self._filter_eligible_devices(
            devices, firmware, windows, telemetry_entries, validation_results
        )
        
        stats["eligible_devices"] = len(eligible_devices)
        stats["excluded_devices"] = [
            {"device_id": d.device_id, "reason": "校验失败或不兼容"}
            for d in devices if d not in eligible_devices
        ]
        
        if not eligible_devices:
            stats["message"] = "没有符合条件的设备"
            return [], stats
        
        if self.config.group_by_hardware_batch:
            grouped_devices = self._group_by_hardware_batch(eligible_devices)
            all_batches = []
            for batch_name, batch_devices in grouped_devices.items():
                batches = self._create_batches_by_percentage(
                    batch_devices, firmware, windows, stats
                )
                all_batches.extend(batches)
        else:
            all_batches = self._create_batches_by_percentage(
                eligible_devices, firmware, windows, stats
            )
        
        self._assign_windows_to_batches(all_batches, windows)
        self._set_delay_between_batches(all_batches)
        
        stats["batches"] = [
            {
                "batch_id": b.batch_id,
                "priority": b.batch_priority.value,
                "device_count": len(b.devices),
                "window_id": b.window_id,
                "delay_hours": b.delay_hours
            }
            for b in all_batches
        ]
        
        return all_batches, stats
    
    def _filter_eligible_devices(
        self,
        devices: List[DeviceInfo],
        firmware: FirmwareManifest,
        windows: List[UpgradeWindow],
        telemetry_entries: List[TelemetryEntry],
        validation_results: Optional[Dict[str, Dict[str, Any]]] = None
    ) -> List[DeviceInfo]:
        eligible = []
        
        for device in devices:
            if validation_results and device.device_id in validation_results:
                if not validation_results[device.device_id].get("passed", False):
                    continue
            
            compatible, _ = Validator.validate_hardware_compatibility(device, firmware)
            if not compatible:
                continue
            
            battery_ok, _ = Validator.validate_battery_level(device)
            if not battery_ok:
                continue
            
            no_dup, _ = Validator.validate_duplicate_upgrade(device, firmware, telemetry_entries)
            if not no_dup:
                continue
            
            eligible.append(device)
        
        return eligible
    
    def _group_by_hardware_batch(
        self, devices: List[DeviceInfo]
    ) -> Dict[str, List[DeviceInfo]]:
        grouped = {}
        for device in devices:
            batch = device.hardware_batch
            if batch not in grouped:
                grouped[batch] = []
            grouped[batch].append(device)
        return grouped
    
    def _sort_devices_by_priority(self, devices: List[DeviceInfo]) -> List[DeviceInfo]:
        def priority_key(device: DeviceInfo) -> Tuple:
            keys = []
            if self.config.prioritize_low_battery:
                keys.append(device.battery_level)
            if self.config.prioritize_recent_checkin:
                keys.append(-device.last_checkin.timestamp())
            keys.append(device.device_id)
            return tuple(keys)
        
        return sorted(devices, key=priority_key)
    
    def _create_batches_by_percentage(
        self,
        devices: List[DeviceInfo],
        firmware: FirmwareManifest,
        windows: List[UpgradeWindow],
        stats: Dict[str, Any]
    ) -> List[BatchPlan]:
        batches = []
        total = len(devices)
        
        sorted_devices = self._sort_devices_by_priority(devices)
        
        if total == 0:
            return batches
        
        percentages = [
            (BatchPriority.CANARY, self.config.canary_percentage),
            (BatchPriority.PHASE_1, self.config.phase_1_percentage),
            (BatchPriority.PHASE_2, self.config.phase_2_percentage),
            (BatchPriority.PHASE_3, self.config.phase_3_percentage),
        ]
        
        cumulative = 0
        for priority, percentage in percentages:
            if cumulative >= total:
                break
            
            batch_size = max(
                self.config.minimum_batch_size,
                min(
                    self.config.maximum_batch_size,
                    int(total * percentage / 100)
                )
            )
            
            if cumulative + batch_size > total:
                batch_size = total - cumulative
            
            if batch_size <= 0:
                continue
            
            batch_devices = sorted_devices[cumulative:cumulative + batch_size]
            cumulative += batch_size
            
            batch = BatchPlan(
                batch_id=f"{priority.value}_{firmware.version}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                batch_priority=priority,
                devices=[d.device_id for d in batch_devices],
                window_id="",
                firmware_version=firmware.version,
                batch_size=len(batch_devices),
                max_failures=self._calculate_max_failures(priority, len(batch_devices))
            )
            batches.append(batch)
        
        if cumulative < total:
            remaining_devices = sorted_devices[cumulative:]
            batch = BatchPlan(
                batch_id=f"{BatchPriority.FULL.value}_{firmware.version}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                batch_priority=BatchPriority.FULL,
                devices=[d.device_id for d in remaining_devices],
                window_id="",
                firmware_version=firmware.version,
                batch_size=len(remaining_devices),
                max_failures=int(len(remaining_devices) * self.config.phase_max_failures_ratio)
            )
            batches.append(batch)
        
        return batches
    
    def _calculate_max_failures(self, priority: BatchPriority, batch_size: int) -> int:
        if priority == BatchPriority.CANARY:
            return self.config.canary_max_failures
        return max(1, int(batch_size * self.config.phase_max_failures_ratio))
    
    def _assign_windows_to_batches(
        self,
        batches: List[BatchPlan],
        windows: List[UpgradeWindow]
    ) -> None:
        if not windows:
            for batch in batches:
                batch.window_id = "default_window"
            return
        
        sorted_windows = sorted(
            windows, 
            key=lambda w: (w.priority, w.start_time)
        )
        
        window_index = 0
        for batch in batches:
            if window_index < len(sorted_windows):
                window = sorted_windows[window_index]
                batch.window_id = window.window_id
                
                if len(batch.devices) <= window.max_devices:
                    window_index += 1
            else:
                batch.window_id = sorted_windows[-1].window_id
    
    def _set_delay_between_batches(self, batches: List[BatchPlan]) -> None:
        for i, batch in enumerate(batches):
            if i == 0:
                batch.delay_hours = 0.0
            else:
                batch.delay_hours = self.config.delay_between_batches_hours * i
    
    def check_batch_proceed(
        self,
        batch: BatchPlan,
        telemetry_entries: List[TelemetryEntry],
        previous_batch_results: Optional[Dict[str, Any]] = None
    ) -> Tuple[bool, str, Dict[str, Any]]:
        result = {
            "can_proceed": True,
            "failures_in_batch": 0,
            "successes_in_batch": 0,
            "in_progress": 0,
            "previous_batch_ok": True
        }
        
        device_entries = {}
        for entry in telemetry_entries:
            if entry.device_id in batch.devices:
                if entry.device_id not in device_entries:
                    device_entries[entry.device_id] = []
                device_entries[entry.device_id].append(entry)
        
        for device_id, entries in device_entries.items():
            sorted_entries = sorted(entries, key=lambda e: e.timestamp)
            latest_entry = sorted_entries[-1] if sorted_entries else None
            
            if latest_entry:
                if latest_entry.event_type == 'upgrade_success':
                    result["successes_in_batch"] += 1
                elif latest_entry.event_type in ['upgrade_failed', 'upgrade_rollback']:
                    result["failures_in_batch"] += 1
                elif latest_entry.event_type == 'upgrade_start':
                    result["in_progress"] += 1
        
        if result["failures_in_batch"] > batch.max_failures:
            result["can_proceed"] = False
            return False, f"批次失败数超过阈值: {result['failures_in_batch']} > {batch.max_failures}", result
        
        if previous_batch_results:
            if not previous_batch_results.get("can_proceed", False):
                result["can_proceed"] = False
                result["previous_batch_ok"] = False
                return False, "前一批次未通过检查", result
        
        return True, "批次状态正常，可以继续", result
    
    def get_rollback_candidates(
        self,
        devices: List[DeviceInfo],
        firmware: FirmwareManifest,
        telemetry_entries: List[TelemetryEntry]
    ) -> List[Dict[str, Any]]:
        candidates = []
        
        for device in devices:
            device_entries = [
                e for e in telemetry_entries 
                if e.device_id == device.device_id
            ]
            device_entries.sort(key=lambda e: e.timestamp)
            
            if not device_entries:
                continue
            
            latest = device_entries[-1]
            
            if latest.event_type == 'upgrade_failed':
                candidates.append({
                    "device_id": device.device_id,
                    "reason": "升级失败",
                    "current_version": device.current_firmware,
                    "target_version": firmware.version,
                    "rollback_version": firmware.rollback_version or device.current_firmware,
                    "failure_time": latest.timestamp,
                    "details": latest.details
                })
            
            elif latest.event_type == 'upgrade_success':
                for entry in reversed(device_entries):
                    if entry.event_type == 'telemetry_report':
                        if entry.details.get('crash_count', 0) > 0:
                            candidates.append({
                                "device_id": device.device_id,
                                "reason": "升级后崩溃",
                                "current_version": firmware.version,
                                "target_version": device.current_firmware,
                                "rollback_version": firmware.rollback_version or device.current_firmware,
                                "crash_count": entry.details.get('crash_count', 0),
                                "report_time": entry.timestamp,
                                "details": entry.details
                            })
                            break
        
        return candidates
