from __future__ import annotations

import csv
import json
import math
import os
import tempfile
import unittest
from typing import List

from piano_tuning_cli.models import (
    A4_FREQ,
    AnomalyExplanation,
    ConflictPolicy,
    DeviationResult,
    ImportConflict,
    ParsedNote,
    ToneZone,
    TrendComparison,
    TuningPhase,
    TuningRecord,
    ZoneAggregate,
    cents_to_hz,
    detect_freq_unit,
    freq_to_cents,
    parse_note,
)
from piano_tuning_cli.importer import DataStore, ImportResult, _fuzzy_match_column, _safe_float, _fill_merged_cells
from piano_tuning_cli.analysis import (
    aggregate_by_zone,
    compare_trends,
    compute_deviations,
    rank_zones_by_instability,
)
from piano_tuning_cli.anomaly import (
    detect_anomalies,
    explain_all,
    LARGE_DEVIATION_THRESHOLD,
    EXTREME_DEVIATION_THRESHOLD,
)
from piano_tuning_cli.report import build_full_report, generate_text_report, export_json, export_csv
from piano_tuning_cli.cli import main as cli_main


class TestParseNote(unittest.TestCase):

    def test_standard_notes(self):
        n = parse_note("A4")
        self.assertIsNotNone(n)
        self.assertEqual(n.canonical, "A4")
        self.assertAlmostEqual(n.standard_freq, 440.0)

    def test_middle_c(self):
        n = parse_note("C4")
        self.assertIsNotNone(n)
        self.assertEqual(n.semitone, 0)
        self.assertAlmostEqual(n.standard_freq, 261.626, places=1)

    def test_sharp_note(self):
        n = parse_note("C#4")
        self.assertIsNotNone(n)
        self.assertEqual(n.canonical, "C#4")

    def test_flat_note_maps_to_sharp(self):
        n = parse_note("Db4")
        self.assertIsNotNone(n)
        self.assertEqual(n.canonical, "C#4")

    def test_unicode_sharp_flat(self):
        n1 = parse_note("C♯4")
        self.assertIsNotNone(n1)
        self.assertEqual(n1.canonical, "C#4")
        n2 = parse_note("D♭4")
        self.assertIsNotNone(n2)
        self.assertEqual(n2.canonical, "C#4")

    def test_enharmonic_alias_csharp(self):
        n = parse_note("Csharp4")
        self.assertIsNotNone(n)
        self.assertEqual(n.canonical, "C#4")

    def test_enharmonic_alias_eflat(self):
        n = parse_note("Eb3")
        self.assertIsNotNone(n)
        self.assertEqual(n.canonical, "D#3")

    def test_enharmonic_bsharp(self):
        n = parse_note("B#4")
        self.assertIsNotNone(n)
        self.assertEqual(n.canonical, "C5")

    def test_enharmonic_cflat(self):
        n = parse_note("Cb4")
        self.assertIsNotNone(n)
        self.assertEqual(n.canonical, "B3")

    def test_lowest_note(self):
        n = parse_note("A0")
        self.assertIsNotNone(n)
        self.assertAlmostEqual(n.standard_freq, 27.5, places=1)

    def test_highest_note(self):
        n = parse_note("C8")
        self.assertIsNotNone(n)
        self.assertAlmostEqual(n.standard_freq, 4186.0, places=0)

    def test_invalid_note_name(self):
        self.assertIsNone(parse_note("X4"))
        self.assertIsNone(parse_note(""))
        self.assertIsNone(parse_note(None))
        self.assertIsNone(parse_note("123"))

    def test_out_of_range_octave(self):
        self.assertIsNone(parse_note("A9"))
        self.assertIsNone(parse_note("C-1"))

    def test_midi_boundary(self):
        n = parse_note("A0")
        self.assertEqual(n.midi_number, 21)
        n2 = parse_note("C8")
        self.assertEqual(n2.midi_number, 108)

    def test_tone_zone_low_bass(self):
        n = parse_note("E2")
        self.assertEqual(n.tone_zone, ToneZone.LOW_BASS)

    def test_tone_zone_bass(self):
        n = parse_note("B2")
        self.assertEqual(n.tone_zone, ToneZone.BASS)

    def test_tone_zone_mid_low(self):
        n = parse_note("C3")
        self.assertEqual(n.tone_zone, ToneZone.MID_LOW)

    def test_tone_zone_mid_high(self):
        n = parse_note("C4")
        self.assertEqual(n.tone_zone, ToneZone.MID_HIGH)

    def test_tone_zone_treble(self):
        n = parse_note("C5")
        self.assertEqual(n.tone_zone, ToneZone.TREBLE)

    def test_tone_zone_high_treble(self):
        n = parse_note("C7")
        self.assertEqual(n.tone_zone, ToneZone.HIGH_TREBLE)


