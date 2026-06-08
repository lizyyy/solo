import json
from app.database import (
    get_conn, insert_sample, insert_run, insert_stratification,
    insert_metric_snapshot, insert_audit, mark_duplicate,
    update_sample_status, get_latest_run_id,
    row_to_dict, now_iso, new_id,
)


def detect_duplicates(samples: list[dict]) -> tuple[list[dict], list[dict]]:
    seen = {}
    unique = []
    duplicates = []
    for s in samples:
        key = (s.get("content", "").strip(), s.get("domain", ""))
        if key in seen:
            s["is_duplicate"] = 1
            s["duplicate_of"] = seen[key]
            s["status"] = "duplicate"
            duplicates.append(s)
        else:
            s["is_duplicate"] = 0
            s["duplicate_of"] = None
            seen[key] = s.get("id") or new_id()
            unique.append(s)
    return unique, duplicates


def stratify_by_confidence(sample: dict) -> tuple[str, float, str, dict]:
    conf = sample.get("model_confidence")
    if conf is None:
        return "无置信度", 0.5, "模型未输出置信度，无法按置信度分层", {"field": "model_confidence", "value": None}
    if conf >= 0.8:
        return "高置信度", conf, f"模型置信度 {conf:.0%}，判定为高置信度", {"field": "model_confidence", "value": conf}
    if conf >= 0.5:
        return "中置信度", conf, f"模型置信度 {conf:.0%}，判定为中置信度", {"field": "model_confidence", "value": conf}
    return "低置信度", conf, f"模型置信度 {conf:.0%}，判定为低置信度", {"field": "model_confidence", "value": conf}


def stratify_by_correctness(sample: dict) -> tuple[str, float, str, dict]:
    ref = sample.get("reference_result")
    pred = sample.get("model_output")
    human = sample.get("human_label")
    effective_pred = human or pred

    if ref is None or ref == "":
        if effective_pred is not None:
            return "缺引用-有预测", 0.3, "缺少引用结果，但模型有输出，暂无法判定正确性", {"field": "reference_result", "value": None}
        return "缺引用-无预测", 0.1, "引用结果和模型输出均缺失", {"field": "reference_result", "value": None, "model_output": None}

    if effective_pred is None or effective_pred == "":
        return "有引用-无预测", 0.2, "有引用结果但模型无输出", {"field": "model_output", "value": None, "reference_result": ref}

    if human and human != pred:
        match = "一致" if human.strip() == ref.strip() else "不一致"
        return f"人工修正-{match}", 0.9, f"人工标签与引用{match}（原模型输出：{pred}，人工改为：{human}）", {
            "field": "human_label", "original_pred": pred, "human_label": human, "reference": ref, "match": match
        }

    if pred.strip() == ref.strip():
        return "预测正确", 0.95, f"模型输出与引用结果一致（均为「{pred}」）", {"field": "model_output", "value": pred, "reference": ref}
    return "预测错误", 0.95, f"模型输出「{pred}」与引用「{ref}」不一致", {"field": "model_output", "value": pred, "reference": ref}


def stratify_by_quality(sample: dict) -> tuple[str, float, str, dict]:
    issues = []
    if sample.get("is_duplicate"):
        issues.append("重复样本")
    if not sample.get("reference_result"):
        issues.append("缺引用")
    if sample.get("human_label") and sample.get("human_label") != sample.get("model_output"):
        issues.append("标签被人工改过")
    if not sample.get("model_output"):
        issues.append("无模型输出")

    if not issues:
        return "数据完整", 1.0, "样本数据完整，无质量问题", {"issues": []}

    label = "、".join(issues)
    reason = f"数据质量问题：{label}"
    return label, 0.8, reason, {"issues": issues}


STRATIFY_FNS = {
    "confidence": ("按置信度分层", stratify_by_confidence),
    "correctness": ("按正确性分层", stratify_by_correctness),
    "quality": ("按数据质量分层", stratify_by_quality),
}


