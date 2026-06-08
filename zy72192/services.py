from database import get_conn, row_to_dict, rows_to_dicts
from datetime import datetime
import json
import random
from typing import Dict, List, Optional, Tuple, Any


def get_sample_detail(sample_id: str) -> Dict[str, Any]:
    conn = get_conn()
    c = conn.cursor()

    c.execute('SELECT * FROM samples WHERE sample_id = ?', (sample_id,))
    sample = row_to_dict(c.fetchone())

    c.execute('''SELECT e.*, m.version_name, m.threshold, m.threshold_note
                 FROM evaluation_logs e
                 JOIN model_versions m ON e.model_version_id = m.id
                 WHERE e.sample_id = ?
                 ORDER BY e.created_at DESC''', (sample_id,))
    evaluations = rows_to_dicts(c.fetchall())

    c.execute('''SELECT * FROM annotation_table 
                 WHERE sample_id = ?
                 ORDER BY annotated_at DESC''', (sample_id,))
    annotations = rows_to_dicts(c.fetchall())

    c.execute('''SELECT * FROM manual_reviews 
                 WHERE sample_id = ?
                 ORDER BY reviewed_at DESC''', (sample_id,))
    reviews = rows_to_dicts(c.fetchall())

    c.execute('''SELECT * FROM supplementary_notes 
                 WHERE sample_id = ?
                 ORDER BY created_at DESC''', (sample_id,))
    notes = rows_to_dicts(c.fetchall())

    c.execute('''SELECT * FROM label_conflicts 
                 WHERE sample_id = ?
                 ORDER BY detected_at DESC''', (sample_id,))
    conflicts = rows_to_dicts(c.fetchall())

    has_protected_review = any(r.get('override_protected') == 1 for r in reviews)

    current_result = None
    if reviews:
        current_result = {
            'source': 'manual',
            'result': reviews[0]['final_result'],
            'reviewer': reviews[0]['reviewer'],
            'at': reviews[0]['reviewed_at'],
            'note': reviews[0]['review_note'],
            'protected': reviews[0]['override_protected'] == 1
        }
    elif evaluations:
        current_result = {
            'source': 'model',
            'result': evaluations[0]['predict_result'],
            'score': evaluations[0]['predict_score'],
            'version': evaluations[0]['version_name'],
            'at': evaluations[0]['created_at'],
            'reasons': evaluations[0]['reasons']
        }

    conn.close()
    return {
        'sample': sample,
        'evaluations': evaluations,
        'annotations': annotations,
        'reviews': reviews,
        'notes': notes,
        'conflicts': conflicts,
        'has_protected_review': has_protected_review,
        'current_result': current_result
    }


def get_batch_list() -> List[Dict[str, Any]]:
    conn = get_conn()
    c = conn.cursor()
    c.execute('''SELECT b.*, m.version_name, m.threshold
                 FROM batch_runs b
                 JOIN model_versions m ON b.model_version_id = m.id
                 WHERE b.id IN (
                     SELECT MAX(id) FROM batch_runs GROUP BY batch_id
                 )
                 ORDER BY b.run_at DESC''')
    batches = rows_to_dicts(c.fetchall())
    conn.close()
    return batches


def _get_latest_run_id(conn, batch_id: str) -> Optional[int]:
    c = conn.cursor()
    c.execute('SELECT id FROM batch_runs WHERE batch_id = ? ORDER BY run_at DESC LIMIT 1', (batch_id,))
    row = c.fetchone()
    return row['id'] if row else None


