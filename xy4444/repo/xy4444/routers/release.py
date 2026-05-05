from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import json

from database import get_db
from models.release import FlightRelease
from models.flight import FlightPlan
from models.deice import DeiceFluidRecord
from models.weather import WeatherData
from models.gate import GateOperationLog
from models.audit import AuditLog
from pydantic import BaseModel

from services.hold_time import HoldTimeCalculator
from services.concentration import ConcentrationChecker
from services.second_deice import SecondDeiceChecker
from services.gate_conflict import GateConflictDetector

router = APIRouter(prefix="/api/release", tags=["航班放行计算"])


class ReviewRequest(BaseModel):
    review_comments: str
    reviewed_by: str


class OverrideRequest(BaseModel):
    override_decision: str
    override_reason: str
    overridden_by: str


@router.post("/calculate/{flight_number}", response_model=dict)
def calculate_flight_release(
    flight_number: str,
    db: Session = Depends(get_db)
):
    flight = db.query(FlightPlan).filter(
        FlightPlan.flight_number == flight_number
    ).first()
    if not flight:
        raise HTTPException(
            status_code=404,
            detail=f"航班 {flight_number} 不存在"
        )
    
    deice_records = db.query(DeiceFluidRecord).filter(
        DeiceFluidRecord.flight_number == flight_number
    ).order_by(DeiceFluidRecord.application_start_time.asc()).all()
    
    latest_weather = db.query(WeatherData).order_by(
        WeatherData.observation_time.desc()
    ).first()
    
    gate_logs = db.query(GateOperationLog).filter(
        GateOperationLog.flight_number == flight_number
    ).order_by(GateOperationLog.arrival_time.asc()).all()
    
    existing_release = db.query(FlightRelease).filter(
        FlightRelease.flight_number == flight_number
    ).first()
    
    hold_time_result = None
    concentration_result = None
    second_deice_result = None
    gate_conflict_result = None
    
    if deice_records and latest_weather:
        latest_deice = deice_records[-1]
        
        concentration_result = ConcentrationChecker.check_concentration(
            measured_concentration=latest_deice.measured_concentration,
            target_concentration=latest_deice.target_concentration,
            temperature=latest_weather.temperature
        )
        
        hold_time_result = HoldTimeCalculator.calculate_hold_time(
            concentration=latest_deice.measured_concentration,
            temperature=latest_weather.temperature or 0,
            precipitation_type=latest_weather.precipitation_type,
            precipitation_intensity=latest_weather.precipitation_intensity,
            wind_speed=latest_weather.wind_speed,
            deice_type=latest_deice.fluid_type or "Type I"
        )
        
        first_deice_time = deice_records[0].application_end_time or deice_records[0].application_start_time
        if first_deice_time:
            weather_dict = {
                "temperature": latest_weather.temperature,
                "wind_speed": latest_weather.wind_speed,
                "is_freezing_rain": latest_weather.is_freezing_rain,
                "is_snow": latest_weather.is_snow,
                "precipitation_intensity": latest_weather.precipitation_intensity
            }
            
            previous_rounds = len([d for d in deice_records if d.is_second_deicing > 0])
            
            second_deice_result = SecondDeiceChecker.check_second_deice(
                first_deice_time=first_deice_time,
                current_time=datetime.utcnow(),
                hold_time_minutes=hold_time_result.get("hold_time_minutes", 30),
                concentration_status=concentration_result.get("concentration_status", "warning"),
                weather_conditions=weather_dict,
                precipitation_occurred=False,
                previous_deice_rounds=previous_rounds
            )
    
    if flight.gate_number or flight.stand_number:
        all_flights = db.query(FlightPlan).filter(
            FlightPlan.id != flight.id
        ).all()
        
        current_flight_dict = {
            "gate_number": flight.gate_number,
            "stand_number": flight.stand_number,
            "arrival_time": None,
            "departure_time": flight.scheduled_departure,
            "deice_start_time": None,
            "deice_end_time": None
        }
        
        if gate_logs:
            latest_gate = gate_logs[-1]
            current_flight_dict["arrival_time"] = latest_gate.arrival_time
            current_flight_dict["departure_time"] = latest_gate.departure_time
            current_flight_dict["deice_start_time"] = latest_gate.deice_available_time
            current_flight_dict["deice_end_time"] = latest_gate.deice_completed_time
        
        other_flights_dicts = []
        for f in all_flights:
            if (f.gate_number and f.gate_number == flight.gate_number) or \
               (f.stand_number and f.stand_number == flight.stand_number):
                f_gate = db.query(GateOperationLog).filter(
                    GateOperationLog.flight_number == f.flight_number
                ).order_by(GateOperationLog.arrival_time.desc()).first()
                
                f_dict = {
                    "flight_number": f.flight_number,
                    "gate_number": f.gate_number,
                    "stand_number": f.stand_number,
                    "arrival_time": f_gate.arrival_time if f_gate else f.scheduled_departure,
                    "departure_time": f_gate.departure_time if f_gate else f.estimated_departure,
                    "deice_start_time": f_gate.deice_available_time if f_gate else None,
                    "deice_end_time": f_gate.deice_completed_time if f_gate else None
                }
                other_flights_dicts.append(f_dict)
        
        if other_flights_dicts:
            gate_conflict_result = GateConflictDetector.detect_conflict(
                current_flight=current_flight_dict,
                other_flights=other_flights_dicts
            )
    
    release_status = "pending"
    if hold_time_result or concentration_result or second_deice_result or gate_conflict_result:
        has_critical = False
        has_warning = False
        
        if hold_time_result and hold_time_result.get("hold_time_status") == "critical":
            has_critical = True
        elif hold_time_result and hold_time_result.get("hold_time_status") == "warning":
            has_warning = True
        
        if concentration_result and concentration_result.get("concentration_status") == "critical":
            has_critical = True
        elif concentration_result and concentration_result.get("concentration_status") == "warning":
            has_warning = True
        
        if second_deice_result and second_deice_result.get("is_second_deicing_required"):
            has_warning = True
        
        if gate_conflict_result and gate_conflict_result.get("gate_conflict_risk") == "high":
            has_critical = True
        elif gate_conflict_result and gate_conflict_result.get("gate_conflict_risk") == "medium":
            has_warning = True
        
        if has_critical:
            release_status = "needs_review"
        elif has_warning:
            release_status = "caution"
        else:
            release_status = "ready"
    
    if existing_release:
        if hold_time_result:
            existing_release.hold_time_minutes = hold_time_result.get("hold_time_minutes")
            existing_release.hold_time_expiry = hold_time_result.get("hold_time_expiry")
            existing_release.hold_time_status = hold_time_result.get("hold_time_status")
        
        if concentration_result:
            existing_release.concentration_deviation = concentration_result.get("concentration_deviation")
            existing_release.concentration_status = concentration_result.get("concentration_status")
            existing_release.target_concentration = concentration_result.get("target_concentration")
            existing_release.measured_concentration = concentration_result.get("measured_concentration")
        
        if second_deice_result:
            existing_release.is_second_deicing_required = second_deice_result.get("is_second_deicing_required")
            existing_release.second_deicing_reason = second_deice_result.get("second_deicing_reason")
            existing_release.deice_rounds = second_deice_result.get("deice_rounds")
        
        if gate_conflict_result:
            existing_release.gate_conflict_risk = gate_conflict_result.get("gate_conflict_risk")
            existing_release.gate_conflict_details = gate_conflict_result.get("gate_conflict_details")
            existing_release.overlapping_flights = gate_conflict_result.get("overlapping_flights")
        
        existing_release.release_status = release_status
        
        audit = AuditLog(
            action="RECALCULATE_RELEASE",
            entity_type="FlightRelease",
            flight_number=flight_number,
            details=f"重新计算航班放行状态"
        )
        db.add(audit)
        
        db.commit()
        db.refresh(existing_release)
        
        release = existing_release
        
    else:
        release = FlightRelease(
            flight_number=flight_number,
            hold_time_minutes=hold_time_result.get("hold_time_minutes") if hold_time_result else None,
            hold_time_expiry=hold_time_result.get("hold_time_expiry") if hold_time_result else None,
            hold_time_status=hold_time_result.get("hold_time_status") if hold_time_result else None,
            concentration_deviation=concentration_result.get("concentration_deviation") if concentration_result else None,
            concentration_status=concentration_result.get("concentration_status") if concentration_result else None,
            target_concentration=concentration_result.get("target_concentration") if concentration_result else None,
            measured_concentration=concentration_result.get("measured_concentration") if concentration_result else None,
            is_second_deicing_required=second_deice_result.get("is_second_deicing_required") if second_deice_result else False,
            second_deicing_reason=second_deice_result.get("second_deicing_reason") if second_deice_result else None,
            deice_rounds=second_deice_result.get("deice_rounds") if second_deice_result else 0,
            gate_conflict_risk=gate_conflict_result.get("gate_conflict_risk") if gate_conflict_result else "low",
            gate_conflict_details=gate_conflict_result.get("gate_conflict_details") if gate_conflict_result else None,
            overlapping_flights=gate_conflict_result.get("overlapping_flights") if gate_conflict_result else None,
            release_status=release_status
        )
        db.add(release)
        
        audit = AuditLog(
            action="CREATE_RELEASE",
            entity_type="FlightRelease",
            flight_number=flight_number,
            details=f"创建航班放行记录"
        )
        db.add(audit)
        
        db.commit()
        db.refresh(release)
    
    return {
        "message": "计算完成",
        "release": release.to_dict(),
        "calculations": {
            "hold_time": hold_time_result,
            "concentration": concentration_result,
            "second_deice": second_deice_result,
            "gate_conflict": gate_conflict_result
        }
    }


