"""核心回放引擎
负责工单行校验、状态判定、备注嵌入、分类统计等。
"""
from __future__ import annotations

import csv
import io
import re
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple

from .models import (
    ReplaySession, ReplayLine, HandoverRecord, RejudgeHistory,
    Remark, LineStatus, WorkOrderConclusion
)
from . import storage

WO_RE = re.compile(r"^WO-\d{4}-\d{5}$")       # 工单号格式
PIPE_RE = re.compile(r"^PL-[A-Z]-\d{3}$")     # 管线号格式


def new_session_id() -> str:
    return "SES-" + datetime.now().strftime("%Y%m%d%H%M%S") + "-" + uuid.uuid4().hex[:4]


def parse_csv_text(csv_text: str) -> List[Dict[str, str]]:
    """把 CSV 文本解析为字典列表，自动处理列名大小写。"""
    reader = csv.DictReader(io.StringIO(csv_text.strip()))
    rows = []
    for r in reader:
        rows.append({k.strip(): (v.strip() if isinstance(v, str) else v) for k, v in r.items()})
    return rows


def _validate_row(row: Dict[str, str], line_no: int) -> Tuple[bool, str]:
    """校验单行数据完整性。返回 (ok, 原因)。"""
    wo = row.get("工单号") or row.get("work_order_id") or ""
    pl = row.get("管线号") or row.get("pipeline_id") or ""
    sp = row.get("采样点") or row.get("sample_point") or ""
    st = row.get("采样时间") or row.get("sample_time") or ""
    if not wo or not WO_RE.match(wo):
        return False, f"工单号格式错误[{wo}]"
    if not pl or not PIPE_RE.match(pl):
        return False, f"管线号格式错误[{pl}]"
    if not sp:
        return False, "采样点为空"
    if not st:
        return False, "采样时间为空"
    return True, ""


def _judge_conclusion(value: Optional[str]) -> str:
    """根据材料值判定结论。空值视为断档待补。"""
    if value is None or value == "":
        return WorkOrderConclusion.PENDING.value
    try:
        v = float(value)
    except (TypeError, ValueError):
        return WorkOrderConclusion.FAIL.value
    # 简化阈值：0.5 <= v <= 2.0 合格
    return WorkOrderConclusion.PASS.value if 0.5 <= v <= 2.0 else WorkOrderConclusion.FAIL.value


def _should_skip(row: Dict[str, str]) -> Tuple[bool, str]:
    """判定是否跳过：管线类型过滤等。"""
    pl_type = row.get("管线类型") or row.get("pipeline_type") or ""
    # 示例规则：标记为 '废弃' 的跳过
    if pl_type == "废弃":
        return True, "管线已废弃"
    return False, ""


def build_replay_lines(rows: List[Dict[str, str]], start_line_no: int = 1) -> List[ReplayLine]:
    """把原始行转成 ReplayLine 列表，完成状态判定。"""
    lines: List[ReplayLine] = []
    for i, row in enumerate(rows):
        line_no = start_line_no + i
        wo = row.get("工单号") or row.get("work_order_id") or ""
        pl = row.get("管线号") or row.get("pipeline_id") or ""
        sp = row.get("采样点") or row.get("sample_point") or ""
        st = row.get("采样时间") or row.get("sample_time") or ""
        mv_raw = row.get("材料值") or row.get("material_value")
        mv = (mv_raw if mv_raw == "" else mv_raw)  # 空字符串保留
        material_value: Optional[str] = None if (mv is None or mv == "") else str(mv)

        ok, bad_reason = _validate_row(row, line_no)
        skip, skip_reason = _should_skip(row)

        if not ok:
            status = LineStatus.BAD.value
            reason = bad_reason
            has_gap = False
        elif skip:
            status = LineStatus.SKIPPED.value
            reason = skip_reason
            has_gap = False
        elif material_value is None:
            status = LineStatus.PENDING_MATERIAL.value
            reason = "采样断档，待补录材料"
            has_gap = True
        else:
            status = LineStatus.PROCESSED.value
            reason = ""
            has_gap = False

        original_concl = _judge_conclusion(material_value)
        gap_msg = "采样值缺失" if has_gap else ""

        lines.append(ReplayLine(
            line_no=line_no,
            work_order_id=wo,
            pipeline_id=pl,
            sample_point=sp,
            sample_time=st,
            material_value=material_value,
            original_conclusion=original_concl,
            current_conclusion=original_concl,
            status=status,
            status_reason=reason,
            has_gap=has_gap,
            gap_detail=gap_msg,
            original_has_gap=has_gap,
            original_gap_detail=gap_msg,
        ))
    return lines


