from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from harbor_sediment import (
    BottleSample,
    RecordStatus,
    ErrorCategory,
    parse_bottle_id,
    validate_time_consistency,
    enrich_bottle_from_id,
    extract_bottle_ids_from_text,
    create_record,
    add_bottles_batch,
    manually_modify_record,
    get_version_history,
    compare_versions,
    format_for_communication,
)


class TestBottleParser:
    def test_parse_valid_bottle_id_with_dashes(self):
        result = parse_bottle_id("HW-20250315-A03-072")
        assert result.parse_success is True
        assert result.prefix == "HW"
        assert result.station_code == "A03"
        assert result.sequence == "072"
        assert result.sampling_date is not None
        assert result.sampling_date.strftime("%Y-%m-%d") == "2025-03-15"

    def test_parse_valid_bottle_id_without_dashes(self):
        result = parse_bottle_id("HW20250315A03072")
        assert result.parse_success is True
        assert result.prefix == "HW"
        assert result.station_code == "A03"
        assert result.sequence == "072"

    def test_parse_invalid_bottle_id(self):
        result = parse_bottle_id("INVALID123")
        assert result.parse_success is False
        assert len(result.errors) > 0

    def test_validate_time_consistency_mismatch(self):
        bottle = BottleSample(
            bottle_id="HW-20250315-A03-072",
            sampling_time=datetime(2025, 3, 20, 10, 0),
        )
        is_valid, errors = validate_time_consistency(bottle)
        assert is_valid is False
        assert any(e.category == ErrorCategory.DATA_MISMATCH for e in errors)

    def test_validate_station_mismatch(self):
        bottle = BottleSample(
            bottle_id="HW-20250315-A03-072",
            sampling_time=datetime(2025, 3, 15, 10, 0),
            station_code="B99",
        )
        is_valid, errors = validate_time_consistency(bottle)
        assert is_valid is False
        assert any("站位" in e.detail for e in errors)

    def test_validate_experiment_time_before_sampling(self):
        bottle = BottleSample(
            bottle_id="HW-20250315-A03-072",
            sampling_time=datetime(2025, 3, 15, 10, 0),
            station_code="A03",
            experiment_time=datetime(2025, 3, 14, 8, 0),
        )
        is_valid, errors = validate_time_consistency(bottle)
        assert is_valid is False
        assert any("实验时间" in e.detail for e in errors)

    def test_validate_negative_experiment_result(self):
        bottle = BottleSample(
            bottle_id="HW-20250315-A03-072",
            sampling_time=datetime(2025, 3, 15, 10, 0),
            station_code="A03",
            experiment_time=datetime(2025, 3, 16, 8, 0),
            experiment_result=-5.0,
        )
        is_valid, errors = validate_time_consistency(bottle)
        assert is_valid is False
        assert any(e.category == ErrorCategory.THRESHOLD_ERROR for e in errors)

    def test_enrich_bottle_from_id(self):
        bottle = enrich_bottle_from_id("HW-20250315-A03-072")
        assert bottle.bottle_id == "HW-20250315-A03-072"
        assert bottle.station_code == "A03"
        assert bottle.sampling_date is not None if hasattr(bottle, "sampling_date") else True

    def test_extract_bottle_ids_from_text(self):
        text = "今天交接了采样瓶HW-20250315-A03-072和HW20250316B05001，还有HW-20250317-C02-003。"
        ids = extract_bottle_ids_from_text(text)
        assert len(ids) == 3
        assert "HW-20250315-A03-072" in ids or "HW20250315A03072" in ids


