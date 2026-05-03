from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from models import (
    VehicleTemperature, DrugBatch, HandoverScan, 
    TemperatureRule, Route, Issue
)
from collections import defaultdict


def get_batch_temperature_range(db: Session, batch_number: str) -> Tuple[float, float]:
    batch = db.query(DrugBatch).filter(
        DrugBatch.batch_number == batch_number
    ).first()
    
    if batch and batch.min_temp is not None and batch.max_temp is not None:
        return (batch.min_temp, batch.max_temp)
    
    rules = db.query(TemperatureRule).all()
    if rules:
        default_rule = rules[0]
        return (default_rule.min_temp, default_rule.max_temp)
    
    return (2.0, 8.0)


def calculate_temperature_exceed_duration(
    db: Session,
    vehicle_id: str,
    start_time: datetime,
    end_time: datetime,
    min_temp: float,
    max_temp: float
) -> Dict[str, Any]:
    temperatures = db.query(VehicleTemperature).filter(
        VehicleTemperature.vehicle_id == vehicle_id,
        VehicleTemperature.timestamp >= start_time,
        VehicleTemperature.timestamp <= end_time
    ).order_by(VehicleTemperature.timestamp).all()
    
    if not temperatures:
        return {
            "total_exceed_minutes": 0,
            "exceed_segments": [],
            "max_temperature": None,
            "min_temperature_recorded": None
        }
    
    exceed_segments = []
    current_segment = None
    total_minutes = 0
    all_temps = [t.temperature for t in temperatures]
    
    for i, temp_record in enumerate(temperatures):
        temp = temp_record.temperature
        is_exceed = temp < min_temp or temp > max_temp
        
        if is_exceed:
            if current_segment is None:
                current_segment = {
                    "start_time": temp_record.timestamp,
                    "start_temp": temp,
                    "end_time": temp_record.timestamp,
                    "end_temp": temp,
                    "max_temp": temp,
                    "min_temp": temp,
                    "type": "below_range" if temp < min_temp else "above_range"
                }
            else:
                current_segment["end_time"] = temp_record.timestamp
                current_segment["end_temp"] = temp
                current_segment["max_temp"] = max(current_segment["max_temp"], temp)
                current_segment["min_temp"] = min(current_segment["min_temp"], temp)
        else:
            if current_segment is not None:
                duration_minutes = int(
                    (current_segment["end_time"] - current_segment["start_time"]).total_seconds() / 60
                )
                if duration_minutes == 0:
                    duration_minutes = 1
                current_segment["duration_minutes"] = duration_minutes
                total_minutes += duration_minutes
                exceed_segments.append(current_segment)
                current_segment = None
    
    if current_segment is not None:
        duration_minutes = int(
            (current_segment["end_time"] - current_segment["start_time"]).total_seconds() / 60
        )
        if duration_minutes == 0:
            duration_minutes = 1
        current_segment["duration_minutes"] = duration_minutes
        total_minutes += duration_minutes
        exceed_segments.append(current_segment)
    
    return {
        "total_exceed_minutes": total_minutes,
        "exceed_segments": exceed_segments,
        "max_temperature": max(all_temps) if all_temps else None,
        "min_temperature_recorded": min(all_temps) if all_temps else None
    }


def detect_handover_breakpoints(
    db: Session,
    batch_number: str
) -> List[Dict[str, Any]]:
    scans = db.query(HandoverScan).filter(
        HandoverScan.batch_number == batch_number
    ).order_by(HandoverScan.scan_time).all()
    
    breakpoints = []
    
    if len(scans) < 2:
        return breakpoints
    
    load_types = ["装车", "load", "in"]
    unload_types = ["卸车", "unload", "out"]
    
    in_transit = False
    last_scan = None
    last_vehicle = None
    
    for scan in scans:
        scan_type_lower = scan.scan_type.lower()
        
        is_load = scan_type_lower in load_types
        is_unload = scan_type_lower in unload_types
        
        if is_load:
            if in_transit and last_vehicle != scan.vehicle_id:
                breakpoints.append({
                    "type": "vehicle_switch_without_unload",
                    "description": f"批号 {batch_number} 在车辆 {last_vehicle} 中未卸车即转移到车辆 {scan.vehicle_id}",
                    "last_vehicle": last_vehicle,
                    "new_vehicle": scan.vehicle_id,
                    "last_scan_time": last_scan.scan_time.isoformat() if last_scan else None,
                    "current_scan_time": scan.scan_time.isoformat()
                })
            in_transit = True
            last_vehicle = scan.vehicle_id
        
        elif is_unload:
            if not in_transit:
                breakpoints.append({
                    "type": "unload_without_load",
                    "description": f"批号 {batch_number} 在车辆 {scan.vehicle_id} 中执行卸车操作，但无对应装车记录",
                    "vehicle_id": scan.vehicle_id,
                    "scan_time": scan.scan_time.isoformat()
                })
            elif last_vehicle != scan.vehicle_id:
                breakpoints.append({
                    "type": "unload_from_wrong_vehicle",
                    "description": f"批号 {batch_number} 从车辆 {scan.vehicle_id} 卸车，但最后装车车辆是 {last_vehicle}",
                    "expected_vehicle": last_vehicle,
                    "actual_vehicle": scan.vehicle_id,
                    "scan_time": scan.scan_time.isoformat()
                })
            in_transit = False
            last_vehicle = scan.vehicle_id
        
        last_scan = scan
    
    if in_transit:
        breakpoints.append({
            "type": "missing_unload",
            "description": f"批号 {batch_number} 在车辆 {last_vehicle} 中装车后未执行卸车操作",
            "vehicle_id": last_vehicle,
            "last_scan_time": last_scan.scan_time.isoformat() if last_scan else None
        })
    
    return breakpoints


