from datetime import datetime, date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from app.database import get_db
from app.models import (
    Hospitalization, Cage, Pet, MedicalOrder,
    HospitalizationStatus, CageStatus, InfectionRisk, AnimalType
)
from app.schemas import DashboardStats

router = APIRouter()


@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_cages = db.query(Cage).count()
    
    available_cages = db.query(Cage).filter(
        Cage.status == CageStatus.AVAILABLE
    ).count()
    
    occupied_cages = db.query(Cage).filter(
        Cage.status == CageStatus.OCCUPIED
    ).count()
    
    maintenance_cages = db.query(Cage).filter(
        Cage.status == CageStatus.MAINTENANCE
    ).count()
    
    total_hospitalized = db.query(Hospitalization).filter(
        Hospitalization.status.in_([
            HospitalizationStatus.ADMITTED,
            HospitalizationStatus.IN_TREATMENT,
            HospitalizationStatus.TRANSFERRED
        ])
    ).count()
    
    high_risk_patients = db.query(Hospitalization).filter(
        Hospitalization.status.in_([
            HospitalizationStatus.ADMITTED,
            HospitalizationStatus.IN_TREATMENT,
            HospitalizationStatus.TRANSFERRED
        ]),
        Hospitalization.current_infection_risk.in_([
            InfectionRisk.HIGH,
            InfectionRisk.MEDIUM
        ])
    ).count()
    
    pending_transfers = db.query(Hospitalization).filter(
        Hospitalization.status == HospitalizationStatus.PENDING
    ).count()
    
    return DashboardStats(
        total_cages=total_cages,
        available_cages=available_cages,
        occupied_cages=occupied_cages,
        maintenance_cages=maintenance_cages,
        total_hospitalized=total_hospitalized,
        high_risk_patients=high_risk_patients,
        pending_transfers=pending_transfers
    )


