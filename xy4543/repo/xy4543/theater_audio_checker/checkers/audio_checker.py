import os
import uuid
from datetime import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from collections import defaultdict

from theater_audio_checker.models import (
    AudioItem,
    ZoneSchedule,
    DeviceLog,
    ReviewNote,
    CheckIssue,
    CheckResult,
    CheckSeverity,
    AudioType,
    ZoneStatus
)


class AudioChecker:
    """音频系统综合检查器"""

    def __init__(
        self,
        audio_items: List[AudioItem],
        zone_schedules: List[ZoneSchedule],
        device_logs: List[DeviceLog],
        review_notes: List[ReviewNote],
        target_date: Optional[str] = None
    ):
        self.audio_items = audio_items
        self.zone_schedules = zone_schedules
        self.device_logs = device_logs
        self.review_notes = review_notes
        self.target_date = target_date
        
        self.audio_by_id: Dict[str, AudioItem] = {a.audio_id: a for a in audio_items}
        self.issues: List[CheckIssue] = []
        
        self.pass_count = 0
        self.fail_count = 0
        self.warning_count = 0
        self.needs_review_count = 0

    def _create_issue(
        self,
        check_type: str,
        severity: CheckSeverity,
        message: str,
        affected_item: Optional[str] = None,
        affected_item_name: Optional[str] = None,
        details: Optional[Dict] = None
    ) -> CheckIssue:
        """创建检查问题"""
        issue = CheckIssue(
            issue_id=str(uuid.uuid4()),
            check_type=check_type,
            severity=severity,
            message=message,
            affected_item=affected_item,
            affected_item_name=affected_item_name,
            details=details or {}
        )
        self.issues.append(issue)
        
        if severity == CheckSeverity.CRITICAL:
            self.fail_count += 1
        elif severity == CheckSeverity.WARNING:
            self.warning_count += 1
        
        return issue

    def check_loudness(self) -> List[CheckIssue]:
        """检查响度是否达标"""
        check_type = "loudness_check"
        issues_count = 0
        
        for audio in self.audio_items:
            if not audio.is_loudness_ok:
                details = {
                    "current_loudness": audio.loudness_dbfs,
                    "target_min": audio.target_loudness_min,
                    "target_max": audio.target_loudness_max,
                    "deviation": min(
                        abs(audio.loudness_dbfs - audio.target_loudness_min),
                        abs(audio.loudness_dbfs - audio.target_loudness_max)
                    )
                }
                
                if abs(audio.loudness_dbfs) > 10:
                    severity = CheckSeverity.CRITICAL
                else:
                    severity = CheckSeverity.WARNING
                
                self._create_issue(
                    check_type=check_type,
                    severity=severity,
                    message=f"音频响度不达标: {audio.name} ({audio.audio_id})",
                    affected_item=audio.audio_id,
                    affected_item_name=audio.name,
                    details=details
                )
                issues_count += 1
        
        ok_count = len(self.audio_items) - issues_count
        self.pass_count += ok_count
        
        return [i for i in self.issues if i.check_type == check_type]

    @staticmethod
    def _time_overlap(start1: time, end1: time, start2: time, end2: time) -> bool:
        """检查两个时间段是否有重叠"""
        return start1 < end2 and start2 < end1

    def check_time_conflicts(self) -> List[CheckIssue]:
        """检查时段冲突"""
        check_type = "time_conflict_check"
        issues_count = 0
        
        schedules_by_zone: Dict[str, List[ZoneSchedule]] = defaultdict(list)
        for schedule in self.zone_schedules:
            schedules_by_zone[schedule.zone_name].append(schedule)
        
        for zone_name, schedules in schedules_by_zone.items():
            schedules_sorted = sorted(schedules, key=lambda x: x.start_time)
            
            for i, sched1 in enumerate(schedules_sorted):
                for sched2 in schedules_sorted[i+1:]:
                    if self._time_overlap(
                        sched1.start_time, sched1.end_time,
                        sched2.start_time, sched2.end_time
                    ):
                        audio1 = self.audio_by_id.get(sched1.audio_id)
                        audio2 = self.audio_by_id.get(sched2.audio_id)
                        
                        details = {
                            "zone": zone_name,
                            "schedule1": {
                                "id": sched1.schedule_id,
                                "audio_id": sched1.audio_id,
                                "audio_name": audio1.name if audio1 else "未知",
                                "start": str(sched1.start_time),
                                "end": str(sched1.end_time)
                            },
                            "schedule2": {
                                "id": sched2.schedule_id,
                                "audio_id": sched2.audio_id,
                                "audio_name": audio2.name if audio2 else "未知",
                                "start": str(sched2.start_time),
                                "end": str(sched2.end_time)
                            }
                        }
                        
                        self._create_issue(
                            check_type=check_type,
                            severity=CheckSeverity.CRITICAL,
                            message=f"分区 [{zone_name}] 时段冲突: {sched1.schedule_id} 与 {sched2.schedule_id}",
                            affected_item=sched1.schedule_id,
                            affected_item_name=f"{zone_name} - {audio1.name if audio1 else '未知'}",
                            details=details
                        )
                        issues_count += 1
        
        return [i for i in self.issues if i.check_type == check_type]

    def check_emergency_broadcast_occupied(self) -> List[CheckIssue]:
        """检查应急广播是否被占用"""
        check_type = "emergency_broadcast_check"
        issues_count = 0
        
        evacuation_audio_ids = {
            a.audio_id for a in self.audio_items 
            if a.audio_type == AudioType.EVACUATION
        }
        
        for schedule in self.zone_schedules:
            if schedule.audio_id in evacuation_audio_ids:
                audio = self.audio_by_id.get(schedule.audio_id)
                
                details = {
                    "zone": schedule.zone_name,
                    "schedule_id": schedule.schedule_id,
                    "audio_id": schedule.audio_id,
                    "audio_name": audio.name if audio else "未知",
                    "start_time": str(schedule.start_time),
                    "end_time": str(schedule.end_time),
                    "is_override": schedule.is_override
                }
                
                self._create_issue(
                    check_type=check_type,
                    severity=CheckSeverity.CRITICAL,
                    message=f"应急广播被占用: 分区 [{schedule.zone_name}] 在 {schedule.start_time} - {schedule.end_time}",
                    affected_item=schedule.schedule_id,
                    affected_item_name=f"{schedule.zone_name} - 应急广播",
                    details=details
                )
                issues_count += 1
        
        return [i for i in self.issues if i.check_type == check_type]

    def check_missing_files(self) -> List[CheckIssue]:
        """检查缺失文件"""
        check_type = "missing_file_check"
        issues_count = 0
        
        for audio in self.audio_items:
            file_path = Path(audio.file_path)
            
            if not file_path.is_absolute():
                pass
            
            if not os.path.exists(audio.file_path):
                details = {
                    "file_path": audio.file_path,
                    "audio_id": audio.audio_id,
                    "audio_type": audio.audio_type.value
                }
                
                self._create_issue(
                    check_type=check_type,
                    severity=CheckSeverity.CRITICAL,
                    message=f"音频文件缺失: {audio.name} ({audio.audio_id})",
                    affected_item=audio.audio_id,
                    affected_item_name=audio.name,
                    details=details
                )
                issues_count += 1
        
        ok_count = len(self.audio_items) - issues_count
        self.pass_count += ok_count
        
        return [i for i in self.issues if i.check_type == check_type]

    def check_duplicate_files(self) -> List[CheckIssue]:
        """检查重复文件"""
        check_type = "duplicate_file_check"
        issues_count = 0
        
        file_path_map: Dict[str, List[AudioItem]] = defaultdict(list)
        for audio in self.audio_items:
            file_path_map[audio.file_path].append(audio)
        
        for file_path, audio_list in file_path_map.items():
            if len(audio_list) > 1:
                details = {
                    "file_path": file_path,
                    "audio_ids": [a.audio_id for a in audio_list],
                    "audio_names": [a.name for a in audio_list]
                }
                
                self._create_issue(
                    check_type=check_type,
                    severity=CheckSeverity.WARNING,
                    message=f"发现重复文件: {file_path} 被 {len(audio_list)} 个音频项引用",
                    affected_item=audio_list[0].audio_id,
                    affected_item_name=audio_list[0].name,
                    details=details
                )
                issues_count += 1
        
        return [i for i in self.issues if i.check_type == check_type]

    def check_device_status(self) -> List[CheckIssue]:
        """检查设备在线状态"""
        check_type = "device_status_check"
        issues_count = 0
        
        for device in self.device_logs:
            if device.status == ZoneStatus.OFFLINE:
                details = {
                    "device_id": device.device_id,
                    "zone": device.zone_name,
                    "check_time": str(device.check_time),
                    "last_online_time": str(device.last_online_time) if device.last_online_time else None,
                    "notes": device.notes
                }
                
                self._create_issue(
                    check_type=check_type,
                    severity=CheckSeverity.CRITICAL,
                    message=f"设备离线: [{device.zone_name}] - {device.device_name}",
                    affected_item=device.device_id,
                    affected_item_name=f"{device.zone_name} - {device.device_name}",
                    details=details
                )
                issues_count += 1
            elif device.status == ZoneStatus.MAINTENANCE:
                details = {
                    "device_id": device.device_id,
                    "zone": device.zone_name,
                    "check_time": str(device.check_time),
                    "notes": device.notes
                }
                
                self._create_issue(
                    check_type=check_type,
                    severity=CheckSeverity.WARNING,
                    message=f"设备维护中: [{device.zone_name}] - {device.device_name}",
                    affected_item=device.device_id,
                    affected_item_name=f"{device.zone_name} - {device.device_name}",
                    details=details
                )
                issues_count += 1
        
        ok_count = len(self.device_logs) - issues_count
        self.pass_count += ok_count
        
        return [i for i in self.issues if i.check_type == check_type]

    def check_schedule_audio_references(self) -> List[CheckIssue]:
        """检查播放计划引用的音频是否存在"""
        check_type = "audio_reference_check"
        issues_count = 0
        
        audio_ids = {a.audio_id for a in self.audio_items}
        
        for schedule in self.zone_schedules:
            if schedule.audio_id not in audio_ids:
                details = {
                    "schedule_id": schedule.schedule_id,
                    "zone": schedule.zone_name,
                    "missing_audio_id": schedule.audio_id,
                    "start_time": str(schedule.start_time),
                    "end_time": str(schedule.end_time)
                }
                
                self._create_issue(
                    check_type=check_type,
                    severity=CheckSeverity.CRITICAL,
                    message=f"播放计划引用不存在的音频: {schedule.schedule_id} - {schedule.audio_id}",
                    affected_item=schedule.schedule_id,
                    affected_item_name=f"{schedule.zone_name} - {schedule.schedule_id}",
                    details=details
                )
                issues_count += 1
        
        ok_count = len(self.zone_schedules) - issues_count
        self.pass_count += ok_count
        
        return [i for i in self.issues if i.check_type == check_type]

    def run_all_checks(self) -> CheckResult:
        """运行所有检查"""
        self.issues = []
        self.pass_count = 0
        self.fail_count = 0
        self.warning_count = 0
        
        self.check_loudness()
        self.check_time_conflicts()
        self.check_emergency_broadcast_occupied()
        self.check_missing_files()
        self.check_duplicate_files()
        self.check_device_status()
        self.check_schedule_audio_references()
        
        for note in self.review_notes:
            for issue in self.issues:
                if note.item_id == issue.issue_id or note.item_id == issue.affected_item:
                    issue.review_note_id = note.note_id
        
        check_id = str(uuid.uuid4())
        
        return CheckResult(
            check_id=check_id,
            target_date=self.target_date or "",
            total_audio_items=len(self.audio_items),
            total_schedules=len(self.zone_schedules),
            total_devices=len(self.device_logs),
            pass_count=self.pass_count,
            fail_count=self.fail_count,
            warning_count=self.warning_count,
            needs_review_count=self.needs_review_count,
            issues=self.issues
        )
