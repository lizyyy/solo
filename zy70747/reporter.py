import json
import os
from datetime import datetime
from typing import List, Dict, Any
from models import ApiDecommission, TransformationStatus, ExtensionApprovalStatus
from rules import ApiDecommissionManager


class Reporter:
    def __init__(self, output_dir: str = "reports"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def generate_machine_readable_report(self, manager: ApiDecommissionManager, api_name: str = None) -> Dict[str, Any]:
        apis = manager.list_apis()
        if api_name:
            api = manager.get_api(api_name)
            apis = [api] if api else []

        report = {
            "report_type": "api_decommission_transformation_status",
            "generated_at": datetime.now().isoformat(),
            "summary": self._generate_summary(apis),
            "details": [api.to_dict() for api in apis]
        }
        return report

    def _generate_summary(self, apis: List[ApiDecommission]) -> Dict[str, Any]:
        total_apis = len(apis)
        total_callers = sum(len(api.callers) for api in apis)
        total_extensions = sum(len(api.extension_requests) for api in apis)

        status_counts = {}
        for status in TransformationStatus:
            count = sum(1 for api in apis for c in api.callers if c.status == status)
            status_counts[status.value] = count

        extension_status = {}
        for status in ExtensionApprovalStatus:
            count = sum(1 for api in apis for e in api.extension_requests if e.approval_status == status)
            extension_status[status.value] = count

        return {
            "total_apis": total_apis,
            "total_callers": total_callers,
            "total_extension_requests": total_extensions,
            "caller_status_distribution": status_counts,
            "extension_status_distribution": extension_status
        }

    def generate_human_readable_report(self, manager: ApiDecommissionManager, api_name: str = None) -> str:
        report = self.generate_machine_readable_report(manager, api_name)
        summary = report["summary"]

        lines = []
        lines.append("=" * 80)
        lines.append("           API 退役申请调用方改造排查报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("-" * 80)
        lines.append("【概览统计】")
        lines.append("-" * 80)
        lines.append(f"  接口总数: {summary['total_apis']}")
        lines.append(f"  调用方总数: {summary['total_callers']}")
        lines.append(f"  延期申请总数: {summary['total_extension_requests']}")
        lines.append("")

        lines.append("  调用方状态分布:")
        for status, count in summary["caller_status_distribution"].items():
            lines.append(f"    - {status}: {count}")
        lines.append("")

        lines.append("  延期申请状态分布:")
        for status, count in summary["extension_status_distribution"].items():
            lines.append(f"    - {status}: {count}")
        lines.append("")

        lines.append("-" * 80)
        lines.append("【详细信息】")
        lines.append("-" * 80)

        for api_data in report["details"]:
            lines.append(f"\n  接口名称: {api_data['api_name']}")
            lines.append(f"  退役日期: {api_data['decommission_date']}")
            lines.append(f"  登记时间: {api_data['created_at'][:19]}")
            lines.append("")

            lines.append("  调用方列表:")
            if api_data["callers"]:
                for i, caller in enumerate(api_data["callers"], 1):
                    lines.append(f"    {i}. {caller['caller_name']}")
                    lines.append(f"       状态: {caller['status']}")
                    lines.append(f"       改造计划: {caller['transformation_plan']}")
                    lines.append(f"       计划完成: {caller['planned_complete_date'] or '未设置'}")
                    lines.append(f"       登记时间: {caller['registered_at'][:19]}")
                    if caller["remarks"]:
                        lines.append(f"       备注: {caller['remarks']}")
                    lines.append("")
            else:
                lines.append("    (暂无调用方登记)")
                lines.append("")

            lines.append("  延期申请列表:")
            if api_data["extension_requests"]:
                for i, ext in enumerate(api_data["extension_requests"], 1):
                    lines.append(f"    {i}. {ext['caller_name']}")
                    lines.append(f"       状态: {ext['approval_status']}")
                    lines.append(f"       原退役日期: {ext['original_decommission_date']}")
                    lines.append(f"       申请延期至: {ext['requested_decommission_date']}")
                    lines.append(f"       理由: {ext['reason']}")
                    if ext["approved_by"]:
                        lines.append(f"       审批人: {ext['approved_by']}")
                    if ext["approved_at"]:
                        lines.append(f"       审批时间: {ext['approved_at'][:19]}")
                    lines.append("")
            else:
                lines.append("    (暂无延期申请)")
                lines.append("")

            lines.append("  " + "-" * 60)

        lines.append("\n" + "=" * 80)
        return "\n".join(lines)

    def save_json_report(self, manager: ApiDecommissionManager, filename: str = None, api_name: str = None) -> str:
        if not filename:
            filename = f"api_decommission_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        filepath = os.path.join(self.output_dir, filename)

        report = self.generate_machine_readable_report(manager, api_name)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        return filepath

    def save_text_report(self, manager: ApiDecommissionManager, filename: str = None, api_name: str = None) -> str:
        if not filename:
            filename = f"api_decommission_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        filepath = os.path.join(self.output_dir, filename)

        report_text = self.generate_human_readable_report(manager, api_name)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(report_text)
        return filepath

    def save_both_reports(self, manager: ApiDecommissionManager, base_filename: str = None, api_name: str = None) -> tuple:
        if not base_filename:
            base_filename = f"api_decommission_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        json_path = self.save_json_report(manager, f"{base_filename}.json", api_name)
        txt_path = self.save_text_report(manager, f"{base_filename}.txt", api_name)
        return json_path, txt_path