def run_stratification(samples: list[dict], strat_types: list[str] = None,
                       run_type: str = "initial", operator: str = "系统") -> dict:
    if strat_types is None:
        strat_types = list(STRATIFY_FNS.keys())

    unique, duplicates = detect_duplicates(samples)

    with get_conn() as conn:
        prev_run_id = get_latest_run_id(conn)

        for s in unique + duplicates:
            insert_sample(conn, s)
            insert_audit(conn, s.get("id"), "导入样本", operator,
                         evidence_ref=f"来源={s.get('source')}, 批次={s.get('import_batch')}")

        for d in duplicates:
            mark_duplicate(conn, d["id"], d["duplicate_of"], operator)

        run_id = insert_run(conn, run_type, previous_run_id=prev_run_id,
                            sample_count=len(unique), notes=f"分层类型: {', '.join(strat_types)}")

        for s in unique:
            if s.get("is_duplicate"):
                continue
            for stype in strat_types:
                if stype not in STRATIFY_FNS:
                    continue
                _, fn = STRATIFY_FNS[stype]
                stratum, confidence, reason, evidence = fn(s)
                insert_stratification(
                    conn, s["id"], run_id, stratum, stype,
                    confidence=confidence, evidence=evidence, auto_reason=reason,
                )
            update_sample_status(conn, s["id"], "stratified")
            insert_audit(conn, s["id"], "完成分层", operator,
                         evidence_ref=f"运行ID={run_id}, 分层类型={','.join(strat_types)}")

        stratum_counts = _compute_stratum_counts(conn, run_id, strat_types)
        _save_metrics(conn, run_id, unique, strat_types, stratum_counts)

        metrics_json = _build_metrics_json(conn, run_id)
        conn.execute("UPDATE runs SET metrics_json=? WHERE id=?",
                     (json.dumps(metrics_json, ensure_ascii=False), run_id))

    return {"run_id": run_id, "unique_count": len(unique), "duplicate_count": len(duplicates),
            "stratum_counts": stratum_counts, "metrics": metrics_json}


def _cross_check_db_duplicates(conn, samples: list[dict], operator: str) -> tuple[list[dict], list[dict]]:
    truly_unique = []
    db_dups = []
    for s in samples:
        if s.get("is_duplicate"):
            db_dups.append(s)
            continue
        content_key = s.get("content", "").strip()
        domain_key = s.get("domain") or ""
        existing = conn.execute(
            "SELECT id FROM samples WHERE content=? AND domain=? AND is_duplicate=0 LIMIT 1",
            (content_key, domain_key),
        ).fetchone()
        if existing:
            s["is_duplicate"] = 1
            s["duplicate_of"] = existing["id"]
            s["status"] = "duplicate"
            db_dups.append(s)
            insert_audit(conn, s.get("id"), "跨库标记重复", operator,
                         evidence_ref=f"内容与已有样本 {existing['id']} 重复")
        else:
            truly_unique.append(s)
    return truly_unique, db_dups


def incremental_stratification(new_samples: list[dict], strat_types: list[str] = None,
                               operator: str = "系统") -> dict:
    if strat_types is None:
        strat_types = list(STRATIFY_FNS.keys())

    unique_new, dup_new = detect_duplicates(new_samples)

    with get_conn() as conn:
        prev_run_id = get_latest_run_id(conn)

        truly_unique, db_dups = _cross_check_db_duplicates(conn, unique_new, operator)
        all_dups = dup_new + db_dups

        for s in truly_unique:
            existing_by_id = conn.execute("SELECT id FROM samples WHERE id=?", (s.get("id"),)).fetchone()
            if not existing_by_id:
                insert_sample(conn, s)
                insert_audit(conn, s.get("id"), "补录样本", operator,
                             evidence_ref=f"来源={s.get('source')}, 批次={s.get('import_batch')}")
            else:
                insert_sample(conn, s)
                insert_audit(conn, s.get("id"), "增量更新样本（ID已存在，覆盖写入）", operator,
                             evidence_ref=f"来源={s.get('source')}, 批次={s.get('import_batch')}")

        for d in all_dups:
            existing_by_id = conn.execute("SELECT id FROM samples WHERE id=?", (d.get("id"),)).fetchone()
            if not existing_by_id:
                insert_sample(conn, d)
                insert_audit(conn, d.get("id"), "补录样本（重复）", operator,
                             evidence_ref=f"来源={d.get('source')}, 批次={d.get('import_batch')}")

        for d in all_dups:
            mark_duplicate(conn, d["id"], d["duplicate_of"], operator)

        run_id = insert_run(conn, "incremental", previous_run_id=prev_run_id,
                            sample_count=len(truly_unique), notes=f"增量分层: {', '.join(strat_types)}")

        for s in truly_unique:
            if s.get("is_duplicate"):
                continue
            for stype in strat_types:
                if stype not in STRATIFY_FNS:
                    continue
                _, fn = STRATIFY_FNS[stype]
                stratum, confidence, reason, evidence = fn(s)
                insert_stratification(
                    conn, s["id"], run_id, stratum, stype,
                    confidence=confidence, evidence=evidence, auto_reason=reason,
                )
            update_sample_status(conn, s["id"], "stratified")
            insert_audit(conn, s["id"], "增量分层完成", operator,
                         evidence_ref=f"运行ID={run_id}")

        stratum_counts = _compute_stratum_counts(conn, run_id, strat_types)
        _save_metrics(conn, run_id, truly_unique, strat_types, stratum_counts)

        metrics_json = _build_metrics_json(conn, run_id)
        conn.execute("UPDATE runs SET metrics_json=? WHERE id=?",
                     (json.dumps(metrics_json, ensure_ascii=False), run_id))

    return {"run_id": run_id, "new_unique": len(truly_unique), "new_duplicates": len(all_dups),
            "db_duplicates": len(db_dups), "stratum_counts": stratum_counts, "metrics": metrics_json}