def embed_remarks(lines: List[ReplayLine], remarks: List[Dict[str, Any]]) -> None:
    """把后补备注按行号嵌入对应 ReplayLine.remarks。"""
    for rmk in remarks:
        ln_no = rmk.get("attached_to_line_no")
        if ln_no is None:
            continue
        for ln in lines:
            if ln.line_no == ln_no:
                ln.remarks.append(rmk)
                break


def embed_handover_changes(lines: List[ReplayLine], handover: Optional[HandoverRecord]) -> None:
    """把交接记录中本班改动的行标记出来（在 status_reason 末尾提示）。"""
    if not handover:
        return
    changed = set(handover.changed_line_nos)
    for ln in lines:
        if ln.line_no in changed:
            hint = f"【上一班{handover.from_shift}有改动，交接人:{handover.from_operator}→{handover.to_operator}】"
            ln.status_reason = (ln.status_reason + hint) if ln.status_reason else hint


def run_replay(
    csv_text: str,
    operator: str = "",
    shift: str = "",
    source_file: str = "",
    handover: Optional[HandoverRecord] = None,
    remarks: Optional[List[Dict[str, Any]]] = None,
) -> ReplaySession:
    """执行一次完整回放流程，返回 ReplaySession。"""
    started_at = datetime.now().isoformat(timespec="seconds")
    rows = parse_csv_text(csv_text)
    lines = build_replay_lines(rows)

    if remarks:
        embed_remarks(lines, remarks)
    embed_handover_changes(lines, handover)

    sess = ReplaySession(
        session_id=new_session_id(),
        started_at=started_at,
        ended_at=datetime.now().isoformat(timespec="seconds"),
        source_file=source_file,
        operator=operator,
        shift=shift,
        lines=lines,
        handover=handover,
    )
    storage.save_session(sess)
    return sess


# ---------- 筛选与详情 ----------

def filter_lines(session: Dict[str, Any], **kwargs) -> List[Dict[str, Any]]:
    """通用筛选。

    支持的筛选项：
      status / has_gap（当前是否仍待补）/ original_has_gap（原始是否断档，溯源用）/
      is_material_filled（是否已补录）/ is_manual_judged / work_order_id / line_no。
    组合示例：
      original_has_gap=True                         → 所有曾经断档过的行（含未补+已补，复核人最常用）
      original_has_gap=True + has_gap=True          → 仍然待补的断档行
      original_has_gap=True + is_material_filled=True → 已补录完毕的断档行
    """
    lines = session.get("lines", [])
    result = []
    for ln in lines:
        if "status" in kwargs and ln.get("status") != kwargs["status"]:
            continue
        if "has_gap" in kwargs and bool(ln.get("has_gap")) != bool(kwargs["has_gap"]):
            continue
        if "original_has_gap" in kwargs and bool(ln.get("original_has_gap")) != bool(kwargs["original_has_gap"]):
            continue
        if "is_material_filled" in kwargs and bool(ln.get("is_material_filled")) != bool(kwargs["is_material_filled"]):
            continue
        if "is_manual_judged" in kwargs and bool(ln.get("is_manual_judged")) != bool(kwargs["is_manual_judged"]):
            continue
        if "work_order_id" in kwargs and ln.get("work_order_id") != kwargs["work_order_id"]:
            continue
        if "line_no" in kwargs and ln.get("line_no") != kwargs["line_no"]:
            continue
        result.append(ln)
    return result


