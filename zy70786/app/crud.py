import hashlib
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from fnmatch import fnmatch

from app.models import (
    BuildArtifact, Chunk, ChunkModule, BudgetRule, Violation, BudgetReport,
    BuildStatus, ViolationType
)
from app.schemas import (
    BuildArtifactCreate, BudgetRuleCreate, BudgetReportFilter
)
from app.config import settings
from app.exceptions import (
    NotFoundException, AlreadyProcessedException, NeedsReviewException,
    DuplicateBuildException
)


def create_build_artifact(db: Session, artifact: BuildArtifactCreate) -> BuildArtifact:
    existing = db.query(BuildArtifact).filter(BuildArtifact.build_id == artifact.build_id).first()
    if existing:
        raise DuplicateBuildException(artifact.build_id)

    db_artifact = BuildArtifact(
        build_id=artifact.build_id,
        project_name=artifact.project_name,
        branch=artifact.branch,
        commit_hash=artifact.commit_hash,
        built_at=artifact.built_at or datetime.utcnow(),
        status=BuildStatus.PENDING,
        chunk_count=len(artifact.chunks),
    )
    db.add(db_artifact)
    db.flush()

    total_size = 0.0
    for chunk_data in artifact.chunks:
        db_chunk = Chunk(
            artifact_id=db_artifact.id,
            chunk_name=chunk_data.chunk_name,
            file_size=chunk_data.file_size,
            gzip_size=chunk_data.gzip_size,
            budget_size=chunk_data.budget_size,
            is_initial=chunk_data.is_initial,
            is_async=chunk_data.is_async,
        )
        db.add(db_chunk)
        db.flush()

        for module_data in chunk_data.modules:
            db_module = ChunkModule(
                chunk_id=db_chunk.id,
                module_path=module_data.module_path,
                module_size=module_data.module_size,
                package_name=module_data.package_name,
                is_third_party=module_data.is_third_party,
            )
            db.add(db_module)

        total_size += chunk_data.file_size

    db_artifact.total_size = total_size
    db.commit()
    db.refresh(db_artifact)
    return db_artifact


def get_build_artifact(db: Session, artifact_id: int) -> Optional[BuildArtifact]:
    return db.query(BuildArtifact).filter(BuildArtifact.id == artifact_id).first()


def get_build_artifact_by_build_id(db: Session, build_id: str) -> Optional[BuildArtifact]:
    return db.query(BuildArtifact).filter(BuildArtifact.build_id == build_id).first()


