from typing import List, Dict, Tuple, Optional
from .models import FittingRecord, EnergyDataPoint, generate_data_hash
from .history_manager import HistoryManager


class VersionDifference:
    def __init__(self, field: str, old_value: any, new_value: any, change_type: str):
        self.field = field
        self.old_value = old_value
        self.new_value = new_value
        self.change_type = change_type

    def to_dict(self) -> Dict:
        return {
            "field": self.field,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "change_type": self.change_type
        }


class VersionComparer:
    def compare_records(
        self, old_record: FittingRecord, new_record: FittingRecord
    ) -> List[VersionDifference]:
        differences = []

        differences.extend(self._compare_fitting_result(
            old_record.fitting_result, new_record.fitting_result
        ))

        differences.extend(self._compare_constraints(
            old_record.constraint_violations, new_record.constraint_violations
        ))

        differences.extend(self._compare_metadata(old_record, new_record))

        return differences

    def _compare_fitting_result(self, old_result, new_result) -> List[VersionDifference]:
        differences = []

        old_peaks = [(p.timestamp, round(p.power, 2)) for p in old_result.peaks]
        new_peaks = [(p.timestamp, round(p.power, 2)) for p in new_result.peaks]
        
        if len(old_peaks) != len(new_peaks):
            differences.append(VersionDifference(
                field="峰值数量",
                old_value=len(old_peaks),
                new_value=len(new_peaks),
                change_type="peak_count_change"
            ))
        else:
            for i, (op, np) in enumerate(zip(old_peaks, new_peaks)):
                if abs(op[1] - np[1]) > 0.1:
                    differences.append(VersionDifference(
                        field=f"峰值 #{i+1} 功率",
                        old_value=op[1],
                        new_value=np[1],
                        change_type="peak_power_change"
                    ))

        old_valleys = [(v.timestamp, round(v.power, 2)) for v in old_result.valleys]
        new_valleys = [(v.timestamp, round(v.power, 2)) for v in new_result.valleys]
        
        if len(old_valleys) != len(new_valleys):
            differences.append(VersionDifference(
                field="谷值数量",
                old_value=len(old_valleys),
                new_value=len(new_valleys),
                change_type="valley_count_change"
            ))
        else:
            for i, (ov, nv) in enumerate(zip(old_valleys, new_valleys)):
                if abs(ov[1] - nv[1]) > 0.1:
                    differences.append(VersionDifference(
                        field=f"谷值 #{i+1} 功率",
                        old_value=ov[1],
                        new_value=nv[1],
                        change_type="valley_power_change"
                    ))

        if abs(old_result.fitting_error - new_result.fitting_error) > 0.1:
            differences.append(VersionDifference(
                field="拟合误差",
                old_value=round(old_result.fitting_error, 3),
                new_value=round(new_result.fitting_error, 3),
                change_type="error_change"
            ))

        return differences

    def _compare_constraints(self, old_violations, new_violations) -> List[VersionDifference]:
        differences = []

        old_names = set(v.constraint_name for v in old_violations)
        new_names = set(v.constraint_name for v in new_violations)

        resolved = old_names - new_names
        if resolved:
            for name in resolved:
                differences.append(VersionDifference(
                    field=f"约束冲突已解决: {name}",
                    old_value="存在",
                    new_value="已解决",
                    change_type="constraint_resolved"
                ))

        new_issues = new_names - old_names
        if new_issues:
            for name in new_issues:
                v = next(v for v in new_violations if v.constraint_name == name)
                differences.append(VersionDifference(
                    field=f"新增约束冲突: {name}",
                    old_value="无",
                    new_value=f"{v.severity}: {v.explanation}",
                    change_type="constraint_added"
                ))

        return differences

    def _compare_metadata(self, old_record: FittingRecord, new_record: FittingRecord) -> List[VersionDifference]:
        differences = []

        if old_record.notes != new_record.notes:
            differences.append(VersionDifference(
                field="队员笔记",
                old_value=old_record.notes,
                new_value=new_record.notes,
                change_type="notes_change"
            ))

        if old_record.operator != new_record.operator:
            differences.append(VersionDifference(
                field="操作人员",
                old_value=old_record.operator,
                new_value=new_record.operator,
                change_type="operator_change"
            ))

        return differences

    def compare_data_points(
        self, old_data: List[EnergyDataPoint], new_data: List[EnergyDataPoint]
    ) -> List[VersionDifference]:
        differences = []

        if len(old_data) != len(new_data):
            differences.append(VersionDifference(
                field="数据点数量",
                old_value=len(old_data),
                new_value=len(new_data),
                change_type="data_count_change"
            ))

        min_len = min(len(old_data), len(new_data))
        changed_points = []
        for i in range(min_len):
            if abs(old_data[i].power - new_data[i].power) > 0.1:
                changed_points.append(i)

        if changed_points:
            sample_changes = ", ".join([
                f"#{i+1}: {old_data[i].power:.2f}→{new_data[i].power:.2f}"
                for i in changed_points[:5]
            ])
            if len(changed_points) > 5:
                sample_changes += f" (共{len(changed_points)}处变更)"
            differences.append(VersionDifference(
                field="原始数据变更",
                old_value="原始值",
                new_value=sample_changes,
                change_type="raw_data_change"
            ))

        return differences

    def format_differences(self, differences: List[VersionDifference]) -> str:
        if not differences:
            return "无差异"

        lines = ["=" * 60, "版本变更提醒", "=" * 60]

        by_type = {}
        for d in differences:
            if d.change_type not in by_type:
                by_type[d.change_type] = []
            by_type[d.change_type].append(d)

        type_labels = {
            "peak_count_change": "【峰值数量变化】",
            "peak_power_change": "【峰值功率变化】",
            "valley_count_change": "【谷值数量变化】",
            "valley_power_change": "【谷值功率变化】",
            "error_change": "【拟合误差变化】",
            "constraint_added": "【⚠️ 新增约束冲突】",
            "constraint_resolved": "【✅ 约束冲突已解决】",
            "notes_change": "【队员笔记变更】",
            "operator_change": "【操作人员变更】",
            "data_count_change": "【数据点数量变化】",
            "raw_data_change": "【原始数据变更】",
        }

        for change_type, diffs in by_type.items():
            label = type_labels.get(change_type, f"【{change_type}】")
            lines.append(f"\n{label}")
            for d in diffs:
                lines.append(f"  * {d.field}: {d.old_value} → {d.new_value}")

        lines.append("\n" + "=" * 60)
        return "\n".join(lines)
