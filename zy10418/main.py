from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import create_engine, Column, Integer, String, JSON, DateTime, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from typing import List, Optional, Dict, Any
import json
from enum import Enum


DATABASE_URL = "sqlite:///./journey_registry.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class JourneyStatus(str, Enum):
    DRAFT = "draft"
    VALIDATING = "validating"
    VALID = "valid"
    INVALID = "invalid"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    ARCHIVED = "archived"


class StepValidationStatus(str, Enum):
    PENDING = "pending"
    VALID = "valid"
    INVALID = "invalid"
    MANUAL_FIXED = "manual_fixed"


class JourneyDB(Base):
    __tablename__ = "journeys"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text)
    steps = Column(JSON, nullable=False)
    dependent_services = Column(JSON)
    run_frequency = Column(String, nullable=False)
    status = Column(String, default=JourneyStatus.DRAFT)
    step_validation_status = Column(JSON)
    dependency_map = Column(JSON)
    frequency_conflicts = Column(JSON)
    failure_samples = Column(JSON, default=list)
    registration_report = Column(JSON)
    raw_input = Column(JSON)
    error_message = Column(Text)
    manual_corrections = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)


class Step(BaseModel):
    step_id: str
    name: str
    action: str
    params: Optional[Dict[str, Any]] = None
    expected_result: Optional[str] = None
    timeout: Optional[int] = 30


class DependentService(BaseModel):
    service_name: str
    service_type: str
    endpoint: Optional[str] = None
    health_check: Optional[str] = None


class FailureSample(BaseModel):
    timestamp: datetime
    error_type: str
    error_message: str
    context: Optional[Dict[str, Any]] = None
    step_id: Optional[str] = None


class JourneyBase(BaseModel):
    name: str
    description: Optional[str] = None
    steps: List[Step]
    dependent_services: Optional[List[DependentService]] = None
    run_frequency: str


class JourneyCreate(JourneyBase):
    pass


class JourneyUpdate(BaseModel):
    description: Optional[str] = None
    steps: Optional[List[Step]] = None
    dependent_services: Optional[List[DependentService]] = None
    run_frequency: Optional[str] = None


class ManualCorrection(BaseModel):
    correction_type: str
    field: str
    old_value: Any
    new_value: Any
    reason: str
    corrected_by: Optional[str] = None


class JourneyResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    steps: List[Dict[str, Any]]
    dependent_services: Optional[List[Dict[str, Any]]]
    run_frequency: str
    status: str
    step_validation_status: Optional[Dict[str, Any]]
    dependency_map: Optional[Dict[str, Any]]
    frequency_conflicts: Optional[List[Dict[str, Any]]]
    failure_samples: List[Dict[str, Any]]
    registration_report: Optional[Dict[str, Any]]
    raw_input: Optional[Dict[str, Any]]
    error_message: Optional[str]
    manual_corrections: List[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


Base.metadata.create_all(bind=engine)

app = FastAPI(title="合成旅程注册API", version="1.0.0")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def validate_steps(steps: List[Step]) -> Dict[str, Any]:
    validation_results = {
        "overall_status": StepValidationStatus.PENDING,
        "validated_count": 0,
        "invalid_count": 0,
        "details": {}
    }
    
    step_ids = set()
    for step in steps:
        step_id = step.step_id
        if step_id in step_ids:
            validation_results["details"][step_id] = {
                "status": StepValidationStatus.INVALID,
                "errors": [f"重复的步骤ID: {step_id}"]
            }
            validation_results["invalid_count"] += 1
        else:
            step_ids.add(step_id)
            errors = []
            if not step.name:
                errors.append("步骤名称不能为空")
            if not step.action:
                errors.append("步骤操作不能为空")
            
            if errors:
                validation_results["details"][step_id] = {
                    "status": StepValidationStatus.INVALID,
                    "errors": errors
                }
                validation_results["invalid_count"] += 1
            else:
                validation_results["details"][step_id] = {
                    "status": StepValidationStatus.VALID,
                    "errors": []
                }
                validation_results["validated_count"] += 1
    
    validation_results["overall_status"] = (
        StepValidationStatus.VALID if validation_results["invalid_count"] == 0 
        else StepValidationStatus.INVALID
    )
    
    return validation_results


def map_dependencies(dependent_services: Optional[List[DependentService]], steps: List[Step]) -> Dict[str, Any]:
    dep_map = {
        "service_to_steps": {},
        "step_to_services": {},
        "unmapped_services": [],
        "unmapped_steps": []
    }
    
    if dependent_services:
        for service in dependent_services:
            dep_map["service_to_steps"][service.service_name] = []
    
    for step in steps:
        dep_map["step_to_services"][step.step_id] = []
        
        if dependent_services:
            for service in dependent_services:
                service_name = service.service_name.lower()
                step_name = step.name.lower()
                step_action = step.action.lower()
                
                if service_name in step_name or service_name in step_action:
                    dep_map["service_to_steps"][service.service_name].append(step.step_id)
                    dep_map["step_to_services"][step.step_id].append(service.service_name)
    
    if dependent_services:
        for service in dependent_services:
            if not dep_map["service_to_steps"][service.service_name]:
                dep_map["unmapped_services"].append(service.service_name)
    
    for step in steps:
        if not dep_map["step_to_services"][step.step_id]:
            dep_map["unmapped_steps"].append(step.step_id)
    
    return dep_map


def detect_frequency_conflicts(db, new_frequency: str, journey_id: Optional[int] = None) -> List[Dict[str, Any]]:
    conflicts = []
    
    existing_journeys = db.query(JourneyDB).filter(
        JourneyDB.is_active == True,
        JourneyDB.run_frequency == new_frequency
    )
    
    if journey_id:
        existing_journeys = existing_journeys.filter(JourneyDB.id != journey_id)
    
    for journey in existing_journeys.all():
        conflicts.append({
            "journey_id": journey.id,
            "journey_name": journey.name,
            "conflict_type": "frequency_override",
            "message": f"旅程 '{journey.name}' 使用相同的运行频率 '{new_frequency}'"
        })
    
    return conflicts


def generate_registration_report(journey: JourneyDB, validation_results: Dict, dep_map: Dict, conflicts: List) -> Dict[str, Any]:
    report = {
        "registration_time": datetime.utcnow().isoformat(),
        "journey_name": journey.name,
        "validation_summary": {
            "total_steps": len(journey.steps) if journey.steps else 0,
            "valid_steps": validation_results.get("validated_count", 0),
            "invalid_steps": validation_results.get("invalid_count", 0),
            "status": validation_results.get("overall_status", "unknown")
        },
        "dependency_summary": {
            "total_services": len(dep_map.get("service_to_steps", {})),
            "mapped_services": len([s for s, steps in dep_map.get("service_to_steps", {}).items() if steps]),
            "unmapped_services": dep_map.get("unmapped_services", [])
        },
        "frequency_conflicts": len(conflicts),
        "conflict_details": conflicts,
        "recommendations": []
    }
    
    if validation_results.get("invalid_count", 0) > 0:
        report["recommendations"].append("请修正无效的步骤定义")
    
    if dep_map.get("unmapped_services"):
        report["recommendations"].append("存在未映射的依赖服务，建议检查步骤与服务的关联性")
    
    if conflicts:
        report["recommendations"].append("存在频率冲突，建议调整运行频率或合并旅程")
    
    return report


def journey_to_dict(journey: JourneyDB) -> Dict[str, Any]:
    return {
        "id": journey.id,
        "name": journey.name,
        "description": journey.description,
        "steps": journey.steps,
        "dependent_services": journey.dependent_services,
        "run_frequency": journey.run_frequency,
        "status": journey.status,
        "step_validation_status": journey.step_validation_status,
        "dependency_map": journey.dependency_map,
        "frequency_conflicts": journey.frequency_conflicts,
        "failure_samples": journey.failure_samples or [],
        "registration_report": journey.registration_report,
        "raw_input": journey.raw_input,
        "error_message": journey.error_message,
        "manual_corrections": journey.manual_corrections or [],
        "created_at": journey.created_at,
        "updated_at": journey.updated_at
    }


@app.post("/api/journeys", response_model=JourneyResponse)
async def create_journey(journey: JourneyCreate):
    db = next(get_db())
    raw_input = journey.model_dump()
    
    existing = db.query(JourneyDB).filter(JourneyDB.name == journey.name).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "message": f"旅程名称 '{journey.name}' 已存在",
                "existing_journey_id": existing.id,
                "raw_input": raw_input
            }
        )
    
    try:
        steps_data = [s.model_dump() for s in journey.steps]
        services_data = [s.model_dump() for s in (journey.dependent_services or [])] if journey.dependent_services else None
        
        validation_results = validate_steps(journey.steps)
        dep_map = map_dependencies(journey.dependent_services, journey.steps)
        conflicts = detect_frequency_conflicts(db, journey.run_frequency)
        
        status = JourneyStatus.VALID if validation_results["overall_status"] == StepValidationStatus.VALID else JourneyStatus.INVALID
        
        db_journey = JourneyDB(
            name=journey.name,
            description=journey.description,
            steps=steps_data,
            dependent_services=services_data,
            run_frequency=journey.run_frequency,
            status=status,
            step_validation_status=validation_results,
            dependency_map=dep_map,
            frequency_conflicts=conflicts,
            raw_input=raw_input,
            manual_corrections=[]
        )
        
        report = generate_registration_report(db_journey, validation_results, dep_map, conflicts)
        db_journey.registration_report = report
        
        db.add(db_journey)
        db.commit()
        db.refresh(db_journey)
        
        return journey_to_dict(db_journey)
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={
                "message": "创建旅程失败",
                "error": str(e),
                "raw_input": raw_input
            }
        )


