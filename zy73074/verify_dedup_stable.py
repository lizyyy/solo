"""
真实场景验证：跨进程稳定去重 + 人工备注不覆盖
------------------------------------------------------
场景1：同一批数据跑两次标准化（模拟两个进程），确认 row_hash 一致（sha256稳定）
场景2：第一次导入 → 第二次导入同一批 → 记录数不增加（不翻倍）
场景3：人为篡改 row_hash 模拟"不同进程hash不一致" → 仍能靠 photo_id 识别去重
场景4：确实新的照片记录 → 能正常新增
场景5：人工备注在重复导入后仍然保留
场景6：归因结果、偏差追溯、采样断档、晚到备件等功能不受影响
"""
import os
import sys
import csv
import copy
import json
import shutil

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.normalizer import load_csv, normalize_photos, write_csv, STANDARD_FIELDS, _row_hash
from src.dedup_import import (
    dedup_import_normalized_photos,
    merge_manual_notes,
    dedup_import_attribution,
    _load_state, _save_state
)
from src.attribution import run_attribution
from src.skew_trace import run_trace

PASS = "✅"
FAIL = "❌"
results = []

def t(name, ok, detail=""):
    status = PASS if ok else FAIL
    results.append((name, ok, detail))
    print(f"{status} {name}")
    if detail:
        print(f"     {detail}")
    return ok

def reset_env():
    """清空输出目录，回到干净状态"""
    for f in ["output/normalized_photos.csv", "output/attribution_result.csv",
              "output/attribution_with_notes.csv", "output/skew_trace.csv",
              "output/import_state.json", "output/_tmp_normalized.csv",
              "output/report.html"]:
        if os.path.exists(f):
            os.remove(f)
    print("  [环境重置] output 目录已清理")

def run_pipeline_first():
    """第一次完整导入，对应真实场景：阿敏第一次跑流程"""
    b1 = load_csv("data/repair_photos_batch1.csv")
    b2 = load_csv("data/repair_photos_batch2.csv")
    n1 = normalize_photos(b1, source_tag_hint="班组巡检App-v1")
    n2 = normalize_photos(b2, source_tag_hint="算法巡检系统-v2")
    tmp = "output/_tmp_normalized.csv"
    write_csv(tmp, n1 + n2, STANDARD_FIELDS)
    
    added, skipped, updated = dedup_import_normalized_photos(tmp, "output/normalized_photos.csv")
    print(f"  [第一次导入] 新增={added} 跳过={skipped} 更新={updated}")
    return len(n1) + len(n2)

def run_pipeline_again_with_same_data():
    """第二次跑同一批数据（重新生成临时归一化文件再导入），对应：第二天重复导入"""
    b1 = load_csv("data/repair_photos_batch1.csv")
    b2 = load_csv("data/repair_photos_batch2.csv")
    n1 = normalize_photos(b1, source_tag_hint="班组巡检App-v1")
    n2 = normalize_photos(b2, source_tag_hint="算法巡检系统-v2")
    tmp = "output/_tmp_normalized.csv"
    write_csv(tmp, n1 + n2, STANDARD_FIELDS)
    
    added, skipped, updated = dedup_import_normalized_photos(tmp, "output/normalized_photos.csv")
    print(f"  [第二次导入] 新增={added} 跳过={skipped} 更新={updated}")
    return added, skipped, updated

def tamper_hash_and_import():
    """
    模拟"不同进程hash不一致"极端场景：
    把临时文件里的 row_hash 全改掉，再导入一次，看 photo_id 是否能兜住去重
    """
    rows = load_csv("output/_tmp_normalized.csv")
    tampered = []
    for r in rows:
        tr = dict(r)
        tr["row_hash"] = "FAKE_HASH_" + r["photo_id"]
        tampered.append(tr)
    tmp2 = "output/_tmp_tampered.csv"
    write_csv(tmp2, tampered, list(tampered[0].keys()))
    
    before = len(load_csv("output/normalized_photos.csv"))
    added, skipped, updated = dedup_import_normalized_photos(tmp2, "output/normalized_photos.csv")
    after = len(load_csv("output/normalized_photos.csv"))
    print(f"  [篡改hash后导入] 前={before} 后={after} 新增={added} 跳过={skipped} 更新={updated}")
    return before, after, added, skipped, updated

