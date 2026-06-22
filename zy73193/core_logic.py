from typing import List, Dict, Tuple, Any, Optional
from data_models import (
    QuestionItem, Material, AnswerVersion, Note,
    SequencePoint, ParamSet, Store, asdict, datetime
)
import math


def version_match_questions(questions: List[Dict]) -> Dict[str, Dict]:
    groups: Dict[str, Dict] = {}
    for q in questions:
        key = _question_fingerprint(q)
        if key not in groups:
            groups[key] = {
                "fingerprint": key,
                "title": q.get("title", ""),
                "versions": [],
                "qids": [],
                "coverage": "单版本"
            }
        groups[key]["versions"].append(q)
        groups[key]["qids"].append(q.get("qid", ""))
    for k, g in groups.items():
        vers = set(v.get("version", "") for v in g["versions"])
        if len(vers) >= 2:
            g["coverage"] = f"{len(vers)}版本覆盖"
            vlist = sorted(vers)
            g["version_labels"] = vlist
        else:
            g["version_labels"] = list(vers)
    return groups


def _question_fingerprint(q: Dict) -> str:
    title = q.get("title", "")
    text = q.get("original_text", "")
    import re
    formula_matches = re.findall(
        r'x\s*(?:[_\{]?\s*n\s*(?:[+\-]\s*\d+)?\s*[_\}]?|_\{?\s*n\s*[+\-]\s*\d+\s*\}?)\s*[=＝:：]?\s*.+',
        text
    )
    if formula_matches:
        core_raw = formula_matches[0]
    else:
        m = re.search(r'递推.{0,6}[：:]?\s*.+', text)
        core_raw = m.group(0) if m else text
    core = "".join(ch for ch in core_raw if ch.isalnum() or ch in '+-*/=().{},[]')
    title_clean = "".join(ch for ch in title if ch.isalnum() or '\u4e00' <= ch <= '\u9fff')
    return (title_clean + "|" + core) or q.get("qid", "")


def trace_material_renames(materials: List[Dict]) -> Dict[str, Dict]:
    trace = {}
    for m in materials:
        mid = m.get("mid", "")
        prev = m.get("previous_names") or []
        all_names = [m.get("current_name", "")] + prev
        trace[mid] = {
            "mid": mid,
            "current_name": m.get("current_name", ""),
            "previous_names": prev,
            "all_aliases": all_names,
            "is_temporary": m.get("is_temporary_rename", False),
            "rename_by": m.get("renamed_by", ""),
            "rename_time": m.get("rename_time", ""),
            "linked_qids": m.get("linked_qids", []),
            "source_type": m.get("source_type", "")
        }
    return trace


def analyze_answer_coverage(groups: Dict[str, Dict], answers: List[Dict],
                            materials: List[Dict]) -> Dict[str, Any]:
    mat_trace = trace_material_renames(materials)
    qid_to_answers: Dict[str, List[Dict]] = {}
    for a in answers:
        qid = a.get("qid", "")
        qid_to_answers.setdefault(qid, []).append(a)

    result = {}
    for key, g in groups.items():
        qids = g["qids"]
        version_answers = {}
        for q in g["versions"]:
            qid = q["qid"]
            ans = qid_to_answers.get(qid, [])
            vlabel = q.get("version", "")
            version_answers.setdefault(vlabel, []).extend(ans)

        all_ans_for_group = []
        for qid in qids:
            all_ans_for_group.extend(qid_to_answers.get(qid, []))

        affected_by_material = {}
        for a in all_ans_for_group:
            mid = a.get("material_mid", "")
            if mid and mid in mat_trace:
                mt = mat_trace[mid]
                if mt["is_temporary"] or len(mt["previous_names"]) > 0:
                    affected_by_material[mid] = mt

        all_versions = g["version_labels"]
        covered_versions = set(version_answers.keys())
        missing = [v for v in all_versions if v not in covered_versions]

        result[key] = {
            "title": g["title"],
            "fingerprint": key,
            "coverage": g["coverage"],
            "all_versions": all_versions,
            "covered_versions": sorted(covered_versions),
            "missing_versions": missing,
            "version_answers": {k: [
                {
                    "aid": a["aid"],
                    "material_mid": a.get("material_mid", ""),
                    "material_name": next(
                        (m.get("current_name", "") for m in materials
                         if m.get("mid") == a.get("material_mid", "")), ""),
                    "processed_result": a.get("processed_result", ""),
                    "params": a.get("params", {})
                } for a in vlist
            ] for k, vlist in version_answers.items()},
            "renamed_materials_affecting": affected_by_material,
            "qids": qids
        }
    return result


