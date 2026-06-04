#!/usr/bin/env python3
import unittest
from models import (
    ShockDataPoint, TempUnit, WorkflowStage, NextContact
)
from workflow import WorkflowEngine
from visualizer import Chart3D
from report_renderer import ReportRenderer
from temp_detector import (
    parse_sampling_interval, detect_mixed_units_in_shock_data,
    build_clickable_links, explain_mixed_units
)


SAMPLE_SAMPLING_SPEC = """
降落伞开伞冲击试验 采样间隔说明
================================
采样点 1: 时间0ms, 温度25°C, 采样间隔10ms
采样点 2: 时间50ms, 温度298K, 采样间隔10ms
采样点 3: 时间100ms, 温度26°C, 采样间隔10ms
采样点 4: 时间150ms, 温度300K, 采样间隔10ms
采样点 5: 时间200ms, 温度27°C, 采样间隔10ms
"""


def create_fresh_shock_data():
    return [
        ShockDataPoint(time_ms=0, acceleration_g=1.0, altitude_m=1000.0, velocity_m_s=0.0),
        ShockDataPoint(time_ms=50, acceleration_g=2.3, altitude_m=980.0, velocity_m_s=15.2),
        ShockDataPoint(time_ms=100, acceleration_g=5.8, altitude_m=920.0, velocity_m_s=35.6),
        ShockDataPoint(time_ms=150, acceleration_g=12.4, altitude_m=850.0, velocity_m_s=55.2),
        ShockDataPoint(time_ms=200, acceleration_g=18.7, altitude_m=760.0, velocity_m_s=68.9),
    ]


class TestTemperatureDetection(unittest.TestCase):
    def test_parse_sampling_spec_detects_mixed_units(self):
        spec = parse_sampling_interval(SAMPLE_SAMPLING_SPEC, "test.txt")
        self.assertTrue(spec.has_mixed_units)
        self.assertEqual(len(spec.readings), 5)
        self.assertEqual(len(spec.mixed_unit_points), 5)
        self.assertEqual(spec.readings[0].unit, TempUnit.CELSIUS)
        self.assertEqual(spec.readings[1].unit, TempUnit.KELVIN)
        self.assertEqual(spec.readings[0].value, 25.0)
        self.assertEqual(spec.readings[1].value, 298.0)

    def test_detect_mixed_units_in_shock_data(self):
        spec = parse_sampling_interval(SAMPLE_SAMPLING_SPEC, "test.txt")
        shock_data = detect_mixed_units_in_shock_data(create_fresh_shock_data(), spec)
        self.assertTrue(shock_data[1].has_mixed_units)
        self.assertTrue(shock_data[3].has_mixed_units)
        self.assertIsNotNone(shock_data[1].temperature_reading)
        self.assertEqual(shock_data[1].temperature_reading.unit, TempUnit.KELVIN)

    def test_no_mixed_units_when_all_same(self):
        content = """
        采样点 1: 温度25°C
        采样点 2: 温度26°C
        """
        spec = parse_sampling_interval(content, "test.txt")
        self.assertFalse(spec.has_mixed_units)
        self.assertEqual(len(spec.mixed_unit_points), 0)

    def test_various_unit_formats(self):
        content = """
        测试: 25°C, 26℃, 27 CELSIUS, 298K, 299 Kelvin, 300 kelvin
        """
        spec = parse_sampling_interval(content, "test.txt")
        self.assertTrue(spec.has_mixed_units)
        self.assertEqual(len(spec.readings), 6)
        self.assertEqual(spec.readings[0].unit, TempUnit.CELSIUS)
        self.assertEqual(spec.readings[3].unit, TempUnit.KELVIN)


