from typing import List, Tuple, Dict, Optional
from datetime import datetime

from .models import (
    JobRecord, BillingRecord, RecordStatus, RateTable
)
from .database import (
    get_pending_job_records, get_rate_for_tractor,
    save_billing_record, update_job_record_status
)


def calculate_billing(job: JobRecord, rate: RateTable) -> Tuple[float, float, float, float]:
    hourly_charge = 0.0
    mu_charge = 0.0
    fuel_charge = 0.0
    
    if job.work_hours and rate.hourly_rate:
        hourly_charge = job.work_hours * rate.hourly_rate
    
    if job.work_mu and rate.mu_rate:
        mu_charge = job.work_mu * rate.mu_rate
    
    if job.fuel_used and rate.fuel_rate:
        fuel_charge = job.fuel_used * rate.fuel_rate
    
    total_charge = hourly_charge + mu_charge + fuel_charge
    return hourly_charge, mu_charge, fuel_charge, total_charge


def process_billing(batch_size: int = 100) -> Dict[str, int]:
    jobs = get_pending_job_records()
    processed = 0
    skipped = 0
    errors = 0
    
    for job in jobs[:batch_size]:
        rate = get_rate_for_tractor(job.tractor_id, job.job_date)
        
        if not rate:
            errors += 1
            continue
        
        hourly_charge, mu_charge, fuel_charge, total_charge = calculate_billing(job, rate)
        
        if total_charge <= 0:
            skipped += 1
            continue
        
        billing = BillingRecord(
            job_record_id=job.id,
            batch_id=job.batch_id,
            tractor_id=job.tractor_id,
            operator_id=job.operator_id,
            operator_name=job.operator_name,
            job_date=job.job_date,
            hourly_charge=round(hourly_charge, 2),
            mu_charge=round(mu_charge, 2),
            fuel_charge=round(fuel_charge, 2),
            total_charge=round(total_charge, 2),
            status=RecordStatus.BILLED
        )
        
        save_billing_record(billing)
        update_job_record_status(job.id, RecordStatus.BILLED)
        processed += 1
    
    return {
        "processed": processed,
        "skipped": skipped,
        "errors": errors,
        "total_pending": len(jobs)
    }


def billing_summary(records: List[BillingRecord]) -> Dict:
    if not records:
        return {}
    
    total_amount = sum(r.total_charge for r in records)
    total_hourly = sum(r.hourly_charge for r in records)
    total_mu = sum(r.mu_charge for r in records)
    total_fuel = sum(r.fuel_charge for r in records)
    
    by_tractor: Dict[str, float] = {}
    by_operator: Dict[str, float] = {}
    
    for r in records:
        by_tractor[r.tractor_id] = by_tractor.get(r.tractor_id, 0) + r.total_charge
        by_operator[r.operator_id] = by_operator.get(r.operator_id, 0) + r.total_charge
    
    return {
        "count": len(records),
        "total_amount": round(total_amount, 2),
        "total_hourly": round(total_hourly, 2),
        "total_mu": round(total_mu, 2),
        "total_fuel": round(total_fuel, 2),
        "by_tractor": {k: round(v, 2) for k, v in by_tractor.items()},
        "by_operator": {k: round(v, 2) for k, v in by_operator.items()},
    }
