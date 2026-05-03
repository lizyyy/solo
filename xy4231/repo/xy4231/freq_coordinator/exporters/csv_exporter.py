import csv
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime

from freq_coordinator.models import (
    CommunicationPlan,
    RiskItem,
)


class CSVExporter:
    RISK_TYPE_MAP = {
        "coverage_gap": "覆盖缺口",
        "frequency_conflict": "频点冲突",
        "handover_gap": "交接空档",
        "battery_risk": "电池风险",
    }
    
    SEVERITY_MAP = {
        "critical": "严重",
        "high": "高",
        "medium": "中",
        "low": "低",
    }
    
    def __init__(self, plan: CommunicationPlan):
        self.plan = plan
    
    def export_risks(self, output_path: str) -> str:
        rows = self._generate_risk_rows()
        
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        if not rows:
            return ""
        
        fieldnames = list(rows[0].keys())
        
        with open(path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        
        return output_path
    
    def _generate_risk_rows(self) -> List[Dict[str, Any]]:
        rows = []
        
        sorted_risks = sorted(
            self.plan.risks,
            key=lambda r: self._severity_order(r.severity)
        )
        
        for idx, risk in enumerate(sorted_risks, start=1):
            row = {
                "序号": idx,
                "风险ID": risk.id,
                "风险类型": self.RISK_TYPE_MAP.get(risk.type, risk.type),
                "严重程度": self.SEVERITY_MAP.get(risk.severity, risk.severity),
                "标题": risk.title,
                "描述": risk.description,
                "受影响实体": ", ".join(risk.affected_entities) if risk.affected_entities else "",
                "位置": self._format_location(risk.location),
                "时间窗口": self._format_time_window(risk.time_window),
                "建议措施": risk.recommendation or "",
                "置信度": f"{risk.confidence * 100:.0f}%",
            }
            rows.append(row)
        
        return rows
    
    def export_schedule(self, output_path: str) -> str:
        rows = self._generate_schedule_rows()
        
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        if not rows:
            return ""
        
        fieldnames = list(rows[0].keys())
        
        with open(path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        
        return output_path
    
    def _generate_schedule_rows(self) -> List[Dict[str, Any]]:
        rows = []
        
        sorted_entries = sorted(
            self.plan.schedule,
            key=lambda e: (e.station_id, e.start_time)
        )
        
        for entry in sorted_entries:
            frequencies = [f"{ch.frequency:.3f}" for ch in entry.assigned_channels]
            channel_types = [
                "中继" if ch.is_repeater else "直频" 
                for ch in entry.assigned_channels
            ]
            
            row = {
                "站点ID": entry.station_id,
                "站点名称": entry.station_name,
                "班次ID": entry.shift_id,
                "志愿者姓名": entry.volunteer_name,
                "开始时间": self._format_datetime(entry.start_time),
                "结束时间": self._format_datetime(entry.end_time),
                "设备ID": entry.device_id,
                "频道数量": len(entry.assigned_channels),
                "频率列表": "; ".join(frequencies),
                "频道类型": "; ".join(channel_types),
            }
            rows.append(row)
        
        return rows
    
    def export_devices(self, output_path: str) -> str:
        rows = []
        
        for device in self.plan.devices:
            status_map = {
                "available": "可用",
                "in_use": "使用中",
                "maintenance": "维护中",
            }
            
            type_map = {
                "handheld": "手持台",
                "mobile": "车载台",
                "base": "基地台",
            }
            
            row = {
                "设备ID": device.id,
                "设备类型": type_map.get(device.type, device.type),
                "型号": device.model or "",
                "状态": status_map.get(device.status, device.status),
                "电池容量(mAh)": device.battery_capacity_mah,
                "当前电量(%)": device.current_charge_percent,
                "平均功耗(mA)": device.power_consumption_ma,
                "估计续航(小时)": f"{device.estimated_runtime_hours:.1f}",
                "最后充电": self._format_datetime(device.last_charged) if device.last_charged else "",
            }
            rows.append(row)
        
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        if not rows:
            return ""
        
        fieldnames = list(rows[0].keys())
        
        with open(path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        
        return output_path
    
    def _severity_order(self, severity: str) -> int:
        order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        return order.get(severity, 999)
    
    def _format_location(self, location: Dict[str, float]) -> str:
        if not location:
            return ""
        lat = location.get("latitude")
        lon = location.get("longitude")
        if lat is not None and lon is not None:
            return f"{lat:.4f}°, {lon:.4f}°"
        return ""
    
    def _format_time_window(self, time_window: Dict[str, datetime]) -> str:
        if not time_window:
            return ""
        start = time_window.get("start")
        end = time_window.get("end")
        if start and end:
            return f"{self._format_datetime(start)} - {self._format_datetime(end)}"
        elif start:
            return f"开始: {self._format_datetime(start)}"
        elif end:
            return f"结束: {self._format_datetime(end)}"
        return ""
    
    def _format_datetime(self, dt: datetime) -> str:
        if not dt:
            return ""
        return dt.strftime("%Y-%m-%d %H:%M")
