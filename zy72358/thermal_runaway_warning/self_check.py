from __future__ import annotations

from typing import Any, Dict, List, Tuple

from .engine import ThermalRunawayEngine
from .models import ProcessingStatus
from .result_store import ResultStore


class SelfChecker:
    def __init__(self, engine: ThermalRunawayEngine, store: ResultStore):
        self.engine = engine
        self.store = store

    def check_duplicate_import(self) -> Dict[str, Any]:
        test_rows = [
            {"sensor_id": "T-CHK-001", "original_row": 1, "timestamp": "2026-06-04T10:00:00", "value": 55.0, "unit": "°C"},
            {"sensor_id": "T-CHK-001", "original_row": 2, "timestamp": "2026-06-04T10:01:00", "value": 58.0, "unit": "°C"},
        ]
        first_import, first_skipped = self.engine.import_records(test_rows)
        second_import, second_skipped = self.engine.import_records(test_rows)

        passed = len(second_skipped) == len(test_rows) and len(second_import) == 0
        return {
            "check": "重复导入",
            "passed": passed,
            "detail": (
                f"首次导入{len(first_import)}条, 第二次导入{len(second_import)}条, "
                f"第二次跳过{len(second_skipped)}条"
            ),
            "expectation": "重复记录应被跳过，不应重复入库",
        }

    def check_suppression_by_average(self) -> Dict[str, Any]:
        test_rows = [
            {"sensor_id": "T-CHK-002", "original_row": 10, "timestamp": "2026-06-04T10:00:00", "value": 75.0, "unit": "°C"},
            {"sensor_id": "T-CHK-002", "original_row": 11, "timestamp": "2026-06-04T10:01:00", "value": 30.0, "unit": "°C"},
            {"sensor_id": "T-CHK-002", "original_row": 12, "timestamp": "2026-06-04T10:02:00", "value": 35.0, "unit": "°C"},
        ]
        self.engine.import_records(test_rows)
        findings = self.engine.compute_average_suppression_check("T-CHK-002")

        avg = (75.0 + 30.0 + 35.0) / 3
        passed = len(findings) > 0 and findings[0]["action_required"] is True
        return {
            "check": "超阈值记录被平均值盖掉",
            "passed": passed,
            "detail": (
                f"传感器T-CHK-002第10行原始值75.0超阈值60.0, "
                f"平均值{avg:.2f}低于阈值, "
                f"检测到{len(findings)}条超阈值被掩盖记录"
            ),
            "expectation": "超阈值记录不应被平均值掩盖，必须标记为待复核",
        }

    def check_supplement_recalculation(self) -> Dict[str, Any]:
        supplement_rows = [
            {"sensor_id": "T-CHK-002", "original_row": 13, "timestamp": "2026-06-04T10:03:00", "value": 40.0, "unit": "°C"},
        ]
        imported, events = self.engine.recalculate_after_supplement(supplement_rows)
        self.store.invalidate()

        results = self.store.get_results_by_sensor("T-CHK-002")
        has_recalculated = any(
            r.status == ProcessingStatus.RECALCULATED for r in results
        )

        passed = len(imported) > 0 and has_recalculated
        return {
            "check": "补录后重算",
            "passed": passed,
            "detail": (
                f"补录{len(imported)}条, 新事件{len(events)}条, "
                f"重算状态{'已标记' if has_recalculated else '未标记'}"
            ),
            "expectation": "补录数据后应重新计算并标记重算状态",
        }

    def check_export_consistency(self) -> Dict[str, Any]:
        api_response = self.store.to_api_response()
        csv_data = self.store.to_csv()
        json_data = self.store.to_json()
        page_display = self.store.to_page_display()

        api_count = api_response["total_records"]
        csv_lines = [l for l in csv_data.strip().split("\n") if l.strip()]
        csv_count = len(csv_lines) - 1 if csv_lines else 0
        json_count = len(self.store.get_results_dicts())
        page_count = len(page_display)

        passed = api_count == csv_count == json_count == page_count
        return {
            "check": "导出一致性",
            "passed": passed,
            "detail": (
                f"API返回{api_count}条, CSV导出{csv_count}条, "
                f"JSON导出{json_count}条, 页面展示{page_count}条"
            ),
            "expectation": "所有导出方式的记录数应一致，均来自同一份结果",
        }

    def check_over_threshold_not_auto_normal(self) -> Dict[str, Any]:
        over_results = self.store.get_over_threshold_results()
        auto_normal = [
            r for r in over_results
            if r.status == ProcessingStatus.CONFIRMED_NORMAL
        ]
        passed = len(auto_normal) == 0
        return {
            "check": "超阈值不自动归正常",
            "passed": passed,
            "detail": (
                f"超阈值记录{len(over_results)}条, "
                f"其中自动归正常{len(auto_normal)}条"
            ),
            "expectation": "超阈值记录不应自动归为正常，必须留给维修师傅复核",
        }

    def run_all_checks(self) -> List[Dict[str, Any]]:
        return [
            self.check_duplicate_import(),
            self.check_suppression_by_average(),
            self.check_supplement_recalculation(),
            self.check_export_consistency(),
            self.check_over_threshold_not_auto_normal(),
        ]
