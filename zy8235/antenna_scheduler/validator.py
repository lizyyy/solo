#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import yaml
import json
import csv
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
from pathlib import Path

from .models import (
    Antenna, Pass, Maintenance, MissionPriority,
    Issue, IssueType, IssueSeverity, ScheduleValidationResult
)


class DataLoader:
    def __init__(self):
        pass
    
    @staticmethod
    def parse_datetime(dt_str: str) -> datetime:
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d %H:%M',
            '%Y/%m/%d %H:%M:%S',
            '%Y/%m/%d %H:%M',
        ]
        for fmt in formats:
            try:
                return datetime.strptime(dt_str, fmt)
            except ValueError:
                continue
        raise ValueError(f"无法解析时间格式: {dt_str}")
    
    def load_antenna_config(self, file_path: str) -> Dict[str, Antenna]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"天线配置文件不存在: {file_path}")
        
        with open(path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        antennas = {}
        for ant_data in data.get('antennas', []):
            antenna = Antenna(
                id=ant_data['id'],
                name=ant_data.get('name', ant_data['id']),
                azimuth_min=float(ant_data['azimuth_min']),
                azimuth_max=float(ant_data['azimuth_max']),
                elevation_min=float(ant_data['elevation_min']),
                elevation_max=float(ant_data['elevation_max']),
                slew_rate=float(ant_data['slew_rate']),
                cooldown_minutes=int(ant_data['cooldown_minutes'])
            )
            antennas[antenna.id] = antenna
        
        return antennas
    
    def load_passes(self, file_path: str, 
                    priorities: Dict[str, MissionPriority]) -> Dict[str, Pass]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"过境数据文件不存在: {file_path}")
        
        passes = {}
        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                pass_id = row['pass_id']
                mission_type = row['mission_type']
                
                priority = priorities.get(mission_type)
                priority_level = priority.priority_level if priority else 999
                can_preempt = priority.can_preempt if priority else False
                
                pass_obj = Pass(
                    pass_id=pass_id,
                    satellite_name=row['satellite_name'],
                    antenna_id=row['antenna_id'],
                    start_time=self.parse_datetime(row['start_time']),
                    end_time=self.parse_datetime(row['end_time']),
                    azimuth_start=float(row['azimuth_start']),
                    elevation_start=float(row['elevation_start']),
                    azimuth_end=float(row['azimuth_end']),
                    elevation_end=float(row['elevation_end']),
                    mission_type=mission_type,
                    priority_level=priority_level,
                    can_preempt=can_preempt
                )
                passes[pass_id] = pass_obj
        
        return passes
    
    def load_priorities(self, file_path: str) -> Dict[str, MissionPriority]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"任务优先级文件不存在: {file_path}")
        
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        priorities = {}
        for p_data in data.get('priorities', []):
            priority = MissionPriority(
                mission_type=p_data['mission_type'],
                priority_level=int(p_data['priority_level']),
                can_preempt=bool(p_data['can_preempt']),
                description=p_data.get('description', '')
            )
            priorities[priority.mission_type] = priority
        
        return priorities
    
    def load_maintenance(self, file_path: str) -> Dict[str, Maintenance]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"维护计划文件不存在: {file_path}")
        
        maintenances = {}
        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                maintenance = Maintenance(
                    maintenance_id=row['maintenance_id'],
                    antenna_id=row['antenna_id'],
                    start_time=self.parse_datetime(row['start_time']),
                    end_time=self.parse_datetime(row['end_time']),
                    reason=row['reason']
                )
                maintenances[maintenance.maintenance_id] = maintenance
        
        return maintenances
    
    def load_all(self, 
                 antenna_path: str,
                 passes_path: str,
                 priority_path: str,
                 maintenance_path: str) -> Tuple[
                     Dict[str, Antenna], 
                     Dict[str, Pass], 
                     Dict[str, MissionPriority], 
                     Dict[str, Maintenance]
                 ]:
        
        priorities = self.load_priorities(priority_path)
        antennas = self.load_antenna_config(antenna_path)
        passes = self.load_passes(passes_path, priorities)
        maintenances = self.load_maintenance(maintenance_path)
        
        return antennas, passes, priorities, maintenances


