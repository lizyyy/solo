from datetime import datetime
from typing import List, Optional, Type

from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.models import PlanStatus


def generate_plan_no() -> str:
    now = datetime.now()
    return f"PLAN-{now.strftime('%Y%m%d%H%M%S')}"


def get_student_by_no(db: Session, student_no: str) -> Optional[models.Student]:
    return db.query(models.Student).filter(models.Student.student_no == student_no).first()


def create_student(db: Session, student: schemas.StudentCreate) -> models.Student:
    db_student = models.Student(**student.model_dump())
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    return db_student


def get_student(db: Session, student_id: int) -> Optional[models.Student]:
    return db.query(models.Student).filter(models.Student.id == student_id).first()


def get_students(db: Session, skip: int = 0, limit: int = 100) -> List[models.Student]:
    return db.query(models.Student).offset(skip).limit(limit).all()


def update_student(
    db: Session, student_id: int, student: schemas.StudentUpdate
) -> Optional[models.Student]:
    db_student = get_student(db, student_id)
    if db_student:
        for key, value in student.model_dump(exclude_unset=True).items():
            setattr(db_student, key, value)
        db.commit()
        db.refresh(db_student)
    return db_student


def get_stop_by_code(db: Session, stop_code: str) -> Optional[models.Stop]:
    return db.query(models.Stop).filter(models.Stop.stop_code == stop_code).first()


def create_stop(db: Session, stop: schemas.StopCreate) -> models.Stop:
    db_stop = models.Stop(**stop.model_dump())
    db.add(db_stop)
    db.commit()
    db.refresh(db_stop)
    return db_stop


def get_stop(db: Session, stop_id: int) -> Optional[models.Stop]:
    return db.query(models.Stop).filter(models.Stop.id == stop_id).first()


def get_stops(db: Session, skip: int = 0, limit: int = 100) -> List[models.Stop]:
    return db.query(models.Stop).offset(skip).limit(limit).all()


def get_route_by_code(db: Session, route_code: str) -> Optional[models.Route]:
    return db.query(models.Route).filter(models.Route.route_code == route_code).first()


def create_route(db: Session, route: schemas.RouteCreate) -> models.Route:
    route_data = route.model_dump()
    route_stops_data = route_data.pop("route_stops", [])
    
    db_route = models.Route(**route_data)
    db.add(db_route)
    db.commit()
    db.refresh(db_route)
    
    for stop_data in route_stops_data:
        db_route_stop = models.RouteStop(
            route_id=db_route.id,
            **stop_data
        )
        db.add(db_route_stop)
    
    db.commit()
    db.refresh(db_route)
    return db_route


def get_route(db: Session, route_id: int) -> Optional[models.Route]:
    return db.query(models.Route).options(
        joinedload(models.Route.route_stops).joinedload(models.RouteStop.stop)
    ).filter(models.Route.id == route_id).first()


def get_routes(db: Session, skip: int = 0, limit: int = 100) -> List[models.Route]:
    return db.query(models.Route).offset(skip).limit(limit).all()


def get_vehicle_by_no(db: Session, vehicle_no: str) -> Optional[models.Vehicle]:
    return db.query(models.Vehicle).filter(models.Vehicle.vehicle_no == vehicle_no).first()


def create_vehicle(db: Session, vehicle: schemas.VehicleCreate) -> models.Vehicle:
    db_vehicle = models.Vehicle(**vehicle.model_dump())
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle


def get_vehicle(db: Session, vehicle_id: int) -> Optional[models.Vehicle]:
    return db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()


def get_vehicles(db: Session, skip: int = 0, limit: int = 100) -> List[models.Vehicle]:
    return db.query(models.Vehicle).offset(skip).limit(limit).all()


def get_driver_by_no(db: Session, driver_no: str) -> Optional[models.Driver]:
    return db.query(models.Driver).filter(models.Driver.driver_no == driver_no).first()


def create_driver(db: Session, driver: schemas.DriverCreate) -> models.Driver:
    db_driver = models.Driver(**driver.model_dump())
    db.add(db_driver)
    db.commit()
    db.refresh(db_driver)
    return db_driver


def get_driver(db: Session, driver_id: int) -> Optional[models.Driver]:
    return db.query(models.Driver).filter(models.Driver.id == driver_id).first()


def get_drivers(db: Session, skip: int = 0, limit: int = 100) -> List[models.Driver]:
    return db.query(models.Driver).offset(skip).limit(limit).all()


def create_authorization(db: Session, auth: schemas.AuthorizationCreate) -> models.Authorization:
    db_auth = models.Authorization(**auth.model_dump())
    db.add(db_auth)
    db.commit()
    db.refresh(db_auth)
    return db_auth


def get_authorization(db: Session, auth_id: int) -> Optional[models.Authorization]:
    return db.query(models.Authorization).filter(models.Authorization.id == auth_id).first()