class TestThreeStepWorkflow(unittest.TestCase):
    def setUp(self):
        self.engine = WorkflowEngine()

    def test_step1_import_sampling_spec(self):
        state = self.engine.step1_import_sampling_spec(SAMPLE_SAMPLING_SPEC, "test.txt")
        self.assertIsNotNone(state.sampling_spec)
        self.assertTrue(state.sampling_spec.has_mixed_units)
        self.assertEqual(state.current_stage, WorkflowStage.COACH_REVIEW_PENDING)
        self.assertEqual(len(state.sampling_spec.readings), 5)

    def test_step1_import_shock_data(self):
        self.engine.step1_import_sampling_spec(SAMPLE_SAMPLING_SPEC, "test.txt")
        state = self.engine.step1_import_shock_data(create_fresh_shock_data())
        self.assertEqual(len(state.shock_data), 5)
        self.assertTrue(any(p.has_mixed_units for p in state.shock_data))
        self.assertIsNotNone(state.handover_report)
        self.assertEqual(state.handover_report.mixed_unit_count, 5)

    def test_step2_lin_add_calibration(self):
        self.engine.step1_import_sampling_spec(SAMPLE_SAMPLING_SPEC, "test.txt")
        self.engine.step1_import_shock_data(create_fresh_shock_data())

        state = self.engine.step2_lin_add_calibration(
            data_point_ids=[1, 3],
            instrument_id="INS-TEST-001",
            calibration_temp=24.85,
            calibration_unit=TempUnit.CELSIUS,
            remarks="开尔文298K转换为摄氏度24.85°C，已确认"
        )

        self.assertEqual(len(state.calibration_records), 1)
        self.assertIsNotNone(state.shock_data[1].linked_calibration_id)
        self.assertIsNotNone(state.shock_data[3].linked_calibration_id)
        self.assertIsNone(state.shock_data[0].linked_calibration_id)
        self.assertEqual(state.current_stage, WorkflowStage.STEP2_LIN_REVIEWED)
        self.assertEqual(state.calibration_records[0].recorded_by, "实验老师林老师")

    def test_step3_update_report(self):
        self.engine.step1_import_sampling_spec(SAMPLE_SAMPLING_SPEC, "test.txt")
        self.engine.step1_import_shock_data(create_fresh_shock_data())
        self.engine.step2_lin_add_calibration(
            data_point_ids=[1],
            instrument_id="INS-TEST-001",
            calibration_temp=24.85,
            calibration_unit=TempUnit.CELSIUS,
            remarks="已校准"
        )

        state = self.engine.step3_update_report("教练已复核，确认数据可用")
        self.assertEqual(state.current_stage, WorkflowStage.STEP3_REPORT_UPDATED)
        self.assertIn("教练已复核", state.handover_report.summary_for_coach)

    def test_full_three_step_workflow(self):
        state = self.engine.step1_import_sampling_spec(SAMPLE_SAMPLING_SPEC, "test.txt")
        self.assertTrue(state.sampling_spec.has_mixed_units)
        self.assertIn("第一步", state.sampling_spec.notes)

        state = self.engine.step1_import_shock_data(create_fresh_shock_data())
        self.assertIsNotNone(state.handover_report)
        mixed_count_before = state.handover_report.mixed_unit_count
        self.assertGreater(mixed_count_before, 0)

        state = self.engine.step2_lin_add_calibration(
            data_point_ids=[1, 3],
            instrument_id="INS-TEST-001",
            calibration_temp=25.0,
            calibration_unit=TempUnit.CELSIUS,
            remarks="林老师校准"
        )
        self.assertIn("第二步", state.current_stage.value)
        self.assertEqual(len(state.calibration_records), 1)

        state = self.engine.step3_update_report()
        self.assertIn("第三步", state.current_stage.value)
        self.assertIsNotNone(state.handover_report)