def get_build_artifacts(
    db: Session,
    project_name: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[BuildArtifact]:
    query = db.query(BuildArtifact)
    if project_name:
        query = query.filter(BuildArtifact.project_name == project_name)
    return query.order_by(BuildArtifact.created_at.desc()).offset(skip).limit(limit).all()


def update_build_status(db: Session, artifact_id: int, status: BuildStatus) -> BuildArtifact:
    artifact = get_build_artifact(db, artifact_id)
    if not artifact:
        raise NotFoundException("BuildArtifact", artifact_id)
    artifact.status = status
    artifact.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(artifact)
    return artifact


def create_budget_rule(db: Session, rule: BudgetRuleCreate) -> BudgetRule:
    db_rule = BudgetRule(**rule.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


def get_budget_rules(db: Session, project_name: Optional[str] = None) -> List[BudgetRule]:
    query = db.query(BudgetRule).filter(BudgetRule.is_active == True)
    if project_name:
        query = query.filter(BudgetRule.project_name == project_name)
    return query.order_by(BudgetRule.priority.desc()).all()


def match_budget_rule(db: Session, project_name: str, chunk_name: str) -> Optional[BudgetRule]:
    rules = get_budget_rules(db, project_name)
    for rule in rules:
        if fnmatch(chunk_name, rule.chunk_pattern):
            return rule
    return None


def get_chunk_budget(db: Session, project_name: str, chunk_name: str) -> float:
    rule = match_budget_rule(db, project_name, chunk_name)
    if rule:
        return rule.budget_size_kb
    return settings.DEFAULT_BUDGET_KB


def get_previous_build_artifact(
    db: Session,
    project_name: str,
    current_built_at: datetime,
    branch: Optional[str] = None,
) -> Optional[BuildArtifact]:
    query = db.query(BuildArtifact).filter(
        BuildArtifact.project_name == project_name,
        BuildArtifact.built_at < current_built_at,
        BuildArtifact.status == BuildStatus.COMPLETED,
    )
    if branch:
        query = query.filter(BuildArtifact.branch == branch)
    return query.order_by(BuildArtifact.built_at.desc()).first()


def generate_report_hash(artifact_id: int) -> str:
    return hashlib.md5(f"{artifact_id}:{datetime.utcnow().timestamp()}".encode()).hexdigest()


def analyze_budget_violations(
    db: Session,
    artifact: BuildArtifact,
) -> BudgetReport:
    artifact.status = BuildStatus.ANALYZING
    db.commit()

    report_hash = generate_report_hash(artifact.id)
    report = BudgetReport(
        artifact_id=artifact.id,
        report_hash=report_hash,
    )
    db.add(report)
    db.flush()

    total_violations = 0
    critical_violations = 0
    warning_violations = 0
    total_excess_kb = 0.0

    prev_artifact = get_previous_build_artifact(
        db, artifact.project_name, artifact.built_at, artifact.branch
    )

    prev_chunks: Dict[str, Chunk] = {}
    if prev_artifact:
        prev_chunks = {c.chunk_name: c for c in prev_artifact.chunks}

    for chunk in artifact.chunks:
        budget_kb = get_chunk_budget(db, artifact.project_name, chunk.chunk_name)
        chunk.budget_size = budget_kb

        actual_kb = chunk.file_size / 1024

        if actual_kb > budget_kb:
            excess = actual_kb - budget_kb
            violation = Violation(
                chunk_id=chunk.id,
                report_id=report.id,
                violation_type=ViolationType.SIZE_EXCEEDED,
                actual_size=actual_kb,
                budget_size=budget_kb,
                excess_size=excess,
                reason=f"Chunk size {actual_kb:.2f}KB exceeds budget {budget_kb:.2f}KB",
                needs_review=excess > budget_kb * 0.5,
            )
            db.add(violation)
            total_violations += 1
            critical_violations += 1
            total_excess_kb += excess

        if chunk.chunk_name not in prev_chunks and actual_kb > settings.DEFAULT_BUDGET_KB:
            violation = Violation(
                chunk_id=chunk.id,
                report_id=report.id,
                violation_type=ViolationType.NEW_LARGE_CHUNK,
                actual_size=actual_kb,
                budget_size=budget_kb,
                reason=f"New large chunk detected: {actual_kb:.2f}KB",
                needs_review=True,
            )
            db.add(violation)
            total_violations += 1
            warning_violations += 1

        if chunk.chunk_name in prev_chunks:
            prev_chunk = prev_chunks[chunk.chunk_name]
            prev_kb = prev_chunk.file_size / 1024
            if prev_kb > 0:
                growth_rate = ((actual_kb - prev_kb) / prev_kb) * 100
                if growth_rate > 20:
                    violation = Violation(
                        chunk_id=chunk.id,
                        report_id=report.id,
                        violation_type=ViolationType.UNEXPECTED_GROWTH,
                        actual_size=actual_kb,
                        budget_size=budget_kb,
                        excess_size=actual_kb - prev_kb,
                        growth_rate=growth_rate,
                        reason=f"Unexpected growth: +{growth_rate:.1f}% from previous build",
                        needs_review=growth_rate > 50,
                    )
                    db.add(violation)
                    total_violations += 1
                    warning_violations += 1

    module_occurrences: Dict[str, List[Chunk]] = {}
    for chunk in artifact.chunks:
        for module in chunk.modules:
            key = module.module_path
            if key not in module_occurrences:
                module_occurrences[key] = []
            module_occurrences[key].append(chunk)

    for module_path, chunks_list in module_occurrences.items():
        if len(chunks_list) > 1:
            total_size_kb = sum(c.file_size for c in chunks_list) / 1024
            chunk_names = ", ".join(c.chunk_name for c in chunks_list)
            violation = Violation(
                chunk_id=chunks_list[0].id,
                report_id=report.id,
                violation_type=ViolationType.DUPLICATE_MODULES,
                actual_size=total_size_kb,
                budget_size=None,
                excess_size=total_size_kb,
                reason=f"Module '{module_path}' appears in {len(chunks_list)} chunks: {chunk_names}",
                needs_review=len(chunks_list) > 2,
            )
            db.add(violation)
            total_violations += 1
            warning_violations += 1

    report.total_violations = total_violations
    report.critical_violations = critical_violations
    report.warning_violations = warning_violations
    report.total_excess_kb = total_excess_kb

    artifact.status = BuildStatus.NEEDS_REVIEW if total_violations > 0 else BuildStatus.COMPLETED
    artifact.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(report)
    return report


def get_budget_report(db: Session, report_id: int) -> Optional[BudgetReport]:
    return db.query(BudgetReport).filter(BudgetReport.id == report_id).first()


def get_budget_reports(db: Session, filter_params: BudgetReportFilter) -> List[BudgetReport]:
    query = db.query(BudgetReport).join(BuildArtifact)

    if filter_params.project_name:
        query = query.filter(BuildArtifact.project_name == filter_params.project_name)

    if filter_params.branch:
        query = query.filter(BuildArtifact.branch == filter_params.branch)

    if filter_params.start_date:
        query = query.filter(BudgetReport.generated_at >= filter_params.start_date)

    if filter_params.end_date:
        query = query.filter(BudgetReport.generated_at <= filter_params.end_date)

    if filter_params.has_violations is not None:
        if filter_params.has_violations:
            query = query.filter(BudgetReport.total_violations > 0)
        else:
            query = query.filter(BudgetReport.total_violations == 0)

    if filter_params.is_processed is not None:
        query = query.filter(BudgetReport.is_processed == filter_params.is_processed)

    if filter_params.needs_review is not None:
        if filter_params.needs_review:
            query = query.filter(
                BudgetReport.violations.any(Violation.needs_review == True)
            )
        else:
            query = query.filter(
                ~BudgetReport.violations.any(Violation.needs_review == True)
            )

    return query.order_by(BudgetReport.generated_at.desc()).all()


def mark_report_processed(db: Session, report_id: int, notes: Optional[str] = None) -> BudgetReport:
    report = get_budget_report(db, report_id)
    if not report:
        raise NotFoundException("BudgetReport", report_id)

    if report.is_processed:
        raise AlreadyProcessedException(report_id)

    needs_review_count = db.query(Violation).filter(
        Violation.report_id == report_id,
        Violation.needs_review == True,
        Violation.reviewed == False,
    ).count()

    if needs_review_count > 0:
        raise NeedsReviewException(report_id)

    report.is_processed = True
    report.processed_at = datetime.utcnow()
    if notes:
        report.notes = notes

    artifact = get_build_artifact(db, report.artifact_id)
    if artifact:
        artifact.status = BuildStatus.PROCESSED
        artifact.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(report)
    return report


def review_violation(
    db: Session,
    violation_id: int,
    reviewed: bool = True,
    reviewed_by: Optional[str] = None,
) -> Violation:
    violation = db.query(Violation).filter(Violation.id == violation_id).first()
    if not violation:
        raise NotFoundException("Violation", violation_id)

    violation.reviewed = reviewed
    violation.reviewed_at = datetime.utcnow()
    if reviewed_by:
        violation.reviewed_by = reviewed_by

    db.commit()
    db.refresh(violation)
    return violation