@router.get("/", response_model=dict)
def get_releases(
    skip: int = 0,
    limit: int = 100,
    flight_number: Optional[str] = None,
    release_status: Optional[str] = None,
    hold_time_status: Optional[str] = None,
    gate_conflict_risk: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(FlightRelease)
    
    if flight_number:
        query = query.filter(FlightRelease.flight_number.contains(flight_number))
    if release_status:
        query = query.filter(FlightRelease.release_status == release_status)
    if hold_time_status:
        query = query.filter(FlightRelease.hold_time_status == hold_time_status)
    if gate_conflict_risk:
        query = query.filter(FlightRelease.gate_conflict_risk == gate_conflict_risk)
    
    total = query.count()
    releases = query.order_by(FlightRelease.updated_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "releases": [r.to_dict() for r in releases]
    }


@router.get("/{flight_number}", response_model=dict)
def get_release(flight_number: str, db: Session = Depends(get_db)):
    release = db.query(FlightRelease).filter(
        FlightRelease.flight_number == flight_number
    ).first()
    
    if not release:
        raise HTTPException(status_code=404, detail=f"航班 {flight_number} 的放行记录不存在")
    
    return {"release": release.to_dict()}


@router.post("/review/{flight_number}", response_model=dict)
def submit_review(
    flight_number: str,
    review: ReviewRequest,
    db: Session = Depends(get_db)
):
    release = db.query(FlightRelease).filter(
        FlightRelease.flight_number == flight_number
    ).first()
    
    if not release:
        raise HTTPException(status_code=404, detail=f"航班 {flight_number} 的放行记录不存在")
    
    release.review_comments = review.review_comments
    release.reviewed_by = review.reviewed_by
    release.reviewed_at = datetime.utcnow()
    
    if release.release_status in ["needs_review", "caution"]:
        release.release_status = "reviewed"
    
    audit = AuditLog(
        action="SUBMIT_REVIEW",
        entity_type="FlightRelease",
        flight_number=flight_number,
        details=f"提交复核意见，复核人: {review.reviewed_by}"
    )
    db.add(audit)
    
    db.commit()
    db.refresh(release)
    
    return {"message": "复核意见已保存", "release": release.to_dict()}


@router.post("/override/{flight_number}", response_model=dict)
def submit_override(
    flight_number: str,
    override: OverrideRequest,
    db: Session = Depends(get_db)
):
    release = db.query(FlightRelease).filter(
        FlightRelease.flight_number == flight_number
    ).first()
    
    if not release:
        raise HTTPException(status_code=404, detail=f"航班 {flight_number} 的放行记录不存在")
    
    release.override_decision = override.override_decision
    release.override_reason = override.override_reason
    release.overridden_by = override.overridden_by
    release.overridden_at = datetime.utcnow()
    
    if override.override_decision == "release":
        release.release_status = "released"
    elif override.override_decision == "hold":
        release.release_status = "held"
    elif override.override_decision == "cancel":
        release.release_status = "cancelled"
    
    audit = AuditLog(
        action="SUBMIT_OVERRIDE",
        entity_type="FlightRelease",
        flight_number=flight_number,
        details=f"人工改判: {override.override_decision}，改判人: {override.overridden_by}"
    )
    db.add(audit)
    
    db.commit()
    db.refresh(release)
    
    return {"message": "改判已保存", "release": release.to_dict()}


@router.delete("/{flight_number}", response_model=dict)
def delete_release(flight_number: str, db: Session = Depends(get_db)):
    release = db.query(FlightRelease).filter(
        FlightRelease.flight_number == flight_number
    ).first()
    
    if not release:
        raise HTTPException(status_code=404, detail=f"航班 {flight_number} 的放行记录不存在")
    
    db.delete(release)
    
    audit = AuditLog(
        action="DELETE_RELEASE",
        entity_type="FlightRelease",
        flight_number=flight_number,
        details=f"删除航班放行记录"
    )
    db.add(audit)
    
    db.commit()
    
    return {"message": "删除成功"}
