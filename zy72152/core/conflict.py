from .models import Conflict


def _parse_time_period(period_str):
    if not period_str or "-" not in period_str:
        return None, None
    parts = period_str.split("-")
    if len(parts) != 2:
        return None, None
    return parts[0].strip(), parts[1].strip()


def _time_ranges_overlap(s1, e1, s2, e2):
    try:
        return s1 < e2 and s2 < e1
    except Exception:
        return False


def detect_conflicts(spots, approval_records):
    conflicts = []

    for spot in spots:
        matched_records = [r for r in approval_records if r.路口名称 == spot.路口名称]
        if not matched_records:
            continue

        for rec in matched_records:
            if spot.容量 > rec.批准容量:
                conflict = Conflict(
                    类型="容量超限",
                    点位id=spot.id,
                    台账id=rec.id,
                    冲突描述=(
                        f"点位「{spot.点位名称 or spot.路口名称}」的容量为 {spot.容量} 个车位，"
                        f"但审批台账（文号 {rec.审批文号}）批准容量为 {rec.批准容量} 个车位，"
                        f"超出 {spot.容量 - rec.批准容量} 个车位。"
                        f"请核实实际车位数量，或申请追加审批。"
                    ),
                    建议动作="核实实际车位数，若确实超限则需补充审批或缩减开放车位数",
                    证据A={"字段": "导入数据-容量", "值": spot.容量, "来源": spot.来源详情},
                    证据B={"字段": "审批台账-批准容量", "值": rec.批准容量, "来源": f"审批文号 {rec.审批文号}，日期 {rec.审批日期}"},
                )
                conflicts.append(conflict)

            spot_start, spot_end = _parse_time_period(spot.时段)
            rec_start, rec_end = _parse_time_period(rec.批准时段)
            if spot_start and spot_end and rec_start and rec_end:
                if not _time_ranges_overlap(spot_start, spot_end, rec_start, rec_end):
                    conflict = Conflict(
                        类型="时段冲突",
                        点位id=spot.id,
                        台账id=rec.id,
                        冲突描述=(
                            f"点位「{spot.点位名称 or spot.路口名称}」的错峰时段为 {spot.时段}，"
                            f"但审批台账（文号 {rec.审批文号}）批准时段为 {rec.批准时段}，"
                            f"两者不重叠。可能是新增时段尚未审批，或原时段已调整。"
                            f"请确认实际执行时段并补充审批材料。"
                        ),
                        建议动作="确认实际执行时段，若已变更需补办审批或更新台账",
                        证据A={"字段": "导入数据-时段", "值": spot.时段, "来源": spot.来源详情},
                        证据B={"字段": "审批台账-批准时段", "值": rec.批准时段, "来源": f"审批文号 {rec.审批文号}，日期 {rec.审批日期}"},
                    )
                    conflicts.append(conflict)
                elif spot.时段 != rec.批准时段:
                    conflict = Conflict(
                        类型="时段差异",
                        点位id=spot.id,
                        台账id=rec.id,
                        冲突描述=(
                            f"点位「{spot.点位名称 or spot.路口名称}」的错峰时段为 {spot.时段}，"
                            f"审批台账（文号 {rec.审批文号}）批准时段为 {rec.批准时段}，"
                            f"两者有部分重叠但不完全一致，请核实以哪个为准。"
                        ),
                        建议动作="核实两方时段，以审批台账为准需更新导入数据，以实际为准需补办审批",
                        证据A={"字段": "导入数据-时段", "值": spot.时段, "来源": spot.来源详情},
                        证据B={"字段": "审批台账-批准时段", "值": rec.批准时段, "来源": f"审批文号 {rec.审批文号}，日期 {rec.审批日期}"},
                    )
                    conflicts.append(conflict)

            if spot.容量 != rec.批准容量 and spot.容量 <= rec.批准容量:
                conflict = Conflict(
                    类型="数据差异",
                    点位id=spot.id,
                    台账id=rec.id,
                    冲突描述=(
                        f"点位「{spot.点位名称 or spot.路口名称}」导入容量为 {spot.容量}，"
                        f"审批台账（文号 {rec.审批文号}）批准容量为 {rec.批准容量}，"
                        f"两者不一致（导入数据未超限），请核实。"
                    ),
                    建议动作="核实实际开放车位数，确认以哪方数据为准",
                    证据A={"字段": "导入数据-容量", "值": spot.容量, "来源": spot.来源详情},
                    证据B={"字段": "审批台账-批准容量", "值": rec.批准容量, "来源": f"审批文号 {rec.审批文号}，日期 {rec.审批日期}"},
                )
                conflicts.append(conflict)

    return conflicts


def detect_capacity_overflow(spots):
    overflow_items = []
    for spot in spots:
        if spot.容量 <= 0:
            overflow_items.append({
                "点位id": spot.id,
                "点位名称": spot.点位名称 or spot.路口名称,
                "问题": f"「{spot.点位名称 or spot.路口名称}」容量为 {spot.容量}，数据可能缺失或异常，请检查原始材料。",
                "建议": "核实原始记录，确认该点位是否已取消或数据录入有误",
            })
    return overflow_items
