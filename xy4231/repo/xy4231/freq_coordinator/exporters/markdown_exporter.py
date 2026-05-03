from datetime import datetime, timedelta
from typing import Dict, List
from pathlib import Path
from collections import defaultdict

from freq_coordinator.models import (
    CommunicationPlan,
    RiskItem,
    ScheduleEntry,
    SupplyStation,
    RepeaterStation,
)


class MarkdownExporter:
    def __init__(self, plan: CommunicationPlan):
        self.plan = plan
    
    def export(self, output_path: str = None) -> str:
        content = self._generate()
        
        if output_path:
            path = Path(output_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
        
        return content
    
    def _generate(self) -> str:
        sections = []
        
        sections.append(self._generate_header())
        sections.append(self._generate_overview())
        sections.append(self._generate_repeater_section())
        sections.append(self._generate_station_section())
        sections.append(self._generate_schedule_section())
        sections.append(self._generate_channel_plan_section())
        sections.append(self._generate_risk_section())
        sections.append(self._generate_appendix())
        
        return "\n\n---\n\n".join(sections)
    
    def _generate_header(self) -> str:
        lines = [
            f"# {self.plan.event_name} - 通信保障方案",
            "",
            f"> 生成时间: {self.plan.generated_at.strftime('%Y-%m-%d %H:%M:%S')}",
            f"> 版本: 1.0",
            "",
            "## 执行摘要",
            "",
        ]
        
        critical_count = len([r for r in self.plan.risks if r.severity == "critical"])
        high_count = len([r for r in self.plan.risks if r.severity == "high"])
        
        if critical_count > 0 or high_count > 0:
            lines.append(f"⚠️ **警告**: 检测到 {critical_count} 个严重风险和 {high_count} 个高优先级风险，请查看风险章节。")
        else:
            lines.append("✅ 方案检查通过，未发现严重风险。")
        
        return "\n".join(lines)
    
    def _generate_overview(self) -> str:
        lines = [
            "## 资源概览",
            "",
            "| 资源类型 | 数量 |",
            "|----------|------|",
            f"| 中继台 | {len(self.plan.repeater_stations)} |",
            f"| 补给站/值守点 | {len(self.plan.supply_stations)} |",
            f"| 志愿者班次 | {len(self.plan.volunteer_shifts)} |",
            f"| 通信设备 | {len(self.plan.devices)} |",
            f"| 编排条目 | {len(self.plan.schedule)} |",
            f"| 风险项 | {len(self.plan.risks)} |",
        ]
        return "\n".join(lines)
    
    def _generate_repeater_section(self) -> str:
        if not self.plan.repeater_stations:
            return "## 中继台配置\n\n> 无中继台配置\n"
        
        lines = [
            "## 中继台配置",
            "",
            "| ID | 名称 | 位置 (lat, lon) | 海拔 | 发射频率 | 接收频率 | 功率 | 覆盖半径 |",
            "|----|------|-----------------|------|----------|----------|------|----------|",
        ]
        
        for repeater in self.plan.repeater_stations:
            lines.append(
                f"| {repeater.id} | {repeater.name} | "
                f"{repeater.latitude:.4f}°, {repeater.longitude:.4f}° | "
                f"{repeater.elevation}m | "
                f"{repeater.tx_frequency:.3f} MHz | "
                f"{repeater.rx_frequency:.3f} MHz | "
                f"{repeater.power}W | "
                f"{repeater.coverage_radius_km}km |"
            )
        
        return "\n".join(lines)
    
    def _generate_station_section(self) -> str:
        if not self.plan.supply_stations:
            return "## 值守站点\n\n> 无值守站点配置\n"
        
        lines = [
            "## 值守站点",
            "",
            "| ID | 名称 | 距起点 | 位置 | 重要程度 | 覆盖状态 |",
            "|----|------|--------|------|----------|----------|",
        ]
        
        sorted_stations = sorted(
            self.plan.supply_stations,
            key=lambda s: s.distance_from_start
        )
        
        criticality_map = {
            "critical": "🔴 关键",
            "high": "🟠 高",
            "normal": "🟡 普通",
            "low": "🟢 低",
        }
        
        for station in sorted_stations:
            criticality_label = criticality_map.get(station.criticality, station.criticality)
            coverage_status = self._get_coverage_status(station)
            
            lines.append(
                f"| {station.id} | {station.name} | "
                f"{station.distance_from_start:.1f}km | "
                f"{station.latitude:.4f}°, {station.longitude:.4f}° | "
                f"{criticality_label} | {coverage_status} |"
            )
        
        return "\n".join(lines)
    
    def _get_coverage_status(self, station: SupplyStation) -> str:
        from freq_coordinator.scheduler.rules import SchedulerRules, calculate_haversine_distance
        
        rules = SchedulerRules(
            [station],
            self.plan.repeater_stations,
            [],
            [],
        )
        is_covered, distance, _ = rules.is_station_covered(station)
        
        if is_covered:
            return f"✅ 已覆盖 (最近 {distance:.1f}km)"
        return f"❌ 无覆盖 (最近 {distance:.1f}km)"
    
    def _generate_schedule_section(self) -> str:
        if not self.plan.schedule:
            return "## 值守排班表\n\n> 无排班数据\n"
        
        lines = [
            "## 值守排班表",
            "",
        ]
        
        schedule_by_station = defaultdict(list)
        for entry in self.plan.schedule:
            schedule_by_station[entry.station_id].append(entry)
        
        for station_id in sorted(schedule_by_station.keys()):
            entries = sorted(schedule_by_station[station_id], key=lambda e: e.start_time)
            station = next((s for s in self.plan.supply_stations if s.id == station_id), None)
            station_name = station.name if station else station_id
            
            lines.append(f"### {station_name} ({station_id})")
            lines.append("")
            lines.append("| 班次 | 志愿者 | 开始时间 | 结束时间 | 设备ID | 频道数 |")
            lines.append("|------|--------|----------|----------|--------|--------|")
            
            for entry in entries:
                lines.append(
                    f"| {entry.shift_id} | {entry.volunteer_name} | "
                    f"{self._format_time(entry.start_time)} | "
                    f"{self._format_time(entry.end_time)} | "
                    f"{entry.device_id} | "
                    f"{len(entry.assigned_channels)} |"
                )
            
            lines.append("")
        
        return "\n".join(lines)
    
    def _generate_channel_plan_section(self) -> str:
        lines = [
            "## 频道分配方案",
            "",
        ]
        
        emergency_channels = self.plan.channel_plan.get("*", [])
        if emergency_channels:
            lines.append("### 紧急频道（全站点共用）")
            lines.append("")
            lines.append("| 频道号 | 频率 | 用途 | 优先级 |")
            lines.append("|--------|------|------|--------|")
            for ch in emergency_channels:
                lines.append(
                    f"| {ch.channel_number} | {ch.frequency:.3f} MHz | "
                    f"{ch.purpose} | P{ch.priority} |"
                )
            lines.append("")
        
        for station_id, channels in sorted(self.plan.channel_plan.items()):
            if station_id == "*":
                continue
            if not channels:
                continue
            
            station = next((s for s in self.plan.supply_stations if s.id == station_id), None)
            station_name = station.name if station else station_id
            
            lines.append(f"### {station_name} ({station_id})")
            lines.append("")
            lines.append("| 频道号 | 频率 | 类型 | 中继台 | 用途 |")
            lines.append("|--------|------|------|--------|------|")
            
            for ch in channels:
                ch_type = "中继" if ch.is_repeater else "直频"
                repeater_id = ch.repeater_id or "-"
                lines.append(
                    f"| {ch.channel_number} | {ch.frequency:.3f} MHz | "
                    f"{ch_type} | {repeater_id} | {ch.purpose} |"
                )
            lines.append("")
        
        return "\n".join(lines)
    
    def _generate_risk_section(self) -> str:
        if not self.plan.risks:
            return "## 风险评估\n\n✅ 未检测到任何风险\n"
        
        lines = [
            "## 风险评估",
            "",
        ]
        
        critical_risks = [r for r in self.plan.risks if r.severity == "critical"]
        high_risks = [r for r in self.plan.risks if r.severity == "high"]
        medium_risks = [r for r in self.plan.risks if r.severity == "medium"]
        low_risks = [r for r in self.plan.risks if r.severity == "low"]
        
        severity_labels = {
            "critical": ("🔴", "严重"),
            "high": ("🟠", "高"),
            "medium": ("🟡", "中"),
            "low": ("🟢", "低"),
        }
        
        for severity, risks in [
            ("critical", critical_risks),
            ("high", high_risks),
            ("medium", medium_risks),
            ("low", low_risks),
        ]:
            if not risks:
                continue
            
            icon, label = severity_labels[severity]
            lines.append(f"### {icon} {label}优先级风险 ({len(risks)}项)")
            lines.append("")
            
            for risk in risks:
                lines.append(f"#### {risk.title}")
                lines.append("")
                lines.append(f"**风险类型**: {risk.type}")
                lines.append(f"**描述**: {risk.description}")
                if risk.affected_entities:
                    lines.append(f"**受影响实体**: {', '.join(risk.affected_entities)}")
                if risk.location:
                    lines.append(f"**位置**: {risk.location['latitude']:.4f}°, {risk.location['longitude']:.4f}°")
                if risk.time_window:
                    lines.append(
                        f"**时间窗口**: {self._format_time(risk.time_window['start'])} - "
                        f"{self._format_time(risk.time_window['end'])}"
                    )
                if risk.recommendation:
                    lines.append(f"**建议**: {risk.recommendation}")
                lines.append("")
        
        return "\n".join(lines)
    
    def _generate_appendix(self) -> str:
        lines = [
            "## 附录",
            "",
            "### 术语表",
            "",
            "- **直频**: 不经过中继台的直接通信",
            "- **中继**: 通过中继台转发的通信",
            "- **Tx**: 发射频率",
            "- **Rx**: 接收频率",
            "- **VHF**: 甚高频频段 (136-174 MHz)",
            "",
            "### 风险类型说明",
            "",
            "- **coverage_gap**: 站点无中继台覆盖",
            "- **frequency_conflict**: 频点冲突或邻近",
            "- **handover_gap**: 交接班间隔不足或有空档",
            "- **battery_risk**: 设备电池电量不足",
            "",
            "### 频道分配原则",
            "",
            "1. 紧急频道 (145.000 MHz) 所有站点共用",
            "2. 优先使用中继台覆盖的站点分配中继频率",
            "3. 无覆盖站点分配直频频道",
            "4. 相邻站点频率间隔至少 25 kHz",
        ]
        return "\n".join(lines)
    
    def _format_time(self, dt: datetime) -> str:
        return dt.strftime("%Y-%m-%d %H:%M")