class ScheduleValidator:
    def __init__(self):
        self.result = ScheduleValidationResult()
    
    def validate(self,
                 antennas: Dict[str, Antenna],
                 passes: Dict[str, Pass],
                 priorities: Dict[str, MissionPriority],
                 maintenances: Dict[str, Maintenance]) -> ScheduleValidationResult:
        
        self.result = ScheduleValidationResult()
        self.result.antennas = antennas
        self.result.passes = passes
        self.result.maintenances = maintenances
        self.result.priorities = priorities
        
        self._validate_visibility()
        self._validate_time_overlaps()
        self._validate_maintenance_conflicts()
        self._validate_cooldown_and_slew()
        self._validate_priority_preemption()
        self._validate_same_satellite_consecutive()
        
        return self.result
    
    def _validate_visibility(self):
        for pass_id, pass_obj in self.result.passes.items():
            antenna = self.result.antennas.get(pass_obj.antenna_id)
            if not antenna:
                continue
            
            start_visible = antenna.can_see(
                pass_obj.azimuth_start, 
                pass_obj.elevation_start
            )
            end_visible = antenna.can_see(
                pass_obj.azimuth_end, 
                pass_obj.elevation_end
            )
            
            if not start_visible or not end_visible:
                details = {
                    'start_azimuth': pass_obj.azimuth_start,
                    'start_elevation': pass_obj.elevation_start,
                    'end_azimuth': pass_obj.azimuth_end,
                    'end_elevation': pass_obj.elevation_end,
                    'antenna_azimuth_range': (antenna.azimuth_min, antenna.azimuth_max),
                    'antenna_elevation_range': (antenna.elevation_min, antenna.elevation_max)
                }
                
                issue = Issue(
                    issue_type=IssueType.VISIBILITY_VIOLATION,
                    severity=IssueSeverity.CRITICAL,
                    message=f"过境 {pass_id} 的起始或结束位置超出天线 {pass_obj.antenna_id} 的可视范围",
                    pass_ids=[pass_id],
                    antenna_id=pass_obj.antenna_id,
                    details=details,
                    suggestion="请检查该卫星过境的角度是否在天线的有效范围内，或考虑调整天线指向"
                )
                self.result.add_issue(issue)
    
    def _validate_time_overlaps(self):
        passes_list = list(self.result.passes.values())
        
        for antenna_id in self.result.antennas.keys():
            antenna_passes = [p for p in passes_list if p.antenna_id == antenna_id]
            antenna_passes.sort(key=lambda x: x.start_time)
            
            for i, pass1 in enumerate(antenna_passes):
                for pass2 in antenna_passes[i+1:]:
                    if pass1.overlaps_with(pass2):
                        overlap_duration = pass1.get_overlap_duration(pass2)
                        
                        details = {
                            'pass1_start': pass1.start_time.isoformat(),
                            'pass1_end': pass1.end_time.isoformat(),
                            'pass2_start': pass2.start_time.isoformat(),
                            'pass2_end': pass2.end_time.isoformat(),
                            'overlap_duration_minutes': overlap_duration.total_seconds() / 60
                        }
                        
                        severity = IssueSeverity.HIGH
                        if overlap_duration > timedelta(minutes=5):
                            severity = IssueSeverity.CRITICAL
                        
                        issue = Issue(
                            issue_type=IssueType.TIME_OVERLAP,
                            severity=severity,
                            message=f"过境 {pass1.pass_id} 与 {pass2.pass_id} 在天线 {antenna_id} 上时间重叠，重叠 {overlap_duration.total_seconds()/60:.1f} 分钟",
                            pass_ids=[pass1.pass_id, pass2.pass_id],
                            antenna_id=antenna_id,
                            details=details,
                            suggestion="请根据任务优先级决定执行哪个过境，或考虑将其中一个任务分配到其他天线"
                        )
                        self.result.add_issue(issue)
    
    def _validate_maintenance_conflicts(self):
        for maintenance in self.result.maintenances.values():
            for pass_obj in self.result.passes.values():
                if pass_obj.antenna_id != maintenance.antenna_id:
                    continue
                
                if maintenance.overlaps_with_pass(pass_obj):
                    overlap_duration = maintenance.get_overlap_duration(pass_obj)
                    
                    details = {
                        'maintenance_id': maintenance.maintenance_id,
                        'maintenance_start': maintenance.start_time.isoformat(),
                        'maintenance_end': maintenance.end_time.isoformat(),
                        'maintenance_reason': maintenance.reason,
                        'pass_start': pass_obj.start_time.isoformat(),
                        'pass_end': pass_obj.end_time.isoformat(),
                        'overlap_duration_minutes': overlap_duration.total_seconds() / 60
                    }
                    
                    issue = Issue(
                        issue_type=IssueType.MAINTENANCE_CONFLICT,
                        severity=IssueSeverity.CRITICAL,
                        message=f"过境 {pass_obj.pass_id} 与天线 {pass_obj.antenna_id} 的维护计划 {maintenance.maintenance_id} 冲突",
                        pass_ids=[pass_obj.pass_id],
                        antenna_id=pass_obj.antenna_id,
                        details=details,
                        suggestion=f"该过境发生在天线维护期间（{maintenance.reason}），需要推迟或取消此过境任务"
                    )
                    self.result.add_issue(issue)
    
    def _validate_cooldown_and_slew(self):
        passes_list = list(self.result.passes.values())
        
        for antenna_id in self.result.antennas.keys():
            antenna = self.result.antennas.get(antenna_id)
            if not antenna:
                continue
            
            antenna_passes = [p for p in passes_list if p.antenna_id == antenna_id]
            antenna_passes.sort(key=lambda x: x.start_time)
            
            for i in range(len(antenna_passes) - 1):
                pass1 = antenna_passes[i]
                pass2 = antenna_passes[i + 1]
                
                if pass1.overlaps_with(pass2):
                    continue
                
                gap_minutes = (pass2.start_time - pass1.end_time).total_seconds() / 60
                
                slew_time = antenna.calculate_slew_time(
                    pass1.azimuth_end, pass1.elevation_end,
                    pass2.azimuth_start, pass2.elevation_start
                )
                slew_minutes = slew_time.total_seconds() / 60
                
                cooldown_minutes = antenna.cooldown_minutes
                
                required_gap = max(slew_minutes, cooldown_minutes)
                
                if gap_minutes < required_gap:
                    details = {
                        'pass1_end': pass1.end_time.isoformat(),
                        'pass2_start': pass2.start_time.isoformat(),
                        'actual_gap_minutes': gap_minutes,
                        'required_slew_minutes': slew_minutes,
                        'required_cooldown_minutes': cooldown_minutes,
                        'total_required_minutes': required_gap
                    }
                    
                    if gap_minutes < min(slew_minutes, cooldown_minutes):
                        severity = IssueSeverity.HIGH
                    else:
                        severity = IssueSeverity.MEDIUM
                    
                    if gap_minutes < slew_minutes:
                        issue_type = IssueType.SLEW_TIME_VIOLATION
                        message = f"过境 {pass1.pass_id} 到 {pass2.pass_id} 的天线转向时间不足，需要 {slew_minutes:.1f} 分钟，实际只有 {gap_minutes:.1f} 分钟"
                    else:
                        issue_type = IssueType.COOLDOWN_VIOLATION
                        message = f"过境 {pass1.pass_id} 到 {pass2.pass_id} 的天线冷却时间不足，需要 {cooldown_minutes} 分钟，实际只有 {gap_minutes:.1f} 分钟"
                    
                    issue = Issue(
                        issue_type=issue_type,
                        severity=severity,
                        message=message,
                        pass_ids=[pass1.pass_id, pass2.pass_id],
                        antenna_id=antenna_id,
                        details=details,
                        suggestion=f"需要增加两次过境之间的间隔到至少 {required_gap:.1f} 分钟"
                    )
                    self.result.add_issue(issue)
    
    def _validate_priority_preemption(self):
        passes_list = list(self.result.passes.values())
        
        for antenna_id in self.result.antennas.keys():
            antenna_passes = [p for p in passes_list if p.antenna_id == antenna_id]
            
            for i, pass1 in enumerate(antenna_passes):
                for j, pass2 in enumerate(antenna_passes):
                    if i >= j:
                        continue
                    
                    if not pass1.overlaps_with(pass2):
                        continue
                    
                    p1_priority = pass1.priority_level
                    p2_priority = pass2.priority_level
                    
                    if p1_priority < p2_priority and pass1.can_preempt:
                        self._add_preemption_issue(pass1, pass2, antenna_id)
                    elif p2_priority < p1_priority and pass2.can_preempt:
                        self._add_preemption_issue(pass2, pass1, antenna_id)
                    elif p1_priority == p2_priority:
                        details = {
                            'pass1_priority': p1_priority,
                            'pass2_priority': p2_priority,
                            'pass1_can_preempt': pass1.can_preempt,
                            'pass2_can_preempt': pass2.can_preempt
                        }
                        
                        issue = Issue(
                            issue_type=IssueType.PRIORITY_PREEMPTION,
                            severity=IssueSeverity.MEDIUM,
                            message=f"过境 {pass1.pass_id} 与 {pass2.pass_id} 优先级相同且重叠，需要手动决策",
                            pass_ids=[pass1.pass_id, pass2.pass_id],
                            antenna_id=antenna_id,
                            details=details,
                            suggestion="两个任务优先级相同，需要手动决定执行哪个，或考虑分配到不同天线"
                        )
                        self.result.add_issue(issue)
    
    def _add_preemption_issue(self, preemptor: Pass, preemptee: Pass, antenna_id: str):
        overlap_duration = preemptor.get_overlap_duration(preemptee)
        
        details = {
            'preemptor_id': preemptor.pass_id,
            'preemptor_priority': preemptor.priority_level,
            'preemptor_mission': preemptor.mission_type,
            'preemptee_id': preemptee.pass_id,
            'preemptee_priority': preemptee.priority_level,
            'preemptee_mission': preemptee.mission_type,
            'overlap_duration_minutes': overlap_duration.total_seconds() / 60
        }
        
        issue = Issue(
            issue_type=IssueType.PRIORITY_PREEMPTION,
            severity=IssueSeverity.HIGH,
            message=f"高优先级任务 {preemptor.pass_id} ({preemptor.mission_type}) 将抢占低优先级任务 {preemptee.pass_id} ({preemptee.mission_type})",
            pass_ids=[preemptor.pass_id, preemptee.pass_id],
            antenna_id=antenna_id,
            details=details,
            suggestion=f"任务 {preemptee.pass_id} 将被抢占，需要确认是否可以接受，或考虑将 {preemptee.pass_id} 分配到其他天线"
        )
        self.result.add_issue(issue)
    
    def _validate_same_satellite_consecutive(self):
        satellites = {}
        for pass_obj in self.result.passes.values():
            sat_name = pass_obj.satellite_name
            if sat_name not in satellites:
                satellites[sat_name] = []
            satellites[sat_name].append(pass_obj)
        
        for sat_name, sat_passes in satellites.items():
            sat_passes.sort(key=lambda x: x.start_time)
            
            for i in range(len(sat_passes) - 1):
                pass1 = sat_passes[i]
                pass2 = sat_passes[i + 1]
                
                same_antenna = pass1.antenna_id == pass2.antenna_id
                
                if same_antenna:
                    gap_hours = (pass2.start_time - pass1.end_time).total_seconds() / 3600
                    
                    if gap_hours < 1:
                        details = {
                            'pass1_id': pass1.pass_id,
                            'pass2_id': pass2.pass_id,
                            'antenna_id': pass1.antenna_id,
                            'gap_hours': gap_hours,
                            'pass1_mission': pass1.mission_type,
                            'pass2_mission': pass2.mission_type
                        }
                        
                        issue = Issue(
                            issue_type=IssueType.SAME_SATELLITE_CONSECUTIVE,
                            severity=IssueSeverity.LOW,
                            message=f"卫星 {sat_name} 在同一天线 {pass1.antenna_id} 上连续安排了两次过境，间隔仅 {gap_hours:.2f} 小时",
                            pass_ids=[pass1.pass_id, pass2.pass_id],
                            antenna_id=pass1.antenna_id,
                            details=details,
                            suggestion="同一卫星连续过境可能导致资源浪费，请评估是否可以合并或重新分配"
                        )
                        self.result.add_issue(issue)
