from typing import List, Tuple, Dict, Any
from dataclasses import fields, is_dataclass

from models import ReviewReport, ChangeType, RiskFlag
from error_messages import get_user_friendly_error


class VersionComparator:
    REPORT_FIELDS_TO_COMPARE = [
        "total_asset", "total_liability", "pressure_gap",
        "conclusion", "content"
    ]

    @classmethod
    def compare_reports(
        cls,
        old_report: ReviewReport,
        new_report: ReviewReport
    ) -> Tuple[List[str], ChangeType, List[str]]:
        diffs: List[str] = []
        human_notes: List[str] = []
        has_conclusion_change = False
        has_material_change = False
        has_other_change = False

        if old_report.version >= new_report.version:
            return diffs, ChangeType.NO_CHANGE, human_notes

        for field_name in cls.REPORT_FIELDS_TO_COMPARE:
            old_val = getattr(old_report, field_name)
            new_val = getattr(new_report, field_name)

            if old_val != new_val:
                field_label = cls._get_field_label(field_name)
                diff_desc = cls._format_diff(field_name, field_label, old_val, new_val)
                diffs.append(diff_desc)

                if field_name == "conclusion":
                    has_conclusion_change = True
                    msg, suggestion = get_user_friendly_error(
                        "CONCLUSION_CHANGED", old=old_val, new=new_val
                    )
                    human_notes.append(msg)
                    if suggestion:
                        human_notes.append(f"建议：{suggestion}")
                elif field_name in ["content"]:
                    has_material_change = True
                else:
                    has_other_change = True

        if RiskFlag.LATE_SUPPLEMENT in new_report.risk_flags:
            has_material_change = True

        if has_conclusion_change and (has_material_change or has_other_change):
            change_type = ChangeType.MIXED
        elif has_conclusion_change:
            change_type = ChangeType.CONCLUSION_CHANGED
        elif has_material_change or has_other_change:
            change_type = ChangeType.MATERIAL_ONLY
        else:
            change_type = ChangeType.NO_CHANGE

        if diffs:
            msg, suggestion = get_user_friendly_error(
                "REPORT_VERSION_CHANGED",
                version=new_report.version,
                change_count=len(diffs)
            )
            human_notes.insert(0, msg)
            if suggestion:
                human_notes.insert(1, f"建议：{suggestion}")

        return diffs, change_type, human_notes

    @classmethod
    def _get_field_label(cls, field_name: str) -> str:
        labels = {
            "total_asset": "资产总额",
            "total_liability": "负债总额",
            "pressure_gap": "压力缺口",
            "conclusion": "复核结论",
            "content": "日报内容"
        }
        return labels.get(field_name, field_name)

    @classmethod
    def _format_diff(
        cls,
        field_name: str,
        field_label: str,
        old_val: Any,
        new_val: Any
    ) -> str:
        if isinstance(old_val, float) and isinstance(new_val, float):
            if abs(old_val) >= 10000:
                return (f"{field_label}：{old_val/10000:,.2f}万元 "
                       f"→ {new_val/10000:,.2f}万元 "
                       f"（变化{(new_val-old_val)/10000:+,.2f}万元）")
            return f"{field_label}：{old_val:,.2f} → {new_val:,.2f}（变化{new_val-old_val:+,.2f}）"

        if isinstance(old_val, str) and isinstance(new_val, str):
            if len(old_val) > 30 or len(new_val) > 30:
                return f"{field_label}：内容有更新（详见具体内容对比）"
            return f"{field_label}：\"{old_val}\" → \"{new_val}\""

        return f"{field_label}：{old_val} → {new_val}"

    @classmethod
    def summarize_changes(
        cls,
        diffs: List[str],
        change_type: ChangeType
    ) -> str:
        if change_type == ChangeType.NO_CHANGE:
            return "本次上传无变化"

        summary_parts = [f"共{len(diffs)}处变化："]
        for i, diff in enumerate(diffs, 1):
            summary_parts.append(f"{i}. {diff}")

        type_desc = {
            ChangeType.MATERIAL_ONLY: "【仅补材料】补充了基础数据，结论未变",
            ChangeType.CONCLUSION_CHANGED: "【改结论】复核结论有变化，请注意！",
            ChangeType.MIXED: "【混合变更】既补了材料又改了结论，请仔细核对"
        }
        summary_parts.append("")
        summary_parts.append(type_desc.get(change_type, ""))

        return "\n".join(summary_parts)
