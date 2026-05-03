#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from collections import defaultdict

from .models import (
    Antenna, Pass, Maintenance, MissionPriority,
    Issue, IssueType, IssueSeverity, 
    ScheduledPass, ScheduleValidationResult
)


class SchedulePlanner:
    def __init__(self):
        pass
    
    def plan(self, 
             result: ScheduleValidationResult) -> List[ScheduledPass]:
        
        scheduled_passes = []
        all_passes = list(result.passes.values())
        
        all_passes.sort(key=lambda x: (x.priority_level, x.start_time))
        
        antenna_schedule: Dict[str, List[ScheduledPass]] = defaultdict(list)
        
        for pass_obj in all_passes:
            scheduled_pass = self._try_schedule_pass(
                pass_obj, result, antenna_schedule
            )
            antenna_schedule[pass_obj.antenna_id].append(scheduled_pass)
            scheduled_passes.append(scheduled_pass)
        
        self._update_conflict_info(scheduled_passes, result)
        
        result.scheduled_passes = scheduled_passes
        return scheduled_passes
    
    def _try_schedule_pass(self,
                           pass_obj: Pass,
                           result: ScheduleValidationResult,
                           antenna_schedule: Dict[str, List[ScheduledPass]]) -> ScheduledPass:
        
        status = "SCHEDULED"
        is_preempted = False
        preempted_by = ""
        conflicts_with = []
        notes = []
        
        for maintenance in result.maintenances.values():
            if maintenance.overlaps_with_pass(pass_obj):
                status = "CONFLICT_MAINTENANCE"
                notes.append(f"与维护计划 {maintenance.maintenance_id} 冲突")
                break
        
        antenna = result.antennas.get(pass_obj.antenna_id)
        if antenna:
            start_visible = antenna.can_see(pass_obj.azimuth_start, pass_obj.elevation_start)
            end_visible = antenna.can_see(pass_obj.azimuth_end, pass_obj.elevation_end)
            if not start_visible or not end_visible:
                status = "CONFLICT_VISIBILITY"
                notes.append("超出天线可视范围")
        
        existing_passes = antenna_schedule.get(pass_obj.antenna_id, [])
        for scheduled in existing_passes:
            if pass_obj.overlaps_with(scheduled.pass_obj):
                conflicts_with.append(scheduled.pass_obj.pass_id)
                
                if pass_obj.priority_level < scheduled.pass_obj.priority_level:
                    if pass_obj.can_preempt:
                        scheduled.status = "PREEMPTED"
                        scheduled.is_preempted = True
                        scheduled.preempted_by = pass_obj.pass_id
                        scheduled.notes.append(f"被高优先级任务 {pass_obj.pass_id} 抢占")
                        notes.append(f"将抢占低优先级任务 {scheduled.pass_obj.pass_id}")
                elif pass_obj.priority_level > scheduled.pass_obj.priority_level:
                    if scheduled.pass_obj.can_preempt:
                        status = "PREEMPTED"
                        is_preempted = True
                        preempted_by = scheduled.pass_obj.pass_id
                        notes.append(f"将被高优先级任务 {scheduled.pass_obj.pass_id} 抢占")
                else:
                    status = "CONFLICT_SAME_PRIORITY"
                    notes.append(f"与同优先级任务 {scheduled.pass_obj.pass_id} 冲突，需要手动决策")
        
        if status == "SCHEDULED" and antenna:
            for scheduled in existing_passes:
                if scheduled.status not in ["PREEMPTED", "CONFLICT_MAINTENANCE", "CONFLICT_VISIBILITY"]:
                    gap_minutes = (pass_obj.start_time - scheduled.pass_obj.end_time).total_seconds() / 60
                    
                    if gap_minutes > 0:
                        slew_time = antenna.calculate_slew_time(
                            scheduled.pass_obj.azimuth_end, scheduled.pass_obj.elevation_end,
                            pass_obj.azimuth_start, pass_obj.elevation_start
                        )
                        slew_minutes = slew_time.total_seconds() / 60
                        cooldown_minutes = antenna.cooldown_minutes
                        required_gap = max(slew_minutes, cooldown_minutes)
                        
                        if gap_minutes < required_gap:
                            status = "CONFLICT_TIMING"
                            notes.append(f"与前序任务 {scheduled.pass_obj.pass_id} 的时间间隔不足，需要至少 {required_gap:.1f} 分钟")
                            break
        
        return ScheduledPass(
            pass_obj=pass_obj,
            status=status,
            conflicts_with=conflicts_with,
            is_preempted=is_preempted,
            preempted_by=preempted_by,
            notes="; ".join(notes) if notes else ""
        )
    
    def _update_conflict_info(self, 
                               scheduled_passes: List[ScheduledPass],
                               result: ScheduleValidationResult):
        for scheduled in scheduled_passes:
            for other in scheduled_passes:
                if scheduled == other:
                    continue
                if scheduled.pass_obj.antenna_id != other.pass_obj.antenna_id:
                    continue
                if scheduled.pass_obj.overlaps_with(other.pass_obj):
                    if other.pass_obj.pass_id not in scheduled.conflicts_with:
                        scheduled.conflicts_with.append(other.pass_obj.pass_id)
    
    def get_executable_passes(self, 
                               scheduled_passes: List[ScheduledPass]) -> List[ScheduledPass]:
        return [sp for sp in scheduled_passes if sp.status == "SCHEDULED"]
    
    def get_conflicted_passes(self, 
                               scheduled_passes: List[ScheduledPass]) -> List[ScheduledPass]:
        return [sp for sp in scheduled_passes if sp.status != "SCHEDULED"]
    
    def group_passes_by_antenna(self, 
                                 scheduled_passes: List[ScheduledPass]) -> Dict[str, List[ScheduledPass]]:
        result = defaultdict(list)
        for sp in scheduled_passes:
            result[sp.pass_obj.antenna_id].append(sp)
        
        for antenna_id in result:
            result[antenna_id].sort(key=lambda x: x.pass_obj.start_time)
        
        return dict(result)
    
    def group_passes_by_satellite(self, 
                                   scheduled_passes: List[ScheduledPass]) -> Dict[str, List[ScheduledPass]]:
        result = defaultdict(list)
        for sp in scheduled_passes:
            result[sp.pass_obj.satellite_name].append(sp)
        
        for sat_name in result:
            result[sat_name].sort(key=lambda x: x.pass_obj.start_time)
        
        return dict(result)
    
    def analyze_timeline(self, 
                         scheduled_passes: List[ScheduledPass]) -> Dict[str, any]:
        if not scheduled_passes:
            return {
                'start_time': None,
                'end_time': None,
                'total_duration_hours': 0,
                'total_passes': 0,
                'executable_passes': 0,
                'conflicted_passes': 0
            }
        
        all_passes = [sp.pass_obj for sp in scheduled_passes]
        start_time = min(p.start_time for p in all_passes)
        end_time = max(p.end_time for p in all_passes)
        
        executable = self.get_executable_passes(scheduled_passes)
        conflicted = self.get_conflicted_passes(scheduled_passes)
        
        return {
            'start_time': start_time,
            'end_time': end_time,
            'total_duration_hours': (end_time - start_time).total_seconds() / 3600,
            'total_passes': len(scheduled_passes),
            'executable_passes': len(executable),
            'conflicted_passes': len(conflicted),
            'pass_status_summary': self._get_status_summary(scheduled_passes)
        }
    
    def _get_status_summary(self, scheduled_passes: List[ScheduledPass]) -> Dict[str, int]:
        summary = defaultdict(int)
        for sp in scheduled_passes:
            summary[sp.status] += 1
        return dict(summary)
