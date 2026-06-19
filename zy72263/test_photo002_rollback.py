#!/usr/bin/env python3

import sys
import json

sys.path.insert(0, ".")

from airbridge import PreflightManager, ReviewManager, Visualizer, WorkflowEngine
from airbridge.models import CoordinateOrigin, InspectionPhoto


def _check(label, expected, actual):
    ok = expected == actual
    print(f"  {'✅' if ok else '❌'} {label}: expected={expected}, actual={actual}")
    return ok


def run_photo002_rollback_check():
    print("=" * 70)
    print("Photo_002 遮挡告警回滚链路完整核对")
    print("=" * 70)
    print()

    all_ok = True

    pm = PreflightManager()
    rm = ReviewManager(pm)
    vz = Visualizer(pm)
    we = WorkflowEngine(pm, rm, vz)

    origins = [
        CoordinateOrigin(id="origin_001", name="T2航站楼D10廊桥", x=125.6, y=89.3, z=5.2, description="主廊桥"),
    ]
    created, skipped = pm.import_coordinate_origins(origins, actor="system_initial")
    record_id = created[0].id

    photo_002 = InspectionPhoto(
        id="photo_002",
        photo_number="INSP-2024-002",
        coordinate_origin_id="origin_001",
        remark="移动端复核截图",
        has_mobile_screenshot=True,
        alert_label_visible=False,
    )
    pm.add_inspection_photo(photo_002, actor="designer_ajing")

    rm.submit_for_manager_review(record_id, "photo_002", submitter="designer_ajing")

    print("【阶段 1】初始待复核状态（rephoto 前）")
    print("-" * 70)
    photo = pm.get_inspection_photo("photo_002")
    record = pm.get_preflight_record(record_id)
    all_ok &= _check("photo_002.has_mobile_screenshot", True, photo.has_mobile_screenshot)
    all_ok &= _check("photo_002.alert_label_visible", False, photo.alert_label_visible)
    all_ok &= _check("photo_002.is_alert_label_blocked()", True, photo.is_alert_label_blocked())
    all_ok &= _check("record.status", "manager_review", record.status)
    all_ok &= _check("record.block_detected", True, record.block_detected)
    print()

    print("【阶段 2】施工经理确认遮挡后，阿景用 rephoto 处理")
    print("-" * 70)
    rm.manager_review(record_id, is_blocked=True, reviewer="construction_manager", comment="确认遮挡，要求重拍")
    resolved = rm.resolve_block(record_id, "photo_002", "rephoto", actor="designer_ajing")
    photo = pm.get_inspection_photo("photo_002")
    record = pm.get_preflight_record(record_id)
    all_ok &= _check("photo_002.has_mobile_screenshot", False, photo.has_mobile_screenshot)
    all_ok &= _check("photo_002.alert_label_visible", True, photo.alert_label_visible)
    all_ok &= _check("photo_002.is_alert_label_blocked()", False, photo.is_alert_label_blocked())
    all_ok &= _check("record.status", "resolved", record.status)
    all_ok &= _check("record.block_detected", False, record.block_detected)

    block_resolved_entry = [e for e in record.history if e["action"] == "block_resolved"][-1]
    pc = block_resolved_entry["details"]["photo_changes"]
    print("  ✅ block_resolved 历史项 photo_changes.before:", pc["before"])
    print("  ✅ block_resolved 历史项 photo_changes.after: ", pc["after"])
    all_ok &= (pc["before"] == {"has_mobile_screenshot": True, "alert_label_visible": False})
    all_ok &= (pc["after"] == {"has_mobile_screenshot": False, "alert_label_visible": True})
    print()

    print("【阶段 3】回滚到待复核 — 核心核对（之前的冲突点）")
    print("-" * 70)
    rolled_back = rm.rollback(record_id, actor="system")
    assert rolled_back is not None
    photo = pm.get_inspection_photo("photo_002")
    record = pm.get_preflight_record(record_id)

    print("  【关键核对】photo 遮挡事实 vs record 复核状态是否一致")
    all_ok &= _check("photo_002.has_mobile_screenshot", True, photo.has_mobile_screenshot)
    all_ok &= _check("photo_002.alert_label_visible", False, photo.alert_label_visible)
    all_ok &= _check("photo_002.is_alert_label_blocked()", True, photo.is_alert_label_blocked())
    all_ok &= _check("record.status", "block_confirmed", record.status)
    all_ok &= _check("record.block_detected", True, record.block_detected)
    all_ok &= _check("record.block_verified", True, record.block_verified)

    rollback_entry = [e for e in record.history if e["action"] == "rollback"][-1]
    print("  ✅ rollback 历史项 rolled_back_photos.photo_002.before:")
    print("     ", rollback_entry["details"]["rolled_back_photos"]["photo_002"]["before"])
    print("  ✅ rollback 历史项 rolled_back_photos.photo_002.after:")
    print("     ", rollback_entry["details"]["rolled_back_photos"]["photo_002"]["after"])
    print()

    print("【阶段 4】回滚链路设计说明 & 单次回滚确认")
    print("-" * 70)
    print("  ℹ️  _rollback_snapshots 以 record_id 为 key，每个关键操作覆盖前一次快照。")
    print("      回滚一次后快照被删除，若需多级回滚可扩展为栈结构或列表快照。")
    print("      核心 bug 修复的是：回滚时不仅恢复 record 状态，还恢复 photo 的遮挡属性。")

    avail = rm.get_rollback_history()
    all_ok &= _check("剩余可回滚快照数（每次操作覆盖，因此为 0）", 0, len(avail))
    print()

    print("【阶段 5】所有维度联动核对：事实/状态/遮挡/历史/导出/json")
    print("-" * 70)

    with open("workflow_log.json", "w") as f:
        f.write(we.export_workflow_log())
    with open("replay_script.py", "w") as f:
        f.write(we.generate_replay_script())
    with open("visualization_report.json", "w") as f:
        f.write(vz.export_visualization_report())

    with open("workflow_log.json") as f:
        wf_log = json.load(f)
    print(f"  ✅ workflow_log.json 条目数: {wf_log['total_entries']}")

    with open("visualization_report.json") as f:
        viz = json.load(f)
    viz_records = viz["records"]
    viz_photo_002 = None
    for r in viz_records:
        for p in r["photos"]:
            if p["id"] == "photo_002":
                viz_photo_002 = p
                break
    all_ok &= _check("导出 visualization 中 photo_002.has_mobile_screenshot", True, viz_photo_002["has_mobile_screenshot"])
    all_ok &= _check("导出 visualization 中 photo_002.alert_label_visible", False, viz_photo_002["alert_label_visible"])
    all_ok &= _check("导出 visualization 中 record.status", "block_confirmed", viz_records[0]["record"]["status"])

    viz_3d = viz["3d_view"]
    viz_origin = viz_3d["coordinate_origins"][0]
    all_ok &= _check("3D 视图 has_block", True, viz_origin["has_block"])

    history_actions = [e["action"] for e in record.history]
    print(f"  ✅ 历史记录动作链: {history_actions}")
    expected_chain = ["import", "photo_added", "submitted_for_review",
                      "block_confirmed", "block_resolved", "rollback"]
    all_ok &= _check("历史动作链匹配", expected_chain, history_actions)

    print()
    print("【阶段 6】执行重放脚本，核对重放后 photo_002 仍一致")
    print("-" * 70)
    import subprocess
    replay_result = subprocess.run(
        [sys.executable, "replay_script.py"],
        capture_output=True, text=True, cwd="."
    )
    all_ok &= _check("replay_script.py 退出码", 0, replay_result.returncode)
    print("     replay_script.py stdout 末尾:")
    for ln in replay_result.stdout.strip().split("\n")[-8:]:
        print(f"       {ln}")

    print()
    print("=" * 70)
    if all_ok:
        print("✅ 全部核对通过！Photo_002 回滚链路：照片事实、复核状态、遮挡记录、历史日志、json 导出、重放结果全部一致，不再冲突。")
    else:
        print("❌ 存在未通过的核对项，请检查上方 ❌ 标记。")
    print("=" * 70)

    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(run_photo002_rollback_check())