def get_evaluation_list(batch_id: str) -> List[Dict[str, Any]]:
    conn = get_conn()
    c = conn.cursor()

    latest_run_id = _get_latest_run_id(conn, batch_id)

    c.execute('''SELECT e.*, s.image_url, s.prompt, s.source, s.tags,
                        m.version_name, m.threshold
                 FROM evaluation_logs e
                 JOIN samples s ON e.sample_id = s.sample_id
                 JOIN model_versions m ON e.model_version_id = m.id
                 WHERE e.batch_run_id = ?
                 ORDER BY e.predict_score DESC''', (latest_run_id,))

    evals = rows_to_dicts(c.fetchall())

    for ev in evals:
        sample_id = ev['sample_id']
        c.execute('SELECT * FROM manual_reviews WHERE sample_id = ? ORDER BY reviewed_at DESC LIMIT 1', (sample_id,))
        review = row_to_dict(c.fetchone())
        c.execute('SELECT * FROM label_conflicts WHERE sample_id = ? AND resolved = 0', (sample_id,))
        conflicts = rows_to_dicts(c.fetchall())

        if review:
            ev['final_result'] = review['final_result']
            ev['result_source'] = 'manual'
            ev['reviewer'] = review['reviewer']
            ev['review_protected'] = review['override_protected'] == 1
        else:
            ev['final_result'] = ev['predict_result']
            ev['result_source'] = 'model'
            ev['reviewer'] = None
            ev['review_protected'] = False

        ev['conflicts'] = conflicts
        ev['has_conflict'] = len(conflicts) > 0
        ev['needs_review'] = abs(ev['predict_score'] - ev['threshold']) < 0.1

    conn.close()
    return evals


