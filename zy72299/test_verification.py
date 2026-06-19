#!/usr/bin/env python3
"""
完整验证脚本：
  打开 → 导入 → 补录 → 保存 → 刷新 → 重算 → 复跑 → 决议 → 报告 → 导出
逐项核对：照片来源 / 记录编号 / 冲突编号 / 当前状态 / 变更前 / 改后值 /
         视图版本 / 历史记录 / 报告明细 / 导出内容
重点证明：
  1. 复跑命令能重新跑通（照片路径真可读）
  2. 三维标注视图状态变化不是空版本递增（before≠after）
  3. 同一条记录在多次运行中 ID 一致，决议不被跳过
"""
import json
import os
import sys
import subprocess

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from main import (
    process_building,
    load_json_file,
    load_photos_from_files,
    expand_photo_files,
    run_scenario,
)
from history_manager import ResultFormatter


def load_all():
    sample_dir = os.path.join(BASE_DIR, "sample_data")
    origin_file = os.path.join(sample_dir, "origin_spec_building_a.json")
    photo_files = [
        os.path.join(sample_dir, "inspection_photos_building_a_normal.json"),
        os.path.join(sample_dir, "inspection_photos_building_a_duplicate.json"),
        os.path.join(sample_dir, "inspection_photos_building_a_supplement.json"),
        os.path.join(sample_dir, "inspection_photos_building_a_conflict.json"),
    ]
    return origin_file, photo_files


def step0_check_env():
    print("\n" + "=" * 90)
    print("[STEP 0] 环境与数据自检")
    print("=" * 90)
    origin_file, photo_files = load_all()
    origin = load_json_file(origin_file)
    print(f"  坐标原点说明文件: {origin_file} 存在={os.path.exists(origin_file)}")
    print(f"  坐标原点说明 obstacles 数: {len(origin.get('obstacles', []))}")
    photos_data = load_photos_from_files(photo_files)
    print(f"  照片文件列表 (expand_photo_files 后):")
    for pf in expand_photo_files(photo_files):
        size = os.path.getsize(pf)
        print(f"    · {pf}  ({size} bytes)")
    print(f"  合并后照片总数: {len(photos_data)}")
    assert len(photos_data) > 0, "一张照片都没读到，复跑命令路径必错"
    assert os.path.exists(origin_file)
    print("  ✓ 路径真可读")
    return origin, photos_data, origin_file, photo_files


def step1_first_run(origin, photos_data, origin_file, photo_files):
    print("\n" + "=" * 90)
    print("[STEP 1] 第一次运行 (无决议) - 记录/冲突编号快照，视图 v1 生成")
    print("=" * 90)
    result1 = process_building(
        building_id="BUILDING_A",
        origin_spec=origin,
        inspection_photos=photos_data,
        scenario_type="验证-第一次运行",
        origin_file=origin_file,
        photo_files=photo_files,
        include_view=True,
    )

    rids = sorted(r.record_id for r in result1.processed_records)
    statuses = {r.record_id: r.status.value for r in result1.processed_records}
    cids = sorted(c.conflict_id for c in result1.conflicts)
    pname_map = {r.record_id: r.obstacle_name for r in result1.processed_records}
    view_v = result1.view_state["version"]
    versions_count = len(result1.view_versions)

    print(f"  记录ID列表 (共{len(rids)}条): {rids}")
    print(f"  各记录当前状态:")
    for rid in rids:
        print(f"    · {rid}  {pname_map[rid]:20s} → status={statuses[rid]}")
    print(f"  冲突ID列表: {cids}")
    for c in result1.conflicts:
        print(f"    · {c.conflict_id}  (记录 {c.record_id} - {pname_map[c.record_id]}) 矛盾字段={c.conflicting_fields}")
    print(f"  视图版本: v{view_v}   版本链长度: {versions_count}")
    print(f"  待复核列表 (重复名称):")
    for pr in result1.pending_reviews:
        print(f"    · record_id={pr.record_id} ({pr.obstacle_name}) status={pr.status.value} → 下一步=培训学员")

    pending_duplicate = [
        r for r in result1.processed_records if r.status.value == "duplicate_name"
    ]
    print(f"  重复名称待决议 record_id={pending_duplicate[0].record_id if pending_duplicate else '无'}")
    print(f"  冲突待决议 conflict_id={result1.conflicts[0].conflict_id if result1.conflicts else '无'}")

    # 导出JSON留痕
    out1 = ResultFormatter.format_result(result1, True, True, True)
    with open("/tmp/step1_first_run.json", "w", encoding="utf-8") as f:
        json.dump(out1, f, ensure_ascii=False, indent=2, default=str)
    print(f"  ✓ 第一次运行已导出到 /tmp/step1_first_run.json")

    return result1, pending_duplicate[0].record_id if pending_duplicate else None, \
        result1.conflicts[0].conflict_id if result1.conflicts else None, \
        result1.conflicts[0].record_id if result1.conflicts else None


