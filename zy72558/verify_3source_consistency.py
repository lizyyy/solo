#!/usr/bin/env python3
"""三端同源一致性核对脚本

核对同一批数据在以下四个入口读的是同一份结果：
1. 数据库直接读取（SQLAlchemy ORM）
2. HTTP API 返回（/api/runs、/api/runs/<id>、/api/reviews/pending）
3. CSV 导出文件（cluster_results.csv）
4. HTML 页面展示（/、/run/<id>）

覆盖核对项：
- 快照编号 SNAP2024001
- 操作者角色：林姐（导入/训练）、策略产品（复核/版本）
- 训练状态：两次训练，其中 1 次标记 duplicate
- 版本记录
- 审计留痕条数
- 导出明细行数
"""
import json
import urllib.request
import csv
import os
import sys

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from semantic_cluster_naming.models import (
    FeatureSnapshot,
    ClusteringResult,
    FeatureVersion,
    AuditLog,
    ReviewStatus,
)
from semantic_cluster_naming.result_service import ResultService

DB_URL = "sqlite:///demo_flow.db"
API_BASE = "http://127.0.0.1:8766"
CSV_PATH = "./cluster_results.csv"

errors = []


def check(cond, msg):
    if cond:
        print(f"  ✓ {msg}")
    else:
        errors.append(msg)
        print(f"  ✗ {msg}")


