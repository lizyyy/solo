from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

from probreplay import materials, sorter, simulator, audit  # noqa: E402
from probreplay.models import SimParams, Record  # noqa: E402


DEMO_DIR = os.path.join(ROOT, "data", "demo")


class TestMaterials(unittest.TestCase):
    def test_load_all_types(self):
        mats = materials.load_materials(DEMO_DIR)
        types = {m.type for m in mats}
        self.assertLessEqual({"scoring_notes", "normal_record", "oral_explanation"}, types)

    def test_detect_stance_changes(self):
        mats = materials.load_materials(DEMO_DIR)
        changes = materials.detect_stance_changes(mats)
        self.assertEqual(len(changes), 1)
        self.assertEqual(changes[0].material_id, "oe-2024-06-15")
        self.assertEqual(changes[0].author, "数学老师老叶")
        self.assertNotEqual(changes[0].from_stance, changes[0].to_stance)
        self.assertIn("改判", changes[0].to_stance)
        self.assertIn("改判", changes[0].reason)

    def test_derive_records_and_adjustments(self):
        mats = materials.load_materials(DEMO_DIR)
        recs, adj = materials.derive_records(mats)
        ids = {r.id for r in recs}
        self.assertEqual(ids, {"S001", "S002", "S003", "S004", "S005", "S006"})
        self.assertEqual(adj["S004"], ["oe-2024-06-15"])
        s4 = next(r for r in recs if r.id == "S004")
        self.assertEqual(s4.base_score, 60.0)
        self.assertEqual(s4.effective_score, 59.0)
        self.assertEqual(s4.meta.get("adjustments")[0]["delta"], -1.0)


class TestSorter(unittest.TestCase):
    def _make_records(self, scores):
        return [Record(id=f"S{i}", name=f"s{i}", base_score=float(s), effective_score=float(s))
                for i, s in enumerate(scores)]

    def test_unstable_sort_detected_and_deterministic(self):
        recs = self._make_records([88, 60, 60, 60, 72, 58])
        sr, instab = sorter.sort_records(recs, "effective_score", True)
        self.assertEqual(len(instab), 1)
        self.assertEqual(instab[0].tied_value, 60.0)
        self.assertEqual(len(instab[0].record_ids), 3)
        self.assertIn("待确认原因", instab[0].reason_pending)
        self.assertIn("处理去向", instab[0].resolution)
        ranks = [(r.id, r.meta["rank"]) for r in sr]
        for _ in range(5):
            sr2, _ = sorter.sort_records(list(recs), "effective_score", True)
            ranks2 = [(r.id, r.meta["rank"]) for r in sr2]
            self.assertEqual(ranks, ranks2)
        self.assertGreater(sr[0].effective_score, sr[-1].effective_score)


class TestSimulator(unittest.TestCase):
    def _run(self, pass_threshold=60.0, sigma=1.0, unit="point"):
        mats = materials.load_materials(DEMO_DIR)
        recs, _ = materials.derive_records(mats)
        sr, _ = sorter.sort_records(recs, "effective_score", True)
        p = SimParams(pass_threshold=pass_threshold, sigma=sigma, unit=unit, n_trials=2000, seed=42)
        return simulator.simulate(sr, p, max_score=100.0)

    def test_baseline_has_boundary_and_rate(self):
        r = self._run()
        self.assertGreater(r.aggregate_pass_rate, 0.0)
        self.assertLessEqual(r.aggregate_pass_rate, 1.0)
        self.assertTrue(any(rr.is_boundary for rr in r.records))
        s4 = next(rr for rr in r.records if rr.record_id == "S004")
        self.assertTrue(s4.is_boundary)

    def test_determinism(self):
        r1 = self._run()
        r2 = self._run()
        self.assertEqual(r1.aggregate_pass_rate, r2.aggregate_pass_rate)

    def test_parse_adjust_next_notch(self):
        p = SimParams(pass_threshold=60.0, sigma=1.0)
        name, old, new = simulator.parse_adjust("pass_threshold", p)
        self.assertEqual(name, "pass_threshold")
        self.assertEqual(old, 60.0)
        self.assertEqual(new, 62.0)

    def test_parse_adjust_explicit_value(self):
        p = SimParams()
        name, old, new = simulator.parse_adjust("sigma=0.5", p)
        self.assertEqual((name, old, new), ("sigma", 1.0, 0.5))

    def test_attribute_delta_adds_up(self):
        base = self._run(pass_threshold=60.0)
        adj = self._run(pass_threshold=58.0)
        attr = simulator.attribute_delta(base, adj, "pass_threshold", 60.0, 58.0, 100.0)
        self.assertAlmostEqual(
            attr.delta,
            attr.boundary_effect + attr.non_boundary_effect,
            places=6,
        )
        self.assertTrue(attr.boundary_flips)
        self.assertIn("S004", attr.boundary_flips)
        self.assertIn("公式", attr.formula_explanation)
        self.assertIn("单位", attr.unit_explanation)
        self.assertIn("边界样本", attr.boundary_explanation)

    def test_unit_switch_preserves_judgement(self):
        point = self._run(pass_threshold=60.0, unit="point")
        pct = self._run(pass_threshold=60.0, unit="percent")
        for pr, pc in zip(point.records, pct.records):
            self.assertEqual(pr.record_id, pc.record_id)
            self.assertAlmostEqual(pr.pass_prob, pc.pass_prob, places=2)