class TestFreqToCents(unittest.TestCase):

    def test_exact_pitch(self):
        self.assertAlmostEqual(freq_to_cents(440.0, 440.0), 0.0, places=3)

    def test_one_semitone_up(self):
        self.assertAlmostEqual(freq_to_cents(466.16, 440.0), 100.0, places=0)

    def test_one_semitone_down(self):
        self.assertAlmostEqual(freq_to_cents(415.30, 440.0), -100.0, places=0)

    def test_octave_up(self):
        self.assertAlmostEqual(freq_to_cents(880.0, 440.0), 1200.0, places=1)

    def test_zero_measured(self):
        self.assertEqual(freq_to_cents(0.0, 440.0), 0.0)

    def test_negative_measured(self):
        self.assertEqual(freq_to_cents(-10.0, 440.0), 0.0)


class TestDetectFreqUnit(unittest.TestCase):

    def test_hz_default(self):
        self.assertEqual(detect_freq_unit("440"), "Hz")
        self.assertEqual(detect_freq_unit(""), "Hz")

    def test_cents(self):
        self.assertEqual(detect_freq_unit("5 cents"), "cents")
        self.assertEqual(detect_freq_unit("-3cent"), "cents")
        self.assertEqual(detect_freq_unit("2¢"), "cents")

    def test_khz(self):
        self.assertEqual(detect_freq_unit("0.44kHz"), "kHz")
        self.assertEqual(detect_freq_unit("0.262千赫"), "kHz")


class TestSafeFloat(unittest.TestCase):

    def test_normal(self):
        self.assertEqual(_safe_float("440.5"), 440.5)
        self.assertEqual(_safe_float(440), 440.0)

    def test_none(self):
        self.assertIsNone(_safe_float(None))

    def test_empty(self):
        self.assertIsNone(_safe_float(""))
        self.assertIsNone(_safe_float("   "))

    def test_chinese_comma(self):
        self.assertEqual(_safe_float("440，5"), 4405.0)

    def test_with_hz(self):
        self.assertEqual(_safe_float("440Hz"), 440.0)

    def test_with_cents(self):
        self.assertEqual(_safe_float("5cents"), 5.0)

    def test_nan_inf(self):
        self.assertIsNone(_safe_float(float("nan")))
        self.assertIsNone(_safe_float(float("inf")))

    def test_with_percent(self):
        self.assertEqual(_safe_float("65%"), 65.0)

    def test_with_degree(self):
        self.assertEqual(_safe_float("25℃"), 25.0)
        self.assertEqual(_safe_float("25°C"), 25.0)


class TestFillMergedCells(unittest.TestCase):

    def test_fill_vertical(self):
        rows = [
            ["钢琴1", "A4", "440"],
            ["", "B4", "494"],
            ["", "C5", "523"],
        ]
        result = _fill_merged_cells(rows)
        self.assertEqual(result[1][0], "钢琴1")
        self.assertEqual(result[2][0], "钢琴1")

    def test_no_merge(self):
        rows = [
            ["A", "1"],
            ["B", "2"],
        ]
        result = _fill_merged_cells(rows)
        self.assertEqual(result[1][0], "B")

    def test_empty_rows(self):
        self.assertEqual(_fill_merged_cells([]), [])


class TestFuzzyColumnMatch(unittest.TestCase):

    def test_exact_match(self):
        self.assertEqual(_fuzzy_match_column("piano_id"), "piano_id")
        self.assertEqual(_fuzzy_match_column("键名"), "note")

    def test_partial_match(self):
        self.assertEqual(_fuzzy_match_column("钢琴编号001"), "piano_id")

    def test_unknown_column(self):
        self.assertIsNone(_fuzzy_match_column("临时排序号"))


