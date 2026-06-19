"""曲线拟合图表解释器单元测试（Python 3 unittest，零第三方依赖）。

覆盖：
- 拟合正确性（线性/二次/指数）
- 单位判定（缺失/歧义/合法复合）与换算
- 状态裁定（5 种状态的触发）
- 版本冲突检测与区分
- 整批端到端
"""

import json
import os
import sys
import tempfile
import unittest

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT)

from interpreter import conflict, fitting, sources, status, units, report
from interpreter.models import (
    FitResult,
    RawRecord,
    SOURCE_LABEL,
    SourceType,
    STATUS_LABEL,
    Status,
    VerbalNote,
)
from interpreter.status import decide


# ---------------------------------------------------------------------------
# 拟合正确性
# ---------------------------------------------------------------------------
class FittingAccuracyTests(unittest.TestCase):
    def test_linear_perfect_y_eq_2x(self):
        """y=2x，(0,0),(1,2),(2,4),(3,6) 应给出截距0，斜率2，R²=1。"""
        fit = fitting.fit_linear([[0, 0], [1, 2], [2, 4], [3, 6]])
        self.assertTrue(fit.success)
        self.assertAlmostEqual(fit.coefficients["intercept"], 0.0, places=9)
        self.assertAlmostEqual(fit.coefficients["slope"], 2.0, places=9)
        self.assertAlmostEqual(fit.r_squared, 1.0, places=9)
        self.assertAlmostEqual(fit.ss_res, 0.0, places=9)
        self.assertGreater(len(fit.solve_steps), 0, "法方程求解步骤必须留痕")

    def test_quadratic_free_fall(self):
        """自由落体 y=½gt² ≈ 4.9·x²，按 0, 0.1s, …, 0.5s 给出 y。"""
        pts = [[0, 0], [0.1, 0.049], [0.2, 0.196], [0.3, 0.441], [0.4, 0.784], [0.5, 1.225]]
        fit = fitting.fit_quadratic(pts)
        self.assertTrue(fit.success)
        self.assertAlmostEqual(fit.coefficients["c2"], 4.9, places=3)
        self.assertAlmostEqual(fit.coefficients["c1"], 0.0, places=3)
        self.assertAlmostEqual(fit.coefficients["c0"], 0.0, places=3)
        self.assertGreater(fit.r_squared, 0.999)

    def test_exponential_decay(self):
        """y=100·exp(-0.04x) 噪声极小，应还原 a≈100, b≈-0.04。"""
        import math
        pts = [[t, 100 * math.exp(-0.04 * t)] for t in range(0, 60, 10)]
        fit = fitting.fit_exponential(pts)
        self.assertTrue(fit.success)
        self.assertAlmostEqual(fit.coefficients["a"], 100.0, places=3)
        self.assertAlmostEqual(fit.coefficients["b"], -0.04, places=3)
        self.assertGreater(fit.r_squared, 0.999)

    def test_unknown_model_fails(self):
        fit = fitting.fit_record("cubic", [[1, 1], [2, 4], [3, 9]])
        self.assertFalse(fit.success)
        self.assertIn("未知或缺失模型", fit.error)

    def test_empty_model_fails(self):
        fit = fitting.fit_record("", [[1, 1], [2, 2]])
        self.assertFalse(fit.success)
        self.assertIn("未知或缺失模型", fit.error)

    def test_exponential_nonpositive_y_fails(self):
        fit = fitting.fit_exponential([[0, 0], [1, 1]])
        self.assertFalse(fit.success)
        self.assertIn("非正值", fit.error)


# ---------------------------------------------------------------------------
# 单位判定与换算
# ---------------------------------------------------------------------------
class UnitTests(unittest.TestCase):
    def test_missing_empty(self):
        self.assertTrue(units.is_missing(""))
        self.assertTrue(units.is_missing(None))
        self.assertTrue(units.is_missing("缺失"))
        self.assertFalse(units.is_missing("cm"))

    def test_ambiguous_cm_slash_mm(self):
        """cm/mm 属同量纲不同单位 → 歧义。"""
        self.assertTrue(units.is_ambiguous("cm/mm"))

    def test_ambiguous_huo(self):
        """'cm或mm' 属歧义。"""
        self.assertTrue(units.is_ambiguous("cm或mm"))

    def test_composite_unit_mol_per_L(self):
        """mol/L 为合法复合单位（两侧不同量纲），不得算歧义。"""
        self.assertFalse(units.is_ambiguous("mol/L"))

    def test_composite_unit_m_per_s(self):
        """m/s 合法。"""
        self.assertFalse(units.is_ambiguous("m/s"))

    def test_conversion_mm_to_cm(self):
        """20.1 mm → 2.01 cm。"""
        factor, desc = units.conversion_factor("mm", "cm")
        self.assertIsNotNone(factor)
        self.assertAlmostEqual(factor, 0.1, places=10)
        self.assertIn("mm = 0.1 cm", desc)

    def test_conversion_incompatible(self):
        """长度 → 电阻 不可换算。"""
        self.assertIsNone(units.conversion_factor("cm", "Ω"))

    def test_apply_y_conversion_linear(self):
        fit = FitResult(model="linear", success=True,
                        coefficients={"intercept": 0.0, "slope": 20.1},
                        coefficient_order=["intercept", "slope"],
                        r_squared=0.99)
        conv = units.apply_y_conversion(fit, "mm", "cm")
        self.assertIsNotNone(conv)
        self.assertAlmostEqual(conv["converted_coefficients"]["slope"], 2.01, places=9)
        self.assertAlmostEqual(conv["converted_coefficients"]["intercept"], 0.0, places=9)
        self.assertTrue(conv["steps"], "换算步骤必须留痕")

    def test_apply_y_conversion_exponential_b_untouched(self):
        """指数项系数 b 不受 y 量纲影响。"""
        fit = FitResult(model="exponential", success=True,
                        coefficients={"a": 1000.0, "b": -0.04},
                        coefficient_order=["a", "b"],
                        r_squared=0.99)
        conv = units.apply_y_conversion(fit, "Ω", "kΩ")
        self.assertIsNotNone(conv)
        self.assertAlmostEqual(conv["converted_coefficients"]["a"], 1.0, places=9)
        self.assertAlmostEqual(conv["converted_coefficients"]["b"], -0.04, places=9)