@router.get("/daily")
def get_daily_report(
    report_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    if report_date:
        target_date = datetime.strptime(report_date, "%Y-%m-%d").date()
    else:
        target_date = date.today()
    
    start_of_day = datetime.combine(target_date, datetime.min.time())
    end_of_day = datetime.combine(target_date, datetime.max.time())
    
    total_admissions = db.query(Hospitalization).filter(
        Hospitalization.admission_date >= start_of_day,
        Hospitalization.admission_date <= end_of_day
    ).count()
    
    total_discharges = db.query(Hospitalization).filter(
        Hospitalization.discharge_date >= start_of_day,
        Hospitalization.discharge_date <= end_of_day
    ).count()
    
    total_cages = db.query(Cage).count()
    occupied_cages = db.query(Cage).filter(
        Cage.status == CageStatus.OCCUPIED
    ).count()
    
    current_occupancy = (occupied_cages / total_cages * 100) if total_cages > 0 else 0
    
    high_risk_count = db.query(Hospitalization).filter(
        Hospitalization.status.in_([
            HospitalizationStatus.ADMITTED,
            HospitalizationStatus.IN_TREATMENT,
            HospitalizationStatus.TRANSFERRED
        ]),
        Hospitalization.current_infection_risk.in_([
            InfectionRisk.HIGH,
            InfectionRisk.MEDIUM
        ])
    ).count()
    
    active_hospitalizations = db.query(Hospitalization).filter(
        Hospitalization.status.in_([
            HospitalizationStatus.ADMITTED,
            HospitalizationStatus.IN_TREATMENT,
            HospitalizationStatus.TRANSFERRED
        ])
    ).all()
    
    species_count = {}
    for hosp in active_hospitalizations:
        pet = db.query(Pet).filter(Pet.id == hosp.pet_id).first()
        if pet:
            species = pet.species.value
            species_count[species] = species_count.get(species, 0) + 1
    
    return {
        "date": target_date.isoformat(),
        "summary": {
            "total_admissions": total_admissions,
            "total_discharges": total_discharges,
            "current_occupancy_rate": round(current_occupancy, 2),
            "high_risk_patients": high_risk_count
        },
        "cage_usage_by_species": species_count
    }


@router.get("/cage-utilization")
def get_cage_utilization(db: Session = Depends(get_db)):
    cages = db.query(Cage).all()
    
    utilization_details = []
    for cage in cages:
        current_pet = None
        if cage.current_pet_id:
            pet = db.query(Pet).filter(Pet.id == cage.current_pet_id).first()
            if pet:
                hosp = db.query(Hospitalization).filter(
                    Hospitalization.pet_id == pet.id,
                    Hospitalization.cage_id == cage.id,
                    Hospitalization.status.in_([
                        HospitalizationStatus.ADMITTED,
                        HospitalizationStatus.IN_TREATMENT,
                        HospitalizationStatus.TRANSFERRED
                    ])
                ).first()
                
                current_pet = {
                    "id": pet.id,
                    "name": pet.name,
                    "species": pet.species.value,
                    "hospitalization_id": hosp.id if hosp else None,
                    "admission_date": hosp.admission_date.isoformat() if hosp and hosp.admission_date else None
                }
        
        utilization_details.append({
            "cage_id": cage.id,
            "cage_number": cage.cage_number,
            "location": cage.location,
            "status": cage.status,
            "is_isolation": cage.is_isolation,
            "max_infection_risk": cage.max_infection_risk,
            "current_pet": current_pet
        })
    
    return {
        "total_cages": len(cages),
        "utilization_details": utilization_details
    }


@router.get("/infection-risk-overview")
def get_infection_risk_overview(db: Session = Depends(get_db)):
    active_patients = db.query(Hospitalization).filter(
        Hospitalization.status.in_([
            HospitalizationStatus.ADMITTED,
            HospitalizationStatus.IN_TREATMENT,
            HospitalizationStatus.TRANSFERRED
        ])
    ).all()
    
    risk_distribution = {
        "none": 0,
        "low": 0,
        "medium": 0,
        "high": 0
    }
    
    isolation_usage = {
        "in_isolation": [],
        "should_be_in_isolation": []
    }
    
    for hosp in active_patients:
        risk = hosp.current_infection_risk.value
        risk_distribution[risk] += 1
        
        cage = db.query(Cage).filter(Cage.id == hosp.cage_id).first()
        pet = db.query(Pet).filter(Pet.id == hosp.pet_id).first()
        
        patient_info = {
            "hospitalization_id": hosp.id,
            "hospitalization_number": hosp.hospitalization_number,
            "pet_name": pet.name if pet else None,
            "pet_id": hosp.pet_id,
            "infection_risk": risk,
            "cage_number": cage.cage_number if cage else None,
            "cage_is_isolation": cage.is_isolation if cage else None
        }
        
        if cage and cage.is_isolation:
            isolation_usage["in_isolation"].append(patient_info)
        elif risk in ["high", "medium"]:
            isolation_usage["should_be_in_isolation"].append(patient_info)
    
    return {
        "total_active_patients": len(active_patients),
        "risk_distribution": risk_distribution,
        "isolation_usage": isolation_usage
    }


@router.get("/treatment-plans-summary")
def get_treatment_plans_summary(db: Session = Depends(get_db)):
    active_orders = db.query(MedicalOrder).filter(
        MedicalOrder.status == "in_progress"
    ).all()
    
    treatment_summary = []
    for order in active_orders:
        pet = db.query(Pet).filter(Pet.id == order.pet_id).first()
        hosp = db.query(Hospitalization).filter(
            Hospitalization.medical_order_id == order.id,
            Hospitalization.status.in_([
                HospitalizationStatus.ADMITTED,
                HospitalizationStatus.IN_TREATMENT,
                HospitalizationStatus.TRANSFERRED
            ])
        ).first()
        
        cage = None
        if hosp:
            cage = db.query(Cage).filter(Cage.id == hosp.cage_id).first()
        
        treatment_summary.append({
            "order_number": order.order_number,
            "pet_name": pet.name if pet else None,
            "pet_species": pet.species.value if pet else None,
            "diagnosis": order.diagnosis,
            "treatment_plan": order.treatment_plan,
            "infection_risk": order.infection_risk.value,
            "attending_vet": order.attending_vet,
            "estimated_stay_days": order.estimated_stay_days,
            "current_cage": cage.cage_number if cage else None,
            "isolation_required": cage.is_isolation if cage else None
        })
    
    return {
        "total_active_treatments": len(treatment_summary),
        "treatments": treatment_summary
    }
