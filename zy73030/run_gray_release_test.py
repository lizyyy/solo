import json
import sys
import subprocess
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CMD_BASE = [sys.executable, "-m", "pet_training_audit"]
LOG_FILE = ROOT / "output" / "gray_release_run.log"
LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

def run(cmd, description, expect_exit_codes=None):
    expect_exit_codes = expect_exit_codes or [0]
    full = CMD_BASE + cmd
    print(f"\n{'='*80}")
    print(f"▶ {description}")
    print(f"  命令: {' '.join(full)}")
    print(f"{'='*80}")
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    p = subprocess.run(
        full, cwd=ROOT, capture_output=True, text=True, env=env
    )
    print(f"  退出码: {p.returncode}  (期望: {expect_exit_codes})")
    if p.stdout:
        print("  ── STDOUT ──")
        print(p.stdout.rstrip())
    if p.stderr:
        print("  ── STDERR ──")
        print(p.stderr.rstrip(), file=sys.stderr)
    ok = p.returncode in expect_exit_codes
    print(f"  结果: {'✅ 通过' if ok else '❌ 异常'}")
    return p

all_steps_ok = True

with open(LOG_FILE, "w", encoding="utf-8") as logf:
    def tee(msg):
        print(msg)
        logf.write(msg + "\n")
        logf.flush()

    tee(f"灰度发布前完整验证流程 — 开始于 {__import__('datetime').datetime.now()}")
    tee(f"数据库位置: output/pet_training.db (每轮测试自动重建)")

    db_file = ROOT / "output" / "pet_training.db"
    if db_file.exists():
        db_file.unlink()
        tee("\nℹ️  已清理旧数据库，确保本次验证从零开始")

    # 步骤1: init
    p = run(["init"], "步骤0: 初始化数据库", [0])
    all_steps_ok &= (p.returncode == 0)

    # 步骤2: 导入旧材料 (6条)
    p = run(
        ["import", "--file", "tests/data/batch_01_old_materials.json"],
        "步骤1: 导入旧材料 batch_01 (6条历史记录)",
        [0],
    )
    all_steps_ok &= (p.returncode == 0)
    baseline_import = json.loads(p.stdout) if p.stdout.strip() else {}
    tee(f"  → 导入统计: inserted={baseline_import.get('inserted')}, "
        f"versioned={baseline_import.get('versioned')}, "
        f"failed={baseline_import.get('failed')}")

    # 步骤3: 跑第一次复核 (基线)
    p = run(
        ["audit", "--run-tag", "gray_baseline_v1",
         "--triggered-by", "gray-release-step1-old-materials"],
        "步骤2: 基线复核 (仅旧材料) → run_tag=gray_baseline_v1",
        [0, 2],  # 0=无异常，2=有业务异常（我们预期有异常）
    )
    all_steps_ok &= (p.returncode in [0, 2])
    baseline_audit = json.loads(p.stdout) if p.stdout.strip() else {}
    baseline_tag = baseline_audit.get("run_tag")
    tee(f"  → 复核结果: total={baseline_audit.get('total_records')}, "
        f"异常记录={baseline_audit.get('anomaly_records')}, "
        f"总异常数={baseline_audit.get('total_anomalies')}, "
        f"按严重级={baseline_audit.get('per_severity')}")

    # 步骤4: 导入边界样本 (2条升级+1条新增)
    p = run(
        ["import", "--file", "tests/data/batch_02_boundary_samples.json"],
        "步骤3: 补边界样本 batch_02 (2条升级v2 + 1条新增边界样本)",
        [0],
    )
    all_steps_ok &= (p.returncode == 0)
    v2_import = json.loads(p.stdout) if p.stdout.strip() else {}
    tee(f"  → 导入统计: inserted={v2_import.get('inserted')}, "
        f"versioned={v2_import.get('versioned')}, "
        f"failed={v2_import.get('failed')}")

    # 步骤5: 跑第二次复核 (带baseline对比)
    p = run(
        ["audit", "--run-tag", "gray_current_v2",
         "--triggered-by", "gray-release-step2-boundary",
         "--baseline", "gray_baseline_v1"],
        f"步骤4: 当前复核 (基线对比 baseline={baseline_tag}) → run_tag=gray_current_v2",
        [0, 2],
    )
    all_steps_ok &= (p.returncode in [0, 2])
    current_audit = json.loads(p.stdout) if p.stdout.strip() else {}
    current_tag = current_audit.get("run_tag")
    tee(f"  → 复核结果: total={current_audit.get('total_records')}, "
        f"异常记录={current_audit.get('anomaly_records')}, "
        f"总异常数={current_audit.get('total_anomalies')}, "
        f"按规则={current_audit.get('per_rule')}")

    # 步骤6: 生成Markdown报告
    p = run(
        ["report", "--run-tag", "gray_current_v2", "--stdout"],
        f"步骤5: 生成Markdown报告 (run_tag={current_tag}, 同时打印到stdout便于检查)",
        [0],
    )
    all_steps_ok &= (p.returncode == 0)

    # 总结
    tee("\n" + "=" * 80)
    tee("✅ 灰度流程全部执行完毕" if all_steps_ok else "⚠️ 灰度流程存在异常，请根据上方日志排查")
    tee(f"   - 基线 run_tag: gray_baseline_v1")
    tee(f"   - 当前 run_tag: gray_current_v2")
    report_path = ROOT / "output" / "audit_report_gray_current_v2.md"
    tee(f"   - 报告文件: {report_path}")
    tee(f"   - 完整日志: {LOG_FILE}")
    if report_path.exists():
        size = report_path.stat().st_size
        tee(f"   - 报告大小: {size} 字节")
        lines = report_path.read_text(encoding="utf-8").splitlines()
        tee(f"   - 报告行数: {len(lines)} 行")

    # 额外检查：数据库里记录的版本历史
    print("\n" + "=" * 80)
    print("🔍 数据一致性检查：版本历史与附件数量")
    print("=" * 80)
    import sqlite3
    conn = sqlite3.connect(str(db_file))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """SELECT r.record_id, r.pet_name, r.latest_version,
                  COUNT(v.id) AS version_count,
                  (SELECT COUNT(*) FROM record_attachments a WHERE a.record_id=r.record_id) AS att_count
           FROM training_records r
           JOIN training_record_versions v ON v.record_id=r.record_id
           GROUP BY r.record_id
           ORDER BY r.record_id"""
    ).fetchall()
    for row in rows:
        match = "✅" if row["latest_version"] == row["version_count"] else "❌"
        print(f"  {match} {row['record_id']} {row['pet_name']:<6}  "
              f"声明v={row['latest_version']}, 实际版本数={row['version_count']},  "
              f"附件总数={row['att_count']}")
    conn.close()
