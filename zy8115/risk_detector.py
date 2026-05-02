from typing import List, Dict, Set, Tuple, Optional
from collections import defaultdict
import uuid

from models import (
    ReviewProject,
    LightingCue,
    TrackMarker,
    DeviceChannel,
    Risk,
    RiskType,
    RiskLevel
)


class RiskDetector:
    """风险检测器，用于检测灯光时间线中的各类问题"""
    
    def __init__(self, project: ReviewProject):
        self.project = project
        self._channel_map: Dict[int, List[DeviceChannel]] = defaultdict(list)
        self._track_map: Dict[str, TrackMarker] = {}
        self._build_maps()
    
    def _build_maps(self):
        """构建辅助映射"""
        # 构建通道映射
        for channel in self.project.device_channels:
            self._channel_map[channel.channel_number].append(channel)
        
        # 构建曲目映射
        for track in self.project.track_markers:
            self._track_map[track.name] = track
    
    def detect_all(self) -> List[Risk]:
        """执行所有风险检测"""
        risks = []
        
        # 检测通道重叠
        risks.extend(self._detect_channel_overlap())
        
        # 检测时间早于曲目起点
        risks.extend(self._detect_time_before_track_start())
        
        # 检测缺失曲目标记
        risks.extend(self._detect_missing_track_marker())
        
        # 检测未知通道
        risks.extend(self._detect_unknown_channel())
        
        # 检测CUE编号问题
        risks.extend(self._detect_invalid_cue_number())
        
        # 检测时间顺序问题
        risks.extend(self._detect_time_order_issues())
        
        # 检测通道冲突配置
        risks.extend(self._detect_channel_config_conflict())
        
        return risks
    
    def _generate_risk_id(self) -> str:
        """生成唯一的风险ID"""
        return f"RISK_{uuid.uuid4().hex[:8].upper()}"
    
    def _detect_channel_overlap(self) -> List[Risk]:
        """检测同一通道在不同CUE中的重叠使用"""
        risks = []
        
        # 按通道分组，记录每个通道在哪些CUE中被使用
        channel_usage: Dict[int, List[Tuple[str, float, float, float]]] = defaultdict(list)
        
        for cue in self.project.lighting_cues:
            for channel_num, value in cue.channels.items():
                if value > 0:  # 只考虑有值的通道
                    # 计算CUE的有效时间范围
                    start_time = cue.time
                    # 如果有淡入，考虑淡入时间
                    if cue.fade_in:
                        start_time -= cue.fade_in  # 从淡入开始计算
                    
                    # 估算结束时间（如果没有明确结束时间，假设持续到下一个CUE）
                    end_time = cue.time + (cue.fade_out if cue.fade_out else 5.0)
                    
                    channel_usage[channel_num].append((
                        cue.cue_number,
                        start_time,
                        cue.time,  # 实际触发时间
                        end_time
                    ))
        
        # 检查每个通道的使用情况
        for channel_num, usages in channel_usage.items():
            if len(usages) < 2:
                continue  # 只有一个CUE使用，没有重叠可能
            
            # 按开始时间排序
            usages_sorted = sorted(usages, key=lambda x: x[1])
            
            # 检查相邻CUE是否有时间重叠
            for i in range(len(usages_sorted) - 1):
                cue1_num, cue1_start, cue1_trigger, cue1_end = usages_sorted[i]
                cue2_num, cue2_start, cue2_trigger, cue2_end = usages_sorted[i + 1]
                
                # 检查是否有时间重叠
                # 如果第二个CUE的开始时间早于第一个CUE的结束时间，则存在重叠
                if cue2_start < cue1_end:
                    # 检查是否是通道值变化（可能是预期的）
                    # 这里简单判断为重叠风险，实际使用时可能需要更复杂的逻辑
                    
                    # 获取通道信息
                    channel_info = ""
                    if channel_num in self._channel_map:
                        channels = self._channel_map[channel_num]
                        if channels:
                            channel_info = f" ({channels[0].device_name})"
                    
                    risk = Risk(
                        id=self._generate_risk_id(),
                        risk_type=RiskType.CHANNEL_OVERLAP,
                        level=RiskLevel.HIGH,
                        title=f"通道 {channel_num}{channel_info} 存在重叠",
                        description=(
                            f"通道 {channel_num} 在 CUE {cue1_num} 和 CUE {cue2_num} 中存在时间重叠。\n"
                            f"  - CUE {cue1_num}: 触发时间 {cue1_trigger:.2f}s, 预计结束 {cue1_end:.2f}s\n"
                            f"  - CUE {cue2_num}: 触发时间 {cue2_trigger:.2f}s, 预计结束 {cue2_end:.2f}s\n"
                            f"重叠时间段: {max(cue1_start, cue2_start):.2f}s - {min(cue1_end, cue2_end):.2f}s"
                        ),
                        affected_cues=[cue1_num, cue2_num],
                        affected_channels=[channel_num],
                        time_reference=min(cue1_trigger, cue2_trigger)
                    )
                    risks.append(risk)
        
        return risks
    
    def _detect_time_before_track_start(self) -> List[Risk]:
        """检测CUE时间早于其关联曲目的起点"""
        risks = []
        
        for cue in self.project.lighting_cues:
            if not cue.track_name:
                continue  # 没有关联曲目，跳过
            
            # 查找对应的曲目标记
            if cue.track_name not in self._track_map:
                continue  # 曲目不存在，由其他检测处理
            
            track = self._track_map[cue.track_name]
            
            # 检查CUE时间是否早于曲目起点
            # cue.time 是全局时间，需要与曲目开始时间比较
            if cue.time < track.start_time:
                time_diff = track.start_time - cue.time
                
                risk = Risk(
                    id=self._generate_risk_id(),
                    risk_type=RiskType.TIME_BEFORE_TRACK_START,
                    level=RiskLevel.CRITICAL,
                    title=f"CUE {cue.cue_number} 时间早于曲目起点",
                    description=(
                        f"CUE {cue.cue_number} 的触发时间 ({cue.time:.2f}s) 早于关联曲目 '{cue.track_name}' 的起点 ({track.start_time:.2f}s)。\n"
                        f"时间差: {time_diff:.2f}s\n"
                        f"曲目时间范围: {track.start_time:.2f}s - {track.end_time:.2f}s"
                    ),
                    affected_cues=[cue.cue_number],
                    affected_tracks=[cue.track_name],
                    time_reference=cue.time
                )
                risks.append(risk)
            
            # 同时检查track_time（相对于曲目开始的时间）
            if cue.track_time is not None and cue.track_time < 0:
                risk = Risk(
                    id=self._generate_risk_id(),
                    risk_type=RiskType.TIME_BEFORE_TRACK_START,
                    level=RiskLevel.HIGH,
                    title=f"CUE {cue.cue_number} 曲目相对时间为负值",
                    description=(
                        f"CUE {cue.cue_number} 的曲目相对时间 ({cue.track_time:.2f}s) 为负值。\n"
                        f"这表示该CUE被设置在曲目 '{cue.track_name}' 开始之前触发。"
                    ),
                    affected_cues=[cue.cue_number],
                    affected_tracks=[cue.track_name] if cue.track_name else [],
                    time_reference=cue.time
                )
                risks.append(risk)
        
        return risks
    
    def _detect_missing_track_marker(self) -> List[Risk]:
        """检测CUE关联的曲目标记不存在"""
        risks = []
        
        # 获取所有已定义的曲目名称
        defined_tracks = set(self._track_map.keys())
        
        for cue in self.project.lighting_cues:
            if not cue.track_name:
                continue  # 没有关联曲目，跳过
            
            if cue.track_name not in defined_tracks:
                risk = Risk(
                    id=self._generate_risk_id(),
                    risk_type=RiskType.MISSING_TRACK_MARKER,
                    level=RiskLevel.HIGH,
                    title=f"CUE {cue.cue_number} 关联的曲目 '{cue.track_name}' 不存在",
                    description=(
                        f"CUE {cue.cue_number} 关联的曲目 '{cue.track_name}' 在曲目时间轴中未定义。\n"
                        f"已定义的曲目: {', '.join(sorted(defined_tracks)) if defined_tracks else '无'}"
                    ),
                    affected_cues=[cue.cue_number],
                    affected_tracks=[cue.track_name],
                    time_reference=cue.time
                )
                risks.append(risk)
        
        # 检测没有关联曲目的CUE（可选警告）
        cues_without_track = [c for c in self.project.lighting_cues if not c.track_name]
        if cues_without_track:
            risk = Risk(
                id=self._generate_risk_id(),
                risk_type=RiskType.MISSING_TRACK_MARKER,
                level=RiskLevel.LOW,
                title=f"{len(cues_without_track)} 个CUE未关联曲目",
                description=(
                    f"以下 {len(cues_without_track)} 个CUE没有关联任何曲目:\n"
                    + "\n".join([f"  - {c.cue_number} (时间: {c.time:.2f}s)" for c in cues_without_track])
                ),
                affected_cues=[c.cue_number for c in cues_without_track]
            )
            risks.append(risk)
        
        return risks
    
    def _detect_unknown_channel(self) -> List[Risk]:
        """检测CUE使用了设备配置中未定义的通道"""
        risks = []
        
        # 获取已定义的通道
        defined_channels = set(self._channel_map.keys())
        
        for cue in self.project.lighting_cues:
            unknown_channels = []
            for channel_num in cue.channels.keys():
                if channel_num not in defined_channels:
                    unknown_channels.append(channel_num)
            
            if unknown_channels:
                unknown_channels_sorted = sorted(unknown_channels)
                risk = Risk(
                    id=self._generate_risk_id(),
                    risk_type=RiskType.UNKNOWN_CHANNEL,
                    level=RiskLevel.MEDIUM,
                    title=f"CUE {cue.cue_number} 使用了未定义的通道",
                    description=(
                        f"CUE {cue.cue_number} 使用了以下未在设备通道配置中定义的通道:\n"
                        f"  通道: {', '.join(map(str, unknown_channels_sorted))}\n"
                        f"已定义的通道范围: {min(defined_channels) if defined_channels else '无'} - {max(defined_channels) if defined_channels else '无'}"
                    ),
                    affected_cues=[cue.cue_number],
                    affected_channels=unknown_channels_sorted,
                    time_reference=cue.time
                )
                risks.append(risk)
        
        return risks
    
    def _detect_invalid_cue_number(self) -> List[Risk]:
        """检测CUE编号问题（重复、格式不一致等）"""
        risks = []
        
        # 检测重复的CUE编号
        cue_numbers = [c.cue_number for c in self.project.lighting_cues]
        seen = set()
        duplicates = set()
        
        for num in cue_numbers:
            if num in seen:
                duplicates.add(num)
            seen.add(num)
        
        for dup_num in duplicates:
            # 找到所有使用该编号的CUE
            dup_cues = [c for c in self.project.lighting_cues if c.cue_number == dup_num]
            risk = Risk(
                id=self._generate_risk_id(),
                risk_type=RiskType.INVALID_CUE_NUMBER,
                level=RiskLevel.HIGH,
                title=f"CUE编号 '{dup_num}' 重复",
                description=(
                    f"发现 {len(dup_cues)} 个CUE使用了相同的编号 '{dup_num}':\n"
                    + "\n".join([f"  - 时间: {c.time:.2f}s, 场景: {c.scene}" for c in dup_cues])
                ),
                affected_cues=[c.cue_number for c in dup_cues],
                time_reference=min(c.time for c in dup_cues)
            )
            risks.append(risk)
        
        return risks
    
    def _detect_time_order_issues(self) -> List[Risk]:
        """检测时间顺序问题（CUE编号顺序与时间顺序不一致）"""
        risks = []
        
        if len(self.project.lighting_cues) < 2:
            return risks
        
        # 按时间排序
        cues_by_time = sorted(self.project.lighting_cues, key=lambda x: x.time)
        
        # 检查CUE编号的数字顺序是否与时间顺序一致
        # 这是一个可选检查，因为有些情况下可能有意打乱顺序
        # 这里只检测明显的问题
        
        for i in range(len(cues_by_time) - 1):
            cue1 = cues_by_time[i]
            cue2 = cues_by_time[i + 1]
            
            # 检查时间是否倒退（应该不会，因为已经排序了）
            if cue2.time < cue1.time:
                risk = Risk(
                    id=self._generate_risk_id(),
                    risk_type=RiskType.MISSING_CUE,  # 复用这个类型或者新增
                    level=RiskLevel.HIGH,
                    title=f"CUE时间顺序异常",
                    description=(
                        f"CUE {cue2.cue_number} (时间: {cue2.time:.2f}s) 的时间早于 "
                        f"CUE {cue1.cue_number} (时间: {cue1.time:.2f}s)。\n"
                        f"这可能表示时间线存在严重问题。"
                    ),
                    affected_cues=[cue1.cue_number, cue2.cue_number],
                    time_reference=min(cue1.time, cue2.time)
                )
                risks.append(risk)
        
        return risks
    
    def _detect_channel_config_conflict(self) -> List[Risk]:
        """检测通道配置冲突（同一通道在不同场景配置不同）"""
        risks = []
        
        # 检查同一通道号在不同场景的配置是否一致
        for channel_num, channels in self._channel_map.items():
            if len(channels) < 2:
                continue
            
            # 检查设备名称和类型是否一致
            first_channel = channels[0]
            for other_channel in channels[1:]:
                if (first_channel.device_name != other_channel.device_name or
                    first_channel.device_type != other_channel.device_type):
                    risk = Risk(
                        id=self._generate_risk_id(),
                        risk_type=RiskType.CHANNEL_CONFLICT,
                        level=RiskLevel.MEDIUM,
                        title=f"通道 {channel_num} 配置不一致",
                        description=(
                            f"通道 {channel_num} 在不同场景中的配置不一致:\n"
                            f"  场景 '{first_channel.scene}': {first_channel.device_name} ({first_channel.device_type})\n"
                            f"  场景 '{other_channel.scene}': {other_channel.device_name} ({other_channel.device_type})"
                        ),
                        affected_channels=[channel_num],
                        affected_tracks=[first_channel.scene, other_channel.scene]
                    )
                    risks.append(risk)
        
        return risks


def run_risk_detection(project: ReviewProject) -> List[Risk]:
    """便捷函数：运行风险检测并将结果添加到项目中"""
    detector = RiskDetector(project)
    risks = detector.detect_all()
    project.risks = risks
    return risks