# ---------------------------------------------------------------------------
# 状态裁定（算不出的记录不消失，必卡一关）
# ---------------------------------------------------------------------------
class StatusDecisionTests(unittest.TestCase):
    def _make_record(self, **kw):
        defaults = dict(
            question_id="T", title="T", model="linear",
            x_unit="N", y_unit="cm",
            points=[[0, 0], [1, 2], [2, 4], [3, 6], [4, 8]],
            threshold={"min_r2": 0.95},
            source=SourceType.NORMAL_RECORD,
            source_meta={},
        )
        defaults.update(kw)
        return RawRecord(**defaults)

    def test_ok_path(self):
        rec = self._make_record()
        fit = fitting.fit_record(rec.model, rec.points)
        d = decide(rec, fit, [])
        self.assertEqual(d.status, Status.OK)
        self.assertIn("normal_record", d.influenced_by)

    def test_stuck_formula_empty_model(self):
        rec = self._make_record(model="")
        fit = fitting.fit_record(rec.model, rec.points)
        d = decide(rec, fit, [])
        self.assertEqual(d.status, Status.STUCK_FORMULA)
        self.assertTrue(d.pending_items, "必须给待办")

    def test_stuck_unit_ambiguous(self):
        rec = self._make_record(y_unit="cm/mm")
        fit = fitting.fit_record(rec.model, rec.points)
        d = decide(rec, fit, [])
        self.assertEqual(d.status, Status.STUCK_UNIT)

    def test_pending_pm_missing_unit(self):
        """单位缺失 → PENDING_PM（不给假稳定结论）。"""
        rec = self._make_record(y_unit="")
        fit = fitting.fit_record(rec.model, rec.points)
        d = decide(rec, fit, [])
        self.assertEqual(d.status, Status.PENDING_PM)
        self.assertIn("单位缺失", d.reason)

    def test_pending_pm_verbal_notes_are_hints_only(self):
        rec = self._make_record(y_unit="")
        fit = fitting.fit_record(rec.model, rec.points)
        notes = [VerbalNote(question_id="T", note="单位是kΩ",
                            source_meta={"received": "2026-06-12"})]
        d = decide(rec, fit, notes)
        self.assertEqual(d.status, Status.PENDING_PM, "口头备注不能确认单位，必须仍是挂起")
        self.assertTrue(any("口头提及" in p or "kΩ" in p for p in d.pending_items))
        self.assertIn("verbal_note", d.influenced_by)

    def test_stuck_threshold(self):
        """强弯曲数据用线性拟合 → R² 低于阈值 → STUCK_THRESHOLD。"""
        rec = self._make_record(points=[[0, 0], [1, 0.9], [2, 1.5], [3, 1.7], [4, 1.6]],
                                threshold={"min_r2": 0.99})
        fit = fitting.fit_record(rec.model, rec.points)
        d = decide(rec, fit, [])
        self.assertEqual(d.status, Status.STUCK_THRESHOLD)
        self.assertIn(str(fit.r_squared)[:4], d.reason)


# ---------------------------------------------------------------------------
# 冲突检测
# ---------------------------------------------------------------------------
class ConflictTests(unittest.TestCase):
    def test_conflict_between_draft_and_normal(self):
        canon = RawRecord("Q", "S", "linear", "N", "cm",
                          [[0, 0], [1, 2], [2, 4]],
                          {"min_r2": 0.95}, SourceType.NORMAL_RECORD, {})
        draft = RawRecord("Q", "S", "linear", "N", "mm",
                          [[0, 0], [1, 20]],
                          {"min_r2": 0.95}, SourceType.STUDENT_DRAFT_OLD, {})
        has, detail = conflict.summarize(canon, [draft])
        self.assertTrue(has)
        self.assertIn("y轴单位不同", detail)
        self.assertIn("以正式记录为基准", detail)
        self.assertIn("不覆盖正式结论", detail)

    def test_no_conflict_identical(self):
        canon = RawRecord("Q", "S", "linear", "N", "cm",
                          [[0, 0], [1, 2]],
                          {"min_r2": 0.95}, SourceType.NORMAL_RECORD, {})
        other = RawRecord("Q", "S", "linear", "N", "cm",
                          [[0, 0], [1, 2]],
                          {"min_r2": 0.95}, SourceType.STUDENT_DRAFT_OLD, {})
        has, detail = conflict.summarize(canon, [other])
        self.assertFalse(has)
        self.assertEqual(detail, "")