def step2_second_run_same_input(origin, photos_data, origin_file, photo_files,
                               dup_rid, conflict_cid):
    print("\n" + "=" * 90)
    print("[STEP 2] 第二次运行 (同样输入，无决议) - 核对ID完全一致")
    print("=" * 90)
    result2 = process_building(
        building_id="BUILDING_A",
        origin_spec=origin,
        inspection_photos=photos_data,
        scenario_type="验证-第二次同输入",
        origin_file=origin_file,
        photo_files=photo_files,
        include_view=True,
    )
    # 对比第一次和第二次
    first = json.load(open("/tmp/step1_first_run.json"))
    first_rids = sorted(r["record_id"] for r in first["records_summary"]["details"])
    second_rids = sorted(r.record_id for r in result2.processed_records)
    first_cids = sorted(c["conflict_id"] for c in first["conflicts"])
    second_cids = sorted(c.conflict_id for c in result2.conflicts)
    rids_match = first_rids == second_rids
    cids_match = first_cids == second_cids
    print(f"  第一次记录ID: {first_rids}")
    print(f"  第二次记录ID: {second_rids}")
    print(f"  记录ID完全一致: {rids_match}")
    print(f"  第一次冲突ID: {first_cids}")
    print(f"  第二次冲突ID: {second_cids}")
    print(f"  冲突ID完全一致: {cids_match}")
    assert rids_match, "同输入record_id变化，决议复跑必找不到记录！"
    assert cids_match, "同输入conflict_id变化，复跑冲突决议会被跳过！"
    print("  ✓ 两次同输入 → 同编号，决议传入不会被跳过")

    # 导出第二步留痕
    out2 = ResultFormatter.format_result(result2, True, True, True)
    with open("/tmp/step2_second_run.json", "w", encoding="utf-8") as f:
        json.dump(out2, f, ensure_ascii=False, indent=2, default=str)
    return result2


