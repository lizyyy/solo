"""专门验证淤积分级规则（critical 阈值真正参与判断）。

直接证明用户要求的两点：
  1. --sediment-critical-cm 60 时，70cm 淤积被判成 critical
  2. --sediment-critical-cm 80 时，同一条 70cm 记录不再是 critical（降为 warning）

三层证据：
  L1  classify_sediment 单元规则（最直接）
  L2  engine.run_pipeline 端到端（同一条记录，仅改 critical 阈值）
  L3  实际 CLI 子进程调用（--sediment-critical-cm 真实生效）
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys

from harbor_warning.engine import HarborWarningEngine, classify_sediment
from harbor_warning.models import WarningLevel
from harbor_warning.storage import HarborStorage


ROOT = os.path.dirname(os.path.abspath(__file__))
TMP_BASE = os.path.join(ROOT, "verify_data")
SAMPLE_70CM = [{"log_id": "V1", "ts": "2026-06-22 09:00:00", "来源": "传感器",
                "浮标编号": "B-VER", "水深": 12.0, "淤积厚度": 70.0,
                "流速": 0.4, "水温": 22.0}]


def banner(t: str) -> None:
    print("\n" + "=" * 70 + f"\n  {t}\n" + "=" * 70)


def check(cond: bool, label: str) -> None:
    print(f"  [{'PASS' if cond else 'FAIL'}] {label}")
    if not cond:
        raise AssertionError(label)


def fresh_dir(name: str) -> str:
    d = os.path.join(TMP_BASE, name)
    if os.path.isdir(d):
        shutil.rmtree(d)
    return d


def run_engine(critical_cm: float, name: str) -> list[dict]:
    d = fresh_dir(name)
    storage = HarborStorage(d)
    engine = HarborWarningEngine(storage)
    engine.import_raw_records(SAMPLE_70CM)
    engine.run_pipeline(
        sediment_warning_cm=30.0,
        sediment_critical_cm=critical_cm,
        drift_threshold=100.0,  # 关闭漂移隔离，聚焦分级
    )
    return [w.to_dict() for w in storage.list_warnings()]


def main() -> int:
    if os.path.isdir(TMP_BASE):
        shutil.rmtree(TMP_BASE)

    # ---------- L1 单元规则 ----------
    banner("L1 classify_sediment 单元规则")
    lvl, hit = classify_sediment(70.0, 30.0, 60.0)
    print(f"  sediment=70, warning=30, critical=60 -> level={lvl.value}, hit_threshold={hit}")
    check(lvl is WarningLevel.CRITICAL, "70cm@critical=60 应为 CRITICAL")
    check(hit == 60.0, "命中阈值应为 critical=60")

    lvl, hit = classify_sediment(70.0, 30.0, 80.0)
    print(f"  sediment=70, warning=30, critical=80 -> level={lvl.value}, hit_threshold={hit}")
    check(lvl is WarningLevel.WARNING, "70cm@critical=80 应为 WARNING（未到 critical）")
    check(hit == 30.0, "命中阈值应为 warning=30")

    # 边界：恰好等于 critical
    lvl, _ = classify_sediment(60.0, 30.0, 60.0)
    check(lvl is WarningLevel.CRITICAL, "60cm@critical=60（含等号）应为 CRITICAL")
    # 边界：恰好低于 critical、达到 warning
    lvl, hit = classify_sediment(59.0, 30.0, 60.0)
    check(lvl is WarningLevel.WARNING and hit == 30.0, "59cm 应为 WARNING，命中 warning=30")

    # ---------- L2 engine 端到端 ----------
    banner("L2 engine.run_pipeline：同一 70cm 记录，仅改 critical 阈值")

    ws60 = run_engine(60.0, "crit60")
    print(f"  critical=60 -> 生成预警 {len(ws60)} 条")
    crit_recs = [w for w in ws60 if w["warning_level"] == "critical"]
    check(len(crit_recs) == 1, "critical=60 时 70cm 应产生 1 条 critical 预警")
    w60 = crit_recs[0]
    print(f"    level={w60['warning_level']} actual={w60['actual_value']} "
          f"hit_threshold_value={w60['threshold_value']} "
          f"warning_threshold={w60['warning_threshold']} "
          f"critical_threshold={w60['critical_threshold']}")
    check(w60["threshold_value"] == 60.0, "命中阈值 threshold_value=60")
    check(w60["warning_threshold"] == 30.0, "结果含 warning_threshold=30")
    check(w60["critical_threshold"] == 60.0, "结果含 critical_threshold=60")
    check(w60["actual_value"] == 70.0, "actual_value=70")

    ws80 = run_engine(80.0, "crit80")
    print(f"  critical=80 -> 生成预警 {len(ws80)} 条")
    crit_recs80 = [w for w in ws80 if w["warning_level"] == "critical"]
    warn_recs80 = [w for w in ws80 if w["warning_level"] == "warning"]
    check(len(crit_recs80) == 0, "critical=80 时同条 70cm 不再是 CRITICAL")
    check(len(warn_recs80) == 1, "critical=80 时 70cm 降为 WARNING（达到 warning 未到 critical）")
    w80 = warn_recs80[0]
    print(f"    level={w80['warning_level']} actual={w80['actual_value']} "
          f"hit_threshold_value={w80['threshold_value']} "
          f"warning_threshold={w80['warning_threshold']} "
          f"critical_threshold={w80['critical_threshold']}")
    check(w80["threshold_value"] == 30.0, "命中阈值降为 warning=30")
    check(w80["critical_threshold"] == 80.0, "结果含 critical_threshold=80")

    # ---------- L3 真实 CLI 子进程 ----------
    banner("L3 真实 CLI：python -m harbor_warning pipeline --sediment-critical-cm ...")
    d = fresh_dir("cli_crit60")
    sample_path = os.path.join(TMP_BASE, "sample_70cm.json")
    with open(sample_path, "w", encoding="utf-8") as f:
        json.dump(SAMPLE_70CM, f, ensure_ascii=False)
    env = dict(os.environ)
    r = subprocess.run(
        [sys.executable, "-m", "harbor_warning", "--data-dir", d, "import",
         "--input", sample_path],
        capture_output=True, text=True, env=env,
    )
    print(f"  import exit={r.returncode}")
    check(r.returncode == 0, "CLI import 退出码 0")
    r = subprocess.run(
        [sys.executable, "-m", "harbor_warning", "--data-dir", d, "pipeline",
         "--sediment-warning-cm", "30", "--sediment-critical-cm", "60",
         "--drift-threshold", "100"],
        capture_output=True, text=True, env=env,
    )
    print(f"  pipeline(critical=60) exit={r.returncode}")
    check(r.returncode == 0, "CLI pipeline 退出码 0")
    r = subprocess.run(
        [sys.executable, "-m", "harbor_warning", "--data-dir", d, "list",
         "--kind", "warnings"],
        capture_output=True, text=True, env=env,
    )
    out = json.loads(r.stdout)
    cli_warnings = out.get("warnings", [])
    cli_crit = [w for w in cli_warnings if w["warning_level"] == "critical"]
    check(len(cli_crit) == 1, "CLI: --sediment-critical-cm 60 把 70cm 判成 critical")
    print(f"    CLI critical 记录: level={cli_crit[0]['warning_level']} "
          f"threshold_value={cli_crit[0]['threshold_value']} "
          f"critical_threshold={cli_crit[0]['critical_threshold']}")

    print("\n分级规则验证全部通过。")
    print("等价 CLI 命令（复核人可照抄）：")
    print("  python -m harbor_warning import --input sample_70cm.json")
    print("  python -m harbor_warning pipeline --sediment-warning-cm 30 --sediment-critical-cm 60")
    print("  python -m harbor_warning list --kind warnings")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"\n验证失败: {exc}", file=sys.stderr)
        raise SystemExit(1)