def _compute_stratum_counts(conn, run_id, strat_types):
    result = {}
    for stype in strat_types:
        rows = conn.execute(
            "SELECT stratum, COUNT(*) as cnt FROM stratification_results WHERE run_id=? AND stratum_type=? GROUP BY stratum",
            (run_id, stype),
        ).fetchall()
        result[stype] = {r["stratum"]: r["cnt"] for r in rows}
    return result


def _save_metrics(conn, run_id, unique_samples, strat_types, stratum_counts):
    for stype in strat_types:
        total = sum(stratum_counts.get(stype, {}).values())
        for stratum, count in stratum_counts.get(stype, {}).items():
            ratio = count / total if total > 0 else 0
            insert_metric_snapshot(conn, run_id, f"{stype}:{stratum}", "样本数", count, count)
            insert_metric_snapshot(conn, run_id, f"{stype}:{stratum}", "占比", ratio, count)

    correct_count = 0
    has_ref_count = 0
    for s in unique_samples:
        if s.get("is_duplicate"):
            continue
        ref = s.get("reference_result")
        pred = s.get("human_label") or s.get("model_output")
        if ref:
            has_ref_count += 1
            if pred and pred.strip() == ref.strip():
                correct_count += 1

    if has_ref_count > 0:
        accuracy = correct_count / has_ref_count
        insert_metric_snapshot(conn, run_id, "整体", "准确率", accuracy, has_ref_count)
    insert_metric_snapshot(conn, run_id, "整体", "有效样本数", len([s for s in unique_samples if not s.get("is_duplicate")]), len(unique_samples))
    insert_metric_snapshot(conn, run_id, "整体", "重复样本数", len([s for s in unique_samples if s.get("is_duplicate")]), len(unique_samples))


def _build_metrics_json(conn, run_id):
    rows = conn.execute("SELECT * FROM metric_snapshots WHERE run_id=?", (run_id,)).fetchall()
    result = {}
    for r in rows:
        key = r["stratum"]
        if key not in result:
            result[key] = {}
        result[key][r["metric_name"]] = {"value": r["metric_value"], "sample_count": r["sample_count"]}
    return result