def detect_dirty_data(points: List[Dict]) -> List[Dict]:
    dirty = []
    EPS = 1e-9
    for i, p in enumerate(points):
        raw = p.get("raw_value")
        val = p.get("value")
        trace = p.get("calc_trace") or []
        issues = []
        if raw is None or (isinstance(raw, float) and (math.isnan(raw) or math.isinf(raw))):
            issues.append({
                "type": "缺失/非数值",
                "detail": f"raw_value = {raw}",
                "severity": "高"
            })
        for step in trace:
            denom = step.get("denominator")
            if denom is None:
                continue
            if isinstance(denom, (int, float)) and abs(denom) < EPS:
                issues.append({
                    "type": "除零边界",
                    "detail": f"第 {i} 步递推中分母 ≈ {denom:.3e}，"
                              f"公式：{step.get('formula_display', step.get('formula', ''))}",
                    "severity": "高",
                    "step_idx": step.get("step", i)
                })
            form = str(step.get("formula", "") or "")
            if "/" in form and (step.get("warning") or "").find("除零") >= 0:
                issues.append({
                    "type": "除零警告",
                    "detail": step.get("warning", ""),
                    "severity": "高"
                })
        if isinstance(val, (int, float)):
            if math.isinf(val) or math.isnan(val):
                issues.append({
                    "type": "非数/无穷值",
                    "detail": f"value = {val}",
                    "severity": "高"
                })
            elif abs(val) > 1e15 or (abs(val) < 1e-15 and abs(raw or 0) > 1e-6):
                issues.append({
                    "type": "数值溢出/异常缩",
                    "detail": f"value = {val:.4g}, raw = {raw}",
                    "severity": "中"
                })
        if issues:
            dirty.append({
                "index": p.get("index", i),
                "point": p,
                "issues": issues
            })
    return dirty


