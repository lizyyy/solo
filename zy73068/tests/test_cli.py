import csv
import json
from pathlib import Path

import pytest

from blade_review.cli import main
from blade_review.models import MaterialType
from blade_review.service import ReviewService


def _write_csv(path: Path) -> None:
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["blade_id", "timestamp", "metric", "value", "manual_note"])
        w.writerow(["B001", "2026-06-10 08:00:00", "vibration", 1.0, "正常"])
        w.writerow(["B001", "2026-06-10 16:00:00", "vibration", 1.05, ""])
        w.writerow(["B001", "2026-06-11 00:00:00", "vibration", 5.5, "突变点"])
        w.writerow(["B001", "2026-06-13 08:00:00", "vibration", 1.1, "断档两天"])


class TestCliIntegration:
    def test_cli_full_flow(self, tmp_path):
        db = tmp_path / "t.db"
        csv_path = tmp_path / "inspection.csv"
        _write_csv(csv_path)

        mat_v1 = tmp_path / "mat_v1.txt"
        mat_v1.write_text("超声检测报告 v1：B001 正常\n结论：稳定", encoding="utf-8")
        mat_v2 = tmp_path / "mat_v2.txt"
        mat_v2.write_text("超声检测报告 v2：B001 有微裂纹\n结论：待复核", encoding="utf-8")

        # 首次导入
        ret = main([
            "--db", str(db), "import",
            "--title", "演示",
            "--csv", str(csv_path),
            "--material", "supplementary", "超声检测报告", str(mat_v1),
            "--verbal", "口头说明", "B001 有异响",
            "--operator", "小宋",
        ])
        assert ret == 0

        # list 能看到
        list_path = tmp_path / "list.txt"
        ret = main(["--db", str(db), "list"])
        assert ret == 0

        # 找报告ID
        from blade_review.storage import ReportStore
        with ReportStore(str(db)) as store:
            rows = store.list_reports()
            assert len(rows) == 1
            report_id = rows[0]["report_id"]
            report = store.load_report(report_id)
            assert report.status.value == "suspended"
            assert len(report.records) == 4
            assert len(report.materials) == 2

        # 重复导入，不翻倍，备注保留
        ret = main([
            "--db", str(db), "import",
            "--report-id", report_id,
            "--csv", str(csv_path),
            "--operator", "小宋",
        ])
        assert ret == 0
        with ReportStore(str(db)) as store:
            report = store.load_report(report_id)
            assert len(report.records) == 4

        # 同名材料改口径 v1 -> v2
        ret = main([
            "--db", str(db), "import",
            "--report-id", report_id,
            "--material", "supplementary", "超声检测报告", str(mat_v2),
            "--operator", "小宋",
        ])
        assert ret == 0
        with ReportStore(str(db)) as store:
            report = store.load_report(report_id)
            assert len(report.materials) == 2
            mat = next(m for m in report.materials if m.material_type == MaterialType.SUPPLEMENTARY)
            assert mat.stance_changed is True
            assert mat.previous_stance.startswith("超声检测报告 v1")
            assert mat.content.startswith("超声检测报告 v2")
            assert mat.version == 2

        # 交接班摘要
        handover_txt = tmp_path / "handover.txt"
        ret = main(["--db", str(db), "handover", "--report", report_id])
        assert ret == 0

        # 导出 JSON
        out_json = tmp_path / "out.json"
        ret = main([
            "--db", str(db), "export",
            "--report", report_id, "--out", str(out_json), "--format", "json",
        ])
        assert ret == 0
        data = json.loads(out_json.read_text(encoding="utf-8"))
        assert data["is_stable"] is False
        assert len(data["suspensions"]) >= 1
        assert len(data["manual_notes"]) >= 2
        assert len(data["judgment_changes"]) >= 1
        assert "sample_location" in data
        assert any(a["kind"] in {"single_point_spike", "sampling_gap", "mean_masked_anomaly"}
                   for a in data["anomalies"])

        # 解决挂起
        with ReportStore(str(db)) as store:
            report = store.load_report(report_id)
            susp = next(s for s in report.suspensions if not s.resolved)
            susp_id = susp.suspension_id
        ret = main([
            "--db", str(db), "resolve",
            "--report", report_id,
            "--suspension", susp_id,
            "--by", "现场老师",
            "--note", "数据有效",
        ])
        assert ret == 0
        with ReportStore(str(db)) as store:
            report = store.load_report(report_id)
            assert report.status.value == "in_review"


def test_cli_init_and_module_main(tmp_path):
    db = tmp_path / "t.db"
    assert main(["--db", str(db), "init"]) == 0
    assert db.exists()
