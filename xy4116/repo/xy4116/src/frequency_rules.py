#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
频率规则检查模块
实现频率间隔、三阶互调、禁用频段等核心检查逻辑
"""

from typing import List, Tuple, Optional, Set
from .models import (
    Microphone, ForbiddenBand, ChannelInfo, 
    RiskItem, RiskType, RiskLevel
)


class FrequencyRuleEngine:
    """频率规则引擎"""
    
    MIN_SAFE_SPACING_MHZ = 0.3
    MIN_BATTERY_THRESHOLD = 30.0
    CRITICAL_BATTERY_THRESHOLD = 15.0
    
    def __init__(self):
        self.min_safe_spacing = self.MIN_SAFE_SPACING_MHZ
        self.min_battery = self.MIN_BATTERY_THRESHOLD
        self.critical_battery = self.CRITICAL_BATTERY_THRESHOLD
    
    def check_frequency_spacing(
        self, 
        mics: List[Microphone]
    ) -> List[RiskItem]:
        """检查同场景下麦克风频率间隔"""
        risks = []
        active_mics = [m for m in mics if not m.is_backup and m.frequency > 0]
        
        for i, mic1 in enumerate(active_mics):
            for mic2 in active_mics[i+1:]:
                freq_diff = abs(mic1.frequency - mic2.frequency)
                
                if freq_diff < self.min_safe_spacing:
                    level = RiskLevel.CRITICAL if freq_diff < 0.1 else RiskLevel.HIGH
                    
                    risk = RiskItem(
                        risk_type=RiskType.FREQUENCY_CONFLICT,
                        level=level,
                        affected_mics=[mic1.id, mic2.id],
                        description=(
                            f"麦克风 '{mic1.actor_name}' ({mic1.frequency:.2f} MHz) 与 "
                            f"'{mic2.actor_name}' ({mic2.frequency:.2f} MHz) 频率间隔仅 "
                            f"{freq_diff:.2f} MHz，小于安全间隔 {self.min_safe_spacing} MHz"
                        ),
                        suggestion=(
                            f"建议将其中一个麦克风调整到至少相差 {self.min_safe_spacing} MHz 的频率，"
                            f"或考虑使用备用频率"
                        )
                    )
                    risks.append(risk)
        
        return risks
    
    def check_third_order_intermodulation(
        self,
        mics: List[Microphone]
    ) -> List[RiskItem]:
        """检查三阶互调干扰
        
        三阶互调公式: 2f1 - f2 和 2f2 - f1
        当这些值落在其他麦克风频率附近时产生干扰
        """
        risks = []
        active_mics = [m for m in mics if not m.is_backup and m.frequency > 0]
        
        if len(active_mics) < 2:
            return risks
        
        tolerance = 0.05
        
        for i, mic1 in enumerate(active_mics):
            for j, mic2 in enumerate(active_mics[i+1:], start=i+1):
                f1 = mic1.frequency
                f2 = mic2.frequency
                
                im_freq1 = 2 * f1 - f2
                im_freq2 = 2 * f2 - f1
                
                for k, mic3 in enumerate(active_mics):
                    if k == i or k == j:
                        continue
                    
                    f3 = mic3.frequency
                    
                    if abs(im_freq1 - f3) < tolerance:
                        risk = RiskItem(
                            risk_type=RiskType.INTERMODULATION,
                            level=RiskLevel.HIGH,
                            affected_mics=[mic1.id, mic2.id, mic3.id],
                            description=(
                                f"检测到三阶互调干扰风险："
                                f"'{mic1.actor_name}' ({f1:.2f} MHz) 和 "
                                f"'{mic2.actor_name}' ({f2:.2f} MHz) 产生的互调频率 "
                                f"2f1-f2={im_freq1:.2f} MHz 与 "
                                f"'{mic3.actor_name}' ({f3:.2f} MHz) 冲突"
                            ),
                            suggestion=(
                                f"建议调整至少一个麦克风的频率。可考虑将 '{mic3.actor_name}' "
                                f"调整到远离 {im_freq1:.2f} MHz 的频段"
                            )
                        )
                        risks.append(risk)
                    
                    if abs(im_freq2 - f3) < tolerance:
                        risk = RiskItem(
                            risk_type=RiskType.INTERMODULATION,
                            level=RiskLevel.HIGH,
                            affected_mics=[mic1.id, mic2.id, mic3.id],
                            description=(
                                f"检测到三阶互调干扰风险："
                                f"'{mic1.actor_name}' ({f1:.2f} MHz) 和 "
                                f"'{mic2.actor_name}' ({f2:.2f} MHz) 产生的互调频率 "
                                f"2f2-f1={im_freq2:.2f} MHz 与 "
                                f"'{mic3.actor_name}' ({f3:.2f} MHz) 冲突"
                            ),
                            suggestion=(
                                f"建议调整至少一个麦克风的频率。可考虑将 '{mic3.actor_name}' "
                                f"调整到远离 {im_freq2:.2f} MHz 的频段"
                            )
                        )
                        risks.append(risk)
        
        return risks
    
    def check_forbidden_bands(
        self,
        mics: List[Microphone],
        forbidden_bands: List[ForbiddenBand]
    ) -> List[RiskItem]:
        """检查麦克风频率是否落在禁用频段"""
        risks = []
        active_mics = [m for m in mics if not m.is_backup and m.frequency > 0]
        
        for mic in active_mics:
            for band in forbidden_bands:
                if band.start_freq <= mic.frequency <= band.end_freq:
                    risk = RiskItem(
                        risk_type=RiskType.FORBIDDEN_BAND,
                        level=RiskLevel.CRITICAL,
                        affected_mics=[mic.id],
                        description=(
                            f"麦克风 '{mic.actor_name}' ({mic.frequency:.2f} MHz) "
                            f"落在禁用频段 '{band.name}' ({band.start_freq:.2f}-{band.end_freq:.2f} MHz) 内。"
                            f"禁用原因：{band.reason}"
                        ),
                        suggestion=(
                            f"必须立即将 '{mic.actor_name}' 调整到禁用频段外的频率。"
                            f"建议选择 {band.end_freq + self.min_safe_spacing:.2f} MHz 以上或 "
                            f"{band.start_freq - self.min_safe_spacing:.2f} MHz 以下的频率"
                        )
                    )
                    risks.append(risk)
        
        return risks
    
    def check_battery_level(
        self,
        mics: List[Microphone]
    ) -> List[RiskItem]:
        """检查设备电量"""
        risks = []
        active_mics = [m for m in mics if not m.is_backup]
        
        for mic in active_mics:
            if mic.battery_level < self.critical_battery:
                risk = RiskItem(
                    risk_type=RiskType.LOW_BATTERY,
                    level=RiskLevel.CRITICAL,
                    affected_mics=[mic.id],
                    description=(
                        f"麦克风 '{mic.actor_name}' (设备ID: {mic.device_id}) "
                        f"电量仅 {mic.battery_level:.1f}%，严重不足！"
                    ),
                    suggestion=(
                        f"演出前必须更换电池或充电。建议准备备用电池组。"
                    )
                )
                risks.append(risk)
            elif mic.battery_level < self.min_battery:
                risk = RiskItem(
                    risk_type=RiskType.LOW_BATTERY,
                    level=RiskLevel.HIGH,
                    affected_mics=[mic.id],
                    description=(
                        f"麦克风 '{mic.actor_name}' (设备ID: {mic.device_id}) "
                        f"电量 {mic.battery_level:.1f}%，低于建议阈值 {self.min_battery}%"
                    ),
                    suggestion=(
                        f"建议更换电池或充电。演出时间较长时应准备备用方案。"
                    )
                )
                risks.append(risk)
        
        return risks
    
    def check_backup_availability(
        self,
        mics: List[Microphone],
        channels: List[ChannelInfo]
    ) -> List[RiskItem]:
        """检查备用通道和备用频率设置"""
        risks = []
        active_mics = [m for m in mics if not m.is_backup]
        
        for mic in active_mics:
            if mic.backup_frequency is None or mic.backup_channel is None:
                risk = RiskItem(
                    risk_type=RiskType.NO_BACKUP,
                    level=RiskLevel.MEDIUM,
                    affected_mics=[mic.id],
                    description=(
                        f"麦克风 '{mic.actor_name}' (设备ID: {mic.device_id}) "
                        f"未设置备用频率或备用频道"
                    ),
                    suggestion=(
                        f"建议为每个主麦克风设置备用频率。可用通道："
                        f"{[c.channel_name for c in channels if c.is_available]}"
                    )
                )
                risks.append(risk)
        
        available_channels = [c for c in channels if c.is_available]
        used_backup_freqs = set()
        for mic in active_mics:
            if mic.backup_frequency:
                used_backup_freqs.add(mic.backup_frequency)
        
        if len(available_channels) < len(active_mics) + 2:
            risk = RiskItem(
                risk_type=RiskType.NO_BACKUP,
                level=RiskLevel.HIGH,
                description=(
                    f"可用备用通道不足。当前有 {len(active_mics)} 个主麦克风，"
                    f"但仅 {len(available_channels)} 个可用通道。建议至少保留 2 个应急通道。"
                ),
                suggestion=(
                    f"建议增加可用通道数量，或检查是否有未使用的通道被标记为不可用。"
                )
            )
            risks.append(risk)
        
        return risks
    
    def check_all(
        self,
        mics: List[Microphone],
        forbidden_bands: List[ForbiddenBand],
        channels: List[ChannelInfo]
    ) -> List[RiskItem]:
        """执行所有检查并返回合并的风险列表"""
        all_risks = []
        
        all_risks.extend(self.check_frequency_spacing(mics))
        all_risks.extend(self.check_third_order_intermodulation(mics))
        all_risks.extend(self.check_forbidden_bands(mics, forbidden_bands))
        all_risks.extend(self.check_battery_level(mics))
        all_risks.extend(self.check_backup_availability(mics, channels))
        
        return sorted(all_risks, key=lambda r: r.level.value, reverse=True)
    
    def suggest_alternative_frequency(
        self,
        current_freq: float,
        used_freqs: List[float],
        forbidden_bands: List[ForbiddenBand],
        channels: List[ChannelInfo],
        preferred_direction: str = "up"
    ) -> Optional[float]:
        """为冲突频率建议替代频率"""
        step = self.min_safe_spacing
        max_attempts = 100
        
        available_channels = [
            c for c in channels 
            if c.is_available and c.center_freq not in used_freqs
        ]
        
        for channel in available_channels:
            is_forbidden = False
            for band in forbidden_bands:
                if band.start_freq <= channel.center_freq <= band.end_freq:
                    is_forbidden = True
                    break
            
            if not is_forbidden:
                safe = True
                for used_freq in used_freqs:
                    if abs(channel.center_freq - used_freq) < self.min_safe_spacing:
                        safe = False
                        break
                if safe:
                    return channel.center_freq
        
        if preferred_direction == "up":
            directions = [1, -1]
        else:
            directions = [-1, 1]
        
        for direction in directions:
            test_freq = current_freq
            for _ in range(max_attempts):
                test_freq += direction * step
                
                in_forbidden = False
                for band in forbidden_bands:
                    if band.start_freq <= test_freq <= band.end_freq:
                        in_forbidden = True
                        break
                if in_forbidden:
                    continue
                
                safe = True
                for used_freq in used_freqs:
                    if abs(test_freq - used_freq) < self.min_safe_spacing:
                        safe = False
                        break
                
                if safe:
                    return test_freq
        
        return None
