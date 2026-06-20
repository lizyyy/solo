import os
import sys
import json
import shutil
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models import DB_PATH, init_db, get_conn
from importer import import_spare_parts, generate_sample_excel
from warning_engine import run_warning_pipeline
from handler import handle_warning_record, update_manual_remark
from exporter import export_anomaly_queue, export_manager_report


def reset_db():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    for d in ["uploads", "exports", "samples", "__pycache__"]:
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


def print_manager_summary(r, title=""):
    print(f"\n  📋 给维保主管阿敏的{title}汇总：")
    print(f"     {r.get('summary_text', r.get('summary', '无'))}")
    if r.get('incomplete_detail'):
        print(f"     📌 缺信息需要补（{len(r['incomplete_detail'])}条）：")
        for item in r['incomplete_detail'][:3]:
            print(f"       · {item['material_name']}（{item['batch_no']}）缺：{', '.join(item.get('missing_fields', []))}")
    if r.get('duplicate_detail'):
        normal = [d for d in r['duplicate_detail'] if '普通' in d.get('reason', '')]
        with_remark = [d for d in r['duplicate_detail'] if '人工备注' in d.get('reason', '')]
        print(f"     ✖️  重复导入被跳过（{len(r['duplicate_detail'])}条）：")
        if normal:
            print(f"       · 普通记录跳过 {len(normal)} 条（未新增，总数不翻倍）")
        if with_remark:
            print(f"       · 带人工备注重复 {len(with_remark)} 条（备注已完整保留，未覆盖）")
    if r.get('pending_warnings'):
        print(f"     ⚠️  待处理异常（{len(r['pending_warnings'])}条）：")
        for w in r['pending_warnings'][:3]:
            print(f"       · [{w['level']}] {w['material_name']} {w['anomaly_type']}（{w['queue_status']}）")


