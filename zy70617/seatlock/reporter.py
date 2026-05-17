import csv
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from io import StringIO

from .models import Issue, IssueType
from .rules import SeatLockRuleEngine


class ReportGenerator:
    def __init__(self, engine: SeatLockRuleEngine, run_id: str = None, check_time: datetime = None):
        self.engine = engine
        self.stats = engine.get_lock_statistics()
        self.run_id = run_id or "unknown"
        self.check_time = check_time or datetime.now()
        self.report_id = self.run_id
    
    def _get_severity_order(self, severity: str) -> int:
        order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        return order.get(severity, 99)
    
    def _sort_issues(self, issues: List[Issue]) -> List[Issue]:
        return sorted(issues, key=lambda x: (self._get_severity_order(x.severity), x.issue_id))
    
    def generate_text_report(self, show_details: bool = True) -> str:
        output = StringIO()
        
        output.write("=" * 80 + "\n")
        output.write(f"团体锁座换座超时释放排查报告\n")
        output.write(f"运行ID: {self.run_id}\n")
        output.write(f"生成时间: {self.check_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        output.write("=" * 80 + "\n\n")
        
        output.write("【统计概览】\n")
        output.write(f"  演出场次: {self.stats['total_shows']}\n")
        output.write(f"  座位总数: {self.stats['total_seats']}\n")
        output.write(f"  团体订单: {self.stats['total_orders']}\n")
        output.write(f"  保留窗口: {self.stats['total_windows']}\n")
        output.write(f"  锁座记录: {self.stats['total_locks']}\n")
        output.write(f"  - 活跃锁: {self.stats['active_locks']}\n")
        output.write(f"  - 超时锁: {self.stats['expired_locks']}\n")
        output.write(f"  - 已释放: {self.stats['released_locks']}\n")
        output.write(f"  待处理换座: {self.stats['pending_changes']}\n")
        output.write(f"\n")
        
        output.write(f"【问题统计】 共发现 {self.stats['total_issues']} 个问题\n")
        output.write(f"  按严重程度:\n")
        for severity in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
            count = self.stats['issues_by_severity'].get(severity, 0)
            if count > 0:
                output.write(f"    - {severity}: {count}\n")
        
        output.write(f"\n  按问题类型:\n")
        for issue_type in sorted(self.stats['issues_by_type'].keys()):
            count = self.stats['issues_by_type'][issue_type]
            output.write(f"    - {issue_type}: {count}\n")
        output.write("\n")
        
        if show_details and self.engine.issues:
            output.write("=" * 80 + "\n")
            output.write("【问题详情】\n")
            output.write("=" * 80 + "\n\n")
            
            sorted_issues = self._sort_issues(self.engine.issues)
            
            for i, issue in enumerate(sorted_issues, 1):
                output.write(f"#{i} [{issue.severity}] {issue.issue_type.value}\n")
                output.write(f"    问题ID: {issue.issue_id}\n")
                output.write(f"    演出ID: {issue.show_id}\n")
                output.write(f"    描述: {issue.description}\n")
                if issue.related_ids:
                    for key in sorted(issue.related_ids.keys()):
                        ids = issue.related_ids[key]
                        if ids:
                            output.write(f"    关联{key}: {', '.join(sorted(ids))}\n")
                output.write(f"    发现时间: {issue.discovered_at.strftime('%Y-%m-%d %H:%M:%S')}\n")
                if issue.source_trace:
                    output.write(f"    来源: {issue.source_trace.source_file}:{issue.source_trace.line_number}\n")
                output.write("\n")
            
            output.write("=" * 80 + "\n")
            output.write("【超时锁座明细】\n")
            output.write("=" * 80 + "\n\n")
            expired = sorted(self.engine.get_expired_locks_detail(), key=lambda x: x['lock_id'])
            if expired:
                for i, detail in enumerate(expired, 1):
                    output.write(f"#{i} 锁ID: {detail['lock_id']}\n")
                    output.write(f"    座位ID: {detail['seat_id']}\n")
                    output.write(f"    订单ID: {detail['order_id']}\n")
                    output.write(f"    超时时长: {detail['timeout_minutes']}分钟\n")
                    output.write(f"    锁创建时间: {detail['locked_at']}\n")
                    output.write(f"    超时时间: {detail['lock_timeout']}\n")
                    output.write("\n")
            else:
                output.write("无超时锁座\n\n")
            
            output.write("=" * 80 + "\n")
            output.write("【座位冲突明细】\n")
            output.write("=" * 80 + "\n\n")
            conflicts = sorted(self.engine.get_conflict_seats_detail(), key=lambda x: x['seat_id'])
            if conflicts:
                for i, detail in enumerate(conflicts, 1):
                    output.write(f"#{i} 座位ID: {detail['seat_id']}\n")
                    output.write(f"    活跃锁数量: {detail['active_lock_count']}\n")
                    output.write(f"    涉及锁ID: {', '.join(sorted(detail['lock_ids']))}\n")
                    output.write(f"    涉及订单: {', '.join(sorted(detail['order_ids']))}\n")
                    output.write("\n")
            else:
                output.write("无座位冲突\n\n")
        
        return output.getvalue()
    
    def generate_json_report(self) -> str:
        sorted_issues = self._sort_issues(self.engine.issues)
        expired_detail = sorted(self.engine.get_expired_locks_detail(), key=lambda x: x['lock_id'])
        conflict_detail = sorted(self.engine.get_conflict_seats_detail(), key=lambda x: x['seat_id'])
        
        report = {
            "report_metadata": {
                "run_id": self.run_id,
                "report_id": self.report_id,
                "generated_at": self.check_time.isoformat(),
                "version": "1.0.0"
            },
            "statistics": self.stats,
            "issues": [issue.to_dict() for issue in sorted_issues],
            "expired_locks_detail": expired_detail,
            "conflict_seats_detail": conflict_detail
        }
        return json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True)
    
    def generate_csv_report(self, output_dir: str) -> Dict[str, str]:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        files_generated = {}
        
        sorted_issues = self._sort_issues(self.engine.issues)
        issues_file = output_path / f"seatlock_issues_{self.run_id}.csv"
        with open(issues_file, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["序号", "问题ID", "问题类型", "演出ID", "严重程度", "描述", "关联ID", "发现时间", "来源文件", "行号"])
            for i, issue in enumerate(sorted_issues, 1):
                related_str = json.dumps(issue.related_ids, ensure_ascii=False, sort_keys=True) if issue.related_ids else ""
                source_file = issue.source_trace.source_file if issue.source_trace else ""
                line_number = issue.source_trace.line_number if issue.source_trace else ""
                writer.writerow([
                    i, issue.issue_id, issue.issue_type.value, issue.show_id,
                    issue.severity, issue.description, related_str,
                    issue.discovered_at.isoformat(), source_file, line_number
                ])
        files_generated["issues"] = str(issues_file)
        
        expired = sorted(self.engine.get_expired_locks_detail(), key=lambda x: x['lock_id'])
        expired_file = output_path / f"expired_locks_{self.run_id}.csv"
        with open(expired_file, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["序号", "锁ID", "座位ID", "订单ID", "超时时长(分钟)", "锁创建时间", "超时时间"])
            for i, detail in enumerate(expired, 1):
                writer.writerow([
                    i, detail["lock_id"], detail["seat_id"], detail["order_id"],
                    detail["timeout_minutes"], detail["locked_at"], detail["lock_timeout"]
                ])
        files_generated["expired_locks"] = str(expired_file)
        
        conflicts = sorted(self.engine.get_conflict_seats_detail(), key=lambda x: x['seat_id'])
        conflicts_file = output_path / f"conflict_seats_{self.run_id}.csv"
        with open(conflicts_file, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["序号", "座位ID", "活跃锁数量", "涉及锁ID", "涉及订单ID"])
            for i, detail in enumerate(conflicts, 1):
                writer.writerow([
                    i, detail["seat_id"], detail["active_lock_count"],
                    ", ".join(sorted(detail["lock_ids"])), ", ".join(sorted(detail["order_ids"]))
                ])
        files_generated["conflict_seats"] = str(conflicts_file)
        
        stats_file = output_path / f"statistics_{self.run_id}.csv"
        with open(stats_file, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["统计项", "数值"])
            writer.writerow(["演出场次", self.stats["total_shows"]])
            writer.writerow(["座位总数", self.stats["total_seats"]])
            writer.writerow(["团体订单", self.stats["total_orders"]])
            writer.writerow(["保留窗口", self.stats["total_windows"]])
            writer.writerow(["锁座记录", self.stats["total_locks"]])
            writer.writerow(["活跃锁", self.stats["active_locks"]])
            writer.writerow(["超时锁", self.stats["expired_locks"]])
            writer.writerow(["已释放锁", self.stats["released_locks"]])
            writer.writerow(["待处理换座", self.stats["pending_changes"]])
            writer.writerow(["总问题数", self.stats["total_issues"]])
        files_generated["statistics"] = str(stats_file)
        
        return files_generated
    
    def save_report(self, output_file: str, format: str = "text") -> str:
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        if format == "text":
            content = self.generate_text_report()
            output_path.write_text(content, encoding='utf-8')
        elif format == "json":
            content = self.generate_json_report()
            output_path.write_text(content, encoding='utf-8')
        else:
            raise ValueError(f"不支持的格式: {format}")
        
        return str(output_path)
