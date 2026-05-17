from sqlalchemy.orm import Session
from sqlalchemy import and_, between, func
from models import Driver, Vehicle, FuelRecord, MileageRecord, Route, AbnormalReport
from datetime import datetime
from typing import List, Optional, Dict, Any

def get_vehicle_by_plate(db: Session, plate_number: str):
    return db.query(Vehicle).filter(Vehicle.plate_number == plate_number).first()

def create_vehicle(db: Session, vehicle_data: Dict[str, Any]):
    db_vehicle = Vehicle(
        plate_number=vehicle_data["plate_number"],
        vehicle_type=vehicle_data.get("vehicle_type"),
        fuel_type=vehicle_data.get("fuel_type"),
        tank_capacity=vehicle_data.get("tank_capacity"),
        standard_fuel_consumption=vehicle_data.get("standard_fuel_consumption"),
        driver_id=vehicle_data.get("driver_id"),
        created_at=datetime.now()
    )
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle

def create_driver(db: Session, driver_data: Dict[str, Any]):
    db_driver = Driver(
        name=driver_data["name"],
        phone=driver_data.get("phone"),
        id_card=driver_data.get("id_card"),
        created_at=datetime.now()
    )
    db.add(db_driver)
    db.commit()
    db.refresh(db_driver)
    return db_driver

def create_fuel_record(db: Session, fuel_data: Dict[str, Any]):
    db_fuel = FuelRecord(
        vehicle_id=fuel_data["vehicle_id"],
        card_number=fuel_data["card_number"],
        fuel_date=fuel_data["fuel_date"],
        fuel_amount=fuel_data["fuel_amount"],
        fuel_price=fuel_data.get("fuel_price"),
        total_cost=fuel_data.get("total_cost"),
        odometer=fuel_data.get("odometer"),
        station=fuel_data.get("station"),
        created_at=datetime.now()
    )
    db.add(db_fuel)
    db.commit()
    db.refresh(db_fuel)
    return db_fuel

def create_mileage_record(db: Session, mileage_data: Dict[str, Any]):
    db_mileage = MileageRecord(
        vehicle_id=mileage_data["vehicle_id"],
        gps_device_id=mileage_data.get("gps_device_id"),
        record_date=mileage_data["record_date"],
        start_mileage=mileage_data["start_mileage"],
        end_mileage=mileage_data["end_mileage"],
        distance=mileage_data["distance"],
        start_location=mileage_data.get("start_location"),
        end_location=mileage_data.get("end_location"),
        created_at=datetime.now()
    )
    db.add(db_mileage)
    db.commit()
    db.refresh(db_mileage)
    return db_mileage

def create_route(db: Session, route_data: Dict[str, Any]):
    db_route = Route(
        vehicle_id=route_data["vehicle_id"],
        route_name=route_data["route_name"],
        start_date=route_data["start_date"],
        end_date=route_data["end_date"],
        start_location=route_data.get("start_location"),
        end_location=route_data.get("end_location"),
        total_distance=route_data.get("total_distance"),
        total_fuel=route_data.get("total_fuel"),
        created_at=datetime.now()
    )
    db.add(db_route)
    db.commit()
    db.refresh(db_route)
    return db_route

def create_abnormal_report(db: Session, report_data: Dict[str, Any]):
    db_report = AbnormalReport(
        vehicle_id=report_data["vehicle_id"],
        route_id=report_data.get("route_id"),
        abnormal_type=report_data["abnormal_type"],
        abnormal_level=report_data["abnormal_level"],
        status=report_data.get("status", "待处理"),
        start_date=report_data["start_date"],
        end_date=report_data["end_date"],
        actual_fuel_consumption=report_data.get("actual_fuel_consumption"),
        expected_fuel_consumption=report_data.get("expected_fuel_consumption"),
        deviation_rate=report_data.get("deviation_rate"),
        description=report_data.get("description"),
        created_at=datetime.now()
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report

def get_vehicle_fuel_records(db: Session, vehicle_id: int, start_date: datetime = None, end_date: datetime = None):
    query = db.query(FuelRecord).filter(FuelRecord.vehicle_id == vehicle_id)
    if start_date and end_date:
        query = query.filter(between(FuelRecord.fuel_date, start_date, end_date))
    return query.order_by(FuelRecord.fuel_date).all()

def get_vehicle_mileage_records(db: Session, vehicle_id: int, start_date: datetime = None, end_date: datetime = None):
    query = db.query(MileageRecord).filter(MileageRecord.vehicle_id == vehicle_id)
    if start_date and end_date:
        query = query.filter(between(MileageRecord.record_date, start_date, end_date))
    return query.order_by(MileageRecord.record_date).all()

def get_all_vehicles(db: Session):
    return db.query(Vehicle).all()

def get_abnormal_reports(db: Session, status: str = None, level: str = None, vehicle_id: int = None):
    query = db.query(AbnormalReport)
    if status:
        query = query.filter(AbnormalReport.status == status)
    if level:
        query = query.filter(AbnormalReport.abnormal_level == level)
    if vehicle_id:
        query = query.filter(AbnormalReport.vehicle_id == vehicle_id)
    return query.order_by(AbnormalReport.created_at.desc()).all()

def get_abnormal_report_by_id(db: Session, report_id: int):
    return db.query(AbnormalReport).filter(AbnormalReport.id == report_id).first()

def update_abnormal_report_status(db: Session, report_id: int, status: str, handler: str = None, comment: str = None):
    report = db.query(AbnormalReport).filter(AbnormalReport.id == report_id).first()
    if report:
        report.status = status
        if handler:
            report.handler = handler
        if comment:
            report.handle_comment = comment
        report.handled_at = datetime.now()
        db.commit()
        db.refresh(report)
    return report

def get_vehicle_total_fuel(db: Session, vehicle_id: int, start_date: datetime, end_date: datetime):
    result = db.query(func.sum(FuelRecord.fuel_amount))\
        .filter(and_(
            FuelRecord.vehicle_id == vehicle_id,
            between(FuelRecord.fuel_date, start_date, end_date)
        )).scalar()
    return result or 0

def get_vehicle_total_mileage(db: Session, vehicle_id: int, start_date: datetime, end_date: datetime):
    result = db.query(func.sum(MileageRecord.distance))\
        .filter(and_(
            MileageRecord.vehicle_id == vehicle_id,
            between(MileageRecord.record_date, start_date, end_date)
        )).scalar()
    return result or 0

def bulk_import_fuel_records(db: Session, fuel_records: List[Dict[str, Any]]):
    for record in fuel_records:
        db_fuel = FuelRecord(**record, created_at=datetime.now())
        db.add(db_fuel)
    db.commit()
    return len(fuel_records)

def bulk_import_mileage_records(db: Session, mileage_records: List[Dict[str, Any]]):
    for record in mileage_records:
        db_mileage = MileageRecord(**record, created_at=datetime.now())
        db.add(db_mileage)
    db.commit()
    return len(mileage_records)
