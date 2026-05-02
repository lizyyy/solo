import csv
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from meeting_screen_inspector.models.models import (
    InspectionSession,
    DeviceStatus,
    Risk,
    RiskLevel,
    RiskType,
    DeviceType,
    DeviceInspection,
    DeviceConfig,
)


class MarkdownExporter:
    def __init__(self, session: InspectionSession):
        self.session = session

    def export(self, output_path: Path) -> Path:
        content = self._generate_content()
        output_path.write_text(content, encoding='utf-8')
        return output_path

    def _generate_content(self) -> str:
        lines: List[str] = []
        
        lines.append("# 会议屏串口巡检报告")
        lines.append("")
        
        lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"> 会话ID: {self.session.session_id}")
        if self.session.name:
            lines.append(f"> 会话名称: {self.session.name}")
        lines.append(f"> 创建时间: {self.session.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 一、巡检概览")
        lines.append("")
        
        summary = self.session.summary
        if summary:
            lines.append("| 指标 | 数值 |")
            lines.append("|------|------|")
            lines.append(f"| 总设备数 | {summary.get('total_devices', 0)} |")
            lines.append(f"| 有风险设备 | {summary.get('devices_with_risks', 0)} |")
            lines.append(f"| 无风险设备 | {summary.get('devices_clean', 0)} |")
            lines.append(f"| 总风险数 | {summary.get('total_risks', 0)} |")
            
            risk_by_level = summary.get('risk_count_by_level', {})
            lines.append(f"| 严重风险 (CRITICAL) | {risk_by_level.get('critical', 0)} |")
            lines.append(f"| 高风险 (HIGH) | {risk_by_level.get('high', 0)} |")
            lines.append(f"| 中风险 (MEDIUM) | {risk_by_level.get('medium', 0)} |")
            lines.append(f"| 低风险 (LOW) | {risk_by_level.get('low', 0)} |")
            lines.append("")
        else:
            lines.append("*暂无概览数据*")
            lines.append("")
        
        lines.append("## 二、设备状态详情")
        lines.append("")
        
        if self.session.device_statuses:
            for device_id, status in self.session.device_statuses.items():
                status_icon = "✅" if status.confirmed else "🔍"
                risk_icon = "🚨" if status.has_critical_risk else "⚠️" if status.risk_count > 0 else "✅"
                
                lines.append(f"### {status_icon} {risk_icon} 设备: {device_id}")
                lines.append("")
                
                lines.append("| 属性 | 值 |")
                lines.append("|------|-----|")
                lines.append(f"| 设备类型 | {status.device_type.value} |")
                lines.append(f"| 位置 | {status.location or '-'} |")
                lines.append(f"| 版本 | {status.version or '-'} |")
                lines.append(f"| 风险数 | {status.risk_count} |")
                lines.append(f"| 确认状态 | {'已确认' if status.confirmed else '未确认'} |")
                if status.confirmed_by:
                    lines.append(f"| 确认人 | {status.confirmed_by} |")
                lines.append("")
                
                if status.risks:
                    lines.append("#### 风险详情")
                    lines.append("")
                    
                    for i, risk in enumerate(status.risks, 1):
                        level_color = {
                            RiskLevel.CRITICAL: "🔴 严重",
                            RiskLevel.HIGH: "🟠 高",
                            RiskLevel.MEDIUM: "🟡 中",
                            RiskLevel.LOW: "🟢 低",
                        }.get(risk.level, "⚪ 未知")
                        
                        lines.append(f"**{i}. {level_color} - {risk.risk_type.value}**")
                        lines.append("")
                        lines.append(f"- 描述: {risk.description}")
                        if risk.suggestion:
                            lines.append(f"- 建议: {risk.suggestion}")
                        if risk.details:
                            details_str = json.dumps(risk.details, ensure_ascii=False, indent=2)
                            lines.append(f"- 详情:")
                            lines.append("```json")
                            lines.append(details_str)
                            lines.append("```")
                        lines.append("")
                
                if status.notes:
                    lines.append("#### 备注")
                    lines.append("")
                    lines.append(f"> {status.notes}")
                    lines.append("")
        else:
            lines.append("*暂无设备状态数据*")
            lines.append("")
        
        lines.append("## 三、设备巡检数据")
        lines.append("")
        
        if self.session.devices:
            for device in self.session.devices:
                lines.append(f"### 设备: {device.identity.device_id}")
                lines.append("")
                
                lines.append("| 属性 | 值 |")
                lines.append("|------|-----|")
                lines.append(f"| 设备类型 | {device.identity.device_type.value} |")
                lines.append(f"| 位置 | {device.identity.location or '-'} |")
                lines.append(f"| 采集时间 | {device.collected_at.strftime('%Y-%m-%d %H:%M:%S')} |")
                lines.append(f"| 源文件 | {', '.join(device.source_files) if device.source_files else '-'} |")
                lines.append("")
                
                if device.serial_log:
                    lines.append("#### 串口日志信息")
                    lines.append("")
                    lines.append(f"- 文件名: {device.serial_log.filename}")
                    lines.append(f"- 检测版本: {device.serial_log.detected_version or '-'}")
                    lines.append(f"- 重启次数: {device.serial_log.reboot_count}")
                    if device.serial_log.last_reboot_time:
                        lines.append(f"- 最后重启时间: {device.serial_log.last_reboot_time}")
                    lines.append(f"- 日志条目数: {len(device.serial_log.entries)}")
                    lines.append("")
                
                if device.bluetooth_snapshot:
                    lines.append("#### 蓝牙快照")
                    lines.append("")
                    lines.append(f"- 快照时间: {device.bluetooth_snapshot.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
                    lines.append(f"- 检测到设备数: {len(device.bluetooth_snapshot.devices)}")
                    
                    if device.bluetooth_snapshot.devices:
                        lines.append("")
                        lines.append("| 蓝牙地址 | 设备名 | RSSI |")
                        lines.append("|----------|--------|------|")
                        for bt in device.bluetooth_snapshot.devices[:10]:
                            lines.append(f"| {bt.address} | {bt.name or '-'} | {bt.rssi or '-'} |")
                        if len(device.bluetooth_snapshot.devices) > 10:
                            lines.append(f"| ... 共 {len(device.bluetooth_snapshot.devices)} 个设备 | | |")
                    lines.append("")
                
                if device.config:
                    lines.append("#### 配置信息")
                    lines.append("")
                    lines.append(f"- 配置版本: {device.config.version or '-'}")
                    lines.append(f"- 配置设备ID: {device.config.device_id or '-'}")
                    lines.append("")
                    
                    if device.config.raw_json:
                        lines.append("<details>")
                        lines.append("<summary>查看完整配置</summary>")
                        lines.append("")
                        lines.append("```json")
                        config_str = json.dumps(device.config.raw_json, ensure_ascii=False, indent=2)
                        lines.append(config_str)
                        lines.append("```")
                        lines.append("")
                        lines.append("</details>")
                        lines.append("")
        else:
            lines.append("*暂无设备巡检数据*")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*报告由会议屏串口巡检盒 (MSI) 生成*")
        
        return "\n".join(lines)


class CSVExporter:
    def __init__(self, session: InspectionSession):
        self.session = session

    def export(self, output_path: Path) -> Path:
        with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            writer.writerow([
                "设备ID", "设备类型", "位置", "版本", "风险类型", "风险等级",
                "风险描述", "建议", "详情", "确认状态", "确认人", "备注"
            ])
            
            for device_id, status in self.session.device_statuses.items():
                if status.risks:
                    for risk in status.risks:
                        details_str = json.dumps(risk.details, ensure_ascii=False) if risk.details else ""
                        
                        writer.writerow([
                            status.device_id,
                            status.device_type.value,
                            status.location or "",
                            status.version or "",
                            risk.risk_type.value,
                            risk.level.value,
                            risk.description,
                            risk.suggestion or "",
                            details_str,
                            "已确认" if status.confirmed else "未确认",
                            status.confirmed_by or "",
                            status.notes or "",
                        ])
                else:
                    writer.writerow([
                        status.device_id,
                        status.device_type.value,
                        status.location or "",
                        status.version or "",
                        "", "", "", "", "",
                        "已确认" if status.confirmed else "未确认",
                        status.confirmed_by or "",
                        status.notes or "",
                    ])
        
        return output_path


class RollbackExporter:
    def __init__(self, session: InspectionSession):
        self.session = session

    def export(self, output_path: Path, device_id: Optional[str] = None) -> Path:
        rollback_data = self._generate_rollback_data(device_id)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(rollback_data, f, ensure_ascii=False, indent=2, default=str)
        
        return output_path

    def _generate_rollback_data(self, device_id: Optional[str] = None) -> Dict[str, Any]:
        rollback: Dict[str, Any] = {
            "meta": {
                "generated_at": datetime.now().isoformat(),
                "session_id": self.session.session_id,
                "session_name": self.session.name,
                "generated_for": device_id if device_id else "all_devices",
            },
            "devices": {},
        }
        
        devices_to_export: List[DeviceInspection] = []
        if device_id:
            devices_to_export = [
                d for d in self.session.devices 
                if d.identity.device_id == device_id
            ]
        else:
            devices_to_export = self.session.devices
        
        for device in devices_to_export:
            device_data: Dict[str, Any] = {
                "identity": {
                    "device_type": device.identity.device_type.value,
                    "device_id": device.identity.device_id,
                    "location": device.identity.location,
                    "label": device.identity.label,
                },
                "rollback_config": None,
                "network_settings": None,
                "bluetooth_settings": None,
                "other_settings": None,
                "serial_log_summary": None,
            }
            
            if device.config:
                device_data["rollback_config"] = device.config.raw_json
                device_data["network_settings"] = device.config.network_config
                device_data["bluetooth_settings"] = device.config.bluetooth_config
                device_data["other_settings"] = device.config.other_settings
            
            if device.serial_log:
                device_data["serial_log_summary"] = {
                    "version": device.serial_log.detected_version,
                    "reboot_count": device.serial_log.reboot_count,
                    "last_reboot_time": device.serial_log.last_reboot_time,
                    "entry_count": len(device.serial_log.entries),
                }
            
            if device.bluetooth_snapshot:
                device_data["bluetooth_snapshot"] = [
                    {
                        "address": bt.address,
                        "name": bt.name,
                        "rssi": bt.rssi,
                    }
                    for bt in device.bluetooth_snapshot.devices
                ]
            
            if device.identity.device_id in self.session.device_statuses:
                status = self.session.device_statuses[device.identity.device_id]
                device_data["status"] = {
                    "version": status.version,
                    "confirmed": status.confirmed,
                    "confirmed_by": status.confirmed_by,
                    "confirmed_at": status.confirmed_at,
                    "notes": status.notes,
                    "risk_count": status.risk_count,
                }
            
            rollback["devices"][device.identity.device_id] = device_data
        
        return rollback


class Exporter:
    def __init__(self, session: InspectionSession):
        self.session = session
        self.markdown_exporter = MarkdownExporter(session)
        self.csv_exporter = CSVExporter(session)
        self.rollback_exporter = RollbackExporter(session)

    def export_markdown(self, output_path: Path) -> Path:
        return self.markdown_exporter.export(output_path)

    def export_csv(self, output_path: Path) -> Path:
        return self.csv_exporter.export(output_path)

    def export_rollback(self, output_path: Path, device_id: Optional[str] = None) -> Path:
        return self.rollback_exporter.export(output_path, device_id)

    def export_all(self, output_dir: Path, prefix: Optional[str] = None) -> Dict[str, Path]:
        output_dir.mkdir(parents=True, exist_ok=True)
        
        if prefix is None:
            prefix = datetime.now().strftime("inspection_%Y%m%d_%H%M%S")
        
        results: Dict[str, Path] = {}
        
        md_path = output_dir / f"{prefix}.md"
        results["markdown"] = self.export_markdown(md_path)
        
        csv_path = output_dir / f"{prefix}_risks.csv"
        results["csv"] = self.export_csv(csv_path)
        
        rollback_path = output_dir / f"{prefix}_rollback.json"
        results["rollback"] = self.export_rollback(rollback_path)
        
        return results