def detect_duplicate_loading(
    db: Session,
    batch_number: str
) -> List[Dict[str, Any]]:
    scans = db.query(HandoverScan).filter(
        HandoverScan.batch_number == batch_number
    ).order_by(HandoverScan.scan_time).all()
    
    duplicates = []
    load_types = ["装车", "load", "in"]
    
    in_transit = False
    current_vehicle = None
    
    for scan in scans:
        scan_type_lower = scan.scan_type.lower()
        is_load = scan_type_lower in load_types
        
        if is_load:
            if in_transit:
                if current_vehicle == scan.vehicle_id:
                    duplicates.append({
                        "type": "same_vehicle_duplicate_load",
                        "description": f"批号 {batch_number} 在车辆 {scan.vehicle_id} 中重复装车",
                        "vehicle_id": scan.vehicle_id,
                        "scan_time": scan.scan_time.isoformat(),
                        "batch_number": batch_number
                    })
                else:
                    duplicates.append({
                        "type": "cross_vehicle_duplicate_load",
                        "description": f"批号 {batch_number} 从车辆 {current_vehicle} 转移到 {scan.vehicle_id} 但未卸车",
                        "from_vehicle": current_vehicle,
                        "to_vehicle": scan.vehicle_id,
                        "scan_time": scan.scan_time.isoformat(),
                        "batch_number": batch_number
                    })
            
            in_transit = True
            current_vehicle = scan.vehicle_id
        else:
            in_transit = False
            current_vehicle = None
    
    return duplicates


def assign_midnight_routes(db: Session) -> List[Dict[str, Any]]:
    results = []
    
    vehicles = db.query(VehicleTemperature.vehicle_id).distinct().all()
    vehicles = [v[0] for v in vehicles]
    
    for vehicle_id in vehicles:
        temps = db.query(VehicleTemperature).filter(
            VehicleTemperature.vehicle_id == vehicle_id
        ).order_by(VehicleTemperature.timestamp).all()
        
        if not temps:
            continue
        
        current_route_id = None
        route_start = None
        route_end = None
        route_temps = []
        
        for temp in temps:
            temp_date = temp.timestamp.date()
            
            if route_start is None:
                route_start = temp_date
                current_route_id = f"R_{vehicle_id}_{route_start.strftime('%Y%m%d')}"
                route_temps = [temp]
            else:
                day_diff = (temp_date - route_start).days
                
                if day_diff == 0:
                    route_temps.append(temp)
                elif day_diff == 1:
                    hour = temp.timestamp.hour
                    if hour < 6:
                        route_temps.append(temp)
                    else:
                        route_end = route_temps[-1].timestamp
                        results.append({
                            "vehicle_id": vehicle_id,
                            "route_id": current_route_id,
                            "start_time": route_temps[0].timestamp.isoformat(),
                            "end_time": route_end.isoformat(),
                            "record_count": len(route_temps),
                            "crossed_midnight": True
                        })
                        
                        route_start = temp_date
                        current_route_id = f"R_{vehicle_id}_{route_start.strftime('%Y%m%d')}"
                        route_temps = [temp]
                else:
                    route_end = route_temps[-1].timestamp
                    results.append({
                        "vehicle_id": vehicle_id,
                        "route_id": current_route_id,
                        "start_time": route_temps[0].timestamp.isoformat(),
                        "end_time": route_end.isoformat(),
                        "record_count": len(route_temps),
                        "crossed_midnight": False
                    })
                    
                    route_start = temp_date
                    current_route_id = f"R_{vehicle_id}_{route_start.strftime('%Y%m%d')}"
                    route_temps = [temp]
        
        if route_temps:
            route_end = route_temps[-1].timestamp
            results.append({
                "vehicle_id": vehicle_id,
                "route_id": current_route_id,
                "start_time": route_temps[0].timestamp.isoformat(),
                "end_time": route_end.isoformat(),
                "record_count": len(route_temps),
                "crossed_midnight": (route_temps[0].timestamp.date() != route_temps[-1].timestamp.date())
            })
    
    return results