def compute_sequence(param_set_id: str, params: Dict[str, Any],
                     unit_config: Dict[str, str],
                     qid: str, aid: str) -> Tuple[List[Dict], List[Dict], List[Dict]]:
    length = int(params.get("length", 20))
    a_coef = float(params.get("a", 1.0))
    b_coef = float(params.get("b", 0.0))
    c_div = float(params.get("c_divisor", 1.0))
    x0 = float(params.get("x0", 1.0))

    in_unit = unit_config.get("input", "")
    out_unit = unit_config.get("output", "")
    scale_in = float(unit_config.get("scale_input", 1.0))
    scale_out = float(unit_config.get("scale_output", 1.0))

    unit_conv_trace = {
        "step": "unit_init",
        "description": "单位换算初始化",
        "input_unit": in_unit,
        "output_unit": out_unit,
        "scale_input": scale_in,
        "scale_output": scale_out,
        "detail": f"输入量纲 {in_unit} × {scale_in} → 计算量纲；计算结果 × {scale_out} → 输出量纲 {out_unit}"
    }

    points = []
    calc_traces = []
    x = x0 * scale_in

    for i in range(length):
        trace_i = []
        raw_x_scaled = x
        if i == 0:
            formula_step = {
                "step": 0,
                "description": "初值",
                "formula": "x_0 = params.x0",
                "formula_display": f"x₀ = {x0} {in_unit}",
                "operands": {"x0": x0},
                "intermediate": {"scaled_x0": x}
            }
            trace_i.append(formula_step)
        else:
            denom = c_div + x
            formula_main = f"x_{i} = ({a_coef}·x_{i-1} + {b_coef}) / ({c_div} + x_{i-1})"
            numerator = a_coef * raw_x_scaled + b_coef
            step1 = {
                "step": i * 3 - 2,
                "description": f"计算分子",
                "formula": f"num = a·x_prev + b",
                "formula_display": f"分子 = {a_coef} × {raw_x_scaled:.6g} + {b_coef} = {numerator:.6g}",
                "operands": {"a": a_coef, "x_prev": raw_x_scaled, "b": b_coef},
                "intermediate": {"numerator": numerator}
            }
            step2 = {
                "step": i * 3 - 1,
                "description": f"计算分母",
                "formula": f"den = c_div + x_prev",
                "formula_display": f"分母 = {c_div} + {raw_x_scaled:.6g} = {denom:.6g}",
                "operands": {"c_div": c_div, "x_prev": raw_x_scaled},
                "intermediate": {"denominator": denom},
                "denominator": denom
            }
            step3 = {
                "step": i * 3,
                "description": f"递推一步",
                "formula": f"x_new = num / den",
                "formula_display": f"x{i} = {numerator:.6g} / {denom:.6g}",
                "operands": {"numerator": numerator, "denominator": denom},
                "intermediate": {}
            }
            if abs(denom) < 1e-12:
                step3["intermediate"]["result"] = float("inf") if numerator > 0 else float("-inf")
                step3["warning"] = "除零：分母为0或接近0"
            else:
                step3["intermediate"]["result"] = numerator / denom
            trace_i.extend([step1, step2, step3])

            x = numerator / denom if abs(denom) >= 1e-12 else (float("inf") if numerator > 0 else float("-inf"))

        out_val = x * scale_out
        point = {
            "index": i,
            "value": out_val if not (isinstance(out_val, float) and math.isinf(out_val)) else None,
            "raw_value": out_val,
            "source_qid": qid,
            "source_aid": aid,
            "is_anomaly": False,
            "anomaly_type": "",
            "anomaly_detail": "",
            "calc_trace": trace_i,
            "unit": out_unit
        }

        if i == 0:
            _ = 0
        else:
            denom_val = c_div + points[i - 1]["raw_value"] / scale_out * scale_in
            if isinstance(denom_val, (int, float)) and abs(denom_val) < 1e-9:
                point["is_anomaly"] = True
                point["anomaly_type"] = "除零边界"
                point["anomaly_detail"] = f"第{i}步分母≈{denom_val:.2e}"
        if isinstance(out_val, float) and math.isinf(out_val):
            point["is_anomaly"] = True
            point["anomaly_type"] = point.get("anomaly_type") or "无穷值"
            point["anomaly_detail"] = (point.get("anomaly_detail") or "") + "结果发散至无穷"

        points.append(point)
        calc_traces.append({
            "index": i,
            "unit_conversion": unit_conv_trace,
            "steps": trace_i
        })

    dirty_points = detect_dirty_data(points)
    for dp in dirty_points:
        idx = dp["index"]
        if idx < len(points):
            issues_str = "; ".join(f"{it['type']}:{it['detail']}" for it in dp["issues"])
            points[idx]["is_anomaly"] = True
            points[idx]["anomaly_type"] = points[idx].get("anomaly_type") or "脏数据"
            points[idx]["anomaly_detail"] = (points[idx].get("anomaly_detail") or "") + ("；" if points[idx].get("anomaly_detail") else "") + issues_str

    return points, calc_traces, dirty_points


def find_conclusion_influencers(notes: List[Dict], materials: List[Dict],
                                questions: List[Dict], answers: List[Dict]) -> Dict[str, List[Dict]]:
    result = {"notes": [], "materials": [], "questions_old": []}
    for n in notes:
        if n.get("note_type") == "verbal" or "口头" in n.get("content", ""):
            result["notes"].append(n)
    for m in materials:
        if m.get("is_temporary_rename") or len(m.get("previous_names") or []) > 0:
            result["materials"].append(m)
    q_versions: Dict[str, List[Dict]] = {}
    for q in questions:
        key = _question_fingerprint(q)
        q_versions.setdefault(key, []).append(q)
    for k, qs in q_versions.items():
        if len(qs) > 1:
            sorted_qs = sorted(qs, key=lambda x: x.get("version", ""))
            result["questions_old"].append({
                "fingerprint": k,
                "title": qs[0].get("title", ""),
                "current_version": sorted_qs[-1].get("version", ""),
                "old_versions": [
                    {"version": q.get("version", ""), "qid": q.get("qid", ""),
                     "source_file": q.get("source_file", ""),
                     "diff": _diff_text(sorted_qs[-1].get("original_text", ""),
                                        q.get("original_text", ""))}
                    for q in sorted_qs[:-1]
                ]
            })
    return result


def _diff_text(a: str, b: str) -> str:
    if a == b:
        return "内容相同"
    la, lb = len(a), len(b)
    return f"新版{la}字 vs 旧版{lb}字；{'旧版更短' if lb < la else '旧版更长'} {abs(la - lb)} 字"


