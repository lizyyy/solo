import csv
import io
import json
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from datetime import datetime
from database import (
    Station, SupplyCategory, RaceConfig, SupplyRecord,
    GapRecord, TransferLog, ExceptionLog
)
import schemas


def calculate_backup_ratio(category_name: str, config: RaceConfig) -> float:
    ratios = {
        "水": config.backup_ratio_water,
        "盐丸": config.backup_ratio_salt,
        "能量胶": config.backup_ratio_gel
    }
    return ratios.get(category_name, 0.2)


def classify_gap_level(gap_quantity: int, total_required: int) -> tuple:
    if total_required == 0:
        return ("critical", 1)
    gap_percentage = gap_quantity / total_required
    if gap_percentage >= 0.3:
        return ("critical", 1)
    elif gap_percentage >= 0.15:
        return ("high", 2)
    elif gap_percentage > 0:
        return ("medium", 3)
    else:
        return ("none", 5)


def import_stations_from_csv(db: Session, file_content: bytes) -> dict:
    errors = []
    imported = 0
    try:
        content = file_content.decode('utf-8')
        reader = csv.DictReader(io.StringIO(content))
        for row in reader:
            try:
                station = Station(
                    name=row['name'],
                    km_marker=float(row['km_marker']),
                    type=row.get('type', '普通站'),
                    max_capacity=int(row.get('max_capacity', 10000))
                )
                db.add(station)
                imported += 1
            except Exception as e:
                errors.append(f"行 {reader.line_num}: {str(e)}")
        db.commit()
    except Exception as e:
        db.rollback()
        return {"success": False, "message": str(e), "records_imported": 0, "errors": errors}
    return {"success": True, "message": "站点导入成功", "records_imported": imported, "errors": errors}


def import_supply_allocation_from_csv(db: Session, file_content: bytes) -> dict:
    errors = []
    imported = 0
    raw_inputs = []
    try:
        content = file_content.decode('utf-8')
        reader = csv.DictReader(io.StringIO(content))
        for row in reader:
            raw_inputs.append(json.dumps(row))
            try:
                station = db.query(Station).filter(Station.name == row['station_name']).first()
                category = db.query(SupplyCategory).filter(SupplyCategory.name == row['category_name']).first()
                if not station or not category:
                    errors.append(f"行 {reader.line_num}: 站点或物资品类不存在")
                    continue
                record = SupplyRecord(
                    station_id=station.id,
                    category_id=category.id,
                    allocated_quantity=int(row['allocated_quantity'])
                )
                db.add(record)
                imported += 1
            except Exception as e:
                errors.append(f"行 {reader.line_num}: {str(e)}")
        db.commit()
    except Exception as e:
        log_exception(db, "import_supply_csv", json.dumps(raw_inputs), "system", "failed", str(e))
        db.rollback()
        return {"success": False, "message": str(e), "records_imported": 0, "errors": errors}
    log_exception(db, "import_supply_csv", json.dumps(raw_inputs), "system", "success", "")
    return {"success": True, "message": "物资分配导入成功", "records_imported": imported, "errors": errors}


def calculate_supply_requirements(db: Session, race_config_id: int) -> dict:
    config = db.query(RaceConfig).get(race_config_id)
    if not config:
        return {"success": False, "message": "赛事配置不存在", "total_gaps": 0, "gap_details": []}
    effective_runners = int(config.total_runners * (1 - config.expected_dropout_rate))
    stations = db.query(Station).all()
    stations_count = len(stations)
    if stations_count == 0:
        return {"success": False, "message": "没有站点数据", "total_gaps": 0, "gap_details": []}
    gap_details = []
    total_gaps = 0
    for station in stations:
        categories = db.query(SupplyCategory).all()
        for category in categories:
            base_requirement = int(effective_runners * category.per_person_consumption / stations_count)
            backup_ratio = calculate_backup_ratio(category.name, config)
            backup_requirement = int(base_requirement * backup_ratio)
            total_required = base_requirement + backup_requirement
            record = db.query(SupplyRecord).filter(
                SupplyRecord.station_id == station.id,
                SupplyRecord.category_id == category.id
            ).first()
            if not record:
                record = SupplyRecord(
                    station_id=station.id,
                    category_id=category.id,
                    allocated_quantity=0
                )
                db.add(record)
                db.flush()
            record.backup_quantity = backup_requirement
            record.total_required = total_required
            record.status = "calculated"
            gap = max(0, total_required - record.allocated_quantity)
            if gap > 0:
                gap_level, priority = classify_gap_level(gap, total_required)
                gap_record = db.query(GapRecord).filter(
                    GapRecord.supply_record_id == record.id
                ).first()
                if gap_record:
                    gap_record.gap_quantity = gap
                    gap_record.gap_level = gap_level
                    gap_record.priority = priority
                    gap_record.status = "open"
                else:
                    gap_record = GapRecord(
                        station_id=station.id,
                        category_id=category.id,
                        supply_record_id=record.id,
                        gap_quantity=gap,
                        gap_level=gap_level,
                        priority=priority,
                        raw_input=json.dumps({
                            "allocated": record.allocated_quantity,
                            "required": total_required,
                            "backup": backup_requirement
                        })
                    )
                    db.add(gap_record)
                gap_details.append({
                    "station": station.name,
                    "category": category.name,
                    "gap": gap,
                    "level": gap_level
                })
                total_gaps += 1
    db.commit()
    return {"success": True, "message": "计算完成", "total_gaps": total_gaps, "gap_details": gap_details}