def perform_risk_review(db: Session) -> Dict[str, Any]:
    issues = []
    
    all_batches = db.query(DrugBatch).all()
    batch_numbers = [b.batch_number for b in all_batches]
    
    if not batch_numbers:
        distinct_batches = db.query(HandoverScan.batch_number).distinct().all()
        batch_numbers = [b[0] for b in distinct_batches]
    
    for batch_number in batch_numbers:
        batch = db.query(DrugBatch).filter(
            DrugBatch.batch_number == batch_number
        ).first()
        
        min_temp, max_temp = get_batch_temperature_range(db, batch_number)
        
        scans = db.query(HandoverScan).filter(
            HandoverScan.batch_number == batch_number
        ).order_by(HandoverScan.scan_time).all()
        
        if not scans:
            continue
        
        load_types = ["装车", "load", "in"]
        unload_types = ["卸车", "unload", "out"]
        
        for i in range(len(scans)):
            scan = scans[i]
            scan_type_lower = scan.scan_type.lower()
            
            if scan_type_lower in load_types:
                vehicle_id = scan.vehicle_id
                start_time = scan.scan_time
                
                end_time = None
                for j in range(i + 1, len(scans)):
                    next_scan = scans[j]
                    next_type_lower = next_scan.scan_type.lower()
                    if next_type_lower in unload_types and next_scan.vehicle_id == vehicle_id:
                        end_time = next_scan.scan_time
                        break
                
                if end_time is None:
                    end_time = datetime.utcnow()
                
                temp_analysis = calculate_temperature_exceed_duration(
                    db, vehicle_id, start_time, end_time, min_temp, max_temp
                )
                
                rules = db.query(TemperatureRule).all()
                allowed_exceed = 0
                if rules:
                    allowed_exceed = rules[0].allowed_exceed_duration_minutes or 0
                
                if temp_analysis["total_exceed_minutes"] > allowed_exceed:
                    for segment in temp_analysis["exceed_segments"]:
                        if segment["duration_minutes"] > allowed_exceed:
                            issues.append(Issue(
                                issue_type="temperature_exceed",
                                severity="high" if segment["duration_minutes"] > 30 else "medium",
                                description=f"批号 {batch_number} 在车辆 {vehicle_id} 中温度{segment['type']}，持续 {segment['duration_minutes']} 分钟",
                                batch_number=batch_number,
                                vehicle_id=vehicle_id,
                                start_time=segment["start_time"],
                                end_time=segment["end_time"],
                                exceed_minutes=segment["duration_minutes"],
                                temperature=segment["max_temp"] if segment["type"] == "above_range" else segment["min_temp"]
                            ))
        
        breakpoints = detect_handover_breakpoints(db, batch_number)
        for bp in breakpoints:
            issues.append(Issue(
                issue_type=bp["type"],
                severity="high",
                description=bp["description"],
                batch_number=batch_number,
                vehicle_id=bp.get("vehicle_id") or bp.get("last_vehicle"),
                start_time=datetime.fromisoformat(bp["scan_time"]) if bp.get("scan_time") else None
            ))
        
        duplicates = detect_duplicate_loading(db, batch_number)
        for dup in duplicates:
            issues.append(Issue(
                issue_type=dup["type"],
                severity="critical",
                description=dup["description"],
                batch_number=batch_number,
                vehicle_id=dup.get("vehicle_id") or dup.get("to_vehicle")
            ))
    
    for issue in issues:
        existing = db.query(Issue).filter(
            Issue.issue_type == issue.issue_type,
            Issue.batch_number == issue.batch_number,
            Issue.description == issue.description
        ).first()
        
        if not existing:
            db.add(issue)
    
    db.commit()
    
    all_issues = db.query(Issue).order_by(Issue.created_at.desc()).all()
    
    return {
        "total_issues": len(all_issues),
        "by_severity": {
            "critical": len([i for i in all_issues if i.severity == "critical"]),
            "high": len([i for i in all_issues if i.severity == "high"]),
            "medium": len([i for i in all_issues if i.severity == "medium"]),
            "low": len([i for i in all_issues if i.severity == "low"])
        },
        "by_type": _count_by_type(all_issues),
        "issues": [i.to_dict() for i in all_issues]
    }


def _count_by_type(issues: List[Issue]) -> Dict[str, int]:
    counts = defaultdict(int)
    for issue in issues:
        counts[issue.issue_type] += 1
    return dict(counts)


def generate_report(db: Session) -> Dict[str, Any]:
    review_result = perform_risk_review(db)
    
    temp_count = db.query(VehicleTemperature).count()
    batch_count = db.query(DrugBatch).count()
    scan_count = db.query(HandoverScan).count()
    rule_count = db.query(TemperatureRule).count()
    
    midnight_routes = assign_midnight_routes(db)
    cross_midnight_count = len([r for r in midnight_routes if r.get("crossed_midnight")])
    
    return {
        "summary": {
            "total_temperature_records": temp_count,
            "total_batches": batch_count,
            "total_scans": scan_count,
            "total_rules": rule_count,
            "routes_crossed_midnight": cross_midnight_count
        },
        "risk_review": review_result,
        "midnight_routes": midnight_routes,
        "generated_at": datetime.utcnow().isoformat()
    }
