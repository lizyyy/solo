import os
import sys
import json
import shutil
from datetime import datetime
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models import DB_PATH, init_db, get_conn
from importer import import_spare_parts, generate_sample_excel
from warning_engine import run_warning_pipeline
from handler import handle_warning_record, update_manual_remark
from exporter import export_anomaly_queue, export_manager_report


def reset_db():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    for d in ["uploads", "exports", "samples"]:
        if os.path.exists(d):
            shutil.rmtree(d)
        os.makedirs(d, exist_ok=True)
    init_db()
    print("✅ 数据库重置完成")


def section(title):
    print(f"\n{'='*70}\n🎯 {title}\n{'='*70}")


def check(name, cond, detail=""):
    mark = "✅ PASS" if cond else "❌ FAIL"
    print(f"  {mark} - {name}" + (f" → {detail}" if detail else ""))
    return cond


def main():
    reset_db()
    results = []

    # ========== 场景1：导入样例清单（含不齐整材料 ==========
    section("场景1：导入样例清单 + 不齐整材料处理")
    sample_path = "samples/test_sample_1.xlsx"
    generate_sample_excel(sample_path)
    r = import_spare_parts(sample_path, os.path.basename(sample_path), "测试-阿敏助手")
    results.append(check("导入成功", r["success"], f"导入 {r['imported']}/{r['total']} 条"))
    results.append(check("不齐整条数=2（1条缺测量值+1条缺编码规格单位供应商）", r["incomplete"] == 2, f"实际={r['incomplete']}, 详情={r['incomplete_detail']}"))

    conn = get_conn()
    batch_id = r["batch_id"]
    parts_inc = conn.execute("SELECT material_name, raw_remark, is_complete FROM spare_parts WHERE import_batch_id=? AND is_complete=0", (batch_id,)).fetchall()
    conn.close()
    results.append(check("不齐整材料备注带'后补/'不齐整:缺xx",
        all("不齐整" in (p["raw_remark"] or "") for p in parts_inc),
        f"不齐整备注: {[(p['material_name'], p['raw_remark'][:40]) for p in parts_inc]}"))

    # ========== 场景2：用默认配置跑第一次预警（异常不被均值掩盖 ==========
    section("场景2：默认阈值配置首次预警 - 中位数+IQR防均值掩盖")
    run1 = run_warning_pipeline(batch_id, operator="算法值班人-第一次")
    results.append(check("首次预警运行成功", run1["success"], f"run_no={run1['run_no']}, 异常总数={run1['warning_count']}"))
    results.append(check("关键异常都被检出（严重+警告≥3：板式2条+盆式1条）",
        run1["by_level"]["严重"] + run1["by_level"]["警告"] >= 3, f"按级别分={run1['by_level']}"))

    conn = get_conn()
    severe = conn.execute("""
        SELECT sp.material_name, sp.spec_model, wr.detected_value, wr.threshold_value,
               wr.step_detected, wr.level, wr.deviation
        FROM warning_record wr JOIN spare_parts sp ON wr.spare_part_id=sp.id
        WHERE wr.run_id=? AND wr.level='严重'
    """, (run1["run_id"],)).fetchall()
    warns = conn.execute("""
        SELECT sp.material_name, sp.spec_model, wr.detected_value, wr.threshold_value,
               wr.step_detected, wr.level, wr.deviation
        FROM warning_record wr JOIN spare_parts sp ON wr.spare_part_id=sp.id
        WHERE wr.run_id=? AND wr.level='警告'
    """, (run1["run_id"],)).fetchall()
    conn.close()
    all_anom = severe + warns
    iqr_detected = any("IQR" in (s["step_detected"] or "") for s in all_anom)
    results.append(check("异常使用【稳健上/下界(IQR)超限】检出（中位数中心，不被均值拉偏）",
        iqr_detected, f"检出步骤: {[s['step_detected'] for s in all_anom]}; 值: {[(s['material_name'], s['detected_value'], s['threshold_value']) for s in all_anom]}"))
    results.append(check("异常总数≥3（板式2条+盆式1条 + 不齐整触发）",
        run1["warning_count"] >= 3, f"按级别分={run1['by_level']}; 异常值明细={[(s['material_name'], s['spec_model'], s['level'], s['detected_value']) for s in all_anom]}"))

    # ========== 场景3：换「临时调高阈值」配置跑，看参数变更追踪 ==========
    section("场景3：换「临时调高阈值-样例包」再跑同一批次 - 参数变更对比")
    conn = get_conn()
    cfg2 = conn.execute("SELECT id FROM threshold_config WHERE config_name LIKE '%临时调高%'").fetchone()
    conn.close()
    run2 = run_warning_pipeline(batch_id, config_id=cfg2["id"], operator="算法值班人-第二次(调阈值)")
    if not run2.get("success"):
        print(f"  🔴 场景3启动失败: {run2}")
        sys.exit(2)
    results.append(check("调高阈值后预警成功", run2["success"], f"run_no={run2['run_no']}, 异常数={run2['warning_count']}"))

    results.append(check("参数变更日志中可定位差异（step_logs含'参数变更检测'步骤）",
        any(s["step"] == "参数变更检测" for s in run2["step_logs"]),
        f"步骤列表: {[s['step'] for s in run2['step_logs']]}"))
    param_step = next((s for s in run2["step_logs"] if s["step"] == "参数变更检测"), None)
    if param_step:
        diffs = param_step["detail"].get("变更明细", [])
        results.append(check("变更明细包含 deviation_upper_pct 20→35 等关键参数",
            any(d.get("param") == "deviation_upper_pct" and d.get("old") == 20.0 for d in diffs),
            f"变更明细={json.dumps(diffs, ensure_ascii=False)}"))

    results.append(check("阈值调高后，警告级别异常数减少（部分Z-score异常不再触发）",
        run2["by_level"]["警告"] <= run1["by_level"]["警告"],
        f"第一次警告={run1['by_level']['警告']}, 第二次警告={run2['by_level']['警告']}"))

    # ========== 场景4：人工备注 + 重复导入不覆盖不翻倍 ==========
    section("场景4：人工备注 → 重复导入验证（备注不覆盖 + 记录不翻倍）")
    conn = get_conn()
    a_part = conn.execute("SELECT id, manual_remark FROM spare_parts WHERE import_batch_id=? AND is_complete=0 LIMIT 1", (batch_id,)).fetchone()
    conn.close()
    REMARK_CONTENT = "2026.6.9 阿敏备注：这批球型支座测量仪送检，明天下午补数"
    ur = update_manual_remark(a_part["id"], REMARK_CONTENT, "维保主管-阿敏")
    results.append(check("人工备注保存成功", ur["success"], f"new={ur['new']}"))

    r2 = import_spare_parts(sample_path, os.path.basename(sample_path) + "(第二次导入)", "重复导入-测试")
    results.append(check("重复导入未报错", r2["success"]))
    results.append(check("重复导入时跳过带manual_remark的记录（人工备注不被覆盖）",
        r2["skipped_due_manual_remark"] >= 1, f"skipped_due_manual_remark={r2['skipped_due_manual_remark']}"))
    results.append(check("同一Excel重复导入时不再新增正常记录",
        r2["imported"] == 0, f"二次导入成功={r2['imported']}, 重复={r2['duplicates']}"))

    conn = get_conn()
    total_parts = conn.execute("SELECT COUNT(*) as cnt FROM spare_parts").fetchone()["cnt"]
    still_remark = conn.execute("SELECT manual_remark FROM spare_parts WHERE id=?", (a_part["id"],)).fetchone()["manual_remark"]
    conn.close()
    results.append(check("备件总数不翻倍（重复导入后总数仍等于首次导入数）",
        total_parts == r["imported"],
        f"首次导入={r['imported']}, 二次导入成功={r2['imported']}, 总数={total_parts}"))
    results.append(check("人工备注未被覆盖（仍然是原内容）",
        still_remark == REMARK_CONTENT, f"原备注={REMARK_CONTENT[:30]}, 当前={still_remark[:30] if still_remark else '空'}"))

    supplement_path = "samples/test_sample_1_supplement.xlsx"
    pd.DataFrame([{
        "批次号": "B2026-06001",
        "材料编码": "ZZ-003",
        "材料名称": "球型支座",
        "规格型号": "QZ1000GD",
        "测量值": 1000.0,
        "单位": "mm",
        "供应商": "宝力集团",
        "备注": "测量值已补录"
    }]).to_excel(supplement_path, index=False, sheet_name="备件清单")
    r3 = import_spare_parts(supplement_path, os.path.basename(supplement_path), "补录-测试")
    conn = get_conn()
    total_after_supplement = conn.execute("SELECT COUNT(*) as cnt FROM spare_parts").fetchone()["cnt"]
    still_remark_after_supplement = conn.execute("SELECT manual_remark FROM spare_parts WHERE id=?", (a_part["id"],)).fetchone()["manual_remark"]
    conn.close()
    results.append(check("同业务键的真实补录可导入（不因旧人工备注被误跳过）",
        r3["success"] and r3["imported"] == 1 and total_after_supplement == r["imported"] + 1,
        f"补录导入={r3.get('imported')}, 总数={total_after_supplement}"))
    results.append(check("补录后原人工备注仍未被覆盖",
        still_remark_after_supplement == REMARK_CONTENT,
        f"当前={still_remark_after_supplement[:30] if still_remark_after_supplement else '空'}"))

    # ========== 场景5：处理流程 - 状态/备注/结论联动 ==========
    section("场景5：处理流程状态联动 - 状态↔队列↔结论三对应")
    conn = get_conn()
    rec = conn.execute("SELECT wr.id, wr.status, aq.queue_status, aq.file_conclusion "
                       "FROM warning_record wr JOIN anomaly_queue aq ON aq.warning_record_id=wr.id "
                       "WHERE wr.run_id=? AND wr.level='严重' LIMIT 1", (run1["run_id"],)).fetchone()
    conn.close()
    NEW_STATUS = "需补货"
    HANDLE_REMARK = "供应商确认出厂不合格，安排退货换GJZ200x200x42新批次"
    CONCLUSION = "补货：板式橡胶支座GJZ200×200×42mm"
    hd = handle_warning_record(rec["id"], NEW_STATUS, HANDLE_REMARK, CONCLUSION, "维保主管-阿敏")
    results.append(check("状态流转成功", hd["success"], f"hd={hd}"))
    results.append(check("队列状态自动更新为'已结案-补货'",
        hd["queue_status"] == "已结案-补货", f"queue_status={hd['queue_status']}"))
    results.append(check("文件结论自动同步",
        hd["file_conclusion"] == CONCLUSION, f"file_conclusion={hd['file_conclusion']}"))

    # ========== 场景6：导出异常队列，校验一致性 ==========
    section("场景6：导出异常队列（含一致性告警校验）")
    exp_q = export_anomaly_queue(run1["run_id"], "exports/场景6_异常队列导出.xlsx")
    results.append(check("异常队列导出成功", exp_q["success"], f"文件={exp_q['output_path']}, 共{exp_q['total']}条"))
    results.append(check("导出一致性校验通过（0条不一致记录）",
        exp_q["consistency_mismatch_count"] == 0,
        f"不一致条目数={exp_q['consistency_mismatch_count']}, 明细={exp_q['consistency_mismatch']}"))

    # ========== 场景7：导出维保主管视角报告 ==========
    section("场景7：导出维保主管阿敏视角报告")
    exp_r = export_manager_report(run1["run_id"], "exports/场景7_维保主管报告.xlsx")
    results.append(check("维保报告导出成功", exp_r["success"], f"文件={exp_r['output_path']}"))
    results.append(check("报告含需补货/可放行/待判定3张分类清单（总数对应）",
        exp_r["need_supply_count"] + exp_r["can_release_count"] + exp_r["pending_count"] == exp_q["total"],
        f"需补货={exp_r['need_supply_count']}, 可放行={exp_r['can_release_count']}, 待判定={exp_r['pending_count']}, 合计={exp_q['total']}"))

    # ========== 汇总 ==========
    passed = sum(1 for r in results if r)
    total = len(results)
    print(f"\n{'='*70}")
    print(f"📊 全部场景验证完成：{passed}/{total} 通过" +
          ("  🎉🎉🎉" if passed == total else "  ⚠️ 有失败项，请检查"))
    print(f"{'='*70}")
    if passed != total:
        sys.exit(1)
    print("\n📂 生成的验证文件：")
    for root, dirs, files in os.walk("exports"):
        for f in files:
            fp = os.path.join(root, f)
            print(f"  - {fp} ({os.path.getsize(fp)//1024}KB)")
    for root, dirs, files in os.walk("samples"):
        for f in files:
            fp = os.path.join(root, f)
            print(f"  - {fp} ({os.path.getsize(fp)//1024}KB)")


if __name__ == "__main__":
    main()