@app.get("/api/journeys", response_model=List[JourneyResponse])
async def list_journeys(
    status: Optional[str] = None,
    frequency: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
):
    db = next(get_db())
    query = db.query(JourneyDB).filter(JourneyDB.is_active == True)
    
    if status:
        query = query.filter(JourneyDB.status == status)
    if frequency:
        query = query.filter(JourneyDB.run_frequency == frequency)
    
    journeys = query.offset(skip).limit(limit).all()
    return [journey_to_dict(j) for j in journeys]


@app.get("/api/journeys/{journey_id}", response_model=JourneyResponse)
async def get_journey(journey_id: int):
    db = next(get_db())
    journey = db.query(JourneyDB).filter(JourneyDB.id == journey_id, JourneyDB.is_active == True).first()
    if not journey:
        raise HTTPException(status_code=404, detail="旅程不存在")
    return journey_to_dict(journey)


@app.put("/api/journeys/{journey_id}/status", response_model=JourneyResponse)
async def update_journey_status(journey_id: int, new_status: str):
    db = next(get_db())
    journey = db.query(JourneyDB).filter(JourneyDB.id == journey_id, JourneyDB.is_active == True).first()
    if not journey:
        raise HTTPException(status_code=404, detail="旅程不存在")
    
    valid_statuses = [s.value for s in JourneyStatus]
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "无效的状态值",
                "valid_statuses": valid_statuses,
                "requested_status": new_status
            }
        )
    
    journey.status = new_status
    journey.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(journey)
    return journey_to_dict(journey)


@app.post("/api/journeys/{journey_id}/validate", response_model=JourneyResponse)
async def validate_journey(journey_id: int):
    db = next(get_db())
    journey = db.query(JourneyDB).filter(JourneyDB.id == journey_id, JourneyDB.is_active == True).first()
    if not journey:
        raise HTTPException(status_code=404, detail="旅程不存在")
    
    steps = [Step(**s) for s in journey.steps]
    services = [DependentService(**s) for s in (journey.dependent_services or [])] if journey.dependent_services else None
    
    validation_results = validate_steps(steps)
    dep_map = map_dependencies(services, steps)
    conflicts = detect_frequency_conflicts(db, journey.run_frequency, journey_id)
    
    journey.step_validation_status = validation_results
    journey.dependency_map = dep_map
    journey.frequency_conflicts = conflicts
    
    if validation_results["overall_status"] == StepValidationStatus.VALID:
        journey.status = JourneyStatus.VALID
    else:
        journey.status = JourneyStatus.INVALID
    
    report = generate_registration_report(journey, validation_results, dep_map, conflicts)
    journey.registration_report = report
    journey.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(journey)
    return journey_to_dict(journey)


