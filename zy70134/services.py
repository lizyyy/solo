import hashlib
import random
import json
from typing import List, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
import models
import schemas


def record_history(
    db: Session,
    entity_type: str,
    entity_id: int,
    action: str,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    operator_id: str = "system",
    comments: Optional[str] = None
) -> models.HistoryRecord:
    history = models.HistoryRecord(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        old_value=old_value,
        new_value=new_value,
        operator_id=operator_id,
        comments=comments
    )
    db.add(history)
    db.flush()
    return history


def generate_stable_seed(batch_id: int, rule_id: int) -> str:
    seed_str = f"batch_{batch_id}_rule_{rule_id}_v1"
    return hashlib.md5(seed_str.encode()).hexdigest()


def deterministic_sample(
    recording_ids: List[str],
    seed: str,
    count: int
) -> List[str]:
    if count >= len(recording_ids):
        return sorted(recording_ids)
    rng = random.Random(seed)
    return sorted(rng.sample(recording_ids, count))


def create_batch(db: Session, batch_data: schemas.BatchCreate) -> models.RecordingBatch:
    existing = db.query(models.RecordingBatch).filter(
        models.RecordingBatch.batch_code == batch_data.batch_code
    ).first()
    if existing:
        raise ValueError(f"Batch code {batch_data.batch_code} already exists")
    
    batch = models.RecordingBatch(
        batch_code=batch_data.batch_code,
        name=batch_data.name,
        agent_id=batch_data.agent_id,
        record_count=batch_data.record_count,
        status="created"
    )
    db.add(batch)
    db.flush()
    
    for recording_id in batch_data.recording_ids:
        br = models.BatchRecording(
            batch_id=batch.id,
            recording_id=recording_id,
            recording_url=f"/recordings/{recording_id}"
        )
        db.add(br)
    db.flush()
    
    record_history(
        db=db,
        entity_type="RecordingBatch",
        entity_id=batch.id,
        action="CREATE",
        new_value=json.dumps({
            "batch_code": batch.batch_code,
            "name": batch.name,
            "agent_id": batch.agent_id,
            "record_count": batch.record_count,
            "recording_ids_count": len(batch_data.recording_ids)
        }),
        operator_id="system"
    )
    db.commit()
    db.refresh(batch)
    return batch


def get_batch_recording_ids(db: Session, batch_id: int) -> List[str]:
    recordings = db.query(models.BatchRecording).filter(
        models.BatchRecording.batch_id == batch_id
    ).order_by(models.BatchRecording.recording_id.asc()).all()
    return [r.recording_id for r in recordings]


def create_rule(db: Session, rule_data: schemas.RuleCreate) -> models.SamplingRule:
    rule = models.SamplingRule(
        name=rule_data.name,
        sampling_ratio=rule_data.sampling_ratio,
        min_samples=rule_data.min_samples,
        max_samples=rule_data.max_samples,
        description=rule_data.description
    )
    db.add(rule)
    db.flush()
    record_history(
        db=db,
        entity_type="SamplingRule",
        entity_id=rule.id,
        action="CREATE",
        new_value=json.dumps({
            "name": rule.name,
            "sampling_ratio": rule.sampling_ratio,
            "min_samples": rule.min_samples,
            "max_samples": rule.max_samples
        }),
        operator_id="system"
    )
    db.commit()
    db.refresh(rule)
    return rule


def calculate_sample_count(rule: models.SamplingRule, total_count: int) -> int:
    count = int(total_count * rule.sampling_ratio)
    count = max(count, rule.min_samples)
    count = min(count, rule.max_samples)
    return count