def compare_runs(run_id_a: str, run_id_b: str) -> dict:
    with get_conn() as conn:
        metrics_a = {r["stratum"]: {r["metric_name"]: r["metric_value"]} for r in
                     conn.execute("SELECT * FROM metric_snapshots WHERE run_id=?", (run_id_a,)).fetchall()}
        metrics_b = {r["stratum"]: {r["metric_name"]: r["metric_value"]} for r in
                     conn.execute("SELECT * FROM metric_snapshots WHERE run_id=?", (run_id_b,)).fetchall()}

        run_a = conn.execute("SELECT * FROM runs WHERE id=?", (run_id_a,)).fetchone()
        run_b = conn.execute("SELECT * FROM runs WHERE id=?", (run_id_b,)).fetchone()

        strat_a = conn.execute(
            "SELECT sample_id, stratum_type, stratum FROM stratification_results WHERE run_id=?",
            (run_id_a,),
        ).fetchall()
        strat_b = conn.execute(
            "SELECT sample_id, stratum_type, stratum FROM stratification_results WHERE run_id=?",
            (run_id_b,),
        ).fetchall()

    strat_a_map = {(r["sample_id"], r["stratum_type"]): r["stratum"] for r in strat_a}
    strat_b_map = {(r["sample_id"], r["stratum_type"]): r["stratum"] for r in strat_b}

    sample_changes = []
    for key, stratum_a in strat_a_map.items():
        stratum_b = strat_b_map.get(key)
        if stratum_b and stratum_b != stratum_a:
            sample_changes.append({
                "sample_id": key[0],
                "stratum_type": key[1],
                "before": stratum_a,
                "after": stratum_b,
            })

    new_in_b = [k for k in strat_b_map if k not in strat_a_map]
    removed_from_a = [k for k in strat_a_map if k not in strat_b_map]

    metric_diffs = {}
    all_strata = set(list(metrics_a.keys()) + list(metrics_b.keys()))
    for stratum in all_strata:
        ma = metrics_a.get(stratum, {})
        mb = metrics_b.get(stratum, {})
        all_metrics = set(list(ma.keys()) + list(mb.keys()))
        diffs = {}
        for m in all_metrics:
            va = ma.get(m, 0)
            vb = mb.get(m, 0)
            diffs[m] = {"before": va, "after": vb, "change": vb - va}
        metric_diffs[stratum] = diffs

    return {
        "run_a": row_to_dict(run_a),
        "run_b": row_to_dict(run_b),
        "metric_changes": metric_diffs,
        "sample_stratum_changes": sample_changes,
        "new_samples_count": len(new_in_b),
        "removed_samples_count": len(removed_from_a),
        "explanation": _generate_comparison_explanation(metric_diffs, sample_changes, new_in_b, removed_from_a),
    }


def _generate_comparison_explanation(metric_diffs, sample_changes, new_in_b, removed_from_a):
    parts = []
    parts.append(f"这次重跑和上次比，指标和样本变化如下：")

    changed_metrics = []
    for stratum, diffs in metric_diffs.items():
        for m, d in diffs.items():
            if abs(d["change"]) > 0.001:
                changed_metrics.append(f"「{stratum}」的{m}从 {d['before']:.4f} 变为 {d['after']:.4f}（变化 {d['change']:+.4f}）")

    if changed_metrics:
        parts.append("指标变化：" + "；".join(changed_metrics) + "。")
    else:
        parts.append("指标没有明显变化。")

    if sample_changes:
        changes_desc = [f"样本 {c['sample_id']} 在{c['stratum_type']}分层中从「{c['before']}」变为「{c['after']}」" for c in sample_changes[:5]]
        parts.append(f"有 {len(sample_changes)} 条样本的分层结果发生了变化：" + "；".join(changes_desc) +
                     ("等" if len(sample_changes) > 5 else "") + "。")
    else:
        parts.append("已有样本的分层结果没有变化。")

    if new_in_b:
        parts.append(f"本次新增了 {len(new_in_b)} 条样本的分层记录。")
    if removed_from_a:
        parts.append(f"上次有 {len(removed_from_a)} 条样本本次不在结果中。")

    parts.append("结论：指标变化主要由" +
                 ("样本增减" if new_in_b or removed_from_a else "分层调整") +
                 "驱动，" +
                 ("部分样本的分层发生了调整" if sample_changes else "样本层面没有分层调整") +
                 "。")
    return "".join(parts)


