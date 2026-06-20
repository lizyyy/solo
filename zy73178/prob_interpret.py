#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
概率模拟图表解释 (Probabilistic Simulation Chart Interpretation)

稳定接口：参数名、失败提示一经发布不可随意改动，
负责人会把本脚本接入日常自动化脚本。
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


# ============================================================
# 稳定常量区 —— 以下字符串一旦上线后不可改名
# ============================================================

ERROR_MISSING_PARAM = "ERR_MISSING_PARAM"
ERROR_BAD_SAMPLE_DATA = "ERR_BAD_SAMPLE_DATA"
ERROR_DUPLICATE_VERSION = "ERR_DUPLICATE_VERSION"
ERROR_BAD_THRESHOLD = "ERR_BAD_THRESHOLD"
ERROR_UNKNOWN = "ERR_UNKNOWN"

ERROR_MESSAGES = {
    ERROR_MISSING_PARAM: "缺少必要参数: {field}",
    ERROR_BAD_SAMPLE_DATA: "样例数据不可用: {detail}",
    ERROR_DUPLICATE_VERSION: "同一题存在多个版本答案冲突: {detail}",
    ERROR_BAD_THRESHOLD: "阈值参数非法: {detail}",
    ERROR_UNKNOWN: "执行异常: {detail}",
}

DEFAULT_DATA_DIR = Path(__file__).resolve().parent / "sample_data"
DEFAULT_REMARK_FILE = "scoring_remarks.json"
DEFAULT_SIM_FILE = "prob_sim_chart.json"
DEFAULT_THRESHOLD = 0.05
DEFAULT_UNIT_STRICT = True


# ============================================================
# 数据结构
# ============================================================

@dataclass
class RemarkRecord:
    """评分备注单条记录"""
    question_id: str
    content: str
    unit: Optional[str] = None
    version: Optional[str] = None
    source_raw: Optional[str] = None
    note: Optional[str] = None
    is_normal_record: bool = False

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "RemarkRecord":
        return cls(
            question_id=str(d.get("question_id", "")).strip(),
            content=str(d.get("content", "")).strip(),
            unit=d.get("unit"),
            version=d.get("version"),
            source_raw=d.get("source_raw"),
            note=d.get("note"),
            is_normal_record=bool(d.get("is_normal_record", False)),
        )


@dataclass
class SimPoint:
    """概率模拟数据点"""
    question_id: str
    probability: float
    label: Optional[str] = None

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "SimPoint":
        return cls(
            question_id=str(d.get("question_id", "")).strip(),
            probability=float(d.get("probability", 0.0)),
            label=d.get("label"),
        )


@dataclass
class UnitIssue:
    """单位缺失/不匹配追溯"""
    question_id: str
    issue_type: str           # "missing" | "mismatch"
    remark_version: Optional[str]
    original_remark: Optional[str]
    source_raw: Optional[str]
    suggested_fix: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class JumpDiagnosis:
    """结果跳变诊断"""
    question_id: str
    jump_detected: bool
    delta: float
    cause: str                  # "threshold" | "unit" | "normal_record"
    cause_detail: str
    evidence: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class InterpretResult:
    question_id: str
    probability: float
    selected_remark: Optional[str]
    selected_version: Optional[str]
    unit: Optional[str]
    interpretation: str
    unit_issue: Optional[UnitIssue] = None
    jump_diagnosis: Optional[JumpDiagnosis] = None

    def to_dict(self) -> Dict[str, Any]:
        d = {
            "question_id": self.question_id,
            "probability": self.probability,
            "selected_remark": self.selected_remark,
            "selected_version": self.selected_version,
            "unit": self.unit,
            "interpretation": self.interpretation,
        }
        if self.unit_issue:
            d["unit_issue"] = self.unit_issue.to_dict()
        if self.jump_diagnosis:
            d["jump_diagnosis"] = self.jump_diagnosis.to_dict()
        return d


