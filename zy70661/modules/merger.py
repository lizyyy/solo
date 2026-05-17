from typing import Dict, List, Any
from collections import defaultdict
from .tracker import SourceTracker


DEFAULT_CHANNEL_PRIORITY = [
    "老业主推荐",
    "全民经纪人",
    "渠道分销-贝壳",
    "渠道分销-链家",
    "渠道分销-其他",
    "自然来访",
    "电话邀约",
    "线上广告",
    "线下活动",
    "企业团购",
    "外拓拓客",
    "其他渠道"
]


class ChannelMerger:
    def __init__(self, tracker: SourceTracker = None, channel_priority: List[str] = None):
        self.tracker = tracker or SourceTracker()
        self.channel_priority = channel_priority or DEFAULT_CHANNEL_PRIORITY

    def _get_channel_priority_score(self, channel_name: str) -> int:
        if not channel_name:
            return 999
        channel_lower = str(channel_name).strip()
        for idx, priority_channel in enumerate(self.channel_priority):
            if priority_channel in channel_lower or channel_lower in priority_channel:
                return idx
        return 998

    def _select_best_channel(self, channels: List[Dict]) -> Dict:
        if not channels:
            return {}
        if len(channels) == 1:
            return channels[0]
        
        sorted_channels = sorted(
            channels,
            key=lambda x: (
                self._get_channel_priority_score(x.get('渠道名称', '')),
                x.get('_source_row', 99999)
            )
        )
        return sorted_channels[0]

    def _group_by_phone(self, visit_data: List[Dict], channel_data: List[Dict]) -> Dict[str, Dict]:
        grouped = defaultdict(lambda: {
            'visit_records': [],
            'channel_records': []
        })
        
        for record in visit_data:
            phone = record.get('_normalized_phone', '')
            if phone:
                grouped[phone]['visit_records'].append(record)
                self.tracker.add_source(
                    phone,
                    'visit',
                    record.get('_source_file', ''),
                    record.get('_source_row', 0),
                    record
                )
        
        for record in channel_data:
            phone = record.get('_normalized_phone', '')
            if phone:
                grouped[phone]['channel_records'].append(record)
                self.tracker.add_source(
                    phone,
                    'channel',
                    record.get('_source_file', ''),
                    record.get('_source_row', 0),
                    record
                )
        
        return dict(grouped)

    def merge(self, visit_data: List[Dict], channel_data: List[Dict]) -> Dict[str, Any]:
        grouped = self._group_by_phone(visit_data, channel_data)
        
        unique_customers = []
        duplicate_customers = []
        merge_details = []
        
        for phone, data in sorted(grouped.items()):
            visit_records = data['visit_records']
            channel_records = data['channel_records']
            
            all_channels = []
            all_consultants = []
            
            for record in visit_records + channel_records:
                channel = record.get('渠道名称') or record.get('渠道')
                consultant = record.get('置业顾问') or record.get('顾问')
                if channel and channel not in all_channels:
                    all_channels.append(channel)
                if consultant and consultant not in all_consultants:
                    all_consultants.append(consultant)
            
            is_duplicate = len(channel_records) > 1 or (len(visit_records) > 0 and len(channel_records) > 1)
            
            best_channel = self._select_best_channel(channel_records) if channel_records else {}
            
            selected_channel = best_channel.get('渠道名称') or best_channel.get('渠道') or (all_channels[0] if all_channels else '未知')
            selected_consultant = best_channel.get('置业顾问') or best_channel.get('顾问') or (all_consultants[0] if all_consultants else '未知')
            
            selected_status = best_channel.get('认领状态') or '未认领'
            
            if is_duplicate:
                reason = f"存在{len(channel_records)}条渠道认领记录，按优先级选择"
            elif len(channel_records) == 1:
                reason = "唯一渠道认领"
            else:
                reason = "无渠道认领，使用来访记录"
            
            self.tracker.add_merge_decision(
                phone,
                '保留' if best_channel else '新增',
                reason,
                selected_channel,
                selected_consultant,
                all_channels,
                all_consultants
            )
            
            customer_detail = {
                '归一化电话': phone,
                '最终渠道': selected_channel,
                '最终顾问': selected_consultant,
                '认领状态': selected_status,
                '是否重复认领': '是' if is_duplicate else '否',
                '重复渠道数': len(channel_records),
                '来访记录数': len(visit_records),
                '所有渠道': ' | '.join(all_channels) if all_channels else '无',
                '所有顾问': ' | '.join(all_consultants) if all_consultants else '无',
                '来访来源行': ', '.join([str(r.get('_source_row', '')) for r in visit_records]),
                '渠道来源行': ', '.join([str(r.get('_source_row', '')) for r in channel_records])
            }
            
            merge_details.append(customer_detail)
            
            if is_duplicate:
                duplicate_customers.append(customer_detail)
            unique_customers.append(customer_detail)
        
        return {
            'unique_customers': unique_customers,
            'duplicate_customers': duplicate_customers,
            'merge_details': merge_details
        }
