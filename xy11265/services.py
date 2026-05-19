
import json
import hashlib
import uuid
import csv
from io import StringIO
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from models import (
    BatchImport, Transcript, Utterance, QualityRule, ScanResult,
    ScanBatch, ExportRecord, AuditLog,
    ImportStatus, ScanStatus, ReviewResult, RuleAction
)
from rule_engine import RuleEngine, RuleMatch, create_default_rules


class BatchResult:
    def __init__(self):
        self.success_ids = []
        self.failed = []
        self.errors = []

    def add_success(self, transcript_id: str, **kwargs):
        self.success_ids.append({"transcript_id": transcript_id, **kwargs})

    def add_failed(self, index: int, reason: str, **kwargs):
        self.failed.append({"index": index, "reason": reason, **kwargs})

    def add_error(self, error: str):
        self.errors.append(error)


class ImportService:
    def __init__(self, db_session: Session):
        self.session = db_session

    def _generate_batch_no(self) -> str:
        return f"IMP{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6]}"

    def _compute_file_hash(self, content: str) -> str:
        return hashlib.md5(content.encode()).hexdigest()

    def import_transcripts(
        self,
        file_name: str,
        transcripts_data: List[Dict[str, Any]],
        created_by: Optional[str] = None,
        skip_duplicates: bool = True
    ) -> Tuple[BatchImport, BatchResult]:
        file_content = json.dumps(transcripts_data, ensure_ascii=False)
        file_hash = self._compute_file_hash(file_content)

        existing_batch = self.session.query(BatchImport).filter_by(file_hash=file_hash).first()
        if existing_batch and skip_duplicates:
            result = BatchResult()
            result.add_error(f"文件已存在，批次号: {existing_batch.batch_no}")
            return existing_batch, result

        batch_no = self._generate_batch_no()
        batch_import = BatchImport(
            batch_no=batch_no,
            file_name=file_name,
            file_hash=file_hash,
            total_records=len(transcripts_data),
            status=ImportStatus.PROCESSING.value,
            created_by=created_by
        )
        self.session.add(batch_import)
        self.session.flush()

        result = BatchResult()

        for idx, data in enumerate(transcripts_data):
            try:
                transcript_id = data.get("transcript_id") or f"{batch_no}_{idx}"
                existing = self.session.query(Transcript).filter_by(transcript_id=transcript_id).first()

                if existing:
                    if skip_duplicates:
                        result.add_success(transcript_id, skipped=True, reason="已存在")
                        continue
                    else:
                        self.session.query(ScanResult).filter_by(transcript_id=existing.id).delete()
                        self.session.query(Utterance).filter_by(transcript_id=existing.id).delete()
                        self.session.delete(existing)
                        self.session.flush()

                transcript = Transcript(
                    transcript_id=transcript_id,
                    batch_import_id=batch_import.id,
                    session_id=data.get("session_id", transcript_id),
                    agent_id=data.get("agent_id"),
                    customer_id=data.get("customer_id"),
                    raw_content=json.dumps(data, ensure_ascii=False),
                    extra_data=data.get("extra_data", {})
                )

                if data.get("start_time"):
                    transcript.start_time = datetime.fromisoformat(data["start_time"])
                if data.get("end_time"):
                    transcript.end_time = datetime.fromisoformat(data["end_time"])

                self.session.add(transcript)
                self.session.flush()

                utterances_data = data.get("utterances", [])
                for utt_idx, utt_data in enumerate(utterances_data):
                    utterance = Utterance(
                        transcript_id=transcript.id,
                        utterance_index=utt_data.get("index", utt_idx),
                        speaker=utt_data.get("speaker"),
                        speaker_role=utt_data.get("speaker_role"),
                        start_time=utt_data.get("start_time"),
                        end_time=utt_data.get("end_time"),
                        text=utt_data.get("text", "")
                    )
                    self.session.add(utterance)

                result.add_success(transcript_id)

            except Exception as e:
                self.session.rollback()
                result.add_failed(idx, str(e))

        batch_import.success_count = len(result.success_ids)
        batch_import.failed_count = len(result.failed)

        if batch_import.failed_count > 0 and batch_import.success_count > 0:
            batch_import.status = ImportStatus.PARTIAL.value
        elif batch_import.failed_count > 0:
            batch_import.status = ImportStatus.FAILED.value
        else:
            batch_import.status = ImportStatus.SUCCESS.value

        self._log_audit("import_batch", "BatchImport", batch_no,
                        {"status": batch_import.status,
                         "success_count": batch_import.success_count,
                         "failed_count": batch_import.failed_count},
                        created_by)

        self.session.commit()
        return batch_import, result

    def _log_audit(
        self,
        action: str,
        resource_type: str,
        resource_id: str,
        new_value: Optional[Dict] = None,
        old_value: Optional[Dict] = None,
        operator: Optional[str] = None
    ):
        log = AuditLog(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            old_value=old_value,
            new_value=new_value,
            operator=operator
        )
        self.session.add(log)