def execute_sampling(
    db: Session,
    request: schemas.SamplingRequest,
    all_recording_ids: List[str]
) -> Tuple[models.SamplingTask, List[models.Assignment]]:
    batch = db.query(models.RecordingBatch).get(request.batch_id)
    if not batch:
        raise ValueError("Batch not found")
    
    rule = db.query(models.SamplingRule).get(request.rule_id)
    if not rule:
        raise ValueError("Rule not found")
    if not rule.is_active:
        raise ValueError("Rule is not active")
    
    if not request.inspectors:
        raise ValueError("No inspectors provided")
    
    existing_task = db.query(models.SamplingTask).filter(
        models.SamplingTask.batch_id == request.batch_id,
        models.SamplingTask.rule_id == request.rule_id,
        models.SamplingTask.status.in_(["created", "in_progress", "completed"])
    ).first()
    
    if existing_task:
        assignments = db.query(models.Assignment).filter(
            models.Assignment.sampling_task_id == existing_task.id
        ).all()
        return existing_task, assignments
    
    seed = generate_stable_seed(request.batch_id, request.rule_id)
    sample_count = calculate_sample_count(rule, batch.record_count)
    sampled_ids = deterministic_sample(all_recording_ids, seed, sample_count)
    
    task = models.SamplingTask(
        batch_id=request.batch_id,
        rule_id=request.rule_id,
        sample_seed=seed,
        sampled_count=len(sampled_ids),
        status="created"
    )
    db.add(task)
    db.flush()
    
    record_history(
        db=db,
        entity_type="SamplingTask",
        entity_id=task.id,
        action="CREATE",
        new_value=json.dumps({
            "batch_id": task.batch_id,
            "rule_id": task.rule_id,
            "seed": seed,
            "sample_count": len(sampled_ids),
            "sampled_ids": sampled_ids[:10]
        }),
        operator_id="system"
    )
    
    sample_records = []
    for recording_id in sampled_ids:
        sr = models.SampleRecord(
            sampling_task_id=task.id,
            recording_id=recording_id,
            recording_url=f"/recordings/{recording_id}"
        )
        sample_records.append(sr)
        db.add(sr)
    db.flush()
    
    assignments = []
    for i, sr in enumerate(sample_records):
        inspector = request.inspectors[i % len(request.inspectors)]
        assignment = models.Assignment(
            batch_id=request.batch_id,
            sampling_task_id=task.id,
            sample_record_id=sr.id,
            inspector_id=inspector,
            status="assigned"
        )
        assignments.append(assignment)
        db.add(assignment)
    db.flush()
    
    for assignment in assignments:
        sr = next(s for s in sample_records if s.id == assignment.sample_record_id)
        record_history(
            db=db,
            entity_type="Assignment",
            entity_id=assignment.id,
            action="ASSIGN",
            new_value=json.dumps({
                "inspector_id": assignment.inspector_id,
                "sample_record_id": assignment.sample_record_id,
                "recording_id": sr.recording_id
            }),
            operator_id="system"
        )
    
    task.status = "in_progress"
    batch.status = "sampled"
    db.commit()
    db.refresh(task)
    for a in assignments:
        db.refresh(a)
    
    return task, assignments


def submit_inspection(
    db: Session,
    request: schemas.InspectionRequest
) -> models.InspectionResult:
    assignment = db.query(models.Assignment).get(request.assignment_id)
    if not assignment:
        raise ValueError("Assignment not found")
    
    if assignment.status == "completed":
        raise ValueError("Assignment already completed")
    
    if assignment.inspector_id != request.inspector_id:
        raise ValueError("Inspector mismatch")
    
    existing_result = db.query(models.InspectionResult).filter(
        models.InspectionResult.assignment_id == request.assignment_id
    ).first()
    if existing_result:
        raise ValueError("Inspection already submitted")
    
    result = models.InspectionResult(
        assignment_id=request.assignment_id,
        score=request.score,
        is_passed=request.is_passed,
        comments=request.comments,
        inspector_id=request.inspector_id
    )
    db.add(result)
    db.flush()
    
    old_status = assignment.status
    assignment.status = "completed"
    assignment.completed_at = datetime.utcnow()
    
    record_history(
        db=db,
        entity_type="Assignment",
        entity_id=assignment.id,
        action="COMPLETE",
        old_value=json.dumps({"status": old_status}),
        new_value=json.dumps({"status": "completed"}),
        operator_id=request.inspector_id
    )
    record_history(
        db=db,
        entity_type="InspectionResult",
        entity_id=result.id,
        action="SUBMIT",
        new_value=json.dumps({
            "score": result.score,
            "is_passed": result.is_passed,
            "assignment_id": result.assignment_id
        }),
        operator_id=request.inspector_id
    )
    
    db.commit()
    db.refresh(result)
    return result


def create_review(
    db: Session,
    request: schemas.ReviewCreate
) -> models.Review:
    inspection = db.query(models.InspectionResult).get(request.inspection_result_id)
    if not inspection:
        raise ValueError("Inspection result not found")
    
    existing = db.query(models.Review).filter(
        models.Review.inspection_result_id == request.inspection_result_id,
        models.Review.status.in_(["pending", "reviewed"])
    ).first()
    if existing:
        raise ValueError("Review already exists for this inspection")
    
    review = models.Review(
        inspection_result_id=request.inspection_result_id,
        appeal_reason=request.appeal_reason,
        appeal_by=request.appeal_by,
        appeal_at=datetime.utcnow(),
        status="pending",
        original_score=inspection.score
    )
    db.add(review)
    db.flush()
    
    record_history(
        db=db,
        entity_type="Review",
        entity_id=review.id,
        action="APPEAL",
        new_value=json.dumps({
            "inspection_result_id": review.inspection_result_id,
            "appeal_by": review.appeal_by,
            "original_score": review.original_score
        }),
        operator_id=request.appeal_by,
        comments=request.appeal_reason
    )
    
    db.commit()
    db.refresh(review)
    return review