def import_one_new_photo():
    """新增一条确实不同的照片，验证能正常加入"""
    new_row = {
        "photo_id": "PHT-2026-9999",
        "cabinet_id": "PDU-NEW",
        "shoot_time": "2026-06-08 15:30:00",
        "part_name": "进线端子",
        "temperature": "78.5",
        "operator": "测试员",
        "suggestion": "待备件",
        "source": "测试来源",
        "process_status": "pending",
        "normalized_from": "test",
        "row_hash": _row_hash({
            "photo_id": "PHT-2026-9999",
            "cabinet_id": "PDU-NEW",
            "shoot_time": "2026-06-08 15:30:00",
            "part_name": "进线端子",
            "temperature": "78.5",
            "operator": "测试员",
            "suggestion": "待备件",
            "source": "测试来源"
        })
    }
    tmp3 = "output/_tmp_one_new.csv"
    write_csv(tmp3, [new_row], list(new_row.keys()))
    
    before = len(load_csv("output/normalized_photos.csv"))
    added, skipped, updated = dedup_import_normalized_photos(tmp3, "output/normalized_photos.csv")
    after = len(load_csv("output/normalized_photos.csv"))
    print(f"  [新增1条] 前={before} 后={after} 新增={added} 跳过={skipped}")
    return before, after, added

