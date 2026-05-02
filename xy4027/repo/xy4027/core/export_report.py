import os
import csv
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum

from models.database import MarkStatus, RiskLevel, RuleType, SensitiveHit, Project


@dataclass
class ExportItem:
    hit_id: int
    start_time: float
    end_time: float
    duration: float
    rule_type: str
    rule_name: str
    matched_text: str
    context_before: str
    context_after: str
    risk_level: str
    mark_status: str
    is_manual: bool
    manual_note: str
    is_duplicate: bool


@dataclass
class ExportSummary:
    project_name: str
    project_id: int
    created_at: str
    export_time: str
    
    total_hits: int
    high_risk: int
    medium_risk: int
    low_risk: int
    
    keep_count: int
    mute_count: int
    beep_count: int
    review_count: int
    
    manual_hits: int
    duplicate_hits: int


class ExportHandlerError(Exception):
    pass


class ExportHandler:
    
    @classmethod
    def format_time(cls, seconds: float) -> str:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        
        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"
        else:
            return f"{minutes:02d}:{secs:02d},{millis:03d}"
    
    @classmethod
    def format_time_short(cls, seconds: float) -> str:
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{minutes:02d}:{secs:02d}.{millis:03d}"
    
    @classmethod
    def hits_to_export_items(cls, hits: List[SensitiveHit]) -> List[ExportItem]:
        items: List[ExportItem] = []
        
        for hit in hits:
            risk_level = hit.risk_level.value if isinstance(hit.risk_level, RiskLevel) else str(hit.risk_level)
            mark_status = hit.mark_status.value if isinstance(hit.mark_status, MarkStatus) else str(hit.mark_status)
            rule_type = hit.rule_type.value if isinstance(hit.rule_type, RuleType) else str(hit.rule_type)
            
            items.append(ExportItem(
                hit_id=hit.id,
                start_time=hit.start_time,
                end_time=hit.end_time,
                duration=hit.end_time - hit.start_time,
                rule_type=rule_type,
                rule_name=hit.rule_name or "",
                matched_text=hit.matched_text,
                context_before=hit.context_before or "",
                context_after=hit.context_after or "",
                risk_level=risk_level,
                mark_status=mark_status,
                is_manual=hit.is_manual,
                manual_note=hit.manual_note or "",
                is_duplicate=hit.is_duplicate
            ))
        
        return items
    
    @classmethod
    def create_summary(cls, project: Project, hits: List[ExportItem]) -> ExportSummary:
        total = len(hits)
        
        high_risk = sum(1 for h in hits if h.risk_level == "high")
        medium_risk = sum(1 for h in hits if h.risk_level == "medium")
        low_risk = sum(1 for h in hits if h.risk_level == "low")
        
        keep_count = sum(1 for h in hits if h.mark_status == "keep")
        mute_count = sum(1 for h in hits if h.mark_status == "mute")
        beep_count = sum(1 for h in hits if h.mark_status == "beep")
        review_count = sum(1 for h in hits if h.mark_status == "review")
        
        manual_hits = sum(1 for h in hits if h.is_manual)
        duplicate_hits = sum(1 for h in hits if h.is_duplicate)
        
        return ExportSummary(
            project_name=project.name,
            project_id=project.id,
            created_at=project.created_at.strftime("%Y-%m-%d %H:%M:%S") if project.created_at else "",
            export_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            total_hits=total,
            high_risk=high_risk,
            medium_risk=medium_risk,
            low_risk=low_risk,
            keep_count=keep_count,
            mute_count=mute_count,
            beep_count=beep_count,
            review_count=review_count,
            manual_hits=manual_hits,
            duplicate_hits=duplicate_hits
        )
    
    @classmethod
    def export_csv(
        cls,
        output_path: str,
        items: List[ExportItem],
        summary: Optional[ExportSummary] = None,
        overwrite: bool = False
    ) -> Tuple[str, List[str]]:
        warnings: List[str] = []
        
        if os.path.exists(output_path):
            if not overwrite:
                raise ExportHandlerError(
                    f"输出文件已存在: {output_path}\n"
                    f"请选择其他位置或启用覆盖选项。"
                )
            else:
                warnings.append(f"覆盖已存在的文件: {output_path}")
        
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            if summary:
                writer.writerow(["# 项目名称", summary.project_name])
                writer.writerow(["# 项目ID", summary.project_id])
                writer.writerow(["# 创建时间", summary.created_at])
                writer.writerow(["# 导出时间", summary.export_time])
                writer.writerow([])
                
                writer.writerow(["# 统计摘要"])
                writer.writerow(["总命中数", "高风险", "中风险", "低风险"])
                writer.writerow([summary.total_hits, summary.high_risk, summary.medium_risk, summary.low_risk])
                writer.writerow([])
                
                writer.writerow(["# 处理状态"])
                writer.writerow(["保留", "静音", "哔声", "待复核"])
                writer.writerow([summary.keep_count, summary.mute_count, summary.beep_count, summary.review_count])
                writer.writerow([])
                
                writer.writerow(["# 手动/重复"])
                writer.writerow(["手动添加", "重复命中"])
                writer.writerow([summary.manual_hits, summary.duplicate_hits])
                writer.writerow([])
            
            writer.writerow([
                "序号", "开始时间", "结束时间", "时长", "规则类型", "规则名称",
                "匹配文本", "上文", "下文", "风险等级", "处理状态",
                "手动添加", "备注", "重复"
            ])
            
            for idx, item in enumerate(items, 1):
                writer.writerow([
                    idx,
                    cls.format_time_short(item.start_time),
                    cls.format_time_short(item.end_time),
                    f"{item.duration:.3f}s",
                    item.rule_type,
                    item.rule_name,
                    item.matched_text,
                    item.context_before,
                    item.context_after,
                    item.risk_level,
                    item.mark_status,
                    "是" if item.is_manual else "否",
                    item.manual_note,
                    "是" if item.is_duplicate else "否"
                ])
        
        return output_path, warnings
    
    @classmethod
    def export_json(
        cls,
        output_path: str,
        items: List[ExportItem],
        summary: Optional[ExportSummary] = None,
        overwrite: bool = False
    ) -> Tuple[str, List[str]]:
        warnings: List[str] = []
        
        if os.path.exists(output_path):
            if not overwrite:
                raise ExportHandlerError(
                    f"输出文件已存在: {output_path}\n"
                    f"请选择其他位置或启用覆盖选项。"
                )
            else:
                warnings.append(f"覆盖已存在的文件: {output_path}")
        
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        output: Dict[str, Any] = {
            "version": "1.0",
            "export_time": datetime.now().isoformat()
        }
        
        if summary:
            output["summary"] = asdict(summary)
        
        output["hits"] = []
        for item in items:
            output["hits"].append({
                "hit_id": item.hit_id,
                "start_time": item.start_time,
                "end_time": item.end_time,
                "duration": item.duration,
                "start_time_str": cls.format_time_short(item.start_time),
                "end_time_str": cls.format_time_short(item.end_time),
                "rule_type": item.rule_type,
                "rule_name": item.rule_name,
                "matched_text": item.matched_text,
                "context_before": item.context_before,
                "context_after": item.context_after,
                "risk_level": item.risk_level,
                "mark_status": item.mark_status,
                "is_manual": item.is_manual,
                "manual_note": item.manual_note,
                "is_duplicate": item.is_duplicate
            })
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        
        return output_path, warnings
    
    @classmethod
    def export_markdown_report(
        cls,
        output_path: str,
        items: List[ExportItem],
        summary: ExportSummary,
        project_info: Optional[Dict[str, Any]] = None,
        overwrite: bool = False
    ) -> Tuple[str, List[str]]:
        warnings: List[str] = []
        
        if os.path.exists(output_path):
            if not overwrite:
                raise ExportHandlerError(
                    f"输出文件已存在: {output_path}\n"
                    f"请选择其他位置或启用覆盖选项。"
                )
            else:
                warnings.append(f"覆盖已存在的文件: {output_path}")
        
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        lines: List[str] = []
        
        lines.append("# 口播脱敏剪刀 - 交付报告")
        lines.append("")
        lines.append(f"> 生成时间: {summary.export_time}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 项目信息")
        lines.append("")
        lines.append(f"- **项目名称**: {summary.project_name}")
        lines.append(f"- **项目ID**: {summary.project_id}")
        lines.append(f"- **创建时间**: {summary.created_at}")
        
        if project_info:
            if project_info.get("audio_path"):
                lines.append(f"- **音频文件**: {os.path.basename(project_info['audio_path'])}")
            if project_info.get("transcription_path"):
                lines.append(f"- **转写文件**: {os.path.basename(project_info['transcription_path'])}")
        
        lines.append("")
        
        lines.append("## 统计摘要")
        lines.append("")
        
        lines.append("### 风险分布")
        lines.append("")
        lines.append("| 风险等级 | 数量 | 占比 |")
        lines.append("|---------|------|------|")
        
        if summary.total_hits > 0:
            high_pct = (summary.high_risk / summary.total_hits) * 100
            medium_pct = (summary.medium_risk / summary.total_hits) * 100
            low_pct = (summary.low_risk / summary.total_hits) * 100
        else:
            high_pct = medium_pct = low_pct = 0
        
        lines.append(f"| 🔴 高风险 | {summary.high_risk} | {high_pct:.1f}% |")
        lines.append(f"| 🟡 中风险 | {summary.medium_risk} | {medium_pct:.1f}% |")
        lines.append(f"| 🟢 低风险 | {summary.low_risk} | {low_pct:.1f}% |")
        lines.append(f"| **总计** | **{summary.total_hits}** | **100%** |")
        lines.append("")
        
        lines.append("### 处理状态")
        lines.append("")
        lines.append("| 处理方式 | 数量 | 说明 |")
        lines.append("|---------|------|------|")
        lines.append(f"| ✅ 保留 | {summary.keep_count} | 确认不包含敏感信息 |")
        lines.append(f"| 🔇 静音 | {summary.mute_count} | 已替换为静音 |")
        lines.append(f"| 🔔 哔声 | {summary.beep_count} | 已替换为提示音 |")
        lines.append(f"| ⚠️ 待复核 | {summary.review_count} | 需要进一步确认 |")
        lines.append("")
        
        lines.append("### 其他统计")
        lines.append("")
        lines.append(f"- 手动添加的片段: {summary.manual_hits}")
        lines.append(f"- 重复命中的片段: {summary.duplicate_hits}")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        
        lines.append("## 明细列表")
        lines.append("")
        
        if not items:
            lines.append("> 没有检测到敏感信息片段。")
        else:
            for idx, item in enumerate(items, 1):
                risk_emoji = "🔴" if item.risk_level == "high" else ("🟡" if item.risk_level == "medium" else "🟢")
                status_icon = {
                    "keep": "✅",
                    "mute": "🔇",
                    "beep": "🔔",
                    "review": "⚠️"
                }.get(item.mark_status, "❓")
                
                status_text = {
                    "keep": "保留",
                    "mute": "静音",
                    "beep": "哔声",
                    "review": "待复核"
                }.get(item.mark_status, item.mark_status)
                
                lines.append(f"### {idx}. {item.rule_name}")
                lines.append("")
                
                lines.append(f"- **时间**: {cls.format_time_short(item.start_time)} - {cls.format_time_short(item.end_time)}")
                lines.append(f"- **时长**: {item.duration:.3f}秒")
                lines.append(f"- **规则类型**: {item.rule_type}")
                lines.append(f"- **风险等级**: {risk_emoji} {item.risk_level}")
                lines.append(f"- **处理状态**: {status_icon} {status_text}")
                
                if item.is_manual:
                    lines.append(f"- **手动添加**: 是")
                if item.is_duplicate:
                    lines.append(f"- **重复命中**: 是")
                
                lines.append("")
                lines.append(f"**匹配文本**: `{item.matched_text}`")
                lines.append("")
                
                if item.context_before:
                    lines.append(f"**上下文（前）**: ...{item.context_before}")
                if item.context_after:
                    lines.append(f"**上下文（后）**: {item.context_after}...")
                
                if item.manual_note:
                    lines.append("")
                    lines.append(f"**备注**: {item.manual_note}")
                
                lines.append("")
                lines.append("---")
                lines.append("")
        
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("> 此报告由「口播脱敏剪刀」自动生成")
        lines.append(f"> 报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        
        return output_path, warnings
