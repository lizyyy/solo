import csv
from io import StringIO
from sqlalchemy.orm import Session
from typing import List
from models import FuelRecord, MileageRecord, AbnormalReport, Vehicle
import crud

def export_fuel_records_to_csv(db: Session, vehicle_id: int = None, 
                                start_date=None, end_date=None) -> str:
    if vehicle_id:
        records = crud.get_vehicle_fuel_records(db, vehicle_id, start_date, end_date)
    else:
        from sqlalchemy import between
        query = db.query(FuelRecord)
        if start_date and end_date:
            query = query.filter(between(FuelRecord.fuel_date, start_date, end_date))
        records = query.order_by(FuelRecord.fuel_date).all()
    
    output = StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "ID", "车牌号", "油卡号", "加油日期", "加油量(L)", "单价(元)", 
        "总金额(元)", "里程表读数", "加油站", "创建时间"
    ])
    
    for record in records:
        vehicle = db.query(Vehicle).filter(Vehicle.id == record.vehicle_id).first()
        writer.writerow([
            record.id,
            vehicle.plate_number if vehicle else "",
            record.card_number,
            record.fuel_date.strftime("%Y-%m-%d %H:%M:%S"),
            record.fuel_amount,
            record.fuel_price or "",
            record.total_cost or "",
            record.odometer or "",
            record.station or "",
            record.created_at.strftime("%Y-%m-%d %H:%M:%S")
        ])
    
    return output.getvalue()

def export_mileage_records_to_csv(db: Session, vehicle_id: int = None,
                                   start_date=None, end_date=None) -> str:
    if vehicle_id:
        records = crud.get_vehicle_mileage_records(db, vehicle_id, start_date, end_date)
    else:
        from sqlalchemy import between
        query = db.query(MileageRecord)
        if start_date and end_date:
            query = query.filter(between(MileageRecord.record_date, start_date, end_date))
        records = query.order_by(MileageRecord.record_date).all()
    
    output = StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "ID", "车牌号", "GPS设备ID", "记录日期", "起始里程", "结束里程",
        "行驶距离", "起点位置", "终点位置", "创建时间"
    ])
    
    for record in records:
        vehicle = db.query(Vehicle).filter(Vehicle.id == record.vehicle_id).first()
        writer.writerow([
            record.id,
            vehicle.plate_number if vehicle else "",
            record.gps_device_id or "",
            record.record_date.strftime("%Y-%m-%d %H:%M:%S"),
            record.start_mileage,
            record.end_mileage,
            record.distance,
            record.start_location or "",
            record.end_location or "",
            record.created_at.strftime("%Y-%m-%d %H:%M:%S")
        ])
    
    return output.getvalue()

def export_abnormal_reports_to_csv(db: Session, status: str = None, 
                                    level: str = None, vehicle_id: int = None) -> str:
    records = crud.get_abnormal_reports(db, status, level, vehicle_id)
    
    output = StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "ID", "车牌号", "异常类型", "异常级别", "状态",
        "开始日期", "结束日期", "实际油耗(L/100km)",
        "预期油耗(L/100km)", "偏差率(%)", "描述",
        "处理人", "处理意见", "处理时间", "创建时间"
    ])
    
    for record in records:
        vehicle = db.query(Vehicle).filter(Vehicle.id == record.vehicle_id).first()
        writer.writerow([
            record.id,
            vehicle.plate_number if vehicle else "",
            record.abnormal_type,
            record.abnormal_level,
            record.status,
            record.start_date.strftime("%Y-%m-%d %H:%M:%S"),
            record.end_date.strftime("%Y-%m-%d %H:%M:%S"),
            f"{record.actual_fuel_consumption:.2f}" if record.actual_fuel_consumption else "",
            f"{record.expected_fuel_consumption:.2f}" if record.expected_fuel_consumption else "",
            f"{record.deviation_rate:.1f}" if record.deviation_rate else "",
            record.description or "",
            record.handler or "",
            record.handle_comment or "",
            record.handled_at.strftime("%Y-%m-%d %H:%M:%S") if record.handled_at else "",
            record.created_at.strftime("%Y-%m-%d %H:%M:%S")
        ])
    
    return output.getvalue()

def export_abnormal_reports_to_markdown(db: Session, status: str = None,
                                         level: str = None, vehicle_id: int = None) -> str:
    records = crud.get_abnormal_reports(db, status, level, vehicle_id)
    
    lines = []
    lines.append("# 油耗异常报告")
    lines.append("")
    lines.append(f"生成时间: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    
    if not records:
        lines.append("未发现异常记录。")
        return "\n".join(lines)
    
    level_stats = {"轻微": 0, "中等": 0, "严重": 0}
    type_stats = {"疑似偷油": 0, "里程录错": 0, "油耗过高": 0, "数据不匹配": 0}
    
    for record in records:
        level_stats[record.abnormal_level] = level_stats.get(record.abnormal_level, 0) + 1
        type_stats[record.abnormal_type] = type_stats.get(record.abnormal_type, 0) + 1
    
    lines.append("## 统计概览")
    lines.append("")
    lines.append("### 按异常级别统计")
    lines.append("")
    for level, count in level_stats.items():
        if count > 0:
            lines.append(f"- {level}: {count} 条")
    lines.append("")
    lines.append("### 按异常类型统计")
    lines.append("")
    for type_name, count in type_stats.items():
        if count > 0:
            lines.append(f"- {type_name}: {count} 条")
    lines.append("")
    lines.append("## 异常详情")
    lines.append("")
    
    for i, record in enumerate(records, 1):
        vehicle = db.query(Vehicle).filter(Vehicle.id == record.vehicle_id).first()
        lines.append(f"### {i}. {vehicle.plate_number if vehicle else '未知车辆'} - {record.abnormal_type} ({record.abnormal_level})")
        lines.append("")
        lines.append(f"- **状态**: {record.status}")
        lines.append(f"- **时间范围**: {record.start_date.strftime('%Y-%m-%d')} 至 {record.end_date.strftime('%Y-%m-%d')}")
        if record.actual_fuel_consumption:
            lines.append(f"- **实际油耗**: {record.actual_fuel_consumption:.2f} L/100km")
        if record.expected_fuel_consumption:
            lines.append(f"- **预期油耗**: {record.expected_fuel_consumption:.2f} L/100km")
        if record.deviation_rate:
            lines.append(f"- **偏差率**: {record.deviation_rate:.1f}%")
        if record.description:
            lines.append(f"- **描述**: {record.description}")
        if record.handler:
            lines.append(f"- **处理人**: {record.handler}")
        if record.handle_comment:
            lines.append(f"- **处理意见**: {record.handle_comment}")
        if record.handled_at:
            lines.append(f"- **处理时间**: {record.handled_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
    
    return "\n".join(lines)
