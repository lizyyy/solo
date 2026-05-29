from datetime import datetime
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session

from ..models.database import (
    DiagnosisRecord, QueueMetrics, ConsumerLog, EdgeCaseDetection,
    DiagnosisReport
)
from ..models.enums import DiagnosisStatus, BacklogCause, AlertLevel
from ..models.schemas import (
    DiagnosisRecordCreate, QueueMetricsCreate, ConsumerLogCreate,
    DiagnosisRecordUpdate, BacklogAttribution, ProcessingSuggestion,
    ExplainableScore, DiagnosisWithExplanation, BatchDiagnosisRequest
)
from .metric_alignment import MetricAlignmentService
from .backlog_attribution import BacklogAttributionService
from .alert_stratification import AlertStratificationService
from .edge_case_detector import EdgeCaseDetectionService
from .suggestion_engine import SuggestionService
from .report_exporter import ReportExportService


class DiagnosisOrchestrationService:

    @staticmethod
    def create_diagnosis(
        db: Session,
        request: DiagnosisRecordCreate
    ) -> DiagnosisRecord:
        record = DiagnosisRecord(
            queue_name=request.queue_name,
            status=DiagnosisStatus.ENTRY,
            manual_review_notes=request.manual_review_notes,
            manual_reviewer=request.manual_reviewer
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def add_metrics(
        db: Session,
        diagnosis_id: int,
        metrics: List[QueueMetricsCreate]
    ) -> List[QueueMetrics]:
        record = db.query(DiagnosisRecord).filter(
            DiagnosisRecord.id == diagnosis_id
        ).first()
        if not record:
            raise ValueError(f"Diagnosis record {diagnosis_id} not found")

        created_metrics = []
        for m in metrics:
            metric = QueueMetrics(
                diagnosis_id=diagnosis_id,
                queue_name=m.queue_name,
                timestamp=m.timestamp,
                backlog_count=m.backlog_count,
                backlog_growth_rate=m.backlog_growth_rate,
                production_rate=m.production_rate,
                production_rate_avg_1h=m.production_rate_avg_1h,
                production_rate_avg_24h=m.production_rate_avg_24h,
                consumption_rate=m.consumption_rate,
                consumption_rate_avg_1h=m.consumption_rate_avg_1h,
                consumption_rate_avg_24h=m.consumption_rate_avg_24h,
                dead_letter_count=m.dead_letter_count,
                dead_letter_increment=m.dead_letter_increment,
                consumer_count=m.consumer_count,
                active_consumer_count=m.active_consumer_count,
                time_window_start=m.time_window_start,
                time_window_end=m.time_window_end,
                raw_data=m.raw_data
            )
            db.add(metric)
            created_metrics.append(metric)

        db.commit()
        for m in created_metrics:
            db.refresh(m)

        return created_metrics

    @staticmethod
    def add_consumer_logs(
        db: Session,
        diagnosis_id: int,
        logs: List[ConsumerLogCreate]
    ) -> List[ConsumerLog]:
        record = db.query(DiagnosisRecord).filter(
            DiagnosisRecord.id == diagnosis_id
        ).first()
        if not record:
            raise ValueError(f"Diagnosis record {diagnosis_id} not found")

        created_logs = []
        for log in logs:
            consumer_log = ConsumerLog(
                diagnosis_id=diagnosis_id,
                consumer_id=log.consumer_id,
                timestamp=log.timestamp,
                log_level=log.log_level,
                message=log.message,
                is_heartbeat=log.is_heartbeat,
                is_error=log.is_error,
                last_seen_offset=log.last_seen_offset
            )
            db.add(consumer_log)
            created_logs.append(consumer_log)

        db.commit()
        for log in created_logs:
            db.refresh(log)

        return created_logs

    @staticmethod
    def process_diagnosis(
        db: Session,
        diagnosis_id: int,
        expected_interval: int = 60
    ) -> DiagnosisRecord:
        record = db.query(DiagnosisRecord).filter(
            DiagnosisRecord.id == diagnosis_id
        ).first()
        if not record:
            raise ValueError(f"Diagnosis record {diagnosis_id} not found")

        metrics = sorted(record.metrics, key=lambda m: m.timestamp)
        consumer_logs = sorted(record.consumer_logs, key=lambda l: l.timestamp)

        if not metrics:
            raise ValueError(f"No metrics found for diagnosis {diagnosis_id}")

        record.status = DiagnosisStatus.PROCESSING
        db.commit()

        edge_cases, edge_case_scores = EdgeCaseDetectionService.detect_all_edge_cases(
            metrics, consumer_logs, expected_interval
        )

        for ec in edge_cases:
            ec.diagnosis_id = diagnosis_id
            db.add(ec)

        attribution, attribution_scores = BacklogAttributionService.attribute_backlog(
            metrics, consumer_logs
        )

        alert_level, overall_score, alert_scores, score_explanation = (
            AlertStratificationService.stratify_alert(
                metrics, consumer_logs, attribution
            )
        )

        suggestions = SuggestionService.generate_suggestions(
            attribution, alert_level, edge_cases, metrics
        )

        record.primary_cause = attribution.primary_cause
        record.alert_level = alert_level
        record.overall_score = overall_score
        record.score_explanation = score_explanation
        record.backlog_attribution = attribution.model_dump()
        record.processing_suggestions = [s.model_dump() for s in suggestions]
        record.status = DiagnosisStatus.REVIEW

        db.commit()
        db.refresh(record)

        return record

    @staticmethod
    def get_explainable_diagnosis(
        db: Session,
        diagnosis_id: int
    ) -> DiagnosisWithExplanation:
        record = db.query(DiagnosisRecord).filter(
            DiagnosisRecord.id == diagnosis_id
        ).first()
        if not record:
            raise ValueError(f"Diagnosis record {diagnosis_id} not found")

        metrics = sorted(record.metrics, key=lambda m: m.timestamp)
        consumer_logs = sorted(record.consumer_logs, key=lambda l: l.timestamp)

        attribution = None
        if record.backlog_attribution:
            attribution = BacklogAttribution(**record.backlog_attribution)

        suggestions = []
        if record.processing_suggestions:
            suggestions = [ProcessingSuggestion(**s) for s in record.processing_suggestions]

        _, edge_case_scores = EdgeCaseDetectionService.detect_all_edge_cases(
            metrics, consumer_logs
        )

        attribution_scores = []
        if attribution:
            _, attribution_scores = BacklogAttributionService.attribute_backlog(
                metrics, consumer_logs
            )

        alert_scores = []
        score_explanation = ""
        if attribution and metrics:
            _, _, alert_scores, score_explanation = (
                AlertStratificationService.stratify_alert(
                    metrics, consumer_logs, attribution
                )
            )

        all_scores = edge_case_scores + attribution_scores + alert_scores

        human_summary = ReportExportService.generate_human_readable_summary(
            record,
            attribution,
            record.edge_cases,
            suggestions
        )

        return DiagnosisWithExplanation(
            id=record.id,
            queue_name=record.queue_name,
            status=record.status,
            primary_cause=record.primary_cause,
            alert_level=record.alert_level,
            overall_score=record.overall_score,
            score_explanation=record.score_explanation,
            backlog_attribution=attribution,
            processing_suggestions=suggestions,
            manual_review_notes=record.manual_review_notes,
            manual_reviewer=record.manual_reviewer,
            manual_reviewed_at=record.manual_reviewed_at,
            manual_correction_applied=record.manual_correction_applied,
            created_at=record.created_at,
            updated_at=record.updated_at,
            exported_at=record.exported_at,
            metrics=record.metrics,
            consumer_logs=record.consumer_logs,
            edge_cases=record.edge_cases,
            score_breakdown=all_scores,
            human_readable_summary=human_summary
        )

    @staticmethod
    def get_metric_explanation(
        db: Session,
        diagnosis_id: int,
        metric_name: str
    ) -> Optional[ExplainableScore]:
        diagnosis = DiagnosisOrchestrationService.get_explainable_diagnosis(
            db, diagnosis_id
        )

        for score in diagnosis.score_breakdown:
            if score.metric_name == metric_name:
                return score

        return None

    @staticmethod
    def update_manual_review(
        db: Session,
        diagnosis_id: int,
        update: DiagnosisRecordUpdate
    ) -> DiagnosisRecord:
        record = db.query(DiagnosisRecord).filter(
            DiagnosisRecord.id == diagnosis_id
        ).first()
        if not record:
            raise ValueError(f"Diagnosis record {diagnosis_id} not found")

        if update.status is not None:
            record.status = update.status
        if update.manual_review_notes is not None:
            record.manual_review_notes = update.manual_review_notes
        if update.manual_reviewer is not None:
            record.manual_reviewer = update.manual_reviewer
        if update.manual_correction_applied is not None:
            record.manual_correction_applied = update.manual_correction_applied

        record.manual_reviewed_at = datetime.utcnow()
        db.commit()
        db.refresh(record)

        return record

    @staticmethod
    def export_diagnosis(
        db: Session,
        diagnosis_id: int,
        export_format: str = "excel",
        include_raw_data: bool = False
    ) -> dict:
        record = db.query(DiagnosisRecord).filter(
            DiagnosisRecord.id == diagnosis_id
        ).first()
        if not record:
            raise ValueError(f"Diagnosis record {diagnosis_id} not found")

        diagnosis = DiagnosisOrchestrationService.get_explainable_diagnosis(
            db, diagnosis_id
        )

        export_result = ReportExportService.export_report(
            record,
            diagnosis.score_breakdown,
            export_format,
            include_raw_data
        )

        report = DiagnosisReport(
            diagnosis_id=diagnosis_id,
            report_format=export_format,
            report_content=export_result.get("content"),
            file_path=export_result.get("file_path"),
            generated_at=datetime.utcnow()
        )
        db.add(report)

        record.status = DiagnosisStatus.EXPORTED
        record.exported_at = datetime.utcnow()
        db.commit()

        return export_result

    @staticmethod
    def list_diagnoses(
        db: Session,
        queue_name: Optional[str] = None,
        status: Optional[DiagnosisStatus] = None,
        skip: int = 0,
        limit: int = 100
    ) -> Tuple[List[DiagnosisRecord], int]:
        query = db.query(DiagnosisRecord)

        if queue_name:
            query = query.filter(DiagnosisRecord.queue_name == queue_name)
        if status:
            query = query.filter(DiagnosisRecord.status == status)

        total = query.count()
        records = query.order_by(DiagnosisRecord.created_at.desc()).offset(skip).limit(limit).all()

        return records, total

    @staticmethod
    def batch_diagnosis(
        db: Session,
        request: BatchDiagnosisRequest
    ) -> DiagnosisRecord:
        record = DiagnosisOrchestrationService.create_diagnosis(
            db,
            DiagnosisRecordCreate(queue_name=request.queue_name)
        )

        DiagnosisOrchestrationService.add_metrics(
            db, record.id, request.metrics
        )

        if request.consumer_logs:
            DiagnosisOrchestrationService.add_consumer_logs(
                db, record.id, request.consumer_logs
            )

        return DiagnosisOrchestrationService.process_diagnosis(
            db, record.id
        )
