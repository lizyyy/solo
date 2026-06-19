#!/usr/bin/env python3
"""
端到端验证脚本：用同一批真实样例数据，串起
  1. 传感器首次导入
  2. 普通照片清单复核
  3. 重复导入(同批重传)
  4. 教练复核温度
  5. 交接报告更新
  6. 晚到照片补录
  7. 导出报告+历史+可重跑命令

验证项：
  - import_batch_id 重复导入后保持首次批次号
  - duplicate_import_batches 记录了重复批次来源
  - 照片复核状态、处理历史、报告结论都指向同一批真实数据
  - 导出的可重跑指令全部可被 main.py 入口消费
  - 照片复核指令指向实际照片清单 JSON 文件
"""
import os
import sys
import shutil
import json
import subprocess

DATA_DIR = "data"
REPORT_DIR = "reports"
SENSOR_FILE = "test_data/sensors.json"
PHOTO_FILE = "test_data/photos.json"
LATE_PHOTO_FILE = "test_data/late_photos.json"

passed = 0
failed = 0


def run_cli(*args):
    cmd = ["python3", "main.py"] + list(args)
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"  CMD FAILED: {' '.join(cmd)}")
        print(f"  stderr: {r.stderr[:500]}")
    return r


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        print(f"  FAIL  {name}")
        if detail:
            print(f"        {detail}")