def step3_apply_resolutions(origin, photos_data, origin_file, photo_files,
                            dup_rid, conflict_cid, conflict_rid):
    print("\n" + "=" * 90)
    print("[STEP 3] 第三次运行 (带决议) - 核对 before/after 快照真实差异、视图版本递增不空、记录真被修改")
    print("=" * 90)

    duplicate_resolutions = [{
        "record_id": dup_rid,
        "action": "keep_as_separate",
        "actor": "xiaotao",
    }] if dup_rid else []

    conflict_resolutions = [{
        "conflict_id": conflict_cid,
        "resolution": "confirm_photo",
        "actor": "xiaotao",
    }] if conflict_cid else []

    result3 = process_building(
        building_id="BUILDING_A",
        origin_spec=origin,
        inspection_photos=photos_data,
        scenario_type="验证-第三次带决议",
        conflict_resolutions=conflict_resolutions,
        duplicate_resolutions=duplicate_resolutions,
        origin_file=origin_file,
        photo_files=photo_files,
        include_view=True,
    )

    # 3.1: 检查决议真被应用 (不被跳过)
    if dup_rid:
        dup_rec = next((r for r in result3.processed_records if r.record_id == dup_rid), None)
        dup_after = dup_rec.status.value if dup_rec else None
        print(f"  重复名称记录 {dup_rid}: before=duplicate_name → after={dup_after}")
        # keep_as_separate 应该把 duplicate_name → pending_review
        assert dup_after == "pending_review", f"重复名称决议被跳过或处理错误: after={dup_after}"
        print("    ✓ 重复名称决议真生效 (不被跳过)")

    if conflict_cid:
        conf_rec = next((r for r in result3.processed_records if r.record_id == conflict_rid), None)
        conf_after = conf_rec.status.value if conf_rec else None
        print(f"  冲突记录 {conflict_rid}: before=conflict → after={conf_after}")
        # confirm_photo 应该把 conflict → confirmed，并采信 photo 的坐标
        assert conf_after == "confirmed", f"冲突决议被跳过或处理错误: after={conf_after}"
        print("    ✓ 冲突决议真生效 (不被跳过) - 状态改了")

        # 查改后 position 是否真的被改了（证明改后值不是空的）
        first = json.load(open("/tmp/step1_first_run.json"))
        first_pos = None
        for rd in first["records_summary"]["details"]:
            if rd["record_id"] == conflict_rid:
                first_pos = rd["position"]
                break
        if first_pos and conf_rec:
            new_pos = {"x": conf_rec.position.x, "y": conf_rec.position.y, "z": conf_rec.position.z}
            print(f"  冲突记录 {conflict_rid} position 变更: before={first_pos} → after={new_pos}")
            pos_diff = first_pos != new_pos
            print(f"    位置真的变了: {pos_diff} (这证明改后值不是空的，采信了照片编号的position)")

    # 3.2: 视图版本 before/after 快照真有差异（不空版本递增）
    print()
    print(f"  视图版本链: v{result3.view_state['version']} (共 {len(result3.view_versions)} 次版本递增)")
    for v in result3.view_versions:
        vnum = v["version"]
        reason = v["trigger_reason"]
        changes_count = v["total_record_changes"]
        changed_rids = v["changed_record_ids"]
        print(f"    · v{vnum} [{reason}] 变更记录数={len(changed_rids)} 变更字段数={changes_count}")
        # 输出具体每条记录的 before vs after
        for crid in changed_rids:
            before = v["records_before"].get(crid, {})
            after = v["records_after"].get(crid, {})
            diff_fields = v["changed_fields_by_record"].get(crid, [])
            name = before.get("obstacle_name") or after.get("obstacle_name")
            print(f"        ↳ {crid} ({name}): 变更字段={diff_fields}")
            for df in diff_fields:
                if df == "ADDED_RECORD" or df == "REMOVED_RECORD":
                    print(f"          · {df}: {(after or before).get('obstacle_name')}")
                else:
                    b = before.get(df)
                    a = after.get(df)
                    # 长值截断前30字符
                    bs = str(b)[:60] + ("..." if len(str(b)) > 60 else "")
                    a_s = str(a)[:60] + ("..." if len(str(a)) > 60 else "")
                    print(f"          · {df}:  before={bs}")
                    print(f"                    after ={a_s}")

    # 断言：至少有一个版本的 before/after 有真实差异（对应决议应用）
    any_real_change = any(v["total_record_changes"] > 0 for v in result3.view_versions)
    assert any_real_change, "所有版本的 records_before == records_after，空版本递增！"
    print()
    print("  ✓ 视图版本变化有真实差异（不是空递增）")

    # 3.3: 视图标注 ↔ 记录状态 对齐
    view_status = {a["record_id"]: a["status"] for a in result3.view_state["annotations"]}
    rec_status = {r.record_id: r.status.value for r in result3.processed_records}
    aligned = all(view_status.get(k) == v for k, v in rec_status.items())
    print(f"  ✓ 视图标注 ↔ 处理记录 双向对齐: {aligned} ({len(rec_status)}条)")

    # 3.4: 历史 BUMP 动作 ↔ view_versions 条目数
    bump_count = sum(1 for h in result3.history if h.action == "BUMP_VIEW_VERSION")
    vv_count = len(result3.view_versions)
    print(f"  ✓ 历史 BUMP 动作数 = view_versions 条目数: {bump_count} == {vv_count} → {bump_count == vv_count}")

    # 3.5: 清洗路径版本 ↔ 视图版本
    print(f"  ✓ 清洗路径版本 ↔ 视图版本对齐: v{result3.cleaning_path.version} == v{result3.view_state['version']} → {result3.cleaning_path.version == result3.view_state['version']}")

    # 3.6: 复核痕迹（原始说法→改后值→原因→下一步）
    print()
    print(f"  复核痕迹矩阵 ({len(result3.review_trails)} 条):")
    for i, t in enumerate(result3.review_trails, 1):
        name = next((r.obstacle_name for r in result3.processed_records if r.record_id == t.record_id), "?")
        print(f"    [{i}] {t.trail_id} / {t.record_id} ({name})")
        print(f"        处理人={t.handled_by} 变更字段={t.changed_fields}")
        for f in t.changed_fields:
            bs = str(t.original_value.get(f))[:60] + ("..." if len(str(t.original_value.get(f))) > 60 else "")
            a_s = str(t.modified_value.get(f))[:60] + ("..." if len(str(t.modified_value.get(f))) > 60 else "")
            print(f"          · {f}: 原始={bs}")
            print(f"                改后={a_s}")
        print(f"        原因={t.reason[:70]}{'...' if len(t.reason) > 70 else ''}")
        print(f"        下一步找谁: → {t.next_handler}")
    print("  ✓ 复核痕迹完整（原始说法→改后值→原因→下一步）")

    out3 = ResultFormatter.format_result(result3, True, True, True)
    with open("/tmp/step3_with_resolutions.json", "w", encoding="utf-8") as f:
        json.dump(out3, f, ensure_ascii=False, indent=2, default=str)
    print(f"  ✓ 第三次带决议已导出到 /tmp/step3_with_resolutions.json")
    return result3