class TestAudit(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="audit_test_")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_append_and_trace(self):
        mats = materials.load_materials(DEMO_DIR)
        recs, _ = materials.derive_records(mats)
        sr, instab = sorter.sort_records(recs, "effective_score", True)
        scs = materials.detect_stance_changes(mats)
        base = simulator.simulate(sr, SimParams(), 100.0)

        entry = audit.build_entry(
            operator="老叶",
            input_dir=DEMO_DIR,
            output_dir=self.tmp,
            params=SimParams(),
            adjusted_param=None,
            materials=mats,
            stance_changes=scs,
            sort_instabilities=instab,
            summary={"baseline_rate": base.aggregate_pass_rate},
        )
        audit.append_audit(self.tmp, entry)
        read = audit.read_audit(self.tmp)
        self.assertEqual(len(read), 1)
        self.assertEqual(read[0]["operator"], "老叶")

        traced = audit.trace_stance_changes(read, author="数学老师老叶")
        self.assertEqual(len(traced), 1)
        self.assertEqual(traced[0]["material_id"], "oe-2024-06-15")
        self.assertIn("改判", traced[0]["to_stance"])
        self.assertEqual(traced[0]["operator"], "老叶")


class TestCLISeparation(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="cli_test_")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_outputs_separate(self):
        proc = subprocess.run(
            [
                sys.executable,
                os.path.join(ROOT, "replay.py"),
                "--input", DEMO_DIR,
                "--output", self.tmp,
                "--adjust", "pass_threshold=58",
                "--operator", "老叶",
                "--trials", "500",
            ],
            capture_output=True,
            text=True,
            cwd=ROOT,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        stdout = proc.stdout
        self.assertIn("终端摘要", stdout)
        self.assertIn("通过率", stdout)
        self.assertNotIn("\"baseline\"", stdout)
        self.assertNotIn("\"attribution\"", stdout)
        self.assertTrue(stdout.count("\n") < 40, "终端输出应保持简洁")
        for name in ("report.html", "timeline.json", "audit_trail.jsonl"):
            self.assertTrue(
                os.path.isfile(os.path.join(self.tmp, name)),
                f"缺失输出文件: {name}",
            )
        with open(os.path.join(self.tmp, "timeline.json"), encoding="utf-8") as fh:
            tl = json.load(fh)
        self.assertIn("attribution", tl)
        self.assertIn("records", tl)
        self.assertEqual(tl["operator"], "老叶")
        self.assertEqual(tl["adjusted_param"]["name"], "pass_threshold")
        with open(os.path.join(self.tmp, "audit_trail.jsonl"), encoding="utf-8") as fh:
            lines = [ln for ln in fh if ln.strip()]
        self.assertEqual(len(lines), 1)
        ent = json.loads(lines[0])
        self.assertEqual(ent["operator"], "老叶")
        self.assertEqual(len(ent["stance_changes"]), 1)
        self.assertEqual(ent["stance_changes"][0]["author"], "数学老师老叶")


if __name__ == "__main__":
    unittest.main(verbosity=2)
