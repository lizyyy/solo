from datetime import datetime
from typing import List, Dict, Any, Optional
from io import StringIO
import csv

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models import (
    BatteryPack, 
    ChargeRecord, 
    FlightRecord, 
    CellVoltageReading, 
    MaintenanceNote
)


class ReportExporter:
    def __init__(self, db: Session):
        self.db = db
    
    def get_battery_history(
        self,
        battery_id: str,
        include_charge: bool = True,
        include_flight: bool = True,
        include_voltage: bool = True,
        include_maintenance: bool = True
    ) -> Dict[str, Any]:
        battery = self.db.query(BatteryPack).filter(
            BatteryPack.battery_id == battery_id
        ).first()
        
        if not battery:
            return {"error": "Battery not found", "battery_id": battery_id}
        
        result = {
            "battery_info": {
                "id": battery.id,
                "battery_id": battery.battery_id,
                "name": battery.name,
                "purchase_date": battery.purchase_date.isoformat() if battery.purchase_date else None,
                "initial_cycles": battery.initial_cycles,
                "cell_count": battery.cell_count,
                "capacity_mah": battery.capacity_mah,
                "status": battery.status,
                "created_at": battery.created_at.isoformat() if battery.created_at else None,
            },
            "charge_records": [],
            "flight_records": [],
            "voltage_readings": [],
            "maintenance_notes": [],
        }
        
        if include_charge:
            charges = self.db.query(ChargeRecord).filter(
                ChargeRecord.battery_id == battery_id
            ).order_by(ChargeRecord.charge_start_time.desc()).all()
            
            result["charge_records"] = [
                {
                    "id": c.id,
                    "charge_start_time": c.charge_start_time.isoformat() if c.charge_start_time else None,
                    "charge_end_time": c.charge_end_time.isoformat() if c.charge_end_time else None,
                    "start_voltage": c.start_voltage,
                    "end_voltage": c.end_voltage,
                    "charge_current": c.charge_current,
                    "capacity_charged_mah": c.capacity_charged_mah,
                    "cycle_count": c.cycle_count,
                    "charger_id": c.charger_id,
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                }
                for c in charges
            ]
        
        if include_flight:
            flights = self.db.query(FlightRecord).filter(
                FlightRecord.battery_id == battery_id
            ).order_by(FlightRecord.flight_date.desc()).all()
            
            result["flight_records"] = [
                {
                    "id": f.id,
                    "flight_date": f.flight_date.isoformat() if f.flight_date else None,
                    "flight_duration_min": f.flight_duration_min,
                    "start_voltage": f.start_voltage,
                    "end_voltage": f.end_voltage,
                    "min_voltage": f.min_voltage,
                    "avg_current": f.avg_current,
                    "max_current": f.max_current,
                    "temperature_c": f.temperature_c,
                    "cycle_count": f.cycle_count,
                    "has_low_voltage_alert": f.has_low_voltage_alert,
                    "low_voltage_alert_time": f.low_voltage_alert_time.isoformat() if f.low_voltage_alert_time else None,
                    "low_voltage_alert_value": f.low_voltage_alert_value,
                    "drone_id": f.drone_id,
                    "mission_name": f.mission_name,
                    "created_at": f.created_at.isoformat() if f.created_at else None,
                }
                for f in flights
            ]
        
        if include_voltage:
            voltages = self.db.query(CellVoltageReading).filter(
                CellVoltageReading.battery_id == battery_id
            ).order_by(CellVoltageReading.reading_time.desc()).all()
            
            result["voltage_readings"] = [
                {
                    "id": v.id,
                    "reading_time": v.reading_time.isoformat() if v.reading_time else None,
                    "cell_1_voltage": v.cell_1_voltage,
                    "cell_2_voltage": v.cell_2_voltage,
                    "cell_3_voltage": v.cell_3_voltage,
                    "cell_4_voltage": v.cell_4_voltage,
                    "cell_5_voltage": v.cell_5_voltage,
                    "cell_6_voltage": v.cell_6_voltage,
                    "cell_7_voltage": v.cell_7_voltage,
                    "cell_8_voltage": v.cell_8_voltage,
                    "cell_9_voltage": v.cell_9_voltage,
                    "cell_10_voltage": v.cell_10_voltage,
                    "cell_11_voltage": v.cell_11_voltage,
                    "cell_12_voltage": v.cell_12_voltage,
                    "total_voltage": v.total_voltage,
                    "max_cell_voltage": v.max_cell_voltage,
                    "min_cell_voltage": v.min_cell_voltage,
                    "voltage_diff": v.voltage_diff,
                    "reading_source": v.reading_source,
                    "created_at": v.created_at.isoformat() if v.created_at else None,
                }
                for v in voltages
            ]
        
        if include_maintenance:
            maintenances = self.db.query(MaintenanceNote).filter(
                MaintenanceNote.battery_id == battery_id
            ).order_by(MaintenanceNote.note_date.desc()).all()
            
            result["maintenance_notes"] = [
                {
                    "id": m.id,
                    "note_date": m.note_date.isoformat() if m.note_date else None,
                    "note_type": m.note_type,
                    "title": m.title,
                    "content": m.content,
                    "author": m.author,
                    "is_sealed": m.is_sealed,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                    "updated_at": m.updated_at.isoformat() if m.updated_at else None,
                }
                for m in maintenances
            ]
        
        return result
    
    def export_to_markdown(
        self,
        battery_id: str,
        include_charge: bool = True,
        include_flight: bool = True,
        include_voltage: bool = True,
        include_maintenance: bool = True
    ) -> str:
        history = self.get_battery_history(
            battery_id=battery_id,
            include_charge=include_charge,
            include_flight=include_flight,
            include_voltage=include_voltage,
            include_maintenance=include_maintenance
        )
        
        if "error" in history:
            return f"# 错误\n\n{history['error']}"
        
        battery = history["battery_info"]
        
        md_parts = []
        md_parts.append(f"# 电池追溯报告: {battery['battery_id']}")
        md_parts.append(f"\n生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        
        md_parts.append("\n## 基本信息\n")
        md_parts.append("| 字段 | 值 |")
        md_parts.append("|------|-----|")
        md_parts.append(f"| 电池编号 | {battery['battery_id']} |")
        md_parts.append(f"| 名称 | {battery['name'] or '-'} |")
        md_parts.append(f"| 购买日期 | {battery['purchase_date'] or '-'} |")
        md_parts.append(f"| 初始循环次数 | {battery['initial_cycles']} |")
        md_parts.append(f"| 电芯数量 | {battery['cell_count']}S |")
        md_parts.append(f"| 容量 | {battery['capacity_mah'] or '-'} mAh |")
        md_parts.append(f"| 状态 | {battery['status']} |")
        
        if include_charge and history["charge_records"]:
            md_parts.append("\n## 充电记录\n")
            md_parts.append("| 序号 | 开始时间 | 结束时间 | 起始电压 | 结束电压 | 充电容量 | 循环次数 | 充电器 |")
            md_parts.append("|------|----------|----------|----------|----------|----------|----------|--------|")
            for i, c in enumerate(history["charge_records"], 1):
                md_parts.append(
                    f"| {i} | {c['charge_start_time'] or '-'} | {c['charge_end_time'] or '-'} | "
                    f"{c['start_voltage'] or '-'}V | {c['end_voltage'] or '-'}V | "
                    f"{c['capacity_charged_mah'] or '-'}mAh | {c['cycle_count'] or '-'} | "
                    f"{c['charger_id'] or '-'} |"
                )
        
        if include_flight and history["flight_records"]:
            md_parts.append("\n## 飞行记录\n")
            md_parts.append("| 序号 | 飞行日期 | 时长(分) | 起始电压 | 结束电压 | 最低电压 | 循环次数 | 低压告警 | 任务 |")
            md_parts.append("|------|----------|----------|----------|----------|----------|----------|----------|------|")
            for i, f in enumerate(history["flight_records"], 1):
                alert = "是" if f["has_low_voltage_alert"] else "否"
                md_parts.append(
                    f"| {i} | {f['flight_date'] or '-'} | {f['flight_duration_min'] or '-'} | "
                    f"{f['start_voltage'] or '-'}V | {f['end_voltage'] or '-'}V | "
                    f"{f['min_voltage'] or '-'}V | {f['cycle_count'] or '-'} | "
                    f"{alert} | {f['mission_name'] or '-'} |"
                )
        
        if include_voltage and history["voltage_readings"]:
            md_parts.append("\n## 单体电压读数\n")
            md_parts.append("| 序号 | 读取时间 | 总电压 | 最高单体 | 最低单体 | 压差 | 来源 |")
            md_parts.append("|------|----------|--------|----------|----------|------|------|")
            for i, v in enumerate(history["voltage_readings"], 1):
                md_parts.append(
                    f"| {i} | {v['reading_time'] or '-'} | {v['total_voltage'] or '-'}V | "
                    f"{v['max_cell_voltage'] or '-'}V | {v['min_cell_voltage'] or '-'}V | "
                    f"{v['voltage_diff'] or '-'}V | {v['reading_source'] or '-'} |"
                )
        
        if include_maintenance and history["maintenance_notes"]:
            md_parts.append("\n## 维修/备注记录\n")
            for m in history["maintenance_notes"]:
                sealed = " [已封存]" if m["is_sealed"] else ""
                md_parts.append(f"\n### {m['title']}{sealed}\n")
                md_parts.append(f"- 日期: {m['note_date'] or '-'}")
                md_parts.append(f"- 类型: {m['note_type']}")
                md_parts.append(f"- 作者: {m['author'] or '-'}")
                md_parts.append(f"\n{m['content']}\n")
        
        return "\n".join(md_parts)
    
    def export_to_csv(
        self,
        battery_id: str,
        include_charge: bool = True,
        include_flight: bool = True,
        include_voltage: bool = True,
        include_maintenance: bool = True
    ) -> str:
        history = self.get_battery_history(
            battery_id=battery_id,
            include_charge=include_charge,
            include_flight=include_flight,
            include_voltage=include_voltage,
            include_maintenance=include_maintenance
        )
        
        if "error" in history:
            return f"error,{history['error']}"
        
        output = StringIO()
        writer = csv.writer(output)
        
        writer.writerow(["=== 电池基本信息 ==="])
        writer.writerow(["电池编号", "名称", "购买日期", "初始循环次数", "电芯数量", "容量(mAh)", "状态"])
        battery = history["battery_info"]
        writer.writerow([
            battery["battery_id"],
            battery["name"] or "",
            battery["purchase_date"] or "",
            battery["initial_cycles"],
            battery["cell_count"],
            battery["capacity_mah"] or "",
            battery["status"]
        ])
        
        if include_charge and history["charge_records"]:
            writer.writerow([])
            writer.writerow(["=== 充电记录 ==="])
            writer.writerow([
                "开始时间", "结束时间", "起始电压(V)", "结束电压(V)", 
                "充电电流(A)", "充电容量(mAh)", "循环次数", "充电器"
            ])
            for c in history["charge_records"]:
                writer.writerow([
                    c["charge_start_time"] or "",
                    c["charge_end_time"] or "",
                    c["start_voltage"] or "",
                    c["end_voltage"] or "",
                    c["charge_current"] or "",
                    c["capacity_charged_mah"] or "",
                    c["cycle_count"] or "",
                    c["charger_id"] or ""
                ])
        
        if include_flight and history["flight_records"]:
            writer.writerow([])
            writer.writerow(["=== 飞行记录 ==="])
            writer.writerow([
                "飞行日期", "时长(分)", "起始电压(V)", "结束电压(V)", 
                "最低电压(V)", "平均电流(A)", "最大电流(A)", 
                "温度(°C)", "循环次数", "低压告警", "无人机", "任务"
            ])
            for f in history["flight_records"]:
                writer.writerow([
                    f["flight_date"] or "",
                    f["flight_duration_min"] or "",
                    f["start_voltage"] or "",
                    f["end_voltage"] or "",
                    f["min_voltage"] or "",
                    f["avg_current"] or "",
                    f["max_current"] or "",
                    f["temperature_c"] or "",
                    f["cycle_count"] or "",
                    "是" if f["has_low_voltage_alert"] else "否",
                    f["drone_id"] or "",
                    f["mission_name"] or ""
                ])
        
        if include_voltage and history["voltage_readings"]:
            writer.writerow([])
            writer.writerow(["=== 单体电压读数 ==="])
            writer.writerow([
                "读取时间", "总电压(V)", "电芯1(V)", "电芯2(V)", "电芯3(V)",
                "电芯4(V)", "电芯5(V)", "电芯6(V)", "电芯7(V)", "电芯8(V)",
                "电芯9(V)", "电芯10(V)", "电芯11(V)", "电芯12(V)",
                "最高单体(V)", "最低单体(V)", "压差(V)", "来源"
            ])
            for v in history["voltage_readings"]:
                writer.writerow([
                    v["reading_time"] or "",
                    v["total_voltage"] or "",
                    v["cell_1_voltage"] or "",
                    v["cell_2_voltage"] or "",
                    v["cell_3_voltage"] or "",
                    v["cell_4_voltage"] or "",
                    v["cell_5_voltage"] or "",
                    v["cell_6_voltage"] or "",
                    v["cell_7_voltage"] or "",
                    v["cell_8_voltage"] or "",
                    v["cell_9_voltage"] or "",
                    v["cell_10_voltage"] or "",
                    v["cell_11_voltage"] or "",
                    v["cell_12_voltage"] or "",
                    v["max_cell_voltage"] or "",
                    v["min_cell_voltage"] or "",
                    v["voltage_diff"] or "",
                    v["reading_source"] or ""
                ])
        
        if include_maintenance and history["maintenance_notes"]:
            writer.writerow([])
            writer.writerow(["=== 维修/备注记录 ==="])
            writer.writerow(["日期", "类型", "标题", "内容", "作者", "已封存"])
            for m in history["maintenance_notes"]:
                writer.writerow([
                    m["note_date"] or "",
                    m["note_type"],
                    m["title"],
                    m["content"],
                    m["author"] or "",
                    "是" if m["is_sealed"] else "否"
                ])
        
        return output.getvalue()
