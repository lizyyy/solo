import csv
import json
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..rules.engine import MatchResult, NotificationStatus
from ..tracker.source_tracker import TrackedRecord


class ReportFormat(Enum):
    JSON = "json"
    CSV = "csv"
    TEXT = "text"


@dataclass
class ReportOptions:
    include_summary: bool = True
    include_errors: bool = True
    include_duplicates: bool = True
    include_source: bool = True
    group_by: Optional[str] = None
    pretty_print: bool = True


class ReportGenerator:
    def __init__(self, options: Optional[ReportOptions] = None):
        self.options = options or ReportOptions()

    def generate(self, match_results: List[MatchResult], 
                 tracked_records: List[TrackedRecord],
                 summary: Dict[str, Any],
                 output_path: str,
                 format: ReportFormat = ReportFormat.JSON) -> str:
        output_path = Path(output_path)
        
        if format == ReportFormat.JSON:
            return self._generate_json(match_results, tracked_records, summary, output_path)
        elif format == ReportFormat.CSV:
            return self._generate_csv(match_results, tracked_records, summary, output_path)
        elif format == ReportFormat.TEXT:
            return self._generate_text(match_results, tracked_records, summary, output_path)
        else:
            raise ValueError(f"不支持的报告格式: {format}")

    def _generate_json(self, match_results: List[MatchResult],
                       tracked_records: List[TrackedRecord],
                       summary: Dict[str, Any],
                       output_path: Path) -> str:
        report_data: Dict[str, Any] = {
            "generated_at": datetime.now().isoformat(),
            "summary": summary if self.options.include_summary else None,
        }

        if self.options.group_by == "subscriber":
            report_data["results_by_subscriber"] = self._group_by_subscriber_json(match_results)
        elif self.options.group_by == "batch":
            report_data["results_by_batch"] = self._group_by_batch_json(match_results)
        else:
            report_data["results"] = [r.to_dict() for r in match_results]

        if self.options.include_errors:
            errors = [r for r in tracked_records if r.error is not None]
            report_data["errors"] = [e.to_dict() for e in errors]

        if self.options.include_duplicates:
            duplicates = [r for r in match_results if r.is_duplicate]
            report_data["duplicates"] = [d.to_dict() for d in duplicates]

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            if self.options.pretty_print:
                json.dump(report_data, f, ensure_ascii=False, indent=2)
            else:
                json.dump(report_data, f, ensure_ascii=False, separators=(',', ':'))

        return str(output_path)

    def _group_by_subscriber_json(self, match_results: List[MatchResult]) -> Dict[str, List[Dict]]:
        groups: Dict[str, List[MatchResult]] = {}
        for result in match_results:
            if result.tracked_record.record:
                subscriber = result.tracked_record.record.subscriber
                if subscriber not in groups:
                    groups[subscriber] = []
                groups[subscriber].append(result)
        
        result_dict = {}
        for subscriber in sorted(groups.keys()):
            result_dict[subscriber] = [r.to_dict() for r in groups[subscriber]]
        return result_dict

    def _group_by_batch_json(self, match_results: List[MatchResult]) -> Dict[str, List[Dict]]:
        groups: Dict[str, List[MatchResult]] = {}
        for result in match_results:
            if result.tracked_record.record:
                batch_id = result.tracked_record.record.batch_id
                if batch_id not in groups:
                    groups[batch_id] = []
                groups[batch_id].append(result)
        
        result_dict = {}
        for batch_id in sorted(groups.keys()):
            result_dict[batch_id] = [r.to_dict() for r in groups[batch_id]]
        return result_dict

    def _generate_csv(self, match_results: List[MatchResult],
                      tracked_records: List[TrackedRecord],
                      summary: Dict[str, Any],
                      output_path: Path) -> str:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            if self.options.include_summary:
                writer.writerow(["【汇总信息】"])
                for key, value in summary.items():
                    if isinstance(value, dict):
                        writer.writerow([key])
                        for k, v in value.items():
                            writer.writerow(["", k, v])
                    else:
                        writer.writerow([key, value])
                writer.writerow([])

            writer.writerow(["【处理结果】"])
            headers = ["序号", "记录ID", "接口路径", "订阅方", "变更类型", "批次ID", 
                      "通知状态", "超时小时", "是否重复", "需补发", "补发原因", "来源位置"]
            writer.writerow(headers)

            for idx, result in enumerate(match_results, 1):
                record = result.tracked_record.record
                writer.writerow([
                    idx,
                    result.tracked_record.record_id,
                    record.api_path if record else "",
                    record.subscriber if record else "",
                    record.change_type.value if record else "",
                    record.batch_id if record else "",
                    result.status.value,
                    result.timeout_hours if result.timeout_hours else "",
                    "是" if result.is_duplicate else "否",
                    "是" if result.need_reissue else "否",
                    result.reissue_reason if result.reissue_reason else "",
                    result.tracked_record.source_location.to_string()
                ])

            if self.options.include_errors:
                writer.writerow([])
                writer.writerow(["【解析错误】"])
                writer.writerow(["序号", "文件路径", "行号", "错误信息", "原始内容"])
                errors = [r for r in tracked_records if r.error is not None]
                for idx, tracked in enumerate(errors, 1):
                    error = tracked.error
                    writer.writerow([
                        idx,
                        error.file_path,
                        error.line_number,
                        error.error_message,
                        error.raw_content
                    ])

            if self.options.include_duplicates:
                writer.writerow([])
                writer.writerow(["【重复通知】"])
                writer.writerow(["序号", "记录ID", "接口路径", "订阅方", "批次ID", "重复Key"])
                duplicates = [r for r in match_results if r.is_duplicate]
                for idx, result in enumerate(duplicates, 1):
                    record = result.tracked_record.record
                    writer.writerow([
                        idx,
                        result.tracked_record.record_id,
                        record.api_path if record else "",
                        record.subscriber if record else "",
                        record.batch_id if record else "",
                        result.duplicate_of
                    ])

        return str(output_path)

    def _generate_text(self, match_results: List[MatchResult],
                       tracked_records: List[TrackedRecord],
                       summary: Dict[str, Any],
                       output_path: Path) -> str:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        lines = []
        lines.append("=" * 80)
        lines.append("接口变更订阅确认超时排查报告")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 80)
        lines.append("")

        if self.options.include_summary:
            lines.append("【汇总信息】")
            lines.append("-" * 40)
            for key, value in summary.items():
                if isinstance(value, dict):
                    lines.append(f"{key}:")
                    for k, v in value.items():
                        lines.append(f"  {k}: {v}")
                else:
                    lines.append(f"{key}: {value}")
            lines.append("")

        lines.append("【超时未确认列表】")
        lines.append("-" * 40)
        timeout_records = [r for r in match_results if r.status == NotificationStatus.TIMEOUT]
        if timeout_records:
            for idx, result in enumerate(timeout_records, 1):
                record = result.tracked_record.record
                lines.append(f"{idx}. {record.subscriber} - {record.api_path}")
                lines.append(f"   批次: {record.batch_id}")
                lines.append(f"   超时: {result.timeout_hours}小时")
                lines.append(f"   来源: {result.tracked_record.source_location.to_string()}")
                lines.append("")
        else:
            lines.append("无超时未确认记录")
            lines.append("")

        lines.append("【待确认列表】")
        lines.append("-" * 40)
        pending_records = [r for r in match_results if r.status == NotificationStatus.PENDING]
        if pending_records:
            for idx, result in enumerate(pending_records, 1):
                record = result.tracked_record.record
                lines.append(f"{idx}. {record.subscriber} - {record.api_path}")
                lines.append(f"   批次: {record.batch_id}")
                lines.append(f"   来源: {result.tracked_record.source_location.to_string()}")
                lines.append("")
        else:
            lines.append("无待确认记录")
            lines.append("")

        lines.append("【需补发列表】")
        lines.append("-" * 40)
        reissue_records = [r for r in match_results if r.need_reissue]
        if reissue_records:
            for idx, result in enumerate(reissue_records, 1):
                record = result.tracked_record.record
                lines.append(f"{idx}. {record.subscriber} - {record.api_path}")
                lines.append(f"   批次: {record.batch_id}")
                lines.append(f"   原因: {result.reissue_reason}")
                lines.append(f"   来源: {result.tracked_record.source_location.to_string()}")
                lines.append("")
        else:
            lines.append("无需补发记录")
            lines.append("")

        if self.options.include_errors:
            lines.append("【解析错误】")
            lines.append("-" * 40)
            errors = [r for r in tracked_records if r.error is not None]
            if errors:
                for idx, tracked in enumerate(errors, 1):
                    error = tracked.error
                    lines.append(f"{idx}. {error.file_path}:{error.line_number}")
                    lines.append(f"   错误: {error.error_message}")
                    lines.append(f"   内容: {error.raw_content[:100]}...")
                    lines.append("")
            else:
                lines.append("无解析错误")
                lines.append("")

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

        return str(output_path)

    def generate_subscriber_report(self, match_results: List[MatchResult],
                                   subscriber: str, output_path: str) -> str:
        subscriber_results = [r for r in match_results 
                            if r.tracked_record.record and r.tracked_record.record.subscriber == subscriber]
        
        summary = {
            "subscriber": subscriber,
            "total_count": len(subscriber_results),
            "timeout_count": len([r for r in subscriber_results if r.status == NotificationStatus.TIMEOUT]),
            "pending_count": len([r for r in subscriber_results if r.status == NotificationStatus.PENDING]),
            "confirmed_count": len([r for r in subscriber_results if r.status == NotificationStatus.CONFIRMED])
        }

        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("=" * 60 + "\n")
            f.write(f"订阅方专属报告: {subscriber}\n")
            f.write("=" * 60 + "\n\n")
            
            for key, value in summary.items():
                f.write(f"{key}: {value}\n")
            f.write("\n")

            f.write("【需要关注的变更】\n")
            f.write("-" * 40 + "\n")
            for result in [r for r in subscriber_results if r.status in [NotificationStatus.TIMEOUT, NotificationStatus.PENDING]]:
                record = result.tracked_record.record
                f.write(f"[{result.status.value}] {record.api_path}\n")
                f.write(f"  批次: {record.batch_id}\n")
                f.write(f"  类型: {record.change_type.value}\n")
                if result.timeout_hours:
                    f.write(f"  已超时: {result.timeout_hours}小时\n")
                f.write("\n")

        return str(output_path)
