import csv
import json
import os
import shutil
import uuid
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple

from .log_parser import LogParser, LogEntry
from .models import Device, FirmwareManifest, BatchInfo, FirmwareType, DeviceStatus
from .rules import RuleEngine, Violation, RiskLevel, RuleResult
from .storage import ReviewRecord, ReviewConclusion, ReviewStatus, ReviewStorage
from .state_machine import UpgradeStateMachine


class Importer:
    def __init__(self):
        self.log_parser = LogParser()
    
    def import_log(self, file_path: str) -> List[LogEntry]:
        return self.log_parser.parse_file(file_path)
    
    def import_log_from_string(self, content: str) -> List[LogEntry]:
        return self.log_parser.parse_string(content)
    
    def import_manifest(self, file_path: str) -> FirmwareManifest:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        firmware_type = FirmwareType.APPLICATION
        type_str = data.get("type", "application").lower()
        if type_str == "bootloader":
            firmware_type = FirmwareType.BOOTLOADER
        elif type_str == "full":
            firmware_type = FirmwareType.FULL
        
        release_date = None
        if "release_date" in data:
            try:
                release_date = datetime.fromisoformat(data["release_date"])
            except ValueError:
                pass
        
        return FirmwareManifest(
            version=data.get("version", ""),
            firmware_type=firmware_type,
            file_path=file_path,
            file_name=Path(file_path).name,
            file_size=data.get("file_size", 0),
            crc32=data.get("crc32", data.get("crc", "")),
            md5=data.get("md5", ""),
            sha256=data.get("sha256", ""),
            release_date=release_date,
            compatible_hardware=data.get("compatible_hardware", []),
            dependencies=data.get("dependencies", []),
            prerequisites=data.get("prerequisites", []),
            rollback_allowed=data.get("rollback_allowed", True),
            minimum_rollback_version=data.get("minimum_rollback_version"),
            notes=data.get("notes", ""),
            metadata=data.get("metadata", {}),
        )
    
    def import_batch_csv(self, file_path: str) -> BatchInfo:
        devices: List[Device] = []
        batch_id = Path(file_path).stem
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                device = Device(
                    device_id=row.get("device_id", row.get("id", row.get("serial", ""))),
                    serial_number=row.get("serial_number", row.get("serial", "")),
                    model=row.get("model", row.get("device_model", "")),
                    hardware_version=row.get("hardware_version", row.get("hw_version", "")),
                    current_firmware_version=row.get("firmware_version", row.get("version", "")),
                    batch_id=batch_id,
                    metadata=dict(row),
                )
                devices.append(device)
        
        batch = BatchInfo(
            batch_id=batch_id,
            total_devices=len(devices),
        )
        
        for device in devices:
            batch.add_device(device)
        
        return batch
    
    def import_notes(self, file_path: str) -> str:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()


