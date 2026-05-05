import os
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple, Optional
from collections import defaultdict

from .parser import ParsedLogLine, BadLine, LogLevel


class LogAnalyzer:
    def __init__(self, timezone_offset: int = 8):
        self.timezone_offset = timezone_offset
        self.bad_lines: List[BadLine] = []
        self.valid_lines: List[ParsedLogLine] = []
        self.incidents: Dict[str, Dict[str, List[ParsedLogLine]]] = defaultdict(
            lambda: defaultdict(list)
        )
        self.stats: Dict[str, Any] = {
            "total_lines": 0,
            "valid_lines": 0,
            "bad_lines": 0,
            "devices": set(),
            "error_codes": set(),
            "time_range": {"start": None, "end": None},
        }

    def analyze(self, parsed_lines: List[ParsedLogLine]) -> Tuple[List[BadLine], Dict[str, Any]]:
        self.stats["total_lines"] = len(parsed_lines)
        
        sorted_lines = self._sort_by_timestamp(parsed_lines)
        
        self._detect_time_order_issues(sorted_lines)
        
        self._detect_midnight_crossing_issues(sorted_lines)
        
        for line in sorted_lines:
            if line.is_valid:
                self._process_valid_line(line)
            else:
                self._process_bad_line(line)
        
        self._finalize_stats()
        
        return self.bad_lines, self.stats

    def _sort_by_timestamp(self, lines: List[ParsedLogLine]) -> List[ParsedLogLine]:
        def sort_key(line: ParsedLogLine) -> Tuple[int, datetime, int]:
            if line.timestamp:
                return (0, line.timestamp, line.line_number)
            return (1, datetime.max, line.line_number)
        
        return sorted(lines, key=sort_key)

    def _detect_time_order_issues(self, sorted_lines: List[ParsedLogLine]):
        prev_timestamp: Optional[datetime] = None
        prev_line: Optional[ParsedLogLine] = None
        
        for line in sorted_lines:
            if line.timestamp:
                if prev_timestamp and line.timestamp < prev_timestamp:
                    if prev_line:
                        if "time_out_of_order" not in prev_line.issues:
                            prev_line.issues.append("time_out_of_order")
                            prev_line.is_valid = False
                    
                    line.issues.append("time_out_of_order")
                    line.is_valid = False
                
                prev_timestamp = line.timestamp
                prev_line = line

    def _detect_midnight_crossing_issues(self, sorted_lines: List[ParsedLogLine]):
        if len(sorted_lines) < 2:
            return
        
        for i in range(1, len(sorted_lines)):
            prev_line = sorted_lines[i-1]
            curr_line = sorted_lines[i]
            
            if not prev_line.timestamp or not curr_line.timestamp:
                continue
            
            time_diff = curr_line.timestamp - prev_line.timestamp
            
            if time_diff > timedelta(hours=12):
                prev_hour = prev_line.timestamp.hour
                curr_hour = curr_line.timestamp.hour
                
                if (22 <= prev_hour <= 23) and (0 <= curr_hour <= 6):
                    pass
                else:
                    reason = f"midnight_crossing_suspicious: gap of {time_diff.total_seconds()/3600:.1f}h between lines"
                    prev_line.issues.append(reason)
                    curr_line.issues.append(reason)
                    prev_line.is_valid = False
                    curr_line.is_valid = False

    def _process_valid_line(self, line: ParsedLogLine):
        self.valid_lines.append(line)
        
        if line.device_id:
            self.stats["devices"].add(line.device_id)
        
        if line.error_code:
            self.stats["error_codes"].add(line.error_code)
        
        if line.timestamp:
            if not self.stats["time_range"]["start"] or line.timestamp < self.stats["time_range"]["start"]:
                self.stats["time_range"]["start"] = line.timestamp
            if not self.stats["time_range"]["end"] or line.timestamp > self.stats["time_range"]["end"]:
                self.stats["time_range"]["end"] = line.timestamp
        
        if line.level in [LogLevel.ERROR, LogLevel.WARN]:
            device_key = line.device_id or "UNKNOWN_DEVICE"
            error_key = line.error_code or "NO_ERROR_CODE"
            self.incidents[device_key][error_key].append(line)

    def _process_bad_line(self, line: ParsedLogLine):
        reasons = line.issues.copy() if line.issues else ["unknown_issue"]
        
        if not line.matched_template:
            if "no_matching_template" not in reasons:
                reasons.append("no_matching_template")
        
        if not line.timestamp:
            if "missing_timestamp" not in reasons:
                reasons.append("missing_timestamp")
        
        if not line.is_valid and not reasons:
            reasons.append("marked_invalid_but_no_reason")
        
        bad_line = BadLine(
            original_line=line.original_line,
            line_number=line.line_number,
            file_path=line.file_path,
            reasons=reasons,
            parsed_fields={
                "timestamp": line.timestamp.isoformat() if line.timestamp else None,
                "device_id": line.device_id,
                "level": line.level.value if line.level else None,
                "module": line.module,
                "message": line.message,
                "error_code": line.error_code,
                "batch_id": line.batch_id,
                "matched_template": line.matched_template,
            }
        )
        
        self.bad_lines.append(bad_line)

    def _finalize_stats(self):
        self.stats["valid_lines"] = len(self.valid_lines)
        self.stats["bad_lines"] = len(self.bad_lines)
        self.stats["devices"] = list(self.stats["devices"])
        self.stats["error_codes"] = list(self.stats["error_codes"])
        
        if self.stats["time_range"]["start"]:
            self.stats["time_range"]["start"] = self.stats["time_range"]["start"].isoformat()
        if self.stats["time_range"]["end"]:
            self.stats["time_range"]["end"] = self.stats["time_range"]["end"].isoformat()
    
    def get_incidents_summary(self) -> Dict[str, Any]:
        summary = {
            "total_incidents": 0,
            "by_device": {},
            "by_error_code": {},
        }
        
        all_incidents = []
        for device, error_map in self.incidents.items():
            device_count = 0
            device_summary = {}
            
            for error_code, lines in error_map.items():
                count = len(lines)
                device_count += count
                summary["total_incidents"] += count
                
                device_summary[error_code] = {
                    "count": count,
                    "lines": [
                        {
                            "timestamp": l.timestamp.isoformat() if l.timestamp else None,
                            "line_number": l.line_number,
                            "message": l.message,
                            "level": l.level.value,
                        }
                        for l in lines
                    ]
                }
                
                if error_code not in summary["by_error_code"]:
                    summary["by_error_code"][error_code] = {
                        "count": 0,
                        "devices": [],
                    }
                summary["by_error_code"][error_code]["count"] += count
                if device not in summary["by_error_code"][error_code]["devices"]:
                    summary["by_error_code"][error_code]["devices"].append(device)
                
                all_incidents.extend(lines)
            
            summary["by_device"][device] = {
                "count": device_count,
                "errors": device_summary,
            }
        
        if all_incidents:
            all_incidents.sort(key=lambda x: x.timestamp if x.timestamp else datetime.max)
            summary["timeline"] = [
                {
                    "timestamp": l.timestamp.isoformat() if l.timestamp else None,
                    "device": l.device_id,
                    "error_code": l.error_code,
                    "level": l.level.value,
                    "message": l.message,
                    "line_number": l.line_number,
                }
                for l in all_incidents
            ]
        
        return summary


def archive_bad_lines(bad_lines: List[BadLine], output_path: str):
    dir_name = os.path.dirname(output_path)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        for bad_line in bad_lines:
            json.dump(bad_line.to_dict(), f, ensure_ascii=False)
            f.write("\n")
    
    return len(bad_lines)
