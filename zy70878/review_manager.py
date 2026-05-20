import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from models import (
    ReconciliationSession, ReconciliationItem, ReviewRecord,
    AdmissionStatus
)
from reconciliation_engine import ReconciliationEngine


class ReviewManager:
    def __init__(self, session: ReconciliationSession, engine: ReconciliationEngine):
        self.session = session
        self.engine = engine

    def review_item(
        self,
        item_id: str,
        reviewer: str,
        new_status: AdmissionStatus,
        comment: str
    ) -> Optional[ReviewRecord]:
        item = self.session.items.get(item_id)
        if not item:
            return None

        original_status = item.status
        
        review_record = ReviewRecord(
            id=str(uuid.uuid4()),
            reconciliation_id=item_id,
            reviewer=reviewer,
            review_time=datetime.now(),
            original_status=original_status,
            new_status=new_status,
            comment=comment
        )

        item.review_records.append(review_record)
        item.status = new_status
        item.updated_at = datetime.now()
        
        if new_status == AdmissionStatus.APPROVED:
            item.is_approved = True
        elif new_status == AdmissionStatus.REJECTED:
            item.is_approved = False

        self.engine.recalculate_after_review(item_id)
        
        return review_record

    def batch_review(
        self,
        item_ids: List[str],
        reviewer: str,
        new_status: AdmissionStatus,
        comment: str
    ) -> Dict[str, Any]:
        success_count = 0
        failed_ids = []
        review_records = []

        for item_id in item_ids:
            record = self.review_item(item_id, reviewer, new_status, comment)
            if record:
                success_count += 1
                review_records.append(record)
            else:
                failed_ids.append(item_id)

        return {
            'success_count': success_count,
            'failed_ids': failed_ids,
            'review_records': review_records
        }

    def get_item_review_history(self, item_id: str) -> List[ReviewRecord]:
        item = self.session.items.get(item_id)
        if not item:
            return []
        return item.review_records

    def get_all_review_records(self) -> List[ReviewRecord]:
        all_records = []
        for item in self.session.items.values():
            all_records.extend(item.review_records)
        return sorted(all_records, key=lambda x: x.review_time, reverse=True)

    def get_items_by_status(self, status: AdmissionStatus) -> List[ReconciliationItem]:
        return [
            item for item in self.session.items.values()
            if item.status == status
        ]

    def get_student_trace(self, student_id: str) -> Dict[str, Any]:
        student = self.session.students.get(student_id)
        if not student:
            return {}

        student_items = [
            item for item in self.session.items.values()
            if item.student_id == student_id
        ]

        trace_info = {
            'student_id': student.id,
            'student_name': student.name,
            'undergraduate_major': student.undergraduate_major,
            'application_major': student.application_major,
            'total_score': student.total_score,
            'admission_records': []
        }

        for item in student_items:
            record_detail = {
                'item_id': item.id,
                'supervisor_id': item.supervisor_id,
                'supervisor_name': item.supervisor_name,
                'application_type': item.application_type.value,
                'status': item.status.value,
                'is_approved': item.is_approved,
                'source_trace': item.source_trace,
                'conflicts': [
                    {
                        'type': c.conflict_type.value,
                        'description': c.description,
                        'severity': c.severity
                    }
                    for c in item.conflicts
                ],
                'review_history': [
                    {
                        'reviewer': r.reviewer,
                        'time': r.review_time.isoformat(),
                        'from': r.original_status.value,
                        'to': r.new_status.value,
                        'comment': r.comment
                    }
                    for r in item.review_records
                ]
            }
            trace_info['admission_records'].append(record_detail)

        return trace_info

    def explain_decision(self, item_id: str) -> Dict[str, Any]:
        item = self.session.items.get(item_id)
        if not item:
            return {}

        explanation = {
            'item_id': item.id,
            'student': f"{item.student_name} ({item.student_id})",
            'supervisor': f"{item.supervisor_name} ({item.supervisor_id})",
            'application_type': item.application_type.value,
            'current_status': item.status.value,
            'is_approved': item.is_approved,
            'source_origin': [],
            'conflict_analysis': [],
            'review_decisions': []
        }

        for trace in item.source_trace:
            explanation['source_origin'].append(trace)

        for conflict in item.conflicts:
            explanation['conflict_analysis'].append({
                'type': conflict.conflict_type.value,
                'description': conflict.description,
                'source_data': conflict.source,
                'severity': conflict.severity
            })

        for review in item.review_records:
            explanation['review_decisions'].append({
                'reviewer': review.reviewer,
                'review_time': review.review_time.isoformat(),
                'decision': f"{review.original_status.value} → {review.new_status.value}",
                'reason': review.comment
            })

        return explanation