class Exporter:
    def __init__(self):
        pass
    
    def export_markdown_report(self, 
                                review_record: ReviewRecord,
                                rule_results: List[RuleResult],
                                state_machine: Optional[UpgradeStateMachine] = None,
                                output_path: str = "") -> str:
        lines = []
        
        lines.append("# 串口固件升级复核报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**复核ID**: {review_record.review_id}")
        lines.append(f"**设备ID**: {review_record.device_id}")
        lines.append(f"**批次ID**: {review_record.batch_id}")
        lines.append("")
        
        lines.append("## 复核结论")
        lines.append("")
        
        conclusion_emoji = {
            ReviewConclusion.PASS: "✅",
            ReviewConclusion.WARNING: "⚠️",
            ReviewConclusion.FAIL: "❌",
            ReviewConclusion.REQUIRES_MANUAL_REVIEW: "🔍",
        }.get(review_record.conclusion, "❓")
        
        lines.append(f"**最终结论**: {conclusion_emoji} {review_record.conclusion.value}")
        lines.append("")
        
        risk_summary = review_record.get_risk_summary()
        lines.append("### 风险统计")
        lines.append("")
        lines.append(f"| 风险级别 | 数量 |")
        lines.append(f"|----------|------|")
        lines.append(f"| 🔴 CRITICAL | {risk_summary['critical']} |")
        lines.append(f"| 🟠 HIGH | {risk_summary['high']} |")
        lines.append(f"| 🟡 MEDIUM | {risk_summary['medium']} |")
        lines.append(f"| 🟢 LOW | {risk_summary['low']} |")
        lines.append("")
        
        if review_record.violations:
            lines.append("## 违规详情")
            lines.append("")
            
            critical_violations = [v for v in review_record.violations if v.risk_level == RiskLevel.CRITICAL]
            high_violations = [v for v in review_record.violations if v.risk_level == RiskLevel.HIGH]
            medium_violations = [v for v in review_record.violations if v.risk_level == RiskLevel.MEDIUM]
            
            for level_name, violations in [("CRITICAL", critical_violations), 
                                           ("HIGH", high_violations), 
                                           ("MEDIUM", medium_violations)]:
                if violations:
                    lines.append(f"### {level_name} 级别违规")
                    lines.append("")
                    for i, v in enumerate(violations, 1):
                        lines.append(f"**{i}. [{v.violation_type.value}]**")
                        lines.append(f"   - 描述: {v.description}")
                        if v.log_line_number:
                            lines.append(f"   - 日志行号: {v.log_line_number}")
                        if v.timestamp:
                            lines.append(f"   - 时间: {v.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
                        if v.affected_versions:
                            lines.append(f"   - 影响版本: {', '.join(v.affected_versions)}")
                        if v.raw_log:
                            lines.append(f"   - 原始日志: `{v.raw_log}`")
                        lines.append("")
        
        if state_machine:
            lines.append("## 升级状态流转")
            lines.append("")
            
            summary = state_machine.get_state_summary()
            lines.append(f"**最终状态**: {summary['current_state']}")
            lines.append(f"**状态转换次数**: {summary['transition_count']}")
            lines.append(f"**重试次数**: {summary['retry_count']}")
            lines.append(f"**CRC验证**: {'✅ 通过' if summary['crc_verified'] else '❌ 未通过'}")
            lines.append("")
            
            if state_machine.context.transitions:
                lines.append("### 状态转换详情")
                lines.append("")
                lines.append(f"| 序号 | 从状态 | 到状态 | 事件 | 日志行 |")
                lines.append(f"|------|--------|--------|------|--------|")
                for i, t in enumerate(state_machine.context.transitions, 1):
                    lines.append(f"| {i} | {t.from_state} | {t.to_state} | {t.event} | {t.log_line_number or '-'} |")
                lines.append("")
        
        if review_record.source_version or review_record.target_version:
            lines.append("## 版本信息")
            lines.append("")
            if review_record.source_version:
                lines.append(f"**源版本**: {review_record.source_version}")
            if review_record.target_version:
                lines.append(f"**目标版本**: {review_record.target_version}")
            lines.append("")
        
        if review_record.notes:
            lines.append("## 复核备注")
            lines.append("")
            for note in review_record.notes:
                lines.append(f"### {note.author or '匿名'} ({note.created_at.strftime('%Y-%m-%d %H:%M:%S')})")
                lines.append("")
                lines.append(note.content)
                lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append(f"*报告由 串口固件升级回放器 自动生成*")
        lines.append(f"*复核时间: {review_record.created_at.strftime('%Y-%m-%d %H:%M:%S')}*")
        
        content = "\n".join(lines)
        
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)
        
        return content
    
    def export_risk_csv(self, 
                        violations: List[Violation],
                        output_path: str = "",
                        review_id: str = "") -> str:
        rows = []
        
        header = [
            "review_id",
            "violation_type",
            "risk_level",
            "description",
            "log_line_number",
            "timestamp",
            "affected_versions",
            "retry_count",
            "raw_log",
        ]
        rows.append(header)
        
        for v in violations:
            row = [
                review_id,
                v.violation_type.value,
                v.risk_level.value,
                v.description,
                str(v.log_line_number) if v.log_line_number else "",
                v.timestamp.isoformat() if v.timestamp else "",
                ",".join(v.affected_versions) if v.affected_versions else "",
                str(v.retry_count) if v.retry_count else "",
                v.raw_log,
            ]
            rows.append(row)
        
        content = ""
        for row in rows:
            content += ",".join(f'"{cell}"' for cell in row) + "\n"
        
        if output_path:
            with open(output_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerows(rows)
        
        return content
    
    def export_audit_json(self,
                          review_record: ReviewRecord,
                          rule_engine: Optional[RuleEngine] = None,
                          state_machine: Optional[UpgradeStateMachine] = None,
                          log_entries: Optional[List[LogEntry]] = None,
                          output_path: str = "") -> str:
        audit_data = {
            "audit_id": str(uuid.uuid4()),
            "generated_at": datetime.now().isoformat(),
            "review": review_record.to_dict(),
        }
        
        if rule_engine:
            audit_data["rule_summary"] = rule_engine.get_summary()
            audit_data["all_violations"] = [v.to_dict() for v in rule_engine.get_all_violations()]
        
        if state_machine:
            audit_data["state_summary"] = state_machine.get_state_summary()
            audit_data["transitions"] = [
                {
                    "from_state": t.from_state,
                    "to_state": t.to_state,
                    "event": t.event,
                    "timestamp": t.timestamp.isoformat() if t.timestamp else None,
                    "log_line_number": t.log_line_number,
                }
                for t in state_machine.context.transitions
            ]
        
        if log_entries:
            audit_data["log_summary"] = {
                "total_entries": len(log_entries),
                "time_range": {
                    "start": log_entries[0].timestamp.isoformat() if log_entries and log_entries[0].timestamp else None,
                    "end": log_entries[-1].timestamp.isoformat() if log_entries and log_entries[-1].timestamp else None,
                } if log_entries else None,
            }
        
        content = json.dumps(audit_data, ensure_ascii=False, indent=2)
        
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)
        
        return content


