import csv
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional
from collections import defaultdict

from .models import CardSwipeEvent, PermissionRecord, ZoneDefinition
from .timeline import TimelineResult, MergedEvent, TimelineGap
from .rules import RuleCheckResult, RuleViolation, ViolationType, ViolationSeverity
from .arbitration import ArbitrationSession, ArbitrationRecord, ArbitrationStatus


class ReportExporter:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(exist_ok=True)
    
    def export_all(
        self,
        timeline_result: TimelineResult,
        rule_result: RuleCheckResult,
        arbitration_session: Optional[ArbitrationSession] = None,
        prefix: str = ""
    ) -> Dict[str, Path]:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_filename = f"{prefix}report_{timestamp}" if prefix else f"report_{timestamp}"
        
        paths: Dict[str, Path] = {}
        
        paths["json"] = self.export_json(
            timeline_result, rule_result, arbitration_session,
            self.output_dir / f"{base_filename}.json"
        )
        
        paths["csv"] = self.export_csv(
            timeline_result, rule_result, arbitration_session,
            self.output_dir / f"{base_filename}.csv"
        )
        
        paths["markdown"] = self.export_markdown(
            timeline_result, rule_result, arbitration_session,
            self.output_dir / f"{base_filename}.md"
        )
        
        return paths
    
    def export_json(
        self,
        timeline_result: TimelineResult,
        rule_result: RuleCheckResult,
        arbitration_session: Optional[ArbitrationSession],
        output_path: Path
    ) -> Path:
        report: Dict[str, Any] = {
            "generated_at": datetime.now().isoformat(),
            "timeline_summary": {
                "total_events": timeline_result.total_events,
                "merged_count": timeline_result.merged_count,
                "device_count": len(timeline_result.device_offsets),
                "gap_count": len(timeline_result.gaps)
            },
            "device_offsets": [
                {
                    "device_id": do.device_id,
                    "offset_seconds": do.offset_seconds,
                    "confidence": do.confidence
                }
                for do in timeline_result.device_offsets.values()
            ],
            "merged_events": [
                {
                    "timeline_order": me.timeline_order,
                    "corrected_timestamp": me.corrected_timestamp.isoformat(),
                    "device_offset_seconds": me.device_offset_seconds,
                    "source_device": me.source_device,
                    "card_id": me.original_event.card_id,
                    "zone_id": me.original_event.zone_id,
                    "direction": me.original_event.direction.value,
                    "event_type": me.original_event.event_type.value,
                    "raw_timestamp": me.original_event.raw_timestamp,
                    "source_file": me.original_event.source_file,
                    "conflicts": me.conflict_notes
                }
                for me in timeline_result.merged_events
            ],
            "gaps": [
                {
                    "device_id": g.device_id,
                    "gap_start": g.gap_start.isoformat(),
                    "gap_end": g.gap_end.isoformat(),
                    "duration_minutes": g.duration_minutes,
                    "expected_events_count": g.expected_events_count
                }
                for g in timeline_result.gaps
            ],
            "rule_check": {
                "total_checked": rule_result.total_checked,
                "violation_count": len(rule_result.violations),
                "by_severity": {
                    str(k.value): v for k, v in rule_result.count_by_severity().items()
                },
                "by_type": {
                    str(k.value): v for k, v in rule_result.count_by_type().items()
                },
                "violations": [
                    {
                        "event_index": v.event_index,
                        "card_id": v.card_id,
                        "timestamp": v.timestamp.isoformat(),
                        "zone_id": v.zone_id,
                        "device_id": v.device_id,
                        "violation_type": v.violation_type.value,
                        "severity": v.severity.value,
                        "message": v.message,
                        "suggested_resolution": v.suggested_resolution,
                        "related_events": v.related_events
                    }
                    for v in rule_result.violations
                ]
            }
        }
        
        if arbitration_session:
            report["arbitration"] = {
                "session_id": arbitration_session.session_id,
                "created_at": arbitration_session.created_at.isoformat() if arbitration_session.created_at else None,
                "updated_at": arbitration_session.updated_at.isoformat() if arbitration_session.updated_at else None,
                "total_violations": arbitration_session.total_violations,
                "resolved_count": arbitration_session.resolved_count,
                "pending_count": arbitration_session.pending_count,
                "records": [
                    {
                        "event_index": r.event_index,
                        "card_id": r.card_id,
                        "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                        "violation_type": r.violation_type.value if r.violation_type else None,
                        "status": r.status.value,
                        "action_taken": r.action_taken.value if r.action_taken else None,
                        "arbitrator_notes": r.arbitrator_notes,
                        "arbitrated_at": r.arbitrated_at.isoformat() if r.arbitrated_at else None,
                        "arbitrated_by": r.arbitrated_by,
                        "resolved": r.resolved,
                        "resolution_details": r.resolution_details
                    }
                    for r in arbitration_session.records
                ]
            }
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False, default=str)
        
        return output_path
    
    def export_csv(
        self,
        timeline_result: TimelineResult,
        rule_result: RuleCheckResult,
        arbitration_session: Optional[ArbitrationSession],
        output_path: Path
    ) -> Path:
        violation_index: Dict[int, RuleViolation] = {
            v.event_index: v for v in rule_result.violations
        }
        
        arbitration_index: Dict[int, ArbitrationRecord] = {}
        if arbitration_session:
            arbitration_index = {
                r.event_index: r for r in arbitration_session.records
            }
        
        rows = []
        for me in timeline_result.merged_events:
            violation = violation_index.get(me.timeline_order)
            arbitration = arbitration_index.get(me.timeline_order)
            
            row = {
                "序号": me.timeline_order + 1,
                "校正时间": me.corrected_timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "原始时间": me.original_event.raw_timestamp,
                "设备偏移(秒)": me.device_offset_seconds,
                "设备ID": me.source_device,
                "卡号": me.original_event.card_id,
                "门区": me.original_event.zone_id,
                "方向": me.original_event.direction.value,
                "事件类型": me.original_event.event_type.value,
                "来源文件": me.original_event.source_file,
                "冲突标记": "; ".join(me.conflict_notes) if me.conflict_notes else "",
                "违规类型": violation.violation_type.value if violation else "",
                "违规级别": violation.severity.value if violation else "",
                "违规说明": violation.message if violation else "",
                "建议处理": violation.suggested_resolution if violation else "",
                "仲裁状态": arbitration.status.value if arbitration else "",
                "仲裁人": arbitration.arbitrated_by if arbitration else "",
                "仲裁时间": arbitration.arbitrated_at.strftime("%Y-%m-%d %H:%M:%S") if arbitration and arbitration.arbitrated_at else "",
                "仲裁备注": arbitration.arbitrator_notes if arbitration else "",
                "是否已解决": "是" if (arbitration and arbitration.resolved) else "否"
            }
            rows.append(row)
        
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            if rows:
                writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
                writer.writeheader()
                writer.writerows(rows)
        
        return output_path
    
    def export_markdown(
        self,
        timeline_result: TimelineResult,
        rule_result: RuleCheckResult,
        arbitration_session: Optional[ArbitrationSession],
        output_path: Path
    ) -> Path:
        lines = []
        
        lines.append("# 门禁刷卡冲突仲裁报告")
        lines.append("")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 概览")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总事件数 | {timeline_result.total_events} |")
        lines.append(f"| 合并事件数 | {timeline_result.merged_count} |")
        lines.append(f"| 设备数 | {len(timeline_result.device_offsets)} |")
        lines.append(f"| 时间缺口数 | {len(timeline_result.gaps)} |")
        lines.append(f"| 违规总数 | {len(rule_result.violations)} |")
        lines.append("")
        
        severity_counts = rule_result.count_by_severity()
        if severity_counts:
            lines.append("### 违规级别统计")
            lines.append("")
            lines.append("| 级别 | 数量 |")
            lines.append("|------|------|")
            for severity in [ViolationSeverity.CRITICAL, ViolationSeverity.HIGH, 
                            ViolationSeverity.MEDIUM, ViolationSeverity.LOW]:
                count = severity_counts.get(severity, 0)
                lines.append(f"| {severity.value} | {count} |")
            lines.append("")
        
        type_counts = rule_result.count_by_type()
        if type_counts:
            lines.append("### 违规类型统计")
            lines.append("")
            lines.append("| 类型 | 数量 |")
            lines.append("|------|------|")
            for vtype, count in type_counts.items():
                lines.append(f"| {vtype.value} | {count} |")
            lines.append("")
        
        if arbitration_session:
            lines.append("### 仲裁进度")
            lines.append("")
            lines.append(f"- 会话ID: {arbitration_session.session_id}")
            lines.append(f"- 总违规数: {arbitration_session.total_violations}")
            lines.append(f"- 已解决: {arbitration_session.resolved_count}")
            lines.append(f"- 待处理: {arbitration_session.pending_count}")
            lines.append(f"- 完成率: {arbitration_session.resolved_count / arbitration_session.total_violations * 100:.1f}%" if arbitration_session.total_violations > 0 else "- 完成率: 0%")
            lines.append("")
        
        lines.append("## 设备时钟偏移")
        lines.append("")
        lines.append("| 设备ID | 偏移(秒) | 置信度 |")
        lines.append("|--------|----------|--------|")
        for device_id, offset in timeline_result.device_offsets.items():
            lines.append(f"| {device_id} | {offset.offset_seconds} | {offset.confidence:.2f} |")
        lines.append("")
        
        if timeline_result.gaps:
            lines.append("## 时间缺口检测")
            lines.append("")
            lines.append("| 设备ID | 缺口开始 | 缺口结束 | 持续时间(分钟) | 预计缺失事件数 |")
            lines.append("|--------|----------|----------|----------------|----------------|")
            for gap in timeline_result.gaps:
                lines.append(f"| {gap.device_id} | {gap.gap_start.strftime('%Y-%m-%d %H:%M:%S')} | {gap.gap_end.strftime('%Y-%m-%d %H:%M:%S')} | {gap.duration_minutes:.1f} | {gap.expected_events_count} |")
            lines.append("")
        
        if rule_result.violations:
            lines.append("## 违规详情")
            lines.append("")
            
            arbitration_index: Dict[int, ArbitrationRecord] = {}
            if arbitration_session:
                arbitration_index = {r.event_index: r for r in arbitration_session.records}
            
            for v in rule_result.violations:
                arbitration = arbitration_index.get(v.event_index)
                status_str = f" [{arbitration.status.value}]" if arbitration else ""
                
                lines.append(f"### 违规 #{v.event_index + 1}{status_str}")
                lines.append("")
                lines.append(f"- **类型**: {v.violation_type.value}")
                lines.append(f"- **级别**: {v.severity.value}")
                lines.append(f"- **卡号**: {v.card_id}")
                lines.append(f"- **时间**: {v.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
                lines.append(f"- **门区**: {v.zone_id}")
                lines.append(f"- **设备**: {v.device_id}")
                lines.append(f"- **说明**: {v.message}")
                if v.suggested_resolution:
                    lines.append(f"- **建议处理**: {v.suggested_resolution}")
                if arbitration:
                    lines.append(f"- **仲裁状态**: {arbitration.status.value}")
                    lines.append(f"- **仲裁人**: {arbitration.arbitrated_by}")
                    if arbitration.arbitrated_at:
                        lines.append(f"- **仲裁时间**: {arbitration.arbitrated_at.strftime('%Y-%m-%d %H:%M:%S')}")
                    if arbitration.arbitrator_notes:
                        lines.append(f"- **仲裁备注**: {arbitration.arbitrator_notes}")
                lines.append("")
        
        lines.append("## 事件时间线")
        lines.append("")
        lines.append("| 序号 | 校正时间 | 卡号 | 门区 | 方向 | 设备 | 违规 | 仲裁 |")
        lines.append("|------|----------|------|------|------|------|------|------|")
        
        violation_set = {v.event_index for v in rule_result.violations}
        for me in timeline_result.merged_events:
            has_violation = "✓" if me.timeline_order in violation_set else ""
            arbitration = arbitration_index.get(me.timeline_order) if arbitration_session else None
            arbit_status = arbitration.status.value if arbitration else ""
            
            lines.append(
                f"| {me.timeline_order + 1} | "
                f"{me.corrected_timestamp.strftime('%Y-%m-%d %H:%M:%S')} | "
                f"{me.original_event.card_id} | "
                f"{me.original_event.zone_id} | "
                f"{me.original_event.direction.value} | "
                f"{me.source_device} | "
                f"{has_violation} | "
                f"{arbit_status} |"
            )
        
        lines.append("")
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        
        return output_path