@dataclass
class APIResponse:
    """稳定接口返回结构 —— 字段名不可改动"""
    ok: bool
    code: str                    # "OK" 或 ERROR_*
    message: str
    data: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ok": self.ok,
            "code": self.code,
            "message": self.message,
            "data": self.data,
        }

    def dump(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=indent)


# ============================================================
# 核心逻辑
# ============================================================

def _fail(code: str, **kwargs: Any) -> APIResponse:
    tmpl = ERROR_MESSAGES.get(code, ERROR_MESSAGES[ERROR_UNKNOWN])
    return APIResponse(ok=False, code=code, message=tmpl.format(**kwargs))


def load_remarks(path: Path) -> List[RemarkRecord]:
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    if not isinstance(raw, list):
        raise ValueError("评分备注文件根节点必须是数组")
    return [RemarkRecord.from_dict(x) for x in raw]


def load_sim(path: Path) -> List[SimPoint]:
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    if not isinstance(raw, list):
        raise ValueError("概率模拟数据文件根节点必须是数组")
    return [SimPoint.from_dict(x) for x in raw]


def dedupe_remarks_by_version(
    remarks: List[RemarkRecord],
) -> Tuple[Dict[str, RemarkRecord], List[Dict[str, Any]]]:
    """
    按 question_id 聚合并防止版本冲突。
    返回 (选中表, 冲突列表)
    选中优先级：有 version 且最新（按字符串字典序取最大）> 无 version > is_normal_record=False
    若同一题下出现两条都有 version 且无法区分 -> 报冲突
    """
    grouped: Dict[str, List[RemarkRecord]] = {}
    for r in remarks:
        grouped.setdefault(r.question_id, []).append(r)

    selected: Dict[str, RemarkRecord] = {}
    conflicts: List[Dict[str, Any]] = []

    for qid, recs in grouped.items():
        # 有 version 的
        with_ver = [r for r in recs if r.version]
        without_ver = [r for r in recs if not r.version]

        if len(with_ver) >= 2:
            # 按 version 排序取最大
            with_ver_sorted = sorted(with_ver, key=lambda r: (r.version or ""))
            top = with_ver_sorted[-1]
            # 检查是否有并列最大
            if len(with_ver_sorted) >= 2 and with_ver_sorted[-1].version == with_ver_sorted[-2].version:
                conflicts.append({
                    "question_id": qid,
                    "versions": [r.version for r in with_ver_sorted],
                    "remark_contents": [r.content for r in with_ver_sorted],
                })
                continue
            selected[qid] = top
        elif len(with_ver) == 1:
            selected[qid] = with_ver[0]
        else:
            # 无 version，优先 is_normal_record=False 的（旧说法/老备注），否则取第一个
            non_normal = [r for r in without_ver if not r.is_normal_record]
            if non_normal:
                selected[qid] = non_normal[0]
            else:
                selected[qid] = without_ver[0]

    return selected, conflicts


def trace_unit_issue(
    qid: str,
    remark: Optional[RemarkRecord],
    sim_point: Optional[SimPoint],
) -> Optional[UnitIssue]:
    """
    追到评分备注原始说法，不做含糊警告。
    """
    if remark is None:
        return UnitIssue(
            question_id=qid,
            issue_type="missing",
            remark_version=None,
            original_remark=None,
            source_raw=None,
            suggested_fix="评分备注中缺少该题记录",
        )
    if not remark.unit:
        return UnitIssue(
            question_id=qid,
            issue_type="missing",
            remark_version=remark.version,
            original_remark=remark.content,
            source_raw=remark.source_raw or remark.note,
            suggested_fix=(
                f"评分备注原始说法：{remark.content}"
                if remark.content
                else "请在评分备注中补充 unit 字段"
            ),
        )
    # 单位存在
    return None


