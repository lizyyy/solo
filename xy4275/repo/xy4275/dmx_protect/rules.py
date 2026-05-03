"""
规则引擎模块

实现四种核心检测规则：
1. 通道冲突检测 - 同一时间点同一通道被多台灯抢占
2. 时间重叠检测 - CUE 执行时间重叠
3. 危险跳变检测 - 换景前后亮度变化过大
4. 安全确认缺失 - 烟机/升降台联动缺少安全确认
"""

from datetime import datetime
from typing import Dict, List, Any, Set, Tuple
from collections import defaultdict

from .models import (
    Cue, Fixture, Modification, Issue, ProjectData,
    IssueType, Severity, ReviewDecision, FixtureType
)


class RuleEngine:
    """规则引擎主类"""
    
    def __init__(self, project_data: ProjectData):
        self.project = project_data
        self._issue_counter = 0
        self._issues: List[Issue] = []
    
    def _generate_issue_id(self) -> str:
        """生成问题 ID"""
        self._issue_counter += 1
        return f"ISSUE_{self._issue_counter:03d}"
    
    def _add_issue(self, issue: Issue) -> Issue:
        """添加问题到列表"""
        self._issues.append(issue)
        return issue
    
    def run_all_checks(self) -> List[Issue]:
        """运行所有检测"""
        self._issues = []
        self._issue_counter = 0
        
        self.check_channel_conflict()
        self.check_time_overlap()
        self.check_dangerous_jump()
        self.check_missing_confirmation()
        
        return self._issues
    
    def check_channel_conflict(self) -> List[Issue]:
        """
        通道冲突检测
        
        检测同一时间点同一通道是否被多个 CUE 同时设置不同值。
        严重级别: Critical
        """
        issues = []
        
        cues = self.project.cues
        if len(cues) < 2:
            return issues
        
        for i, cue1 in enumerate(cues):
            for j, cue2 in enumerate(cues[i + 1:], start=i + 1):
                if not self._times_overlap(cue1, cue2):
                    continue
                
                conflicting_channels = self._get_conflicting_channels(cue1, cue2)
                if not conflicting_channels:
                    continue
                
                for ch, (val1, val2) in conflicting_channels.items():
                    issue = Issue(
                        id=self._generate_issue_id(),
                        type=IssueType.CHANNEL_CONFLICT,
                        severity=Severity.CRITICAL,
                        title=f"通道冲突: 通道 {ch}",
                        description=(
                            f"通道 {ch} 在重叠时间段内被两个 CUE 同时设置不同值。\n"
                            f"- CUE {cue1.cue_number}: {val1}\n"
                            f"- CUE {cue2.cue_number}: {val2}\n"
                            f"- 时间重叠: {cue1.start_time:.1f}s - {cue1.end_time:.1f}s 和 "
                            f"{cue2.start_time:.1f}s - {cue2.end_time:.1f}s"
                        ),
                        affected_cues=[cue1.cue_number, cue2.cue_number],
                        affected_channels=[ch],
                        details={
                            "cue1": {
                                "number": cue1.cue_number,
                                "value": val1,
                                "start_time": cue1.start_time,
                                "end_time": cue1.end_time,
                            },
                            "cue2": {
                                "number": cue2.cue_number,
                                "value": val2,
                                "start_time": cue2.start_time,
                                "end_time": cue2.end_time,
                            },
                            "channel": ch,
                            "value_diff": abs(val1 - val2),
                        }
                    )
                    self._add_issue(issue)
                    issues.append(issue)
        
        return issues
    
    def check_time_overlap(self) -> List[Issue]:
        """
        时间重叠检测
        
        检测 CUE 之间的时间线是否有重叠。
        严重级别: Warning
        """
        issues = []
        
        cues = self.project.cues
        if len(cues) < 2:
            return issues
        
        sorted_cues = sorted(cues, key=lambda c: c.start_time)
        
        for i in range(len(sorted_cues) - 1):
            cue1 = sorted_cues[i]
            cue2 = sorted_cues[i + 1]
            
            if not self._times_overlap(cue1, cue2):
                continue
            
            overlap_start = max(cue1.start_time, cue2.start_time)
            overlap_end = min(cue1.end_time, cue2.end_time)
            overlap_duration = overlap_end - overlap_start
            
            issue = Issue(
                id=self._generate_issue_id(),
                type=IssueType.TIME_OVERLAP,
                severity=Severity.WARNING,
                title=f"时间重叠: {cue1.cue_number} 和 {cue2.cue_number}",
                description=(
                    f"CUE 执行时间线存在重叠。\n"
                    f"- CUE {cue1.cue_number}: {cue1.start_time:.1f}s - {cue1.end_time:.1f}s\n"
                    f"- CUE {cue2.cue_number}: {cue2.start_time:.1f}s - {cue2.end_time:.1f}s\n"
                    f"- 重叠时间: {overlap_start:.1f}s - {overlap_end:.1f}s ({overlap_duration:.1f}s)"
                ),
                affected_cues=[cue1.cue_number, cue2.cue_number],
                affected_channels=[],
                details={
                    "cue1": {
                        "number": cue1.cue_number,
                        "start_time": cue1.start_time,
                        "end_time": cue1.end_time,
                    },
                    "cue2": {
                        "number": cue2.cue_number,
                        "start_time": cue2.start_time,
                        "end_time": cue2.end_time,
                    },
                    "overlap_start": overlap_start,
                    "overlap_end": overlap_end,
                    "overlap_duration": overlap_duration,
                }
            )
            self._add_issue(issue)
            issues.append(issue)
        
        return issues
    
    def check_dangerous_jump(self) -> List[Issue]:
        """
        危险跳变检测
        
        检测换景前后同一通道的亮度变化是否过大。
        严重级别: Warning
        触发条件: 连续 CUE 之间同一通道的亮度差值超过阈值（默认 150）
        """
        issues = []
        
        cues = self.project.cues
        if len(cues) < 2:
            return issues
        
        threshold = self.project.config.dangerous_jump_threshold if self.project.config else 150
        
        sorted_cues = sorted(cues, key=lambda c: c.start_time)
        
        for i in range(len(sorted_cues) - 1):
            cue1 = sorted_cues[i]
            cue2 = sorted_cues[i + 1]
            
            common_channels = set(cue1.channels.keys()) & set(cue2.channels.keys())
            
            for ch in common_channels:
                val1 = cue1.channels[ch]
                val2 = cue2.channels[ch]
                diff = abs(val1 - val2)
                
                if diff <= threshold:
                    continue
                
                issue = Issue(
                    id=self._generate_issue_id(),
                    type=IssueType.DANGEROUS_JUMP,
                    severity=Severity.WARNING,
                    title=f"危险跳变: 通道 {ch} (差值 {diff})",
                    description=(
                        f"通道 {ch} 在换景时亮度变化过大，可能导致视觉冲击或设备损坏。\n"
                        f"- CUE {cue1.cue_number}: {val1}\n"
                        f"- CUE {cue2.cue_number}: {val2}\n"
                        f"- 变化差值: {diff}\n"
                        f"- 阈值设定: {threshold}"
                    ),
                    affected_cues=[cue1.cue_number, cue2.cue_number],
                    affected_channels=[ch],
                    details={
                        "cue1": {
                            "number": cue1.cue_number,
                            "value": val1,
                        },
                        "cue2": {
                            "number": cue2.cue_number,
                            "value": val2,
                        },
                        "channel": ch,
                        "diff": diff,
                        "threshold": threshold,
                    }
                )
                self._add_issue(issue)
                issues.append(issue)
        
        return issues
    
    def check_missing_confirmation(self) -> List[Issue]:
        """
        安全确认缺失检测
        
        检测需要安全确认的设备（如烟机、升降台）的 CUE 是否有确认记录。
        严重级别: Critical
        触发条件:
        - 操作的设备类型为 hazer/fogger/lift
        - 该设备配置了 requires_confirmation: true
        - 没有对应的修改记录确认或 review 判定
        """
        issues = []
        
        safety_devices = [f for f in self.project.fixtures if f.is_safety_device()]
        
        if not safety_devices:
            return issues
        
        for cue in self.project.cues:
            for fixture in safety_devices:
                affected_channels = [
                    ch for ch in cue.channels.keys()
                    if fixture.has_channel(ch) and cue.channels[ch] > 0
                ]
                
                if not affected_channels:
                    continue
                
                has_confirmation = self._check_confirmation(cue.cue_number, fixture.id)
                
                if has_confirmation:
                    continue
                
                device_type_desc = self._get_device_type_description(fixture.type)
                
                issue = Issue(
                    id=self._generate_issue_id(),
                    type=IssueType.MISSING_CONFIRMATION,
                    severity=Severity.CRITICAL,
                    title=f"安全确认缺失: {fixture.name} ({cue.cue_number})",
                    description=(
                        f"{device_type_desc} '{fixture.name}' 在 CUE {cue.cue_number} 中被激活，"
                        f"但缺少安全确认记录。\n"
                        f"- 设备 ID: {fixture.id}\n"
                        f"- 设备类型: {fixture.type.value}\n"
                        f"- 影响通道: {affected_channels}\n"
                        f"- CUE 时间: {cue.start_time:.1f}s - {cue.end_time:.1f}s\n"
                        f"- 建议: 请确认该操作的安全性并添加确认记录。"
                    ),
                    affected_cues=[cue.cue_number],
                    affected_channels=affected_channels,
                    details={
                        "fixture": {
                            "id": fixture.id,
                            "name": fixture.name,
                            "type": fixture.type.value,
                            "start_channel": fixture.start_channel,
                            "end_channel": fixture.end_channel,
                        },
                        "cue": {
                            "number": cue.cue_number,
                            "start_time": cue.start_time,
                            "end_time": cue.end_time,
                            "channels": {ch: cue.channels[ch] for ch in affected_channels},
                        },
                        "affected_channels": affected_channels,
                    }
                )
                self._add_issue(issue)
                issues.append(issue)
        
        return issues
    
    def _times_overlap(self, cue1: Cue, cue2: Cue) -> bool:
        """检查两个 CUE 的时间是否重叠"""
        return cue1.start_time < cue2.end_time and cue2.start_time < cue1.end_time
    
    def _get_conflicting_channels(self, cue1: Cue, cue2: Cue) -> Dict[int, Tuple[int, int]]:
        """获取两个 CUE 中冲突的通道（同一通道设置不同值）"""
        conflicts = {}
        common_channels = set(cue1.channels.keys()) & set(cue2.channels.keys())
        
        for ch in common_channels:
            val1 = cue1.channels[ch]
            val2 = cue2.channels[ch]
            if val1 != val2:
                conflicts[ch] = (val1, val2)
        
        return conflicts
    
    def _check_confirmation(self, cue_number: str, fixture_id: str) -> bool:
        """
        检查指定 CUE 和设备是否已有确认记录
        
        确认来源：
        1. 修改记录中的 confirmed 标记
        2. 已通过 review 判定为 accept 的问题
        """
        for mod in self.project.modifications:
            if mod.cue_number == cue_number and mod.confirmed:
                return True
        
        for issue in self.project.issues:
            if (
                issue.type == IssueType.MISSING_CONFIRMATION
                and cue_number in issue.affected_cues
                and issue.review_decision == ReviewDecision.ACCEPT
            ):
                return True
        
        return False
    
    def _get_device_type_description(self, fixture_type: FixtureType) -> str:
        """获取设备类型的中文描述"""
        descriptions = {
            FixtureType.HAZER: "烟机",
            FixtureType.FOGGER: "烟机",
            FixtureType.LIFT: "升降台",
            FixtureType.SPOT: "聚光灯",
            FixtureType.WASH: "染色灯",
            FixtureType.MOVING_HEAD: "摇头灯",
            FixtureType.OTHER: "设备",
        }
        return descriptions.get(fixture_type, "设备")
