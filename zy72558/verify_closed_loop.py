#!/usr/bin/env python3
"""
语义向量聚类命名 - 数据闭环验证脚本
验证：
  1. 特征快照第一次导入
  2. 同一批数据重复训练两次（触发待复核）
  3. 数据科学家林姐看训练日志
  4. API / 页面 / 导出 三端读取同一份结果
  5. 尤其是「同一批数据重复训练两次」的状态三端对齐
  6. 策略产品复核
  7. 特征版本表更新
  8. 历史留痕（审计日志）
"""
import json
import os
import sys
import time
import subprocess
from pathlib import Path

import pandas as pd
import numpy as np

from semantic_cluster_naming.models import init_db
from semantic_cluster_naming.snapshot_import import SnapshotImporter
from semantic_cluster_naming.clustering import ClusteringEngine
from semantic_cluster_naming.result_service import ResultService
from semantic_cluster_naming.models import ReviewStatus, TrainingStatus

DB_PATH = "semantic_cluster_verify.db"
SNAPSHOT_ID = "SNAP_VERIFY_001"
ACTOR_LINJIE = "数据科学家林姐"
ACTOR_PRODUCT = "策略产品"
VECTOR_COL = "vector"


def print_section(title):
    print()
    print("=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_step(n, title):
    print(f"\n>>> 步骤 {n}: {title}")


def check(label, condition, detail=""):
    if condition:
        print(f"  ✅ {label} 通过 {detail}")
    else:
        print(f"  ❌ {label} 失败 {detail}")
        sys.exit(1)


def main():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    Session, _ = init_db(f"sqlite:///{DB_PATH}")
    db = Session()

    # ---- 准备数据 ----
    np.random.seed(42)
    n = 30
    centers = np.array([
        [1, 0, 0, 0, -1, 0, 0, 0],
        [0, 1, 0, 0, 0, -1, 0, 0],
        [0, 0, 1, 0, 0, 0, -1, 0],
    ])
    texts = ["信用卡申请", "贷款咨询", "理财产品", "基金定投", "股票开户", "保险购买"] * 5
    texts = texts[:n]
    labels = np.random.randint(0, 3, n)
    X = np.array([centers[l] + np.random.randn(8) * 0.25 for l in labels])

    data = []
    for i in range(n):
        data.append({
            "id": i + 1,
            "text": texts[i],
            "vector": json.dumps(X[i].tolist()),
        })
    df = pd.DataFrame(data)
    csv_path = "verify_data.csv"
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    print(f"已生成验证数据: {csv_path} ({len(df)} 行)")

    # ================================================================
    # 步骤1: 特征快照编号第一次导入
    # ================================================================
    print_section("特征快照编号第一次导入（林姐）")
    print_step(1, f"导入 {csv_path} → 快照 {SNAPSHOT_ID}")
    importer = SnapshotImporter(db, actor=ACTOR_LINJIE)
    snapshots, stats = importer.import_from_dataframe(
        df=df, snapshot_id=SNAPSHOT_ID, source_file=csv_path,
        vector_column=VECTOR_COL,
    )
    check("快照行数", stats["imported_rows"] == n, f"实际={stats['imported_rows']} 期望={n}")
    check("重复标记为否", not stats["duplicate_detected"])

    snap_summary = importer.get_snapshot_summary(SNAPSHOT_ID)
    check("快照可查询", snap_summary["exists"])
    check("原始行号保留", all(s.original_row_number for s in snapshots))

    # ================================================================
    # 步骤2: 第一次聚类训练
    # ================================================================
    print_section("第一次聚类训练（林姐）")
    print_step(2, "训练 n_clusters=3")
    engine = ClusteringEngine(db, actor=ACTOR_LINJIE)
    run1, stats1 = engine.run_clustering(
        snapshot_id=SNAPSHOT_ID, n_clusters=3, algorithm="kmeans",
    )
    check("第一次训练状态 SUCCESS", run1.status == TrainingStatus.SUCCESS.value)
    check("第一次训练复核状态 NORMAL", run1.review_status == ReviewStatus.NORMAL.value)
    check("第一次训练非重复", not run1.is_duplicate_run)
    run_id_1 = run1.run_id
    print(f"  第一次运行ID: {run_id_1}")

    print_step(3, "数据科学家林姐补看训练日志曲线")
    log1 = engine.get_training_log(run_id_1)
    check("训练日志非空", log1 and len(log1) > 0)
    print(f"  日志行数: {len(log1.splitlines())}")
    print(f"  日志摘要: {log1.splitlines()[-1] if log1 else '-'}")

    # ================================================================
    # 步骤3: 同一批数据重复训练两次 —— 核心出问题样例
    # ================================================================
    print_section("同一批数据重复训练两次（林姐手滑点了第二次）")
    print_step(4, "同一批数据 + 同一参数 再次训练")
    run2, stats2 = engine.run_clustering(
        snapshot_id=SNAPSHOT_ID, n_clusters=3, algorithm="kmeans",
    )
    run_id_2 = run2.run_id
    print(f"  第二次运行ID: {run_id_2}")

    check("第二次训练标记为重复", stats2["is_duplicate"], f"实际={stats2['is_duplicate']}")
    check("第二次训练状态 DUPLICATE_TRAINING",
          run2.status == TrainingStatus.DUPLICATE_TRAINING.value, f"实际={run2.status}")
    check("第二次训练复核状态 PENDING_REVIEW（不自动归正常，留给策略产品）",
          run2.review_status == ReviewStatus.PENDING_REVIEW.value, f"实际={run2.review_status}")
    check("重复训练指向原运行ID",
          run2.duplicate_of_run_id == run_id_1, f"实际={run2.duplicate_of_run_id}")
    check("requires_review=True", stats2["requires_review"])

    # ================================================================
    # 步骤4: 页面 / API / 导出 三端对齐 —— 尤其是重复训练记录
    # ================================================================
    print_section("三端数据对齐（API / 页面展示 / 导出明细 读同一份结果）")
    service = ResultService(db)

    print_step(5, "ResultService.get_results_for_display（页面展示用）")
    disp_r2 = service.get_results_for_display(run_id_2)
    check("页面读取 is_duplicate_run=True", disp_r2["is_duplicate_run"])
    check("页面读取 review_status=pending_review",
          disp_r2["review_status"] == ReviewStatus.PENDING_REVIEW.value)
    check("页面读取 status=duplicate_training",
          disp_r2["status"] == TrainingStatus.DUPLICATE_TRAINING.value)
    check("页面读取总行数一致", disp_r2["total_rows"] == n)

    print_step(6, "ResultService.get_results_for_api（接口返回用）")
    api_r2 = service.get_results_for_api(run_id_2, page=1, page_size=n)
    check("API 读取 is_duplicate_run=True", api_r2["is_duplicate_run"])
    check("API 读取 review_status=pending_review",
          api_r2["review_status"] == ReviewStatus.PENDING_REVIEW.value)
    check("API 读取 status=duplicate_training",
          api_r2["status"] == TrainingStatus.DUPLICATE_TRAINING.value)
    check("API 分页 total 一致", api_r2["pagination"]["total"] == n)

    print_step(7, "ResultService.get_results（导出明细用）")
    raw_r2 = service.get_results(run_id_2)
    check("导出结果行数", len(raw_r2) == n)
    check("导出包含原始行号", all(r["original_row_number"] for r in raw_r2))
    check("导出包含 result_hash（防篡改校验）", all(r["result_hash"] for r in raw_r2))

    print_step(8, "三端结果逐项比对（同一批数据重复训练的状态完全一致）")
    page_rows = disp_r2["results"]
    api_rows = api_r2["results"]
    export_rows = raw_r2

    aligned = True
    diff_fields = []
    for i in range(n):
        for f in ["snapshot_id", "original_row_number", "cluster_id", "cluster_name"]:
            pv = page_rows[i][f]
            av = api_rows[i][f]
            ev = export_rows[i][f]
            if not (pv == av == ev):
                aligned = False
                diff_fields.append(f"row{i}.{f}: page={pv} api={av} export={ev}")
    check("三端结果完全对齐（同一重复训练记录不会一处显示、一处消失）", aligned,
          f"diff={diff_fields[:3]}")

    # ================================================================
    # 步骤5: 导出一致性校验
    # ================================================================
    print_step(9, "CSV 导出 + 自动一致性校验")
    export_path = "verify_export_r2.csv"
    export_result = service.export_results(run_id_2, export_path, format="csv")
    check("导出行数一致", export_result["row_count"] == n)
    check("导出一致性校验通过", export_result["consistency_verified"])
    check("导出记录落库 export_records", bool(export_result["export_id"]))
    print(f"  导出文件: {export_path}, content_hash={export_result['content_hash'][:16]}...")

    df_exported = pd.read_csv(export_path)
    check("CSV 内容行数与 DB 一致", len(df_exported) == n)

    # ================================================================
    # 步骤6: 策略产品复核
    # ================================================================
    print_section("策略产品复核（不自动归为正常）")
    print_step(10, "查看待复核列表")
    pending = service.get_pending_reviews()
    check("待复核列表包含 run2", any(p["run_id"] == run_id_2 for p in pending))
    pending_item = next(p for p in pending if p["run_id"] == run_id_2)
    check("待复核项标记重复训练", pending_item["is_duplicate_run"])

    print_step(11, "策略产品通过复核")
    ok = service.review_duplicate_run(
        run_id_2, decision="approve",
        reviewed_by=ACTOR_PRODUCT, comments="核对为同一批数据重复训练，结果一致，通过",
    )
    check("复核成功", ok)

    run2_after = service.get_results_for_display(run_id_2)
    check("复核后 review_status=approved",
          run2_after["review_status"] == ReviewStatus.APPROVED.value)
    check("复核后 status=success", run2_after["status"] == TrainingStatus.SUCCESS.value)

    # ================================================================
    # 步骤7: 特征版本表更新
    # ================================================================
    print_section("特征版本表更新")
    print_step(12, "创建特征版本 v1")
    ver = service.create_feature_version(
        snapshot_id=SNAPSHOT_ID, run_id=run_id_2,
        change_log="首次聚类，3个簇，策略产品已复核重复训练",
    )
    check("版本号=1", ver["version_number"] == 1)
    check("激活版本=True", ver["is_active"])

    # ================================================================
    # 步骤8: 历史留痕（审计日志）
    # ================================================================
    print_section("历史留痕 —— 策略产品追问时可回到证据")
    print_step(13, "查询快照 SNAPSHOT_ID 的审计日志")
    audit = service.get_audit_trail(snapshot_id=SNAPSHOT_ID, limit=100)
    actions = [a["action"] for a in audit]
    check("包含 snapshot.import", "snapshot.import" in actions)
    check("包含 training.start（至少两次）", actions.count("training.start") >= 2)
    check("包含 training.duplicate_detected", "training.duplicate_detected" in actions)
    check("包含 training.complete", "training.complete" in actions)
    check("包含 review.decision", "review.decision" in actions)
    check("包含 version.create", "version.create" in actions)
    check("包含 result.export", "result.export" in actions)

    print_step(14, "查询重复训练 run2 的字段级变更历史")
    audit_run2 = service.get_audit_trail(run_id=run_id_2, limit=100)
    review_log = next((a for a in audit_run2 if a["action"] == "review.decision"), None)
    check("review.decision 记录字段 review_status", review_log and review_log["field_changed"] == "review_status")
    check("review.decision 记录新值包含 approved",
          review_log and "approve" in (review_log["new_value"] or "").lower())
    check("review.decision 记录操作人=策略产品", review_log and review_log["actor"] == ACTOR_PRODUCT)

    # ================================================================
    # 步骤9: 重新对齐三端（复核后状态同步）
    # ================================================================
    print_section("复核后三端重新对齐")
    print_step(15, "复核后：API / 页面 / 导出 仍为同一份数据")
    disp_after = service.get_results_for_display(run_id_2)
    api_after = service.get_results_for_api(run_id_2, page_size=n)
    raw_after = service.get_results(run_id_2)

    check("页面读取 review_status=approved",
          disp_after["review_status"] == ReviewStatus.APPROVED.value)
    check("API 读取 review_status=approved",
          api_after["review_status"] == ReviewStatus.APPROVED.value)
    aligned2 = True
    for i in range(n):
        if disp_after["results"][i]["cluster_id"] != api_after["results"][i]["cluster_id"]:
            aligned2 = False
            break
    check("复核后结果三端仍一致", aligned2)

    # ================================================================
    # 输出复盘命令
    # ================================================================
    print_section("可复盘的记录 & 可重跑命令")
    print(f"""
  # 复盘路径：
  #   快照 {SNAPSHOT_ID}
  #   ├─ 第一次训练 {run_id_1}  (status=success, review=normal)
  #   └─ 第二次训练 {run_id_2}  (重复训练 → pending_review → 策略产品 approved)
  #       ├─ 导出文件 {export_path}
  #       └─ 特征版本 {ver['version_id']} (v{ver['version_number']})

  # 可重跑命令：
  python verify_closed_loop.py            # 本脚本完整重跑
  scn --db {DB_PATH} snapshot list       # 看快照
  scn --db {DB_PATH} cluster list         # 看训练
  scn --db {DB_PATH} audit --snapshot-id {SNAPSHOT_ID}
  scn --db {DB_PATH} replay --snapshot-id {SNAPSHOT_ID}
  scn --db {DB_PATH} serve --port 8765    # 启动页面/API看状态
""")

    db.close()
    print("\n🎉 数据闭环验证全部通过 ✅")


if __name__ == "__main__":
    main()