class ScanService:
    def __init__(self, db_session: Session):
        self.session = db_session
        self.rule_engine = RuleEngine()
        self._load_rules()

    def _load_rules(self):
        rules = self.session.query(QualityRule).all()
        self.rule_engine.load_rules(rules)

    def _generate_scan_batch_no(self) -> str:
        return f"SCAN{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6]}"

    def scan_transcript(
        self,
        transcript_id: str,
        force_rescan: bool = False
    ) -> Tuple[Optional[Transcript], List[ScanResult]]:
        transcript = self.session.query(Transcript).filter_by(transcript_id=transcript_id).first()
        if not transcript:
            return None, []

        if transcript.is_scanned and not force_rescan:
            results = self.session.query(ScanResult).filter_by(transcript_id=transcript.id).all()
            return transcript, results

        utterances = self.session.query(Utterance).filter_by(transcript_id=transcript.id).all()
        self.session.query(ScanResult).filter_by(transcript_id=transcript.id).delete()

        matches = self.rule_engine.scan_transcript(transcript, utterances)
        scan_results = []

        rule_map = {r.rule_code: r for r in self.session.query(QualityRule).all()}

        for match in matches:
            rule = rule_map.get(match.rule_code)
            if not rule:
                continue

            scan_result = ScanResult(
                transcript_id=transcript.id,
                rule_id=rule.id,
                utterance_id=match.utterance_id,
                rule_code=match.rule_code,
                rule_type=match.rule_type,
                rule_version=rule.version,
                action=match.action,
                matched_text=match.matched_text,
                reason=match.reason,
                severity=match.severity,
                position_start=match.position_start,
                position_end=match.position_end
            )
            self.session.add(scan_result)
            scan_results.append(scan_result)

        transcript.is_scanned = True
        transcript.scan_status = ScanStatus.COMPLETED.value
        transcript.scanned_at = datetime.now()
        transcript.has_issues = len([r for r in scan_results if r.action == RuleAction.BLOCK.value]) > 0
        transcript.issue_count = len(scan_results)
        transcript.rule_version = self.rule_engine.get_rules_version()

        self.session.commit()
        return transcript, scan_results

    def scan_batch(
        self,
        transcript_ids: Optional[List[str]] = None,
        batch_size: int = 100,
        created_by: Optional[str] = None,
        force_rescan: bool = False
    ) -> Tuple[ScanBatch, BatchResult]:
        batch_no = self._generate_scan_batch_no()

        if transcript_ids is None:
            query = self.session.query(Transcript)
            if not force_rescan:
                query = query.filter(or_(
                    Transcript.is_scanned == False,
                    Transcript.rule_version != self.rule_engine.get_rules_version()
                ))
            transcript_ids = [t.transcript_id for t in query.all()]

        scan_batch = ScanBatch(
            batch_no=batch_no,
            total_transcripts=len(transcript_ids),
            rule_version=self.rule_engine.get_rules_version(),
            status=ScanStatus.SCANNING.value,
            started_at=datetime.now(),
            created_by=created_by
        )
        self.session.add(scan_batch)
        self.session.commit()

        result = BatchResult()
        error_details = []

        for transcript_id in transcript_ids:
            try:
                transcript, scan_results = self.scan_transcript(transcript_id, force_rescan)
                if transcript:
                    result.add_success(transcript_id, issue_count=len(scan_results))
                else:
                    result.add_failed(0, "Transcript not found", transcript_id=transcript_id)
            except Exception as e:
                self.session.rollback()
                error_msg = f"{transcript_id}: {str(e)}"
                error_details.append(error_msg)
                result.add_failed(0, str(e), transcript_id=transcript_id)

        scan_batch.success_count = len(result.success_ids)
        scan_batch.failed_count = len(result.failed)
        scan_batch.completed_at = datetime.now()
        scan_batch.status = ScanStatus.COMPLETED.value if scan_batch.failed_count == 0 else ScanStatus.FAILED.value
        scan_batch.error_details = error_details

        self.session.commit()
        return scan_batch, result

    def rescan_with_new_rules(
        self,
        transcript_ids: Optional[List[str]] = None,
        created_by: Optional[str] = None
    ) -> Tuple[ScanBatch, BatchResult]:
        self._load_rules()
        return self.scan_batch(transcript_ids, created_by=created_by, force_rescan=True)