class TestChartClickableLinks(unittest.TestCase):
    def setUp(self):
        self.engine = WorkflowEngine()
        self.engine.step1_import_sampling_spec(SAMPLE_SAMPLING_SPEC, "test.txt")
        self.engine.step1_import_shock_data(create_fresh_shock_data())
        self.chart = Chart3D(self.engine.state)

    def test_clickable_links_built(self):
        self.assertGreater(len(self.engine.state.clickable_links), 0)
        clickable = self.chart.list_clickable_points()
        self.assertEqual(len(clickable), 5)
        self.assertIn(1, clickable)
        self.assertIn(3, clickable)

    def test_click_point_returns_navigation_options(self):
        result = self.chart.click_point(1)
        self.assertTrue(result["found"])
        self.assertIn("navigate_options", result)
        self.assertEqual(len(result["navigate_options"]), 2)

        sampling_opt = next(o for o in result["navigate_options"] if o["type"] == "采样间隔说明")
        self.assertEqual(sampling_opt["file"], "test.txt")
        self.assertIn("298", sampling_opt["raw_text"])
        self.assertIn("K", sampling_opt["raw_text"])
        self.assertEqual(sampling_opt["unit"], "K")

        cal_opt = next(o for o in result["navigate_options"] if o["type"] == "温度校准记录")
        self.assertEqual(cal_opt["status"], "缺失")
        self.assertIn("林老师", cal_opt["action"])

    def test_click_point_after_calibration(self):
        self.engine.step2_lin_add_calibration(
            data_point_ids=[1],
            instrument_id="INS-TEST-001",
            calibration_temp=24.85,
            calibration_unit=TempUnit.CELSIUS,
            remarks="开尔文298K已校准"
        )
        self.chart = Chart3D(self.engine.state)

        result = self.chart.click_point(1)
        cal_opt = next(o for o in result["navigate_options"] if o["type"] == "温度校准记录")
        self.assertNotIn("status", cal_opt)
        self.assertIn("开尔文298K已校准", cal_opt["remarks"])
        self.assertEqual(cal_opt["recorded_by"], "实验老师林老师")

    def test_click_normal_point_no_mixed_units(self):
        engine2 = WorkflowEngine()
        spec_content = "采样点 1: 温度25°C\n采样点 2: 温度26°C\n"
        engine2.step1_import_sampling_spec(spec_content, "normal.txt")
        engine2.step1_import_shock_data(create_fresh_shock_data()[:2])
        chart2 = Chart3D(engine2.state)

        result = chart2.click_point(0)
        self.assertFalse(result["found"])
        self.assertIn("无需回溯", result["message"])

    def test_explain_mixed_units(self):
        expl = explain_mixed_units(1, self.engine.state)
        self.assertIsNotNone(expl)
        self.assertIn("开尔文", expl)
        self.assertIn("系统未自动归一化", expl)
        self.assertIn("训练教练复核", expl)
        self.assertIn("林老师", expl)

    def test_explain_mixed_units_with_calibration(self):
        self.engine.step2_lin_add_calibration(
            data_point_ids=[1],
            instrument_id="INS-TEST",
            calibration_temp=24.85,
            calibration_unit=TempUnit.CELSIUS,
            remarks="已校准确认"
        )
        expl = explain_mixed_units(1, self.engine.state)
        self.assertIn("已关联校准记录", expl)
        self.assertIn("林老师", expl)
        self.assertIn("已校准确认", expl)


class TestHandoverReport(unittest.TestCase):
    def setUp(self):
        self.engine = WorkflowEngine()
        self.engine.step1_import_sampling_spec(SAMPLE_SAMPLING_SPEC, "test.txt")
        self.engine.step1_import_shock_data(create_fresh_shock_data())
        self.renderer = ReportRenderer(self.engine.state)

    def test_retention_notes_include_reason_and_contact(self):
        report = self.engine.state.handover_report
        self.assertEqual(len(report.retention_notes), 5)

        note1 = report.retention_notes[1]
        self.assertIn("摄氏度/开尔文混用", note1.reason_kept)
        self.assertIn("温度校准记录", note1.missing_materials)
        self.assertEqual(note1.next_contact, NextContact.BOTH)
        self.assertEqual(note1.priority, "高")

        note0 = report.retention_notes[0]
        self.assertIn("摄氏度/开尔文混用", note0.reason_kept)

    def test_high_acceleration_triggers_high_priority(self):
        report = self.engine.state.handover_report
        note4 = report.retention_notes[4]
        self.assertAlmostEqual(self.engine.state.shock_data[4].acceleration_g, 18.7)
        self.assertGreater(self.engine.state.shock_data[4].acceleration_g, 15)
        self.assertEqual(note4.priority, "高")
        self.assertIn("高风险", note4.reason_kept)

    def test_summary_for_coach_mentions_mixed_units(self):
        report = self.engine.state.handover_report
        self.assertIn("训练教练您好", report.summary_for_coach)
        self.assertIn("温度单位混用", report.summary_for_coach)
        self.assertIn("系统未对混用数据做自动归一化", report.summary_for_coach)
        self.assertIn("3D图表", report.summary_for_coach)

    def test_summary_for_lin_mentions_missing_calibration(self):
        report = self.engine.state.handover_report
        self.assertIn("林老师您好", report.summary_for_lin)
        self.assertIn("待关联校准记录", report.summary_for_lin)
        self.assertIn("需补充校准记录", report.summary_for_lin)

    def test_pending_actions_includes_both_coach_and_lin(self):
        report = self.engine.state.handover_report
        self.assertTrue(any("训练教练" in a for a in report.pending_actions))
        self.assertTrue(any("林老师" in a for a in report.pending_actions))

    def test_report_updates_after_calibration(self):
        missing_before = sum(
            1 for n in self.engine.state.handover_report.retention_notes
            if "温度校准记录" in n.missing_materials
        )
        self.assertEqual(missing_before, 5)

        self.engine.step2_lin_add_calibration(
            data_point_ids=[1, 3],
            instrument_id="INS-TEST",
            calibration_temp=25.0,
            calibration_unit=TempUnit.CELSIUS,
            remarks="已校准"
        )

        missing_after = sum(
            1 for n in self.engine.state.handover_report.retention_notes
            if "温度校准记录" in n.missing_materials
        )
        self.assertEqual(missing_after, 3)

        note1 = self.engine.state.handover_report.retention_notes[1]
        self.assertEqual(len(note1.missing_materials), 0)
        self.assertEqual(note1.next_contact, NextContact.COACH)

    def test_render_full_report(self):
        output = self.renderer.render_full_report()
        self.assertIn("降落伞开伞冲击试验 交接报告", output)
        self.assertIn("训练教练 收", output)
        self.assertIn("林老师 收", output)
        self.assertIn("留存原因", output)
        self.assertIn("缺失材料", output)
        self.assertIn("下一步对接", output)
        self.assertIn("训练教练", output)
        self.assertIn("林老师", output)

    def test_stage_banner_changes_per_stage(self):
        banner1 = self.renderer.render_stage_banner()
        self.assertIn("待训练教练复核", banner1)

        self.engine.step2_lin_add_calibration(
            data_point_ids=[1],
            instrument_id="INS-TEST",
            calibration_temp=25.0,
            calibration_unit=TempUnit.CELSIUS,
            remarks="已校准"
        )
        banner2 = self.renderer.render_stage_banner()
        self.assertIn("第二步", banner2)

        self.engine.step3_update_report()
        banner3 = self.renderer.render_stage_banner()
        self.assertIn("第三步", banner3)