class IOHandler:
    def __init__(self):
        self.importer = Importer()
        self.exporter = Exporter()
    
    def import_all(self,
                  log_path: Optional[str] = None,
                  manifest_path: Optional[str] = None,
                  batch_path: Optional[str] = None,
                  notes_path: Optional[str] = None) -> Dict[str, Any]:
        result = {
            "log_entries": [],
            "manifest": None,
            "batch_info": None,
            "notes": "",
        }
        
        if log_path and os.path.exists(log_path):
            result["log_entries"] = self.importer.import_log(log_path)
        
        if manifest_path and os.path.exists(manifest_path):
            result["manifest"] = self.importer.import_manifest(manifest_path)
        
        if batch_path and os.path.exists(batch_path):
            result["batch_info"] = self.importer.import_batch_csv(batch_path)
        
        if notes_path and os.path.exists(notes_path):
            result["notes"] = self.importer.import_notes(notes_path)
        
        return result
    
    def export_all(self,
                   review_record: ReviewRecord,
                   output_dir: str,
                   rule_engine: Optional[RuleEngine] = None,
                   state_machine: Optional[UpgradeStateMachine] = None,
                   log_entries: Optional[List[LogEntry]] = None) -> Dict[str, str]:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = f"review_{review_record.review_id}_{timestamp}"
        
        files = {}
        
        md_path = output_path / f"{base_name}.md"
        self.exporter.export_markdown_report(
            review_record=review_record,
            rule_results=review_record.rule_results,
            state_machine=state_machine,
            output_path=str(md_path),
        )
        files["markdown"] = str(md_path)
        
        csv_path = output_path / f"{base_name}_risks.csv"
        self.exporter.export_risk_csv(
            violations=review_record.violations,
            output_path=str(csv_path),
            review_id=review_record.review_id,
        )
        files["csv_risks"] = str(csv_path)
        
        json_path = output_path / f"{base_name}_audit.json"
        self.exporter.export_audit_json(
            review_record=review_record,
            rule_engine=rule_engine,
            state_machine=state_machine,
            log_entries=log_entries,
            output_path=str(json_path),
        )
        files["json_audit"] = str(json_path)
        
        return files