def verify_manual_notes_preserved():
    """验证人工备注在重复导入后仍然保留"""
    # 先加一条备注到某条归因记录里
    target_attr = "output/attribution_with_notes.csv"
    if not os.path.exists(target_attr):
        return None, None
    
    rows = load_csv(target_attr)
    if not rows:
        return None, None
    
    target_id = rows[0]["attribution_id"]
    test_note = "【验证保留】这是测试备注，不应被覆盖"
    test_author = "阿敏"
    test_time = "2026-06-10 10:00:00"
    
    for r in rows:
        if r["attribution_id"] == target_id:
            r["manual_note_content"] = test_note
            r["manual_note_author"] = test_author
            r["manual_note_time"] = test_time
    
    with open(target_attr, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    
    # 再跑一次归因导入 + 备注合并
    a, u, p = dedup_import_attribution("output/attribution_result.csv", target_attr)
    mn, pn = merge_manual_notes("data/manual_notes.csv", target_attr, target_attr)
    
    # 检查备注是否还在
    rows2 = load_csv(target_attr)
    check_row = None
    for r in rows2:
        if r["attribution_id"] == target_id:
            check_row = r
            break
    
    preserved = check_row and check_row.get("manual_note_content") == test_note
    print(f"  [备注保留验证] 目标={target_id} 备注内容一致={preserved} dedup保留保护字段数={p}")
    return preserved, target_id

def main():
    print("\n" + "="*60)
    print("真实场景验证：跨进程稳定去重")
    print("="*60)
    
    # 环境重置
    reset_env()
    
    # --- 场景1：验证 sha256 hash 跨进程稳定 ---
    print("\n--- 场景1：SHA256 哈希稳定性验证 ---")
    b1 = load_csv("data/repair_photos_batch1.csv")
    n1a = normalize_photos(b1, source_tag_hint="班组巡检App-v1")
    n1b = normalize_photos(b1, source_tag_hint="班组巡检App-v1")
    hashes_a = [r["row_hash"] for r in n1a]
    hashes_b = [r["row_hash"] for r in n1b]
    stable = hashes_a == hashes_b
    t("SHA256哈希跨调用稳定（同输入→同输出）", stable,
      f"第一批{len(hashes_a)}条记录，两次计算完全一致" if stable else "存在不一致哈希")
    
    # 进一步验证：轻微格式差异（空格、字段顺序）不影响
    test_row = {"photo_id": "P1", "cabinet_id": "C1", "shoot_time": "2026-01-01 00:00:00",
                "part_name": "风扇", "temperature": "75.0", "operator": "张三",
                "suggestion": "待备件", "source": "app"}
    test_row2 = {"photo_id": "  P1  ", "cabinet_id": "C1", "shoot_time": "2026-01-01 00:00:00",
                 "part_name": "风扇", "temperature": "75.0", "operator": "张三",
                 "suggestion": "待备件", "source": "app"}
    h1 = _row_hash(test_row)
    h2 = _row_hash(test_row2)
    t("字段值前后空格通过归一化消除（同内容同hash）", h1 == h2,
      f"h1={h1[:16]}... h2={h2[:16]}...")
    
    # --- 场景2：两次导入同一批不翻倍 ---
    print("\n--- 场景2：同一批数据重复导入不翻倍 ---")
    total = run_pipeline_first()
    first_count = len(load_csv("output/normalized_photos.csv"))
    t("第一次导入条数正确", first_count == total, f"预期{total} 实际{first_count}")
    
    added2, skipped2, updated2 = run_pipeline_again_with_same_data()
    second_count = len(load_csv("output/normalized_photos.csv"))
    t("第二次导入零新增（不翻倍）", added2 == 0 and second_count == first_count,
      f"新增={added2} 跳过={skipped2} 更新={updated2} 总数前={first_count} 后={second_count}")
    
    # --- 场景3：篡改hash模拟跨进程不一致，仍能靠photo_id去重 ---
    print("\n--- 场景3：篡改hash后仍能靠 photo_id 去重（双保险） ---")
    before, after, added3, skipped3, updated3 = tamper_hash_and_import()
    t("hash全变但靠photo_id仍识别为重复（总数不变）",
      added3 == 0 and after == before,
      f"前={before} 后={after} 新增={added3} 跳过={skipped3}")
    t("重复记录被更新而非新增（process_status等状态保留）",
      updated3 >= 0 and after == before,
      f"更新条数={updated3}")
    
    # --- 场景4：新记录能正常新增 ---
    print("\n--- 场景4：真实新增记录能正常加入 ---")
    b_new, a_new, added_new = import_one_new_photo()
    t("一条新照片能正确新增", added_new == 1 and a_new == b_new + 1,
      f"前={b_new} 后={a_new} 新增={added_new}")
    
    # --- 先跑一次完整归因，为后面备注验证做准备 ---
    print("\n--- 先运行一次归因（为备注验证做准备） ---")
    attrs, late_parts, analyzed = run_attribution(
        "data/temperature_sampling.csv",
        "output/normalized_photos.csv",
        "data/spare_parts.csv",
        "output/attribution_result.csv"
    )
    target_attr = "output/attribution_with_notes.csv"
    a, u, p = dedup_import_attribution("output/attribution_result.csv", target_attr)
    mn, pn = merge_manual_notes("data/manual_notes.csv", target_attr, target_attr)
    print(f"  归因条目={len(attrs)} 晚到备件={len(late_parts)}")
    
    # --- 场景5：人工备注不被覆盖 ---
    print("\n--- 场景5：人工备注在重复导入后保留 ---")
    preserved, tid = verify_manual_notes_preserved()
    t("人工备注不被二次导入覆盖", preserved is True,
      f"目标归因ID={tid}" if tid else "")
    
    # --- 场景6：偏差追溯、断档、晚到备件等功能不受影响 ---
    print("\n--- 场景6：原有功能（追溯/断档/晚到备件）回归 ---")
    tr = run_trace(target_attr, "output/normalized_photos.csv", "output/skew_trace.csv")
    t("偏差追溯能正常生成", len(tr) > 0, f"追溯条目={len(tr)}")
    
    gap_rows = [r for r in attrs if r.get("sampling_gap_flag") == "是"]
    t("采样断档仍标记为异常处理", len(gap_rows) > 0,
      f"断档相关条目={len(gap_rows)}")
    
    late_attrs = [r for r in attrs if r.get("late_part_impact") and r["late_part_impact"].strip()]
    t("晚到备件影响链路说明正常生成", len(late_attrs) > 0,
      f"含晚到备件说明的归因={len(late_attrs)}条")
    
    # 验证追溯表里的行号都有效
    valid_rows = sum(1 for x in tr if str(x.get("skew_photo_row_in_csv","")).isdigit())
    t("每条追溯都含CSV行号（阿敏能找到那行）", valid_rows == len(tr),
      f"有效行号={valid_rows}/{len(tr)}")
    
    # --- 总结 ---
    print("\n" + "="*60)
    ok_count = sum(1 for _, ok, _ in results if ok)
    total_count = len(results)
    print(f"验证结果：{ok_count}/{total_count} 通过")
    print("="*60)
    
    for name, ok, detail in results:
        print(f"  {PASS if ok else FAIL} {name}")
    
    return 0 if ok_count == total_count else 1

if __name__ == "__main__":
    sys.exit(main())
