#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
失败日志解析模块
功能：解析失败日志，识别正常记录、晚到附件、重复项、人工更正
"""

import os
import re
import hashlib
from datetime import datetime


class FailureLogParser:
    def __init__(self, base_path):
        self.base_path = os.path.abspath(base_path)
        
    def find_log_files(self):
        """查找日志文件"""
        log_files = []
        log_patterns = ['fail', 'error', 'log', 'failure']
        
        for root, dirs, files in os.walk(self.base_path):
            for f in files:
                f_lower = f.lower()
                if any(p in f_lower for p in log_patterns) and f.endswith(('.log', '.txt', '.csv')):
                    file_path = os.path.join(root, f)
                    rel_path = os.path.relpath(file_path, self.base_path)
                    log_files.append({
                        'path': rel_path,
                        'full_path': file_path,
                        'size': os.path.getsize(file_path),
                        'modified': self._format_mtime(os.path.getmtime(file_path))
                    })
        
        return log_files
    
    def parse(self, log_file):
        """解析单个日志文件"""
        result = {
            'file': log_file,
            'parsed_time': datetime.now().isoformat(),
            'total_lines': 0,
            'records': [],
            'normal_records': [],
            'late_attachments': [],
            'duplicates': [],
            'manual_corrections': [],
            'record_hash_map': {}
        }
        
        try:
            with open(log_file['full_path'], 'r', encoding='utf-8') as f:
                lines = f.readlines()
        except UnicodeDecodeError:
            with open(log_file['full_path'], 'r', encoding='gbk') as f:
                lines = f.readlines()
        
        result['total_lines'] = len(lines)
        
        for line_num, line in enumerate(lines, 1):
            line = line.strip()
            if not line:
                continue
            
            record = self._parse_log_line(line, line_num)
            if record:
                result['records'].append(record)
                
                record_hash = self._calc_record_hash(record)
                record['hash'] = record_hash
                
                if record_hash in result['record_hash_map']:
                    result['duplicates'].append({
                        'record': record,
                        'original_line': result['record_hash_map'][record_hash]
                    })
                else:
                    result['record_hash_map'][record_hash] = line_num
                
                if record.get('is_late', False):
                    result['late_attachments'].append(record)
                elif record.get('is_manual', False):
                    result['manual_corrections'].append(record)
                else:
                    result['normal_records'].append(record)
        
        result['summary'] = {
            'total_records': len(result['records']),
            'normal_count': len(result['normal_records']),
            'late_count': len(result['late_attachments']),
            'duplicate_count': len(result['duplicates']),
            'manual_count': len(result['manual_corrections'])
        }
        
        return result
    
    def _parse_log_line(self, line, line_num):
        """解析单行日志"""
        patterns = [
            self._parse_standard_format,
            self._parse_csv_format,
            self._parse_simple_format,
        ]
        
        for parser in patterns:
            result = parser(line, line_num)
            if result:
                return result
        
        return {
            'line_num': line_num,
            'raw_content': line,
            'timestamp': None,
            'type': 'unknown',
            'message': line,
            'is_normal': True,
            'is_late': False,
            'is_manual': False
        }
    
    def _parse_standard_format(self, line, line_num):
        """解析标准日志格式: [时间] [级别] 内容"""
        match = re.match(r'^\[?([\d\-:\s]+)\]?\s*\[?([A-Z]+)\]?\s*(.+)$', line)
        if match:
            time_str = match.group(1).strip()
            level = match.group(2)
            content = match.group(3)
            
            is_late = any(kw in content for kw in ['晚到', '迟到', '延迟', '补传', 'late', 'delay'])
            is_manual = any(kw in content for kw in ['人工', '手动', '更正', '修正', 'manual', 'corrected'])
            
            return {
                'line_num': line_num,
                'raw_content': line,
                'timestamp': time_str,
                'level': level,
                'type': 'standard',
                'message': content,
                'is_normal': not (is_late or is_manual),
                'is_late': is_late,
                'is_manual': is_manual
            }
        return None
    
    def _parse_csv_format(self, line, line_num):
        """解析CSV格式"""
        if ',' in line and len(line.split(',')) >= 3:
            parts = [p.strip() for p in line.split(',')]
            
            content = ' '.join(parts)
            is_late = any(kw in content for kw in ['晚到', '迟到', '延迟', '补传', 'late', 'delay'])
            is_manual = any(kw in content for kw in ['人工', '手动', '更正', '修正', 'manual', 'corrected'])
            
            return {
                'line_num': line_num,
                'raw_content': line,
                'timestamp': parts[0] if self._looks_like_time(parts[0]) else None,
                'type': 'csv',
                'fields': parts,
                'message': content,
                'is_normal': not (is_late or is_manual),
                'is_late': is_late,
                'is_manual': is_manual
            }
        return None
    
    def _parse_simple_format(self, line, line_num):
        """解析简单格式: 时间 + 内容"""
        match = re.match(r'^([\d\-:\s]{10,})\s+(.+)$', line)
        if match:
            time_str = match.group(1).strip()
            content = match.group(2)
            
            is_late = any(kw in content for kw in ['晚到', '迟到', '延迟', '补传', 'late', 'delay'])
            is_manual = any(kw in content for kw in ['人工', '手动', '更正', '修正', 'manual', 'corrected'])
            
            return {
                'line_num': line_num,
                'raw_content': line,
                'timestamp': time_str,
                'type': 'simple',
                'message': content,
                'is_normal': not (is_late or is_manual),
                'is_late': is_late,
                'is_manual': is_manual
            }
        return None
    
    def _looks_like_time(self, s):
        """判断字符串是否像时间格式"""
        return bool(re.match(r'^[\d\-:/\s]+$', s)) and len(s) >= 8
    
    def _calc_record_hash(self, record):
        """计算记录的哈希值用于查重"""
        content = record.get('message', record.get('raw_content', ''))
        content = re.sub(r'[\s\-_,.;:]+', '', content).lower()
        return hashlib.md5(content.encode('utf-8')).hexdigest()[:16]
    
    def _format_mtime(self, timestamp):
        return datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')
    
    def parse_all(self):
        """解析所有日志文件"""
        log_files = self.find_log_files()
        results = []
        
        for log_file in log_files:
            parsed = self.parse(log_file)
            results.append(parsed)
        
        return {
            'log_count': len(log_files),
            'log_files': log_files,
            'results': results
        }