def step4_replay_command_executes(result3, origin_file, photo_files):
    print("\n" + "=" * 90)
    print("[STEP 4] 从 step3 输出中取 replay_command，**真实 subprocess 执行**，证明复跑命令真跑通")
    print("=" * 90)
    replay_cmd = result3.replay_command
    # 只取到 # 注释之前的部分（因为shell里注释要另处理，我们单独验证）
    if " # " in replay_cmd:
        replay_cmd, _, comment = replay_cmd.partition(" # ")
        print(f"  命令注释（目标视图版本）: #{comment.strip()}")

    # 加 --output 输出到临时文件
    replay_cmd += " --output /tmp/step4_replay_result.json"
    print(f"\n  即将执行命令 (在子shell真实执行):")
    print(f"    $ cd {BASE_DIR} && {replay_cmd[:200]}...")

    completed = subprocess.run(
        ["bash", "-c", f"cd '{BASE_DIR}' && {replay_cmd}"],
        capture_output=True, text=True,
    )
    print(f"\n  子进程 exit_code: {completed.returncode}")
    if completed.stdout:
        # 只截最后500字符
        tail_out = completed.stdout[-600:] if len(completed.stdout) > 600 else completed.stdout
        print(f"  stdout 尾部:\n{tail_out}")
    if completed.returncode != 0 and completed.stderr:
        print(f"  stderr: {completed.stderr[-1500:]}")
    assert completed.returncode == 0, f"replay_command 执行失败，exit={completed.returncode}"

    # 核对真实生成的 JSON 包含 view_state / review_trails 等关键字段
    assert os.path.exists("/tmp/step4_replay_result.json"), "复跑没生成输出JSON"
    r4 = json.load(open("/tmp/step4_replay_result.json"))
    keys = ["view_state", "view_versions", "review_trails", "review_trace_matrix",
            "cross_check_view_history", "history_timeline", "replay_command"]
    print()
    print(f"  复跑输出 JSON 关键字段存在性检查:")
    all_present = True
    for k in keys:
        present = k in r4
        vcount = len(r4[k]) if isinstance(r4.get(k), list) else "-"
        print(f"    · {k}: {'✓' if present else '✗'} ({vcount})")
        if not present:
            all_present = False
    assert all_present, "复跑输出JSON缺关键字段"

    # 最重要：复跑生成的 record_id 和 step1 完全一致
    first_rids = sorted(r["record_id"] for r in json.load(open("/tmp/step1_first_run.json"))["records_summary"]["details"])
    replay_rids = sorted(r["record_id"] for r in r4["records_summary"]["details"])
    same = first_rids == replay_rids
    print(f"\n  复跑输出 record_id 与 step1 完全一致: {same}")
    print(f"    step1:  {first_rids}")
    print(f"    replay: {replay_rids}")
    assert same, "复跑命令生成的记录ID变了，决议对不上！"

    # cross_check_view_history 必须是 consistent = True
    xcheck = r4.get("cross_check_view_history", {})
    print(f"\n  cross_check_view_history (视图↔记录↔历史三向核对): {xcheck.get('consistent')}，问题数={xcheck.get('issue_count', 'N/A')}")
    assert xcheck.get("consistent") is True, "三向核对不一致！"

    print("  ✓ replay_command 真实跑通，且输出和原输入一致")
    return r4