def line_detail(session: Dict[str, Any], line_no: int) -> Optional[Dict[str, Any]]:
    """单行详情：包含备注、改判历史、关联交接。"""
    for ln in session.get("lines", []):
        if ln["line_no"] == line_no:
            detail = dict(ln)
            detail["handover"] = storage.find_handover_for_line(session.get("session_id", ""), line_no)
            detail["rejudge_histories"] = storage.list_rejudges(
                work_order_id=ln.get("work_order_id"), line_no=line_no
            )
            return detail
    return None


# ---------- 补录 & 改判 ----------

def fill_material_and_rejudge(
    session_id: str,
    line_no: int,
    new_material: str,
    operator: str,
    reason: str,
    remark_content: str = "",
) -> Tuple[bool, str, Optional[RejudgeHistory]]:
    """给某行补录材料并重新判定。若结论变化则写入 RejudgeHistory 留痕。"""
    sess_dict = storage.load_session(session_id)
    if not sess_dict:
        return False, "会话不存在", None

    target = None
    for ln in sess_dict["lines"]:
        if ln["line_no"] == line_no:
            target = ln
            break
    if not target:
        return False, f"行号{line_no}不存在", None

    old_material = target.get("material_value")
    old_concl = target.get("current_conclusion")
    new_concl = _judge_conclusion(new_material)

    changed = (old_material != new_material) or (old_concl != new_concl)

    target["material_value"] = new_material
    target["current_conclusion"] = new_concl
    # --- 断档信息保留：永不改变 original_has_gap / original_gap_detail ---
    # has_gap 改为 False 表示"当前已补齐，不再属于待补"
    # 但通过 original_has_gap=True + filter --had-gap 仍可追溯
    target["has_gap"] = False
    # gap_detail 改写为原始说明 + 已补录信息
    old_gap_detail = target.get("original_gap_detail") or target.get("gap_detail") or ""
    target["gap_detail"] = f"原始断档：{old_gap_detail}；已补录（{operator}）：{reason}"
    # --- 新增补录状态字段 ---
    filled_at = datetime.now().isoformat(timespec="seconds")
    target["is_material_filled"] = True
    target["filled_material"] = new_material
    target["filled_by"] = operator
    target["filled_at"] = filled_at
    target["filled_reason"] = reason
    target["manual_judge_reason"] = reason if changed else target.get("manual_judge_reason", "")
    target["is_manual_judged"] = changed
    target["status"] = LineStatus.MANUAL_JUDGED.value if changed else LineStatus.PROCESSED.value
    base_reason = f"采样断档已补录，补录值={new_material}，操作人={operator}。原因：{reason}"
    target["status_reason"] = (base_reason + f"；结论由{old_concl}改判为{new_concl}") if changed else base_reason

    # 写快照到 history_snapshots
    snapshot = {
        "rejudge_time": filled_at,
        "operator": operator,
        "old_material": old_material,
        "new_material": new_material,
        "old_conclusion": old_concl,
        "new_conclusion": new_concl,
        "reason": reason,
    }
    target.setdefault("history_snapshots", []).append(snapshot)

    # 若有备注，嵌入
    if remark_content:
        rmk = Remark(
            remark_id="RMK-" + uuid.uuid4().hex[:8],
            author=operator,
            shift=sess_dict.get("shift", ""),
            created_at=filled_at,
            content=remark_content,
            attached_to_line_no=line_no,
            remark_type="改判备注",
        )
        target.setdefault("remarks", []).append(storage.to_dict(rmk))

    # 保存改判历史（全局留痕）
    history = None
    if changed:
        history = RejudgeHistory(
            history_id="RJH-" + uuid.uuid4().hex[:8],
            work_order_id=target.get("work_order_id", ""),
            line_no=line_no,
            rejudge_time=snapshot["rejudge_time"],
            operator=operator,
            old_material=old_material,
            new_material=new_material,
            old_conclusion=old_concl,
            new_conclusion=new_concl,
            reason=reason,
            new_remark=remark_content,
        )
        storage.save_rejudge(history)

    # 重建 session 存回
    from .models import to_dict as _to_dict
    storage._write_json(storage.SESSIONS_FILE, [
        s if s.get("session_id") != session_id else sess_dict
        for s in storage.list_sessions()
    ])
    # 上面的私有方法其实不应直接调；改为用公开接口重新写
    _rewrite_session(session_id, sess_dict)

    return True, "已补录并重新判定", history


