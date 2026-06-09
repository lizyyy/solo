"""
端到端测试 · 验证需求点
---------------------------------
✅ T1 维修照片字段名不一致合并后，条数正确且保留source字段
✅ T2 每一行标准化结果都保留 process_status
✅ T3 采样断档所在的归因条目 process_status = 异常处理（未默默放行）
✅ T4 存在晚到备件的设备，归因条目有 late_part_impact 详细说明
✅ T5 重复导入 normalized_photos 不翻倍
✅ T6 人工备注合并后，再次导入不会覆盖已有备注
✅ T7 偏差追溯 CSV 每行都填了 skew_photo_row_in_csv（让阿敏能找到那一行）
✅ T8 归因结果中 linked_photo_ids 能和 normalized_photos 的 photo_id 对上（维修照片→CSV明细）
"""
import csv
import os
import sys
import shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.normalizer import load_csv
from src.dedup_import import (
    dedup_import_normalized_photos,
    merge_manual_notes,
    _load_state, _save_state
)

PASS = "✅"
FAIL = "❌"

def t(tag, ok, msg=""):
    print(f"{PASS if ok else FAIL} {tag}  {msg}")
    return ok

def count_rows(pth):
    rows = load_csv(pth)
    return len(rows), rows

def run_all():
    all_ok = True
    
    print("\n" + "#"*60)
    print("# 配电柜温升异常归因 · 端到端需求测试")
    print("#"*60)
    
    # T1: 字段名不一致合并
    n, photos = count_rows("output/normalized_photos.csv")
    sources = set(p.get("source", "") for p in photos)
    ok = (n == 35) and ("班组巡检App-v1" in sources) and ("算法巡检系统-v2" in sources)
    all_ok &= t("T1 两批维修照片(字段名不一致)合并为35条，保留两种来源", ok,
                f"实际{n}条, 来源={sources}")
    
    # T2: 每一行都保留 process_status
    all_status = all(p.get("process_status", "") for p in photos)
    all_ok &= t("T2 每条标准化记录都有 process_status 字段值", all_status,
                f"空值行数={sum(1 for p in photos if not p.get('process_status'))}")
    
    # T3: 采样断档条目标异常处理
    _, attrs = count_rows("output/attribution_with_notes.csv")
    gap_rows = [a for a in attrs if a.get("sampling_gap_flag") == "是"]
    gap_handled = all(a.get("process_status") == "异常处理" for a in gap_rows)
    all_ok &= t(f"T3 采样断档标记为异常处理（共{len(gap_rows)}条，未默默放行）",
                gap_handled and len(gap_rows) > 0,
                f"样例: {gap_rows[0]['attribution_id'] if gap_rows else '无'} -> {gap_rows[0]['gap_details'][:60] if gap_rows else ''}")
    
    # T4: 晚到备件影响说明
    late_attrs = [a for a in attrs if a.get("late_part_impact", "") and a["late_part_impact"].strip()]
    has_chain = any("计划停机窗口" in a["late_part_impact"] and "未能执行更换" in a["late_part_impact"]
                    for a in late_attrs)
    all_ok &= t(f"T4 晚到备件归因条目含完整影响链路说明（{len(late_attrs)}条）",
                len(late_attrs) > 0 and has_chain,
                f"样例链路片段: {late_attrs[0]['late_part_impact'][:80] if late_attrs else ''}...")
    
    # T5: 重复导入不翻倍
    before = len(load_csv("output/normalized_photos.csv"))
    # 重置 import_state.json 中的 imported_photo_hashes 但不重置目标CSV
    # 直接再导一次同样的临时文件
    added, skipped = dedup_import_normalized_photos(
        "output/_tmp_normalized.csv", "output/normalized_photos.csv"
    )
    after = len(load_csv("output/normalized_photos.csv"))
    ok = (after == before) and (skipped == 35) and (added == 0)
    all_ok &= t(f"T5 重复导入不翻倍：前{before}条 → 后{after}条 跳过{skipped} 新增{added}",
                ok)
    
    # T6: 人工备注不被覆盖
    # 先在某条加一个假备注
    _, attrs2 = count_rows("output/attribution_with_notes.csv")
    target_a = None
    for a in attrs2:
        if a.get("manual_note_content", "").strip():
            target_a = a
            break
    
    # 保存原值
    original_note = target_a["manual_note_content"] if target_a else ""
    original_author = target_a["manual_note_author"] if target_a else ""
    test_note = "【测试备注不覆盖】"
    if target_a:
        target_a["manual_note_content"] = test_note
        target_a["manual_note_author"] = "测试人"
        # 写回去
        import csv as _c
        with open("output/attribution_with_notes.csv", "w", newline="", encoding="utf-8-sig") as f:
            w = _c.DictWriter(f, fieldnames=list(attrs2[0].keys()))
            w.writeheader()
            w.writerows(attrs2)
    
    # 再合并一次同样的备注
    merge_manual_notes("data/manual_notes.csv",
                       "output/attribution_with_notes.csv",
                       "output/attribution_with_notes.csv")
    _, attrs3 = count_rows("output/attribution_with_notes.csv")
    check = [a for a in attrs3 if a.get("attribution_id") == (target_a["attribution_id"] if target_a else "")]
    preserved = check and check[0]["manual_note_content"] == test_note
    all_ok &= t("T6 人工备注不被二次导入覆盖：写入测试备注后再合并→保留原值",
                preserved,
                f"写入='{test_note}' 实际='{check[0]['manual_note_content'][:30] if check else 'N/A'}'")
    
    # 恢复原状
    if check:
        check[0]["manual_note_content"] = original_note
        check[0]["manual_note_author"] = original_author
        import csv as _c
        with open("output/attribution_with_notes.csv", "w", newline="", encoding="utf-8-sig") as f:
            w = _c.DictWriter(f, fieldnames=list(attrs3[0].keys()))
            w.writeheader()
            w.writerows(attrs3)
    
    # T7: 偏差追溯行号
    _, traces = count_rows("output/skew_trace.csv")
    valid = sum(1 for tr in traces
                if tr.get("skew_photo_row_in_csv", "") and
                int(tr["skew_photo_row_in_csv"]) > 1 and
                int(tr["skew_photo_row_in_csv"]) <= 1000)
    all_ok &= t(f"T7 每条追溯都有照片行号(阿敏能直接打开CSV跳转): {valid}/{len(traces)}",
                valid == len(traces) and len(traces) > 0)
    
    # T8: linked_photo_ids → normalized_photos.csv 对得上
    pid_set = {p["photo_id"] for p in photos if p.get("photo_id")}
    broken = 0
    for a in attrs:
        for pid in (a.get("linked_photo_ids") or "").split(","):
            pid = pid.strip()
            if pid and pid not in pid_set:
                broken += 1
    all_ok &= t(f"T8 归因关联的照片ID都能追到normalized_photos明细(维修照片→CSV)",
                broken == 0,
                f"断链ID数={broken}")
    
    print("\n" + "#"*60)
    final = "全部通过 🎉" if all_ok else "存在失败 ⚠️"
    print(f"# 测试结果：{final}")
    print("#"*60)
    return 0 if all_ok else 1

if __name__ == "__main__":
    sys.exit(run_all())
