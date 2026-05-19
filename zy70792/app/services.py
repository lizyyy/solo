import os
import hashlib
import json
from typing import List, Dict
from sqlalchemy.orm import Session
from app.models import HashTask, ArtifactFile, ExceptionRecord, TaskStatus
from app.schemas import HashTaskCreate, ManualCorrection
from datetime import datetime


def calculate_file_hash(file_path: str, chunk_size: int = 8192) -> str:
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(chunk_size), b""):
            sha256_hash.update(chunk)
    return sha256_hash.hexdigest()


def scan_directory(base_dir: str, region: str) -> List[Dict]:
    files = []
    if not os.path.exists(base_dir):
        raise FileNotFoundError(f"Directory not found: {base_dir}")
    
    region_dir = os.path.join(base_dir, region)
    if not os.path.exists(region_dir):
        raise FileNotFoundError(f"Region directory not found: {region_dir}")
    
    for root, _, filenames in os.walk(region_dir):
        for filename in filenames:
            full_path = os.path.join(root, filename)
            relative_path = os.path.relpath(full_path, region_dir)
            file_size = os.path.getsize(full_path)
            file_hash = calculate_file_hash(full_path)
            files.append({
                "file_path": relative_path,
                "file_name": filename,
                "file_size": file_size,
                "file_hash": file_hash,
                "upload_region": region
            })
    return files


def compare_regions(files_by_region: Dict[str, List[Dict]]) -> Dict:
    all_files = set()
    region_files = {}
    hash_map = {}
    
    for region, files in files_by_region.items():
        region_files[region] = set()
        for f in files:
            file_key = f["file_path"]
            all_files.add(file_key)
            region_files[region].add(file_key)
            if file_key not in hash_map:
                hash_map[file_key] = {}
            hash_map[file_key][region] = {
                    "hash": f["file_hash"],
                    "size": f["file_size"]
                }
    
    missing_files = {}
    hash_conflicts = []
    
    for region in files_by_region.keys():
        missing = all_files - region_files[region]
        if missing:
            missing_files[region] = list(missing)
    
    for file_path, region_data in hash_map.items():
        hashes = set(d["hash"] for d in region_data.values())
        sizes = set(d["size"] for d in region_data.values())
        if len(hashes) > 1 or len(sizes) > 1:
            hash_conflicts.append({
                "file_path": file_path,
                "regions": region_data
            })
    
    return {
        "total_files": len(all_files),
        "regions_checked": list(files_by_region.keys()),
        "missing_files": missing_files,
        "hash_conflicts": hash_conflicts,
        "has_conflict": bool(missing_files) or bool(hash_conflicts)
    }


def create_task(db: Session, task: HashTaskCreate) -> HashTask:
    db_task = HashTask(
        task_name=task.task_name,
        artifact_dir=task.artifact_dir,
        regions=task.regions,
        status=TaskStatus.PENDING
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


def get_task(db: Session, task_id: int) -> HashTask:
    return db.query(HashTask).filter(HashTask.id == task_id).first()


def get_all_tasks(db: Session, skip: int = 0, limit: int = 100) -> List[HashTask]:
    return db.query(HashTask).offset(skip).limit(limit).all()


def update_task_status(db: Session, task_id: int, status: TaskStatus) -> HashTask:
    task = get_task(db, task_id)
    if task:
        task.status = status
        db.commit()
        db.refresh(task)
    return task


def scan_task_files(db: Session, task_id: int) -> HashTask:
    task = get_task(db, task_id)
    if not task:
        raise ValueError(f"Task {task_id} not found")
    
    task.status = TaskStatus.SCANNING
    db.commit()
    
    regions = [r.strip() for r in task.regions.split(",")]
    all_files = []
    
    try:
        for region in regions:
            files = scan_directory(task.artifact_dir, region)
            for f in files:
                db_file = ArtifactFile(
                    task_id=task.id,
                    **f
                )
                db.add(db_file)
                all_files.append(f)
        
        task.status = TaskStatus.SCAN_COMPLETED
        db.commit()
        db.refresh(task)
    except Exception as e:
        task.status = TaskStatus.CONFLICT
        db.commit()
        raise e
    
    return task


def compare_task_files(db: Session, task_id: int) -> HashTask:
    task = get_task(db, task_id)
    if not task:
        raise ValueError(f"Task {task_id} not found")
    
    task.status = TaskStatus.COMPARING
    db.commit()
    
    regions = [r.strip() for r in task.regions.split(",")]
    files_by_region = {}
    
    for region in regions:
        files = db.query(ArtifactFile).filter(
            ArtifactFile.task_id == task_id,
            ArtifactFile.upload_region == region
        ).all()
        files_by_region[region] = [
            {
                "file_path": f.file_path,
                "file_hash": f.file_hash,
                "file_size": f.file_size
            } for f in files
        ]
    
    report = compare_regions(files_by_region)
    task.report = json.dumps(report, ensure_ascii=False, indent=2)
    
    if report["has_conflict"]:
        task.status = TaskStatus.CONFLICT
    else:
        task.status = TaskStatus.COMPARISON_COMPLETED
    
    db.commit()
    db.refresh(task)
    return task


def add_exception_record(db: Session, task_id: int, correction: ManualCorrection) -> ExceptionRecord:
    record = ExceptionRecord(
        task_id=task_id,
        original_input=correction.original_input,
        handler=correction.handler,
        conclusion=correction.conclusion
    )
    db.add(record)
    
    if correction.new_status:
        task = get_task(db, task_id)
        task.status = correction.new_status
    
    db.commit()
    db.refresh(record)
    return record


def cancel_task(db: Session, task_id: int) -> HashTask:
    task = get_task(db, task_id)
    if task:
        task.status = TaskStatus.CANCELLED
        db.commit()
        db.refresh(task)
    return task


def close_task(db: Session, task_id: int) -> HashTask:
    task = get_task(db, task_id)
    if task:
        task.status = TaskStatus.CLOSED
        db.commit()
        db.refresh(task)
    return task


def export_task_report(db: Session, task_id: int, export_format: str = "json"):
    task = get_task(db, task_id)
    if not task:
        raise ValueError(f"Task {task_id} not found")
    
    files = db.query(ArtifactFile).filter(ArtifactFile.task_id == task_id).all()
    exceptions = db.query(ExceptionRecord).filter(ExceptionRecord.task_id == task_id).all()
    
    result = {
        "task": {
            "id": task.id,
            "task_name": task.task_name,
            "artifact_dir": task.artifact_dir,
            "regions": task.regions,
            "status": task.status.value,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "updated_at": task.updated_at.isoformat() if task.updated_at else None
        },
        "report": json.loads(task.report) if task.report else None,
        "files": [
            {
                "file_path": f.file_path,
                "file_name": f.file_name,
                "file_size": f.file_size,
                "file_hash": f.file_hash,
                "upload_region": f.upload_region
            } for f in files
        ],
        "exceptions": [
            {
                "original_input": e.original_input,
                "handler": e.handler,
                "conclusion": e.conclusion,
                "created_at": e.created_at.isoformat() if e.created_at else None
            } for e in exceptions
        ]
    }
    
    return result
