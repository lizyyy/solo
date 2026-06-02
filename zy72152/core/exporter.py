import csv
import io
from datetime import datetime


def export_public_list(spots, conflicts, merge_report, filename_prefix="公示清单"):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "序号", "点位名称", "路口名称", "地址", "小区名称",
        "错峰时段", "容量", "经度", "纬度",
        "数据时段", "来源", "来源详情", "备注",
        "审核状态", "冲突标记", "冲突原因",
    ])

    conflict_map = {}
    for c in conflicts:
        if c.点位id not in conflict_map:
            conflict_map[c.点位id] = []
        conflict_map[c.点位id].append(f"[{c.类型}]{c.冲突描述}")

    for idx, spot in enumerate(spots, 1):
        conflict_mark = ""
        conflict_reason = ""
        if spot.id in conflict_map:
            conflict_mark = "有冲突"
            conflict_reason = "；".join(conflict_map[spot.id])

        writer.writerow([
            idx,
            spot.点位名称,
            spot.路口名称,
            spot.地址,
            spot.小区名称,
            spot.时段,
            spot.容量,
            spot.经度,
            spot.纬度,
            spot.数据时段,
            spot.来源,
            spot.来源详情,
            spot.备注 + (f"；补录：{spot.补录备注}" if spot.补录备注 else ""),
            spot.审核状态,
            conflict_mark,
            conflict_reason,
        ])

    return output.getvalue()


def export_conflict_report(conflicts, filename_prefix="冲突报告"):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "序号", "冲突类型", "点位id", "台账id",
        "冲突描述", "建议动作",
        "证据A-字段", "证据A-值", "证据A-来源",
        "证据B-字段", "证据B-值", "证据B-来源",
        "状态", "处理备注",
    ])

    for idx, c in enumerate(conflicts, 1):
        writer.writerow([
            idx,
            c.类型,
            c.点位id,
            c.台账id,
            c.冲突描述,
            c.建议动作,
            c.证据A.get("字段", ""),
            c.证据A.get("值", ""),
            c.证据A.get("来源", ""),
            c.证据B.get("字段", ""),
            c.证据B.get("值", ""),
            c.证据B.get("来源", ""),
            c.状态,
            c.处理备注,
        ])

    return output.getvalue()


def export_diff_report(before_spots, after_spots, supplement_note=""):
    before_map = {s.id: s for s in before_spots}
    after_map = {s.id: s for s in after_spots}

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["变更类型", "点位id", "路口名称", "变更详情", "涉及老旧小区停车错峰"])

    for sid in after_map:
        if sid not in before_map:
            s = after_map[sid]
            writer.writerow(["新增", s.id, s.路口名称, f"新增点位：{s.点位名称 or s.路口名称}，容量{s.容量}，时段{s.时段}", "是"])
        else:
            before = before_map[sid]
            after = after_map[sid]
            diffs = []
            if before.容量 != after.容量:
                diffs.append(f"容量：{before.容量}→{after.容量}")
            if before.时段 != after.时段:
                diffs.append(f"时段：{before.时段}→{after.时段}")
            if before.备注 != after.备注:
                diffs.append(f"备注有更新")
            if before.补录备注 != after.补录备注:
                diffs.append(f"补录备注：{before.补录备注 or '无'}→{after.补录备注}")
            if diffs:
                writer.writerow(["变更", sid, after.路口名称, "；".join(diffs), "是"])

    for sid in before_map:
        if sid not in after_map:
            b = before_map[sid]
            writer.writerow(["删除", sid, b.路口名称, f"已删除点位：{b.点位名称 or b.路口名称}", "是"])

    if supplement_note:
        writer.writerow(["补录说明", "", "", f"补录备注：{supplement_note}", "是"])

    return output.getvalue()