def main():
    engine = create_engine(DB_URL)
    session = Session(engine)

    print("=" * 70)
    print("【三端同源一致性核对报告】")
    print("=" * 70)

    # === 1. DB ===
    print("\n【1/6】数据库直接读取")
    snap = session.execute(select(FeatureSnapshot)).scalar_one()
    runs = sorted(
        session.execute(select(ClusteringResult)).scalars().all(),
        key=lambda r: r.created_at,
    )
    ver = session.execute(select(FeatureVersion)).scalar_one()
    audits = list(
        session.execute(select(AuditLog).order_by(AuditLog.created_at)).scalars().all()
    )

    print(f"  快照 id={snap.snapshot_id} rows={snap.total_rows} status={snap.status} imported_by={snap.imported_by}")
    for i, r in enumerate(runs):
        print(
            f"  Run{i+1}: {r.run_id} status={r.status} dup={r.is_duplicate_run} "
            f"dup_of={r.duplicate_of_run_id} review={r.review_status} run_by={r.run_by}"
        )
    print(f"  版本: {ver.version_id} v{ver.version_number} snap={ver.snapshot_id} run={ver.run_id} active={ver.is_active} by={ver.created_by}")
    actors = sorted(set(a.actor for a in audits))
    print(f"  审计: {len(audits)} 条  actors={actors}")

    check(snap.snapshot_id == "SNAP2024001", f"快照编号 SNAP2024001 (实际={snap.snapshot_id})")
    check(snap.imported_by == "林姐", f"导入操作者=林姐 (实际={snap.imported_by})")
    check(len(runs) == 2, f"训练记录 2 次 (实际={len(runs)})")
    check(runs[0].run_by == "林姐", f"第一次训练 run_by=林姐 (实际={runs[0].run_by})")
    check(runs[1].run_by == "林姐", f"第二次训练 run_by=林姐 (实际={runs[1].run_by})")
    check(runs[1].is_duplicate_run is True, f"第二次训练标记重复 (实际={runs[1].is_duplicate_run})")
    check(runs[1].duplicate_of_run_id == runs[0].run_id, "重复训练指向第一次 run_id")
    check(runs[1].review_status == ReviewStatus.approved, f"复核后 review_status=approved (实际={runs[1].review_status})")
    check(ver.created_by == "策略产品", f"版本创建者=策略产品 (实际={ver.created_by})")
    check(ver.snapshot_id == snap.snapshot_id, "版本关联正确快照")
    check(ver.run_id == runs[0].run_id, "版本关联第一次训练 run")
    check("林姐" in actors and "策略产品" in actors, f"审计记录包含林姐和策略产品 (实际={actors})")
    check(len(audits) >= 8, f"审计记录不少于 8 条 (实际={len(audits)})")

    # === 2. API /api/runs ===
    print("\n【2/6】HTTP API /api/runs")
    with urllib.request.urlopen(f"{API_BASE}/api/runs") as resp:
        payload = json.loads(resp.read())
    api_runs = payload.get("data", payload)
    db_map = {r.run_id: r for r in runs}
    check(len(api_runs) == len(runs), f"API runs={len(api_runs)} 与 DB={len(runs)} 一致")
    for ar in api_runs:
        dr = db_map[ar["run_id"]]
        check(ar["status"] == dr.status, f"{ar['run_id']} status 一致")
        check(ar["review_status"] == dr.review_status, f"{ar['run_id']} review_status 一致")
        check(ar["is_duplicate_run"] == dr.is_duplicate_run, f"{ar['run_id']} is_duplicate_run 一致")
        check(ar["_source"] == "api/single_result_source", f"{ar['run_id']} 来源标记正确")
        check("_result_fields_aligned" in ar, f"{ar['run_id']} 三端对齐标记存在")

    # === 3. API /api/runs/<id> 单条详情 ===
    print("\n【3/6】HTTP API /api/runs/<id> 单条详情")
    first_id = runs[0].run_id
    with urllib.request.urlopen(f"{API_BASE}/api/runs/{first_id}") as resp:
        payload = json.loads(resp.read())
    single = payload.get("data", payload)
    check(single["_source"] == "result_service.single_source_for_all", "单条详情来源标记")
    check(single["snapshot_id"] == snap.snapshot_id, f"单条详情快照编号={single['snapshot_id']}")
    check(single["run_id"] == first_id, "单条详情 run_id 一致")

    # === 4. API /api/reviews/pending ===
    print("\n【4/6】HTTP API /api/reviews/pending")
    with urllib.request.urlopen(f"{API_BASE}/api/reviews/pending") as resp:
        payload = json.loads(resp.read())
    pending = payload.get("data", payload)
    db_pending = [r for r in runs if r.review_status == ReviewStatus.pending_review]
    check(len(pending) == len(db_pending) == 0, f"待复核列表 API={len(pending)} DB={len(db_pending)}（已复核完成）")

    # === 5. CSV 导出 ===
    print("\n【5/6】CSV 导出 / ResultService")
    check(os.path.exists(CSV_PATH), f"CSV 文件存在 {CSV_PATH}")
    svc = ResultService(session)
    db_export = svc.export_result(runs[0].run_id, format="csv")
    with open(CSV_PATH, encoding="utf-8") as f:
        csv_rows = f.read().strip().split("\n")
    csv_data_rows = len(csv_rows) - 1
    check(csv_data_rows == db_export["row_count"], f"CSV 行数={csv_data_rows} 与 ResultService 导出={db_export['row_count']} 一致")
    header = csv_rows[0].split(",")
    first_row = dict(zip(header, csv_rows[1].split(",")))
    check(first_row["snapshot_id"] == snap.snapshot_id, f"CSV 首行 snapshot_id={first_row['snapshot_id']}")
    check(first_row["run_id"] == runs[0].run_id, f"CSV 首行 run_id={first_row['run_id']}")
    check(db_export.get("consistency_verified") is True, "ResultService._verify_export_consistency 通过")

    # === 6. HTML 页面 ===
    print("\n【6/6】HTML 页面展示")
    with urllib.request.urlopen(f"{API_BASE}/") as resp:
        home_html = resp.read().decode("utf-8")
    with urllib.request.urlopen(f"{API_BASE}/run/{first_id}") as resp:
        run_html = resp.read().decode("utf-8")
    check(snap.snapshot_id in home_html, f"首页包含快照编号 {snap.snapshot_id}")
    check(snap.snapshot_id in run_html, f"详情页包含快照编号 {snap.snapshot_id}")
    check(first_id in home_html, f"首页包含 run_id {first_id}")
    check(first_id in run_html, f"详情页包含 run_id {first_id}")
    check("三端一致性" in home_html, "首页包含三端一致性说明")
    for r in runs:
        check(r.run_id in home_html, f"首页包含训练 run_id={r.run_id}")

    # === 总结 ===
    print("\n" + "=" * 70)
    if not errors:
        print("【三端同源一致性核对：全部通过 ✓】")
        print(f"  数据库       : {DB_URL}")
        print(f"  快照编号     : {snap.snapshot_id}（三端一致）")
        print(f"  操作者       : 林姐（导入/训练）、策略产品（复核/版本）")
        print(f"  训练记录     : {len(runs)} 次，其中 1 次重复训练已标记 is_duplicate_run=True")
        print(f"  版本记录     : {ver.version_id} v{ver.version_number} 激活={ver.is_active}")
        print(f"  审计留痕     : {len(audits)} 条")
        print(f"  导出明细     : CSV {csv_data_rows} 行，与 ResultService 一致")
        print(f"  页面入口     : {API_BASE}/  和  {API_BASE}/run/{first_id}")
        print("=" * 70)
        sys.exit(0)
    else:
        print(f"【核对失败：{len(errors)} 项错误】")
        for e in errors:
            print(f"  ✗ {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
