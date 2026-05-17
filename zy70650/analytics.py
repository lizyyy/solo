from sqlalchemy.orm import Session
from sqlalchemy import between
from typing import List, Dict, Any
from datetime import datetime, timedelta
from models import Vehicle, FuelRecord, MileageRecord, AbnormalReport, Route
import crud

def calculate_fuel_consumption_per_100km(total_fuel: float, total_mileage: float) -> float:
    if total_mileage <= 0:
        return 0.0
    return (total_fuel / total_mileage) * 100

def match_fuel_mileage_by_route(fuel_records: List[FuelRecord], 
                                  mileage_records: List[MileageRecord],
                                  start_date: datetime,
                                  end_date: datetime) -> Dict[str, Any]:
    total_fuel = sum(fr.fuel_amount for fr in fuel_records)
    total_mileage = sum(mr.distance for mr in mileage_records)
    fuel_consumption = calculate_fuel_consumption_per_100km(total_fuel, total_mileage)
    
    return {
        "start_date": start_date,
        "end_date": end_date,
        "total_fuel": total_fuel,
        "total_mileage": total_mileage,
        "fuel_consumption_per_100km": fuel_consumption
    }

def group_records_by_date_range(records, date_field: str, days: int = 7):
    if not records:
        return []
    
    sorted_records = sorted(records, key=lambda x: getattr(x, date_field))
    groups = []
    current_group = [sorted_records[0]]
    group_start = getattr(sorted_records[0], date_field)
    
    for record in sorted_records[1:]:
        record_date = getattr(record, date_field)
        if (record_date - group_start).days < days:
            current_group.append(record)
        else:
            groups.append({
                "start_date": group_start,
                "end_date": getattr(current_group[-1], date_field),
                "records": current_group
            })
            current_group = [record]
            group_start = record_date
    
    if current_group:
        groups.append({
            "start_date": group_start,
            "end_date": getattr(current_group[-1], date_field),
            "records": current_group
        })
    
    return groups

def detect_fuel_theft(fuel_records: List[FuelRecord], 
                      mileage_records: List[MileageRecord],
                      standard_consumption: float,
                      start_date: datetime,
                      end_date: datetime) -> Dict[str, Any]:
    total_fuel = sum(fr.fuel_amount for fr in fuel_records)
    total_mileage = sum(mr.distance for mr in mileage_records)
    
    actual_consumption = calculate_fuel_consumption_per_100km(total_fuel, total_mileage)
    expected_consumption = (total_mileage / 100) * standard_consumption if standard_consumption else 0
    
    deviation_rate = ((actual_consumption - standard_consumption) / standard_consumption) * 100 if standard_consumption else 0
    
    is_suspicious = deviation_rate > 20 or (total_fuel > 0 and total_mileage == 0)
    
    return {
        "is_suspicious": is_suspicious,
        "actual_consumption": actual_consumption,
        "expected_consumption": expected_consumption,
        "deviation_rate": deviation_rate,
        "total_fuel": total_fuel,
        "total_mileage": total_mileage
    }

def detect_mileage_error(mileage_records: List[MileageRecord]) -> Dict[str, Any]:
    if len(mileage_records) < 2:
        return {"is_suspicious": False, "details": "数据不足"}
    
    sorted_records = sorted(mileage_records, key=lambda x: x.record_date)
    suspicious_records = []
    
    for i in range(1, len(sorted_records)):
        prev = sorted_records[i-1]
        curr = sorted_records[i]
        
        mileage_diff = curr.end_mileage - prev.end_mileage
        recorded_distance = curr.distance
        
        if abs(mileage_diff - recorded_distance) > 50:
            suspicious_records.append({
                "date": curr.record_date,
                "expected_mileage_diff": mileage_diff,
                "recorded_distance": recorded_distance,
                "difference": mileage_diff - recorded_distance
            })
    
    return {
        "is_suspicious": len(suspicious_records) > 0,
        "suspicious_records": suspicious_records,
        "count": len(suspicious_records)
    }

def get_abnormal_level(deviation_rate: float) -> str:
    if deviation_rate >= 50:
        return "严重"
    elif deviation_rate >= 30:
        return "中等"
    elif deviation_rate >= 20:
        return "轻微"
    return "正常"

