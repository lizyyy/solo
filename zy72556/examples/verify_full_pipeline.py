#!/usr/bin/env python3
"""
类别不平衡重采样 - 完整流程验证脚本

覆盖：生成样例 → 导入快照 → 阿越审查 → 摘要更新 → 权重应用 → 导出明细
核对：记录ID、处理状态、阿越意见、历史留痕、报告说明、导出数量
验证：页面模板存在、打包后可用

用法：
    python3 examples/verify_full_pipeline.py
    # 或指定数据目录
    python3 examples/verify_full_pipeline.py --data-dir ./verify_data
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

import pandas as pd

script_dir = Path(__file__).resolve().parent
project_root = script_dir.parent
src_dir = project_root / "src"
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

from imbalance_resampler import (
    DataStore,
    ImbalanceResampler,
    WorkflowEngine,
    ExplanationGenerator,
    RecordStatus,
)
from imbalance_resampler.webapp import create_app


RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

passed = 0
failed = 0
checks: list[tuple[str, bool, str]] = []


def check(name: str, condition: bool, detail: str = ""):
    global passed, failed
    if condition:
        passed += 1
        status = f"{GREEN}✅ PASS{RESET}"
    else:
        failed += 1
        status = f"{RED}❌ FAIL{RESET}"
    checks.append((name, condition, detail))
    print(f"  {status} {name}")
    if detail and not condition:
        print(f"       {YELLOW}{detail}{RESET}")


def section(title: str):
    print(f"\n{CYAN}{BOLD}▶ {title}{RESET}")
    print(f"  {'─' * 60}")


def main():
    parser = argparse.ArgumentParser(description="完整流程验证脚本")
    parser.add_argument(
        "--data-dir",
        default=None,
        help="数据目录 (默认: 临时目录)",
    )
    parser.add_argument(
        "--sample-csv",
        default=str(script_dir / "problem_sample_features.csv"),
        help="样例CSV路径",
    )
    args = parser.parse_args()

    print(f"{BOLD}类别不平衡重采样 - 完整流程验证{RESET}")
    print("=" * 60)

    # ========== 准备 ==========
    section("准备工作")

    if args.data_dir:
        data_dir = Path(args.data_dir).resolve()
        data_dir.mkdir(parents=True, exist_ok=True)
    else:
        tmpdir = tempfile.mkdtemp(prefix="resampler_verify_")
        data_dir = Path(tmpdir)

    print(f"  数据目录: {data_dir}")

    sample_csv = Path(args.sample_csv).resolve()
    if not sample_csv.exists():
        print(f"  {YELLOW}样例文件不存在，先生成...{RESET}")
        gen_script = script_dir / "generate_problem_sample.py"
        import subprocess
        result = subprocess.run(
            [sys.executable, str(gen_script)],
            capture_output=True,
            text=True,
            cwd=str(script_dir),
        )
        if result.returncode != 0:
            print(f"  {RED}生成失败: {result.stderr}{RESET}")
            sys.exit(1)

    check("样例CSV存在", sample_csv.exists(), str(sample_csv))

    df = pd.read_csv(sample_csv)
    check("样例有200条记录", len(df) == 200, f"实际: {len(df)}")

    missing_mask = (df == -999).any(axis=1)
    n_missing_rows = missing_mask.sum()
    check("有特征缺失的样本", n_missing_rows == 8, f"实际: {n_missing_rows}")

    default_score_mask = df["model_score"] == 0.5
    suspicious_mask = missing_mask & default_score_mask
    n_suspicious = suspicious_mask.sum()
    check("特征缺失+默认分的样本", n_suspicious == 7, f"实际: {n_suspicious}")

    # ========== 初始化 ==========
    section("Step 0: 初始化组件")

    data_store = DataStore(base_dir=str(data_dir))
    resampler = ImbalanceResampler()
    workflow = WorkflowEngine(data_store=data_store, resampler=resampler)
    explanation = ExplanationGenerator()

    check("DataStore 可初始化", True)
    check("ImbalanceResampler 可初始化", True)
    check("WorkflowEngine 可初始化", True)
    check("ExplanationGenerator 可初始化", True)

    # ========== Step 1: 导入 ==========
    section("Step 1: 特征快照导入")

    session_id = "verify_session_001"
    session = workflow.step1_import_snapshot(
        df=df,
        score_column="model_score",
        label_column="label",
        created_by="ayue",
        session_id=session_id,
    )

    check("会话创建成功", session.session_id == session_id)
    check("总记录数正确", len(session.records) == 200, f"实际: {len(session.records)}")

    suspicious_records = session.get_suspicious_records()
    check("自动识别出7条可疑记录", len(suspicious_records) == 7, f"实际: {len(suspicious_records)}")

    imported_count = len(session.get_records_by_status(RecordStatus.IMPORTED))
    suspicious_count = len(
        session.get_records_by_status(RecordStatus.SUSPICIOUS_DEFAULT_SCORE)
    )
    check("193条 imported 状态", imported_count == 193, f"实际: {imported_count}")
    check("7条 suspicious_default_score 状态", suspicious_count == 7, f"实际: {suspicious_count}")

    first_suspicious = suspicious_records[0]
    check("每条可疑记录有原始行号", first_suspicious.snapshot.original_line_number > 0)
    check("每条可疑记录有snapshot_id", bool(first_suspicious.snapshot.snapshot_id))
    check("每条可疑记录有审计日志", len(first_suspicious.audit_log) >= 2)
    check(
        "审计日志包含 import + status_change 两条",
        first_suspicious.audit_log[0].action.value == "import"
        and first_suspicious.audit_log[1].action.value == "status_change",
    )
    check(
        "可疑记录标记特征缺失",
        first_suspicious.snapshot.has_missing_features is True,
    )
    check(
        "可疑记录标记使用默认分",
        first_suspicious.snapshot.used_default_score is True,
    )

    # ========== Step 2: 阿越审查 ==========
    section("Step 2: 阿越审查训练日志曲线")

    suspicious_ids = [r.record_id for r in suspicious_records]

    decisions = {}

    decisions[suspicious_ids[0]] = {
        "curve_ok": True,
        "keep_suspicious": True,
        "note": "训练日志曲线auc稳定，双特征缺失是流量切割问题，留给推荐负责人复核",
    }
    decisions[suspicious_ids[1]] = {
        "curve_ok": True,
        "keep_suspicious": True,
        "note": "训练曲线正常，特征缺失原因未明，不急于归正常",
    }
    decisions[suspicious_ids[2]] = {
        "curve_ok": False,
        "exclude": True,
        "note": "训练曲线过拟合，样本质量差，排除",
    }
    decisions[suspicious_ids[3]] = {
        "curve_ok": True,
        "keep_suspicious": True,
        "note": "双特征缺失，训练曲线正常，待确认分布",
    }
    decisions[suspicious_ids[4]] = {
        "curve_ok": True,
        "keep_suspicious": True,
        "note": "已知线上bug样本，bug已修复但样本已入库，留给推荐负责人决定是否保留",
    }
    decisions[suspicious_ids[5]] = {
        "curve_ok": True,
        "keep_suspicious": True,
        "note": "三特征缺失给默认分，缺失数过多，建议推荐负责人评估权重影响",
    }
    decisions[suspicious_ids[6]] = {
        "curve_ok": True,
        "confirm_normal": True,
        "note": "特征缺失在此类目常见，训练分布正常，可确认正常",
    }

    session = workflow.step2_ayue_review_training_logs(
        session_id=session_id,
        record_decisions=decisions,
        reviewer="ayue",
    )

    needs_recheck = session.get_records_by_status(RecordStatus.NEEDS_RECHECK)
    excluded = session.get_records_by_status(RecordStatus.EXCLUDED)
    reviewed = session.get_records_by_status(RecordStatus.REVIEWED_BY_AYUE)

    check("阿越审查后: 5条 needs_recheck", len(needs_recheck) == 5, f"实际: {len(needs_recheck)}")
    check("阿越审查后: 1条 excluded", len(excluded) == 1, f"实际: {len(excluded)}")
    check("阿越审查后: 1条 reviewed_by_ayue", len(reviewed) == 1, f"实际: {len(reviewed)}")

    sample_needs = needs_recheck[0]
    check("待复核记录有阿越意见", bool(sample_needs.ayue_review_note))
    check("待复核记录有 training_log_curve_check 标记",
          sample_needs.training_log_curve_check is not None)
    check("待复核记录审计日志条数>=4",
          len(sample_needs.audit_log) >= 4,
          f"实际: {len(sample_needs.audit_log)}")

    sample_excluded = excluded[0]
    check("排除记录状态是 excluded",
          sample_excluded.current_status == RecordStatus.EXCLUDED)

    # ========== Step 3: 可解释摘要 ==========
    section("Step 3: 可解释摘要更新")

    expl_map = {}
    for rec in session.records:
        expl_map[rec.record_id] = {
            "summary": explanation.generate_summary(rec),
            "detail": explanation.generate_detail(rec),
            "update_note": "自动生成可解释摘要",
        }

    session = workflow.step3_update_explanation_summary(
        session_id=session_id,
        explanations=expl_map,
    )

    has_summary = sum(1 for r in session.records if r.explanation_summary)
    check("所有记录都有可解释摘要", has_summary == 200, f"实际: {has_summary}")

    sample_susp = session.get_suspicious_records()[0]
    check(
        "可疑记录摘要包含'特征缺失'",
        "特征缺失" in (sample_susp.explanation_summary or ""),
        sample_susp.explanation_summary or "",
    )
    check(
        "可疑记录摘要包含'默认分'",
        "默认分" in (sample_susp.explanation_summary or ""),
        sample_susp.explanation_summary or "",
    )
    check(
        "可疑记录摘要包含阿越备注",
        "阿越" in (sample_susp.explanation_summary or ""),
        sample_susp.explanation_summary or "",
    )

    detail = sample_susp.explanation_detail or ""
    check("详情包含特征缺失信息", "缺失特征" in detail)
    check("详情包含阿越审查意见", "阿越审查意见" in detail)
    check("详情包含审计日志", "审计日志" in detail)

    # ========== Step 4: 权重 ==========
    section("Step 4: 应用重采样权重")

    session = resampler.apply_resampling_weights(
        session=session,
        label_col="label",
        operator="system",
    )
    data_store.save_session(session)

    check("所有记录都有权重", all(r.final_weight > 0 for r in session.records if r.current_status != RecordStatus.EXCLUDED))

    excluded_rec = session.get_records_by_status(RecordStatus.EXCLUDED)
    if excluded_rec:
        check("排除记录权重为0", excluded_rec[0].final_weight == 0.0, f"实际: {excluded_rec[0].final_weight}")

    # ========== Step 5: 导出 ==========
    section("Step 5: 导出明细")

    csv_path = data_store.export_to_csv(session_id=session_id)
    check("CSV导出成功", Path(csv_path).exists())

    exported_df = pd.read_csv(csv_path)
    check("导出CSV有200行", len(exported_df) == 200, f"实际: {len(exported_df)}")

    required_cols = [
        "record_id", "snapshot_id", "original_line_number",
        "current_status", "model_score", "has_missing_features",
        "missing_features", "used_default_score", "default_score_reason",
        "final_weight", "ayue_review_note", "explanation_summary",
        "manual_edits", "audit_log_count",
    ]
    missing_cols = [c for c in required_cols if c not in exported_df.columns]
    check(f"导出包含所有{len(required_cols)}个核心字段", not missing_cols, f"缺失: {missing_cols}")

    suspicious_exported = exported_df[exported_df["used_default_score"] == True]
    check("导出中7条使用默认分的记录", len(suspicious_exported) == 7, f"实际: {len(suspicious_exported)}")

    ayue_note_count = exported_df["ayue_review_note"].notna().sum()
    check("导出中7条有阿越意见", ayue_note_count == 7, f"实际: {ayue_note_count}")

    # ========== Step 6: 数据一致性 ==========
    section("Step 6: 数据一致性核对")

    all_status = exported_df["current_status"].value_counts().to_dict()
    session_status = session.summary_stats.get("by_status", {})
    check("导出状态分布与会话统计一致", all_status == session_status,
          f"导出: {all_status} vs 会话: {session_status}")

    api_df = data_store.export_records_to_dataframe(session_id)
    check("API导出的df和CLI导出行数一致", len(api_df) == len(exported_df))
    check("API导出的df和CLI导出列一致", list(api_df.columns) == list(exported_df.columns))

    first_rec_id = exported_df.iloc[0]["record_id"]
    detail_rec = data_store.get_record_detail(session_id, first_rec_id)
    check("单条记录查询返回正确", detail_rec is not None)
    if detail_rec:
        check("单条记录状态与导出一致",
              detail_rec.current_status.value == exported_df.iloc[0]["current_status"])

    # ========== Step 7: 页面模板 ==========
    section("Step 7: 页面模板与服务")

    app = create_app(data_dir=str(data_dir))
    check("Flask app 创建成功", app is not None)
    check("app 有 templates 文件夹", app.template_folder is not None)
    check("templates 路径存在", Path(app.template_folder).exists())

    templates_dir = Path(app.template_folder)
    required_templates = ["base.html", "sessions.html", "session_detail.html",
                          "record_detail.html", "export_view.html"]
    for t in required_templates:
        check(f"模板文件 {t} 存在", (templates_dir / t).exists())

    with app.test_client() as client:
        resp = client.get("/health")
        check("GET /health 返回200", resp.status_code == 200)
        check("健康检查包含状态", b'"status"' in resp.data)

        resp = client.get("/")
        check("GET / (会话列表) 返回200", resp.status_code == 200, f"实际: {resp.status_code}")
        check("会话列表包含会话ID", session_id.encode() in resp.data)

        resp = client.get(f"/sessions/{session_id}")
        check(f"GET /sessions/{session_id} 返回200",
              resp.status_code == 200, f"实际: {resp.status_code}")
        check("会话详情页包含可疑记录区块", b"线上特征缺失" in resp.data)
        check("会话详情页包含阿越意见", b"阿越" in resp.data)

        resp = client.get(f"/sessions/{session_id}/records/{suspicious_ids[0]}")
        check(f"GET 可疑记录详情页 返回200", resp.status_code == 200, f"实际: {resp.status_code}")
        check("记录详情页包含审计时间轴", b"审计时间轴" in resp.data)
        check("记录详情页包含边界规则", b"边界规则" in resp.data)
        check("记录详情页包含阿越意见", b"阿越的审查意见" in resp.data)

        resp = client.get(f"/sessions/{session_id}/export")
        check("导出明细页 返回200", resp.status_code == 200, f"实际: {resp.status_code}")
        check("导出明细页包含数据一致性承诺", b"数据一致性承诺" in resp.data)
        check("导出明细页包含7条可疑记录表", b"共 7 条" in resp.data or "共7条".encode() in resp.data)

        resp = client.get(f"/api/sessions/{session_id}/export.csv")
        check("API导出CSV 返回200", resp.status_code == 200)
        check("API CSV Content-Type正确", "text/csv" in resp.content_type)

    # ========== 边界规则 ==========
    section("Step 8: 边界规则")

    rules = resampler.get_boundary_rules()
    check("边界规则有缺失特征检测", "missing_feature_detection" in rules)
    check("边界规则有默认分检测", "default_score_detection" in rules)
    check("边界规则有权重规则", "weight_rules" in rules)
    check("边界规则有回滚策略", "rollback_policy" in rules)
    check("默认分阈值是0.5", rules["default_score_detection"]["threshold"] == 0.5)
    check("缺失特征触发值是-999", rules["missing_feature_detection"]["trigger_value"] == -999)

    # ========== 回滚 ==========
    section("Step 9: 回滚验证")

    target_rec_id = suspicious_ids[0]
    target_rec = data_store.get_record_detail(session_id, target_rec_id)
    original_audit_count = len(target_rec.audit_log) if target_rec else 0

    session = workflow.rollback_record(
        session_id=session_id,
        record_id=target_rec_id,
        to_audit_index=0,
        operator="ayue",
        reason="测试回滚功能",
    )

    rolled_rec = data_store.get_record_detail(session_id, target_rec_id)
    check("回滚后原记录变为excluded",
          rolled_rec.current_status == RecordStatus.EXCLUDED if rolled_rec else False)

    new_records = [r for r in session.records if r.is_rollback_of == target_rec_id]
    check("回滚生成新记录", len(new_records) == 1, f"实际: {len(new_records)}")

    if new_records:
        new_rec = new_records[0]
        check("新记录有rollback审计条目",
              any(e.action.value == "rollback" for e in new_rec.audit_log))
        check("新记录保留原始行号",
              new_rec.snapshot.original_line_number == target_rec.snapshot.original_line_number)

    # ========== 总结 ==========
    print(f"\n{BOLD}验证结果总结{RESET}")
    print("=" * 60)
    print(f"  {GREEN}{BOLD}通过: {passed}{RESET}  |  {RED}{BOLD}失败: {failed}{RESET}  |  总计: {passed + failed}")

    if failed > 0:
        print(f"\n{RED}失败项详情:{RESET}")
        for name, ok, detail in checks:
            if not ok:
                print(f"  ❌ {name}")
                if detail:
                    print(f"     {detail}")
        sys.exit(1)
    else:
        print(f"\n{GREEN}{BOLD}🎉 全部验证通过！{RESET}")
        print(f"  数据目录: {data_dir}")
        print(f"  会话ID: {session_id}")
        print(f"  样例CSV: {sample_csv}")
        print(f"  导出CSV: {csv_path}")
        print(f"  页面模板: {Path(app.template_folder) if app else 'N/A'}")
        sys.exit(0)


if __name__ == "__main__":
    main()