def diagnose_jump(
    qid: str,
    current_prob: float,
    baseline_prob: Optional[float],
    threshold: float,
    remark: Optional[RemarkRecord],
    unit_issue: Optional[UnitIssue],
) -> JumpDiagnosis:
    """
    跳变诊断：区分阈值/单位/正常记录 三种成因
    """
    if baseline_prob is None:
        return JumpDiagnosis(
            question_id=qid,
            jump_detected=False,
            delta=0.0,
            cause="threshold",
            cause_detail="无基线数据，无法比较",
        )

    delta = current_prob - baseline_prob
    jump = abs(delta) > threshold
    evidence: List[str] = []

    if not jump:
        return JumpDiagnosis(
            question_id=qid,
            jump_detected=False,
            delta=round(delta, 6),
            cause="threshold",
            cause_detail=f"变化幅度 {abs(delta):.4f} ≤ 阈值 {threshold}",
            evidence=evidence,
        )

    # 判定成因优先级
    cause = "threshold"
    cause_detail = f"|Δ|={abs(delta):.4f} > 阈值 {threshold}"

    if unit_issue and unit_issue.issue_type in ("missing", "mismatch"):
        cause = "unit"
        cause_detail = (
            f"单位问题触发跳变（{unit_issue.issue_type}）："
            f"原始备注版本={unit_issue.remark_version or '未标注版本'}；"
            f"原始说法={unit_issue.original_remark or '无'}"
        )
    elif remark and remark.is_normal_record:
        cause = "normal_record"
        cause_detail = (
            "跳变由评分备注中的【正常记录】引起："
            f"内容='{remark.content}' "
            f"(note={remark.note or '无'})"
        )
        evidence.append(f"normal_record.content={remark.content}")

    evidence.append(f"baseline_prob={baseline_prob}")
    evidence.append(f"current_prob={current_prob}")
    evidence.append(f"threshold={threshold}")

    return JumpDiagnosis(
        question_id=qid,
        jump_detected=True,
        delta=round(delta, 6),
        cause=cause,
        cause_detail=cause_detail,
        evidence=evidence,
    )


def build_interpretation(
    sim_point: SimPoint,
    remark: RemarkRecord | None,
) -> str:
    """组装解释文本"""
    unit = remark.unit if remark else None
    remark_text = remark.content if remark else "（无匹配备注）"
    unit_str = f"（单位：{unit}）" if unit else "（单位缺失，见 unit_issue）"
    return (
        f"该题概率 {sim_point.probability:.2%}，"
        f"对应评分备注说法：{remark_text} {unit_str}"
    )