@app.post("/api/journeys/{journey_id}/failure-sample")
async def add_failure_sample(journey_id: int, sample: FailureSample):
    db = next(get_db())
    journey = db.query(JourneyDB).filter(JourneyDB.id == journey_id, JourneyDB.is_active == True).first()
    if not journey:
        raise HTTPException(status_code=404, detail="旅程不存在")
    
    samples = journey.failure_samples or []
    sample_dict = sample.model_dump()
    sample_dict["timestamp"] = sample_dict["timestamp"].isoformat()
    samples.append(sample_dict)
    
    max_samples = 50
    if len(samples) > max_samples:
        samples = samples[-max_samples:]
    
    journey.failure_samples = samples
    journey.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(journey)
    
    return {"message": "失败样本已归档", "sample_count": len(samples)}


@app.post("/api/journeys/{journey_id}/manual-correction")
async def apply_manual_correction(journey_id: int, correction: ManualCorrection):
    db = next(get_db())
    journey = db.query(JourneyDB).filter(JourneyDB.id == journey_id, JourneyDB.is_active == True).first()
    if not journey:
        raise HTTPException(status_code=404, detail="旅程不存在")
    
    corrections = journey.manual_corrections or []
    correction_dict = correction.model_dump()
    correction_dict["applied_at"] = datetime.utcnow().isoformat()
    corrections.append(correction_dict)
    journey.manual_corrections = corrections
    
    update_successful = False
    try:
        if correction.field == "steps":
            journey.steps = correction.new_value
            update_successful = True
        elif correction.field == "dependent_services":
            journey.dependent_services = correction.new_value
            update_successful = True
        elif correction.field == "run_frequency":
            journey.run_frequency = correction.new_value
            update_successful = True
        elif correction.field == "description":
            journey.description = correction.new_value
            update_successful = True
        
        if update_successful:
            steps = [Step(**s) for s in journey.steps]
            services = [DependentService(**s) for s in (journey.dependent_services or [])] if journey.dependent_services else None
            
            validation_results = validate_steps(steps)
            dep_map = map_dependencies(services, steps)
            conflicts = detect_frequency_conflicts(db, journey.run_frequency, journey_id)
            
            journey.step_validation_status = validation_results
            journey.dependency_map = dep_map
            journey.frequency_conflicts = conflicts
            
            if validation_results["overall_status"] == StepValidationStatus.VALID:
                journey.status = JourneyStatus.VALID
            else:
                journey.status = JourneyStatus.INVALID
            
            report = generate_registration_report(journey, validation_results, dep_map, conflicts)
            journey.registration_report = report
            
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "应用人工修正失败",
                "error": str(e),
                "correction": correction_dict
            }
        )
    
    journey.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(journey)
    
    return journey_to_dict(journey)


@app.get("/api/journeys/{journey_id}/export")
async def export_journey(journey_id: int, format: str = Query("json", enum=["json", "dict"])):
    db = next(get_db())
    journey = db.query(JourneyDB).filter(JourneyDB.id == journey_id, JourneyDB.is_active == True).first()
    if not journey:
        raise HTTPException(status_code=404, detail="旅程不存在")
    
    export_data = {
        "journey": journey_to_dict(journey),
        "export_metadata": {
            "export_time": datetime.utcnow().isoformat(),
            "export_format": format,
            "version": "1.0.0"
        }
    }
    
    if format == "json":
        return JSONResponse(content=json.loads(json.dumps(export_data, default=str)))
    return export_data


@app.delete("/api/journeys/{journey_id}")
async def delete_journey(journey_id: int):
    db = next(get_db())
    journey = db.query(JourneyDB).filter(JourneyDB.id == journey_id).first()
    if not journey:
        raise HTTPException(status_code=404, detail="旅程不存在")
    
    journey.is_active = False
    journey.status = JourneyStatus.ARCHIVED
    journey.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "旅程已归档", "journey_id": journey_id}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