def analyze_vehicle_abnormal(db: Session, vehicle_id: int, 
                               start_date: datetime = None, 
                               end_date: datetime = None) -> List[Dict[str, Any]]:
    if not start_date:
        start_date = datetime.now() - timedelta(days=30)
    if not end_date:
        end_date = datetime.now()
    
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        return []
    
    fuel_records = crud.get_vehicle_fuel_records(db, vehicle_id, start_date, end_date)
    mileage_records = crud.get_vehicle_mileage_records(db, vehicle_id, start_date, end_date)
    
    if not fuel_records and not mileage_records:
        return []
    
    abnormal_results = []
    
    fuel_groups = group_records_by_date_range(fuel_records, "fuel_date", days=7)
    mileage_groups = group_records_by_date_range(mileage_records, "record_date", days=7)
    
    for fuel_group in fuel_groups:
        group_start = fuel_group["start_date"]
        group_end = fuel_group["end_date"]
        
        group_mileage = [mr for mr in mileage_records 
                          if group_start <= mr.record_date <= group_end]
        
        standard_consumption = vehicle.standard_fuel_consumption or 25.0
        
        fuel_theft_result = detect_fuel_theft(
            fuel_group["records"],
            group_mileage,
            standard_consumption,
            group_start,
            group_end
        )
        
        if fuel_theft_result["is_suspicious"]:
            level = get_abnormal_level(fuel_theft_result["deviation_rate"])
            abnormal_results.append({
                "vehicle_id": vehicle_id,
                "plate_number": vehicle.plate_number,
                "abnormal_type": "疑似偷油",
                "abnormal_level": level,
                "start_date": group_start,
                "end_date": group_end,
                "actual_fuel_consumption": fuel_theft_result["actual_consumption"],
                "expected_fuel_consumption": fuel_theft_result["expected_consumption"],
                "deviation_rate": fuel_theft_result["deviation_rate"],
                "description": f"百公里油耗异常: 实际{fuel_theft_result['actual_consumption']:.2f}L, 标准{standard_consumption}L, 偏差{fuel_theft_result['deviation_rate']:.1f}%"
            })
    
    mileage_error_result = detect_mileage_error(mileage_records)
    if mileage_error_result["is_suspicious"]:
        for error in mileage_error_result["suspicious_records"]:
            abnormal_results.append({
                "vehicle_id": vehicle_id,
                "plate_number": vehicle.plate_number,
                "abnormal_type": "里程录错",
                "abnormal_level": "中等",
                "start_date": error["date"],
                "end_date": error["date"],
                "description": f"里程记录不匹配: 记录行驶{error['recorded_distance']}km, 实际里程差{error['expected_mileage_diff']}km, 差异{abs(error['difference'])}km"
            })
    
    return abnormal_results

def batch_analyze_all_vehicles(db: Session, 
                                start_date: datetime = None,
                                end_date: datetime = None) -> List[Dict[str, Any]]:
    vehicles = crud.get_all_vehicles(db)
    all_abnormal = []
    
    for vehicle in vehicles:
        vehicle_abnormal = analyze_vehicle_abnormal(db, vehicle.id, start_date, end_date)
        all_abnormal.extend(vehicle_abnormal)
    
    return all_abnormal

