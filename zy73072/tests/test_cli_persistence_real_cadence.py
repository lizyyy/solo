"""真实节奏验收：跨进程连续调用 CLI，验证状态持久化完整接住了。

模拟场景（与用户灰度发布节奏一致）：
  1. 进程A：导入旧材料 phase1 → 写 state
  2. 进程B：补边界样本 phase2 → 读 state，写 state
  3. 进程C（与前两个毫无内存联系）：执行 summary 命令
  验收点：
    - summary 的 import_diagnostic 要保留最近一次导入的统计：
      records_new=1, records_duplicate_skipped=2
    - change_description 里不该把历史 6 条当新增，应该是 phase2 实际新增的 1 条
    - 有照片时间错位的 impact_scope 和 wrap_up_action
    - summary 返回码是 5（照片时间错位 + bad_data 取大）
    - page_summary.last_import_report.photo_mismatch_impact 齐全
    - CLI 返回码和 JSON 都能被值班脚本解析
"""
import json
import os
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

TESTDATA_PHASE1 = os.path.join(ROOT, "testdata", "phase1_old_records.json")
TESTDATA_PHASE2 = os.path.join(ROOT, "testdata", "phase2_boundary_and_followup.json")


def _run_cli(state_path, *extra_args):
    """新开一个 Python 子进程运行 CLI，返回 (exit_code, stdout_json, stderr_text)"""
    cmd = [
        sys.executable,
        "-m",
        "pdg_wsp_scheduler.cli",
        "--state",
        state_path,
        *extra_args,
    ]
    proc = subprocess.run(
        cmd,
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    out_text = proc.stdout.decode("utf-8", errors="replace")
    err_text = proc.stderr.decode("utf-8", errors="replace")
    try:
        out_json = json.loads(out_text) if out_text.strip() else None
    except json.JSONDecodeError:
        out_json = {"_raw": out_text}
    return proc.returncode, out_json, err_text


class TestCliPersistenceRealCadence(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.mkdtemp(prefix="pdg_cli_state_")
        self.state = os.path.join(self._tmpdir, "state.json")
        self.assertFalse(os.path.exists(self.state))

    def tearDown(self):
        if os.path.exists(self.state):
            try:
                os.remove(self.state)
            except OSError:
                pass
        try:
            os.rmdir(self._tmpdir)
        except OSError:
            pass

    def test_step1_import_old_materials(self):
        code, out, err = _run_cli(
            self.state,
            "import",
            "-i", TESTDATA_PHASE1,
            "-l", "P1-OLD",
            "--today", "2026-06-10T08:00:00",
        )
        self.assertEqual(code, 5, "phase1 有照片时间错位，应返回5；stderr=%s" % err)
        self.assertIn("import_report", out)
        r = out["import_report"]
        self.assertEqual(r["records_read"], 7)
        self.assertEqual(r["records_new"], 5)
        self.assertEqual(r["records_duplicate_skipped"], 1)
        self.assertEqual(r["records_bad_data"], 1)
        self.assertIsNotNone(r["photo_mismatch_impact"])
        self.assertIn("收尾步骤", r["photo_mismatch_impact"]["wrap_up_action"])

    def test_step2_import_boundary(self):
        # 先跑 step1
        c1, _, e1 = _run_cli(self.state, "import", "-i", TESTDATA_PHASE1,
                             "-l", "P1-OLD", "--today", "2026-06-10T08:00:00")
        self.assertEqual(c1, 5, "step1失败: %s" % e1)

        # 同一个 state，但新进程跑 phase2
        c2, out2, e2 = _run_cli(self.state, "import", "-i", TESTDATA_PHASE2,
                                "-l", "P2-BDY", "--today", "2026-06-10T08:00:00")
        self.assertIn(c2, (4, 5))
        r = out2["import_report"]
        self.assertEqual(r["records_read"], 3)
        self.assertEqual(r["records_new"], 1,
                         "phase2 只有边界样本是新的，断路器后补说明与phase1同日期去重，"
                         "重复旧记录再次去重 → new=1 dup=2")
        self.assertEqual(r["records_duplicate_skipped"], 2)
        self.assertIsNotNone(
            r["photo_mismatch_impact"],
            "照片时间错位提示在最近一次导入报告里必须存在",
        )
        self.assertIn(
            "现场照片拍摄时间与上传时间差超过",
            r["photo_mismatch_impact"]["impact_scope"],
        )

    def test_step3_summary_after_process_restart(self):
        # step 1
        c1, _, e1 = _run_cli(self.state, "import", "-i", TESTDATA_PHASE1,
                             "-l", "P1-OLD", "--today", "2026-06-10T08:00:00")
        self.assertEqual(c1, 5, "step1失败: %s" % e1)
        # step 2
        c2, _, e2 = _run_cli(self.state, "import", "-i", TESTDATA_PHASE2,
                             "-l", "P2-BDY", "--today", "2026-06-10T08:00:00")
        self.assertIn(c2, (4, 5), "step2失败: %s" % e2)

        # step 3：全新进程起 summary
        c3, out3, e3 = _run_cli(
            self.state, "summary", "--tonight", "2026-06-10T23:59:59"
        )

        self.assertEqual(
            c3, 5,
            "summary 应从 state 中恢复 last_import_report，发现有照片错位→返回码5；"
            "实际=%s stderr=%s" % (c3, e3),
        )

        self.assertIn("page_summary", out3, "stdout 必须包含 page_summary")
        self.assertIn("import_diagnostic", out3,
                      "stdout 必须包含 import_diagnostic 供值班脚本直接读")

        ps = out3["page_summary"]
        diag = out3["import_diagnostic"]

        # ---- 验收：实际新增 1、去重 2（不能把 phase1 的 5 条当新增） ----
        self.assertEqual(diag["records_new"], 1)
        self.assertEqual(diag["records_duplicate_skipped"], 2)
        self.assertEqual(diag["records_read"], 3)
        self.assertEqual(diag["records_bad_data"], 0)

        # ---- 验收：照片时间错位字段全保留 ----
        self.assertIsNotNone(
            diag["photo_mismatch"],
            "import_diagnostic.photo_mismatch 必须存在",
        )
        self.assertIn(
            "收尾步骤",
            diag["photo_mismatch"]["wrap_up_action"],
        )
        self.assertGreater(
            len(diag["photo_mismatch"]["affected_device_ids"]),
            0,
        )
        self.assertIn(
            "现场照片拍摄时间与上传时间差超过",
            diag["photo_mismatch"]["impact_scope"],
        )
        self.assertEqual(
            diag["failure_code"], "OK",
            "import 本身没有失败，照片错位只是告警，failure_code 仍是 OK",
        )

        # ---- 验收：page_summary.last_import_report 也带同样信息 ----
        last = ps["last_import_report"]
        self.assertIsNotNone(last)
        self.assertEqual(last["records_new"], 1)
        self.assertEqual(last["records_duplicate_skipped"], 2)
        self.assertIsNotNone(last["photo_mismatch_impact"])

        # ---- 验收：变更基线是 phase2 开始前的 6 条结果，所以 changed 只有 1 条 ----
        changed = ps["changed_since_last_run"]
        self.assertEqual(
            len(changed), 1,
            "变更基线未持久化会导致所有6条都被当新增。"
            "实际 changed=%s  内容=%s" % (len(changed), changed),
        )

        # ---- 验收：变化描述文本不能说全量6条，只讲 phase2 实际变更 ----
        self.assertNotIn(
            "6 条", ps["change_description"],
            "不能把历史 6 条都当本次新增",
        )
        self.assertIn(
            "本次新增/变更排程 1 条",
            ps["change_description"],
            "应该明确说 phase2 实际新增 1 条边界样本",
        )
        self.assertIn(
            "照片时间错位",
            ps["change_description"],
            "变化描述应提照片错位提示",
        )

        # ---- 验收：边界样本列表包含 1 条（phase2 那条高温+大量的）----
        self.assertGreaterEqual(
            len(ps["boundary_samples_added"]),
            1,
            "边界样本没被摘要识别到",
        )

        # ---- 验收：坏数据仍能指回原始记录 ----
        self.assertEqual(ps["active_bad_data_count"], 1)
        cb, bad_out, _ = _run_cli(self.state, "baddata")
        self.assertEqual(cb, 4)
        self.assertEqual(bad_out["count"], 1)
        self.assertIn(
            "record_id=HO-20260609-BAD-01",
            bad_out["traces"][0]["navigate_hint"],
        )

    def test_step4_repeat_summary_stable(self):
        """连续跑两次 summary（新进程），输出变化部分应该稳定一致，不会抖动。"""
        _run_cli(self.state, "import", "-i", TESTDATA_PHASE1,
                 "-l", "P1", "--today", "2026-06-10T08:00:00")
        _run_cli(self.state, "import", "-i", TESTDATA_PHASE2,
                 "-l", "P2", "--today", "2026-06-10T08:00:00")

        c3a, out3a, _ = _run_cli(
            self.state, "summary", "--tonight", "2026-06-10T23:59:59"
        )
        c3b, out3b, _ = _run_cli(
            self.state, "summary", "--tonight", "2026-06-10T23:59:59"
        )

        self.assertEqual(c3a, c3b)
        self.assertEqual(
            out3a["import_diagnostic"]["records_new"],
            out3b["import_diagnostic"]["records_new"],
        )
        self.assertEqual(
            out3a["page_summary"]["changed_since_last_run"],
            out3b["page_summary"]["changed_since_last_run"],
            "多次 summary 应返回同一套变更列表",
        )
        self.assertEqual(
            out3a["import_diagnostic"]["photo_mismatch"]["wrap_up_action"],
            out3b["import_diagnostic"]["photo_mismatch"]["wrap_up_action"],
        )

    def test_step5_manual_remark_preserved_after_process_restart(self):
        """写一条人工备注 → 杀进程 → 再次 summary 里看备注是否仍被保护。"""
        # 导入一次取一个 dedup_key
        _run_cli(self.state, "import", "-i", TESTDATA_PHASE1,
                 "-l", "P1", "--today", "2026-06-10T08:00:00")
        # 在 state.json 里找到第一个 result 的 dedup_key
        with open(self.state, "r", encoding="utf-8") as f:
            snap1 = json.load(f)
        first_dk = next(iter(snap1["results"].keys()))
        first_result_id_before = snap1["results"][first_dk]["result_id"]

        # remark 命令（新进程）
        rc, ro, _ = _run_cli(
            self.state, "remark",
            "--dedup-key", first_dk,
            "--remark", "小林灰度备注-跨进程保护测试",
            "--operator", "项目助理-小林",
        )
        self.assertEqual(rc, 0)
        self.assertTrue(ro["success"])

        # 再导入 phase2（新进程），触发 remark 保护被尝试覆盖
        _run_cli(self.state, "import", "-i", TESTDATA_PHASE2,
                 "-l", "P2", "--today", "2026-06-10T08:00:00")

        # 最终 summary（新进程） 里去核实
        with open(self.state, "r", encoding="utf-8") as f:
            snap2 = json.load(f)
        r = snap2["results"][first_dk]
        self.assertEqual(r["result_id"], first_result_id_before)
        self.assertTrue(r["is_manual_remark_protected"])
        self.assertIn("小林灰度备注-跨进程保护测试", r["manual_remark"])
        self.assertIn("项目助理-小林", r["manual_remark"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
