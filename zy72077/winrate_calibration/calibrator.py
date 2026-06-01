from __future__ import annotations
import math
from datetime import datetime, timezone
from typing import Any

FIELD_ALIASES = {
    "match_id": ["match_id", "局编号", "对局ID", "局ID", "match_id(旧)"],
    "player_id": ["player_id", "玩家ID", "用户ID", "player_id(旧表)"],
    "raw_winrate": ["raw_winrate", "原始胜率", "胜率", "win_rate", "胜率(未校准)"],
    "match_count": ["match_count", "对局数", "场次", "games_played", "对局数(业务表)"],
    "avg_opponent_winrate": ["avg_opponent_winrate", "对手平均胜率", "对手胜率", "opp_wr"],
    "skill_gap": ["skill_gap", "技能差", "段位差", "skill_diff"],
    "source": ["source", "来源", "数据来源", "src"],
    "notes": ["notes", "备注", "乱备注", "说明", "备注(参数表)"],
    "calibration_method": ["calibration_method", "校准方式", "口径", "校准口径", "旧口径"],
    "old_calibrated_winrate": ["old_calibrated_winrate", "旧校准胜率", "历史校准值", "校准后胜率(旧)"],
}

MIN_MATCH_COUNT = 30
REGRESSION_FACTOR = 0.3
WINRATE_CEILING = 0.95
WINRATE_FLOOR = 0.05


def resolve_field(row: dict[str, Any], canonical: str) -> tuple[Any, str | None]:
    aliases = FIELD_ALIASES.get(canonical, [canonical])
    for alias in aliases:
        if alias in row:
            return row[alias], alias
    return None, None


def parse_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        cleaned = str(value).strip().replace("%", "")
        result = float(cleaned)
        if result > 1.0 and result <= 100.0:
            result = result / 100.0
        return result
    except (ValueError, TypeError):
        return None


def parse_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(float(str(value).strip()))
    except (ValueError, TypeError):
        return None


def clamp_winrate(wr: float) -> float:
    return max(WINRATE_FLOOR, min(WINRATE_CEILING, wr))


