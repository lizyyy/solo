import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app import crud, schemas
from app.models import GPUModel


def seed_gpu_resources():
    db = SessionLocal()
    try:
        gpu_configs = [
            {"gpu_model": GPUModel.A100, "total": 8, "available": 8},
            {"gpu_model": GPUModel.A10, "total": 16, "available": 16},
            {"gpu_model": GPUModel.V100, "total": 4, "available": 4},
            {"gpu_model": GPUModel.T4, "total": 20, "available": 20},
        ]
        
        for config in gpu_configs:
            existing = crud.get_gpu_resource(db, config["gpu_model"])
            if not existing:
                resource = schemas.GPUResourceCreate(**config)
                crud.create_gpu_resource(db, resource)
                print(f"Created GPU resource: {config['gpu_model']}")
            else:
                print(f"GPU resource already exists: {config['gpu_model']}")
        
        print("GPU resources seeded successfully!")
    finally:
        db.close()


def seed_sample_jobs():
    db = SessionLocal()
    try:
        sample_jobs = [
            {"job_id": "JOB-001", "gpu_model": GPUModel.A100, "gpu_count": 2, "estimated_duration": 60, "priority": 10, "user": "alice"},
            {"job_id": "JOB-002", "gpu_model": GPUModel.A100, "gpu_count": 4, "estimated_duration": 120, "priority": 5, "user": "bob"},
            {"job_id": "JOB-003", "gpu_model": GPUModel.A10, "gpu_count": 2, "estimated_duration": 30, "priority": 8, "user": "charlie"},
            {"job_id": "JOB-004", "gpu_model": GPUModel.V100, "gpu_count": 1, "estimated_duration": 180, "priority": 3, "user": "dave"},
            {"job_id": "JOB-005", "gpu_model": GPUModel.T4, "gpu_count": 8, "estimated_duration": 240, "priority": 7, "user": "eve"},
        ]
        
        for job_data in sample_jobs:
            existing = crud.get_job(db, job_data["job_id"])
            if not existing:
                job = schemas.JobCreate(**job_data)
                crud.create_job(db, job)
                print(f"Created job: {job_data['job_id']}")
            else:
                print(f"Job already exists: {job_data['job_id']}")
        
        print("Sample jobs seeded successfully!")
    finally:
        db.close()


if __name__ == "__main__":
    seed_gpu_resources()
    seed_sample_jobs()
    print("Seeding completed!")