import csv
from datetime import date
from typing import List, Optional

from trademark_deadlines.core.date_calculator import DeadlineCalculationResult


class CSVExporter:
    def __init__(self):
        pass
    
    def export_deadlines(
        self,
        deadlines: List[DeadlineCalculationResult],
        output_path: str,
        reference_date: Optional[date] = None
    ) -> int:
        if not deadlines:
            return 0
        
        sorted_deadlines = sorted(
            deadlines,
            key=lambda x: (x.adjusted_deadline, x.case_id)
        )
        
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=[
                'case_id',
                'trademark',
                'jurisdiction',
                'deadline_type',
                'base_deadline',
                'adjusted_deadline',
                'was_adjusted',
                'adjustment_reason',
                'days_until_deadline',
                'is_overdue',
                'urgency_level',
                'related_action_id',
                'notes'
            ])
            
            writer.writeheader()
            
            for deadline in sorted_deadlines:
                writer.writerow({
                    'case_id': deadline.case_id,
                    'trademark': deadline.trademark,
                    'jurisdiction': deadline.jurisdiction,
                    'deadline_type': deadline.deadline_type.value,
                    'base_deadline': deadline.base_deadline.strftime('%Y-%m-%d'),
                    'adjusted_deadline': deadline.adjusted_deadline.strftime('%Y-%m-%d'),
                    'was_adjusted': '是' if deadline.was_adjusted else '否',
                    'adjustment_reason': deadline.adjustment_reason or '',
                    'days_until_deadline': deadline.days_until_deadline,
                    'is_overdue': '是' if deadline.is_overdue else '否',
                    'urgency_level': self._get_urgency_level(deadline),
                    'related_action_id': deadline.related_action_id or '',
                    'notes': deadline.notes or ''
                })
        
        return len(sorted_deadlines)
    
    def _get_urgency_level(self, deadline: DeadlineCalculationResult) -> str:
        if deadline.is_overdue:
            return '已逾期'
        elif deadline.days_until_deadline <= 3:
            return '紧急'
        elif deadline.days_until_deadline <= 7:
            return '高'
        elif deadline.days_until_deadline <= 30:
            return '中'
        else:
            return '低'