class TestDataStoreCSV(unittest.TestCase):

    def _write_csv(self, rows, header=None):
        f = tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8-sig", newline="")
        writer = csv.writer(f)
        if header:
            writer.writerow(header)
        for row in rows:
            writer.writerow(row)
        f.close()
        return f.name

    def test_basic_import(self):
        path = self._write_csv(
            [
                ["P001", "A4", "440.5", "", "1.96", "2025-01-15", "before", "22", "55", "正常"],
                ["P001", "B4", "495.0", "", "3.5", "2025-01-15", "before", "22", "55", ""],
            ],
            header=["钢琴编号", "键名", "实测频率", "单位", "频偏", "日期", "阶段", "温度", "湿度", "备注"],
        )
        try:
            store = DataStore()
            result = store.load_from_file(path)
            self.assertEqual(len(result.records), 2)
            self.assertEqual(result.records[0].piano_id, "P001")
            self.assertEqual(result.records[0].note_parsed.canonical, "A4")
        finally:
            os.unlink(path)

    def test_duplicate_skip(self):
        path = self._write_csv(
            [
                ["P001", "A4", "440.5", "", "1.96", "2025-01-15", "before"],
                ["P001", "A4", "441.0", "", "3.9", "2025-01-15", "before"],
            ],
            header=["钢琴编号", "键名", "实测频率", "单位", "频偏", "日期", "阶段"],
        )
        try:
            store = DataStore()
            result = store.load_from_file(path, conflict_policy=ConflictPolicy.SKIP)
            self.assertEqual(len(result.skipped), 1)
            self.assertEqual(len(store.records), 1)
        finally:
            os.unlink(path)

    def test_duplicate_update(self):
        path = self._write_csv(
            [
                ["P001", "A4", "440.5", "", "1.96", "2025-01-15", "before"],
                ["P001", "A4", "441.0", "", "3.9", "2025-01-15", "before"],
            ],
            header=["钢琴编号", "键名", "实测频率", "单位", "频偏", "日期", "阶段"],
        )
        try:
            store = DataStore()
            result = store.load_from_file(path, conflict_policy=ConflictPolicy.UPDATE)
            self.assertEqual(len(result.updated), 1)
            rec = store.records[list(store.records.keys())[0]]
            self.assertAlmostEqual(rec.measured_freq, 441.0)
        finally:
            os.unlink(path)

    def test_duplicate_conflict(self):
        path = self._write_csv(
            [
                ["P001", "A4", "440.5", "", "1.96", "2025-01-15", "before"],
                ["P001", "A4", "441.0", "", "3.9", "2025-01-15", "before"],
            ],
            header=["钢琴编号", "键名", "实测频率", "单位", "频偏", "日期", "阶段"],
        )
        try:
            store = DataStore()
            result = store.load_from_file(path, conflict_policy=ConflictPolicy.ERROR)
            self.assertEqual(len(result.conflicts), 1)
            conflict = result.conflicts[0]
            self.assertTrue(len(conflict.field_differences) > 0)
        finally:
            os.unlink(path)

    def test_empty_values_treated_normal(self):
        path = self._write_csv(
            [
                ["P001", "A4", "", "", "", "2025-01-15", "before", "", "", ""],
            ],
            header=["钢琴编号", "键名", "实测频率", "单位", "频偏", "日期", "阶段", "温度", "湿度", "备注"],
        )
        try:
            store = DataStore()
            result = store.load_from_file(path)
            self.assertEqual(len(result.records), 1)
            self.assertIsNone(result.records[0].measured_freq)
        finally:
            os.unlink(path)

    def test_merged_cells_fill(self):
        path = self._write_csv(
            [
                ["P001", "A4", "440.5", "", "1.96", "2025-01-15", "before", "22", "55", ""],
                ["", "B4", "494.0", "", "2.1", "2025-01-15", "before", "", "", ""],
                ["", "C5", "523.0", "", "0.5", "2025-01-15", "before", "", "", ""],
            ],
            header=["钢琴编号", "键名", "实测频率", "单位", "频偏", "日期", "阶段", "温度", "湿度", "备注"],
        )
        try:
            store = DataStore()
            result = store.load_from_file(path, fill_merged=True)
            records = result.records
            self.assertEqual(len(records), 3)
            self.assertEqual(records[1].piano_id, "P001")
            self.assertEqual(records[2].piano_id, "P001")
        finally:
            os.unlink(path)

    def test_temporary_columns_ignored(self):
        path = self._write_csv(
            [
                ["P001", "A4", "440.5", "临时备注内容"],
            ],
            header=["钢琴编号", "键名", "实测频率", "临时列不用管"],
        )
        try:
            store = DataStore()
            result = store.load_from_file(path)
            self.assertIn("临时列不用管", result.ignored_columns)
            self.assertEqual(len(result.records), 1)
        finally:
            os.unlink(path)

    def test_missing_note_skipped(self):
        path = self._write_csv(
            [
                ["P001", "", "440.5", "", "", "2025-01-15", "before"],
                ["P001", "A4", "440.5", "", "", "2025-01-15", "before"],
            ],
            header=["钢琴编号", "键名", "实测频率", "单位", "频偏", "日期", "阶段"],
        )
        try:
            store = DataStore()
            result = store.load_from_file(path)
            self.assertEqual(len(result.records), 1)
            self.assertTrue(any("缺少键名" in w for w in result.parse_warnings))
        finally:
            os.unlink(path)

    def test_freq_in_khz(self):
        path = self._write_csv(
            [
                ["P001", "A4", "0.440", "kHz", "", "2025-01-15", "before"],
            ],
            header=["钢琴编号", "键名", "实测频率", "单位", "频偏", "日期", "阶段"],
        )
        try:
            store = DataStore()
            result = store.load_from_file(path)
            self.assertEqual(len(result.records), 1)
            self.assertAlmostEqual(result.records[0].measured_freq, 440.0, places=1)
            self.assertEqual(result.records[0].freq_unit, "Hz")
        finally:
            os.unlink(path)

    def test_freq_in_cents(self):
        path = self._write_csv(
            [
                ["P001", "A4", "5", "cents", "", "2025-01-15", "before"],
            ],
            header=["钢琴编号", "键名", "实测频率", "单位", "频偏", "日期", "阶段"],
        )
        try:
            store = DataStore()
            result = store.load_from_file(path)
            self.assertEqual(len(result.records), 1)
            self.assertAlmostEqual(result.records[0].deviation_cents, 5.0)
            self.assertIsNone(result.records[0].measured_freq)
        finally:
            os.unlink(path)

    def test_json_import(self):
        data = [
            {"piano_id": "P001", "note": "A4", "measured_freq": 440.5, "tuning_date": "2025-01-15", "tuning_phase": "before"},
            {"piano_id": "P001", "note": "B4", "measured_freq": 495.0, "tuning_date": "2025-01-15", "tuning_phase": "after"},
        ]
        f = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8")
        json.dump(data, f, ensure_ascii=False)
        f.close()
        try:
            store = DataStore()
            result = store.load_from_file(f.name)
            self.assertEqual(len(result.records), 2)
        finally:
            os.unlink(f.name)

    def test_reimport_conflict_report(self):
        path1 = self._write_csv(
            [["P001", "A4", "440.5", "", "", "2025-01-15", "before"]],
            header=["钢琴编号", "键名", "实测频率", "单位", "频偏", "日期", "阶段"],
        )
        path2 = self._write_csv(
            [["P001", "A4", "442.0", "", "", "2025-01-15", "before"]],
            header=["钢琴编号", "键名", "实测频率", "单位", "频偏", "日期", "阶段"],
        )
        try:
            store = DataStore()
            store.load_from_file(path1, conflict_policy=ConflictPolicy.UPDATE)
            result = store.load_from_file(path2, conflict_policy=ConflictPolicy.ERROR)
            self.assertEqual(len(result.conflicts), 1)
            conflict = result.conflicts[0]
            self.assertTrue(any(f[0] == "实测频率" for f in conflict.field_differences))
        finally:
            os.unlink(path1)
            os.unlink(path2)


