from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.database import get_db

router = APIRouter(prefix="/api/master", tags=["基础数据管理"])


@router.post("/students/", response_model=schemas.Student, status_code=status.HTTP_201_CREATED)
def create_student(student: schemas.StudentCreate, db: Session = Depends(get_db)):
    existing = crud.get_student_by_no(db, student_no=student.student_no)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"学号 {student.student_no} 已存在"
        )
    return crud.create_student(db=db, student=student)


@router.get("/students/", response_model=List[schemas.Student])
def read_students(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    students = crud.get_students(db, skip=skip, limit=limit)
    return students


@router.get("/students/{student_id}", response_model=schemas.Student)
def read_student(student_id: int, db: Session = Depends(get_db)):
    student = crud.get_student(db, student_id=student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    return student


@router.put("/students/{student_id}", response_model=schemas.Student)
def update_student(
    student_id: int,
    student: schemas.StudentUpdate,
    db: Session = Depends(get_db)
):
    db_student = crud.update_student(db, student_id=student_id, student=student)
    if db_student is None:
        raise HTTPException(status_code=404, detail="学生不存在")
    return db_student


@router.post("/stops/", response_model=schemas.Stop, status_code=status.HTTP_201_CREATED)
def create_stop(stop: schemas.StopCreate, db: Session = Depends(get_db)):
    existing = crud.get_stop_by_code(db, stop_code=stop.stop_code)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"站点编号 {stop.stop_code} 已存在"
        )
    return crud.create_stop(db=db, stop=stop)


@router.get("/stops/", response_model=List[schemas.Stop])
def read_stops(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    stops = crud.get_stops(db, skip=skip, limit=limit)
    return stops


@router.get("/stops/{stop_id}", response_model=schemas.Stop)
def read_stop(stop_id: int, db: Session = Depends(get_db)):
    stop = crud.get_stop(db, stop_id=stop_id)
    if stop is None:
        raise HTTPException(status_code=404, detail="站点不存在")
    return stop


@router.post("/routes/", response_model=schemas.Route, status_code=status.HTTP_201_CREATED)
def create_route(route: schemas.RouteCreate, db: Session = Depends(get_db)):
    existing = crud.get_route_by_code(db, route_code=route.route_code)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"线路编号 {route.route_code} 已存在"
        )
    return crud.create_route(db=db, route=route)


@router.get("/routes/", response_model=List[schemas.Route])
def read_routes(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    routes = crud.get_routes(db, skip=skip, limit=limit)
    return routes


@router.get("/routes/{route_id}", response_model=schemas.Route)
def read_route(route_id: int, db: Session = Depends(get_db)):
    route = crud.get_route(db, route_id=route_id)
    if route is None:
        raise HTTPException(status_code=404, detail="线路不存在")
    return route


@router.post("/vehicles/", response_model=schemas.Vehicle, status_code=status.HTTP_201_CREATED)
def create_vehicle(vehicle: schemas.VehicleCreate, db: Session = Depends(get_db)):
    existing = crud.get_vehicle_by_no(db, vehicle_no=vehicle.vehicle_no)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"车辆编号 {vehicle.vehicle_no} 已存在"
        )
    return crud.create_vehicle(db=db, vehicle=vehicle)


@router.get("/vehicles/", response_model=List[schemas.Vehicle])
def read_vehicles(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    vehicles = crud.get_vehicles(db, skip=skip, limit=limit)
    return vehicles


@router.get("/vehicles/{vehicle_id}", response_model=schemas.Vehicle)
def read_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    vehicle = crud.get_vehicle(db, vehicle_id=vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="车辆不存在")
    return vehicle


@router.post("/drivers/", response_model=schemas.Driver, status_code=status.HTTP_201_CREATED)
def create_driver(driver: schemas.DriverCreate, db: Session = Depends(get_db)):
    existing = crud.get_driver_by_no(db, driver_no=driver.driver_no)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"司机工号 {driver.driver_no} 已存在"
        )
    return crud.create_driver(db=db, driver=driver)


@router.get("/drivers/", response_model=List[schemas.Driver])
def read_drivers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    drivers = crud.get_drivers(db, skip=skip, limit=limit)
    return drivers


@router.get("/drivers/{driver_id}", response_model=schemas.Driver)
def read_driver(driver_id: int, db: Session = Depends(get_db)):
    driver = crud.get_driver(db, driver_id=driver_id)
    if driver is None:
        raise HTTPException(status_code=404, detail="司机不存在")
    return driver


@router.post("/authorizations/", response_model=schemas.Authorization, status_code=status.HTTP_201_CREATED)
def create_authorization(auth: schemas.AuthorizationCreate, db: Session = Depends(get_db)):
    student = crud.get_student(db, student_id=auth.student_id)
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"学生 ID {auth.student_id} 不存在"
        )
    return crud.create_authorization(db=db, auth=auth)


@router.get("/authorizations/student/{student_id}", response_model=List[schemas.Authorization])
def read_authorizations_by_student(student_id: int, db: Session = Depends(get_db)):
    authorizations = crud.get_authorizations_by_student(db, student_id=student_id)
    return authorizations


@router.get("/authorizations/{auth_id}", response_model=schemas.Authorization)
def read_authorization(auth_id: int, db: Session = Depends(get_db)):
    auth = crud.get_authorization(db, auth_id=auth_id)
    if auth is None:
        raise HTTPException(status_code=404, detail="授权记录不存在")
    return auth
