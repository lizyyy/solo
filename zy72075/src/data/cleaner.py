from typing import List, Dict, Tuple, Any
from collections import defaultdict
from ..models.bond import BondRecord, CalculationResult, ProcessStatus


class DataCleaner:
    def __init__(self):
        self.duplicate_groups: Dict[str, List[int]] = defaultdict(list)
        self.empty_field_records: List[Tuple[int, str, List[str]]] = []
        self.unit_mixed_records: List[Tuple[int, str, List[str]]] = []

    def check_duplicates(self, records: List[BondRecord]) -> List[CalculationResult]:
        results = []
        key_map = defaultdict(list)

        for record in records:
            if record.bond_code:
                key = record.bond_code
            elif record.bond_name:
                key = record.bond_name
            else:
                key = f"line_{record.line_number}"
            key_map[key].append(record)

        for key, group in key_map.items():
            if len(group) > 1:
                line_nums = [r.line_number for r in group]
                self.duplicate_groups[key] = line_nums

        seen_keys = set()

        for record in records:
            if record.bond_code:
                key = record.bond_code
            elif record.bond_name:
                key = record.bond_name
            else:
                key = f"line_{record.line_number}"

            if key in self.duplicate_groups:
                line_nums = self.duplicate_groups[key]
                if key not in seen_keys:
                    seen_keys.add(key)
                    result = CalculationResult(
                        bond_code=record.bond_code,
                        bond_name=record.bond_name,
                        status=ProcessStatus.PENDING,
                        original_source=record.original_source,
                        raw_data=record.raw_data,
                        remark=record.remark,
                        line_number=record.line_number,
                    )
                    result.warnings.append(
                        f"存在重复记录（共{len(line_nums)}条，行号：{line_nums}），本条作为首条保留计算，其余标记为重复"
                    )
                    results.append(result)
                else:
                    result = CalculationResult(
                        bond_code=record.bond_code,
                        bond_name=record.bond_name,
                        status=ProcessStatus.SKIPPED,
                        original_source=record.original_source,
                        raw_data=record.raw_data,
                        remark=record.remark,
                        line_number=record.line_number,
                    )
                    result.error_reason = (
                        f"重复记录，已跳过。相同key的记录共{len(line_nums)}条，"
                        f"行号：{line_nums}，已保留第{line_nums[0]}行进行计算"
                    )
                    results.append(result)
            else:
                result = CalculationResult(
                    bond_code=record.bond_code,
                    bond_name=record.bond_name,
                    status=ProcessStatus.PENDING,
                    original_source=record.original_source,
                    raw_data=record.raw_data,
                    remark=record.remark,
                    line_number=record.line_number,
                )
                results.append(result)

        return results

    def check_empty_fields(self, records: List[BondRecord]) -> List[Tuple[int, str, List[str]]]:
        issues = []
        required_fields = ["bond_price", "conversion_price", "stock_price"]

        for record in records:
            empty_fields = []
            record_dict = record.to_dict()

            for field in required_fields:
                value = record_dict.get(field)
                if value is None:
                    empty_fields.append(field)

            if empty_fields:
                field_names = {
                    "bond_price": "转债价格",
                    "conversion_price": "转股价格",
                    "stock_price": "正股价格",
                }
                empty_names = [field_names.get(f, f) for f in empty_fields]
                issues.append((record.line_number, record.bond_code or record.bond_name, empty_names))
                self.empty_field_records.append((record.line_number, record.bond_code or record.bond_name, empty_names))

        return issues

    def check_unit_mixed(self, records: List[BondRecord]) -> List[Tuple[int, str, List[str]]]:
        issues = []
        unit_fields = [
            ("bond_price_unit", "bond_price", "转债价格"),
            ("conversion_price_unit", "conversion_price", "转股价格"),
            ("stock_price_unit", "stock_price", "正股价格"),
        ]

        for record in records:
            mixed_units = []
            record_dict = record.to_dict()
            all_units = set()

            for unit_field, value_field, display_name in unit_fields:
                unit = record_dict.get(unit_field)
                value = record_dict.get(value_field)
                if value is not None and unit is not None:
                    all_units.add(unit)

            if len(all_units) > 1:
                for unit_field, value_field, display_name in unit_fields:
                    unit = record_dict.get(unit_field)
                    value = record_dict.get(value_field)
                    if value is not None and unit is not None and unit != "元":
                        mixed_units.append(f"{display_name}({unit})")

            if mixed_units:
                issues.append((record.line_number, record.bond_code or record.bond_name, mixed_units))
                self.unit_mixed_records.append((record.line_number, record.bond_code or record.bond_name, mixed_units))

        return issues

    def get_cleaning_summary(self) -> Dict[str, Any]:
        return {
            "duplicate_count": sum(len(v) - 1 for v in self.duplicate_groups.values()),
            "duplicate_groups": len(self.duplicate_groups),
            "empty_field_count": len(self.empty_field_records),
            "unit_mixed_count": len(self.unit_mixed_records),
            "duplicate_details": dict(self.duplicate_groups),
            "empty_field_details": self.empty_field_records,
            "unit_mixed_details": self.unit_mixed_records,
        }