class ReviewService:
    def __init__(self, db_session: Session):
        self.session = db_session

    def get_issue_review(
        self,
        scan_result_id: int,
        is_resolved: bool,
        resolved_by: str,
        comment: Optional[str] = None
    ) -> Optional[ScanResult]:
        scan_result = self.session.query(ScanResult).filter_by(id=scan_result_id).first()
        if not scan_result:
            return None

        old_value = {
            "is_resolved": scan_result.is_resolved,
            "resolved_by": scan_result.resolved_by,
            "resolved_at": scan_result.resolved_at.isoformat() if scan_result.resolved_at else None
        }

        scan_result.is_resolved = is_resolved
        scan_result.resolved_by = resolved_by
        scan_result.resolved_at = datetime.now()

        self._log_audit(
            "review_issue",
            "ScanResult",
            str(scan_result_id),
            old_value=old_value,
            new_value={
                "is_resolved": is_resolved,
                "resolved_by": resolved_by,
                "comment": comment
            },
            operator=resolved_by
        )

        self.session.commit()
        return scan_result

    def review_transcript(
        self,
        transcript_id: str,
        review_result: str,
        reviewed_by: str,
        comment: Optional[str] = None
    ) -> Optional[Transcript]:
        transcript = self.session.query(Transcript).filter_by(transcript_id=transcript_id).first()
        if not transcript:
            return None

        old_value = {
            "review_status": transcript.review_status,
            "reviewed_by": transcript.reviewed_by,
            "reviewed_at": transcript.reviewed_at.isoformat() if transcript.reviewed_at else None
        }

        transcript.review_status = review_result
        transcript.reviewed_by = reviewed_by
        transcript.reviewed_at = datetime.now()
        transcript.review_comment = comment

        self._log_audit(
            "review_transcript",
            "Transcript",
            transcript_id,
            old_value=old_value,
            new_value={
                "review_status": review_result,
                "reviewed_by": reviewed_by,
                "comment": comment
            },
            operator=reviewed_by
        )

        self.session.commit()
        return transcript

    def batch_review(
        self,
        transcript_ids: List[str],
        review_result: str,
        reviewed_by: str
    ) -> BatchResult:
        result = BatchResult()

        for transcript_id in transcript_ids:
            try:
                transcript = self.review_transcript(transcript_id, review_result, reviewed_by)
                if transcript:
                    result.add_success(transcript_id)
                else:
                    result.add_failed(0, "Transcript not found", transcript_id=transcript_id)
            except Exception as e:
                self.session.rollback()
                result.add_failed(0, str(e), transcript_id=transcript_id)

        return result

    def _log_audit(
        self,
        action: str,
        resource_type: str,
        resource_id: str,
        new_value: Optional[Dict] = None,
        old_value: Optional[Dict] = None,
        operator: Optional[str] = None
    ):
        log = AuditLog(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            old_value=old_value,
            new_value=new_value,
            operator=operator
        )
        self.session.add(log)