class TestSedimentCalculation:
    def _make_valid_bottle(
        self,
        bottle_id: str = "HW-20250315-A03-072",
        result: float = 15.0,
        unit: str = "kg/m³",
        has_cloud: bool = False,
        cloud_detail: str = "",
    ) -> BottleSample:
        parsed = parse_bottle_id(bottle_id)
        return BottleSample(
            bottle_id=bottle_id,
            sampling_time=parsed.sampling_date or datetime(2025, 3, 15, 10, 0),
            station_code=parsed.station_code or "A03",
            experiment_result=result,
            experiment_unit=unit,
            experiment_time=(parsed.sampling_date or datetime(2025, 3, 15)) + timedelta(hours=20),
            has_cloud_occlusion=has_cloud,
            cloud_occlusion_detail=cloud_detail,
        )

    def test_create_record_released(self):
        bottles = [self._make_valid_bottle("HW-20250315-A03-072", 15.0, "kg/m³")]
        record, calc = create_record("A03", "大连港", bottles, created_by="小宋")
        assert record.record_id.startswith("SED-")
        assert record.status == RecordStatus.RELEASED
        assert record.sediment_value is not None
        assert record.final_report_ready is True
        assert len(record.change_history) >= 1

    def test_create_record_pending_missing_result(self):
        bottle = self._make_valid_bottle("HW-20250315-A03-072")
        bottle.experiment_result = None
        record, calc = create_record("A03", "大连港", [bottle])
        assert record.status == RecordStatus.CALCULATION_FAILED
        assert record.final_report_ready is False
        assert any(e.category == ErrorCategory.MISSING_DATA for e in record.calculation_errors)

    def test_create_record_unit_error(self):
        bottle = self._make_valid_bottle("HW-20250315-A03-072", 15.0, "unknown_unit")
        record, calc = create_record("A03", "大连港", [bottle])
        assert record.status == RecordStatus.CALCULATION_FAILED
        assert any(e.category == ErrorCategory.UNIT_ERROR for e in record.calculation_errors)

    def test_create_record_threshold_error(self):
        bottle = self._make_valid_bottle("HW-20250315-A03-072", 9999.0, "kg/m³")
        record, calc = create_record("A03", "大连港", [bottle])
        assert record.status == RecordStatus.CALCULATION_FAILED
        assert any(e.category == ErrorCategory.THRESHOLD_ERROR for e in record.calculation_errors)

    def test_cloud_occlusion_suspends_report(self):
        bottle = self._make_valid_bottle(
            "HW-20250315-A03-072",
            15.0,
            "kg/m³",
            has_cloud=True,
            cloud_detail="该区域30%被云层覆盖",
        )
        record, calc = create_record("A03", "大连港", [bottle])
        assert record.status == RecordStatus.SUSPENDED
        assert record.final_report_ready is False
        assert len(record.suspicions) >= 1
        assert any("遥感云遮挡" in s.reason for s in record.suspicions)

    def test_multi_batch_no_override(self):
        bottle1 = self._make_valid_bottle("HW-20250315-A03-072", 10.0, "kg/m³")
        record, _ = create_record("A03", "大连港", [bottle1], created_by="小宋")
        version_after_first = record.current_version
        conclusion_after_first = record.sediment_conclusion
        value_after_first = record.sediment_value

        bottle2 = self._make_valid_bottle("HW-20250316-A03-073", 20.0, "kg/m³")
        record, _ = add_bottles_batch(
            record, [bottle2], operator="小宋", batch_note="交接晚到附件", change_reason="补充采样瓶批次数据"
        )

        assert record.current_version == version_after_first + 1
        assert record.sediment_value != value_after_first
        assert len(record.change_history) >= 2
        assert len(record.bottles) == 2
        assert len(record.bottles_received) == 2

        latest = record.change_history[-1]
        assert latest.old_conclusion == conclusion_after_first
        assert latest.new_material.get("batch_note") == "交接晚到附件"

    def test_duplicate_bottle_not_added(self):
        bottle1 = self._make_valid_bottle("HW-20250315-A03-072", 15.0, "kg/m³")
        record, _ = create_record("A03", "大连港", [bottle1])
        bottle_dup = self._make_valid_bottle("HW-20250315-A03-072", 99.0, "kg/m³")
        record, _ = add_bottles_batch(record, [bottle_dup])
        assert len(record.bottles) == 1

    def test_manual_modify_records_history(self):
        bottle = self._make_valid_bottle("HW-20250315-A03-072", 15.0, "kg/m³")
        record, _ = create_record("A03", "大连港", [bottle])
        old_conclusion = record.sediment_conclusion
        old_version = record.current_version

        record = manually_modify_record(
            record,
            new_conclusion="人工复核：中度淤积（考虑现场实际水深）",
            new_value=22.5,
            change_reason="现场水深复核后调整结论",
            operator="李老师",
            remark="现场老师现场核查签字确认",
        )

        assert record.status == RecordStatus.MANUALLY_MODIFIED
        assert record.current_version == old_version + 1
        assert len(record.change_history) >= 2

        latest = record.change_history[-1]
        assert latest.old_conclusion == old_conclusion
        assert "人工复核" in (latest.new_conclusion or "")
        assert latest.change_reason == "现场水深复核后调整结论"
        assert latest.new_remark == "现场老师现场核查签字确认"
        assert latest.operator == "李老师"

    def test_compare_versions(self):
        bottle1 = self._make_valid_bottle("HW-20250315-A03-072", 8.0, "kg/m³")
        record, _ = create_record("A03", "大连港", [bottle1])
        v1 = record.current_version

        bottle2 = self._make_valid_bottle("HW-20250316-A03-073", 60.0, "kg/m³")
        record, _ = add_bottles_batch(record, [bottle2])
        v2 = record.current_version

        diff = compare_versions(record, v1, v2)
        assert diff is not None
        assert diff["version_from"] == v1
        assert diff["version_to"] == v2
        assert diff["conclusion_changed"] is True

    def test_communication_result_fields(self):
        bottle = self._make_valid_bottle("HW-20250315-A03-072", 15.0, "kg/m³")
        record, _ = create_record("A03", "大连港", [bottle], created_by="小宋")
        comm = format_for_communication(record)
        assert comm.record_id == record.record_id
        assert comm.status == RecordStatus.RELEASED
        assert comm.status_color.startswith("#")
        assert "大连港" in comm.summary
        assert comm.bottle_ids == ["HW-20250315-A03-072"]
        assert len(comm.detail_sections) >= 2
        assert len(comm.pending_actions) >= 1

    def test_communication_result_pending(self):
        bottle = self._make_valid_bottle("HW-20250315-A03-072", 15.0, "kg/m³")
        bottle.experiment_result = None
        record, _ = create_record("A03", "大连港", [bottle])
        comm = format_for_communication(record)
        assert comm.status == RecordStatus.CALCULATION_FAILED
        assert "计算失败" in comm.summary
        assert len(comm.pending_actions) >= 1

    def test_communication_result_suspended(self):
        bottle = self._make_valid_bottle(
            "HW-20250315-A03-072", 15.0, "kg/m³", has_cloud=True, cloud_detail="云覆盖"
        )
        record, _ = create_record("A03", "大连港", [bottle])
        comm = format_for_communication(record)
        assert comm.status == RecordStatus.SUSPENDED
        assert "暂缓" in comm.summary
        susp_titles = [s["title"] for s in comm.detail_sections]
        assert any("疑点" in t for t in susp_titles)

    def test_communication_result_manual_modified(self):
        bottle = self._make_valid_bottle("HW-20250315-A03-072", 15.0, "kg/m³")
        record, _ = create_record("A03", "大连港", [bottle])
        record = manually_modify_record(
            record,
            new_conclusion="人工复核：中度淤积",
            change_reason="现场老师复核",
            operator="李老师",
        )
        comm = format_for_communication(record)
        assert comm.status == RecordStatus.MANUALLY_MODIFIED
        assert "人工改判" in comm.summary
        hist_titles = [s["title"] for s in comm.detail_sections]
        assert any("变更历史" in t for t in hist_titles)

    def test_list_brief_status_markers(self):
        from harbor_sediment import format_records_brief

        released_bottle = self._make_valid_bottle("HW-20250315-A03-072", 15.0, "kg/m³")
        r1, _ = create_record("A03", "大连港", [released_bottle])

        err_bottle = self._make_valid_bottle("HW-20250315-A03-073")
        err_bottle.experiment_result = None
        r2, _ = create_record("A03", "天津港", [err_bottle])

        cloud_bottle = self._make_valid_bottle(
            "HW-20250315-A03-074", 15.0, "kg/m³", has_cloud=True
        )
        r3, _ = create_record("A03", "青岛港", [cloud_bottle])

        manual_bottle = self._make_valid_bottle("HW-20250315-A03-075", 15.0, "kg/m³")
        r4, _ = create_record("A03", "上海港", [manual_bottle])
        r4 = manually_modify_record(r4, new_conclusion="人工改", change_reason="测试")

        brief = format_records_brief([r1, r2, r3, r4])
        assert len(brief) == 4

        by_harbor = {b["target_harbor"]: b for b in brief}
        assert by_harbor["大连港"]["status"] == "已放行"
        assert by_harbor["大连港"]["final_report_ready"] is True
        assert by_harbor["天津港"]["has_errors"] is True
        assert by_harbor["青岛港"]["has_suspicions"] is True
        assert by_harbor["上海港"]["is_manually_modified"] is True
