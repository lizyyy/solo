#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
导入导出模块
处理CSV/JSON导入，Markdown报告和CSV风险清单导出
"""

import csv
import json
from datetime import time, datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from .models import (
    Microphone, ScheduleEntry, ForbiddenBand, 
    ChannelInfo, RiskItem, RehearsalPlan,
    RiskLevel, RiskType
)


class DataImporter:
    """数据导入器"""
    
    @classmethod
    def import_microphones_from_csv(cls, filepath: str) -> List[Microphone]:
        """从CSV导入麦克风数据"""
        mics = []
        
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                mic = Microphone()
                
                if 'device_id' in row and row['device_id']:
                    mic.device_id = row['device_id'].strip()
                elif '设备ID' in row and row['设备ID']:
                    mic.device_id = row['设备ID'].strip()
                
                if 'actor_name' in row and row['actor_name']:
                    mic.actor_name = row['actor_name'].strip()
                elif '演员姓名' in row and row['演员姓名']:
                    mic.actor_name = row['演员姓名'].strip()
                elif '演员' in row and row['演员']:
                    mic.actor_name = row['演员'].strip()
                
                if 'frequency' in row and row['frequency']:
                    mic.frequency = cls._parse_frequency(row['frequency'])
                elif '频率' in row and row['频率']:
                    mic.frequency = cls._parse_frequency(row['频率'])
                
                if 'channel' in row and row['channel']:
                    mic.channel = row['channel'].strip()
                elif '频道' in row and row['频道']:
                    mic.channel = row['频道'].strip()
                
                if 'battery_level' in row and row['battery_level']:
                    mic.battery_level = float(row['battery_level'].strip().rstrip('%'))
                elif '电量' in row and row['电量']:
                    mic.battery_level = float(row['电量'].strip().rstrip('%'))
                
                if 'backup_frequency' in row and row['backup_frequency']:
                    mic.backup_frequency = cls._parse_frequency(row['backup_frequency'])
                elif '备用频率' in row and row['备用频率']:
                    mic.backup_frequency = cls._parse_frequency(row['备用频率'])
                
                if 'backup_channel' in row and row['backup_channel']:
                    mic.backup_channel = row['backup_channel'].strip()
                elif '备用频道' in row and row['备用频道']:
                    mic.backup_channel = row['备用频道'].strip()
                
                if 'notes' in row:
                    mic.notes = row['notes'].strip()
                elif '备注' in row:
                    mic.notes = row['备注'].strip()
                
                mics.append(mic)
        
        return mics
    
    @classmethod
    def import_schedule_from_csv(cls, filepath: str) -> List[ScheduleEntry]:
        """从CSV导入时间表数据"""
        schedule = []
        
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                entry = ScheduleEntry()
                
                if 'scene_name' in row and row['scene_name']:
                    entry.scene_name = row['scene_name'].strip()
                elif '场景名称' in row and row['场景名称']:
                    entry.scene_name = row['场景名称'].strip()
                elif '场景' in row and row['场景']:
                    entry.scene_name = row['场景'].strip()
                
                if 'start_time' in row and row['start_time']:
                    entry.start_time = cls._parse_time(row['start_time'])
                elif '开始时间' in row and row['开始时间']:
                    entry.start_time = cls._parse_time(row['开始时间'])
                
                if 'end_time' in row and row['end_time']:
                    entry.end_time = cls._parse_time(row['end_time'])
                elif '结束时间' in row and row['结束时间']:
                    entry.end_time = cls._parse_time(row['结束时间'])
                
                if 'actor_names' in row and row['actor_names']:
                    entry.actor_names = [n.strip() for n in row['actor_names'].split(',')]
                elif '演员名单' in row and row['演员名单']:
                    entry.actor_names = [n.strip() for n in row['演员名单'].split(',')]
                elif '演员' in row and row['演员']:
                    entry.actor_names = [n.strip() for n in row['演员'].split(',')]
                
                if 'notes' in row:
                    entry.notes = row['notes'].strip()
                elif '备注' in row:
                    entry.notes = row['备注'].strip()
                
                schedule.append(entry)
        
        return schedule
    
    @classmethod
    def import_forbidden_bands_from_csv(cls, filepath: str) -> List[ForbiddenBand]:
        """从CSV导入禁用频段数据"""
        bands = []
        
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                band = ForbiddenBand()
                
                if 'name' in row and row['name']:
                    band.name = row['name'].strip()
                elif '频段名称' in row and row['频段名称']:
                    band.name = row['频段名称'].strip()
                elif '名称' in row and row['名称']:
                    band.name = row['名称'].strip()
                
                if 'start_freq' in row and row['start_freq']:
                    band.start_freq = cls._parse_frequency(row['start_freq'])
                elif '起始频率' in row and row['起始频率']:
                    band.start_freq = cls._parse_frequency(row['起始频率'])
                
                if 'end_freq' in row and row['end_freq']:
                    band.end_freq = cls._parse_frequency(row['end_freq'])
                elif '结束频率' in row and row['结束频率']:
                    band.end_freq = cls._parse_frequency(row['结束频率'])
                
                if 'reason' in row:
                    band.reason = row['reason'].strip()
                elif '原因' in row:
                    band.reason = row['原因'].strip()
                
                bands.append(band)
        
        return bands
    
    @classmethod
    def import_channels_from_csv(cls, filepath: str) -> List[ChannelInfo]:
        """从CSV导入频道信息"""
        channels = []
        
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                channel = ChannelInfo()
                
                if 'channel_name' in row and row['channel_name']:
                    channel.channel_name = row['channel_name'].strip()
                elif '频道名称' in row and row['频道名称']:
                    channel.channel_name = row['频道名称'].strip()
                elif '频道' in row and row['频道']:
                    channel.channel_name = row['频道'].strip()
                
                if 'center_freq' in row and row['center_freq']:
                    channel.center_freq = cls._parse_frequency(row['center_freq'])
                elif '中心频率' in row and row['中心频率']:
                    channel.center_freq = cls._parse_frequency(row['中心频率'])
                elif '频率' in row and row['频率']:
                    channel.center_freq = cls._parse_frequency(row['频率'])
                
                if 'bandwidth' in row and row['bandwidth']:
                    channel.bandwidth = float(row['bandwidth'].strip())
                elif '带宽' in row and row['带宽']:
                    channel.bandwidth = float(row['带宽'].strip())
                
                if 'is_available' in row and row['is_available']:
                    val = row['is_available'].strip().lower()
                    channel.is_available = val in ['true', 'yes', '1', '可用', '是']
                elif '可用' in row and row['可用']:
                    val = row['可用'].strip().lower()
                    channel.is_available = val in ['true', 'yes', '1', '可用', '是']
                
                channels.append(channel)
        
        return channels
    
    @classmethod
    def import_from_json(cls, filepath: str) -> Dict[str, Any]:
        """从JSON导入数据"""
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    @staticmethod
    def _parse_frequency(value: str) -> float:
        """解析频率值"""
        value = value.strip()
        value = value.replace('MHz', '').replace('mhz', '').replace(' ', '')
        return float(value)
    
    @staticmethod
    def _parse_time(value: str) -> Optional[time]:
        """解析时间值"""
        value = value.strip()
        
        formats = [
            "%H:%M:%S",
            "%H:%M",
            "%H:%M:%S.%f",
        ]
        
        for fmt in formats:
            try:
                t = datetime.strptime(value, fmt).time()
                return t
            except ValueError:
                continue
        
        return None


class DataExporter:
    """数据导出器"""
    
    @classmethod
    def export_markdown_report(
        cls,
        plan: RehearsalPlan,
        filepath: str,
        risks: List[RiskItem]
    ) -> str:
        """导出Markdown彩排报告"""
        lines = []
        
        lines.append(f"# {plan.name}")
        lines.append("")
        lines.append(f"> 生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 一、项目概览")
        lines.append("")
        lines.append(f"- **麦克风数量**：{len(plan.microphones)} 支")
        lines.append(f"- **场景数量**：{len(plan.schedule)} 个")
        lines.append(f"- **禁用频段**：{len(plan.forbidden_bands)} 个")
        lines.append(f"- **风险项总数**：{len(risks)} 项")
        lines.append("")
        
        critical_count = len([r for r in risks if r.level == RiskLevel.CRITICAL and not r.is_resolved])
        high_count = len([r for r in risks if r.level == RiskLevel.HIGH and not r.is_resolved])
        medium_count = len([r for r in risks if r.level == RiskLevel.MEDIUM and not r.is_resolved])
        resolved_count = len([r for r in risks if r.is_resolved])
        
        lines.append("## 二、风险摘要")
        lines.append("")
        lines.append("| 风险等级 | 数量 | 状态 |")
        lines.append("|----------|------|------|")
        lines.append(f"| 🔴 严重 | {critical_count} | 待处理 |")
        lines.append(f"| 🟠 高 | {high_count} | 待处理 |")
        lines.append(f"| 🟡 中 | {medium_count} | 待处理 |")
        lines.append(f"| ✅ 已解决 | {resolved_count} | 已处理 |")
        lines.append("")
        
        lines.append("## 三、麦克风配置")
        lines.append("")
        lines.append("| 设备ID | 演员 | 频率(MHz) | 频道 | 电量(%) | 备用频率 | 备用频道 |")
        lines.append("|--------|------|-----------|------|---------|----------|----------|")
        
        for mic in plan.microphones:
            backup_freq = f"{mic.backup_frequency:.2f}" if mic.backup_frequency else "-"
            backup_chan = mic.backup_channel if mic.backup_channel else "-"
            lines.append(
                f"| {mic.device_id} | {mic.actor_name} | {mic.frequency:.2f} | "
                f"{mic.channel} | {mic.battery_level:.0f} | {backup_freq} | {backup_chan} |"
            )
        lines.append("")
        
        lines.append("## 四、时间走位表")
        lines.append("")
        lines.append("| 场景 | 开始时间 | 结束时间 | 演员名单 |")
        lines.append("|------|----------|----------|----------|")
        
        for entry in sorted(plan.schedule, key=lambda x: x.start_time or time.min):
            start = entry.start_time.strftime("%H:%M") if entry.start_time else "-"
            end = entry.end_time.strftime("%H:%M") if entry.end_time else "-"
            actors = ", ".join(entry.actor_names) if entry.actor_names else "-"
            lines.append(f"| {entry.scene_name} | {start} | {end} | {actors} |")
        lines.append("")
        
        lines.append("## 五、禁用频段")
        lines.append("")
        if plan.forbidden_bands:
            lines.append("| 频段名称 | 起始频率(MHz) | 结束频率(MHz) | 禁用原因 |")
            lines.append("|----------|---------------|---------------|----------|")
            for band in plan.forbidden_bands:
                lines.append(
                    f"| {band.name} | {band.start_freq:.2f} | {band.end_freq:.2f} | {band.reason} |"
                )
        else:
            lines.append("> 无禁用频段配置")
        lines.append("")
        
        lines.append("## 六、风险详情")
        lines.append("")
        
        unresolved_risks = [r for r in risks if not r.is_resolved]
        resolved_risks = [r for r in risks if r.is_resolved]
        
        if unresolved_risks:
            lines.append("### 待处理风险")
            lines.append("")
            
            for i, risk in enumerate(sorted(unresolved_risks, key=lambda r: r.level.value, reverse=True), 1):
                level_icon = {
                    RiskLevel.CRITICAL: "🔴",
                    RiskLevel.HIGH: "🟠",
                    RiskLevel.MEDIUM: "🟡",
                    RiskLevel.LOW: "🟢"
                }.get(risk.level, "⚪")
                
                risk_type_name = {
                    RiskType.FREQUENCY_CONFLICT: "频率冲突",
                    RiskType.INTERMODULATION: "互调干扰",
                    RiskType.FORBIDDEN_BAND: "禁用频段",
                    RiskType.LOW_BATTERY: "低电量",
                    RiskType.NO_BACKUP: "无备用",
                    RiskType.OVERLAP_CHANNEL: "频道重叠"
                }.get(risk.risk_type, "未知")
                
                lines.append(f"#### {i}. {level_icon} [{risk_type_name}] {risk.level.name}")
                lines.append("")
                lines.append(f"**描述**：{risk.description}")
                lines.append("")
                lines.append(f"**建议**：{risk.suggestion}")
                lines.append("")
                
                if risk.affected_scene:
                    lines.append(f"**影响场景**：{risk.affected_scene}")
                    lines.append("")
        
        if resolved_risks:
            lines.append("### 已解决风险")
            lines.append("")
            
            for i, risk in enumerate(resolved_risks, 1):
                lines.append(f"#### {i}. ✅ {risk.description[:50]}...")
                lines.append("")
        
        if plan.notes:
            lines.append("## 七、备注")
            lines.append("")
            lines.append(plan.notes)
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此报告由「无线麦频率彩排台」生成*")
        
        content = "\n".join(lines)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return filepath
    
    @classmethod
    def export_risk_csv(
        cls,
        risks: List[RiskItem],
        filepath: str,
        mics: List[Microphone]
    ) -> str:
        """导出CSV风险清单"""
        mic_map = {m.id: m for m in mics}
        
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow([
                '序号', '风险等级', '风险类型', '状态',
                '影响演员', '影响场景', '开始时间', '结束时间',
                '描述', '建议'
            ])
            
            for i, risk in enumerate(risks, 1):
                affected_actors = []
                for mic_id in risk.affected_mics:
                    mic = mic_map.get(mic_id)
                    if mic:
                        affected_actors.append(mic.actor_name)
                
                level_name = {
                    RiskLevel.CRITICAL: '严重',
                    RiskLevel.HIGH: '高',
                    RiskLevel.MEDIUM: '中',
                    RiskLevel.LOW: '低'
                }.get(risk.level, '未知')
                
                type_name = {
                    RiskType.FREQUENCY_CONFLICT: '频率冲突',
                    RiskType.INTERMODULATION: '互调干扰',
                    RiskType.FORBIDDEN_BAND: '禁用频段',
                    RiskType.LOW_BATTERY: '低电量',
                    RiskType.NO_BACKUP: '无备用',
                    RiskType.OVERLAP_CHANNEL: '频道重叠'
                }.get(risk.risk_type, '未知')
                
                status = '已解决' if risk.is_resolved else '待处理'
                
                start_time = risk.start_time.strftime('%H:%M') if risk.start_time else ''
                end_time = risk.end_time.strftime('%H:%M') if risk.end_time else ''
                
                writer.writerow([
                    i, level_name, type_name, status,
                    ', '.join(affected_actors),
                    risk.affected_scene or '',
                    start_time, end_time,
                    risk.description,
                    risk.suggestion
                ])
        
        return filepath
