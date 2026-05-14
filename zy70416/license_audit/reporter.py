from typing import List, Optional
from datetime import datetime
from pathlib import Path

from .models import AuditResult, AuditRecord, Dependency, ManualStatus, DetectionStatus
from .storage import Storage


class Reporter:
    def __init__(self, storage: Storage):
        self.storage = storage

    def generate_text_report(self, result: AuditResult, output_path: str) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("依赖许可证巡检报告")
        lines.append(f"生成时间: {result.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 80)
        lines.append("")

        lines.append("统计汇总:")
        lines.append(f"  总依赖数: {result.total_dependencies}")
        lines.append(f"  通过: {result.pass_count}")
        lines.append(f"  失败: {result.fail_count}")
        lines.append(f"  警告: {result.warning_count}")
        lines.append(f"  待处理: {result.pending_count}")
        lines.append("")

        lines.append("-" * 80)
        lines.append("审计记录详情:")
        lines.append("-" * 80)
        lines.append("")

        for i, record in enumerate(result.records, 1):
            lines.append(f"[{i}] {record.dependency_name} (环境: {record.environment_name})")
            lines.append(f"    规则: {record.detection_rule_name}")
            lines.append(f"    系统判断: {record.system_status.value}")
            lines.append(f"    系统原因: {record.system_reason}")
            if record.manual_status:
                lines.append(f"    人工状态: {record.manual_status.value}")
                lines.append(f"    人工备注: {record.manual_remark}")
                lines.append(f"    操作人: {record.operator}")
            if record.field_errors:
                lines.append("    字段错误:")
                for error in record.field_errors:
                    lines.append(f"      - {error.field_name}: {error.error_message}")
                    if error.actual_value is not None:
                        lines.append(f"        实际值: {error.actual_value}")
                    if error.source_location:
                        loc = error.source_location
                        loc_str = loc.file_path
                        if loc.line_number:
                            loc_str += f":{loc.line_number}"
                        lines.append(f"        位置: {loc_str}")
            lines.append("")

        lines.append("-" * 80)
        lines.append("取证目录 (可追溯至原始输入):")
        lines.append("-" * 80)
        lines.append("")

        for i, evidence in enumerate(result.evidences, 1):
            lines.append(f"[{i}] 字段: {evidence.field_name}")
            lines.append(f"    原始值: {evidence.original_value}")
            if evidence.source_location:
                loc = evidence.source_location
                loc_str = loc.file_path
                if loc.line_number:
                    loc_str += f":{loc.line_number}"
                lines.append(f"    位置: {loc_str}")
            lines.append(f"    类型: {evidence.evidence_type}")
            lines.append(f"    关联记录ID: {evidence.audit_record_id}")
            lines.append("")

        report_content = "\n".join(lines)

        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(report_content)

        return str(output_file)

    def generate_audit_directory_report(self, result: AuditResult, output_path: str) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("多源审计取证目录")
        lines.append("=" * 80)
        lines.append("")

        lines.append(f"报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        grouped = {}
        for evidence in result.evidences:
            record = next((r for r in result.records if r.id == evidence.audit_record_id), None)
            if record:
                key = record.environment_name
                if key not in grouped:
                    grouped[key] = []
                grouped[key].append((record, evidence))

        for env_name, items in grouped.items():
            lines.append("-" * 80)
            lines.append(f"环境: {env_name}")
            lines.append("-" * 80)
            lines.append("")

            for record, evidence in items:
                dep = self.storage.find_dependency_by_id(record.dependency_id)
                lines.append(f"依赖: {record.dependency_name}")
                lines.append(f"  依赖ID: {record.dependency_id}")
                lines.append(f"  记录ID: {record.id}")
                lines.append(f"  检测规则: {record.detection_rule_name}")
                lines.append(f"  系统状态: {record.system_status.value}")
                if record.manual_status:
                    lines.append(f"  人工状态: {record.manual_status.value}")
                    lines.append(f"  人工备注: {record.manual_remark}")
                lines.append(f"  取证字段: {evidence.field_name}")
                lines.append(f"  原始值: {evidence.original_value}")
                if evidence.source_location:
                    loc = evidence.source_location
                    loc_str = loc.file_path
                    if loc.line_number:
                        loc_str += f":{loc.line_number}"
                    lines.append(f"  原始位置: {loc_str}")
                if dep and dep.raw_input:
                    lines.append(f"  完整原始输入:")
                    for k, v in dep.raw_input.items():
                        lines.append(f"    {k}: {v}")
                lines.append("")

        report_content = "\n".join(lines)

        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(report_content)

        return str(output_file)

    def query_by_environment(self, environment_name: str) -> str:
        records = self.storage.find_records_by_environment(environment_name)
        if not records:
            return f"未找到环境 '{environment_name}' 的审计记录"

        lines = []
        lines.append("=" * 80)
        lines.append(f"环境查询结果: {environment_name}")
        lines.append("=" * 80)
        lines.append("")

        for record in records:
            dep = self.storage.find_dependency_by_id(record.dependency_id)
            lines.append(f"依赖: {record.dependency_name}")
            lines.append(f"  记录ID: {record.id}")
            lines.append(f"  检测规则: {record.detection_rule_name}")
            lines.append(f"  系统状态: {record.system_status.value}")
            lines.append(f"  系统原因: {record.system_reason}")
            if record.manual_status:
                lines.append(f"  人工状态: {record.manual_status.value}")
                lines.append(f"  人工备注: {record.manual_remark}")
            if record.field_errors:
                lines.append("  字段错误:")
                for error in record.field_errors:
                    lines.append(f"    {error.field_name}: {error.error_message}")
            if dep:
                lines.append(f"  原始输入:")
                lines.append(f"    名称: {dep.name}")
                lines.append(f"    版本: {dep.version}")
                lines.append(f"    许可证: {dep.license}")
                lines.append(f"    来源: {dep.source}")
                if dep.raw_input:
                    lines.append(f"    完整原始数据:")
                    for k, v in dep.raw_input.items():
                        lines.append(f"      {k}: {v}")
            lines.append("")

        return "\n".join(lines)
