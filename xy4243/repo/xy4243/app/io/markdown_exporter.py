from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from app.models import (
    Prop, Scene, HandoverRecord, Violation,
    HandoverStatus, DangerLevel, CheckStatus
)
from app.rules import RulesEngineResult


@dataclass
class ExportConfig:
    title: str = "场务提示单"
    include_violations: bool = True
    include_dangerous_props: bool = True
    include_scene_summary: bool = True
    include_handover_details: bool = True
    include_notes: bool = True
    generated_by: str = "道具交接节拍器"


class MarkdownExporter:

    def __init__(self, config: Optional[ExportConfig] = None):
        self.config = config or ExportConfig()

    def export(
        self,
        props: List[Prop],
        scenes: List[Scene],
        handovers: List[HandoverRecord],
        violations: List[Violation],
        rules_result: Optional[RulesEngineResult] = None,
    ) -> str:
        lines = []

        lines.append(f"# {self.config.title}")
        lines.append("")
        lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"> 生成工具: {self.config.generated_by}")
        lines.append("")

        lines.append("---")
        lines.append("")

        lines.append("## 1. 概览")
        lines.append("")
        lines.append(f"- **道具总数**: {len(props)}")
        lines.append(f"- **场次总数**: {len(scenes)}")
        lines.append(f"- **交接记录**: {len(handovers)}")
        lines.append(f"- **问题/违规**: {len([v for v in violations if not v.resolved])}")
        lines.append("")

        if self.config.include_dangerous_props:
            lines.append("## 2. 危险品清单")
            lines.append("")
            dangerous_props = [p for p in props if p.is_dangerous or p.danger_level != DangerLevel.SAFE]
            
            if dangerous_props:
                lines.append("| 道具名称 | 危险等级 | 危险描述 | 复核要求 | 位置 |")
                lines.append("|----------|----------|----------|----------|------|")
                for prop in dangerous_props:
                    danger_level_name = prop.danger_level.name
                    needs_verify = "是" if prop.requires_verification else "否"
                    lines.append(f"| {prop.name} | {danger_level_name} | {prop.danger_description or '-'} | {needs_verify} | {prop.location or '-'} |")
            else:
                lines.append("> 无危险道具")
            lines.append("")

        if self.config.include_scene_summary:
            lines.append("## 3. 场次安排")
            lines.append("")
            lines.append("| 幕 | 场 | 标题 | 开始时间 | 结束时间 | 时长(分) |")
            lines.append("|----|----|------|----------|----------|----------|")
            
            for scene in scenes:
                start_time = scene.start_time.strftime("%H:%M") if scene.start_time else "-"
                end_time = scene.end_time.strftime("%H:%M") if scene.end_time else "-"
                lines.append(f"| {scene.act_number} | {scene.scene_number} | {scene.title or '-'} | {start_time} | {end_time} | {scene.duration_minutes} |")
            lines.append("")

        if self.config.include_handover_details:
            lines.append("## 4. 道具交接详情")
            lines.append("")

            handovers_by_scene: Dict[str, List[HandoverRecord]] = {}
            for handover in handovers:
                scene_key = handover.scene_title or handover.scene_id or "未知场次"
                if scene_key not in handovers_by_scene:
                    handovers_by_scene[scene_key] = []
                handovers_by_scene[scene_key].append(handover)

            for scene_title, scene_handovers in handovers_by_scene.items():
                lines.append(f"### {scene_title}")
                lines.append("")
                lines.append("| 道具名称 | 演员 | 状态 | 借出签名 | 归还签名 | 复核状态 |")
                lines.append("|----------|------|------|----------|----------|----------|")

                for handover in scene_handovers:
                    status_name = handover.status.name
                    signed_out = "✓" if handover.is_signed_out else "✗"
                    signed_in = "✓" if handover.is_signed_in else "✗"
                    verified = "✓" if handover.is_verified else "✗"
                    
                    lines.append(f"| {handover.prop_name} | {handover.actor_name} | {status_name} | {signed_out} | {signed_in} | {verified} |")

                if self.config.include_notes:
                    for handover in scene_handovers:
                        if handover.notes:
                            lines.append("")
                            lines.append(f"> **{handover.prop_name}**: {handover.notes}")

                lines.append("")

        if self.config.include_violations and violations:
            unresolved = [v for v in violations if not v.resolved]
            if unresolved:
                lines.append("## 5. 问题清单")
                lines.append("")

                critical = [v for v in unresolved if v.severity == "critical"]
                high = [v for v in unresolved if v.severity == "high"]
                medium = [v for v in unresolved if v.severity == "medium"]
                low = [v for v in unresolved if v.severity == "low"]

                if critical:
                    lines.append("### 🔴 严重问题 (CRITICAL)")
                    lines.append("")
                    for v in critical:
                        lines.append(f"- **{v.violation_type}**: {v.description}")
                        if v.prop_name:
                            lines.append(f"  - 道具: {v.prop_name}")
                        if v.scene_title:
                            lines.append(f"  - 场次: {v.scene_title}")
                        if v.actor_name:
                            lines.append(f"  - 演员: {v.actor_name}")
                        lines.append("")

                if high:
                    lines.append("### 🟠 高优先级问题 (HIGH)")
                    lines.append("")
                    for v in high:
                        lines.append(f"- **{v.violation_type}**: {v.description}")
                        if v.prop_name:
                            lines.append(f"  - 道具: {v.prop_name}")
                        if v.scene_title:
                            lines.append(f"  - 场次: {v.scene_title}")
                        if v.actor_name:
                            lines.append(f"  - 演员: {v.actor_name}")
                        lines.append("")

                if medium:
                    lines.append("### 🟡 中优先级问题 (MEDIUM)")
                    lines.append("")
                    for v in medium:
                        lines.append(f"- **{v.violation_type}**: {v.description}")
                        lines.append("")

                if low:
                    lines.append("### 🟢 低优先级问题 (LOW)")
                    lines.append("")
                    for v in low:
                        lines.append(f"- **{v.violation_type}**: {v.description}")
                    lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("*本提示单由「道具交接节拍器」自动生成*")

        return "\n".join(lines)

    def export_to_file(
        self,
        file_path: Path,
        props: List[Prop],
        scenes: List[Scene],
        handovers: List[HandoverRecord],
        violations: List[Violation],
        rules_result: Optional[RulesEngineResult] = None,
    ) -> Path:
        content = self.export(props, scenes, handovers, violations, rules_result)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return file_path