class TestComputeDeviations(unittest.TestCase):

    def _make_record(self, note, measured_freq=None, deviation_cents=None):
        parsed = parse_note(note)
        return TuningRecord(
            piano_id="P001",
            note_raw=note,
            note_parsed=parsed,
            measured_freq=measured_freq,
            deviation_cents=deviation_cents,
            tuning_date="2025-01-15",
            tuning_phase=TuningPhase.BEFORE,
        )

    def test_from_measured_freq(self):
        rec = self._make_record("A4", measured_freq=442.0)
        devs = compute_deviations([rec])
        self.assertEqual(len(devs), 1)
        self.assertAlmostEqual(devs[0].deviation_cents, freq_to_cents(442.0, 440.0), places=1)

    def test_from_deviation_cents(self):
        rec = self._make_record("A4", deviation_cents=5.0)
        devs = compute_deviations([rec])
        self.assertEqual(len(devs), 1)
        self.assertAlmostEqual(devs[0].measured_freq, cents_to_hz(5.0, 440.0), places=2)

    def test_both_provided(self):
        rec = self._make_record("A4", measured_freq=442.0, deviation_cents=7.85)
        devs = compute_deviations([rec])
        self.assertAlmostEqual(devs[0].deviation_cents, 7.85, places=1)
        self.assertAlmostEqual(devs[0].measured_freq, 442.0, places=1)

    def test_no_data(self):
        rec = self._make_record("A4")
        devs = compute_deviations([rec])
        self.assertIsNone(devs[0].deviation_cents)
        self.assertIsNone(devs[0].measured_freq)