def get_conflicts_list(batch_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_conn()
    c = conn.cursor()

    if batch_id:
        c.execute('''SELECT lc.*, s.image_url, s.prompt, e.predict_score
                     FROM label_conflicts lc
                     JOIN samples s ON lc.sample_id = s.sample_id
                     LEFT JOIN evaluation_logs e ON lc.evaluation_log_id = e.id
                     WHERE e.batch_id = ?
                     ORDER BY lc.detected_at DESC''', (batch_id,))
    else:
        c.execute('''SELECT lc.*, s.image_url, s.prompt, e.predict_score
                     FROM label_conflicts lc
                     JOIN samples s ON lc.sample_id = s.sample_id
                     LEFT JOIN evaluation_logs e ON lc.evaluation_log_id = e.id
                     ORDER BY lc.detected_at DESC''')

    conflicts = rows_to_dicts(c.fetchall())
    conn.close()
    return conflicts


def detect_conflicts(eval_id: int, sample_id: str, predict_result: int,
                     predict_score: float, evidence: List[Dict],
                     threshold: float) -> List[Dict[str, Any]]:
    conn = get_conn()
    c = conn.cursor()
    conflicts = []
    now = datetime.now().isoformat()

    for ev in evidence:
        if ev.get('type') == 'train_set_check' and ev.get('in_train'):
            conflict_desc = f'检测到训练样本泄漏，与训练集{ev.get("train_id")}相似度{ev.get("similarity", 0.98)}，该样本评测指标作废'
            c.execute('''INSERT INTO label_conflicts
                (sample_id, evaluation_log_id, conflict_type, description,
                 model_result, annotation_result, detected_at, resolved)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0)''', (
                sample_id, eval_id, 'sample_leakage', conflict_desc,
                predict_result, None, now
            ))
            conflicts.append({'type': 'sample_leakage', 'description': conflict_desc, 'severity': 'high'})

    c.execute('''SELECT * FROM annotation_table WHERE sample_id = ? AND caliber_version LIKE 'v2.0%'
                 ORDER BY annotated_at DESC LIMIT 1''', (sample_id,))
    anno = row_to_dict(c.fetchone())
    if anno and anno['is_copyright'] is not None:
        if anno['is_copyright'] != predict_result:
            conflict_desc = (f'模型预测结果({predict_score}，{"侵权" if predict_result == 1 else "非侵权"})'
                             f'与人工标注({"侵权" if anno["is_copyright"] == 1 else "非侵权"})不一致，'
                             f'建议重点复核判定边界')
            c.execute('''INSERT INTO label_conflicts
                (sample_id, evaluation_log_id, conflict_type, description,
                 model_result, annotation_result, detected_at, resolved)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0)''', (
                sample_id, eval_id, 'model_vs_annotation', conflict_desc,
                predict_result, anno['is_copyright'], now
            ))
            conflicts.append({'type': 'model_vs_annotation', 'description': conflict_desc, 'severity': 'medium'})

    conn.commit()
    conn.close()
    return conflicts


def submit_manual_review(sample_id: str, evaluation_log_id: int,
                         final_result: int, reviewer: str,
                         review_note: str, override_protected: bool = True) -> Dict[str, Any]:
    conn = get_conn()
    c = conn.cursor()

    c.execute('''SELECT * FROM manual_reviews 
                 WHERE sample_id = ? AND override_protected = 1
                 ORDER BY reviewed_at DESC LIMIT 1''', (sample_id,))
    existing_protected = row_to_dict(c.fetchone())

    if existing_protected:
        conn.close()
        return {
            'success': False,
            'error': f'该样本已有受保护的人工判罚（{existing_protected["reviewer"]}，{existing_protected["reviewed_at"]}），'
                     f'如需修改请先取消保护或联系管理员。原判罚：{"侵权" if existing_protected["final_result"] == 1 else "非侵权"}'
        }

    now = datetime.now().isoformat()
    c.execute('''INSERT INTO manual_reviews
        (sample_id, evaluation_log_id, final_result, reviewer, reviewed_at, review_note, override_protected)
        VALUES (?, ?, ?, ?, ?, ?, ?)''', (
        sample_id, evaluation_log_id, final_result, reviewer, now,
        review_note, 1 if override_protected else 0
    ))

    c.execute('''UPDATE label_conflicts SET resolved = 1 
                 WHERE sample_id = ? AND conflict_type = 'model_vs_annotation' AND resolved = 0''', (sample_id,))

    conn.commit()
    conn.close()
    return {'success': True, 'reviewed_at': now}


def add_supplementary_note(sample_id: str, batch_id: str, note_content: str,
                           note_type: str, operator: str) -> Dict[str, Any]:
    conn = get_conn()
    c = conn.cursor()

    detail = get_sample_detail(sample_id)
    old_status_parts = []
    if detail['current_result']:
        src = detail['current_result']['source']
        res = '侵权' if detail['current_result']['result'] == 1 else '非侵权'
        old_status_parts.append(f'当前判定：{src}，{res}')
    if detail['notes']:
        old_status_parts.append(f'已有备注{len(detail["notes"])}条')
    if detail['conflicts']:
        unresolved = [cf for cf in detail['conflicts'] if cf.get('resolved') == 0]
        if unresolved:
            old_status_parts.append(f'未解决冲突{len(unresolved)}条')

    diff_description = '补录前状态：' + ('；'.join(old_status_parts) if old_status_parts else '无特殊状态')
    diff_description += f' | 补录内容类型：{note_type}'
    diff_description += ' | 补录影响：'
    if note_type == 'caliber_update':
        diff_description += '判定口径更新，可能影响同类样本判罚标准'
    elif note_type == 'special_case':
        diff_description += '特批案例，优先级高于模型和一般规则'
    elif note_type == 'data_correction':
        diff_description += '数据修正，原标注/评测数据可能有误'
    else:
        diff_description += '普通备注，不改变判罚结果'

    now = datetime.now().isoformat()
    c.execute('''INSERT INTO supplementary_notes
        (sample_id, batch_id, note_content, note_type, operator, created_at, diff_description)
        VALUES (?, ?, ?, ?, ?, ?, ?)''', (
        sample_id, batch_id, note_content, note_type, operator, now, diff_description
    ))

    conn.commit()
    conn.close()
    return {'success': True, 'created_at': now, 'diff_description': diff_description}


def simulate_model_predict(sample_id: str, model_version_id: int, threshold: float) -> Dict[str, Any]:
    random.seed(hash(sample_id + str(model_version_id)) % 2**32)
    base_score = random.uniform(0, 1)
    predict_result = 1 if base_score >= threshold else 0

    evidence = []
    reasons_parts = []

    if base_score > 0.8:
        evidence.append({'type': 'character_detection', 'detected': 'known_character', 'confidence': 0.95})
        evidence.append({'type': 'image_similarity', 'top1_match': 'copyrighted_work', 'similarity': 0.88})
        reasons_parts.append(f'检测到知名版权角色，与官方素材相似度{base_score:.2f}')
    elif base_score > 0.5:
        evidence.append({'type': 'style_classification', 'top_style': 'specific_artist_style', 'confidence': 0.82})
        evidence.append({'type': 'image_similarity', 'top1_match': 'reference_work', 'similarity': 0.62})
        reasons_parts.append(f'风格分类匹配特定艺术家风格，参考作品相似度{base_score:.2f}')
    else:
        evidence.append({'type': 'image_similarity', 'top1_match': 'public_dataset', 'similarity': 0.15})
        evidence.append({'type': 'text_matching', 'prompt_match': 'no_copyright_keyword', 'score': 0.05})
        reasons_parts.append('未匹配到版权作品特征，提示词无版权关键词')

    reasons = '；'.join(reasons_parts)
    return {
        'score': base_score,
        'result': predict_result,
        'evidence': evidence,
        'reasons': reasons
    }


def run_batch_evaluation(batch_id: str, model_version_id: int, operator: str,
                         force_override: bool = False) -> Dict[str, Any]:
    conn = get_conn()
    c = conn.cursor()

    c.execute('SELECT * FROM model_versions WHERE id = ?', (model_version_id,))
    model = row_to_dict(c.fetchone())
    if not model:
        conn.close()
        return {'success': False, 'error': '模型版本不存在'}

    threshold = model['threshold']

    c.execute('SELECT * FROM samples WHERE batch_id = ?', (batch_id,))
    samples = rows_to_dicts(c.fetchall())
    if not samples:
        conn.close()
        return {'success': False, 'error': '批次无样本'}

    now = datetime.now().isoformat()

    c.execute('''INSERT INTO batch_runs
        (batch_id, model_version_id, run_at, operator, metrics_json, sample_count)
        VALUES (?, ?, ?, ?, ?, ?)''', (
        batch_id, model_version_id, now, operator,
        json.dumps({}), len(samples)
    ))
    batch_run_id = c.lastrowid

    results = []
    skipped_protected = []
    conflicts_found = []

    for sample in samples:
        sid = sample['sample_id']

        c.execute('''SELECT * FROM manual_reviews 
                     WHERE sample_id = ? AND override_protected = 1''', (sid,))
        protected = row_to_dict(c.fetchone())
        if protected and not force_override:
            skipped_protected.append({
                'sample_id': sid,
                'reviewer': protected['reviewer'],
                'final_result': protected['final_result']
            })
            continue

        pred = simulate_model_predict(sid, model_version_id, threshold)

        c.execute('''INSERT INTO evaluation_logs
            (sample_id, model_version_id, batch_id, batch_run_id, predict_score, predict_result,
             evidence_json, reasons, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''', (
            sid, model_version_id, batch_id, batch_run_id,
            pred['score'], pred['result'],
            json.dumps(pred['evidence']), pred['reasons'], now
        ))
        eval_id = c.lastrowid

        conflicts = detect_conflicts(eval_id, sid, pred['result'], pred['score'],
                                     pred['evidence'], threshold)
        if conflicts:
            conflicts_found.extend([{'sample_id': sid, **cf} for cf in conflicts])

        results.append({
            'sample_id': sid,
            'score': pred['score'],
            'result': pred['result']
        })

    total = len(samples)
    processed = len(results)
    positives = sum(1 for r in results if r['result'] == 1)
    negatives = processed - positives
    needs_review = sum(1 for r in results if abs(r['score'] - threshold) < 0.1)
    conflicts_count = len(conflicts_found)

    metrics = {
        'total': total,
        'processed': processed,
        'skipped_protected': len(skipped_protected),
        'positives': positives,
        'negatives': negatives,
        'needs_review': needs_review,
        'conflicts': conflicts_count,
        'positive_rate': positives / processed if processed > 0 else 0
    }

    c.execute('''UPDATE batch_runs SET metrics_json = ?, sample_count = ? WHERE id = ?''',
              (json.dumps(metrics), total, batch_run_id))

    conn.commit()
    conn.close()

    return {
        'success': True,
        'batch_id': batch_id,
        'batch_run_id': batch_run_id,
        'run_at': now,
        'metrics': metrics,
        'skipped_protected': skipped_protected,
        'conflicts_found': conflicts_found
    }


def compare_batch_runs(batch_id: str, run1_id: int, run2_id: int) -> Dict[str, Any]:
    conn = get_conn()
    c = conn.cursor()

    c.execute('''SELECT b.*, m.version_name, m.threshold, m.threshold_note
                 FROM batch_runs b JOIN model_versions m ON b.model_version_id = m.id
                 WHERE b.id = ?''', (run1_id,))
    run1 = row_to_dict(c.fetchone())

    c.execute('''SELECT b.*, m.version_name, m.threshold, m.threshold_note
                 FROM batch_runs b JOIN model_versions m ON b.model_version_id = m.id
                 WHERE b.id = ?''', (run2_id,))
    run2 = row_to_dict(c.fetchone())

    if not run1 or not run2:
        conn.close()
        return {'success': False, 'error': '运行记录不存在'}

    metrics1 = run1['metrics_json'] if isinstance(run1['metrics_json'], dict) else json.loads(run1['metrics_json'])
    metrics2 = run2['metrics_json'] if isinstance(run2['metrics_json'], dict) else json.loads(run2['metrics_json'])

    c.execute('''SELECT sample_id, predict_score, predict_result FROM evaluation_logs
                 WHERE batch_run_id = ?''', (run2_id,))
    new_evals = {e['sample_id']: row_to_dict(e) for e in c.fetchall()}

    c.execute('''SELECT sample_id, predict_score, predict_result FROM evaluation_logs
                 WHERE batch_run_id = ?''', (run1_id,))
    old_evals = {e['sample_id']: row_to_dict(e) for e in c.fetchall()}

    metric_changes = {}
    for k in set(list(metrics1.keys()) + list(metrics2.keys())):
        if k in metrics1 and k in metrics2:
            v1, v2 = metrics1[k], metrics2[k]
            if isinstance(v1, (int, float)) and isinstance(v2, (int, float)):
                diff = v2 - v1
                change_type = 'up' if diff > 0 else 'down' if diff < 0 else 'same'
                metric_changes[k] = {
                    'old': v1, 'new': v2, 'diff': diff, 'change_type': change_type
                }

    sample_changes = []
    all_samples = set(list(new_evals.keys()) + list(old_evals.keys()))
    for sid in sorted(all_samples):
        old = old_evals.get(sid)
        new = new_evals.get(sid)
        change = None
        if old and new:
            if old['predict_result'] != new['predict_result']:
                change = 'result_flip'
            elif abs(old['predict_score'] - new['predict_score']) > 0.05:
                change = 'score_shift'
            else:
                change = 'stable'
        elif new and not old:
            change = 'new_sample'
        elif old and not new:
            change = 'removed_sample'

        if change != 'stable':
            sample_changes.append({
                'sample_id': sid,
                'old_score': old['predict_score'] if old else None,
                'old_result': old['predict_result'] if old else None,
                'new_score': new['predict_score'] if new else None,
                'new_result': new['predict_result'] if new else None,
                'change': change
            })

    metric_explanations = []
    if metric_changes.get('positives', {}).get('change_type') == 'up':
        metric_explanations.append(
            f"新增侵权样本{metric_changes['positives']['diff']}个，"
            f"主要原因：{run2['version_name']}阈值{run2['threshold']}相比{run1['version_name']}的{run1['threshold']}"
            f"{'更严格' if run2['threshold'] < run1['threshold'] else '更宽松'}"
        )
    if metric_changes.get('conflicts', {}).get('diff', 0) > 0:
        metric_explanations.append(
            f"新增冲突{metric_changes['conflicts']['diff']}条，"
            f"请检查冲突列表确认是否为标注问题或模型边界问题"
        )

    sample_explanations = []
    result_flips = [s for s in sample_changes if s['change'] == 'result_flip']
    score_shifts = [s for s in sample_changes if s['change'] == 'score_shift']
    if result_flips:
        sample_explanations.append(
            f"共有{len(result_flips)}个样本判罚结果翻转：" +
            '、'.join([f"{s['sample_id']}({'侵权→非侵权' if s['old_result']==1 else '非侵权→侵权'})" for s in result_flips[:3]])
        )
    if score_shifts:
        sample_explanations.append(
            f"共有{len(score_shifts)}个样本分数变动超过0.05但未改变判罚结果"
        )

    threshold_note_diff = ''
    if run1['threshold_note'] != run2['threshold_note']:
        threshold_note_diff = f"阈值备注变化：「{run1['threshold_note']}」→「{run2['threshold_note']}」"

    conn.close()
    return {
        'success': True,
        'run1': {
            'id': run1['id'], 'version': run1['version_name'],
            'threshold': run1['threshold'], 'note': run1['threshold_note'],
            'run_at': run1['run_at'], 'metrics': metrics1
        },
        'run2': {
            'id': run2['id'], 'version': run2['version_name'],
            'threshold': run2['threshold'], 'note': run2['threshold_note'],
            'run_at': run2['run_at'], 'metrics': metrics2
        },
        'metric_changes': metric_changes,
        'sample_changes': sample_changes,
        'explanations': {
            'threshold_note_diff': threshold_note_diff,
            'metric_explanations': metric_explanations,
            'sample_explanations': sample_explanations
        }
    }


def get_batch_runs(batch_id: str) -> List[Dict[str, Any]]:
    conn = get_conn()
    c = conn.cursor()
    c.execute('''SELECT b.*, m.version_name, m.threshold
                 FROM batch_runs b JOIN model_versions m ON b.model_version_id = m.id
                 WHERE b.batch_id = ? ORDER BY b.run_at DESC''', (batch_id,))
    runs = rows_to_dicts(c.fetchall())
    conn.close()
    return runs


def get_latest_batch_info(batch_id: str) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    c = conn.cursor()
    c.execute('''SELECT b.*, m.version_name, m.threshold, m.threshold_note
                 FROM batch_runs b
                 JOIN model_versions m ON b.model_version_id = m.id
                 WHERE b.batch_id = ?
                 ORDER BY b.run_at DESC LIMIT 1''', (batch_id,))
    info = row_to_dict(c.fetchone())
    conn.close()
    return info


def export_batch_results(batch_id: str, operator: str,
                         export_type: str = 'full') -> Dict[str, Any]:
    conn = get_conn()
    c = conn.cursor()

    evals = get_evaluation_list(batch_id)

    export_rows = []
    for ev in evals:
        detail = get_sample_detail(ev['sample_id'])

        conflicts_info = []
        for c_item in detail['conflicts']:
            status = '已解决' if c_item.get('resolved') == 1 else '待处理'
            conflicts_info.append(f"[{c_item['conflict_type']}]{status}:{c_item['description'][:50]}")

        reasons = []
        if ev['result_source'] == 'manual':
            reasons.append(f"人工判罚（{ev['reviewer']}）")
            if ev.get('review_protected'):
                reasons.append('受保护，不可被模型覆盖')
        if detail['evaluations']:
            model_reason = detail['evaluations'][0].get('reasons', '')
            if model_reason:
                reasons.append(f"模型原因：{model_reason}")
        if detail['annotations']:
            anno = detail['annotations'][0]
            reasons.append(f"口径{anno.get('caliber_version','')}：{anno.get('note','')}")
        for note in detail['notes']:
            reasons.append(f"备注[{note['note_type']}]：{note['note_content']}")

        export_rows.append({
            'sample_id': ev['sample_id'],
            'prompt': ev['prompt'],
            'tags': ev['tags'],
            'source': ev['source'],
            'model_version': ev['version_name'],
            'model_threshold': ev['threshold'],
            'model_score': ev['predict_score'],
            'model_result': '侵权' if ev['predict_result'] == 1 else '非侵权',
            'final_result': '侵权' if ev['final_result'] == 1 else '非侵权',
            'result_source': ev['result_source'],
            'reviewer': ev['reviewer'],
            'has_protected_review': '是' if detail['has_protected_review'] else '否',
            'has_conflict': '是' if ev['has_conflict'] else '否',
            'conflicts_info': '；'.join(conflicts_info),
            'copyright_reasons': ' | '.join(reasons),
            'image_url': ev['image_url']
        })

    now = datetime.now().isoformat()
    c.execute('''INSERT INTO export_records
        (batch_id, export_at, export_type, export_content_json, operator)
        VALUES (?, ?, ?, ?, ?)''', (
        batch_id, now, export_type, json.dumps(export_rows, ensure_ascii=False), operator
    ))

    conn.commit()
    conn.close()

    return {
        'success': True,
        'export_at': now,
        'count': len(export_rows),
        'columns': list(export_rows[0].keys()) if export_rows else [],
        'rows': export_rows
    }


def get_model_versions() -> List[Dict[str, Any]]:
    conn = get_conn()
    c = conn.cursor()
    c.execute('SELECT * FROM model_versions ORDER BY created_at DESC')
    versions = rows_to_dicts(c.fetchall())
    conn.close()
    return versions
