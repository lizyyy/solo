from typing import Dict, List, Any
from collections import defaultdict


class SourceTracker:
    def __init__(self):
        self.phone_sources: Dict[str, List[Dict]] = defaultdict(list)
        self.merge_decisions: List[Dict] = []
        self.consultant_assignments: List[Dict] = []

    def add_source(self, normalized_phone: str, source_type: str, source_file: str, 
                   source_row: int, original_data: Dict):
        self.phone_sources[normalized_phone].append({
            'source_type': source_type,
            'source_file': source_file,
            'source_row': source_row,
            'original_data': original_data
        })

    def add_merge_decision(self, normalized_phone: str, decision: str, reason: str, 
                           selected_channel: str, selected_consultant: str,
                           all_channels: List[str], all_consultants: List[str]):
        self.merge_decisions.append({
            'normalized_phone': normalized_phone,
            'decision': decision,
            'reason': reason,
            'selected_channel': selected_channel,
            'selected_consultant': selected_consultant,
            'all_channels': all_channels,
            'all_consultants': all_consultants
        })

    def add_consultant_assignment(self, consultant_name: str, phone: str, 
                                   channel: str, status: str):
        self.consultant_assignments.append({
            'consultant_name': consultant_name,
            'phone': phone,
            'channel': channel,
            'status': status
        })

    def get_phone_sources(self, normalized_phone: str) -> List[Dict]:
        return self.phone_sources.get(normalized_phone, [])

    def get_all_decisions(self) -> List[Dict]:
        return sorted(self.merge_decisions, key=lambda x: x['normalized_phone'])

    def get_consultant_summary(self) -> Dict[str, Any]:
        summary = defaultdict(lambda: {
            'total_clients': 0,
            'unique_phones': set(),
            'channels': defaultdict(int),
            'statuses': defaultdict(int)
        })
        
        for assignment in self.consultant_assignments:
            consultant = assignment['consultant_name'] or '未分配'
            summary[consultant]['unique_phones'].add(assignment['phone'])
            summary[consultant]['channels'][assignment['channel'] or '未知'] += 1
            summary[consultant]['statuses'][assignment['status'] or '未知'] += 1
        
        result = {}
        for consultant, data in summary.items():
            result[consultant] = {
                'total_clients': len(data['unique_phones']),
                'channels': dict(data['channels']),
                'statuses': dict(data['statuses'])
            }
        return result