class TestAggregateByZone(unittest.TestCase):

    def test_single_zone(self):
        devs = [
            DeviationResult("A", 4, "A4", ToneZone.MID_HIGH, 440.0, 440.0, 0.0, 0.0),
            DeviationResult("B", 4, "B4", ToneZone.MID_HIGH, 494.0, 493.88, 0.42, 0.12),
            DeviationResult("C", 5, "C5", ToneZone.TREBLE, 523.0, 523.25, -0.83, -0.25),
        ]
        agg = aggregate_by_zone(devs)
        self.assertIn(ToneZone.MID_HIGH, agg)
        self.assertEqual(agg[ToneZone.MID_HIGH].note_count, 2)
        self.assertAlmostEqual(agg[ToneZone.MID_HIGH].avg_deviation_cents, 0.21, places=1)

    def test_empty_deviations(self):
        agg = aggregate_by_zone([])
        self.assertEqual(len(agg), 0)

    def test_none_cents(self):
        devs = [DeviationResult("A", 4, "A4", ToneZone.MID_HIGH, None, 440.0, None, None)]
        agg = aggregate_by_zone(devs)
        self.assertIsNone(agg[ToneZone.MID_HIGH].avg_deviation_cents)


class TestCompareTrends(unittest.TestCase):

    def test_improvement(self):
        before = [
            TuningRecord("P001", "A4", parse_note("A4"), 435.0, tuning_date="2025-01-15", tuning_phase=TuningPhase.BEFORE),
            TuningRecord("P001", "B4", parse_note("B4"), 488.0, tuning_date="2025-01-15", tuning_phase=TuningPhase.BEFORE),
        ]
        after = [
            TuningRecord("P001", "A4", parse_note("A4"), 440.0, tuning_date="2025-01-15", tuning_phase=TuningPhase.AFTER),
            TuningRecord("P001", "B4", parse_note("B4"), 494.0, tuning_date="2025-01-15", tuning_phase=TuningPhase.AFTER),
        ]
        trends = compare_trends(before, after)
        self.assertTrue(len(trends) > 0)
        mid_high = [t for t in trends if t.zone == ToneZone.MID_HIGH]
        self.assertTrue(len(mid_high) > 0)
        self.assertIsNotNone(mid_high[0].improvement_cents)
        self.assertGreater(mid_high[0].improvement_cents, 0)


