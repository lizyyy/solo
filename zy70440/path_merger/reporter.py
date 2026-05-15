import json
from pathlib import Path
from typing import Optional
from datetime import datetime

from .models import MergeResult, PathStatus, IssueType
from .query import QueryEngine


class ReportGenerator:
    def __init__(self, report_dir: str = "./data/reports"):
        self.report_dir = Path(report_dir)
        self.report_dir.mkdir(parents=True, exist_ok=True)
        self.query_engine = QueryEngine()

    def generate_report(self, result: MergeResult, include_details: bool = True) -> str:
        report_lines = []

        report_lines.append("=" * 80)
        report_lines.append(f"路径归并处理报告 - 批次 {result.batch_id}")
        report_lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("=" * 80)
        report_lines.append("")

        report_lines.append("【执行概览】")
        report_lines.append(f"  处理时间: {result.start_time.strftime('%Y-%m-%d %H:%M:%S')} -> {result.end_time.strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append(f"  执行耗时: {result.execution_time_ms:.2f} ms")
        report_lines.append(f"  总记录数: {result.total_records}")
        report_lines.append(f"  成功: {result.success_count} 条")
        report_lines.append(f"  失败: {result.failed_count} 条")
        report_lines.append(f"  冲突: {result.conflict_count} 条")
        report_lines.append(f"  跳过(复用): {result.skipped_count} 条")
        report_lines.append(f"  人工修正: {result.manual_fix_count} 条")
        report_lines.append("")

        report_lines.append("【建议事项】")
        for i, suggestion in enumerate(result.suggestions, 1):
            report_lines.append(f"  {i}. {suggestion}")
        report_lines.append("")

        report_lines.append("【问题统计】")
        issue_stats = {}
        for record in result.records:
            for issue in record.issues:
                issue_type = issue.get('type', 'unknown')
                issue_stats[issue_type] = issue_stats.get(issue_type, 0) + 1

        for issue_type, count in issue_stats.items():
            report_lines.append(f"  {issue_type}: {count} 条")
        report_lines.append("")

        if include_details:
            report_lines.append("【处理详情 - 前后对比】")
            report_lines.append("-" * 80)

            for i, record in enumerate(result.records, 1):
                report_lines.append(f"")
                report_lines.append(f"记录 {i}: {record.record_id}")
                report_lines.append(f"  录音ID: {record.recording_id}")
                report_lines.append(f"  坐席ID: {record.agent_id}")
                report_lines.append(f"  客户ID: {record.customer_id}")
                report_lines.append(f"  时间: {record.start_time.strftime('%Y-%m-%d %H:%M:%S')} -> {record.end_time.strftime('%Y-%m-%d %H:%M:%S')}")
                report_lines.append(f"  状态: {record.status.value}")
                report_lines.append(f"  处理耗时: {record.execution_time_ms:.2f} ms")

                if record.is_manual_fix:
                    report_lines.append(f"  【人工修正】")
                    report_lines.append(f"    修正时间: {record.fix_time.strftime('%Y-%m-%d %H:%M:%S') if record.fix_time else 'N/A'}")
                    report_lines.append(f"    修正原因: {record.fix_reason or 'N/A'}")
                    report_lines.append(f"    来源批次: {record.batch_id}")

                report_lines.append(f"  权限路径 ({len(record.permission_path)}):")
                for j, path in enumerate(record.permission_path, 1):
                    report_lines.append(f"    {j}. {path}")

                report_lines.append(f"  实际路径 ({len(record.actual_path)}):")
                for j, path in enumerate(record.actual_path, 1):
                    report_lines.append(f"    {j}. {path}")

                if record.merged_path:
                    report_lines.append(f"  归并后路径 ({len(record.merged_path)}):")
                    for j, path in enumerate(record.merged_path, 1):
                        mark = " *" if path not in record.permission_path else ""
                        report_lines.append(f"    {j}. {path}{mark}")

                if record.issues:
                    report_lines.append(f"  问题 ({len(record.issues)}):")
                    for j, issue in enumerate(record.issues, 1):
                        severity = issue.get('severity', 'unknown')
                        message = issue.get('message', 'N/A')
                        report_lines.append(f"    {j}. [{severity}] {message}")

                report_lines.append("")

        report_lines.append("")
        report_lines.append("=" * 80)
        report_lines.append("报告结束")
        report_lines.append("=" * 80)

        return "\n".join(report_lines)

    def save_report(self, result: MergeResult, format: str = "txt") -> str:
        report_content = self.generate_report(result)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"report_{result.batch_id}_{timestamp}.{format}"
        report_path = self.report_dir / filename

        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report_content)

        json_filename = f"report_{result.batch_id}_{timestamp}.json"
        json_path = self.report_dir / json_filename
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(result.model_dump(), f, ensure_ascii=False, indent=2, default=str)

        return str(report_path)

    def generate_comparison_report(self, batch_id: str) -> str:
        result = self.query_engine.load_result(batch_id)
        if not result:
            return f"批次 {batch_id} 未找到"

        lines = []
        lines.append("=" * 80)
        lines.append(f"路径归并对比分析报告 - 批次 {batch_id}")
        lines.append("=" * 80)
        lines.append("")

        for record in result.records:
            lines.append(f"【记录 {record.record_id}】")
            lines.append(f"  状态: {record.status.value}")

            p_set = set(record.permission_path)
            a_set = set(record.actual_path)
            m_set = set(record.merged_path or [])

            lines.append(f"  路径统计:")
            lines.append(f"    权限路径: {len(p_set)} 个唯一节点")
            lines.append(f"    实际路径: {len(a_set)} 个唯一节点")
            lines.append(f"    归并路径: {len(m_set)} 个唯一节点")

            only_in_permission = p_set - a_set
            only_in_actual = a_set - p_set
            common = p_set & a_set

            if only_in_permission:
                lines.append(f"    仅在权限路径: {len(only_in_permission)} 个")
            if only_in_actual:
                lines.append(f"    仅在实际路径: {len(only_in_actual)} 个")
            lines.append(f"    共同路径: {len(common)} 个")

            over_granted = m_set - p_set
            if over_granted:
                lines.append(f"  ⚠️  权限放大检测: 发现 {len(over_granted)} 个额外路径")
                for path in sorted(over_granted):
                    lines.append(f"    - {path}")

            lines.append("")

        return "\n".join(lines)

    def print_summary(self, result: MergeResult) -> None:
        print("=" * 60)
        print(f"批次 {result.batch_id} 处理完成")
        print("=" * 60)
        print(f"总记录: {result.total_records} | 成功: {result.success_count} | 失败: {result.failed_count} | 冲突: {result.conflict_count}")
        print(f"执行时间: {result.execution_time_ms:.2f} ms")
        print()
        print("建议:")
        for suggestion in result.suggestions[:3]:
            print(f"  - {suggestion}")
        print()
