#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
时间线状态管理模块
处理演员换场时的频道占用问题和时间线冲突检测
"""

from datetime import time
from typing import List, Dict, Optional, Tuple, Set
from dataclasses import dataclass
from .models import (
    Microphone, ScheduleEntry, RiskItem, 
    RiskType, RiskLevel
)


@dataclass
class TimelineSlot:
    """时间槽"""
    start_time: time
    end_time: time
    scene_name: str
    active_mic_ids: List[str]
    
    def overlaps_with(self, other: "TimelineSlot") -> bool:
        """检查是否与另一个时间槽重叠"""
        return not (self.end_time <= other.start_time or 
                   other.end_time <= self.start_time)


class TimelineStateManager:
    """时间线状态管理器"""
    
    def __init__(self):
        self.transition_buffer_seconds = 30
    
    def get_scene_mics(
        self,
        schedule_entry: ScheduleEntry,
        all_mics: List[Microphone]
    ) -> List[Microphone]:
        """获取某个场景使用的所有麦克风"""
        mic_map = {m.id: m for m in all_mics}
        
        result = []
        for mic_id in schedule_entry.mic_ids:
            if mic_id in mic_map:
                result.append(mic_map[mic_id])
        
        if not result:
            actor_names_lower = [n.lower() for n in schedule_entry.actor_names]
            for mic in all_mics:
                if mic.actor_name.lower() in actor_names_lower:
                    result.append(mic)
        
        return result
    
    def create_timeline_slots(
        self,
        schedule: List[ScheduleEntry],
        mics: List[Microphone]
    ) -> List[TimelineSlot]:
        """从时间表创建时间槽列表"""
        slots = []
        
        for entry in schedule:
            if entry.start_time and entry.end_time:
                scene_mics = self.get_scene_mics(entry, mics)
                active_mic_ids = [m.id for m in scene_mics if not m.is_backup]
                
                slot = TimelineSlot(
                    start_time=entry.start_time,
                    end_time=entry.end_time,
                    scene_name=entry.scene_name,
                    active_mic_ids=active_mic_ids
                )
                slots.append(slot)
        
        return sorted(slots, key=lambda s: s.start_time)
    
    def check_overlapping_scenes(
        self,
        schedule: List[ScheduleEntry],
        mics: List[Microphone]
    ) -> List[RiskItem]:
        """检查重叠场景中的频率冲突"""
        risks = []
        slots = self.create_timeline_slots(schedule, mics)
        
        mic_map = {m.id: m for m in mics}
        
        for i, slot1 in enumerate(slots):
            for slot2 in slots[i+1:]:
                if slot1.overlaps_with(slot2):
                    common_mic_ids = set(slot1.active_mic_ids) & set(slot2.active_mic_ids)
                    
                    all_active_mics = set(slot1.active_mic_ids) | set(slot2.active_mic_ids)
                    
                    active_mic_list = [
                        mic_map[mid] for mid in all_active_mics 
                        if mid in mic_map and mic_map[mid].frequency > 0
                    ]
                    
                    for j, mic1 in enumerate(active_mic_list):
                        for mic2 in active_mic_list[j+1:]:
                            freq_diff = abs(mic1.frequency - mic2.frequency)
                            
                            if freq_diff < 0.3:
                                level = RiskLevel.CRITICAL if freq_diff < 0.1 else RiskLevel.HIGH
                                
                                risk = RiskItem(
                                    risk_type=RiskType.OVERLAP_CHANNEL,
                                    level=level,
                                    affected_mics=[mic1.id, mic2.id],
                                    affected_scene=f"{slot1.scene_name} / {slot2.scene_name}",
                                    start_time=slot1.start_time,
                                    end_time=slot1.end_time,
                                    description=(
                                        f"在重叠场景 '{slot1.scene_name}' 和 '{slot2.scene_name}' 中，"
                                        f"麦克风 '{mic1.actor_name}' ({mic1.frequency:.2f} MHz) 与 "
                                        f"'{mic2.actor_name}' ({mic2.frequency:.2f} MHz) 频率间隔仅 "
                                        f"{freq_diff:.2f} MHz"
                                    ),
                                    suggestion=(
                                        f"建议调整至少一个麦克风的频率，确保重叠场景中所有麦克风频率间隔 >= 0.3 MHz"
                                    )
                                )
                                risks.append(risk)
                        
                        if common_mic_ids:
                            for mid in common_mic_ids:
                                mic = mic_map.get(mid)
                                if mic:
                                    risk = RiskItem(
                                        risk_type=RiskType.OVERLAP_CHANNEL,
                                        level=RiskLevel.HIGH,
                                        affected_mics=[mid],
                                        affected_scene=f"{slot1.scene_name} / {slot2.scene_name}",
                                        start_time=slot1.start_time,
                                        end_time=slot1.end_time,
                                        description=(
                                            f"麦克风 '{mic.actor_name}' 同时出现在重叠场景 "
                                            f"'{slot1.scene_name}' 和 '{slot2.scene_name}' 中"
                                        ),
                                        suggestion=(
                                            f"检查演员走位时间表，确认是否需要为该演员在不同场景分配不同麦克风，"
                                            f"或调整场景时间避免重叠"
                                        )
                                    )
                                    risks.append(risk)
        
        return risks
    
    def check_transition_conflicts(
        self,
        schedule: List[ScheduleEntry],
        mics: List[Microphone]
    ) -> List[RiskItem]:
        """检查换场时的频道占用冲突"""
        risks = []
        
        if len(schedule) < 2:
            return risks
        
        sorted_schedule = sorted(
            [s for s in schedule if s.start_time and s.end_time],
            key=lambda x: x.start_time
        )
        
        mic_map = {m.id: m for m in mics}
        
        for i in range(len(sorted_schedule) - 1):
            current_scene = sorted_schedule[i]
            next_scene = sorted_schedule[i + 1]
            
            current_mics = self.get_scene_mics(current_scene, mics)
            next_mics = self.get_scene_mics(next_scene, mics)
            
            current_mic_ids = {m.id for m in current_mics if not m.is_backup}
            next_mic_ids = {m.id for m in next_mics if not m.is_backup}
            
            continuing_mics = current_mic_ids & next_mic_ids
            leaving_mics = current_mic_ids - next_mic_ids
            new_mics = next_mic_ids - current_mic_ids
            
            current_freqs = {mic_map[mid].frequency for mid in current_mic_ids if mid in mic_map}
            next_freqs = {mic_map[mid].frequency for mid in next_mic_ids if mid in mic_map}
            
            freq_conflicts = current_freqs & next_freqs
            
            for freq in freq_conflicts:
                if freq == 0:
                    continue
                
                conflict_current = [
                    mic_map[mid] for mid in current_mic_ids 
                    if mid in mic_map and mic_map[mid].frequency == freq
                ]
                conflict_next = [
                    mic_map[mid] for mid in next_mic_ids 
                    if mid in mic_map and mic_map[mid].frequency == freq
                ]
                
                all_conflict = conflict_current + conflict_next
                unique_mics = {m.id: m for m in all_conflict}.values()
                
                if len(unique_mics) > 1:
                    mic_names = [m.actor_name for m in unique_mics]
                    
                    risk = RiskItem(
                        risk_type=RiskType.OVERLAP_CHANNEL,
                        level=RiskLevel.HIGH,
                        affected_mics=[m.id for m in unique_mics],
                        affected_scene=f"{current_scene.scene_name} -> {next_scene.scene_name}",
                        start_time=current_scene.end_time,
                        end_time=next_scene.start_time,
                        description=(
                            f"换场期间频率冲突：场景 '{current_scene.scene_name}' 结束后，"
                            f"场景 '{next_scene.scene_name}' 开始前，"
                            f"频率 {freq:.2f} MHz 被多个麦克风占用：{', '.join(mic_names)}"
                        ),
                        suggestion=(
                            f"建议调整换场策略：1) 为离开的演员设置频率切换延迟；"
                            f"2) 为新入场演员分配不同频率；"
                            f"3) 确保离开的麦克风在新麦克风启用前已关闭"
                        )
                    )
                    risks.append(risk)
            
            for leaving_mic_id in leaving_mics:
                leaving_mic = mic_map.get(leaving_mic_id)
                if leaving_mic and leaving_mic.backup_frequency is None:
                    risk = RiskItem(
                        risk_type=RiskType.NO_BACKUP,
                        level=RiskLevel.LOW,
                        affected_mics=[leaving_mic_id],
                        affected_scene=f"{current_scene.scene_name} -> {next_scene.scene_name}",
                        description=(
                            f"演员 '{leaving_mic.actor_name}' 离开场景 '{current_scene.scene_name}'，"
                            f"但未设置备用频率（如果需要快速返回）"
                        ),
                        suggestion=(
                            f"如果该演员稍后会返回舞台，建议设置备用频率以便快速切换"
                        )
                    )
                    risks.append(risk)
        
        return risks
    
    def get_active_mics_at_time(
        self,
        target_time: time,
        schedule: List[ScheduleEntry],
        mics: List[Microphone]
    ) -> List[Microphone]:
        """获取指定时间点正在使用的麦克风"""
        active_mics = set()
        
        for entry in schedule:
            if entry.start_time and entry.end_time:
                if entry.start_time <= target_time <= entry.end_time:
                    scene_mics = self.get_scene_mics(entry, mics)
                    for mic in scene_mics:
                        if not mic.is_backup:
                            active_mics.add(mic.id)
        
        mic_map = {m.id: m for m in mics}
        return [mic_map[mid] for mid in active_mics if mid in mic_map]
    
    def check_all(
        self,
        schedule: List[ScheduleEntry],
        mics: List[Microphone]
    ) -> List[RiskItem]:
        """执行所有时间线相关检查"""
        all_risks = []
        
        all_risks.extend(self.check_overlapping_scenes(schedule, mics))
        all_risks.extend(self.check_transition_conflicts(schedule, mics))
        
        return sorted(all_risks, key=lambda r: r.level.value, reverse=True)
    
    def generate_timeline_summary(
        self,
        schedule: List[ScheduleEntry],
        mics: List[Microphone]
    ) -> Dict[str, any]:
        """生成时间线摘要"""
        slots = self.create_timeline_slots(schedule, mics)
        mic_map = {m.id: m for m in mics}
        
        summary = {
            "total_scenes": len(slots),
            "scenes": [],
            "frequency_usage": {}
        }
        
        for slot in slots:
            scene_info = {
                "scene_name": slot.scene_name,
                "start_time": slot.start_time.isoformat() if slot.start_time else None,
                "end_time": slot.end_time.isoformat() if slot.end_time else None,
                "active_mics": []
            }
            
            for mic_id in slot.active_mic_ids:
                mic = mic_map.get(mic_id)
                if mic:
                    scene_info["active_mics"].append({
                        "id": mic.id,
                        "actor_name": mic.actor_name,
                        "frequency": mic.frequency,
                        "channel": mic.channel
                    })
                    
                    freq_key = f"{mic.frequency:.2f} MHz"
                    if freq_key not in summary["frequency_usage"]:
                        summary["frequency_usage"][freq_key] = []
                    summary["frequency_usage"][freq_key].append({
                        "scene": slot.scene_name,
                        "actor": mic.actor_name
                    })
            
            summary["scenes"].append(scene_info)
        
        return summary
