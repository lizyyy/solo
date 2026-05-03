import csv
import os
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path

from src.models import Sample, Fridge, Rack, HandoverRecord, Alert, DutyNote, AlertType


class MarkdownExporter:
    
    def __init__(self):
        self.timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    def generate_handover_report(
        self,
        samples: List[Sample],
        fridges: List[Fridge],
        racks: List[Rack],
        handovers: List[HandoverRecord],
        alerts: List[Alert],
        duty_notes: List[DutyNote],
        operator_name: str = ""
    ) -> str:
        lines = []
        
        lines.append("# 冰箱样本温控交接单")
        lines.append("")
        lines.append(f"**生成时间**: {self.timestamp}")
        lines.append(f"**值班人员**: {operator_name or '未指定'}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 一、告警汇总")
        lines.append("")
        
        unresolved_alerts = [a for a in alerts if not a.is_resolved]
        if unresolved_alerts:
            lines.append(f"⚠️ **未解决告警: {len(unresolved_alerts)} 个**")
            lines.append("")
            lines.append("| 告警类型 | 关联对象 | 描述 | 时间 |")
            lines.append("|----------|----------|------|------|")
            for alert in unresolved_alerts:
                lines.append(f"| {alert.alert_type.value} | {alert.related_id} | {alert.message} | {alert.timestamp.strftime('%Y-%m-%d %H:%M')} |")
        else:
            lines.append("✅ **无未解决告警**")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        
        lines.append("## 二、冰箱状态")
        lines.append("")
        if fridges:
            lines.append("| 冰箱ID | 名称 | 温度范围 | 当前温度 | 架位数 |")
            lines.append("|--------|------|----------|----------|--------|")
            for fridge in fridges:
                temp_str = f"{fridge.current_temp}℃" if fridge.current_temp is not None else "N/A"
                temp_status = "🔴" if fridge.current_temp and not fridge.is_temp_normal(fridge.current_temp) else "✅"
                lines.append(f"| {fridge.fridge_id} | {fridge.name} | {fridge.min_temp}-{fridge.max_temp}℃ | {temp_str} {temp_status} | {len(fridge.racks)} |")
        else:
            lines.append("无冰箱数据")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        
        lines.append("## 三、样本状态")
        lines.append("")
        if samples:
            in_fridge = [s for s in samples if s.status == "在柜"]
            out_fridge = [s for s in samples if s.status != "在柜"]
            lines.append(f"- 在柜样本: {len(in_fridge)} 个")
            lines.append(f"- 离柜样本: {len(out_fridge)} 个")
            lines.append("")
            lines.append("### 样本详情")
            lines.append("")
            lines.append("| 样本ID | 类型 | 架位 | 位置 | 状态 | 扫描时间 |")
            lines.append("|--------|------|------|------|------|----------|")
            for sample in samples[:50]:
                lines.append(f"| {sample.sample_id} | {sample.sample_type.value} | {sample.rack_id} | {sample.position} | {sample.status} | {sample.scan_time.strftime('%Y-%m-%d %H:%M')} |")
            if len(samples) > 50:
                lines.append("")
                lines.append(f"*共 {len(samples)} 个样本，仅显示前50个*")
        else:
            lines.append("无样本数据")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        
        lines.append("## 四、交接记录")
        lines.append("")
        if handovers:
            lines.append("| 记录ID | 样本ID | 移交人 | 接收人 | 状态 | 交接时间 |")
            lines.append("|--------|--------|--------|--------|------|----------|")
            for record in handovers:
                status_icon = "⏳" if record.status.value == "待交接" else "✅" if record.status.value == "已交接" else "🔄"
                lines.append(f"| {record.record_id} | {record.sample_id} | {record.from_operator} | {record.to_operator} | {status_icon} {record.status.value} | {record.handover_time.strftime('%Y-%m-%d %H:%M')} |")
        else:
            lines.append("无交接记录")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        
        lines.append("## 五、值班备注")
        lines.append("")
        important_notes = [n for n in duty_notes if n.is_important]
        normal_notes = [n for n in duty_notes if not n.is_important]
        
        if important_notes:
            lines.append("### 重要备注")
            lines.append("")
            for note in important_notes:
                lines.append(f"**{note.operator_name}** ({note.shift_date.strftime('%Y-%m-%d')}):")
                lines.append(f"> {note.content}")
                lines.append("")
        
        if normal_notes:
            lines.append("### 普通备注")
            lines.append("")
            for note in normal_notes:
                lines.append(f"- **{note.operator_name}** ({note.shift_date.strftime('%Y-%m-%d')}): {note.content}")
        
        if not important_notes and not normal_notes:
            lines.append("无值班备注")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("**签字确认**")
        lines.append("")
        lines.append("| 移交人签字 | 接收人签字 | 日期 |")
        lines.append("|------------|------------|------|")
        lines.append("| __________ | __________ | ____ |")
        lines.append("")
        
        return "\n".join(lines)
    
    def export_to_file(self, file_path: str, content: str) -> bool:
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            return True
        except Exception:
            return False


