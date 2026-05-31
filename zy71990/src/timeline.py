#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
时间线模块
功能：将目录快照、配置文件、失败日志合并到统一时间线展示
"""

import os
import json
import re
from datetime import datetime

from .snapshot import DirectorySnapshot
from .config_parser import ConfigParser
from .log_parser import FailureLogParser
from .history import ChangeHistory


class Timeline:
    def __init__(self, base_path, config_path=None):
        self.base_path = os.path.abspath(base_path)
        self.config_path = config_path
        
    def _parse_timestamp(self, time_str):
        """尝试解析各种时间格式"""
        if not time_str or time_str == '未知':
            return None
        
        time_str = str(time_str).strip()
        
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d %H:%M',
            '%Y-%m-%d %H:%M:%S.%f',
            '%Y/%m/%d %H:%M:%S',
            '%Y/%m/%d %H:%M',
            '%Y%m%d %H:%M:%S',
            '%Y-%m-%d',
            '%Y/%m/%d',
            '%m/%d/%Y %H:%M:%S',
            '%d/%m/%Y %H:%M:%S',
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(time_str, fmt)
            except ValueError:
                continue
        
        match = re.search(r'(\d{4})[-/](\d{2})[-/](\d{2})[\sT](\d{2}):(\d{2}):(\d{2})', time_str)
        if match:
            try:
                return datetime(*map(int, match.groups()))
            except:
                pass
        
        return None
    
    def _format_time(self, dt):
        """格式化时间输出"""
        if dt is None:
            return '时间未知'
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    
    def build(self):
        """构建统一时间线"""
        events = []
        
        snapshot = DirectorySnapshot(self.base_path)
        snapshot_result = snapshot.take()
        
        for f in snapshot_result['files']:
            dt = self._parse_timestamp(f['modified'])
            events.append({
                'timestamp': dt,
                'time_sort': dt or datetime.min,
                'type': 'file',
                'source': '目录快照',
                'icon': '📄',
                'title': f"文件: {f['path']}",
                'description': f"大小: {f['size_human']}",
                'details': f
            })
        
        for d in snapshot_result['directories']:
            dt = self._parse_timestamp(d['modified'])
            events.append({
                'timestamp': dt,
                'time_sort': dt or datetime.min,
                'type': 'directory',
                'source': '目录快照',
                'icon': '📁',
                'title': f"目录: {d['path']}",
                'description': '目录修改',
                'details': d
            })
        
        config_parser = ConfigParser(self.base_path, self.config_path)
        config_result = config_parser.parse_all()
        
        for config in config_result['config_files']:
            dt = self._parse_timestamp(config['modified'])
            events.append({
                'timestamp': dt,
                'time_sort': dt or datetime.min,
                'type': 'config',
                'source': '配置文件',
                'icon': '⚙️',
                'title': f"配置: {config['path']}",
                'description': f"类型: {config['type']}",
                'details': config
            })
        
        log_parser = FailureLogParser(self.base_path)
        log_result = log_parser.parse_all()
        
        for log_res in log_result['results']:
            log_file = log_res['file']
            dt = self._parse_timestamp(log_file['modified'])
            
            events.append({
                'timestamp': dt,
                'time_sort': dt or datetime.min,
                'type': 'log_file',
                'source': '失败日志',
                'icon': '📋',
                'title': f"日志文件: {log_file['path']}",
                'description': f"共 {log_res['total_lines']} 行, {log_res['summary']['total_records']} 条记录",
                'details': log_res['summary']
            })
            
            for record in log_res['records']:
                record_dt = self._parse_timestamp(record.get('timestamp')) or dt
                
                if record.get('is_late'):
                    icon = '⏰'
                    event_type = 'late_attachment'
                    title = f"晚到附件: {record.get('message', '')[:40]}"
                elif record.get('is_manual'):
                    icon = '✏️'
                    event_type = 'manual_correction'
                    title = f"人工更正: {record.get('message', '')[:40]}"
                else:
                    icon = '✅'
                    event_type = 'normal_log'
                    title = f"日志记录: {record.get('message', '')[:40]}"
                
                events.append({
                    'timestamp': record_dt,
                    'time_sort': record_dt or datetime.min,
                    'type': event_type,
                    'source': '失败日志',
                    'icon': icon,
                    'title': title,
                    'description': f"行号: {record['line_num']}",
                    'details': record
                })
        
        try:
            history = ChangeHistory(self.base_path)
            changes = history.get_all_changes()
            
            for change in changes:
                dt = self._parse_timestamp(change['timestamp'])
                change_type = change.get('change_type', 'unknown')
                
                icon = '👤' if change_type == 'manual' else '🔄'
                events.append({
                    'timestamp': dt,
                    'time_sort': dt or datetime.min,
                    'type': 'file_change',
                    'source': '修改历史',
                    'icon': icon,
                    'title': f"文件变更: {change['file']} (v{change['version']})",
                    'description': f"{change.get('summary', '')} - {change.get('comment', '')}",
                    'details': change
                })
        except:
            pass
        
        events.sort(key=lambda x: x['time_sort'])
        
        for i, event in enumerate(events):
            event['order'] = i + 1
        
        return events
    
    def print_events(self, events):
        """打印时间线事件"""
        print("\n" + "="*70)
        print("📊 统一时间线 (按时间排序)")
        print("="*70)
        
        if not events:
            print("  暂无事件")
            return
        
        current_date = None
        
        for event in events:
            event_time = event['timestamp']
            
            if event_time:
                event_date = event_time.date()
                if event_date != current_date:
                    current_date = event_date
                    print(f"\n📅 {current_date.strftime('%Y年%m月%d日')}")
                    print("-" * 70)
            
            time_str = self._format_time(event_time) if event_time else '时间未知'
            print(f"{event['icon']} [{time_str}] [{event['source']}]")
            print(f"   {event['title']}")
            if event['description']:
                print(f"   └─ {event['description']}")
        
        print(f"\n📈 共 {len(events)} 个事件")
        print()
        
    def save(self, events, output_dir):
        """保存时间线结果"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"timeline_{timestamp}.json"
        filepath = os.path.join(output_dir, filename)
        
        serializable_events = []
        for event in events:
            e = event.copy()
            if isinstance(e['timestamp'], datetime):
                e['timestamp'] = e['timestamp'].isoformat()
            if isinstance(e['time_sort'], datetime):
                e['time_sort'] = e['time_sort'].isoformat()
            serializable_events.append(e)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(serializable_events, f, ensure_ascii=False, indent=2)
        
        print(f"💾 时间线已保存到: {filepath}")