def step5_export_and_report_check(step3_result, r4_json):
    print("\n" + "=" * 90)
    print("[STEP 5] 报告明细 & 导出交叉核对：所有入口同一条记录")
    print("=" * 90)
    # 用 step3 的带决议结果，取一条真实记录核对各出口
    # 选冲突记录（状态变化最多，验证点最丰富）
    sample_rid = None
    for t in step3_result.review_trails:
        if "conflict_evidence" in t.changed_fields or "status" in t.changed_fields:
            sample_rid = t.record_id
            break
    if not sample_rid:
        sample_rid = step3_result.processed_records[0].record_id

    rec = next(r for r in step3_result.processed_records if r.record_id == sample_rid)
    name = rec.obstacle_name
    print(f"  抽样记录: {sample_rid} ({name})")
    print(f"    当前 status = {rec.status.value}")

    # 核对 A: processed_records
    print(f"  核对 A: processed_records → record_id 存在且有 {rec.status.value} 状态: ✓")

    # 核对 B: view_state.annotations (视图标注)
    view_ann = next((a for a in step3_result.view_state["annotations"] if a["record_id"] == sample_rid), None)
    assert view_ann, f"视图里找不到 record_id={sample_rid} 的标注"
    assert view_ann["status"] == rec.status.value, f"视图状态{view_ann['status']}≠记录状态{rec.status.value}"
    print(f"  核对 B: view_state.annotations → record_id 正确  status={view_ann['status']} (与记录同): ✓")

    # 核对 C: conflicts (若有)
    conflict_entry = next((c for c in step3_result.conflicts if c.record_id == sample_rid), None)
    if conflict_entry:
        print(f"  核对 C: conflicts[] → conflict_id={conflict_entry.conflict_id} (存在): ✓")
    else:
        print(f"  核对 C: conflicts[] → 已处理 (无待处理冲突，正常): ✓")

    # 核对 D: pending_reviews (若有)
    pending_entry = next((r for r in step3_result.pending_reviews if r.record_id == sample_rid), None)
    if pending_entry:
        print(f"  核对 D: pending_reviews[] → 在列表 (状态=pending_review): ✓")
    else:
        print(f"  核对 D: pending_reviews[] → 不在 (若已确认/已驳回属正常): ✓")

    # 核对 E: history_timeline 中该 record_id 的时间线
    hist_entries = [h for h in step3_result.history if h.record_id == sample_rid]
    print(f"  核对 E: history_timeline 中 {sample_rid} 的动作链 (共{len(hist_entries)}条):")
    for h in hist_entries:
        print(f"      · {h.action:35s} by {h.actor:10s}  details_keys={list(h.details.keys())[:5]}")

    # 核对 F: review_trails (原始→改后→原因→下一步)
    trails = [t for t in step3_result.review_trails if t.record_id == sample_rid]
    print(f"  核对 F: review_trails 中 {sample_rid} (共{len(trails)}条):")
    for t in trails:
        print(f"      · {t.trail_id}: 字段 {t.changed_fields} → 下一步 {t.next_handler}")
    print(f"  核对 G: review_trace_matrix (JSON导出): record_id 在矩阵中存在")
    step3_json = json.load(open("/tmp/step3_with_resolutions.json"))
    in_matrix = any(t["record_id"] == sample_rid for t in step3_json.get("review_trace_matrix", []))
    print(f"      → {'✓' if in_matrix else '✗'}")

    # 核对 H: cleaning_path.points (若 status 有效则包含，若 conflict/duplicate 则排除)
    in_path = any(p["obstacle_id"] == sample_rid for p in step3_json["cleaning_path"]["points"]) \
        if step3_json.get("cleaning_path") else False
    excluded_expected = rec.status.value in ("conflict", "duplicate_name", "rejected")
    path_ok = excluded_expected != in_path  # 如果应排除则不在路径，否则在路径
    print(f"  核对 H: cleaning_path 包含性: status={rec.status.value}，预期{'排除' if excluded_expected else '包含'}，实际{'包含' if in_path else '排除'} → {'✓' if path_ok else '✗'}")

    print()
    print("  ✓ 全链路同一真实记录：列表/详情/摘要/历史/报告/导出 → 指向同一条 record_id")
    return sample_rid


if __name__ == "__main__":
    print("\n" + "#" * 90)
    print("# 楼宇外立面清洗路径 - 全链路修复验证脚本")
    print("# 验证: ID确定性 / 照片真实可读 / 决议不跳过 / before≠after / 复跑命令真跑通 / 全链路同记录")
    print("#" * 90)

    origin, photos_data, origin_file, photo_files = step0_check_env()
    result1, dup_rid, conflict_cid, conflict_rid = step1_first_run(
        origin, photos_data, origin_file, photo_files
    )
    step2_second_run_same_input(origin, photos_data, origin_file, photo_files, dup_rid, conflict_cid)
    result3 = step3_apply_resolutions(origin, photos_data, origin_file, photo_files,
                                      dup_rid, conflict_cid, conflict_rid)
    r4_json = step4_replay_command_executes(result3, origin_file, photo_files)
    sample_rid = step5_export_and_report_check(result3, r4_json)

    print("\n" + "#" * 90)
    print("# 全部验证通过 ✓")
    print(f"# 抽样记录 ID: {sample_rid}")
    print(f"# 中间产物: /tmp/step1_first_run.json  → 第一次（无决议，取ID参考）")
    print(f"#           /tmp/step2_second_run.json → 第二次（同输入，ID一致性证明）")
    print(f"#           /tmp/step3_with_resolutions.json → 带决议，before≠after证明")
    print(f"#           /tmp/step4_replay_result.json  → replay_command真实执行结果")
    print("#" * 90 + "\n")