def calibrate_record(row: dict[str, Any]) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()

    raw_winrate_val, raw_wr_field = resolve_field(row, "raw_winrate")
    match_count_val, mc_field = resolve_field(row, "match_count")
    match_id_val, mid_field = resolve_field(row, "match_id")
    player_id_val, pid_field = resolve_field(row, "player_id")
    avg_opp_wr_val, opp_field = resolve_field(row, "avg_opponent_winrate")
    skill_gap_val, sg_field = resolve_field(row, "skill_gap")
    source_val, src_field = resolve_field(row, "source")
    notes_val, notes_field = resolve_field(row, "notes")
    cal_method_val, cm_field = resolve_field(row, "calibration_method")
    old_cal_wr_val, ocw_field = resolve_field(row, "old_calibrated_winrate")

    original_fields = {k: v for k, v in row.items()}

    raw_wr = parse_float(raw_winrate_val)
    mc = parse_int(match_count_val)
    avg_opp_wr = parse_float(avg_opp_wr_val)
    sg = parse_float(skill_gap_val)
    old_cal_wr = parse_float(old_cal_wr_val)

    steps = []

    if raw_wr is None:
        steps.append(f"原始胜率字段({raw_wr_field or '未找到'})值'{raw_winrate_val}'无法解析为数值")
        if old_cal_wr is not None:
            steps.append(f"存在旧口径校准值({ocw_field})={old_cal_wr}，暂用旧值作为校准结果")
            return _build_result(
                row, original_fields, old_cal_wr, "calibrated_from_old",
                steps, now, source_val or "参数表(旧口径)",
                mid_field, pid_field, raw_wr_field, mc_field,
                match_id_val, player_id_val, raw_wr, mc
            )
        steps.append("无旧口径校准值可回退，标记为需人工确认")
        return _build_result(
            row, original_fields, None, "needs_manual_review",
            steps, now, source_val or "未知",
            mid_field, pid_field, raw_wr_field, mc_field,
            match_id_val, player_id_val, raw_wr, mc,
            skip_reason="原始胜率无法解析且无旧口径值"
        )

    steps.append(f"读取原始胜率: {raw_wr}(来自字段'{raw_wr_field}')")

    if avg_opp_wr is not None:
        steps.append(f"读取对手平均胜率: {avg_opp_wr}(来自字段'{opp_field}')")
    else:
        steps.append(f"对手平均胜率字段({opp_field or '未找到'})缺失，将跳过对手强度修正")

    if mc is not None:
        steps.append(f"读取对局数: {mc}(来自字段'{mc_field}')")
    else:
        steps.append(f"对局数字段({mc_field or '未找到'})缺失，无法进行置信度回归")

    if mc is not None and mc < MIN_MATCH_COUNT:
        steps.append(
            f"对局数{mc} < 最低要求{MIN_MATCH_COUNT}，"
            f"执行回归系数{(1 - REGRESSION_FACTOR) * 100:.0f}%→50%，"
            f"原因: 样本不足时胜率波动大，向0.5回归以降低过拟合风险"
        )
        calibrated = REGRESSION_FACTOR * raw_wr + (1 - REGRESSION_FACTOR) * 0.5
    else:
        calibrated = raw_wr
        if mc is not None:
            steps.append(f"对局数{mc} >= {MIN_MATCH_COUNT}，无需回归修正")
        else:
            steps.append("对局数缺失，直接使用原始胜率（置信度未知，建议补充）")

    if avg_opp_wr is not None and calibrated is not None:
        opponent_adjustment = (avg_opp_wr - 0.5) * 0.2
        calibrated = calibrated + opponent_adjustment
        direction = "上调" if opponent_adjustment > 0 else "下调"
        steps.append(
            f"对手强度修正: 对手平均胜率{avg_opp_wr} vs 基准0.5，"
            f"偏差{avg_opp_wr - 0.5:+.3f}，{direction}{abs(opponent_adjustment):.4f}，"
            f"原因: 面对高于平均的对手时实际能力被低估，反之被高估"
        )

    if sg is not None and calibrated is not None:
        skill_adjustment = sg * 0.05
        calibrated = calibrated + skill_adjustment
        direction = "上调" if skill_adjustment > 0 else "下调"
        steps.append(
            f"技能差修正: 技能差{sg:+.2f}，{direction}{abs(skill_adjustment):.4f}，"
            f"原因: 段位差反映匹配偏移，正差表示被低估需上调"
        )

    if calibrated is not None:
        before_clamp = calibrated
        calibrated = clamp_winrate(calibrated)
        if calibrated != before_clamp:
            steps.append(
                f"裁剪: {before_clamp:.4f} → {calibrated:.4f}，"
                f"原因: 胜率范围限制在[{WINRATE_FLOOR}, {WINRATE_CEILING}]"
            )
    else:
        calibrated = raw_wr
        steps.append("校准计算未生效，回退使用原始胜率")

    status = "calibrated"
    if mc is not None and mc < MIN_MATCH_COUNT:
        status = "calibrated_low_confidence"
        steps.append(f"最终状态: 校准完成但置信度低(仅{mc}局)，建议达到{MIN_MATCH_COUNT}局后复算")
    elif mc is None:
        status = "calibrated_unknown_confidence"
        steps.append("最终状态: 校准完成但缺少对局数，置信度未知")
    else:
        steps.append(f"最终状态: 校准完成，对局数{mc} >= {MIN_MATCH_COUNT}，置信度充足")

    return _build_result(
        row, original_fields, calibrated, status,
        steps, now, source_val or "未知",
        mid_field, pid_field, raw_wr_field, mc_field,
        match_id_val, player_id_val, raw_wr, mc
    )


def _build_result(
    row: dict[str, Any],
    original_fields: dict[str, Any],
    calibrated_winrate: float | None,
    status: str,
    steps: list[str],
    processed_at: str,
    source: str,
    mid_field: str | None,
    pid_field: str | None,
    raw_wr_field: str | None,
    mc_field: str | None,
    match_id_val: Any,
    player_id_val: Any,
    raw_wr: float | None,
    mc: int | None,
    skip_reason: str | None = None,
) -> dict[str, Any]:
    judgment_process = " | ".join(steps)

    result = dict(row)
    result["calibrated_winrate"] = (
        round(calibrated_winrate, 6) if calibrated_winrate is not None else None
    )
    result["calibration_status"] = status
    result["judgment_process"] = judgment_process
    result["data_source"] = source
    result["processed_at"] = processed_at
    result["original_fields_json"] = str(original_fields)

    if skip_reason:
        result["skip_reason"] = skip_reason

    return result
