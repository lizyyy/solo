import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple, Callable
from dataclasses import dataclass, asdict
from collections import defaultdict

from .parser_validator import TelemetryEntry


@dataclass
class DeviceTimeline:
    device_id: str
    events: List[TelemetryEntry]
    current_state: str
    upgrade_path: List[Tuple[str, str, datetime]]
    
    def __init__(self, device_id: str):
        self.device_id = device_id
        self.events = []
        self.current_state = "unknown"
        self.upgrade_path = []


class TelemetryReplayError(Exception):
    pass


class TelemetryReplay:
    def __init__(self, telemetry_entries: List[TelemetryEntry]):
        self.entries = telemetry_entries
        self.device_timelines: Dict[str, DeviceTimeline] = {}
        self._build_timelines()
    
    def _build_timelines(self) -> None:
        device_events: Dict[str, List[TelemetryEntry]] = defaultdict(list)
        
        for entry in self.entries:
            device_events[entry.device_id].append(entry)
        
        for device_id, events in device_events.items():
            events.sort(key=lambda e: e.timestamp)
            timeline = DeviceTimeline(device_id)
            timeline.events = events
            
            if events:
                latest = events[-1]
                timeline.current_state = self._determine_state(events)
                
                upgrade_events = [
                    e for e in events 
                    if e.event_type in ['upgrade_start', 'upgrade_success', 'upgrade_failed', 'upgrade_rollback']
                ]
                for i in range(0, len(upgrade_events), 3):
                    if i + 1 < len(upgrade_events):
                        start = upgrade_events[i]
                        end = upgrade_events[i + 1]
                        from_ver = start.firmware_version
                        to_ver = end.firmware_version if end.event_type != 'upgrade_rollback' else from_ver
                        timeline.upgrade_path.append((from_ver, to_ver, end.timestamp))
            
            self.device_timelines[device_id] = timeline
    
    def _determine_state(self, events: List[TelemetryEntry]) -> str:
        if not events:
            return "unknown"
        
        latest = events[-1]
        
        if latest.event_type == 'upgrade_start':
            return "upgrading"
        elif latest.event_type == 'upgrade_success':
            return "upgrade_success"
        elif latest.event_type == 'upgrade_failed':
            return "upgrade_failed"
        elif latest.event_type == 'upgrade_rollback':
            return "rollback_complete"
        elif latest.event_type == 'telemetry_report':
            if latest.details.get('crash_count', 0) > 0:
                return "unstable"
            return "stable"
        else:
            return "idle"
    
    def get_device_timeline(self, device_id: str) -> Optional[DeviceTimeline]:
        return self.device_timelines.get(device_id)
    
    def get_all_devices_state(self) -> Dict[str, str]:
        return {
            device_id: timeline.current_state 
            for device_id, timeline in self.device_timelines.items()
        }
    
    def get_devices_by_state(self, state: str) -> List[str]:
        return [
            device_id 
            for device_id, timeline in self.device_timelines.items()
            if timeline.current_state == state
        ]
    
    def get_upgrade_statistics(self) -> Dict[str, Any]:
        stats = {
            "total_devices": len(self.device_timelines),
            "state_counts": defaultdict(int),
            "upgrade_success_count": 0,
            "upgrade_failed_count": 0,
            "rollback_count": 0,
            "devices_in_upgrade": [],
            "devices_failed": [],
            "devices_rolled_back": []
        }
        
        for device_id, timeline in self.device_timelines.items():
            stats["state_counts"][timeline.current_state] += 1
            
            if timeline.current_state == "upgrading":
                stats["devices_in_upgrade"].append(device_id)
            elif timeline.current_state == "upgrade_failed":
                stats["devices_failed"].append(device_id)
                stats["upgrade_failed_count"] += 1
            elif timeline.current_state == "upgrade_success":
                stats["upgrade_success_count"] += 1
            elif timeline.current_state == "rollback_complete":
                stats["devices_rolled_back"].append(device_id)
                stats["rollback_count"] += 1
        
        stats["state_counts"] = dict(stats["state_counts"])
        return stats
    
    def find_failed_upgrades(self) -> List[Dict[str, Any]]:
        failed = []
        
        for device_id, timeline in self.device_timelines.items():
            failed_events = [
                e for e in timeline.events 
                if e.event_type == 'upgrade_failed'
            ]
            
            for event in failed_events:
                failed.append({
                    "device_id": device_id,
                    "failed_version": event.firmware_version,
                    "failure_time": event.timestamp,
                    "failure_details": event.details,
                    "was_rolled_back": any(
                        e.event_type == 'upgrade_rollback' and e.timestamp > event.timestamp
                        for e in timeline.events
                    )
                })
        
        return failed
    
    def find_rollback_discrepancies(
        self,
        rollback_records: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        discrepancies = []
        
        for record in rollback_records:
            device_id = record["device_id"]
            rollback_time = datetime.fromisoformat(record["rollback_time"])
            expected_version = record["to_version"]
            
            timeline = self.device_timelines.get(device_id)
            if not timeline:
                discrepancies.append({
                    "device_id": device_id,
                    "rollback_id": record.get("rollback_id"),
                    "issue": "无遥测数据",
                    "details": f"回滚记录存在但设备 {device_id} 没有遥测数据"
                })
                continue
            
            post_rollback_events = [
                e for e in timeline.events 
                if e.timestamp > rollback_time
            ]
            
            if not post_rollback_events:
                discrepancies.append({
                    "device_id": device_id,
                    "rollback_id": record.get("rollback_id"),
                    "issue": "回滚后无遥测",
                    "details": f"回滚时间 {rollback_time} 后设备未上报任何数据"
                })
                continue
            
            latest_version = None
            for event in reversed(post_rollback_events):
                if event.firmware_version and event.firmware_version != "unknown":
                    latest_version = event.firmware_version
                    break
            
            if latest_version and latest_version != expected_version:
                discrepancies.append({
                    "device_id": device_id,
                    "rollback_id": record.get("rollback_id"),
                    "issue": "版本不匹配",
                    "details": f"遥测显示版本 {latest_version}, 预期回滚版本 {expected_version}"
                })
        
        return discrepancies
    
    def simulate_upgrade_flow(
        self,
        device_id: str,
        target_version: str,
        simulate_failure: bool = False,
        simulate_rollback: bool = False
    ) -> List[Dict[str, Any]]:
        timeline = self.device_timelines.get(device_id)
        if not timeline:
            current_version = "v1.0.0"
        else:
            current_version = timeline.events[-1].firmware_version if timeline.events else "v1.0.0"
        
        flow = []
        now = datetime.now()
        
        flow.append({
            "event_type": "upgrade_start",
            "device_id": device_id,
            "timestamp": now,
            "from_version": current_version,
            "to_version": target_version,
            "description": f"开始升级: {current_version} -> {target_version}"
        })
        
        if simulate_failure:
            flow.append({
                "event_type": "upgrade_failed",
                "device_id": device_id,
                "timestamp": now + timedelta(minutes=5),
                "from_version": current_version,
                "to_version": target_version,
                "error_code": "E_DOWNLOAD_FAIL",
                "error_message": "固件下载失败: 网络连接中断",
                "description": f"升级失败: 网络中断"
            })
            
            if simulate_rollback:
                flow.append({
                    "event_type": "upgrade_rollback",
                    "device_id": device_id,
                    "timestamp": now + timedelta(minutes=10),
                    "from_version": target_version,
                    "to_version": current_version,
                    "description": f"执行回滚: {target_version} -> {current_version}"
                })
                
                flow.append({
                    "event_type": "telemetry_report",
                    "device_id": device_id,
                    "timestamp": now + timedelta(minutes=15),
                    "firmware_version": current_version,
                    "details": {
                        "crash_count": 0,
                        "battery_level": 85,
                        "network_status": "connected"
                    },
                    "description": f"回滚后遥测确认: 版本 {current_version}"
                })
        else:
            flow.append({
                "event_type": "upgrade_success",
                "device_id": device_id,
                "timestamp": now + timedelta(minutes=5),
                "from_version": current_version,
                "to_version": target_version,
                "description": f"升级成功: {current_version} -> {target_version}"
            })
            
            flow.append({
                "event_type": "telemetry_report",
                "device_id": device_id,
                "timestamp": now + timedelta(minutes=10),
                "firmware_version": target_version,
                "details": {
                    "crash_count": 0,
                    "battery_level": 80,
                    "network_status": "connected"
                },
                "description": f"升级后遥测确认: 版本 {target_version}"
            })
        
        return flow
    
    def export_timeline_json(
        self,
        device_id: str,
        output_path: Path
    ) -> bool:
        timeline = self.device_timelines.get(device_id)
        if not timeline:
            return False
        
        data = {
            "device_id": device_id,
            "current_state": timeline.current_state,
            "upgrade_path": [
                {
                    "from": path[0],
                    "to": path[1],
                    "time": path[2].isoformat()
                }
                for path in timeline.upgrade_path
            ],
            "events": [
                {
                    "event_type": e.event_type,
                    "timestamp": e.timestamp.isoformat(),
                    "firmware_version": e.firmware_version,
                    "details": e.details
                }
                for e in timeline.events
            ]
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        return True
    
    def filter_events(
        self,
        event_types: Optional[List[str]] = None,
        device_ids: Optional[List[str]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> List[TelemetryEntry]:
        filtered = self.entries
        
        if event_types:
            filtered = [e for e in filtered if e.event_type in event_types]
        
        if device_ids:
            filtered = [e for e in filtered if e.device_id in device_ids]
        
        if start_time:
            filtered = [e for e in filtered if e.timestamp >= start_time]
        
        if end_time:
            filtered = [e for e in filtered if e.timestamp <= end_time]
        
        return filtered
    
    def get_time_range(self) -> Tuple[Optional[datetime], Optional[datetime]]:
        if not self.entries:
            return None, None
        
        timestamps = [e.timestamp for e in self.entries]
        return min(timestamps), max(timestamps)
