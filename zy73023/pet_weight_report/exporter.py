import json
import os
from datetime import datetime
from typing import Any, Dict, List

from .models import PetRecord, WeightReport, ProcessingStatus
from .classifier import StatusClassifier


class ReportExporter:
    def __init__(self, output_dir: str = "output"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        self.classifier = StatusClassifier()

    def export_full_report(
        self, report: WeightReport, prefix: str = "pet_weight_report"
    ) -> Dict[str, str]:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = f"{prefix}_{timestamp}"
        paths: Dict[str, str] = {}

        interface_response = self.classifier.build_interface_response(report)

        paths["interface_json"] = self._write_json(
            f"{base_name}_interface_response.json", interface_response
        )

        paths["wen_view_csv"] = self._write_wen_friendly_csv(
            f"{base_name}_前台小温视图.csv", report
        )

        paths["summary_txt"] = self._write_summary_text(
            f"{base_name}_摘要.txt", report, interface_response
        )

        paths["history_json"] = self._write_history_json(
            f"{base_name}_改判历史.json", report
        )

        paths["registration_mapping_csv"] = self._write_registration_mapping_csv(
            f"{base_name}_登记表处理结果关联.csv", report
        )

        return paths

    def _write_json(self, filename: str, data: Any) -> str:
        path = os.path.join(self.output_dir, filename)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return path

    def _write_wen_friendly_csv(self, filename: str, report: WeightReport) -> str:
        path = os.path.join(self.output_dir, filename)
        rows = []
        header = [
            "序号",
            "登记表编号",
            "宠物别名",
            "寄养人",
            "原始说法",
            "初始体重",
            "当前体重",
            "目标体重",
            "减重%",
            "是否达标",
            "处理状态",
            "是否人工改过",
            "证据数",
            "异常数",
            "小温要做的事",
            "备注",
        ]
        rows.append(",".join(f'"{h}"' for h in header))

        for idx, record in enumerate(report.records, 1):
            info = self.classifier.classify(record)
            action = self.classifier._action_for_wen(info, record)
            row = [
                str(idx),
                record.fostering_registration.registration_id,
                "、".join(record.fostering_registration.pet_aliases),
                record.fostering_registration.owner_name,
                record.fostering_registration.original_statement,
                f"{record.initial_weight}kg",
                f"{record.current_weight}kg",
                f"{record.target_weight}kg",
                f"{record.weight_loss_percentage}%",
                "是" if record.is_target_met else "否",
                info["display_status"],
                "是" if record.is_manually_modified else "否",
                str(len(record.evidence_materials)),
                str(len(record.duplicate_issues)),
                action,
                record.operator_notes or "无",
            ]
            rows.append(",".join(f'"{self._escape_csv(x)}"' for x in row))

        with open(path, "w", encoding="utf-8-sig") as f:
            f.write("\n".join(rows))
        return path

    def _write_summary_text(
        self,
        filename: str,
        report: WeightReport,
        interface_response: Dict[str, Any],
    ) -> str:
        path = os.path.join(self.output_dir, filename)
        lines = []
        summary = report.get_summary()

        lines.append("=" * 60)
        lines.append("        🐾 宠物减重报告导出 - 汇总摘要")
        lines.append("=" * 60)
        lines.append(f"  报告编号:   {summary['报告编号']}")
        lines.append(f"  生成时间:   {summary['生成时间']}")
        lines.append(f"  总记录数:   {summary['总记录数']}")
        lines.append("-" * 60)
        lines.append(f"  ✅ 已放行:     {summary['已放行']} 条")
        lines.append(f"  📸 待补证据:   {summary['待补证据']} 条")
        lines.append(f"  ✏️  人工改过:   {summary['人工改过']} 条")
        lines.append(f"  📛 异常记录:   {summary['异常记录']} 条")
        lines.append(f"  ⚠️  重复别名:   {summary['重复别名问题数']} 个")
        lines.append("-" * 60)

        lines.append("")
        lines.append("📋 按状态分组明细:")
        for status, bucket in interface_response["status_buckets"].items():
            lines.append(f"")
            lines.append(f"  【{status}】 共 {len(bucket)} 条:")
            if not bucket:
                lines.append("     (无)")
            for item in bucket:
                lines.append(
                    f"     - 记录{item['record_id']} / 登记表{item['registration_id']}"
                    f" → {item['display_status']}"
                )

        exit_messages = interface_response.get("exit_messages", [])
        if exit_messages:
            lines.append("")
            lines.extend(exit_messages)

        lines.append("")
        lines.append("=" * 60)
        lines.append("  💡 给前台小温的使用提示:")
        lines.append("  - 先处理【异常】分组，别名重复确认完才能放行")
        lines.append("  - 再处理【待补证据】，按CSV里的\"小温要做的事\"催照片")
        lines.append("  - 【人工改过】需留存改判原因备查，见history.json")
        lines.append("  - 【已放行】可直接打印报告交寄养人")
        lines.append("  - 每张登记表原始说法与接口处理结果对照见: 登记表处理结果关联.csv")
        lines.append("=" * 60)

        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        return path

    @staticmethod
    def _has_conclusion_changed(record) -> bool:
        if len(record.processing_history) < 1:
            return False
        return any(h.previous_status != h.new_status for h in record.processing_history)

    def _write_history_json(self, filename: str, report: WeightReport) -> str:
        path = os.path.join(self.output_dir, filename)
        history_data = {}
        for record in report.records:
            conclusion_changed = self._has_conclusion_changed(record)
            if record.processing_history or record.is_manually_modified:
                history_data[record.record_id] = {
                    "登记表编号": record.fostering_registration.registration_id,
                    "宠物别名": "、".join(record.fostering_registration.pet_aliases),
                    "寄养人": record.fostering_registration.owner_name,
                    "结论是否变化": "是" if conclusion_changed else "否",
                    "改判次数": len(record.processing_history),
                    "旧材料与新材料对照": [
                        {
                            "历史编号": h.history_id,
                            "时间": h.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                            "操作人": h.operator,
                            "变更前状态": h.previous_status.value,
                            "变更后状态": h.new_status.value,
                            "改判原因": h.reason,
                            "原材料编号": h.previous_evidence_ids,
                            "新材料编号": h.new_evidence_ids,
                            "原备注": h.previous_notes,
                            "新备注": h.new_notes,
                            "快照": h.revision_snapshot,
                        }
                        for h in record.processing_history
                    ],
                }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(history_data, f, ensure_ascii=False, indent=2)
        return path

    def _write_registration_mapping_csv(
        self, filename: str, report: WeightReport
    ) -> str:
        path = os.path.join(self.output_dir, filename)
        header = [
            "登记表编号",
            "关联记录编号",
            "批次号",
            "宠物别名(原始登记)",
            "寄养人姓名",
            "寄养时段",
            "前台原始说法",
            "接口处理结果",
            "前台最终确认状态",
            "前后说法一致性",
            "需要前台跟进事项",
        ]
        rows = [",".join(f'"{h}"' for h in header)]

        for record in report.records:
            mapping = self.classifier._build_registration_mapping(record)
            row = [
                mapping["登记表编号"],
                mapping["关联记录编号"],
                record.fostering_registration.batch_number or "未分批",
                mapping["宠物别名原始登记"],
                record.fostering_registration.owner_name,
                record.fostering_registration.fostering_period,
                mapping["寄养人原始说法"],
                mapping["接口处理结果"],
                mapping["前台最终确认状态"],
                mapping["前后说法一致性"],
                "；".join(mapping["需要前台跟进事项"]),
            ]
            rows.append(",".join(f'"{self._escape_csv(x)}"' for x in row))

        with open(path, "w", encoding="utf-8-sig") as f:
            f.write("\n".join(rows))
        return path

    @staticmethod
    def _escape_csv(value: str) -> str:
        return value.replace('"', '""').replace("\n", " ")

    @staticmethod
    def print_exit_block(report: WeightReport) -> int:
        classifier = StatusClassifier()
        interface = classifier.build_interface_response(report)
        exit_msgs = interface.get("exit_messages", [])
        if exit_msgs:
            for msg in exit_msgs:
                print(msg)
            return 2
        return 0
