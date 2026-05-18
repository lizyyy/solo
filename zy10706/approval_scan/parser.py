import csv
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict
from dateutil import parser as date_parser
from dateutil.tz import tzutc, tzlocal

from .models import ApprovalRecord, ScanResult, NodeStatus


TIMEOUT_THRESHOLD_HOURS = 72
RESIGNED_USER_IDS = {"U001", "U005", "U009"}


class ApprovalParser:
    def __init__(self, timeout_hours: int = TIMEOUT_THRESHOLD_HOURS):
        self.timeout_threshold = timedelta(hours=timeout_hours)
        self.approval_timestamps: Dict[str, datetime] = {}

    def parse_time(self, time_str: str) -> tuple:
        if not time_str:
            return None, "时间为空"
        
        has_timezone = False
        if re.search(r'[+-]\d{2}:?\d{2}$', time_str) or 'GMT' in time_str or 'UTC' in time_str:
            has_timezone = True
        
        try:
            dt = date_parser.parse(time_str)
            issues = []
            
            if dt.tzinfo is not None:
                if has_timezone:
                    issues.append("时区混乱: 包含时区信息")
                dt_naive = dt.replace(tzinfo=None)
            else:
                dt_naive = dt
            
            return dt_naive, "; ".join(issues) if issues else None
        except Exception as e:
            return None, f"时间解析失败: {str(e)}"

    def detect_rollback(self, approval_id: str, current_time: datetime) -> bool:
        if approval_id in self.approval_timestamps:
            prev_time = self.approval_timestamps[approval_id]
            if current_time < prev_time:
                return True
        self.approval_timestamps[approval_id] = current_time
        return False

    def check_timeout(self, action_time: datetime, reference_time: datetime = None) -> bool:
        if reference_time is None:
            reference_time = datetime.now()
        return (reference_time - action_time) > self.timeout_threshold

    def is_resigned(self, approver_id: str) -> bool:
        return approver_id in RESIGNED_USER_IDS

    def parse_line(self, line: str, file_name: str, line_number: int) -> ApprovalRecord:
        parts = [p.strip() for p in line.split('\t')]
        
        if len(parts) < 6:
            raise ValueError(f"字段不足，需要至少6个字段，实际{len(parts)}个")
        
        approval_id = parts[0]
        node_name = parts[1]
        approver = parts[2]
        approver_id = parts[3]
        action_time_str = parts[4]
        is_proxy = len(parts) > 5 and parts[5].lower() in ['是', 'true', 'yes', '代理']
        proxy_from = parts[6] if len(parts) > 6 else None
        
        action_time, time_issue = self.parse_time(action_time_str)
        
        record = ApprovalRecord(
            file_name=file_name,
            line_number=line_number,
            approval_id=approval_id,
            node_name=node_name,
            approver=approver,
            approver_id=approver_id,
            action_time=action_time or datetime.min,
            raw_time_str=action_time_str
        )
        
        if is_proxy:
            record.is_proxy = True
            record.proxy_from = proxy_from
        
        if time_issue:
            record.issues.append(time_issue)
        
        if action_time:
            if self.detect_rollback(approval_id, action_time):
                record.issues.append("节点回退: 时间早于前一节点")
            
            if self.check_timeout(action_time):
                record.status = NodeStatus.TIMEOUT
        
        if self.is_resigned(approver_id):
            if record.status == NodeStatus.NORMAL:
                record.status = NodeStatus.RESIGNED
            else:
                record.issues.append("同时标记为离职")
        
        return record

    def parse_file(self, file_path: Path) -> ScanResult:
        result = ScanResult()
        file_name = file_path.name
        
        with open(file_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.rstrip('\n')
                if not line or line.startswith('#'):
                    continue
                
                try:
                    record = self.parse_line(line, file_name, line_num)
                    result.add_record(record)
                except Exception as e:
                    result.add_bad_line(file_name, line_num, str(e), line)
        
        return result

    def parse_files(self, file_paths: List[Path]) -> ScanResult:
        total_result = ScanResult()
        
        for file_path in file_paths:
            file_result = self.parse_file(file_path)
            total_result.records.extend(file_result.records)
            total_result.bad_lines.extend(file_result.bad_lines)
            total_result.total_records += file_result.total_records
            total_result.timeout_count += file_result.timeout_count
            total_result.resigned_count += file_result.resigned_count
            total_result.proxy_count += file_result.proxy_count
            total_result.timezone_issue_count += file_result.timezone_issue_count
            total_result.rollback_count += file_result.rollback_count
            total_result.bad_line_count += file_result.bad_line_count
        
        return total_result