class SummaryService:
    def __init__(self, db_session: Session):
        self.session = db_session

    def get_transcript_summary(
        self,
        transcript_id: str
    ) -> Optional[Dict[str, Any]]:
        transcript = self.session.query(Transcript).filter_by(transcript_id=transcript_id).first()
        if not transcript:
            return None

        scan_results = self.session.query(ScanResult).filter_by(transcript_id=transcript.id).all()
        utterances = self.session.query(Utterance).filter_by(transcript_id=transcript.id).all()

        block_count = len([r for r in scan_results if r.action == RuleAction.BLOCK.value])
        warn_count = len([r for r in scan_results if r.action == RuleAction.WARN.value])
        pass_count = len([r for r in scan_results if r.action == RuleAction.PASS.value])
        resolved_count = len([r for r in scan_results if r.is_resolved])

        issues_by_rule = {}
        for r in scan_results:
            if r.rule_code not in issues_by_rule:
                issues_by_rule[r.rule_code] = {"count": 0, "name": r.rule_type}
            issues_by_rule[r.rule_code]["count"] += 1

        return {
            "transcript_id": transcript.transcript_id,
            "session_id": transcript.session_id,
            "agent_id": transcript.agent_id,
            "is_scanned": transcript.is_scanned,
            "has_issues": transcript.has_issues,
            "issue_count": transcript.issue_count,
            "review_status": transcript.review_status,
            "reviewed_by": transcript.reviewed_by,
            "utterance_count": len(utterances),
            "block_count": block_count,
            "warn_count": warn_count,
            "pass_count": pass_count,
            "resolved_count": resolved_count,
            "issues_by_rule": issues_by_rule,
            "created_at": transcript.created_at.isoformat()
        }

    def get_batch_summary(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        agent_id: Optional[str] = None
    ) -> Dict[str, Any]:
        query = self.session.query(Transcript)

        if start_date:
            query = query.filter(Transcript.created_at >= start_date)
        if end_date:
            query = query.filter(Transcript.created_at <= end_date)
        if agent_id:
            query = query.filter(Transcript.agent_id == agent_id)

        transcripts = query.all()

        total_count = len(transcripts)
        scanned_count = len([t for t in transcripts if t.is_scanned])
        with_issues_count = len([t for t in transcripts if t.has_issues])
        reviewed_count = len([t for t in transcripts if t.review_status != ReviewResult.PENDING.value])

        confirmed_count = len([t for t in transcripts if t.review_status == ReviewResult.CONFIRMED.value])
        rejected_count = len([t for t in transcripts if t.review_status == ReviewResult.REJECTED.value])

        total_issues = self.session.query(ScanResult)\
            .join(Transcript)\
            .filter(Transcript.id.in_([t.id for t in transcripts])\
            ).count()

        issues_by_type = {}
        issue_query = self.session.query(ScanResult.rule_type, ScanResult.action)\
            .join(Transcript)\
            .filter(Transcript.id.in_([t.id for t in transcripts])\
            ).all()

        for rule_type, action in issue_query:
            if rule_type not in issues_by_type:
                issues_by_type[rule_type] = {"total": 0, "block": 0, "warn": 0, "pass": 0}
            issues_by_type[rule_type]["total"] += 1
            if action in issues_by_type[rule_type]:
                issues_by_type[rule_type][action] += 1

        return {
            "total_transcripts": total_count,
            "scanned_count": scanned_count,
            "with_issues_count": with_issues_count,
            "issues_rate": with_issues_count / total_count if total_count > 0 else 0,
            "reviewed_count": reviewed_count,
            "review_rate": reviewed_count / total_count if total_count > 0 else 0,
            "confirmed_count": confirmed_count,
            "rejected_count": rejected_count,
            "total_issues": total_issues,
            "issues_by_type": issues_by_type,
            "period": {
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None
            }
        }


