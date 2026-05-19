from typing import Optional
from datetime import date
from fastapi import APIRouter, HTTPException

from app.schemas.schedule import (
    ScheduleCreate, ScheduleBatchCreate, ScheduleResponse,
    TaskCreate, TaskBatchCreate, TaskResponse,
    LockResource, UnlockResource, LockResponse,
    ExceptionCreate, ExceptionResolve, ExceptionResponse,
    DailyReportRequest, DailyReportResponse,
    ForkliftResponse, ChargingStationResponse, DriverResponse
)
from app.schemas.common import APIResponse, BatchResult
from app.services.schedule_service import (
    schedule_service, lock_service, exception_service, report_service
)
from app.services.resource_service import resource_service
from app.core.security import mask_sensitive_data

router = APIRouter()


@router.get("/forklifts", response_model=APIResponse[list[ForkliftResponse]])
def list_forklifts(status: Optional[str] = None):
    forklifts = resource_service.get_forklifts(status)
    return APIResponse(data=forklifts)


@router.get("/forklifts/{forklift_id}", response_model=APIResponse[ForkliftResponse])
def get_forklift(forklift_id: str):
    forklift = resource_service.get_forklift(forklift_id)
    if not forklift:
        raise HTTPException(status_code=404, detail="叉车不存在")
    return APIResponse(data=forklift)


@router.patch("/forklifts/{forklift_id}/battery", response_model=APIResponse[ForkliftResponse])
def update_battery(forklift_id: str, battery_level: float):
    try:
        forklift = resource_service.update_forklift_battery(forklift_id, battery_level)
        return APIResponse(data=forklift)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/charging-stations", response_model=APIResponse[list[ChargingStationResponse]])
def list_charging_stations(status: Optional[str] = None):
    stations = resource_service.get_charging_stations(status)
    return APIResponse(data=stations)


@router.get("/charging-stations/{station_id}", response_model=APIResponse[ChargingStationResponse])
def get_charging_station(station_id: str):
    station = resource_service.get_charging_station(station_id)
    if not station:
        raise HTTPException(status_code=404, detail="充电桩不存在")
    return APIResponse(data=station)


@router.post("/charging-stations/{station_id}/start-charging", response_model=APIResponse[ChargingStationResponse])
def start_charging(station_id: str, forklift_id: str):
    try:
        station = resource_service.start_charging(station_id, forklift_id)
        return APIResponse(data=station)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/charging-stations/{station_id}/stop-charging", response_model=APIResponse[ForkliftResponse])
def stop_charging(station_id: str):
    try:
        forklift = resource_service.stop_charging(station_id)
        return APIResponse(data=forklift)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/drivers", response_model=APIResponse[list[DriverResponse]])
def list_drivers(status: Optional[str] = None):
    drivers = resource_service.get_drivers(status)
    masked_drivers = [mask_sensitive_data(d) for d in drivers]
    return APIResponse(data=masked_drivers)


@router.get("/drivers/{driver_id}", response_model=APIResponse[DriverResponse])
def get_driver(driver_id: str):
    driver = resource_service.get_driver(driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="司机不存在")
    return APIResponse(data=mask_sensitive_data(driver))


@router.post("/tasks", response_model=APIResponse[TaskResponse])
def create_task(task_data: TaskCreate):
    task = schedule_service.create_task(task_data)
    return APIResponse(data=task)


@router.post("/tasks/batch", response_model=APIResponse[BatchResult])
def batch_create_tasks(batch_data: TaskBatchCreate):
    result = schedule_service.batch_create_tasks(batch_data)
    return APIResponse(data=result)


@router.get("/tasks", response_model=APIResponse[list[TaskResponse]])
def list_tasks(status: Optional[str] = None):
    tasks = schedule_service.get_tasks(status)
    return APIResponse(data=tasks)


@router.post("/schedules", response_model=APIResponse[ScheduleResponse])
def create_schedule(schedule_data: ScheduleCreate):
    try:
        schedule = schedule_service.create_schedule(schedule_data)
        return APIResponse(data=schedule)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/schedules/batch", response_model=APIResponse[BatchResult])
def batch_create_schedules(batch_data: ScheduleBatchCreate):
    result = schedule_service.batch_create_schedules(batch_data)
    return APIResponse(data=result)


@router.get("/schedules", response_model=APIResponse[list[ScheduleResponse]])
def list_schedules(schedule_date: Optional[date] = None, shift: Optional[str] = None):
    schedules = schedule_service.get_schedules(schedule_date, shift)
    return APIResponse(data=schedules)


@router.post("/locks", response_model=APIResponse[LockResponse])
def lock_resource(lock_data: LockResource):
    try:
        lock = lock_service.lock_resource(lock_data)
        return APIResponse(data=lock)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/locks/unlock", response_model=APIResponse[bool])
def unlock_resource(unlock_data: UnlockResource):
    success = lock_service.unlock_resource(unlock_data)
    return APIResponse(data=success, message="解锁成功" if success else "解锁失败，未找到活动锁定")


@router.get("/locks", response_model=APIResponse[list[LockResponse]])
def list_active_locks():
    locks = lock_service.get_active_locks()
    return APIResponse(data=locks)


@router.post("/exceptions", response_model=APIResponse[ExceptionResponse])
def create_exception(exception_data: ExceptionCreate):
    exception = exception_service.create_exception(exception_data)
    return APIResponse(data=exception)


@router.post("/exceptions/{exception_id}/resolve", response_model=APIResponse[ExceptionResponse])
def resolve_exception(exception_id: str, resolve_data: ExceptionResolve):
    try:
        exception = exception_service.resolve_exception(exception_id, resolve_data)
        return APIResponse(data=exception)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/exceptions", response_model=APIResponse[list[ExceptionResponse]])
def list_exceptions(status: Optional[str] = None):
    exceptions = exception_service.get_exceptions(status)
    return APIResponse(data=exceptions)


@router.post("/reports/daily", response_model=APIResponse[DailyReportResponse])
def generate_daily_report(report_data: DailyReportRequest):
    report = report_service.generate_daily_report(report_data)
    return APIResponse(data=report)


@router.get("/reports", response_model=APIResponse[list[DailyReportResponse]])
def list_reports(start_date: Optional[date] = None, end_date: Optional[date] = None):
    reports = report_service.get_reports(start_date, end_date)
    return APIResponse(data=reports)