class TestDetectAnomalies(unittest.TestCase):

    def _make_record(self, note, measured_freq=None, deviation_cents=None, room_temp=None, room_humidity=None):
        parsed = parse_note(note)
        return TuningRecord(
            piano_id="P001",
            note_raw=note,
            note_parsed=parsed,
            measured_freq=measured_freq,
            deviation_cents=deviation_cents,
            tuning_date="2025-01-15",
            tuning_phase=TuningPhase.BEFORE,
            room_temp=room_temp,
            room_humidity=room_humidity,
        )

    def test_extreme_deviation(self):
        rec = self._make_record("A4", deviation_cents=60.0)
        devs = compute_deviations([rec])
        anomalies = detect_anomalies([rec], devs)
        types = [a.anomaly_type for a in anomalies]
        self.assertIn("极端频偏", types)

    def test_large_deviation(self):
        rec = self._make_record("A4", deviation_cents=18.0)
        devs = compute_deviations([rec])
        anomalies = detect_anomalies([rec], devs)
        types = [a.anomaly_type for a in anomalies]
        self.assertIn("较大频偏", types)

    def test_missing_both_freq_and_cents(self):
        rec = self._make_record("A4")
        devs = compute_deviations([rec])
        anomalies = detect_anomalies([rec], devs)
        types = [a.anomaly_type for a in anomalies]
        self.assertIn("缺少测量数据", types)
        suggestion = [a.suggestion for a in anomalies if a.anomaly_type == "缺少测量数据"][0]
        self.assertIn("补充", suggestion)

    def test_unparseable_note(self):
        rec = TuningRecord(
            piano_id="P001",
            note_raw="X9",
            note_parsed=None,
            tuning_date="2025-01-15",
            tuning_phase=TuningPhase.BEFORE,
        )
        anomalies = detect_anomalies([rec], [])
        types = [a.anomaly_type for a in anomalies]
        self.assertIn("无法解析音名", types)
        suggestion = [a.suggestion for a in anomalies if a.anomaly_type == "无法解析音名"][0]
        self.assertIn("Cb", suggestion)

    def test_freq_hz_vs_cents_mismatch(self):
        rec = self._make_record("A4", measured_freq=442.0, deviation_cents=50.0)
        devs = compute_deviations([rec])
        anomalies = detect_anomalies([rec], devs)
        types = [a.anomaly_type for a in anomalies]
        self.assertIn("频偏与频率不一致", types)

    def test_freq_out_of_range(self):
        rec = self._make_record("A4", measured_freq=15000.0)
        devs = compute_deviations([rec])
        anomalies = detect_anomalies([rec], devs)
        types = [a.anomaly_type for a in anomalies]
        self.assertIn("频率超出钢琴范围", types)

    def test_suspected_khz_as_hz(self):
        rec = self._make_record("A4", measured_freq=0.44)
        devs = compute_deviations([rec])
        anomalies = detect_anomalies([rec], devs)
        types = [a.anomaly_type for a in anomalies]
        self.assertIn("疑似单位错误", types)

    def test_suspected_hz_in_cents_column(self):
        rec = self._make_record("A4", deviation_cents=600.0)
        devs = compute_deviations([rec])
        anomalies = detect_anomalies([rec], devs)
        types = [a.anomaly_type for a in anomalies]
        self.assertIn("疑似Hz值误填为音分", types)

    def test_harmonic_error(self):
        rec = self._make_record("A4", measured_freq=1760.0)
        devs = compute_deviations([rec])
        anomalies = detect_anomalies([rec], devs)
        types = [a.anomaly_type for a in anomalies]
        self.assertIn("疑似频率倍频错误", types)

    def test_extreme_temp(self):
        rec = self._make_record("A4", measured_freq=440.0, room_temp=5.0)
        devs = compute_deviations([rec])
        anomalies = detect_anomalies([rec], devs)
        types = [a.anomaly_type for a in anomalies]
        self.assertIn("室温异常", types)

    def test_extreme_humidity(self):
        rec = self._make_record("A4", measured_freq=440.0, room_humidity=95.0)
        devs = compute_deviations([rec])
        anomalies = detect_anomalies([rec], devs)
        types = [a.anomaly_type for a in anomalies]
        self.assertIn("湿度异常", types)

    def test_freq_zone_mismatch(self):
        rec = self._make_record("A4", measured_freq=50.0)
        devs = compute_deviations([rec])
        anomalies = detect_anomalies([rec], devs)
        types = [a.anomaly_type for a in anomalies]
        self.assertIn("频率与音区不匹配", types)

    def test_anomaly_has_suggestion(self):
        rec = self._make_record("A4", deviation_cents=60.0)
        devs = compute_deviations([rec])
        anomalies = detect_anomalies([rec], devs)
        for a in anomalies:
            self.assertTrue(len(a.suggestion) > 0, f"异常 '{a.anomaly_type}' 缺少建议")

    def test_zone_high_variance(self):
        records = []
        for cents in [30, -25, 20, -35, 28]:
            rec = self._make_record("C4", deviation_cents=cents)
            records.append(rec)
        devs = compute_deviations(records)
        anomalies = detect_anomalies(records, devs)
        types = [a.anomaly_type for a in anomalies]
        self.assertIn("音区内频偏离散度过大", types)


class TestExplainAll(unittest.TestCase):

    def test_no_anomalies(self):
        text = explain_all([])
        self.assertIn("未发现异常", text)

    def test_with_anomalies(self):
        anomalies = [
            AnomalyExplanation("key1", "测试类型", "测试详情", "测试建议"),
            AnomalyExplanation("key2", "测试类型", "详情2", "建议2"),
        ]
        text = explain_all(anomalies)
        self.assertIn("测试类型", text)
        self.assertIn("测试建议", text)