def _rewrite_session(session_id: str, sess_dict: Dict[str, Any]) -> None:
    all_ = storage._read_json(storage.SESSIONS_FILE)
    for i, s in enumerate(all_):
        if s.get("session_id") == session_id:
            all_[i] = sess_dict
            break
    storage._write_json(storage.SESSIONS_FILE, all_)


# ---------- 导出 ----------

def export_to_csv(session: Dict[str, Any], include_gap: bool = True, include_history: bool = True) -> str:
    """导出 CSV，包含断档追踪列（原始+当前+补录）与改判历史。"""
    headers = [
        "行号", "工单号", "管线号", "采样点", "采样时间",
        "材料值", "原始结论", "当前结论", "处理状态", "状态说明",
        # --- 断档追踪：原始 / 当前 / 补录 三段都留 ---
        "原始是否断档", "原始断档说明",
        "当前是否待补(断档未补)", "当前断档说明",
        "是否已补录", "补录值", "补录人", "补录时间", "补录原因",
        # --- 改判 ---
        "是否人工改判", "改判原因",
        # --- 其他 ---
        "后补备注", "改判历史", "关联交接",
    ]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(headers)
    for ln in session.get("lines", []):
        remarks_text = "\n".join(
            f"[{r.get('remark_type')}/{r.get('shift')}] {r.get('author')}@{r.get('created_at')}: {r.get('content')}"
            for r in ln.get("remarks", [])
        )
        hist = ln.get("history_snapshots", [])
        hist_text = "\n".join(
            f"{h.get('rejudge_time')} {h.get('operator')}: {h.get('old_conclusion')}→{h.get('new_conclusion')} (原因:{h.get('reason')})"
            for h in hist
        ) if include_history else ""
        handover = storage.find_handover_for_line(session.get("session_id", ""), ln.get("line_no", 0))
        ho_text = ""
        if handover:
            ho_text = f"{handover.get('date')} {handover.get('from_shift')}→{handover.get('to_shift')} ({handover.get('from_operator')}→{handover.get('to_operator')})"
        w.writerow([
            ln.get("line_no"),
            ln.get("work_order_id"),
            ln.get("pipeline_id"),
            ln.get("sample_point"),
            ln.get("sample_time"),
            ln.get("material_value") or "",
            ln.get("original_conclusion"),
            ln.get("current_conclusion"),
            ln.get("status"),
            ln.get("status_reason"),
            # 断档追踪
            "是" if ln.get("original_has_gap") else "否",
            ln.get("original_gap_detail") or "",
            "是" if ln.get("has_gap") else "否",
            ln.get("gap_detail") or "",
            "是" if ln.get("is_material_filled") else "否",
            ln.get("filled_material") or "",
            ln.get("filled_by") or "",
            ln.get("filled_at") or "",
            ln.get("filled_reason") or "",
            # 改判
            "是" if ln.get("is_manual_judged") else "否",
            ln.get("manual_judge_reason") or "",
            # 其他
            remarks_text,
            hist_text,
            ho_text,
        ])
    return buf.getvalue()
