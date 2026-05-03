import csv
import os
from typing import Dict, List, Optional
from datetime import datetime

from models import (
    ShowData, Scene, PropUsage, Cue, Alert, AlertType, CheckStatus
)


class MarkdownExporter:
    def export(self, show_data: ShowData, output_path: str) -> str:
        lines = []
        
        lines.append(f"# {show_data.show_name or '演出道具清单'}")
        lines.append("")
        
        if show_data.show_date:
            lines.append(f"**演出日期**: {show_data.show_date.strftime('%Y-%m-%d')}")
        if show_data.last_updated:
            lines.append(f"**生成时间**: {show_data.last_updated.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 目录")
        lines.append("")
        lines.append("1. [演出概览](#演出概览)")
        lines.append("2. [道具清单](#道具清单)")
        lines.append("3. [按场景分类](#按场景分类)")
        lines.append("4. [异常报告](#异常报告)")
        lines.append("5. [演员状态](#演员状态)")
        lines.append("")
        
        lines.append("## 演出概览")
        lines.append("")
        lines.append(f"- **总场次数**: {len(show_data.scenes)}")
        lines.append(f"- **道具总数**: {len(show_data.props)}")
        lines.append(f"- **演员总数**: {len(show_data.actors)}")
        lines.append(f"- **异常数量**: {len(show_data.alerts)}")
        
        pending_props = 0
        checked_props = 0
        issue_props = 0
        for scene in show_data.scenes.values():
            for prop_usage in scene.props:
                if prop_usage.check_status == CheckStatus.PENDING:
                    pending_props += 1
                elif prop_usage.check_status == CheckStatus.CHECKED:
                    checked_props += 1
                elif prop_usage.check_status == CheckStatus.ISSUE:
                    issue_props += 1
                    
        lines.append(f"- **道具核对状态**: 待核对 {pending_props} | 已核对 {checked_props} | 有问题 {issue_props}")
        lines.append("")
        
        lines.append("## 道具清单")
        lines.append("")
        
        for prop_id, prop in show_data.props.items():
            scenes_used = []
            for scene in show_data.scenes.values():
                for prop_usage in scene.props:
                    if prop_usage.prop_id == prop_id:
                        scenes_used.append(f"{scene.name} ({prop_usage.usage_type})")
                        
            lines.append(f"### {prop.name}")
            lines.append("")
            if prop.photo_path:
                lines.append(f"- **照片**: `{os.path.basename(prop.photo_path)}`")
            else:
                lines.append(f"- **照片**: ⚠️ 缺失")
            if prop.notes:
                lines.append(f"- **备注**: {prop.notes}")
            if scenes_used:
                lines.append(f"- **使用场景**: {', '.join(scenes_used)}")
            lines.append("")
        
        lines.append("## 按场景分类")
        lines.append("")
        
        sorted_scenes = sorted(
            show_data.scenes.values(),
            key=lambda s: (s.act, s.scene_number)
        )
        
        for scene in sorted_scenes:
            lines.append(f"### 第{scene.act}幕 - {scene.name}")
            lines.append("")
            
            if scene.duration > 0:
                lines.append(f"- **预计时长**: {scene.duration} 分钟")
            if scene.notes:
                lines.append(f"- **备注**: {scene.notes}")
            lines.append("")
            
            enter_props = [p for p in scene.props if p.usage_type == "上场"]
            exit_props = [p for p in scene.props if p.usage_type == "撤场"]
            
            if enter_props:
                lines.append("#### 上场道具")
                lines.append("")
                lines.append("| 状态 | 道具名称 | 负责演员 | 备注 |")
                lines.append("|------|----------|----------|------|")
                for prop in enter_props:
                    status_icon = self._get_status_icon(prop.check_status)
                    actor = prop.actor_name or "-"
                    notes = prop.notes or "-"
                    lines.append(f"| {status_icon} | {prop.prop_name} | {actor} | {notes} |")
                lines.append("")
                
            if exit_props:
                lines.append("#### 撤场道具")
                lines.append("")
                lines.append("| 状态 | 道具名称 | 负责演员 | 备注 |")
                lines.append("|------|----------|----------|------|")
                for prop in exit_props:
                    status_icon = self._get_status_icon(prop.check_status)
                    actor = prop.actor_name or "-"
                    notes = prop.notes or "-"
                    lines.append(f"| {status_icon} | {prop.prop_name} | {actor} | {notes} |")
                lines.append("")
                
            if scene.cues:
                lines.append("#### 提示词")
                lines.append("")
                lines.append("| 类型 | 内容 | 演员 | 备注 |")
                lines.append("|------|------|------|------|")
                for cue in scene.cues:
                    actor = cue.actor_name or "-"
                    notes = cue.notes or "-"
                    lines.append(f"| {cue.cue_type} | {cue.content} | {actor} | {notes} |")
                lines.append("")
        
        lines.append("## 异常报告")
        lines.append("")
        
        if not show_data.alerts:
            lines.append("✅ 无异常")
            lines.append("")
        else:
            alert_types = {
                AlertType.PROP_CONFLICT: ("道具冲突", "🔴"),
                AlertType.ACTOR_MISSING: ("演员未到", "🟡"),
                AlertType.PHOTO_MISSING: ("照片缺失", "🟠"),
                AlertType.TRANSITION_SHORT: ("换场时间不足", "🟣")
            }
            
            for alert_type, (type_name, icon) in alert_types.items():
                type_alerts = [a for a in show_data.alerts if a.alert_type == alert_type]
                if type_alerts:
                    lines.append(f"### {icon} {type_name} ({len(type_alerts)}项)")
                    lines.append("")
                    lines.append("| 状态 | 场景 | 描述 | 详情 |")
                    lines.append("|------|------|------|------|")
                    for alert in type_alerts:
                        status = "✅ 已解决" if alert.resolved else "⚠️ 未解决"
                        scene_name = alert.details.get('scene1_name', alert.details.get('from_scene_name', '-'))
                        if 'scene2_name' in alert.details:
                            scene_name += f" → {alert.details['scene2_name']}"
                        elif 'to_scene_name' in alert.details:
                            scene_name += f" → {alert.details['to_scene_name']}"
                        details_parts = []
                        if alert.details.get('props_to_remove'):
                            details_parts.append(f"撤场: {', '.join(alert.details['props_to_remove'])}")
                        if alert.details.get('props_to_add'):
                            details_parts.append(f"上场: {', '.join(alert.details['props_to_add'])}")
                        if alert.details.get('estimated_time_needed'):
                            details_parts.append(f"预计需要 {alert.details['estimated_time_needed']} 秒")
                        details = "; ".join(details_parts) if details_parts else "-"
                        lines.append(f"| {status} | {scene_name} | {alert.message} | {details} |")
                    lines.append("")
        
        lines.append("## 演员状态")
        lines.append("")
        
        if show_data.actors:
            lines.append("| 状态 | 演员姓名 | 备注 |")
            lines.append("|------|----------|------|")
            for actor_id, actor in show_data.actors.items():
                status = "✅ 已到" if actor.is_present else "❌ 未到"
                notes = actor.notes or "-"
                lines.append(f"| {status} | {actor.name} | {notes} |")
        else:
            lines.append("无演员数据")
        lines.append("")
        
        content = "\n".join(lines)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
            
        return output_path

    def _get_status_icon(self, status: CheckStatus) -> str:
        if status == CheckStatus.PENDING:
            return "⏳ 待核对"
        elif status == CheckStatus.CHECKED:
            return "✅ 已核对"
        elif status == CheckStatus.ISSUE:
            return "❌ 有问题"
        return "⏳"