class TestBuildFullReport(unittest.TestCase):

    def test_report_with_data(self):
        records = [
            TuningRecord("P001", "A4", parse_note("A4"), 440.5, tuning_date="2025-01-15", tuning_phase=TuningPhase.BEFORE),
            TuningRecord("P001", "B4", parse_note("B4"), 495.0, tuning_date="2025-01-15", tuning_phase=TuningPhase.BEFORE),
            TuningRecord("P001", "A4", parse_note("A4"), 440.0, tuning_date="2025-01-15", tuning_phase=TuningPhase.AFTER),
            TuningRecord("P001", "B4", parse_note("B4"), 494.0, tuning_date="2025-01-15", tuning_phase=TuningPhase.AFTER),
        ]
        report = build_full_report("P001", records)
        self.assertIn("deviations", report)
        self.assertIn("aggregates", report)
        self.assertIn("trends", report)
        self.assertIn("anomalies", report)

        text = generate_text_report(
            "P001",
            records,
            report["deviations"],
            report["aggregates"],
            report["trends"],
            report["anomalies"],
        )
        self.assertIn("P001", text)
        self.assertIn("频偏统计", text)

    def test_empty_report(self):
        report = build_full_report("P001", [])
        self.assertEqual(len(report["deviations"]), 0)


class TestExportFormats(unittest.TestCase):

    def test_json_export(self):
        records = [
            TuningRecord("P001", "A4", parse_note("A4"), 440.5, tuning_date="2025-01-15", tuning_phase=TuningPhase.BEFORE),
        ]
        report = build_full_report("P001", records)
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            path = f.name
        try:
            export_json("P001", records, report["deviations"], report["aggregates"], report["trends"], report["anomalies"], path)
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.assertEqual(data["piano_id"], "P001")
            self.assertEqual(len(data["deviations"]), 1)
        finally:
            os.unlink(path)

    def test_csv_export(self):
        devs = [DeviationResult("A", 4, "A4", ToneZone.MID_HIGH, 440.5, 440.0, 1.96, 0.5)]
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            path = f.name
        try:
            export_csv(devs, path)
            with open(path, "r", encoding="utf-8-sig") as f:
                reader = csv.reader(f)
                rows = list(reader)
            self.assertEqual(len(rows), 2)
            self.assertEqual(rows[1][0], "A4")
        finally:
            os.unlink(path)


class TestCLIIntegration(unittest.TestCase):

    def _write_csv(self, rows, header=None):
        f = tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8-sig", newline="")
        writer = csv.writer(f)
        if header:
            writer.writerow(header)
        for row in rows:
            writer.writerow(row)
        f.close()
        return f.name

    def test_import_command(self):
        path = self._write_csv(
            [["P001", "A4", "440.5", "", "", "2025-01-15", "before"]],
            header=["钢琴编号", "键名", "实测频率", "单位", "频偏", "日期", "阶段"],
        )
        try:
            with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as dbf:
                db_path = dbf.name
            cli_main(["import", path, "--conflict=skip", f"--save-db={db_path}"])
            self.assertTrue(os.path.exists(db_path))
            os.unlink(db_path)
        finally:
            os.unlink(path)

    def test_check_command(self):
        path = self._write_csv(
            [["P001", "A4", "440.5", "", "", "2025-01-15", "before"]],
            header=["钢琴编号", "键名", "实测频率", "单位", "频偏", "日期", "阶段"],
        )
        try:
            cli_main(["check", path])
        finally:
            os.unlink(path)

    def test_zones_command(self):
        path = self._write_csv(
            [
                ["P001", "A4", "440.5", "", "", "2025-01-15", "before"],
                ["P001", "C3", "131.0", "", "", "2025-01-15", "before"],
                ["P001", "C6", "1050.0", "", "", "2025-01-15", "before"],
            ],
            header=["钢琴编号", "键名", "实测频率", "单位", "频偏", "日期", "阶段"],
        )
        try:
            cli_main(["zones", path])
        finally:
            os.unlink(path)

    def test_report_command(self):
        path = self._write_csv(
            [
                ["P001", "A4", "435.0", "", "", "2025-01-15", "before"],
                ["P001", "A4", "440.0", "", "", "2025-01-15", "after"],
                ["P001", "C4", "260.0", "", "", "2025-01-15", "before"],
                ["P001", "C4", "262.0", "", "", "2025-01-15", "after"],
            ],
            header=["钢琴编号", "键名", "实测频率", "单位", "频偏", "日期", "阶段"],
        )
        try:
            with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as tf:
                out_path = tf.name
            cli_main(["report", path, f"--output={out_path}"])
            with open(out_path, "r", encoding="utf-8") as f:
                content = f.read()
            self.assertIn("频偏统计", content)
            self.assertIn("趋势对比", content)
            os.unlink(out_path)
        finally:
            os.unlink(path)