def main():
    reset_db()
    results = []
    all_checks = []

    # ========== 场景1：首次导入样例清单 ==========
    section("场景1：首次导入样例清单")
    sample_path = "samples/test_dup_sample.xlsx"
    generate_sample_excel(sample_path)
    r1 = import_spare_parts(sample_path, "测试批次1_首次导入.xlsx", "测试-阿敏助手")
    all_checks.append(check("首次导入成功", r1["success"]))
    all_checks.append(check("导入了19条（20条样例中1条为同批内重复）",
        r1["imported"] == 19, f"imported={r1['imported']}, total={r1['total']}"))
    all_checks.append(check("不齐整2条", r1["incomplete"] == 2, f"incomplete={r1['incomplete']}"))
    all_checks.append(check("重复1条（同批内）", r1["duplicates"] == 1, f"duplicates={r1['duplicates']}"))
    all_checks.append(check("返回summary_text给阿敏看", "共20条" in r1.get("summary_text", ""), f"summary={r1.get('summary_text')}"))
    all_checks.append(check("incomplete_detail含missing_fields明细",
        all('missing_fields' in d for d in r1["incomplete_detail"]),
        f"incomplete_detail={r1['incomplete_detail']}"))
    all_checks.append(check("duplicate_detail含reason说明",
        all('reason' in d for d in r1["duplicate_detail"]),
        f"duplicate_detail示例={r1['duplicate_detail'][:1]}"))
    print_manager_summary(r1, "首次导入")

    conn = get_conn()
    batch_id = r1["batch_id"]
    first_count = conn.execute("SELECT COUNT(*) as cnt FROM spare_parts").fetchone()["cnt"]
    conn.close()
    all_checks.append(check("首次导入后总数=19", first_count == 19, f"first_count={first_count}"))

    # ========== 场景2：运行阈值预警，产生异常队列 ==========
    section("场景2：运行阈值预警（产生异常队列+状态+结论）")
    run1 = run_warning_pipeline(batch_id, operator="算法值班人")
    all_checks.append(check("首次预警成功", run1["success"], f"异常总数={run1['warning_count']}"))

    # ========== 场景3：处理1条异常，填写状态+备注+结论 ==========
    section("场景3：处理1条异常（写状态+备注+结论）")
    conn = get_conn()
    rec = conn.execute("""
        SELECT wr.id, wr.status, aq.queue_status, aq.file_conclusion
        FROM warning_record wr JOIN anomaly_queue aq ON aq.warning_record_id=wr.id
        WHERE wr.run_id=? AND wr.level='严重' LIMIT 1
    """, (run1["run_id"],)).fetchone()
    conn.close()

    NEW_STATUS = "需补货"
    HANDLE_REMARK = "厂家确认出厂厚度不合格，退回换件"
    CONCLUSION = "补货：板式橡胶支座 GJZ200×200×42"
    hd = handle_warning_record(rec["id"], NEW_STATUS, HANDLE_REMARK, CONCLUSION, "维保主管-阿敏")
    all_checks.append(check("状态更新成功", hd["success"]))
    all_checks.append(check("队列状态联动→已结案-补货", hd["queue_status"] == "已结案-补货"))
    all_checks.append(check("文件结论联动同步", hd["file_conclusion"] == CONCLUSION))

    # ========== 场景4：给1条不齐整材料加人工备注 ==========
    section("场景4：添加人工备注（验证不被覆盖）")
    conn = get_conn()
    a_part = conn.execute("SELECT id, manual_remark FROM spare_parts WHERE import_batch_id=? AND is_complete=0 LIMIT 1", (batch_id,)).fetchone()
    conn.close()
    REMARK = "2026.6.20 阿敏：球型支座测量仪送市计量所校准，预计明天下午4点补数据"
    ur = update_manual_remark(a_part["id"], REMARK, "阿敏")
    all_checks.append(check("人工备注保存成功", ur["success"], f"new={ur['new'][:30]}…"))

    # ========== 场景5：原样导入第二份，验证去重 ==========
    section("场景5：原样再导入一次（核心验证：总数不增加+备注不覆盖）")
    r2 = import_spare_parts(sample_path, "测试批次2_重复导入.xlsx", "测试-重复导入")
    all_checks.append(check("二次导入成功", r2["success"]))

    conn = get_conn()
    second_count = conn.execute("SELECT COUNT(*) as cnt FROM spare_parts").fetchone()["cnt"]
    still_remark = conn.execute("SELECT manual_remark FROM spare_parts WHERE id=?", (a_part["id"],)).fetchone()["manual_remark"]
    queue_after = conn.execute("""
        SELECT wr.status, aq.queue_status, aq.file_conclusion, wr.conclusion, wr.handle_remark
        FROM warning_record wr JOIN anomaly_queue aq ON aq.warning_record_id=wr.id
        WHERE wr.id=?
    """, (rec["id"],)).fetchone()
    conn.close()

    all_checks.append(check("二次导入新增=0条（全部是重复被跳过）",
        r2["imported"] == 0, f"imported={r2['imported']}, duplicates={r2['duplicates']}"))
    all_checks.append(check("二次导入跳过≥19条（全部被识别为重复，含同批内+跨批次）",
        r2["duplicates"] >= 19, f"duplicates={r2['duplicates']}"))
    all_checks.append(check("二次导入跳过带备注=1条",
        r2["skipped_due_manual_remark"] == 1, f"skipped_due_manual_remark={r2['skipped_due_manual_remark']}"))
    all_checks.append(check("⚠️ 核心：备件总数不翻倍（仍为19）",
        second_count == first_count,
        f"首次={first_count}, 二次后={second_count} 🔥 翻倍了！" if second_count != first_count else
        f"首次={first_count}, 二次后={second_count} ✅ 未翻倍"))
    all_checks.append(check("⚠️ 核心：人工备注未被覆盖",
        still_remark == REMARK,
        f"原={REMARK[:40]}…, 现={still_remark[:40] if still_remark else '空'}"))
    all_checks.append(check("⚠️ 核心：异常状态未被污染",
        queue_after["status"] == NEW_STATUS, f"status={queue_after['status']}"))
    all_checks.append(check("⚠️ 核心：队列状态未被污染",
        queue_after["queue_status"] == "已结案-补货", f"queue_status={queue_after['queue_status']}"))
    all_checks.append(check("⚠️ 核心：结论未被污染",
        queue_after["file_conclusion"] == CONCLUSION, f"file_conclusion={queue_after['file_conclusion']}"))
    all_checks.append(check("⚠️ 核心：处理备注未被污染",
        queue_after["handle_remark"] == HANDLE_REMARK, f"handle_remark={queue_after['handle_remark']}"))
    all_checks.append(check("duplicate_detail区分普通/带备注原因",
        any("普通记录" in d["reason"] for d in r2["duplicate_detail"]) and
        any("已有人工备注" in d["reason"] for d in r2["duplicate_detail"]),
        f"reasons={[d['reason'] for d in r2['duplicate_detail'][:3]]}"))
    all_checks.append(check("skipped_due_remark_detail含原备注内容",
        r2["skipped_due_remark_detail"][0]["existing_manual_remark"] == REMARK,
        f"existing_remark={r2['skipped_due_remark_detail'][0]['existing_manual_remark'][:30]}"))

    print_manager_summary(r2, "二次导入")

    # ========== 场景6：导出异常队列，验证一致性 ==========
    section("场景6：导出异常队列（验证页面与文件结论一致）")
    exp_q = export_anomaly_queue(run1["run_id"], "exports/重复导入验证_异常队列.xlsx")
    all_checks.append(check("异常队列导出成功", exp_q["success"], f"共{exp_q['total']}条"))
    all_checks.append(check("导出一致性校验通过（状态-备注-结论三对应）",
        exp_q["consistency_mismatch_count"] == 0,
        f"不一致数={exp_q['consistency_mismatch_count']}, 明细={exp_q['consistency_mismatch']}"))

    # 直接查库验证导出的结论和页面一致
    conn = get_conn()
    rec_after = conn.execute("""
        SELECT wr.conclusion, wr.status, aq.file_conclusion, aq.queue_status
        FROM warning_record wr JOIN anomaly_queue aq ON aq.warning_record_id=wr.id
        WHERE wr.id=?
    """, (rec["id"],)).fetchone()
    conn.close()
    all_checks.append(check("记录结论 = 文件结论",
        rec_after["conclusion"] == rec_after["file_conclusion"],
        f"conclusion={rec_after['conclusion']}, file_conclusion={rec_after['file_conclusion']}"))
    all_checks.append(check("记录状态 → 队列状态映射正确",
        (rec_after["status"] == "需补货" and rec_after["queue_status"] == "已结案-补货"),
        f"status={rec_after['status']}, queue_status={rec_after['queue_status']}"))

    # ========== 场景7：导出维保主管报告 ==========
    section("场景7：导出维保主管视角报告")
    exp_r = export_manager_report(run1["run_id"], "exports/重复导入验证_维保主管报告.xlsx")
    all_checks.append(check("维保报告导出成功", exp_r["success"]))
    all_checks.append(check("报告分类总数=异常总数",
        exp_r["need_supply_count"] + exp_r["can_release_count"] + exp_r["pending_count"] == exp_q["total"],
        f"需补货={exp_r['need_supply_count']} + 可放行={exp_r['can_release_count']} + 待判定={exp_r['pending_count']} = {exp_q['total']}"))

    # ========== 场景8：验证数据库details_json字段已存 ==========
    section("场景8：验证数据库存储（供详情页读取）")
    conn = get_conn()
    b1 = conn.execute("SELECT details_json FROM import_batch WHERE batch_id=?", (r1["batch_id"],)).fetchone()
    b2 = conn.execute("SELECT details_json FROM import_batch WHERE batch_id=?", (r2["batch_id"],)).fetchone()
    conn.close()
    all_checks.append(check("首次导入details_json已存", b1["details_json"] is not None))
    all_checks.append(check("二次导入details_json已存", b2["details_json"] is not None))
    d2 = json.loads(b2["details_json"])
    all_checks.append(check("二次导入details含summary_text", "共20条 → 新增0条" in d2.get("summary_text", ""),
        f"summary={d2.get('summary_text')}"))
    all_checks.append(check("二次导入details含三类完整明细",
        len(d2.get("duplicate_detail", [])) >= 19 and
        len(d2.get("skipped_due_remark_detail", [])) == 1 and
        len(d2.get("incomplete_detail", [])) == 0,
        f"duplicate_detail={len(d2.get('duplicate_detail', []))}, skipped={len(d2.get('skipped_due_remark_detail', []))}, incomplete={len(d2.get('incomplete_detail', []))}"))
    all_checks.append(check("二次导入details含pending_warnings",
        "pending_warnings" in d2, f"pending_warnings数量={len(d2.get('pending_warnings', []))}"))

    # ========== 汇总 ==========
    passed = sum(1 for c in all_checks if c)
    total = len(all_checks)
    print(f"\n{'='*70}")
    print(f"📊 重复导入修复验证完成：{passed}/{total} 通过" +
          ("  🎉🎉🎉" if passed == total else "  ⚠️ 有失败项"))
    print(f"{'='*70}")

    print(f"\n📂 生成的验证文件：")
    for root, dirs, files in os.walk("exports"):
        for f in files:
            fp = os.path.join(root, f)
            print(f"  - {fp} ({os.path.getsize(fp)//1024}KB)")
    for root, dirs, files in os.walk("samples"):
        for f in files:
            fp = os.path.join(root, f)
            print(f"  - {fp} ({os.path.getsize(fp)//1024}KB)")

    if passed != total:
        print("\n❌ 失败项：")
        for i, c in enumerate(all_checks, 1):
            if not c:
                print(f"  {i}. {c}")
        sys.exit(1)
    else:
        print("\n✅ 全部验证通过！重复导入去重修复成功：")
        print("   · 普通记录不再被重新插入（总数不翻倍）")
        print("   · 带人工备注的记录被跳过（备注不覆盖）")
        print("   · 异常队列状态/备注/结论未被污染")
        print("   · 导入结果清晰区分新增/跳过/原因明细")
        print("   · 阿敏可直接看到：缺信息、待处理、被跳过 三类清单")


if __name__ == "__main__":
    main()