class CSVExporter:
    def export_props(self, show_data: ShowData, output_path: str) -> str:
        rows = []
        
        header = [
            "幕", "场", "场景名称", "道具ID", "道具名称", "类型", 
            "负责演员ID", "负责演员", "状态", "备注"
        ]
        rows.append(header)
        
        sorted_scenes = sorted(
            show_data.scenes.values(),
            key=lambda s: (s.act, s.scene_number)
        )
        
        for scene in sorted_scenes:
            for prop_usage in scene.props:
                status = self._get_status_text(prop_usage.check_status)
                row = [
                    scene.act,
                    scene.scene_number,
                    scene.name,
                    prop_usage.prop_id,
                    prop_usage.prop_name,
                    prop_usage.usage_type,
                    prop_usage.actor_id or "",
                    prop_usage.actor_name or "",
                    status,
                    prop_usage.notes or ""
                ]
                rows.append(row)
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
            
        return output_path

    def export_alerts(self, show_data: ShowData, output_path: str) -> str:
        rows = []
        
        header = [
            "序号", "类型", "状态", "场景", "消息", "详情", "已解决"
        ]
        rows.append(header)
        
        for idx, alert in enumerate(show_data.alerts, 1):
            alert_type_text = self._get_alert_type_text(alert.alert_type)
            status = self._get_status_text(alert.check_status)
            scene_name = alert.details.get('scene1_name', alert.details.get('from_scene_name', ''))
            if 'scene2_name' in alert.details:
                scene_name += f" → {alert.details['scene2_name']}"
            elif 'to_scene_name' in alert.details:
                scene_name += f" → {alert.details['to_scene_name']}"
                
            details_str = str(alert.details) if alert.details else ""
            resolved = "是" if alert.resolved else "否"
            
            row = [
                idx,
                alert_type_text,
                status,
                scene_name,
                alert.message,
                details_str,
                resolved
            ]
            rows.append(row)
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
            
        return output_path

    def export_cues(self, show_data: ShowData, output_path: str) -> str:
        rows = []
        
        header = [
            "幕", "场", "场景名称", "提示词ID", "类型", "内容", "演员ID", "演员", "备注"
        ]
        rows.append(header)
        
        sorted_scenes = sorted(
            show_data.scenes.values(),
            key=lambda s: (s.act, s.scene_number)
        )
        
        for scene in sorted_scenes:
            for cue in scene.cues:
                row = [
                    scene.act,
                    scene.scene_number,
                    scene.name,
                    cue.id,
                    cue.cue_type,
                    cue.content,
                    cue.actor_id or "",
                    cue.actor_name or "",
                    cue.notes or ""
                ]
                rows.append(row)
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
            
        return output_path

    def _get_status_text(self, status: CheckStatus) -> str:
        if status == CheckStatus.PENDING:
            return "待核对"
        elif status == CheckStatus.CHECKED:
            return "已核对"
        elif status == CheckStatus.ISSUE:
            return "有问题"
        return "待核对"

    def _get_alert_type_text(self, alert_type: AlertType) -> str:
        mapping = {
            AlertType.PROP_CONFLICT: "道具冲突",
            AlertType.ACTOR_MISSING: "演员未到",
            AlertType.PHOTO_MISSING: "照片缺失",
            AlertType.TRANSITION_SHORT: "换场时间不足"
        }
        return mapping.get(alert_type, "未知")
