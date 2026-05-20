import uuid
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Set, Tuple
from models import (
    Supervisor, Student, ApplicationChoice, AdjustmentRecord,
    ReconciliationItem, ReconciliationSummary, ReconciliationSession,
    AdmissionStatus, AdjustmentType, ConflictType, ConflictDetail,
    ReviewRecord
)


class ReconciliationEngine:
    def __init__(self, session: ReconciliationSession):
        self.session = session
        self.supervisor_allocation: Dict[str, List[str]] = defaultdict(list)
        self.student_admission_count: Dict[str, int] = defaultdict(int)

    def run_reconciliation(self) -> None:
        self.session.items.clear()
        self.supervisor_allocation.clear()
        self.student_admission_count.clear()

        self._process_choices()
        self._process_adjustments()
        self._detect_conflicts()
        self._update_summary()

    def _process_choices(self) -> None:
        for choice in self.session.choices:
            student = self.session.students.get(choice.student_id)
            supervisor = self.session.supervisors.get(choice.supervisor_id)
            
            if not student or not supervisor:
                continue

            application_type = (
                AdjustmentType.FIRST_CHOICE
                if choice.preference_order == 1
                else AdjustmentType.SECOND_CHOICE
            )

            item_id = str(uuid.uuid4())
            item = ReconciliationItem(
                id=item_id,
                student_id=student.id,
                student_name=student.name,
                supervisor_id=supervisor.id,
                supervisor_name=supervisor.name,
                application_type=application_type,
                status=AdmissionStatus.PENDING
            )

            item.source_trace.append({
                'type': '志愿填报',
                'batch': application_type.value,
                'preference_order': choice.preference_order,
                'is_cross_major': choice.is_cross_major
            })

            self.session.items[item_id] = item
            self.supervisor_allocation[supervisor.id].append(item_id)
            self.student_admission_count[student.id] += 1

    def _process_adjustments(self) -> None:
        for adj in self.session.adjustments:
            student = self.session.students.get(adj.student_id)
            to_supervisor = self.session.supervisors.get(adj.to_supervisor_id)
            
            if not student or not to_supervisor:
                continue

            item_id = str(uuid.uuid4())
            item = ReconciliationItem(
                id=item_id,
                student_id=student.id,
                student_name=student.name,
                supervisor_id=to_supervisor.id,
                supervisor_name=to_supervisor.name,
                application_type=adj.adjustment_batch,
                status=AdmissionStatus.PENDING
            )

            source_trace = {
                'type': '调剂',
                'batch': adj.adjustment_batch.value,
                'adjustment_time': adj.adjustment_time.isoformat(),
                'operator': adj.operator,
                'reason': adj.reason
            }

            if adj.from_supervisor_id:
                from_supervisor = self.session.supervisors.get(adj.from_supervisor_id)
                if from_supervisor:
                    source_trace['from_supervisor'] = f"{from_supervisor.name} ({from_supervisor.id})"
            
            if adj.source_batch:
                source_trace['source_batch'] = adj.source_batch

            item.source_trace.append(source_trace)
            self.session.items[item_id] = item
            self.supervisor_allocation[to_supervisor.id].append(item_id)
            self.student_admission_count[student.id] += 1

    def _detect_conflicts(self) -> None:
        for item in self.session.items.values():
            item.conflicts.clear()

            self._check_quota_conflict(item)
            self._check_major_mismatch(item)
            self._check_duplicate_admission(item)

            if item.conflicts:
                item.status = AdmissionStatus.CONFLICT

    def _check_quota_conflict(self, item: ReconciliationItem) -> None:
        supervisor = self.session.supervisors.get(item.supervisor_id)
        if not supervisor:
            return

        approved_count = sum(
            1 for alloc_id in self.supervisor_allocation[item.supervisor_id]
            if self.session.items[alloc_id].is_approved
        )

        total_allocated = len(self.supervisor_allocation[item.supervisor_id])
        remaining = supervisor.total_quota - supervisor.used_quota - approved_count

        if total_allocated > remaining:
            conflict = ConflictDetail(
                conflict_type=ConflictType.QUOTA_EXCEEDED,
                description=f"导师名额超额：总名额{supervisor.total_quota}，"
                           f"已用{supervisor.used_quota}，剩余{remaining}，"
                           f"当前申请{total_allocated}人",
                source={
                    'supervisor_id': supervisor.id,
                    'supervisor_name': supervisor.name,
                    'total_quota': supervisor.total_quota,
                    'used_quota': supervisor.used_quota,
                    'remaining_quota': remaining,
                    'allocated_count': total_allocated
                }
            )
            item.conflicts.append(conflict)

    def _check_major_mismatch(self, item: ReconciliationItem) -> None:
        student = self.session.students.get(item.student_id)
        supervisor = self.session.supervisors.get(item.supervisor_id)
        
        if not student or not supervisor:
            return

        if student.application_major != supervisor.major:
            conflict = ConflictDetail(
                conflict_type=ConflictType.MAJOR_MISMATCH,
                description=f"专业不匹配：学生报考{student.application_major}，"
                           f"导师招生{supervisor.major}",
                source={
                    'student_id': student.id,
                    'student_name': student.name,
                    'student_major': student.application_major,
                    'supervisor_id': supervisor.id,
                    'supervisor_name': supervisor.name,
                    'supervisor_major': supervisor.major
                }
            )
            item.conflicts.append(conflict)

        for trace in item.source_trace:
            if trace.get('is_cross_major'):
                conflict = ConflictDetail(
                    conflict_type=ConflictType.CROSS_MAJOR,
                    description=f"跨专业报考：学生本科{student.undergraduate_major}，"
                               f"报考{student.application_major}",
                    source={
                        'student_id': student.id,
                        'student_name': student.name,
                        'undergraduate_major': student.undergraduate_major,
                        'application_major': student.application_major,
                        'is_cross_major': True
                    },
                    severity="medium"
                )
                item.conflicts.append(conflict)
                break

    def _check_duplicate_admission(self, item: ReconciliationItem) -> None:
        if self.student_admission_count[item.student_id] > 1:
            duplicate_items = [
                {
                    'item_id': item_id,
                    'supervisor_name': record.supervisor_name,
                    'application_type': record.application_type.value,
                    'is_approved': record.is_approved
                }
                for item_id, record in self.session.items.items()
                if record.student_id == item.student_id
            ]

            conflict = ConflictDetail(
                conflict_type=ConflictType.DUPLICATE_ADMISSION,
                description=f"重复录取：该学生共有{len(duplicate_items)}条录取记录",
                source={
                    'student_id': item.student_id,
                    'student_name': item.student_name,
                    'duplicate_count': len(duplicate_items),
                    'duplicate_items': duplicate_items
                }
            )
            item.conflicts.append(conflict)

    def _update_summary(self) -> None:
        summary = self.session.summary
        summary.total_records = len(self.session.items)
        
        status_counts = defaultdict(int)
        for item in self.session.items.values():
            status_counts[item.status] += 1
        
        summary.pending_count = status_counts[AdmissionStatus.PENDING]
        summary.approved_count = status_counts[AdmissionStatus.APPROVED]
        summary.rejected_count = status_counts[AdmissionStatus.REJECTED]
        summary.supplement_count = status_counts[AdmissionStatus.SUPPLEMENT]
        summary.conflict_count = status_counts[AdmissionStatus.CONFLICT]

        summary.quota_warnings = []
        summary.cross_major_count = 0
        summary.duplicate_count = 0

        detected_duplicates: Set[str] = set()
        
        for item in self.session.items.values():
            for conflict in item.conflicts:
                if conflict.conflict_type == ConflictType.QUOTA_EXCEEDED:
                    warning = conflict.source.copy()
                    warning['student_name'] = item.student_name
                    if warning not in summary.quota_warnings:
                        summary.quota_warnings.append(warning)
                elif conflict.conflict_type == ConflictType.CROSS_MAJOR:
                    summary.cross_major_count += 1
                elif conflict.conflict_type == ConflictType.DUPLICATE_ADMISSION:
                    if item.student_id not in detected_duplicates:
                        summary.duplicate_count += 1
                        detected_duplicates.add(item.student_id)

    def recalculate_after_review(self, item_id: str) -> None:
        self._detect_conflicts()
        self._update_summary()