def analyze_single_route(db: Session, route_id: int) -> Dict[str, Any]:
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        return None
    
    vehicle = db.query(Vehicle).filter(Vehicle.id == route.vehicle_id).first()
    if not vehicle:
        return None
    
    fuel_records = db.query(FuelRecord).filter(
        FuelRecord.vehicle_id == route.vehicle_id,
        between(FuelRecord.fuel_date, route.start_date, route.end_date)
    ).all()
    
    mileage_records = db.query(MileageRecord).filter(
        MileageRecord.vehicle_id == route.vehicle_id,
        between(MileageRecord.record_date, route.start_date, route.end_date)
    ).all()
    
    total_fuel = sum(fr.fuel_amount for fr in fuel_records)
    total_mileage = sum(mr.distance for mr in mileage_records)
    
    if route.total_fuel is None:
        route.total_fuel = total_fuel
    if route.total_distance is None:
        route.total_distance = total_mileage
    db.commit()
    
    actual_consumption = calculate_fuel_consumption_per_100km(total_fuel, total_mileage)
    standard_consumption = vehicle.standard_fuel_consumption or 25.0
    deviation_rate = ((actual_consumption - standard_consumption) / standard_consumption) * 100 if standard_consumption else 0
    
    is_abnormal = False
    abnormal_type = None
    abnormal_level = None
    
    if deviation_rate > 20 or (total_fuel > 0 and total_mileage == 0):
        is_abnormal = True
        abnormal_type = "疑似偷油"
        abnormal_level = get_abnormal_level(deviation_rate)
    
    mileage_error_result = detect_mileage_error(mileage_records)
    if mileage_error_result["is_suspicious"]:
        is_abnormal = True
        abnormal_type = abnormal_type or "里程录错"
        abnormal_level = "中等"
    
    result = {
        "route_id": route.id,
        "route_name": route.route_name,
        "vehicle_id": route.vehicle_id,
        "plate_number": vehicle.plate_number,
        "start_date": route.start_date,
        "end_date": route.end_date,
        "start_location": route.start_location,
        "end_location": route.end_location,
        "total_fuel": total_fuel,
        "total_mileage": total_mileage,
        "fuel_consumption_100km": actual_consumption,
        "standard_consumption": standard_consumption,
        "deviation_rate": deviation_rate,
        "is_abnormal": is_abnormal,
        "abnormal_type": abnormal_type,
        "abnormal_level": abnormal_level
    }
    
    return result

def analyze_routes_by_vehicle(db: Session, 
                               vehicle_id: int = None,
                               start_date: datetime = None,
                               end_date: datetime = None) -> List[Dict[str, Any]]:
    query = db.query(Route)
    if vehicle_id:
        query = query.filter(Route.vehicle_id == vehicle_id)
    if start_date:
        query = query.filter(Route.start_date >= start_date)
    if end_date:
        query = query.filter(Route.end_date <= end_date)
    
    routes = query.order_by(Route.start_date).all()
    
    results = []
    for route in routes:
        route_analysis = analyze_single_route(db, route.id)
        if route_analysis:
            results.append(route_analysis)
    
    return results

def generate_abnormal_reports_by_routes(db: Session,
                                          start_date: datetime = None,
                                          end_date: datetime = None) -> List[AbnormalReport]:
    route_analyses = analyze_routes_by_vehicle(db, None, start_date, end_date)
    reports = []
    
    for analysis in route_analyses:
        if analysis["is_abnormal"]:
            report_data = {
                "vehicle_id": analysis["vehicle_id"],
                "route_id": analysis["route_id"],
                "abnormal_type": analysis["abnormal_type"],
                "abnormal_level": analysis["abnormal_level"],
                "status": "待处理",
                "start_date": analysis["start_date"],
                "end_date": analysis["end_date"],
                "actual_fuel_consumption": analysis["fuel_consumption_100km"],
                "expected_fuel_consumption": analysis["standard_consumption"],
                "deviation_rate": analysis["deviation_rate"],
                "description": f"路线'{analysis['route_name']}'异常: 百公里油耗{analysis['fuel_consumption_100km']:.2f}L, 偏差{analysis['deviation_rate']:.1f}%"
            }
            
            existing = db.query(AbnormalReport).filter(
                AbnormalReport.vehicle_id == report_data["vehicle_id"],
                AbnormalReport.route_id == report_data["route_id"],
                AbnormalReport.abnormal_type == report_data["abnormal_type"]
            ).first()
            
            if not existing:
                report = crud.create_abnormal_report(db, report_data)
                reports.append(report)
    
    return reports

def generate_abnormal_reports(db: Session, 
                                start_date: datetime = None,
                                end_date: datetime = None) -> List[AbnormalReport]:
    route_reports = generate_abnormal_reports_by_routes(db, start_date, end_date)
    
    if route_reports:
        return route_reports
    
    abnormal_results = batch_analyze_all_vehicles(db, start_date, end_date)
    reports = []
    
    for result in abnormal_results:
        existing = db.query(AbnormalReport).filter(
            AbnormalReport.vehicle_id == result["vehicle_id"],
            AbnormalReport.abnormal_type == result["abnormal_type"],
            AbnormalReport.start_date == result["start_date"],
            AbnormalReport.end_date == result["end_date"]
        ).first()
        
        if not existing:
            report = crud.create_abnormal_report(db, result)
            reports.append(report)
    
    return reports