def main():
    global passed, failed

    if os.path.exists(DATA_DIR):
        shutil.rmtree(DATA_DIR)
    if os.path.exists(REPORT_DIR):
        shutil.rmtree(REPORT_DIR)
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(REPORT_DIR, exist_ok=True)

    print("=" * 70)
    print("  Step 1: 传感器首次导入")
    print("=" * 70)
    r = run_cli("import-sensors", "--input-file", SENSOR_FILE, "--operator", "数据员")
    step1 = json.loads(r.stdout)
    first_batch = step1["batch_id"]
    check("首次导入新增5条", step1["imported"] == 5)
    check("首次导入重复0条", step1["duplicates"] == 0)
    check("首次导入返回batch_id非空", bool(first_batch))

    with open(os.path.join(DATA_DIR, "uniform_zones.json")) as f:
        uz_data = json.load(f)
    first_uz_ids = {uz["sensor_id"]: uz["uniform_zone_id"] for uz in uz_data}
    check("生成5条均匀区记录", len(first_uz_ids) == 5)

    print()
    print("=" * 70)
    print("  Step 2: 普通照片清单复核")
    print("=" * 70)
    r = run_cli("review-photos", "--input-file", PHOTO_FILE, "--operator", "何工")
    step2 = json.loads(r.stdout)
    check("普通照片复核处理4条关联", step2["processed"] == 4)
    check("普通照片无晚到材料", step2["late_arrivals"] == 0)

    with open(os.path.join(DATA_DIR, "uniform_zones.json")) as f:
        uz_data = json.load(f)
    uz_map = {uz["sensor_id"]: uz for uz in uz_data}

    photo_covered = ["MAG-COIL-001", "MAG-COIL-002", "MAG-COIL-003", "MAG-COIL-005"]
    for sid in photo_covered:
        has_photo = len(uz_map[sid].get("related_photo_ids", [])) > 0
        check(f"{sid} 有照片证据", has_photo)

    check("MAG-COIL-004 暂无照片", len(uz_map.get("MAG-COIL-004", {}).get("related_photo_ids", [])) == 0)

    print()
    print("=" * 70)
    print("  Step 3: 重复导入(同批重传)")
    print("=" * 70)
    r = run_cli("import-sensors", "--input-file", SENSOR_FILE, "--operator", "数据员")
    step3 = json.loads(r.stdout)
    dup_batch = step3["batch_id"]
    check("重复导入新增0条", step3["imported"] == 0)
    check("重复导入检测5条重复", step3["duplicates"] == 5)
    check("重复导入batch_id不同于首次", dup_batch != first_batch)

    with open(os.path.join(DATA_DIR, "uniform_zones.json")) as f:
        uz_data = json.load(f)
    uz_map = {uz["sensor_id"]: uz for uz in uz_data}

    for sid, uz in uz_map.items():
        check(
            f"{sid} import_batch_id 保持首次批次",
            uz["import_batch_id"] == first_batch,
            f"期望={first_batch} 实际={uz['import_batch_id']}"
        )
        check(
            f"{sid} duplicate_import_batches 包含重复批次",
            dup_batch in uz.get("duplicate_import_batches", []),
            f"duplicate_import_batches={uz.get('duplicate_import_batches', [])}"
        )

    r = run_cli("stats")
    stats = json.loads(r.stdout)
    check("总数仍为5，未翻倍", stats["total_uniform_zones"] == 5)
    check("重复导入触及5条", stats["duplicate_touched_count"] == 5)

    print()
    print("=" * 70)
    print("  Step 4: 教练复核温度(003: fix_unit, 002: convert)")
    print("=" * 70)
    uz_003_id = first_uz_ids["MAG-COIL-003"]
    r = run_cli("coach-review", "--uz-id", uz_003_id, "--target-unit", "°C",
                "--correction-mode", "fix_unit",
                "--remark", "现场照片确认25K实为25°C",
                "--operator", "训练教练")
    coach_003 = json.loads(r.stdout)
    check("003教练复核成功", "error" not in coach_003)
    check("003温度值不变(25.0)", coach_003.get("correction", {}).get("temperature_value", {}).get("after") == 25.0)
    check("003单位改为°C", coach_003.get("correction", {}).get("temperature_unit", {}).get("after") == "°C")

    uz_002_id = first_uz_ids["MAG-COIL-002"]
    r = run_cli("coach-review", "--uz-id", uz_002_id, "--target-unit", "°C",
                "--correction-mode", "convert",
                "--remark", "298.15K按公式转25°C",
                "--operator", "训练教练")
    coach_002 = json.loads(r.stdout)
    check("002教练复核成功", "error" not in coach_002)
    check("002温度值转为25.0°C", coach_002.get("correction", {}).get("temperature_value", {}).get("after") == 25.0)

    print()
    print("=" * 70)
    print("  Step 5: 交接报告更新")
    print("=" * 70)
    r = run_cli("update-report",
                "--uz-ids", f"{uz_002_id},{uz_003_id}",
                "--notes", "现场核验完成",
                "--operator", "何工")
    step5 = json.loads(r.stdout)
    check("交接报告更新成功2条", step5["updated"] == 2)
    check("交接报告失败0条", step5["failed"] == 0)

    print()
    print("=" * 70)
    print("  Step 6: 晚到照片补录")
    print("=" * 70)
    r = run_cli("review-photos", "--input-file", LATE_PHOTO_FILE, "--operator", "何工")
    step6 = json.loads(r.stdout)
    check("晚到照片处理1条", step6["processed"] == 1)
    check("晚到材料1条", step6["late_arrivals"] == 1)

    with open(os.path.join(DATA_DIR, "uniform_zones.json")) as f:
        uz_data = json.load(f)
    uz_004 = [uz for uz in uz_data if uz["sensor_id"] == "MAG-COIL-004"][0]
    check("004晚到照片已关联", len(uz_004.get("related_photo_ids", [])) > 0)
    check("004温度值未被洗掉", uz_004["temperature_value"] == 24.5)

    print()
    print("=" * 70)
    print("  Step 7: 导出报告、历史、可重跑命令")
    print("=" * 70)
    r = run_cli("export", "--output", f"{REPORT_DIR}/e2e_report.json")
    check("导出报告成功", r.returncode == 0)

    r = run_cli("history", "--uz-id", first_uz_ids["MAG-COIL-001"], "--replay")
    replay_lines = r.stdout.strip().split("\n") if r.stdout.strip() else []
    check("可重跑命令非空", len(replay_lines) > 0)

    with open(f"{REPORT_DIR}/e2e_report.json") as f:
        report = json.load(f)

    rec_001 = [r for r in report["records"] if r["uniform_zone"]["sensor_id"] == "MAG-COIL-001"][0]

    dup_info = rec_001.get("duplicate_import_info")
    check("导出报告包含 duplicate_import_info", dup_info is not None)
    if dup_info:
        check("first_import_batch 等于首次批次号", dup_info["first_import_batch"] == first_batch)
        check("duplicate_batches 包含重复批次号", dup_batch in dup_info["duplicate_batches"])
        check("dedup_conclusion 非空", bool(dup_info.get("dedup_conclusion")))

    photos_001 = rec_001.get("photo_evidences", [])
    check("导出报告 photo_evidences 非空(有普通照片)", len(photos_001) > 0)

    history_001 = rec_001.get("history", [])
    photo_history = [h for h in history_001 if h["change_type"] == "工况照片关联"]
    check("历史中有照片复核条目", len(photo_history) > 0)
    if photo_history:
        ph = photo_history[0]
        check("照片复核历史 command_used 指向照片清单JSON",
              "test_data/photos.json" in (ph.get("command_used") or ""),
              f"实际command_used: {ph.get('command_used')}")

    dup_history = [h for h in history_001 if "重复导入" in (h.get("reason") or "")]
    check("历史中有重复导入条目", len(dup_history) > 0)
    if dup_history:
        dh = dup_history[0]
        check("重复导入历史 reason 包含首次批次号",
              first_batch in (dh.get("reason") or ""),
              f"实际reason: {dh.get('reason')[:200]}")
        check("重复导入历史 reason 包含重复批次号",
              dup_batch in (dh.get("reason") or ""),
              f"实际reason: {dh.get('reason')[:200]}")
        check("重复导入历史 command_used 指向传感器清单JSON",
              SENSOR_FILE in (dh.get("command_used") or ""),
              f"实际command_used: {dh.get('command_used')}")

    all_replay_commands = rec_001.get("replay_commands", [])
    for i, line in enumerate(all_replay_commands):
        if line.startswith("python3 main.py"):
            parts = line.split()
            subcmd = parts[2] if len(parts) > 2 else ""
            valid_subcmds = {
                "import-sensors", "review-photos", "update-report",
                "coach-review", "manual-edit", "confirm", "show",
                "export", "stats", "history", "rules",
            }
            check(f"可重跑命令第{i+1}行子命令'{subcmd}'有效", subcmd in valid_subcmds,
                  f"实际命令: {line[:100]}")

    print()
    print("=" * 70)
    print("  最终一致性核对")
    print("=" * 70)
    for rec in report["records"]:
        uz = rec["uniform_zone"]
        sid = uz["sensor_id"]
        dup_i = rec.get("duplicate_import_info")
        h = rec.get("history", [])

        check(f"{sid} import_batch_id={uz['import_batch_id']}",
              uz["import_batch_id"] == first_batch,
              f"期望{first_batch}")

        if dup_i:
            check(f"{sid} 报告first_import_batch与记录一致",
                  dup_i["first_import_batch"] == uz["import_batch_id"])

        photo_h = [x for x in h if x["change_type"] == "工况照片关联"]
        if photo_h:
            for ph in photo_h:
                cmd = ph.get("command_used") or ""
                check(f"{sid} 照片复核指令可被入口消费(含--input-file)",
                      "--input-file" in cmd,
                      f"实际: {cmd[:120]}")

    print()
    print("=" * 70)
    print(f"  验证完成: {passed} PASS, {failed} FAIL")
    print("=" * 70)
    return 1 if failed > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
