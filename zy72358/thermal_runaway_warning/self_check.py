from __future__ import annotations

import csv
import io
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
            {"传感器编号": "T-CHK-002", "行号": 10, "采集时间": "2026-06-04T10:00:00", "读数": 75.0, "单位": "°C"},
            {"传感器编号": "T-CHK-002", "行号": 11, "采集时间": "2026-06-04T10:01:00", "读数": 30.0, "单位": "°C"},
            {"传感器编号": "T-CHK-002", "行号": 12, "采集时间": "2026-06-04T10:02:00", "读数": 35.0, "单位": "°C"},
        ]
        self.engine.import_records(test_rows, source="self_check中文列名")
        findings = self.engine.run_all_suppression_checks()

        avg = (75.0 + 30.0 + 35.0) / 3
        self.store.invalidate()
        results = self.store.get_suppressed_results()
        over_results = self.store.get_over_threshold_results()
        rec_10 = None
        for r in self.store.get_results():
            if r.sensor_id == "T-CHK-002" and r.original_row == 10:
                rec_10 = r
                break

        status_ok = rec_10 is not None and rec_10.status == ProcessingStatus.SUPPRESSED_BY_AVERAGE
        suppressed_visible = rec_10 is not None and rec_10.is_over_threshold is True
        record_level_ok = len(results) >= 1 and len(over_results) >= 1

        passed = (
            len(findings) > 0
            and findings[0]["action_required"] is True
            and status_ok
            and suppressed_visible
            and record_level_ok
        )
        detail = (
            f"传感器T-CHK-002第10行原始值75.0超阈值60.0, 平均值{avg:.2f}低于阈值, "
            f"findings={len(findings)}条, record.status={rec_10.status.value if rec_10 else 'None'}, "
            f"is_over_threshold={rec_10.is_over_threshold if rec_10 else None}, "
            f"suppressed_results={len(results)}, over_results={len(over_results)}"
        )
        return {
            "check": "超阈值记录被平均值盖掉",
            "passed": passed,
            "detail": detail,
            "expectation": (
                "超阈值记录status应真正写入SUPPRESSED_BY_AVERAGE，并保持is_over_threshold=True，"
                "在列表/详情/摘要/导出中均可见，不自动消失"
            ),
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
        summary = self.store.to_summary()

        api_count = api_response["total_records"]
        csv_lines = [l for l in csv_data.strip().split("\n") if l.strip()]
        csv_count = len(csv_lines) - 1 if csv_lines else 0
        json_count = len(self.store.get_results_dicts())
        page_count = len(page_display)
        summary_total = summary["total"]

        csv_over_count = 0
        if len(csv_lines) > 1:
            reader = csv.DictReader(io.StringIO(csv_data))
            for row in reader:
                if row.get("超阈值") == "是":
                    csv_over_count += 1
        api_over_count = api_response["over_threshold_count"]
        summary_over = summary["over_threshold_count"]
        over_from_json = sum(1 for d in self.store.get_results_dicts() if d.get("is_over_threshold"))

        counts_match = api_count == csv_count == json_count == page_count == summary_total
        over_match = api_over_count == csv_over_count == summary_over == over_from_json

        passed = counts_match and over_match
        return {
            "check": "导出一致性",
            "passed": passed,
            "detail": (
                f"总记录: API={api_count}, CSV={csv_count}, JSON={json_count}, "
                f"页面={page_count}, summary={summary_total} | "
                f"超阈值: API={api_over_count}, CSV={csv_over_count}, "
                f"summary={summary_over}, JSON字段={over_from_json}"
            ),
            "expectation": (
                "所有导出方式的总记录数、超阈值记录数应完全一致，"
                "被平均值盖掉的记录不会在任何视图中消失"
            ),
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

    def check_csv_column_aliases(self) -> Dict[str, Any]:
        csv_text = (
            "传感器编号,序号,时间,采集值,计量单位\n"
            "T-CHK-CSV,1,2026-06-09T10:00:00,80,°C\n"
            "T-CHK-CSV,2,2026-06-09T10:01:00,40,°C\n"
        )
        imported, skipped = self.engine.import_csv(csv_text, source_name="self_check_csv")
        self.engine.run_all_suppression_checks()
        self.store.invalidate()

        over = self.store.get_over_threshold_results()
        csv_over = [r for r in over if r.sensor_id == "T-CHK-CSV"]

        passed = len(imported) == 2 and len(csv_over) == 1
        return {
            "check": "CSV/Excel多源字段归一",
            "passed": passed,
            "detail": (
                f"中文列名CSV导入{len(imported)}条, 超阈值CSV传感器记录{len(csv_over)}条, "
                f"被覆盖检测运行正常"
            ),
            "expectation": "不同列名格式（中文/英文/别名）应自动归一，构建统一SensorRecord并通过相同阈值逻辑",
        }

    def check_manual_review_preserves_evidence(self) -> Dict[str, Any]:
        test_rows = [
            {"sensor_id": "T-CHK-RVW", "original_row": 1, "timestamp": "2026-06-04T10:00:00", "value": 70.0, "unit": "°C"},
            {"sensor_id": "T-CHK-RVW", "original_row": 2, "timestamp": "2026-06-04T10:01:00", "value": 40.0, "unit": "°C"},
        ]
        self.engine.import_records(test_rows, source="review_check")
        self.engine.attach_photo("T-CHK-RVW", "/p/rvw.jpg", "过热", "何工", original_row=1)
        self.engine.amend_sensor_value("T-CHK-RVW", 1, 62.0, "现场重测后修正为62.0")
        self.engine.run_all_suppression_checks()
        self.engine.manual_review_decision(
            sensor_id="T-CHK-RVW",
            original_row=1,
            final_status=ProcessingStatus.CONFIRMED_ABNORMAL,
            original_statement="初始值70°C超阈值60°C，后被平均值46°C盖掉",
            amended_reason="确认为电芯温度异常，维修师傅现场确认，需更换该组电芯",
            reviewer="维修师傅张工",
            next_reviewer="质量主管李工",
            amended_value=62.0,
        )
        self.store.invalidate()

        results = self.store.get_results_by_sensor("T-CHK-RVW")
        rec = next((r for r in results if r.original_row == 1), None)
        dec = rec.review_decision if rec else None
        ok = (
            rec is not None
            and rec.status == ProcessingStatus.CONFIRMED_ABNORMAL
            and rec.average_value is not None
            and dec is not None
            and dec.original_statement != ""
            and dec.amended_reason != ""
            and dec.next_reviewer == "质量主管李工"
        )

        api_response = self.store.to_api_response()
        page_display = self.store.to_page_display()
        csv_text = self.store.to_csv()

        csv_has_it = False
        if csv_text:
            csv_has_it = "T-CHK-RVW" in csv_text and "确认异常" in csv_text
        page_has_it = any("T-CHK-RVW" in str(p.values()) for p in page_display)
        api_has_it = any(e["sensor_id"] == "T-CHK-RVW" for e in api_response["evidence_summary"])

        all_views = csv_has_it and page_has_it and api_has_it

        return {
            "check": "人工复核后所有视图一致(列表/详情/摘要/导出)",
            "passed": ok and all_views,
            "detail": (
                f"复核状态正确={ok}, status={rec.status.value if rec else 'MISSING'}, "
                f"原始值={rec.original_import_value if rec else 'MISSING'}, "
                f"改后值={dec.amended_value if dec else 'MISSING'}, "
                f"下一步找谁={dec.next_reviewer if dec else 'MISSING'}, "
                f"视图一致(CSV/页面/API)={all_views}"
            ),
            "expectation": (
                "被平均值盖掉的记录经人工复核后，原始值/改后值/原始说法/处理原因/下一步找人/复核人，"
                "必须在列表/详情/摘要/导出中同步出现，不会一个地方显示异常另一个地方消失"
            ),
        }

    def run_all_checks(self) -> List[Dict[str, Any]]:
        return [
            self.check_duplicate_import(),
            self.check_suppression_by_average(),
            self.check_supplement_recalculation(),
            self.check_export_consistency(),
            self.check_over_threshold_not_auto_normal(),
            self.check_csv_column_aliases(),
            self.check_manual_review_preserves_evidence(),
        ]
