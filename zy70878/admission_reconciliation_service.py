import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
from models import (
    Supervisor, Student, ApplicationChoice, AdjustmentRecord,
    ReconciliationSession, AdmissionStatus, AdjustmentType
)
from data_importer import DataImporter
from reconciliation_engine import ReconciliationEngine
from review_manager import ReviewManager
from report_generator import ReportGenerator


class AdmissionReconciliationService:
    def __init__(self):
        self.sessions: Dict[str, ReconciliationSession] = {}
        self.engines: Dict[str, ReconciliationEngine] = {}
        self.review_managers: Dict[str, ReviewManager] = {}
        self.report_generators: Dict[str, ReportGenerator] = {}

    def create_session(self, name: str, created_by: str) -> str:
        session_id = str(uuid.uuid4())
        session = ReconciliationSession(
            id=session_id,
            name=name,
            created_at=datetime.now(),
            created_by=created_by
        )
        self.sessions[session_id] = session
        self._init_session_components(session_id)
        return session_id

    def _init_session_components(self, session_id: str) -> None:
        session = self.sessions[session_id]
        self.engines[session_id] = ReconciliationEngine(session)
        self.review_managers[session_id] = ReviewManager(
            session, self.engines[session_id]
        )
        self.report_generators[session_id] = ReportGenerator(session)

    def get_session(self, session_id: str) -> Optional[ReconciliationSession]:
        return self.sessions.get(session_id)

    def import_supervisors(self, session_id: str, file_path: str) -> int:
        session = self.sessions.get(session_id)
        if not session:
            return 0
        supervisors = DataImporter.import_supervisors_from_csv(file_path)
        session.supervisors.update(supervisors)
        return len(supervisors)

    def import_students(self, session_id: str, file_path: str) -> int:
        session = self.sessions.get(session_id)
        if not session:
            return 0
        students = DataImporter.import_students_from_csv(file_path)
        session.students.update(students)
        return len(students)

    def import_choices(self, session_id: str, file_path: str) -> int:
        session = self.sessions.get(session_id)
        if not session:
            return 0
        choices = DataImporter.import_choices_from_json(file_path)
        session.choices.extend(choices)
        return len(choices)

    def import_adjustments(self, session_id: str, file_path: str, is_csv: bool = False) -> int:
        session = self.sessions.get(session_id)
        if not session:
            return 0
        if is_csv:
            adjustments = DataImporter.import_adjustments_from_csv(file_path)
        else:
            adjustments = DataImporter.import_adjustments_from_json(file_path)
        session.adjustments.extend(adjustments)
        return len(adjustments)

    def run_reconciliation(self, session_id: str) -> bool:
        engine = self.engines.get(session_id)
        if not engine:
            return False
        engine.run_reconciliation()
        return True

    def review_item(
        self,
        session_id: str,
        item_id: str,
        reviewer: str,
        new_status: AdmissionStatus,
        comment: str
    ) -> Optional[Dict[str, Any]]:
        review_manager = self.review_managers.get(session_id)
        if not review_manager:
            return None
        
        record = review_manager.review_item(item_id, reviewer, new_status, comment)
        if record:
            return {
                'review_id': record.id,
                'item_id': record.reconciliation_id,
                'reviewer': record.reviewer,
                'original_status': record.original_status.value,
                'new_status': record.new_status.value,
                'comment': record.comment
            }
        return None

    def batch_review(
        self,
        session_id: str,
        item_ids: List[str],
        reviewer: str,
        new_status: AdmissionStatus,
        comment: str
    ) -> Dict[str, Any]:
        review_manager = self.review_managers.get(session_id)
        if not review_manager:
            return {'success_count': 0, 'failed_ids': item_ids}
        
        return review_manager.batch_review(item_ids, reviewer, new_status, comment)

    def get_summary(self, session_id: str) -> Optional[Dict[str, Any]]:
        generator = self.report_generators.get(session_id)
        if not generator:
            return None
        return generator.generate_summary_report()

    def get_detailed_records(self, session_id: str) -> Optional[List[Dict[str, Any]]]:
        generator = self.report_generators.get(session_id)
        if not generator:
            return None
        return generator.generate_detailed_report()

    def get_item_explanation(self, session_id: str, item_id: str) -> Optional[Dict[str, Any]]:
        review_manager = self.review_managers.get(session_id)
        if not review_manager:
            return None
        return review_manager.explain_decision(item_id)

    def get_student_trace(self, session_id: str, student_id: str) -> Optional[Dict[str, Any]]:
        review_manager = self.review_managers.get(session_id)
        if not review_manager:
            return None
        return review_manager.get_student_trace(student_id)

    def export_reports(self, session_id: str, output_dir: str) -> Dict[str, str]:
        generator = self.report_generators.get(session_id)
        if not generator:
            return {}

        session = self.sessions[session_id]
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        files = {}
        
        summary_file = f"{output_dir}/summary_{session.name}_{timestamp}.json"
        generator.export_summary_to_json(summary_file)
        files['summary'] = summary_file

        detailed_file = f"{output_dir}/detailed_{session.name}_{timestamp}.csv"
        generator.export_detailed_to_csv(detailed_file)
        files['detailed'] = detailed_file

        conflict_file = f"{output_dir}/conflicts_{session.name}_{timestamp}.csv"
        generator.export_conflict_to_csv(conflict_file)
        files['conflicts'] = conflict_file

        return files

    def get_items_by_status(
        self,
        session_id: str,
        status: AdmissionStatus
    ) -> List[Dict[str, Any]]:
        review_manager = self.review_managers.get(session_id)
        if not review_manager:
            return []
        
        items = review_manager.get_items_by_status(status)
        return [
            {
                'id': item.id,
                'student_name': item.student_name,
                'supervisor_name': item.supervisor_name,
                'application_type': item.application_type.value,
                'conflict_count': len(item.conflicts)
            }
            for item in items
        ]

    def lock_session(self, session_id: str) -> bool:
        session = self.sessions.get(session_id)
        if not session:
            return False
        session.is_locked = True
        return True

    def unlock_session(self, session_id: str) -> bool:
        session = self.sessions.get(session_id)
        if not session:
            return False
        session.is_locked = False
        return True
