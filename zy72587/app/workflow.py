import uuid
from datetime import datetime
from typing import List, Optional
from .models import (
    CheckSession,
    FeatureRecord,
    CheckStep,
    RecordStatus,
    ConflictResolution,
    ConflictEvidence,
    CheckParameters,
)
from .checker import process_all_records
from .self_check import run_all_self_checks
from .result_store import UnifiedResultStore


class WorkflowManager:
    def __init__(self):
        self.sessions: dict = {}

    def create_session(self, created_by: str = "xiaomeng") -> CheckSession:
        session_id = str(uuid.uuid4())[:8]
        session = CheckSession(
            session_id=session_id,
            created_at=datetime.now(),
            created_by=created_by,
            current_step=CheckStep.STEP1_IMPORT,
        )
        self.sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> Optional[CheckSession]:
        return self.sessions.get(session_id)

    def get_result_store(self, session_id: str) -> Optional[UnifiedResultStore]:
        session = self.get_session(session_id)
        if session is None:
            return None
        return UnifiedResultStore(session)

    def step1_import_bucket(
        self,
        session_id: str,
        bucket_records: List[FeatureRecord],
        parameters: Optional[CheckParameters] = None,
    ) -> CheckSession:
        session = self.get_session(session_id)
        if session is None:
            raise ValueError(f"会话{session_id}不存在")

        if session.current_step != CheckStep.STEP1_IMPORT:
            raise ValueError(f"当前步骤不是导入步骤，当前为{session.current_step}")

        if parameters:
            session.parameters = parameters

        from .checker import process_record_status

        processed_bucket = [process_record_status(r, session.parameters) for r in bucket_records]
        session.bucket_records = processed_bucket

        session.self_check_results = run_all_self_checks(
            session.bucket_records, session.negative_records
        )

        for r in session.bucket_records:
            if r.status == RecordStatus.FEATURE_MISSING_DEFAULT:
                r.status = RecordStatus.PENDING_REVIEW
                r.notes = f"{r.notes}。待推荐负责人复核"

        return session

    def step2_review_negatives(
        self,
        session_id: str,
        negative_records: List[FeatureRecord],
    ) -> CheckSession:
        session = self.get_session(session_id)
        if session is None:
            raise ValueError(f"会话{session_id}不存在")

        if session.current_step != CheckStep.STEP1_IMPORT and session.current_step != CheckStep.STEP2_REVIEW_NEGATIVES:
            raise ValueError(f"需先完成步骤1，当前为{session.current_step}")

        session.current_step = CheckStep.STEP2_REVIEW_NEGATIVES
        session.negative_records = negative_records

        processed_bucket, processed_negative, conflicts = process_all_records(
            session.bucket_records, negative_records, session.parameters
        )
        session.bucket_records = processed_bucket
        session.negative_records = processed_negative
        session.conflicts = conflicts

        for r in session.bucket_records:
            if r.status == RecordStatus.FEATURE_MISSING_DEFAULT:
                r.status = RecordStatus.PENDING_REVIEW
                r.notes = f"{r.notes}。待推荐负责人复核"
        for r in session.negative_records:
            if r.status == RecordStatus.FEATURE_MISSING_DEFAULT:
                r.status = RecordStatus.PENDING_REVIEW
                r.notes = f"{r.notes}。待推荐负责人复核"

        session.self_check_results = run_all_self_checks(
            session.bucket_records, session.negative_records
        )

        return session

    def resolve_conflict(
        self,
        session_id: str,
        record_id: str,
        resolution: ConflictResolution,
        resolved_by: str,
    ) -> CheckSession:
        session = self.get_session(session_id)
        if session is None:
            raise ValueError(f"会话{session_id}不存在")

        for conflict in session.conflicts:
            if conflict.record_id == record_id:
                conflict.resolution = resolution
                conflict.resolved_by = resolved_by
                conflict.resolved_at = datetime.now()

                for rec in session.bucket_records:
                    if rec.sample_id == record_id:
                        if rec.feature_value is None or rec.default_value_used:
                            rec.status = RecordStatus.PENDING_REVIEW
                            rec.notes = f"冲突已处理: {conflict.description}。特征缺失待推荐负责人复核"
                        elif resolution == ConflictResolution.CONFIRM:
                            rec.status = RecordStatus.NORMAL
                            rec.notes = f"冲突已确认并解决: {conflict.description}"
                        elif resolution == ConflictResolution.REJECT:
                            rec.status = RecordStatus.ABNORMAL
                            rec.notes = f"冲突已驳回: {conflict.description}"

                for rec in session.negative_records:
                    if rec.sample_id == record_id:
                        if rec.feature_value is None or rec.default_value_used:
                            rec.status = RecordStatus.PENDING_REVIEW
                            rec.notes = f"冲突已处理: {conflict.description}。特征缺失待推荐负责人复核"
                        elif resolution == ConflictResolution.CONFIRM:
                            rec.status = RecordStatus.NORMAL
                            rec.notes = f"冲突已确认并解决: {conflict.description}"
                        elif resolution == ConflictResolution.REJECT:
                            rec.status = RecordStatus.ABNORMAL
                            rec.notes = f"冲突已驳回: {conflict.description}"
                break

        return session

    def step3_update_summary(
        self,
        session_id: str,
        summary: str,
        reviewer: Optional[str] = None,
    ) -> CheckSession:
        session = self.get_session(session_id)
        if session is None:
            raise ValueError(f"会话{session_id}不存在")

        pending_conflicts = [
            c for c in session.conflicts
            if c.resolution == ConflictResolution.PENDING
        ]
        if pending_conflicts:
            raise ValueError(
                f"还有{len(pending_conflicts)}个冲突未解决，请先处理冲突"
            )

        pending_review = [
            r for r in session.bucket_records + session.negative_records
            if r.status == RecordStatus.PENDING_REVIEW
        ]
        if pending_review and not reviewer:
            raise ValueError(
                f"还有{len(pending_review)}条记录待推荐负责人复核"
            )

        session.current_step = CheckStep.STEP3_UPDATE_SUMMARY
        session.summary = summary
        session.reviewer = reviewer

        if reviewer:
            for r in session.bucket_records + session.negative_records:
                if r.status == RecordStatus.PENDING_REVIEW:
                    r.status = RecordStatus.FEATURE_MISSING_DEFAULT
                    r.notes = f"{r.notes}。推荐负责人{reviewer}已复核"

        session.is_locked = True

        return session

    def resupplement_and_recalculate(
        self,
        session_id: str,
        updated_records: List[FeatureRecord],
    ) -> CheckSession:
        session = self.get_session(session_id)
        if session is None:
            raise ValueError(f"会话{session_id}不存在")

        session.is_locked = False

        for updated in updated_records:
            for i, orig in enumerate(session.bucket_records):
                if orig.sample_id == updated.sample_id and orig.feature_id == updated.feature_id:
                    session.bucket_records[i] = updated
                    break
            for i, orig in enumerate(session.negative_records):
                if orig.sample_id == updated.sample_id and orig.feature_id == updated.feature_id:
                    session.negative_records[i] = updated
                    break

        processed_bucket, processed_negative, conflicts = process_all_records(
            session.bucket_records, session.negative_records, session.parameters
        )
        session.bucket_records = processed_bucket
        session.negative_records = processed_negative
        session.conflicts = conflicts

        session.self_check_results = run_all_self_checks(
            session.bucket_records, session.negative_records
        )

        for r in session.bucket_records:
            if r.status == RecordStatus.FEATURE_MISSING_DEFAULT:
                r.status = RecordStatus.PENDING_REVIEW
        for r in session.negative_records:
            if r.status == RecordStatus.FEATURE_MISSING_DEFAULT:
                r.status = RecordStatus.PENDING_REVIEW

        return session


workflow_manager = WorkflowManager()
