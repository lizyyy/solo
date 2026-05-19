import csv
import json
from pathlib import Path
from typing import Tuple, List, Dict, Any, Optional
from datetime import datetime

from .database import db


def validate_battery_level(value: str) -> Tuple[bool, Optional[str], Optional[str]]:
    try:
        level = float(value)
        if 0 <= level <= 100:
            return True, level, None
        return False, None, f"电量值 {level} 超出范围 (0-100)"
    except ValueError:
        return False, None, f"无效的电量值: '{value}'"


def validate_plate_number(plate: str) -> Tuple[bool, Optional[str], Optional[str]]:
    plate = plate.strip()
    if not plate:
        return False, None, "车牌号不能为空"
    if len(plate) < 4:
        return False, None, f"车牌号 '{plate}' 格式不正确"
    return True, plate, None


def suggest_fix(error_msg: str, raw_data: Dict[str, Any]) -> str:
    if "电量" in error_msg and "超出范围" in error_msg:
        if "battery_level" in raw_data:
            try:
                val = float(raw_data["battery_level"])
                if val > 100:
                    return f"建议将电量从 {val} 修改为 100 或检查原始读数"
                if val < 0:
                    return f"建议将电量从 {val} 修改为 0 或检查原始读数"
            except:
                pass
        return "建议检查电量值，有效范围 0-100"
    
    if "车牌号" in error_msg:
        return "建议核对车牌号格式，确保至少4个字符且不为空"
    
    if "station_id" in error_msg or "充电桩ID" in error_msg:
        return "建议检查充电桩ID格式"
    
    return "建议核对原始数据格式是否正确"


def import_vehicles_csv(file_path: str) -> Dict[str, Any]:
    path = Path(file_path)
    session_id = db.create_session("vehicles", str(path.absolute()))
    
    success_count = 0
    error_count = 0
    total = 0
    row_num = 0
    
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            row_num += 1
            total += 1
            errors = []
            cleaned_data = {}
            
            plate_valid, plate, plate_err = validate_plate_number(row.get("plate_number", ""))
            if not plate_valid:
                errors.append(plate_err)
            else:
                cleaned_data["plate_number"] = plate
            
            batt_valid, batt_level, batt_err = validate_battery_level(row.get("battery_level", ""))
            if not batt_valid:
                errors.append(batt_err)
            else:
                cleaned_data["battery_level"] = batt_level
            
            cleaned_data["driver_name"] = row.get("driver_name", "").strip() or None
            cleaned_data["checkin_time"] = row.get("checkin_time", "").strip() or None
            
            if errors:
                error_msg = " | ".join(errors)
                suggestion = suggest_fix(error_msg, row)
                db.insert_error(
                    session_id=session_id,
                    source_type="vehicles",
                    row_number=row_num,
                    raw_data=json.dumps(row, ensure_ascii=False),
                    error_message=error_msg,
                    suggestion=suggestion
                )
                error_count += 1
            else:
                db.insert_vehicle(session_id, cleaned_data)
                success_count += 1
    
    db.update_session_stats(session_id, total, success_count, error_count)
    
    return {
        "session_id": session_id,
        "total": total,
        "success": success_count,
        "errors": error_count
    }


def import_charging_stations_json(file_path: str) -> Dict[str, Any]:
    path = Path(file_path)
    session_id = db.create_session("charging_stations", str(path.absolute()))
    
    success_count = 0
    error_count = 0
    total = 0
    row_num = 0
    
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        stations = data if isinstance(data, list) else data.get("stations", [])
        
        for station in stations:
            row_num += 1
            total += 1
            errors = []
            cleaned_data = {}
            
            station_id = station.get("station_id", "").strip()
            if not station_id:
                errors.append("充电桩ID不能为空")
            else:
                cleaned_data["station_id"] = station_id
            
            is_occupied = station.get("is_occupied")
            if isinstance(is_occupied, bool):
                cleaned_data["is_occupied"] = is_occupied
            elif isinstance(is_occupied, str):
                cleaned_data["is_occupied"] = is_occupied.lower() in ("true", "1", "yes")
            else:
                cleaned_data["is_occupied"] = bool(is_occupied)
            
            vehicle_plate = station.get("vehicle_plate")
            cleaned_data["vehicle_plate"] = vehicle_plate.strip() if vehicle_plate else None
            cleaned_data["power_kw"] = station.get("power_kw")
            cleaned_data["last_updated"] = station.get("last_updated")
            
            if errors:
                error_msg = " | ".join(errors)
                suggestion = suggest_fix(error_msg, station)
                db.insert_error(
                    session_id=session_id,
                    source_type="charging_stations",
                    row_number=row_num,
                    raw_data=json.dumps(station, ensure_ascii=False),
                    error_message=error_msg,
                    suggestion=suggestion
                )
                error_count += 1
            else:
                db.insert_charging_station(session_id, cleaned_data)
                success_count += 1
    
    db.update_session_stats(session_id, total, success_count, error_count)
    
    return {
        "session_id": session_id,
        "total": total,
        "success": success_count,
        "errors": error_count
    }


def import_tasks_json(file_path: str) -> Dict[str, Any]:
    path = Path(file_path)
    session_id = db.create_session("tasks", str(path.absolute()))
    
    success_count = 0
    error_count = 0
    total = 0
    row_num = 0
    
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        tasks = data if isinstance(data, list) else data.get("tasks", [])
        
        for task in tasks:
            row_num += 1
            total += 1
            errors = []
            cleaned_data = {}
            
            task_id = task.get("task_id", "").strip()
            if not task_id:
                errors.append("任务ID不能为空")
            else:
                cleaned_data["task_id"] = task_id
            
            task_type = task.get("task_type", "").strip()
            if not task_type:
                errors.append("任务类型不能为空")
            else:
                cleaned_data["task_type"] = task_type
            
            priority = task.get("priority", "normal").lower()
            if priority not in ("low", "normal", "high", "urgent"):
                priority = "normal"
            cleaned_data["priority"] = priority
            
            cleaned_data["description"] = task.get("description", "").strip() or None
            cleaned_data["assignee"] = task.get("assignee", "").strip() or None
            cleaned_data["scheduled_time"] = task.get("scheduled_time", "").strip() or None
            
            if errors:
                error_msg = " | ".join(errors)
                suggestion = suggest_fix(error_msg, task)
                db.insert_error(
                    session_id=session_id,
                    source_type="tasks",
                    row_number=row_num,
                    raw_data=json.dumps(task, ensure_ascii=False),
                    error_message=error_msg,
                    suggestion=suggestion
                )
                error_count += 1
            else:
                db.insert_task(session_id, cleaned_data)
                success_count += 1
    
    db.update_session_stats(session_id, total, success_count, error_count)
    
    return {
        "session_id": session_id,
        "total": total,
        "success": success_count,
        "errors": error_count
    }