def get_authorizations_by_student(
    db: Session, student_id: int
) -> List[models.Authorization]:
    return db.query(models.Authorization).filter(
        models.Authorization.student_id == student_id
    ).all()


def create_route_change_plan(
    db: Session, plan: schemas.RouteChangePlanCreate
) -> models.RouteChangePlan:
    plan_data = plan.model_dump()
    vehicle_assignments_data = plan_data.pop("vehicle_assignments", [])
    
    db_plan = models.RouteChangePlan(
        **plan_data,
        plan_no=generate_plan_no(),
        status=PlanStatus.DRAFT,
    )
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    
    for va_data in vehicle_assignments_data:
        stop_assignments_data = va_data.pop("stop_assignments", [])
        student_assignments_data = va_data.pop("student_assignments", [])
        
        db_va = models.PlanVehicleAssignment(
            plan_id=db_plan.id,
            **va_data
        )
        db.add(db_va)
        db.commit()
        db.refresh(db_va)
        
        for sa_data in stop_assignments_data:
            db_sa = models.PlanStopAssignment(
                vehicle_assignment_id=db_va.id,
                **sa_data
            )
            db.add(db_sa)
        
        for ssa_data in student_assignments_data:
            db_ssa = models.PlanStudentAssignment(
                vehicle_assignment_id=db_va.id,
                **ssa_data
            )
            db.add(db_ssa)
    
    db.commit()
    db.refresh(db_plan)
    return db_plan


def get_route_change_plan(
    db: Session, plan_id: int
) -> Optional[models.RouteChangePlan]:
    return db.query(models.RouteChangePlan).options(
        joinedload(models.RouteChangePlan.vehicle_assignments).joinedload(
            models.PlanVehicleAssignment.stop_assignments
        ).joinedload(models.PlanStopAssignment.stop),
        joinedload(models.RouteChangePlan.vehicle_assignments).joinedload(
            models.PlanVehicleAssignment.student_assignments
        ).joinedload(models.PlanStudentAssignment.student),
        joinedload(models.RouteChangePlan.vehicle_assignments).joinedload(
            models.PlanVehicleAssignment.vehicle
        ),
        joinedload(models.RouteChangePlan.vehicle_assignments).joinedload(
            models.PlanVehicleAssignment.driver
        ),
    ).filter(models.RouteChangePlan.id == plan_id).first()


def get_route_change_plans(
    db: Session, skip: int = 0, limit: int = 100, status: Optional[str] = None
) -> List[models.RouteChangePlan]:
    query = db.query(models.RouteChangePlan)
    if status:
        query = query.filter(models.RouteChangePlan.status == status)
    return query.order_by(models.RouteChangePlan.created_at.desc()).offset(skip).limit(limit).all()


def update_plan_status(
    db: Session,
    plan_id: int,
    new_status: PlanStatus,
    actor: Optional[str] = None,
) -> Optional[models.RouteChangePlan]:
    db_plan = get_route_change_plan(db, plan_id)
    if not db_plan:
        return None
    
    db_plan.status = new_status
    now = datetime.utcnow()
    
    if new_status == PlanStatus.SUBMITTED:
        db_plan.submitted_at = now
        if actor:
            db_plan.submitted_by = actor
    elif new_status == PlanStatus.APPROVED:
        db_plan.approved_at = now
        if actor:
            db_plan.approved_by = actor
    elif new_status == PlanStatus.PUBLISHED:
        db_plan.published_at = now
        if actor:
            db_plan.published_by = actor
    elif new_status == PlanStatus.WITHDRAWN:
        db_plan.withdrawn_at = now
        if actor:
            db_plan.withdrawn_by = actor
    
    db.commit()
    db.refresh(db_plan)
    return db_plan


def create_audit_log(
    db: Session,
    action: str,
    actor: str,
    plan_id: Optional[int] = None,
    details: Optional[str] = None,
) -> models.AuditLog:
    db_log = models.AuditLog(
        plan_id=plan_id,
        action=action,
        actor=actor,
        details=details,
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log


def get_audit_logs(
    db: Session,
    plan_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[models.AuditLog]:
    query = db.query(models.AuditLog)
    if plan_id:
        query = query.filter(models.AuditLog.plan_id == plan_id)
    return query.order_by(models.AuditLog.created_at.desc()).offset(skip).limit(limit).all()


def get_plan_risk_reports(
    db: Session, plan_id: int
) -> List[models.RiskReport]:
    return db.query(models.RiskReport).filter(
        models.RiskReport.plan_id == plan_id
    ).all()


def clear_plan_risk_reports(db: Session, plan_id: int) -> None:
    db.query(models.RiskReport).filter(
        models.RiskReport.plan_id == plan_id
    ).delete()
    db.commit()


def save_risk_reports(
    db: Session, plan_id: int, risks: List[models.RiskReport]
) -> None:
    clear_plan_risk_reports(db, plan_id)
    for risk in risks:
        risk.plan_id = plan_id
        db.add(risk)
    db.commit()
