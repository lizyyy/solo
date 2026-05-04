from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app import crud, models, schemas
from app.database import get_db

router = APIRouter(prefix="/api/import", tags=["批量导入"])


@router.post("/batch", response_model=schemas.ImportResult)
def batch_import(data: schemas.BatchImportData, db: Session = Depends(get_db)):
    errors = []
    total_imported = 0
    
    for student in data.students:
        try:
            existing = crud.get_student_by_no(db, student_no=student.student_no)
            if existing:
                errors.append(f"学生 {student.student_no} ({student.name}) 已存在，跳过")
                continue
            crud.create_student(db=db, student=student)
            total_imported += 1
        except Exception as e:
            errors.append(f"导入学生 {student.student_no} 失败: {str(e)}")
    
    for stop in data.stops:
        try:
            existing = crud.get_stop_by_code(db, stop_code=stop.stop_code)
            if existing:
                errors.append(f"站点 {stop.stop_code} ({stop.name}) 已存在，跳过")
                continue
            crud.create_stop(db=db, stop=stop)
            total_imported += 1
        except Exception as e:
            errors.append(f"导入站点 {stop.stop_code} 失败: {str(e)}")
    
    for route in data.routes:
        try:
            existing = crud.get_route_by_code(db, route_code=route.route_code)
            if existing:
                errors.append(f"线路 {route.route_code} ({route.name}) 已存在，跳过")
                continue
            crud.create_route(db=db, route=route)
            total_imported += 1
        except Exception as e:
            errors.append(f"导入线路 {route.route_code} 失败: {str(e)}")
    
    for vehicle in data.vehicles:
        try:
            existing = crud.get_vehicle_by_no(db, vehicle_no=vehicle.vehicle_no)
            if existing:
                errors.append(f"车辆 {vehicle.vehicle_no} ({vehicle.plate_number}) 已存在，跳过")
                continue
            crud.create_vehicle(db=db, vehicle=vehicle)
            total_imported += 1
        except Exception as e:
            errors.append(f"导入车辆 {vehicle.vehicle_no} 失败: {str(e)}")
    
    for driver in data.drivers:
        try:
            existing = crud.get_driver_by_no(db, driver_no=driver.driver_no)
            if existing:
                errors.append(f"司机 {driver.driver_no} ({driver.name}) 已存在，跳过")
                continue
            crud.create_driver(db=db, driver=driver)
            total_imported += 1
        except Exception as e:
            errors.append(f"导入司机 {driver.driver_no} 失败: {str(e)}")
    
    for auth in data.authorizations:
        try:
            student = crud.get_student(db, student_id=auth.student_id)
            if not student:
                errors.append(f"授权记录引用的学生 ID {auth.student_id} 不存在，跳过")
                continue
            crud.create_authorization(db=db, auth=auth)
            total_imported += 1
        except Exception as e:
            errors.append(f"导入授权记录失败: {str(e)}")
    
    db.commit()
    
    success = len(errors) == 0 or (total_imported > 0 and not any("严重" in e for e in errors))
    
    message = f"批量导入完成。成功导入 {total_imported} 条记录"
    if errors:
        message += f"，{len(errors)} 条记录因错误被跳过"
    
    return schemas.ImportResult(
        success=success,
        imported_count=total_imported,
        errors=errors,
        message=message,
    )


@router.post("/students", response_model=schemas.ImportResult)
def import_students(students: List[schemas.StudentCreate], db: Session = Depends(get_db)):
    errors = []
    total_imported = 0
    
    for student in students:
        try:
            existing = crud.get_student_by_no(db, student_no=student.student_no)
            if existing:
                errors.append(f"学生 {student.student_no} ({student.name}) 已存在，跳过")
                continue
            crud.create_student(db=db, student=student)
            total_imported += 1
        except Exception as e:
            errors.append(f"导入学生 {student.student_no} 失败: {str(e)}")
    
    db.commit()
    
    return schemas.ImportResult(
        success=len(errors) == 0 or total_imported > 0,
        imported_count=total_imported,
        errors=errors,
        message=f"导入学生完成: 成功 {total_imported} 条, 跳过 {len(errors)} 条",
    )


@router.post("/stops", response_model=schemas.ImportResult)
def import_stops(stops: List[schemas.StopCreate], db: Session = Depends(get_db)):
    errors = []
    total_imported = 0
    
    for stop in stops:
        try:
            existing = crud.get_stop_by_code(db, stop_code=stop.stop_code)
            if existing:
                errors.append(f"站点 {stop.stop_code} ({stop.name}) 已存在，跳过")
                continue
            crud.create_stop(db=db, stop=stop)
            total_imported += 1
        except Exception as e:
            errors.append(f"导入站点 {stop.stop_code} 失败: {str(e)}")
    
    db.commit()
    
    return schemas.ImportResult(
        success=len(errors) == 0 or total_imported > 0,
        imported_count=total_imported,
        errors=errors,
        message=f"导入站点完成: 成功 {total_imported} 条, 跳过 {len(errors)} 条",
    )


@router.post("/vehicles", response_model=schemas.ImportResult)
def import_vehicles(vehicles: List[schemas.VehicleCreate], db: Session = Depends(get_db)):
    errors = []
    total_imported = 0
    
    for vehicle in vehicles:
        try:
            existing = crud.get_vehicle_by_no(db, vehicle_no=vehicle.vehicle_no)
            if existing:
                errors.append(f"车辆 {vehicle.vehicle_no} ({vehicle.plate_number}) 已存在，跳过")
                continue
            crud.create_vehicle(db=db, vehicle=vehicle)
            total_imported += 1
        except Exception as e:
            errors.append(f"导入车辆 {vehicle.vehicle_no} 失败: {str(e)}")
    
    db.commit()
    
    return schemas.ImportResult(
        success=len(errors) == 0 or total_imported > 0,
        imported_count=total_imported,
        errors=errors,
        message=f"导入车辆完成: 成功 {total_imported} 条, 跳过 {len(errors)} 条",
    )


@router.post("/drivers", response_model=schemas.ImportResult)
def import_drivers(drivers: List[schemas.DriverCreate], db: Session = Depends(get_db)):
    errors = []
    total_imported = 0
    
    for driver in drivers:
        try:
            existing = crud.get_driver_by_no(db, driver_no=driver.driver_no)
            if existing:
                errors.append(f"司机 {driver.driver_no} ({driver.name}) 已存在，跳过")
                continue
            crud.create_driver(db=db, driver=driver)
            total_imported += 1
        except Exception as e:
            errors.append(f"导入司机 {driver.driver_no} 失败: {str(e)}")
    
    db.commit()
    
    return schemas.ImportResult(
        success=len(errors) == 0 or total_imported > 0,
        imported_count=total_imported,
        errors=errors,
        message=f"导入司机完成: 成功 {total_imported} 条, 跳过 {len(errors)} 条",
    )