def generate_report(run_id: str) -> dict:
    with get_conn() as conn:
        run = conn.execute("SELECT * FROM runs WHERE id=?", (run_id,)).fetchone()
        if not run:
            return {"error": f"找不到运行记录 {run_id}"}

        metrics = conn.execute("SELECT * FROM metric_snapshots WHERE run_id=?", (run_id,)).fetchall()
        stratifications = conn.execute(
            """SELECT sr.*, s.content, s.domain, s.reference_result, s.model_output,
                      s.model_confidence, s.human_label, s.is_duplicate, s.duplicate_of, s.source
               FROM stratification_results sr
               JOIN samples s ON sr.sample_id = s.id
               WHERE sr.run_id=?
               ORDER BY sr.stratum_type, sr.stratum""",
            (run_id,),
        ).fetchall()

        stratum_counts = {}
        for r in stratifications:
            key = f"{r['stratum_type']}:{r['stratum']}"
            if key not in stratum_counts:
                stratum_counts[key] = []
            stratum_counts[key].append({
                "sample_id": r["sample_id"],
                "content": r["content"][:80] if r["content"] else "",
                "domain": r["domain"],
                "confidence": r["confidence"],
                "auto_reason": r["auto_reason"],
                "evidence": json.loads(r["evidence"]) if r["evidence"] else None,
                "source": r["source"],
            })

        metrics_by_stratum = {}
        for m in metrics:
            key = m["stratum"]
            if key not in metrics_by_stratum:
                metrics_by_stratum[key] = {}
            metrics_by_stratum[key][m["metric_name"]] = {
                "value": m["metric_value"],
                "sample_count": m["sample_count"],
            }

    report = _build_readable_report(run, metrics_by_stratum, stratum_counts)
    return {
        "run_id": run_id,
        "run_info": row_to_dict(run),
        "metrics": metrics_by_stratum,
        "strata": stratum_counts,
        "readable_report": report,
    }


def _build_readable_report(run, metrics_by_stratum, stratum_counts):
    lines = []
    run_type_labels = {"initial": "首次分层", "rerun": "重跑", "incremental": "增量处理"}
    rt = run_type_labels.get(run["run_type"], run["run_type"])

    lines.append(f"# 模型评测样本分层报告")
    lines.append(f"")
    lines.append(f"运行ID：{run['id']}  |  时间：{run['run_time']}  |  类型：{rt}")
    lines.append(f"样本数量：{run['sample_count']}  |  备注：{run['notes'] or '无'}")
    lines.append(f"")
    lines.append(f"---")
    lines.append(f"")

    for stratum_key, items in stratum_counts.items():
        stype, sname = stratum_key.split(":", 1)
        lines.append(f"## {stype} / {sname}（{len(items)} 条）")
        lines.append(f"")

        m = metrics_by_stratum.get(stratum_key, {})
        if m:
            metric_descs = []
            for mn, mv in m.items():
                if mn == "占比":
                    metric_descs.append(f"占比 {mv['value']:.1%}")
                elif mn == "样本数":
                    metric_descs.append(f"共 {int(mv['value'])} 条")
                else:
                    metric_descs.append(f"{mn}={mv['value']:.4f}")
            lines.append(f"指标：{'，'.join(metric_descs)}")
            lines.append(f"")

        lines.append(f"样本明细：")
        for item in items[:10]:
            src = f"（来源：{item['source']}）" if item.get("source") else ""
            reason = item.get("auto_reason", "")
            lines.append(f"  - [{item['sample_id']}] {item['content']}{src}  → {reason}")
        if len(items) > 10:
            lines.append(f"  ... 还有 {len(items) - 10} 条，详见数据")
        lines.append(f"")

    overall = metrics_by_stratum.get("整体", {})
    if overall:
        lines.append(f"---")
        lines.append(f"")
        lines.append(f"## 整体指标")
        for mn, mv in overall.items():
            if mn == "准确率":
                lines.append(f"- 准确率：{mv['value']:.1%}（基于 {mv['sample_count']} 条有引用的样本）")
            elif mn == "有效样本数":
                lines.append(f"- 有效样本数：{int(mv['value'])}")
            elif mn == "重复样本数":
                lines.append(f"- 重复样本数：{int(mv['value'])}")
            else:
                lines.append(f"- {mn}：{mv['value']}")
        lines.append(f"")

    lines.append(f"---")
    lines.append(f"报告生成时间：{now_iso()}")
    lines.append(f"说明：每条样本的分层判定均可回溯到具体证据字段，如有疑问请查看各样本的溯源日志。")

    return "\n".join(lines)