def run_interpretation(
    remark_path: Path,
    sim_path: Path,
    threshold: float,
    baseline_path: Optional[Path] = None,
    unit_strict: bool = DEFAULT_UNIT_STRICT,
) -> APIResponse:
    """
    主入口 —— 参数名发布后不可改。

    :param remark_path:   评分备注 JSON 路径 (list[RemarkRecord]
    :param sim_path:      概率模拟数据 JSON 路径 (list[SimPoint]
    :param threshold:   跳变阈值 (0, 1)
    :param baseline_path:  上一次 sim 数据，用于跳变对比；可为 None
    :param unit_strict: 单位严格模式（默认 True）
    """
    # 参数校验
    if threshold <= 0 or threshold >= 1:
        return _fail(ERROR_BAD_THRESHOLD, detail="threshold 必须在 (0, 1) 开区间内")

    # 加载数据
    try:
        remarks = load_remarks(remark_path)
    except FileNotFoundError:
        return _fail(ERROR_BAD_SAMPLE_DATA, detail=f"找不到评分备注文件: {remark_path}")
    except (json.JSONDecodeError, ValueError) as e:
        return _fail(ERROR_BAD_SAMPLE_DATA, detail=f"评分备注解析失败: {e}")

    try:
        sim_points = load_sim(sim_path)
    except FileNotFoundError:
        return _fail(ERROR_BAD_SAMPLE_DATA, detail=f"找不到概率模拟文件: {sim_path}")
    except (json.JSONDecodeError, ValueError) as e:
        return _fail(ERROR_BAD_SAMPLE_DATA, detail=f"概率模拟数据解析失败: {e}")

    baseline_map: Dict[str, float] = {}
    if baseline_path:
        try:
            baseline_points = load_sim(baseline_path)
            baseline_map = {p.question_id: p.probability for p in baseline_points}
        except Exception as e:
            return _fail(ERROR_BAD_SAMPLE_DATA, detail=f"基线数据加载失败: {e}")

    # 版本去重 + 冲突检测
    selected_remarks, conflicts = dedupe_remarks_by_version(remarks)
    if conflicts:
        detail = "; ".join(
            f"{c['question_id']} versions={c['versions']}" for c in conflicts
        )
        return _fail(ERROR_DUPLICATE_VERSION, detail=detail)

    # 逐题处理
    results: List[Dict[str, Any]] = []
    for sp in sim_points:
        qid = sp.question_id
        remark = selected_remarks.get(qid)
        unit = remark.unit if remark else None
        unit_issue = trace_unit_issue(qid, remark, sp)
        baseline_p = baseline_map.get(qid)
        jump = diagnose_jump(qid, sp.probability, baseline_p, threshold, remark, unit_issue)
        interp = build_interpretation(sp, remark)

        result = InterpretResult(
            question_id=qid,
            probability=sp.probability,
            selected_remark=remark.content if remark else None,
            selected_version=remark.version if remark else None,
            unit=unit,
            interpretation=interp,
            unit_issue=unit_issue if (unit_strict or unit_issue) else None,
            jump_diagnosis=jump,
        )
        results.append(result.to_dict())

    data = {
        "threshold": threshold,
        "unit_strict": unit_strict,
        "remark_count": len(selected_remarks),
        "sim_count": len(sim_points),
        "results": results,
    }
    return APIResponse(ok=True, code="OK", message="解释完成", data=data)


# ============================================================
# CLI 入口（参数名一经发布不得修改
# ============================================================

def build_argparser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="prob_interpret",
        description="概率模拟图表解释 —— 稳定接口版本",
    )
    p.add_argument(
        "--remark-path",
        type=Path,
        default=DEFAULT_DATA_DIR / DEFAULT_REMARK_FILE,
        help="评分备注 JSON 文件路径",
    )
    p.add_argument(
        "--sim-path",
        type=Path,
        default=DEFAULT_DATA_DIR / DEFAULT_SIM_FILE,
        help="概率模拟数据 JSON 文件路径",
    )
    p.add_argument(
        "--threshold",
        type=float,
        default=DEFAULT_THRESHOLD,
        help="跳变判定阈值 (0, 1)，默认 0.05",
    )
    p.add_argument(
        "--baseline-path",
        type=Path,
        default=None,
        help="（可选）上一次概率模拟 JSON，用于跳变对比",
    )
    p.add_argument(
        "--unit-strict",
        action="store_true",
        default=DEFAULT_UNIT_STRICT,
        help="单位严格模式（默认开启，关闭用 --no-unit-strict）",
    )
    p.add_argument(
        "--no-unit-strict",
        dest="unit_strict",
        action="store_false",
        help=argparse.SUPPRESS,
    )
    p.add_argument(
        "--output",
        type=Path,
        default=None,
        help="（可选）将 JSON 结果写入文件，默认 stdout",
    )
    return p


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_argparser()
    args = parser.parse_args(argv)

    try:
        resp = run_interpretation(
            remark_path=args.remark_path,
            sim_path=args.sim_path,
            threshold=args.threshold,
            baseline_path=args.baseline_path,
            unit_strict=args.unit_strict,
        )
    except Exception as e:  # 兜底，保证脚本永远吐出稳定结构
        resp = _fail(ERROR_UNKNOWN, detail=str(e))

    out_str = resp.dump()
    if args.output:
        args.output.write_text(out_str, encoding="utf-8")
    else:
        sys.stdout.write(out_str + "\n")

    return 0 if resp.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