def process_review(
    db: Session,
    request: schemas.ReviewProcess
) -> models.Review:
    review = db.query(models.Review).get(request.review_id)
    if not review:
        raise ValueError("Review not found")
    
    if review.status != "pending":
        raise ValueError(f"Review already {review.status}")
    
    if request.score_adjusted:
        if request.adjusted_score is None:
            raise ValueError("Adjusted score required when score_adjusted is True")
        if request.adjusted_score < 0 or request.adjusted_score > 100:
            raise ValueError("Adjusted score must be between 0 and 100")
        review.adjusted_score = request.adjusted_score
        review.score_adjusted = True
    
    old_status = review.status
    review.status = "reviewed"
    review.review_comments = request.review_comments
    review.review_by = request.review_by
    review.review_at = datetime.utcnow()
    
    record_history(
        db=db,
        entity_type="Review",
        entity_id=review.id,
        action="REVIEW",
        old_value=json.dumps({"status": old_status}),
        new_value=json.dumps({
            "status": "reviewed",
            "score_adjusted": review.score_adjusted,
            "adjusted_score": review.adjusted_score
        }),
        operator_id=request.review_by,
        comments=request.review_comments
    )
    
    db.commit()
    db.refresh(review)
    return review


def freeze_score(
    db: Session,
    request: schemas.ScoreFreezeCreate
) -> models.ScoreFreeze:
    inspection = db.query(models.InspectionResult).get(request.inspection_result_id)
    if not inspection:
        raise ValueError("Inspection result not found")
    
    existing = db.query(models.ScoreFreeze).filter(
        models.ScoreFreeze.inspection_result_id == request.inspection_result_id,
        models.ScoreFreeze.is_active == True
    ).first()
    if existing:
        raise ValueError("Score already frozen for this inspection")
    
    freeze = models.ScoreFreeze(
        inspection_result_id=request.inspection_result_id,
        reason=request.reason,
        frozen_score=request.frozen_score,
        operator_id=request.operator_id
    )
    db.add(freeze)
    db.flush()
    
    record_history(
        db=db,
        entity_type="ScoreFreeze",
        entity_id=freeze.id,
        action="FREEZE",
        new_value=json.dumps({
            "inspection_result_id": freeze.inspection_result_id,
            "frozen_score": freeze.frozen_score,
            "reason": request.reason
        }),
        operator_id=request.operator_id,
        comments=request.reason
    )
    
    db.commit()
    db.refresh(freeze)
    return freeze


def unfreeze_score(
    db: Session,
    freeze_id: int,
    operator_id: str
) -> models.ScoreFreeze:
    freeze = db.query(models.ScoreFreeze).get(freeze_id)
    if not freeze:
        raise ValueError("Score freeze not found")
    
    if not freeze.is_active:
        raise ValueError("Score already unfrozen")
    
    freeze.is_active = False
    freeze.unfrozen_at = datetime.utcnow()
    
    record_history(
        db=db,
        entity_type="ScoreFreeze",
        entity_id=freeze.id,
        action="UNFREEZE",
        old_value=json.dumps({"is_active": True}),
        new_value=json.dumps({"is_active": False}),
        operator_id=operator_id
    )
    
    db.commit()
    db.refresh(freeze)
    return freeze


def get_quality_report(db: Session, batch_id: int) -> schemas.QualityReport:
    batch = db.query(models.RecordingBatch).get(batch_id)
    if not batch:
        raise ValueError("Batch not found")
    
    assignments = db.query(models.Assignment).filter(
        models.Assignment.batch_id == batch_id
    ).all()
    
    completed = [a for a in assignments if a.status == "completed"]
    results = db.query(models.InspectionResult).filter(
        models.InspectionResult.assignment_id.in_([a.id for a in completed])
    ).all()
    
    passed = sum(1 for r in results if r.is_passed)
    failed = len(results) - passed
    avg_score = sum(r.score for r in results) / len(results) if results else 0.0
    
    reviews = db.query(models.Review).filter(
        models.Review.status == "pending"
    ).all()
    inspection_ids_with_review = [r.inspection_result_id for r in reviews]
    under_review = sum(1 for r in results if r.id in inspection_ids_with_review)
    
    freezes = db.query(models.ScoreFreeze).filter(
        models.ScoreFreeze.is_active == True
    ).all()
    inspection_ids_frozen = [f.inspection_result_id for f in freezes]
    score_frozen = sum(1 for r in results if r.id in inspection_ids_frozen)
    
    return schemas.QualityReport(
        batch_id=batch.id,
        batch_code=batch.batch_code,
        total_assigned=len(assignments),
        completed=len(completed),
        passed=passed,
        failed=failed,
        avg_score=round(avg_score, 2),
        under_review=under_review,
        score_frozen=score_frozen
    )


def get_entity_history(db: Session, entity_type: str, entity_id: int) -> List[models.HistoryRecord]:
    return db.query(models.HistoryRecord).filter(
        models.HistoryRecord.entity_type == entity_type,
        models.HistoryRecord.entity_id == entity_id
    ).order_by(models.HistoryRecord.timestamp.asc()).all()