# ---------------------------------------------------------------------------
# 端到端：整批解释
# ---------------------------------------------------------------------------
class EndToEndTests(unittest.TestCase):
    BATCH = os.path.join(PROJECT, "samples", "batch_2026_06")

    def test_load_batch_and_group(self):
        records, notes, manifest = sources.load_batch(self.BATCH)
        self.assertEqual(manifest["batch_id"], "batch_2026_06")
        self.assertEqual(len(records), 7)  # 6 条正式 + 1 条草稿旧版
        self.assertEqual(len(notes), 3)
        bundles = sources.group_by_question(records, notes)
        self.assertEqual(len(bundles), 6)

    def test_whole_batch_covers_all_five_statuses(self):
        """整批应当把 5 种状态都覆盖到：OK / STUCK_FORMULA / STUCK_UNIT / STUCK_THRESHOLD / PENDING_PM。"""
        with tempfile.TemporaryDirectory() as td:
            charts_dir = os.path.join(td, "charts")
            br = report.interpret_batch(self.BATCH, charts_dir)
            summary = br.summary
            for s in ("OK", "STUCK_FORMULA", "STUCK_UNIT", "STUCK_THRESHOLD", "PENDING_PM"):
                self.assertGreaterEqual(summary.get(s, 0), 1, f"状态 {s} 应至少有 1 道题覆盖")
            # OK 至少 2（Q-2026-001 弹簧，Q-2026-002 落体）
            self.assertGreaterEqual(summary.get("OK", 0), 2)

    def test_conflict_question_has_two_parameter_sets(self):
        with tempfile.TemporaryDirectory() as td:
            charts_dir = os.path.join(td, "charts")
            br = report.interpret_batch(self.BATCH, charts_dir)
            q001 = next(q for q in br.questions if q.question_id == "Q-2026-001")
            self.assertTrue(q001.conflict)
            self.assertGreaterEqual(len(q001.parameter_sets), 2, "冲突题必须有 A/B 两套参数集")
            # A cm、B mm
            units_seen = [p.unit_y for p in q001.parameter_sets]
            self.assertIn("cm", units_seen)
            self.assertIn("mm", units_seen)
            # 必有单位换算步骤
            conv_p = next(p for p in q001.parameter_sets if p.unit_y == "mm")
            self.assertTrue(conv_p.unit_conversion, "mm 参数集必须有向 cm 对齐的换算")
            self.assertTrue(conv_p.intermediate_calculations, "中间计算步骤必须留痕")

    def test_influenced_by_vs_audit_sources(self):
        """冲突题 influenced_by 只写正式记录；audit_sources 才列出三类。"""
        with tempfile.TemporaryDirectory() as td:
            br = report.interpret_batch(self.BATCH, os.path.join(td, "charts"))
            q001 = next(q for q in br.questions if q.question_id == "Q-2026-001")
            self.assertEqual(q001.influenced_by, ["normal_record"],
                             "正式记录才影响结论，草稿/口头不能覆盖")
            self.assertIn("student_draft_old", q001.audit_sources)
            self.assertIn("verbal_note", q001.audit_sources)

    def test_write_outputs_and_json_roundtrip(self):
        with tempfile.TemporaryDirectory() as td:
            output = os.path.join(td, "out")
            charts_dir = os.path.join(output, "charts")
            br = report.interpret_batch(self.BATCH, charts_dir)
            txt_path, json_path = report.write_outputs(br, output)
            self.assertTrue(os.path.isfile(txt_path))
            self.assertTrue(os.path.isfile(json_path))
            self.assertTrue(os.path.isdir(charts_dir))
            # 每题一个 svg
            svg_count = len([f for f in os.listdir(charts_dir) if f.endswith(".svg")])
            self.assertEqual(svg_count, len(br.questions))
            # JSON 可反序列化，摘要与内存一致
            with open(json_path, "r", encoding="utf-8") as f:
                d = json.load(f)
            self.assertEqual(d["batch_id"], br.batch_id)
            self.assertEqual(d["summary"], br.summary)

    def test_pending_pm_question_says_no_false_stability(self):
        """Q-2026-003 y单位缺失，必须是 PENDING_PM，绝不是 OK。"""
        with tempfile.TemporaryDirectory() as td:
            br = report.interpret_batch(self.BATCH, os.path.join(td, "charts"))
            q = next(q for q in br.questions if q.question_id == "Q-2026-003")
            self.assertEqual(q.status, Status.PENDING_PM)
            self.assertIn("单位缺失", q.status_reason)
            self.assertTrue(q.pending_items, "必须给项目经理明确的待办")


if __name__ == "__main__":
    unittest.main()