class ExportService:
    def __init__(self, db_session: Session):
        self.session = db_session

    def _generate_export_no(self) -> str:
        return f"EXP{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6]}"

    def export_to_csv(
        self,
        filters: Optional[Dict[str, Any]] = None,
        created_by: Optional[str] = None
    ) -> Tuple[str, str]:
        filters = filters or {}

        export_no = self._generate_export_no()

        query = self.session.query(Transcript)

        if filters.get("has_issues") is not None:
            query = query.filter(Transcript.has_issues == filters["has_issues"])

        if filters.get("review_status"):
            query = query.filter(Transcript.review_status == filters["review_status"])

        if filters.get("agent_id"):
            query = query.filter(Transcript.agent_id == filters["agent_id"])

        transcripts = query.all()

        output = StringIO()
        writer = csv.writer(output)

        writer.writerow([
            "transcript_id", "session_id", "agent_id", "is_scanned",
            "has_issues", "issue_count", "review_status", "reviewed_by",
            "review_comment", "created_at", "issues_details"
        ])

        for t in transcripts:
            scan_results = self.session.query(ScanResult).filter_by(transcript_id=t.id).all()
            issues_details = "; ".join([
                f"{r.rule_code}:{r.reason}" for r in scan_results
            ])

            writer.writerow([
                t.transcript_id,
                t.session_id,
                t.agent_id or "",
                t.is_scanned,
                t.has_issues,
                t.issue_count,
                t.review_status,
                t.reviewed_by or "",
                t.review_comment or "",
                t.created_at.isoformat(),
                issues_details
            ])

        csv_content = output.getvalue()

        export_record = ExportRecord(
            export_no=export_no,
            export_type="csv",
            filters=filters,
            total_records=len(transcripts),
            status="completed",
            created_by=created_by
        )
        self.session.add(export_record)
        self.session.commit()

        return export_no, csv_content

    def export_issues_to_json(
        self,
        transcript_id: Optional[str] = None,
        created_by: Optional[str] = None
    ) -> Tuple[str, List[Dict[str, Any]]]:
        export_no = self._generate_export_no()

        query = self.session.query(ScanResult).join(Transcript)

        if transcript_id:
            query = query.filter(Transcript.transcript_id == transcript_id)

        scan_results = query.all()

        issues_data = []
        for r in scan_results:
            issues_data.append({
                "id": r.id,
                "transcript_id": r.transcript.transcript_id,
                "rule_code": r.rule_code,
                "rule_type": r.rule_type,
                "action": r.action,
                "reason": r.reason,
                "matched_text": r.matched_text,
                "severity": r.severity,
                "is_resolved": r.is_resolved,
                "resolved_by": r.resolved_by,
                "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
                "created_at": r.created_at.isoformat()
            })

        export_record = ExportRecord(
            export_no=export_no,
            export_type="issues_json",
            filters={"transcript_id": transcript_id},
            total_records=len(issues_data),
            status="completed",
            created_by=created_by
        )
        self.session.add(export_record)
        self.session.commit()

        return export_no, issues_data


class QualityCheckSystem:
    def __init__(self, db_session: Session):
        self.session = db_session
        self.import_service = ImportService(db_session)
        self.scan_service = ScanService(db_session)
        self.review_service = ReviewService(db_session)
        self.summary_service = SummaryService(db_session)
        self.export_service = ExportService(db_session)

        create_default_rules(db_session)

    def get_transcript_with_details(self, transcript_id: str) -> Optional[Dict[str, Any]]:
        transcript = self.session.query(Transcript).filter_by(transcript_id=transcript_id).first()
        if not transcript:
            return None

        utterances = self.session.query(Utterance).filter_by(transcript_id=transcript.id).order_by(Utterance.utterance_index).all()
        scan_results = self.session.query(ScanResult).filter_by(transcript_id=transcript.id).all()

        return {
            "transcript": {
                "transcript_id": transcript.transcript_id,
                "session_id": transcript.session_id,
                "agent_id": transcript.agent_id,
                "is_scanned": transcript.is_scanned,
                "has_issues": transcript.has_issues,
                "issue_count": transcript.issue_count,
                "review_status": transcript.review_status,
                "reviewed_by": transcript.reviewed_by,
                "review_comment": transcript.review_comment,
                "created_at": transcript.created_at.isoformat()
            },
            "utterances": [
                {
                    "index": u.utterance_index,
                    "speaker": u.speaker,
                    "speaker_role": u.speaker_role,
                    "start_time": u.start_time,
                    "end_time": u.end_time,
                    "text": u.text
                }
                for u in utterances
            ],
            "issues": [
                {
                    "id": r.id,
                    "rule_code": r.rule_code,
                    "rule_type": r.rule_type,
                    "action": r.action,
                    "reason": r.reason,
                    "matched_text": r.matched_text,
                    "severity": r.severity,
                    "is_resolved": r.is_resolved
                }
                for r in scan_results
            ]
        }