def generate_transfer_suggestions(db: Session) -> List[Dict]:
    suggestions = []
    stations = db.query(Station).order_by(Station.km_marker).all()
    categories = db.query(SupplyCategory).all()
    for category in categories:
        surpluses = []
        deficits = []
        for station in stations:
            record = db.query(SupplyRecord).filter(
                SupplyRecord.station_id == station.id,
                SupplyRecord.category_id == category.id
            ).first()
            if record:
                surplus = record.allocated_quantity - record.total_required
                if surplus > 100:
                    surpluses.append((station, surplus))
                elif surplus < 0:
                    deficits.append((station, abs(surplus)))
        for def_station, def_amount in deficits:
            for sur_station, sur_amount in surpluses:
                if sur_amount <= 0:
                    continue
                distance = abs(def_station.km_marker - sur_station.km_marker)
                if distance < 10:
                    transfer_amount = min(def_amount, sur_amount, int(sur_amount * 0.5))
                    if transfer_amount > 50:
                        suggestions.append({
                            "from_station": sur_station.name,
                            "to_station": def_station.name,
                            "category": category.name,
                            "suggested_quantity": transfer_amount,
                            "priority": 1 if distance < 5 else 2,
                            "reason": f"距离{distance}km，{sur_station.name}富余{sur_amount}{category.unit}，{def_station.name}缺少{def_amount}{category.unit}"
                        })
    return suggestions


def log_exception(db: Session, operation_type: str, raw_input: str, handler: str, conclusion: str, error_message: str = ""):
    log = ExceptionLog(
        operation_type=operation_type,
        raw_input=raw_input,
        handler=handler,
        conclusion=conclusion,
        error_message=error_message
    )
    db.add(log)
    db.commit()


def generate_markdown_report(db: Session, race_config_id: int) -> str:
    config = db.query(RaceConfig).get(race_config_id)
    if not config:
        return "# 赛事补给报告\n\n配置不存在"
    suggestions = generate_transfer_suggestions(db)
    gaps = db.query(GapRecord).filter(GapRecord.status == "open").order_by(GapRecord.priority).all()
    lines = [
        f"# {config.race_name} 补给调拨报告",
        "",
        f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"**参赛人数**: {config.total_runners}",
        f"**预计完赛率**: {(1 - config.expected_dropout_rate) * 100:.0f}%",
        "",
        "## 一、缺口概览",
        "",
        "| 站点 | 物资 | 缺口数量 | 等级 | 优先级 |",
        "|------|------|----------|------|--------|",
    ]
    for gap in gaps:
        station = db.query(Station).get(gap.station_id)
        category = db.query(SupplyCategory).get(gap.category_id)
        lines.append(f"| {station.name} | {category.name} | {gap.gap_quantity} | {gap.gap_level} | {gap.priority} |")
    lines.extend([
        "",
        "## 二、调拨建议",
        "",
        "| 源站点 | 目标站点 | 物资 | 建议调拨量 | 优先级 | 说明 |",
        "|--------|----------|------|------------|--------|------|",
    ])
    for s in suggestions:
        lines.append(f"| {s['from_station']} | {s['to_station']} | {s['category']} | {s['suggested_quantity']} | {s['priority']} | {s['reason']} |")
    lines.extend([
        "",
        "## 三、备用量配置",
        "",
        f"- 水: {config.backup_ratio_water * 100:.0f}%",
        f"- 盐丸: {config.backup_ratio_salt * 100:.0f}%",
        f"- 能量胶: {config.backup_ratio_gel * 100:.0f}%",
    ])
    return "\n".join(lines)