class CSVExporter:
    
    def export_alerts(self, alerts: List[Alert], file_path: str) -> bool:
        try:
            with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.writer(f)
                writer.writerow([
                    "告警ID", "告警类型", "关联对象ID", "关联对象类型",
                    "描述", "告警时间", "状态", "解决时间", "解决人", "备注"
                ])
                for alert in alerts:
                    writer.writerow([
                        alert.alert_id,
                        alert.alert_type.value,
                        alert.related_id,
                        alert.related_type,
                        alert.message,
                        alert.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                        "已解决" if alert.is_resolved else "未解决",
                        alert.resolved_time.strftime("%Y-%m-%d %H:%M:%S") if alert.resolved_time else "",
                        alert.resolver,
                        alert.notes
                    ])
            return True
        except Exception:
            return False
    
    def export_samples(self, samples: List[Sample], file_path: str) -> bool:
        try:
            with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.writer(f)
                writer.writerow([
                    "样本ID", "类型", "架位ID", "位置", "状态",
                    "扫描时间", "入柜时间", "离柜时间"
                ])
                for sample in samples:
                    writer.writerow([
                        sample.sample_id,
                        sample.sample_type.value,
                        sample.rack_id,
                        sample.position,
                        sample.status,
                        sample.scan_time.strftime("%Y-%m-%d %H:%M:%S") if sample.scan_time else "",
                        sample.in_fridge_time.strftime("%Y-%m-%d %H:%M:%S") if sample.in_fridge_time else "",
                        sample.out_fridge_time.strftime("%Y-%m-%d %H:%M:%S") if sample.out_fridge_time else ""
                    ])
            return True
        except Exception:
            return False
    
    def export_risk_summary(self, alerts: List[Alert], samples: List[Sample], file_path: str) -> bool:
        try:
            with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(["风险类别", "数量", "详情"])
                
                timeout_alerts = [a for a in alerts if a.alert_type == AlertType.TIMEOUT and not a.is_resolved]
                temp_alerts = [a for a in alerts if a.alert_type == AlertType.TEMP_EXCEED and not a.is_resolved]
                conflict_alerts = [a for a in alerts if a.alert_type == AlertType.RACK_CONFLICT and not a.is_resolved]
                signature_alerts = [a for a in alerts if a.alert_type == AlertType.MISSING_SIGNATURE and not a.is_resolved]
                
                writer.writerow(["超时离柜", len(timeout_alerts), "; ".join([a.message for a in timeout_alerts[:5]])])
                writer.writerow(["温度越界", len(temp_alerts), "; ".join([a.message for a in temp_alerts[:5]])])
                writer.writerow(["架位冲突", len(conflict_alerts), "; ".join([a.message for a in conflict_alerts[:5]])])
                writer.writerow(["缺签记录", len(signature_alerts), "; ".join([a.message for a in signature_alerts[:5]])])
                
                out_fridge = [s for s in samples if s.status == "离柜"]
                writer.writerow(["当前离柜样本", len(out_fridge), ", ".join([s.sample_id for s in out_fridge[:10]])])
            return True
        except Exception:
            return False
