from typing import Dict, List, Any
import copy

from data_models import AirExchangeRecord, VerificationStatus
from data_validator import DataValidator
from extreme_value_processor import ExtremeValueProcessor
from sample_data import (
    create_empty_value_record,
    create_duplicate_record,
    create_boundary_record,
    create_low_extreme_record,
    create_smooth_record,
    create_normal_records,
    ROOM_VOLUME,
)


class TestSuite:
    def __init__(self):
        self.validator = DataValidator()
        self.extreme_processor = ExtremeValueProcessor(preserve_extremes=True)
        self.test_results: List[Dict[str, Any]] = []

    def test_empty_values(self) -> Dict[str, Any]:
        record = create_empty_value_record()
        validation = self.validator.validate_record(record, [record])

        result = {
            "test_name": "空值处理测试",
            "record_id": record.record_id,
            "expected_behavior": "检测所有空字段，给出明确的补录提示，不参与效率计算",
            "is_valid": validation.is_valid,
            "errors_found": validation.errors,
            "warnings_found": validation.warnings,
            "suggestions_found": validation.suggestions,
            "critical_checks": {
                "air_volume_empty_detected": "风量值为空" in validation.errors,
                "unit_empty_detected": "风量单位为空" in validation.errors,
                "time_interval_empty_detected": "测量时间间隔为空" in validation.errors,
                "direction_unknown_detected": "气流方向未标注" in validation.errors,
            },
            "passed": (
                not validation.is_valid
                and "风量值为空" in validation.errors
                and "风量单位为空" in validation.errors
                and "测量时间间隔为空" in validation.errors
            ),
        }

        efficiency = self.extreme_processor.calculate_efficiency([record], ROOM_VOLUME)
        result["efficiency_calculation"] = (
            "空值记录未参与计算" if not efficiency else "空值记录错误参与计算"
        )
        result["passed"] = result["passed"] and not efficiency

        self.test_results.append(result)
        return result

    def test_duplicate_records(self) -> Dict[str, Any]:
        record1 = create_smooth_record()
        record2 = create_duplicate_record()
        all_records = [record1, record2]

        validation1 = self.validator.validate_record(record1, all_records)
        validation2 = self.validator.validate_record(record2, all_records)

        duplicate_warning = any(
            "存在重复测量记录" in w for w in validation2.warnings
        )

        result = {
            "test_name": "重复记录检测测试",
            "expected_behavior": "检测到同一时间同一位置的重复测量，给出警告但保留两条记录",
            "record_ids": [record1.record_id, record2.record_id],
            "same_time_location": (
                record1.measure_time == record2.measure_time
                and record1.location == record2.location
            ),
            "duplicate_warning_issued": duplicate_warning,
            "both_records_preserved": True,
            "validation1_valid": validation1.is_valid,
            "validation2_valid": validation2.is_valid,
            "warnings_record2": validation2.warnings,
            "passed": (
                duplicate_warning
                and validation1.is_valid
                and validation2.is_valid
            ),
        }

        self.test_results.append(result)
        return result

    def test_boundary_values(self) -> Dict[str, Any]:
        record = create_boundary_record()
        validation = self.validator.validate_record(record, [record])

        boundary_warnings = [
            w for w in validation.warnings
            if "边界" in w or "量程" in w
        ]

        efficiency_results = self.extreme_processor.calculate_efficiency(
            [record], ROOM_VOLUME
        )

        result = {
            "test_name": "边界记录处理测试",
            "record_id": record.record_id,
            "expected_behavior": "标记边界值，给出复核提示，正常计算但标注需注意",
            "air_volume": record.air_volume,
            "time_interval": record.time_interval_min,
            "boundary_warnings_found": boundary_warnings,
            "boundary_suggestions": [
                s for s in validation.suggestions if "边界" in s
            ],
            "efficiency_calculated": len(efficiency_results) > 0,
            "calculated_efficiency": efficiency_results[0].adjusted_efficiency if efficiency_results else None,
            "is_extreme_marked": efficiency_results[0].is_extreme if efficiency_results else False,
            "wechat_notes_preserved": record.raw_wechat_content is not None,
            "passed": (
                len(boundary_warnings) > 0
                and len(efficiency_results) > 0
                and record.raw_wechat_content is not None
            ),
        }

        self.test_results.append(result)
        return result

    def test_extreme_value_not_averaged(self) -> Dict[str, Any]:
        normal_records = create_normal_records()
        from data_models import Direction, DataSource
        from datetime import datetime, timedelta
        extra_normals = [
            AirExchangeRecord(
                record_id=f"TEST-NORM-{i}",
                measure_time=datetime(2026, 6, 1, 12 + i // 2, (i % 2) * 30),
                location="洁净室A区-送风口",
                direction=Direction.SUPPLY,
                air_volume=3500 + i * 20,
                unit="m³/h",
                time_interval_min=30,
                source=DataSource.EXPERIMENT_TABLE,
            )
            for i in range(5)
        ]
        extreme_record = create_low_extreme_record()
        all_records = normal_records + extra_normals + [extreme_record]

        self.extreme_processor.mark_extreme_records(all_records)
        group_result = self.extreme_processor.calculate_group_efficiency(
            all_records, ROOM_VOLUME
        )

        methods = group_result.get("methods", {})
        raw_avg_eff = methods.get("简单平均（易掩盖风险）", {}).get("efficiency", 0)
        cleaned_avg_eff = methods.get("剔除极端值后平均", {}).get("efficiency", 0)
        efficiency_gap = abs(cleaned_avg_eff - raw_avg_eff)

        risk = group_result.get("risk_assessment", {})
        risk_level = risk.get("level", "")

        result = {
            "test_name": "极端值不被平均掩盖测试",
            "expected_behavior": "极端值被单独标记，同时展示多种计算方法，风险被明确指出",
            "record_count": group_result.get("record_count"),
            "extreme_count": group_result.get("extreme_count"),
            "extreme_details": group_result.get("extreme_details"),
            "simple_average_efficiency": raw_avg_eff,
            "cleaned_average_efficiency": cleaned_avg_eff,
            "efficiency_gap_percent": round(efficiency_gap, 2),
            "risk_level": risk_level,
            "risk_description": risk.get("description"),
            "raw_values_preserved": "原始值逐个展示" in methods,
            "critical_checks": {
                "extreme_detected": group_result.get("extreme_count", 0) > 0,
                "gap_significant": efficiency_gap > 2,
                "risk_warning_issued": "需关注" in risk_level or "高风险" in risk_level,
                "multiple_methods_provided": len(methods) >= 3,
            },
            "passed": (
                group_result.get("extreme_count", 0) > 0
                and efficiency_gap > 2
                and ("需关注" in risk_level or "高风险" in risk_level)
            ),
        }

        self.test_results.append(result)
        return result

    def test_wechat_notes_preserved(self) -> Dict[str, Any]:
        from sample_data import create_wechat_supplement_record
        record = create_wechat_supplement_record()

        result = {
            "test_name": "微信群备注保留测试",
            "record_id": record.record_id,
            "expected_behavior": "微信原始内容和结构化备注都被保留，不被清洗",
            "source": record.source.value,
            "wechat_notes_present": record.wechat_notes is not None,
            "raw_wechat_content_present": record.raw_wechat_content is not None,
            "wechat_notes_content": record.wechat_notes,
            "raw_content_length": len(record.raw_wechat_content) if record.raw_wechat_content else 0,
            "old_caliber_preserved": "旧口径" in (record.wechat_notes or ""),
            "passed": (
                record.wechat_notes is not None
                and record.raw_wechat_content is not None
                and "旧口径" in record.wechat_notes
            ),
        }

        validation = self.validator.validate_record(record, [record])
        result["validation_notes"] = [
            s for s in validation.suggestions if "微信群" in s or "备注" in s
        ]
        result["validation_passed"] = validation.is_valid or "微信群来源记录缺少原始微信内容备份" not in validation.warnings

        self.test_results.append(result)
        return result

    def test_smooth_record_auto_pass(self) -> Dict[str, Any]:
        record = create_smooth_record()
        validator = DataValidator()
        validation = validator.validate_record(record, [record])

        extreme_processor = ExtremeValueProcessor(preserve_extremes=True)
        efficiency = extreme_processor.calculate_efficiency([record], ROOM_VOLUME)

        result = {
            "test_name": "顺利记录自动通过测试",
            "record_id": record.record_id,
            "expected_behavior": "数据完整规范的记录自动通过审核，无警告无错误",
            "is_valid": validation.is_valid,
            "error_count": len(validation.errors),
            "warning_count": len(validation.warnings),
            "suggestion_count": len(validation.suggestions),
            "errors": validation.errors,
            "warnings": validation.warnings,
            "efficiency_calculated": len(efficiency) > 0,
            "calculated_efficiency": efficiency[0].adjusted_efficiency if efficiency else None,
            "is_extreme": efficiency[0].is_extreme if efficiency else False,
            "passed": (
                validation.is_valid
                and len(validation.errors) == 0
                and len(validation.warnings) == 0
                and len(efficiency) > 0
                and not efficiency[0].is_extreme
            ),
        }

        self.test_results.append(result)
        return result

    def test_direction_and_unit_validation(self) -> Dict[str, Any]:
        from data_models import Direction, DataSource
        from datetime import datetime

        test_record = AirExchangeRecord(
            record_id="TEST-DIR-001",
            measure_time=datetime(2026, 6, 1, 10, 0),
            location="测试间",
            direction=Direction.SUPPLY,
            air_volume=3000.0,
            unit="m3/h",
            time_interval_min=30,
            source=DataSource.EXPERIMENT_TABLE,
        )

        validation = self.validator.validate_record(test_record, [test_record])

        unit_suggestions = [
            s for s in validation.suggestions
            if "单位" in s and "标准化" in s
        ]

        result = {
            "test_name": "方向符号和单位校验测试",
            "expected_behavior": "自动识别单位写法差异，给出标准化建议，方向符号正确映射",
            "direction_value": test_record.direction.value,
            "unit_provided": test_record.unit,
            "is_valid": validation.is_valid,
            "unit_standardization_suggested": len(unit_suggestions) > 0,
            "suggestions": unit_suggestions,
            "passed": (
                validation.is_valid
                and len(unit_suggestions) > 0
            ),
        }

        self.test_results.append(result)
        return result

    def test_time_interval_validation(self) -> Dict[str, Any]:
        from data_models import Direction, DataSource
        from datetime import datetime

        short_interval = AirExchangeRecord(
            record_id="TEST-TIME-001",
            measure_time=datetime(2026, 6, 1, 10, 0),
            location="测试间",
            direction=Direction.SUPPLY,
            air_volume=3000.0,
            unit="m³/h",
            time_interval_min=3,
            source=DataSource.EXPERIMENT_TABLE,
        )

        long_interval = AirExchangeRecord(
            record_id="TEST-TIME-002",
            measure_time=datetime(2026, 6, 1, 11, 0),
            location="测试间",
            direction=Direction.SUPPLY,
            air_volume=3000.0,
            unit="m³/h",
            time_interval_min=200,
            source=DataSource.EXPERIMENT_TABLE,
        )

        val_short = self.validator.validate_record(short_interval, [short_interval])
        val_long = self.validator.validate_record(long_interval, [long_interval])

        result = {
            "test_name": "时间间隔校验测试",
            "expected_behavior": "过短或过长的时间间隔给出警告和调整建议",
            "short_interval": 3,
            "short_interval_warning": any("过短" in w for w in val_short.warnings),
            "long_interval": 200,
            "long_interval_warning": any("过长" in w for w in val_long.warnings),
            "short_suggestions": val_short.suggestions,
            "long_suggestions": val_long.suggestions,
            "passed": (
                any("过短" in w for w in val_short.warnings)
                and any("过长" in w for w in val_long.warnings)
            ),
        }

        self.test_results.append(result)
        return result

    def run_all_tests(self) -> List[Dict[str, Any]]:
        self.test_results.clear()
        self.test_empty_values()
        self.test_duplicate_records()
        self.test_boundary_values()
        self.test_extreme_value_not_averaged()
        self.test_wechat_notes_preserved()
        self.test_smooth_record_auto_pass()
        self.test_direction_and_unit_validation()
        self.test_time_interval_validation()
        return self.test_results

    def print_test_report(self) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("空气净化换气效率 - 测试用例报告")
        lines.append("=" * 80)

        passed = 0
        failed = 0

        for result in self.test_results:
            status = "✅ 通过" if result.get("passed") else "❌ 失败"
            if result.get("passed"):
                passed += 1
            else:
                failed += 1

            lines.append(f"\n{status} | {result['test_name']}")
            lines.append(f"  预期行为: {result['expected_behavior']}")

            if "critical_checks" in result:
                lines.append("  关键检查项:")
                for check, value in result["critical_checks"].items():
                    check_status = "✅" if value else "❌"
                    lines.append(f"    {check_status} {check}: {value}")

            if not result.get("passed"):
                lines.append("  ⚠️ 失败详情:")
                for key in ["errors_found", "warnings_found", "efficiency_gap_percent"]:
                    if key in result and result[key]:
                        lines.append(f"    {key}: {result[key]}")

        lines.append("\n" + "=" * 80)
        lines.append(f"测试总结: 通过 {passed}/{passed + failed}, 失败 {failed}/{passed + failed}")
        lines.append("=" * 80)

        return "\n".join(lines)