def link_original_to_processed(questions: List[Dict], answers: List[Dict],
                               notes: List[Dict]) -> List[Dict]:
    links = []
    for q in questions:
        qid = q["qid"]
        related_answers = [a for a in answers if a.get("qid") == qid]
        related_notes = [n for n in notes if n.get("target_type") == "question" and n.get("target_id") == qid]
        for a in related_answers:
            answer_notes = [n for n in notes if n.get("target_type") == "answer" and n.get("target_id") == a.get("aid")]
            links.append({
                "qid": qid,
                "question_title": q.get("title", ""),
                "question_version": q.get("version", ""),
                "original_text": q.get("original_text", ""),
                "aid": a.get("aid", ""),
                "answer_version": a.get("version", ""),
                "answer_text": a.get("answer_text", ""),
                "processed_result": a.get("processed_result", ""),
                "unit_conversion": a.get("unit_conversion", ""),
                "params": a.get("params", {}),
                "question_notes": related_notes,
                "answer_notes": answer_notes,
                "bridge": _build_bridge(q, a)
            })
    return links


def _build_bridge(q: Dict, a: Dict) -> Dict:
    original = q.get("original_text", "")
    processed = a.get("processed_result", "")
    params = a.get("params", {}) or {}
    steps = []
    for pkey, pval in params.items():
        for line in original.split("\n"):
            if pkey in line or str(pval) in line:
                steps.append({
                    "from_original": line.strip(),
                    "extracted_param": pkey,
                    "param_value": pval,
                    "used_in_processed": True
                })
                break
    if processed and original:
        steps.append({
            "from_original": "[题目整体]",
            "extracted_param": "__all__",
            "param_value": f"应用公式生成结果",
            "used_in_processed": True
        })
    return {
        "match_count": len(steps),
        "mappings": steps,
        "conversion_note": a.get("unit_conversion", "")
    }


def build_param_comparison(param_sets_data: List[Dict]) -> Dict:
    if len(param_sets_data) < 2:
        return {"needs_more": True}
    ps1, ps2 = param_sets_data[0], param_sets_data[1]
    seq1 = ps1.get("sequence", [])
    seq2 = ps2.get("sequence", [])
    max_len = max(len(seq1), len(seq2))
    diff_rows = []
    for i in range(max_len):
        value_a = seq1[i]["value"] if i < len(seq1) and seq1[i].get("value") is not None else None
        value_b = seq2[i]["value"] if i < len(seq2) and seq2[i].get("value") is not None else None
        if value_a is not None and value_b is not None:
            abs_diff = abs(value_a - value_b)
            rel_diff = abs_diff / (abs(value_a) + 1e-12)
            is_significant_diff = rel_diff > 1e-6
        else:
            abs_diff = None
            rel_diff = None
            is_significant_diff = False
        diff_rows.append({
            "index": i,
            "value_a": value_a,
            "value_b": value_b,
            "abs_diff": abs_diff,
            "rel_diff": rel_diff,
            "is_significant_diff": is_significant_diff,
            "anomaly_a": seq1[i].get("is_anomaly", False) if i < len(seq1) else False,
            "anomaly_b": seq2[i].get("is_anomaly", False) if i < len(seq2) else False
        })
    params_diff = {}
    keys = set(list(ps1.get("params", {}).keys()) + list(ps2.get("params", {}).keys()))
    for k in keys:
        v1 = ps1.get("params", {}).get(k)
        v2 = ps2.get("params", {}).get(k)
        params_diff[k] = {"set1": v1, "set2": v2, "different": v1 != v2}
    return {
        "needs_more": False,
        "set1_name": ps1.get("name", "参数组A"),
        "set2_name": ps2.get("name", "参数组B"),
        "params_diff": params_diff,
        "unit1": ps1.get("unit_config", {}),
        "unit2": ps2.get("unit_config", {}),
        "diff_rows": diff_rows,
        "summary": {
            "total_points": max_len,
            "points_with_difference": sum(1 for r in diff_rows if r["is_significant_diff"]),
            "anomalies_set1": sum(1 for r in diff_rows if r["anomaly_a"]),
            "anomalies_set2": sum(1 for r in diff_rows if r["anomaly_b"])
        }
    }