class TestBoundaryValues(unittest.TestCase):

    def test_exact_standard_freq(self):
        n = parse_note("A4")
        self.assertAlmostEqual(n.standard_freq, 440.0)

    def test_cents_at_boundary(self):
        self.assertAlmostEqual(freq_to_cents(440.0, 440.0), 0.0, places=3)

    def test_very_small_deviation(self):
        rec = TuningRecord("P001", "A4", parse_note("A4"), 440.01, tuning_date="2025-01-15", tuning_phase=TuningPhase.BEFORE)
        devs = compute_deviations([rec])
        self.assertAlmostEqual(devs[0].deviation_cents, 0.039, places=2)

    def test_zero_freq(self):
        self.assertEqual(freq_to_cents(0.0, 440.0), 0.0)

    def test_parse_note_whitespace(self):
        n = parse_note("  A4  ")
        self.assertIsNotNone(n)
        self.assertEqual(n.canonical, "A4")


class TestHistoryOverride(unittest.TestCase):

    def test_update_overwrites_old_data(self):
        store = DataStore()
        rec1 = TuningRecord("P001", "A4", parse_note("A4"), 435.0, tuning_date="2025-01-15", tuning_phase=TuningPhase.BEFORE)
        store.records[rec1.primary_key] = rec1

        rec2 = TuningRecord("P001", "A4", parse_note("A4"), 440.0, tuning_date="2025-01-15", tuning_phase=TuningPhase.BEFORE)
        result = ImportResult()
        store._apply_record(rec2, ConflictPolicy.UPDATE, result)
        self.assertEqual(len(result.updated), 1)
        self.assertAlmostEqual(store.records[rec1.primary_key].measured_freq, 440.0)

    def test_skip_preserves_old_data(self):
        store = DataStore()
        rec1 = TuningRecord("P001", "A4", parse_note("A4"), 435.0, tuning_date="2025-01-15", tuning_phase=TuningPhase.BEFORE)
        store.records[rec1.primary_key] = rec1

        rec2 = TuningRecord("P001", "A4", parse_note("A4"), 440.0, tuning_date="2025-01-15", tuning_phase=TuningPhase.BEFORE)
        result = ImportResult()
        store._apply_record(rec2, ConflictPolicy.SKIP, result)
        self.assertEqual(len(result.skipped), 1)
        self.assertAlmostEqual(store.records[rec1.primary_key].measured_freq, 435.0)

    def test_conflict_reports_diff(self):
        store = DataStore()
        rec1 = TuningRecord("P001", "A4", parse_note("A4"), 435.0, deviation_cents=-19.6, tuning_date="2025-01-15", tuning_phase=TuningPhase.BEFORE, room_temp=20.0)
        store.records[rec1.primary_key] = rec1

        rec2 = TuningRecord("P001", "A4", parse_note("A4"), 440.0, deviation_cents=0.0, tuning_date="2025-01-15", tuning_phase=TuningPhase.BEFORE, room_temp=25.0)
        result = ImportResult()
        store._apply_record(rec2, ConflictPolicy.ERROR, result)
        self.assertEqual(len(result.conflicts), 1)
        diffs = result.conflicts[0].field_differences
        diff_fields = [d[0] for d in diffs]
        self.assertIn("实测频率", diff_fields)
        self.assertIn("温度", diff_fields)


class TestEnharmonicErrors(unittest.TestCase):

    def test_eb_and_ds_map_same(self):
        eb = parse_note("Eb4")
        ds = parse_note("D#4")
        self.assertIsNotNone(eb)
        self.assertIsNotNone(ds)
        self.assertEqual(eb.canonical, ds.canonical)
        self.assertAlmostEqual(eb.standard_freq, ds.standard_freq)

    def test_gb_maps_to_fsharp(self):
        gb = parse_note("Gb4")
        fs = parse_note("F#4")
        self.assertEqual(gb.canonical, fs.canonical)

    def test_eslash_f_mapping(self):
        es = parse_note("E#4")
        self.assertEqual(es.canonical, "F4")
        bf = parse_note("B#3")
        self.assertEqual(bf.canonical, "C4")


if __name__ == "__main__":
    unittest.main()
