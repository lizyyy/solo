from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime
import copy
import json

from data_models import AirExchangeRecord, VersionComparison, VerificationStatus
from data_validator import DataValidator
from extreme_value_processor import ExtremeValueProcessor


class VersionManager:
    def __init__(self):
        self._version_history: Dict[str, List[AirExchangeRecord]] = {}
        self._run_history: List[Dict[str, Any]] = []

    def save_version(self, record: AirExchangeRecord) -> AirExchangeRecord:
        if record.record_id not in self._version_history:
            self._version_history[record.record_id] = []

        old_versions = self._version_history[record.record_id]
        if old_versions:
            latest = old_versions[-1]
            record.version = latest.version + 1
            record.parent_record_id = latest.record_id
        else:
            record.version = 1

        record.updated_at = datetime.now()
        record_copy = copy.deepcopy(record)
        self._version_history[record.record_id].append(record_copy)
        return record_copy

    def get_version(self, record_id: str, version: int) -> Optional[AirExchangeRecord]:
        versions = self._version_history.get(record_id, [])
        for v in versions:
            if v.version == version:
                return v
        return None

    def get_all_versions(self, record_id: str) -> List[AirExchangeRecord]:
        return self._version_history.get(record_id, [])

    def get_latest_version(self, record_id: str) -> Optional[AirExchangeRecord]:
        versions = self._version_history.get(record_id, [])
        return versions[-1] if versions else None

    def compare_versions(
        self, record_id: str, old_version: int, new_version: int
    ) -> Optional[VersionComparison]:
        old = self.get_version(record_id, old_version)
        new = self.get_version(record_id, new_version)

        if not old or not new:
            return None

        fields_to_compare = [
            "measure_time",
            "location",
            "direction",
            "air_volume",
            "unit",
            "time_interval_min",
            "source",
            "wechat_notes",
            "calculated_efficiency",
            "verification_status",
            "is_extreme_value",
            "processing_suggestion",
        ]

        field_changes = {}
        for field in fields_to_compare:
            old_val = getattr(old, field, None)
            new_val = getattr(new, field, None)

            if hasattr(old_val, "value"):
                old_val = old_val.value
            if hasattr(new_val, "value"):
                new_val = new_val.value
            if isinstance(old_val, datetime):
                old_val = old_val.isoformat()
            if isinstance(new_val, datetime):
                new_val = new_val.isoformat()

            if old_val != new_val:
                field_changes[field] = {
                    "old": old_val,
                    "new": new_val,
                    "changed": True,
                }

        efficiency_change = None
        if old.calculated_efficiency is not None and new.calculated_efficiency is not None:
            efficiency_change = new.calculated_efficiency - old.calculated_efficiency

        status_change = None
        if old.verification_status != new.verification_status:
            status_change = (old.verification_status.value, new.verification_status.value)

        processing_note = self._generate_processing_note(
            old, new, field_changes, efficiency_change, status_change
        )

        return VersionComparison(
            record_id=record_id,
            old_version=old_version,
            new_version=new_version,
            field_changes=field_changes,
            efficiency_change=efficiency_change,
            status_change=status_change,
            processing_note=processing_note,
        )

    def _generate_processing_note(
        self,
        old: AirExchangeRecord,
        new: AirExchangeRecord,
        field_changes: Dict[str, Any],
        efficiency_change: Optional[float],
        status_change: Optional[tuple],
    ) -> str:
        notes = []

        if "air_volume" in field_changes:
            notes.append(
                f"风量从 {field_changes['air_volume']['old']} {old.unit} "
                f"调整为 {field_changes['air_volume']['new']} {new.unit}"
            )

        if "direction" in field_changes:
            notes.append(
                f"气流方向从 '{field_changes['direction']['old']}' "
                f"改为 '{field_changes['direction']['new']}'"
            )

        if status_change:
            notes.append(
                f"审核状态从 [{status_change[0]}] 变更为 [{status_change[1]}]"
            )

        if efficiency_change is not None and abs(efficiency_change) > 0.1:
            direction = "提升" if efficiency_change > 0 else "下降"
            notes.append(
                f"计算效率{direction} {abs(efficiency_change):.2f} 个百分点"
            )

        if "is_extreme_value" in field_changes:
            if field_changes["is_extreme_value"]["new"]:
                notes.append("⚠️ 该记录被标记为极端值")
            else:
                notes.append("极端值标记已取消")

        if "processing_suggestion" in field_changes:
            notes.append("处理建议已更新")

        if "wechat_notes" in field_changes:
            notes.append("微信群备注已更新")

        if not notes:
            notes.append("无实质性字段变更")

        notes.append(f"处理时间：{new.updated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        return " | ".join(notes)

    def run_analysis(
        self,
        records: List[AirExchangeRecord],
        room_volume: float,
        run_description: str = "",
    ) -> Dict[str, Any]:
        validator = DataValidator()
        extreme_processor = ExtremeValueProcessor(preserve_extremes=True)

        validation_results = validator.batch_validate(records)
        extreme_processor.mark_extreme_records(records)
        efficiency_results = extreme_processor.calculate_efficiency(records, room_volume)

        for record in records:
            vr = validation_results.get(record.record_id)
            if vr:
                record.verification_notes = vr.errors + vr.warnings + vr.suggestions
                if not vr.is_valid:
                    record.verification_status = VerificationStatus.NEED_MANUAL_CHECK
                elif record.source.value == "维修微信群":
                    record.verification_status = VerificationStatus.WECHAT_SUPPLEMENT
                else:
                    record.verification_status = VerificationStatus.AUTO_PASS

            er = next(
                (e for e in efficiency_results if e.record_id == record.record_id),
                None,
            )
            if er:
                record.calculated_efficiency = er.adjusted_efficiency
                if er.notes:
                    record.verification_notes.extend(er.notes)

            self.save_version(record)

        group_result = extreme_processor.calculate_group_efficiency(records, room_volume)

        run_info = {
            "run_time": datetime.now().isoformat(),
            "run_description": run_description,
            "record_count": len(records),
            "room_volume": room_volume,
            "records": [r.to_dict() for r in records],
            "validation_results": {
                rid: {
                    "is_valid": vr.is_valid,
                    "errors": vr.errors,
                    "warnings": vr.warnings,
                    "suggestions": vr.suggestions,
                }
                for rid, vr in validation_results.items()
            },
            "group_analysis": group_result,
        }

        self._run_history.append(run_info)
        return run_info

    def compare_runs(
        self, old_run_index: int, new_run_index: int
    ) -> Dict[str, Any]:
        if old_run_index >= len(self._run_history) or new_run_index >= len(self._run_history):
            return {"error": "运行索引超出范围"}

        old_run = self._run_history[old_run_index]
        new_run = self._run_history[new_run_index]

        old_records = {r["record_id"]: r for r in old_run["records"]}
        new_records = {r["record_id"]: r for r in new_run["records"]}

        all_record_ids = set(old_records.keys()) | set(new_records.keys())

        comparisons = []
        for rid in all_record_ids:
            old_r = old_records.get(rid)
            new_r = new_records.get(rid)

            comp = {
                "record_id": rid,
                "exists_in_old": old_r is not None,
                "exists_in_new": new_r is not None,
            }

            if old_r and new_r:
                fields = ["air_volume", "calculated_efficiency", "verification_status", "is_extreme_value"]
                changes = {}
                for f in fields:
                    old_val = old_r.get(f)
                    new_val = new_r.get(f)
                    if old_val != new_val:
                        changes[f] = {"old": old_val, "new": new_val}
                comp["changes"] = changes
                comp["side_by_side"] = self._format_side_by_side(old_r, new_r)
            elif old_r:
                comp["note"] = "此记录仅存在于旧版分析中"
            else:
                comp["note"] = "此记录为新版新增"

            comparisons.append(comp)

        old_group = old_run["group_analysis"]
        new_group = new_run["group_analysis"]

        return {
            "old_run": {
                "time": old_run["run_time"],
                "description": old_run["run_description"],
            },
            "new_run": {
                "time": new_run["run_time"],
                "description": new_run["run_description"],
            },
            "group_comparison": {
                "old_efficiency": old_group.get("methods", {}).get("剔除极端值后平均", {}).get("efficiency"),
                "new_efficiency": new_group.get("methods", {}).get("剔除极端值后平均", {}).get("efficiency"),
                "old_extreme_count": old_group.get("extreme_count", 0),
                "new_extreme_count": new_group.get("extreme_count", 0),
                "old_risk": old_group.get("risk_assessment", {}).get("level", "未知"),
                "new_risk": new_group.get("risk_assessment", {}).get("level", "未知"),
            },
            "record_comparisons": comparisons,
        }

    def _format_side_by_side(
        self, old_r: Dict[str, Any], new_r: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        display_fields = [
            ("测量时间", "measure_time"),
            ("位置", "location"),
            ("方向", "direction"),
            ("风量", "air_volume"),
            ("单位", "unit"),
            ("时间间隔", "time_interval_min"),
            ("数据来源", "source"),
            ("计算效率", "calculated_efficiency"),
            ("审核状态", "verification_status"),
            ("是否极端值", "is_extreme_value"),
            ("微信群备注", "wechat_notes"),
            ("原始微信内容", "raw_wechat_content"),
        ]

        result = []
        for label, field in display_fields:
            old_val = old_r.get(field, "")
            new_val = new_r.get(field, "")
            changed = old_val != new_val
            result.append(
                {
                    "字段": label,
                    "原值": old_val,
                    "新值": new_val,
                    "是否变更": "是" if changed else "否",
                }
            )
        return result

    def print_side_by_side_comparison(self, comparison: Dict[str, Any]) -> str:
        output = []
        output.append("=" * 80)
        output.append("历史版本并排比较")
        output.append("=" * 80)
        output.append(f"旧版运行: {comparison['old_run']['time']} - {comparison['old_run']['description']}")
        output.append(f"新版运行: {comparison['new_run']['time']} - {comparison['new_run']['description']}")
        output.append("")

        gc = comparison["group_comparison"]
        output.append("【整体结果对比】")
        output.append(f"  剔除极端值后效率: {gc['old_efficiency']:.2f}% → {gc['new_efficiency']:.2f}%")
        if gc['old_efficiency'] != gc['new_efficiency']:
            diff = gc['new_efficiency'] - gc['old_efficiency']
            output.append(f"    变化: {'+' if diff > 0 else ''}{diff:.2f}%")
        output.append(f"  极端值数量: {gc['old_extreme_count']} → {gc['new_extreme_count']}")
        output.append(f"  风险等级: {gc['old_risk']} → {gc['new_risk']}")
        output.append("")

        output.append("【单条记录对比】")
        for comp in comparison["record_comparisons"]:
            output.append(f"\n记录ID: {comp['record_id']}")
            if comp.get("note"):
                output.append(f"  备注: {comp['note']}")
                continue

            output.append("  字段级变更:")
            for field, change in comp.get("changes", {}).items():
                output.append(f"    {field}: {change['old']} → {change['new']}")

            output.append("  并排详情:")
            for row in comp["side_by_side"]:
                marker = " *" if row["是否变更"] == "是" else "  "
                output.append(f"{marker}{row['字段']:15s}: {str(row['原值']):25s} → {str(row['新值'])}")

        return "\n".join(output)

    def get_run_history(self) -> List[Dict[str, Any]]:
        return [
            {
                "index": i,
                "time": run["run_time"],
                "description": run["run_description"],
                "record_count": run["record_count"],
            }
            for i, run in enumerate(self._run_history)
        ]

    def export_version_history(self, record_id: str, filepath: str) -> None:
        versions = self.get_all_versions(record_id)
        data = [v.to_dict() for v in versions]
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
