import csv
import json
from datetime import datetime
from typing import Dict, List, Any
from models import ReconciliationSession, ReconciliationItem, AdmissionStatus


class ReportGenerator:
    def __init__(self, session: ReconciliationSession):
        self.session = session

    def generate_summary_report(self) -> Dict[str, Any]:
        summary = self.session.summary
        report = {
            'session_id': self.session.id,
            'session_name': self.session.name,
            'generated_at': datetime.now().isoformat(),
            'created_by': self.session.created_by,
            'is_locked': self.session.is_locked,
            'statistics': {
                'total_records': summary.total_records,
                'pending_count': summary.pending_count,
                'approved_count': summary.approved_count,
                'rejected_count': summary.rejected_count,
                'supplement_count': summary.supplement_count,
                'conflict_count': summary.conflict_count,
                'cross_major_count': summary.cross_major_count,
                'duplicate_count': summary.duplicate_count,
                'approval_rate': round(
                    summary.approved_count / summary.total_records * 100, 2
                ) if summary.total_records > 0 else 0
            },
            'quota_warnings': summary.quota_warnings,
            'supervisor_summary': self._get_supervisor_summary(),
            'batch_distribution': self._get_batch_distribution()
        }
        return report

    def _get_supervisor_summary(self) -> List[Dict[str, Any]]:
        supervisor_stats = {}
        for item in self.session.items.values():
            sup_id = item.supervisor_id
            if sup_id not in supervisor_stats:
                supervisor = self.session.supervisors.get(sup_id)
                supervisor_stats[sup_id] = {
                    'supervisor_id': sup_id,
                    'supervisor_name': item.supervisor_name,
                    'department': supervisor.department if supervisor else '',
                    'major': supervisor.major if supervisor else '',
                    'total_quota': supervisor.total_quota if supervisor else 0,
                    'remaining_quota': supervisor.remaining_quota if supervisor else 0,
                    'allocated_count': 0,
                    'approved_count': 0,
                    'conflict_count': 0
                }
            supervisor_stats[sup_id]['allocated_count'] += 1
            if item.is_approved:
                supervisor_stats[sup_id]['approved_count'] += 1
            if item.status == AdmissionStatus.CONFLICT:
                supervisor_stats[sup_id]['conflict_count'] += 1
        
        return list(supervisor_stats.values())

    def _get_batch_distribution(self) -> Dict[str, int]:
        distribution = {}
        for item in self.session.items.values():
            batch_name = item.application_type.value
            distribution[batch_name] = distribution.get(batch_name, 0) + 1
        return distribution

    def generate_detailed_report(self) -> List[Dict[str, Any]]:
        detailed_records = []
        for item in self.session.items.values():
            student = self.session.students.get(item.student_id)
            supervisor = self.session.supervisors.get(item.supervisor_id)
            
            record = {
                'item_id': item.id,
                'student_id': item.student_id,
                'student_name': item.student_name,
                'student_undergraduate_major': student.undergraduate_major if student else '',
                'student_application_major': student.application_major if student else '',
                'student_total_score': student.total_score if student else 0,
                'supervisor_id': item.supervisor_id,
                'supervisor_name': item.supervisor_name,
                'supervisor_department': supervisor.department if supervisor else '',
                'supervisor_major': supervisor.major if supervisor else '',
                'application_type': item.application_type.value,
                'status': item.status.value,
                'is_approved': item.is_approved,
                'conflicts': [
                    {
                        'type': c.conflict_type.value,
                        'description': c.description,
                        'severity': c.severity
                    }
                    for c in item.conflicts
                ],
                'source_trace': item.source_trace,
                'review_count': len(item.review_records),
                'last_review_time': item.review_records[-1].review_time.isoformat() if item.review_records else None,
                'created_at': item.created_at.isoformat(),
                'updated_at': item.updated_at.isoformat()
            }
            detailed_records.append(record)
        return sorted(detailed_records, key=lambda x: x['updated_at'], reverse=True)

    def generate_conflict_report(self) -> Dict[str, Any]:
        conflict_items = [
            item for item in self.session.items.values()
            if item.conflicts
        ]
        
        conflict_by_type = {}
        for item in conflict_items:
            for conflict in item.conflicts:
                conflict_type = conflict.conflict_type.value
                if conflict_type not in conflict_by_type:
                    conflict_by_type[conflict_type] = []
                conflict_by_type[conflict_type].append({
                    'item_id': item.id,
                    'student_name': item.student_name,
                    'supervisor_name': item.supervisor_name,
                    'description': conflict.description,
                    'source': conflict.source
                })

        return {
            'total_conflicts': len(conflict_items),
            'conflicts_by_type': conflict_by_type
        }

    def export_summary_to_json(self, file_path: str) -> None:
        report = self.generate_summary_report()
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

    def export_detailed_to_csv(self, file_path: str) -> None:
        records = self.generate_detailed_report()
        if not records:
            return

        fieldnames = [
            'item_id', 'student_id', 'student_name',
            'student_undergraduate_major', 'student_application_major',
            'student_total_score', 'supervisor_id', 'supervisor_name',
            'supervisor_department', 'supervisor_major',
            'application_type', 'status', 'is_approved',
            'conflict_count', 'review_count', 'last_review_time',
            'source_description'
        ]

        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for record in records:
                row = {
                    'item_id': record['item_id'],
                    'student_id': record['student_id'],
                    'student_name': record['student_name'],
                    'student_undergraduate_major': record['student_undergraduate_major'],
                    'student_application_major': record['student_application_major'],
                    'student_total_score': record['student_total_score'],
                    'supervisor_id': record['supervisor_id'],
                    'supervisor_name': record['supervisor_name'],
                    'supervisor_department': record['supervisor_department'],
                    'supervisor_major': record['supervisor_major'],
                    'application_type': record['application_type'],
                    'status': record['status'],
                    'is_approved': '是' if record['is_approved'] else '否',
                    'conflict_count': len(record['conflicts']),
                    'review_count': record['review_count'],
                    'last_review_time': record['last_review_time'] or '',
                    'source_description': '; '.join(
                        [f"{t['type']}-{t['batch']}" for t in record['source_trace']]
                    )
                }
                writer.writerow(row)

    def export_conflict_to_csv(self, file_path: str) -> None:
        conflict_report = self.generate_conflict_report()
        
        fieldnames = [
            'conflict_type', 'student_name', 'supervisor_name',
            'description', 'source_details'
        ]

        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for conflict_type, items in conflict_report['conflicts_by_type'].items():
                for item in items:
                    writer.writerow({
                        'conflict_type': conflict_type,
                        'student_name': item['student_name'],
                        'supervisor_name': item['supervisor_name'],
                        'description': item['description'],
                        'source_details': json.dumps(item['source'], ensure_ascii=False)
                    })

    def generate_explanation_report(self, item_id: str) -> Dict[str, Any]:
        item = self.session.items.get(item_id)
        if not item:
            return {}

        return {
            'header': f"录取对账说明 - {item.student_name}",
            'basic_info': {
                '考生': f"{item.student_name} ({item.student_id})",
                '导师': f"{item.supervisor_name} ({item.supervisor_id})",
                '录取批次': item.application_type.value,
                '当前状态': item.status.value,
                '是否放行': '是' if item.is_approved else '否'
            },
            'source_tracing': item.source_trace,
            'conflict_analysis': [
                {
                    '冲突类型': c.conflict_type.value,
                    '问题描述': c.description,
                    '严重程度': c.severity
                }
                for c in item.conflicts
            ],
            'review_decisions': [
                {
                    '审核人': r.reviewer,
                    '审核时间': r.review_time.strftime('%Y-%m-%d %H:%M:%S'),
                    '状态变更': f"{r.original_status.value} → {r.new_status.value}",
                    '审核意见': r.comment
                }
                for r in item.review_records
            ]
        }
