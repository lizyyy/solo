from typing import Dict, List, Any
from collections import defaultdict
from .tracker import SourceTracker


class ConsultantSummary:
    def __init__(self, tracker: SourceTracker = None):
        self.tracker = tracker or SourceTracker()

    def summarize(self, merged_result: Dict) -> Dict[str, Any]:
        consultants = defaultdict(lambda: {
            '客户数': 0,
            '渠道分布': defaultdict(int),
            '状态分布': defaultdict(int),
            '重复认领客户数': 0,
            '客户电话列表': []
        })
        
        all_channels = set()
        all_statuses = set()
        
        for customer in merged_result['merge_details']:
            consultant = customer['最终顾问'] or '未分配'
            channel = customer['最终渠道'] or '未知'
            status = customer['认领状态'] or '未知'
            
            consultants[consultant]['客户数'] += 1
            consultants[consultant]['渠道分布'][channel] += 1
            consultants[consultant]['状态分布'][status] += 1
            
            if customer['是否重复认领'] == '是':
                consultants[consultant]['重复认领客户数'] += 1
            
            consultants[consultant]['客户电话列表'].append(customer['归一化电话'])
            
            all_channels.add(channel)
            all_statuses.add(status)
            
            self.tracker.add_consultant_assignment(
                consultant,
                customer['归一化电话'],
                channel,
                status
            )
        
        consultant_list = []
        for consultant, data in sorted(consultants.items()):
            consultant_list.append({
                '置业顾问': consultant,
                '客户数': data['客户数'],
                '重复认领客户数': data['重复认领客户数'],
                '渠道分布': ' | '.join([f"{k}:{v}" for k, v in sorted(data['渠道分布'].items())]),
                '状态分布': ' | '.join([f"{k}:{v}" for k, v in sorted(data['状态分布'].items())]),
                '客户电话列表': ', '.join(sorted(data['客户电话列表']))
            })
        
        channel_summary = self._summarize_channels(merged_result)
        status_summary = self._summarize_statuses(merged_result)
        
        return {
            'consultants': consultant_list,
            'channel_summary': channel_summary,
            'status_summary': status_summary,
            'total_customers': len(merged_result['merge_details']),
            'total_duplicate': len(merged_result['duplicate_customers'])
        }

    def _summarize_channels(self, merged_result: Dict) -> List[Dict]:
        channel_stats = defaultdict(lambda: {
            '客户数': 0,
            '顾问数': set(),
            '重复认领数': 0
        })
        
        for customer in merged_result['merge_details']:
            channel = customer['最终渠道'] or '未知'
            consultant = customer['最终顾问'] or '未分配'
            
            channel_stats[channel]['客户数'] += 1
            channel_stats[channel]['顾问数'].add(consultant)
            if customer['是否重复认领'] == '是':
                channel_stats[channel]['重复认领数'] += 1
        
        result = []
        for channel, data in sorted(channel_stats.items()):
            result.append({
                '渠道名称': channel,
                '客户数': data['客户数'],
                '涉及顾问数': len(data['顾问数']),
                '重复认领数': data['重复认领数']
            })
        return result

    def _summarize_statuses(self, merged_result: Dict) -> List[Dict]:
        status_stats = defaultdict(lambda: {
            '客户数': 0,
            '渠道数': set()
        })
        
        for customer in merged_result['merge_details']:
            status = customer['认领状态'] or '未知'
            channel = customer['最终渠道'] or '未知'
            
            status_stats[status]['客户数'] += 1
            status_stats[status]['渠道数'].add(channel)
        
        result = []
        for status, data in sorted(status_stats.items()):
            result.append({
                '认领状态': status,
                '客户数': data['客户数'],
                '涉及渠道数': len(data['渠道数'])
            })
        return result
