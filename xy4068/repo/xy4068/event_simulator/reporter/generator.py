import json
import shutil
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from event_simulator.models.event import Event
from event_simulator.validation.validator import ValidationResult


class ReportGenerator:
    def __init__(self, output_dir: Optional[Path] = None):
        self.output_dir = output_dir or Path.cwd() / "reports"
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def generate(
        self,
        report_id: str,
        events: List[Event],
        validation_result: Optional[ValidationResult] = None,
        replay_metadata: Optional[Dict[str, Any]] = None,
        scenario_info: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Path]:
        report_data = self._build_report_data(
            report_id=report_id,
            events=events,
            validation_result=validation_result,
            replay_metadata=replay_metadata,
            scenario_info=scenario_info,
        )
        
        json_path = self._write_json_report(report_id, report_data)
        md_path = self._write_markdown_report(report_id, report_data)
        
        return {
            "json": json_path,
            "markdown": md_path,
        }
    
    def _build_report_data(
        self,
        report_id: str,
        events: List[Event],
        validation_result: Optional[ValidationResult] = None,
        replay_metadata: Optional[Dict[str, Any]] = None,
        scenario_info: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        event_stats = self._calculate_event_stats(events)
        
        return {
            "report_id": report_id,
            "generated_at": datetime.now().isoformat(),
            "scenario": scenario_info or {},
            "replay": replay_metadata or {},
            "events": {
                "total": len(events),
                "by_type": event_stats["by_type"],
                "by_camera": event_stats["by_camera"],
                "by_severity": event_stats["by_severity"],
                "time_range": {
                    "start": event_stats["start_time"].isoformat() if event_stats["start_time"] else None,
                    "end": event_stats["end_time"].isoformat() if event_stats["end_time"] else None,
                    "duration_seconds": event_stats["duration_seconds"],
                },
                "sample": [e.to_dict() for e in events[:10]] if events else [],
            },
            "validation": self._build_validation_section(validation_result),
            "summary": self._build_summary(
                events=events,
                event_stats=event_stats,
                validation_result=validation_result,
            ),
        }
    
    def _calculate_event_stats(self, events: List[Event]) -> Dict[str, Any]:
        by_type: Dict[str, int] = {}
        by_camera: Dict[str, int] = {}
        by_severity: Dict[str, int] = {}
        
        start_time: Optional[datetime] = None
        end_time: Optional[datetime] = None
        
        for event in events:
            by_type[event.event_type] = by_type.get(event.event_type, 0) + 1
            by_camera[event.camera_id] = by_camera.get(event.camera_id, 0) + 1
            by_severity[event.severity] = by_severity.get(event.severity, 0) + 1
            
            if start_time is None or event.timestamp < start_time:
                start_time = event.timestamp
            if end_time is None or event.timestamp > end_time:
                end_time = event.timestamp
        
        duration_seconds = 0.0
        if start_time and end_time:
            duration_seconds = (end_time - start_time).total_seconds()
        
        return {
            "by_type": by_type,
            "by_camera": by_camera,
            "by_severity": by_severity,
            "start_time": start_time,
            "end_time": end_time,
            "duration_seconds": duration_seconds,
        }
    
    def _build_validation_section(
        self, validation_result: Optional[ValidationResult]
    ) -> Dict[str, Any]:
        if not validation_result:
            return {"valid": True, "total_errors": 0, "total_warnings": 0, "details": []}
        
        return {
            "valid": validation_result.valid,
            "total_events": validation_result.total_events,
            "total_errors": validation_result.total_errors,
            "total_warnings": validation_result.total_warnings,
            "rules_executed": validation_result.rules_executed,
            "validation_time": validation_result.validation_time.isoformat()
            if validation_result.validation_time
            else None,
            "duration_ms": validation_result.duration_ms,
            "errors": [e.to_dict() for e in validation_result.errors],
            "warnings": [w.to_dict() for w in validation_result.warnings],
        }
    
    def _build_summary(
        self,
        events: List[Event],
        event_stats: Dict[str, Any],
        validation_result: Optional[ValidationResult],
    ) -> Dict[str, Any]:
        status = "PASS"
        issues = []
        
        if validation_result:
            if not validation_result.valid:
                status = "FAIL"
                issues.append(f"存在 {validation_result.total_errors} 个错误")
            if validation_result.total_warnings > 0:
                issues.append(f"存在 {validation_result.total_warnings} 个警告")
        
        if not events:
            status = "WARN"
            issues.append("事件流为空")
        
        return {
            "status": status,
            "issues": issues,
            "event_count": len(events),
            "duration_seconds": event_stats["duration_seconds"],
            "camera_count": len(event_stats["by_camera"]),
            "event_type_count": len(event_stats["by_type"]),
        }
    
    def _write_json_report(self, report_id: str, report_data: Dict[str, Any]) -> Path:
        report_file = self.output_dir / f"{report_id}.json"
        
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".json",
            dir=self.output_dir,
            delete=False,
            encoding="utf-8",
        ) as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)
            temp_path = Path(f.name)
        
        shutil.move(str(temp_path), str(report_file))
        return report_file
    
    def _write_markdown_report(self, report_id: str, report_data: Dict[str, Any]) -> Path:
        md_content = self._generate_markdown(report_data)
        report_file = self.output_dir / f"{report_id}.md"
        
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".md",
            dir=self.output_dir,
            delete=False,
            encoding="utf-8",
        ) as f:
            f.write(md_content)
            temp_path = Path(f.name)
        
        shutil.move(str(temp_path), str(report_file))
        return report_file
    
    def _generate_markdown(self, report_data: Dict[str, Any]) -> str:
        lines = []
        
        lines.append(f"# 事件流仿真审计报告")
        lines.append("")
        lines.append(f"> 报告ID: `{report_data['report_id']}`")
        lines.append(f"> 生成时间: {report_data['generated_at']}")
        lines.append("")
        
        summary = report_data["summary"]
        status_emoji = "✅" if summary["status"] == "PASS" else "❌" if summary["status"] == "FAIL" else "⚠️"
        lines.append(f"## 执行摘要: {status_emoji} {summary['status']}")
        lines.append("")
        lines.append("| 指标 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 事件总数 | {summary['event_count']} |")
        lines.append(f"| 持续时间 | {summary['duration_seconds']:.2f} 秒 |")
        lines.append(f"| 涉及摄像头 | {summary['camera_count']} 个 |")
        lines.append(f"| 事件类型 | {summary['event_type_count']} 种 |")
        lines.append("")
        
        if summary["issues"]:
            lines.append("### 发现的问题")
            lines.append("")
            for issue in summary["issues"]:
                lines.append(f"- ⚠️ {issue}")
            lines.append("")
        
        scenario = report_data.get("scenario", {})
        if scenario:
            lines.append("## 场景信息")
            lines.append("")
            if scenario.get("name"):
                lines.append(f"- **场景名称**: {scenario['name']}")
            if scenario.get("id"):
                lines.append(f"- **场景ID**: `{scenario['id']}`")
            if scenario.get("description"):
                lines.append(f"- **描述**: {scenario['description']}")
            if scenario.get("tags"):
                lines.append(f"- **标签**: {', '.join(scenario['tags'])}")
            lines.append("")
        
        events = report_data["events"]
        lines.append("## 事件统计")
        lines.append("")
        
        time_range = events["time_range"]
        lines.append("### 时间范围")
        lines.append("")
        lines.append(f"- **开始**: {time_range['start'] or 'N/A'}")
        lines.append(f"- **结束**: {time_range['end'] or 'N/A'}")
        lines.append(f"- **持续**: {time_range['duration_seconds']:.2f} 秒")
        lines.append("")
        
        lines.append("### 按事件类型分布")
        lines.append("")
        lines.append("| 事件类型 | 数量 | 占比 |")
        lines.append("|----------|------|------|")
        total_events = events["total"]
        for event_type, count in sorted(events["by_type"].items(), key=lambda x: x[1], reverse=True):
            percentage = (count / total_events * 100) if total_events > 0 else 0
            lines.append(f"| {event_type} | {count} | {percentage:.1f}% |")
        lines.append("")
        
        lines.append("### 按摄像头分布")
        lines.append("")
        lines.append("| 摄像头ID | 事件数 |")
        lines.append("|----------|--------|")
        for camera_id, count in sorted(events["by_camera"].items(), key=lambda x: x[1], reverse=True):
            lines.append(f"| {camera_id} | {count} |")
        lines.append("")
        
        lines.append("### 按严重程度分布")
        lines.append("")
        lines.append("| 严重程度 | 数量 |")
        lines.append("|----------|------|")
        for severity, count in sorted(events["by_severity"].items()):
            lines.append(f"| {severity} | {count} |")
        lines.append("")
        
        validation = report_data.get("validation", {})
        if validation and (validation.get("errors") or validation.get("warnings")):
            lines.append("## 验证结果")
            lines.append("")
            
            valid_status = "✅ 通过" if validation.get("valid") else "❌ 失败"
            lines.append(f"**验证状态**: {valid_status}")
            lines.append("")
            
            lines.append(f"- 错误数: {validation.get('total_errors', 0)}")
            lines.append(f"- 警告数: {validation.get('total_warnings', 0)}")
            lines.append(f"- 执行规则: {', '.join(validation.get('rules_executed', []))}")
            lines.append("")
            
            errors = validation.get("errors", [])
            if errors:
                lines.append("### 错误详情")
                lines.append("")
                for i, error in enumerate(errors, 1):
                    lines.append(f"**{i}. {error.get('rule_name', 'unknown')} - {error.get('error_type', 'unknown')}**")
                    lines.append(f"")
                    lines.append(f"   - 消息: {error.get('message', '')}")
                    lines.append(f"   - 位置: {error.get('location', {})}")
                    lines.append("")
            
            warnings = validation.get("warnings", [])
            if warnings:
                lines.append("### 警告详情")
                lines.append("")
                for i, warning in enumerate(warnings, 1):
                    lines.append(f"**{i}. {warning.get('rule_name', 'unknown')} - {warning.get('error_type', 'unknown')}**")
                    lines.append("")
                    lines.append(f"   - 消息: {warning.get('message', '')}")
                    lines.append(f"   - 位置: {warning.get('location', {})}")
                    lines.append("")
        
        sample = events.get("sample", [])
        if sample:
            lines.append("## 事件样例（前10条）")
            lines.append("")
            lines.append("| 序号 | 时间戳 | 事件类型 | 摄像头 | 严重程度 |")
            lines.append("|------|--------|----------|--------|----------|")
            for i, event in enumerate(sample, 1):
                lines.append(
                    f"| {i} | {event.get('timestamp', '')[:19]} | "
                    f"{event.get('event_type', '')} | {event.get('camera_id', '')} | "
                    f"{event.get('severity', '')} |"
                )
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此报告由 Event Simulator 自动生成*")
        
        return "\n".join(lines)
    
    def list_reports(self) -> List[Dict[str, Any]]:
        reports = []
        
        for json_file in self.output_dir.glob("*.json"):
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                
                reports.append({
                    "report_id": data.get("report_id"),
                    "generated_at": data.get("generated_at"),
                    "status": data.get("summary", {}).get("status"),
                    "event_count": data.get("events", {}).get("total", 0),
                    "errors": data.get("validation", {}).get("total_errors", 0),
                    "warnings": data.get("validation", {}).get("total_warnings", 0),
                })
            except Exception:
                continue
        
        reports.sort(key=lambda x: x["generated_at"] or "", reverse=True)
        return reports