class TestMixedUnitsNotNormalized(unittest.TestCase):
    def test_original_values_preserved_after_calibration(self):
        engine = WorkflowEngine()
        engine.step1_import_sampling_spec(SAMPLE_SAMPLING_SPEC, "test.txt")
        engine.step1_import_shock_data(create_fresh_shock_data())

        original_value_k = engine.state.shock_data[1].temperature_reading.value
        original_unit_k = engine.state.shock_data[1].temperature_reading.unit
        self.assertEqual(original_value_k, 298.0)
        self.assertEqual(original_unit_k, TempUnit.KELVIN)

        original_value_c = engine.state.shock_data[0].temperature_reading.value
        original_unit_c = engine.state.shock_data[0].temperature_reading.unit
        self.assertEqual(original_value_c, 25.0)
        self.assertEqual(original_unit_c, TempUnit.CELSIUS)

        engine.step2_lin_add_calibration(
            data_point_ids=[0, 1],
            instrument_id="INS-TEST",
            calibration_temp=25.0,
            calibration_unit=TempUnit.CELSIUS,
            remarks="校准完成，但原始数据保留"
        )

        self.assertEqual(engine.state.shock_data[1].temperature_reading.value, 298.0)
        self.assertEqual(engine.state.shock_data[1].temperature_reading.unit, TempUnit.KELVIN)
        self.assertEqual(engine.state.shock_data[0].temperature_reading.value, 25.0)
        self.assertEqual(engine.state.shock_data[0].temperature_reading.unit, TempUnit.CELSIUS)

        self.assertIsNotNone(engine.state.shock_data[1].linked_calibration_id)
        self.assertIsNotNone(engine.state.shock_data[0].linked_calibration_id)

    def test_report_explicitly_states_no_auto_normalization(self):
        engine = WorkflowEngine()
        engine.step1_import_sampling_spec(SAMPLE_SAMPLING_SPEC, "test.txt")
        engine.step1_import_shock_data(create_fresh_shock_data())

        report = engine.state.handover_report
        self.assertIn("不做自动归一化处理", report.retention_notes[0].reason_kept)
        self.assertIn("系统未对混用数据做自动归一化", report.summary_for_coach)
        self.assertIn("保留原始数据供训练教练复核", report.summary_for_coach)


if __name__ == "__main__":
    unittest.main(verbosity=2)
