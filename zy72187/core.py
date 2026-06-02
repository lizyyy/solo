import json
import re
import uuid
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from pathlib import Path

from database import (
    init_db, insert_sample, insert_model_version, insert_model_output,
    insert_threshold, insert_rule_distillation, insert_review,
    insert_note, insert_report, insert_comparison,
    get_rule_distillation, get_distillation_notes, get_distillation_reviews,
    list_rule_distillations, list_reports, get_report, get_thresholds,
    get_model_versions, get_sample
)


def initialize():
    init_db()


def generate_id(prefix: str) -> str:
    return f"{prefix}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"


def import_samples_from_file(file_path: str, source_type: str = "file") -> List[str]:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    
    imported_ids = []
    content = path.read_text(encoding='utf-8')
    
    if path.suffix == '.json':
        data = json.loads(content)
        if isinstance(data, list):
            for idx, item in enumerate(data):
                sample_id = item.get('sample_id', f"sample_{idx}")
                sample_content = item.get('content', json.dumps(item, ensure_ascii=False))
                insert_sample(
                    sample_id=sample_id,
                    content=sample_content,
                    source_type=source_type,
                    source_file=str(path),
                    metadata=item
                )
                imported_ids.append(sample_id)
        elif isinstance(data, dict):
            sample_id = data.get('sample_id', path.stem)
            sample_content = data.get('content', content)
            insert_sample(
                sample_id=sample_id,
                content=sample_content,
                source_type=source_type,
                source_file=str(path),
                metadata=data
            )
            imported_ids.append(sample_id)
    else:
        sample_id = path.stem
        insert_sample(
            sample_id=sample_id,
            content=content,
            source_type=source_type,
            source_file=str(path)
        )
        imported_ids.append(sample_id)
    
    return imported_ids


def import_model_outputs(file_path: str, model_version: str, description: str = None):
    insert_model_version(model_version, description)
    
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    
    content = path.read_text(encoding='utf-8')
    data = json.loads(content)
    
    if isinstance(data, list):
        for item in data:
            sample_id = item.get('sample_id')
            output_text = item.get('output_text', item.get('output', ''))
            confidence = item.get('confidence')
            prediction_label = item.get('prediction_label', item.get('label'))
            raw_log = item.get('raw_log', json.dumps(item, ensure_ascii=False))
            
            if sample_id:
                insert_model_output(
                    sample_id=sample_id,
                    model_version=model_version,
                    output_text=output_text,
                    confidence=confidence,
                    prediction_label=prediction_label,
                    raw_log=raw_log
                )
    elif isinstance(data, dict):
        sample_id = data.get('sample_id', path.stem)
        output_text = data.get('output_text', data.get('output', content))
        confidence = data.get('confidence')
        prediction_label = data.get('prediction_label', data.get('label'))
        insert_model_output(
            sample_id=sample_id,
            model_version=model_version,
            output_text=output_text,
            confidence=confidence,
            prediction_label=prediction_label,
            raw_log=content
        )


def import_thresholds(file_path: str, model_version: str = None, created_by: str = 'system'):
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    
    content = path.read_text(encoding='utf-8')
    data = json.loads(content)
    
    if isinstance(data, list):
        for item in data:
            insert_threshold(
                rule_name=item.get('rule_name'),
                threshold_value=item.get('threshold_value'),
                comparison_type=item.get('comparison_type', '>='),
                description=item.get('description'),
                model_version=item.get('model_version', model_version),
                created_by=item.get('created_by', created_by)
            )


def extract_evidence_from_log(log_content: str) -> Tuple[List[str], bool]:
    evidence_snippets = []
    has_missing_reference = False
    
    patterns = [
        r'根据[《"「]([^》"」]+)[》"」]',
        r'引用[《"「]([^》"」]+)[》"」]',
        r'来源[：:]\s*([^\n,，]+)',
        r'依据[《"「]([^》"」]+)[》"」]',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, log_content)
        evidence_snippets.extend(matches)
    
    no_ref_patterns = [
        r'无引用',
        r'没有引用',
        r'引用缺失',
        r'无法找到来源',
        r'出处不明',
    ]
    
    for pattern in no_ref_patterns:
        if re.search(pattern, log_content):
            has_missing_reference = True
            break
    
    if not evidence_snippets and not has_missing_reference:
        has_missing_reference = True
    
    return list(set(evidence_snippets)), has_missing_reference


def distill_rule_from_output(
    sample_id: str,
    model_version: str,
    output_text: str,
    rule_type: str = "异常交易",
    evidence_source: str = None
) -> str:
    distillation_id = generate_id("rule")
    
    evidence_snippets, has_missing_reference = extract_evidence_from_log(output_text)
    
    confidence_match = re.search(r'置信度[：:]\s*(\d+\.?\d*)', output_text)
    confidence = float(confidence_match.group(1)) if confidence_match else None
    
    rule_content = output_text
    
    insert_rule_distillation(
        distillation_id=distillation_id,
        sample_id=sample_id,
        model_version=model_version,
        rule_content=rule_content,
        rule_type=rule_type,
        confidence=confidence,
        evidence_source=evidence_source,
        evidence_snippets=evidence_snippets,
        has_missing_reference=has_missing_reference
    )
    
    return distillation_id


def batch_distill_rules(model_version: str, rule_type: str = "异常交易") -> List[str]:
    import sqlite3
    from database import DB_PATH
    
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT sample_id, output_text, raw_log FROM model_outputs
        WHERE model_version = ?
    ''', (model_version,))
    
    distillation_ids = []
    for row in cursor.fetchall():
        dist_id = distill_rule_from_output(
            sample_id=row['sample_id'],
            model_version=model_version,
            output_text=row['output_text'],
            rule_type=rule_type,
            evidence_source=row['raw_log'] if row['raw_log'] else None
        )
        distillation_ids.append(dist_id)
    
    conn.close()
    return distillation_ids


def add_review(distillation_id: str, reviewer: str, review_result: str,
               review_comment: str = None, corrected_rule: str = None):
    if review_result not in ['通过', '不通过', '需要修改']:
        raise ValueError("review_result must be one of: 通过, 不通过, 需要修改")
    
    insert_review(
        distillation_id=distillation_id,
        reviewer=reviewer,
        review_result=review_result,
        review_comment=review_comment,
        corrected_rule=corrected_rule
    )


def add_note(distillation_id: str, note_content: str, created_by: str):
    insert_note(
        distillation_id=distillation_id,
        note_content=note_content,
        created_by=created_by
    )


def get_distillation_trace(distillation_id: str) -> Dict:
    rule = get_rule_distillation(distillation_id)
    if not rule:
        return {}
    
    sample = get_sample(rule['sample_id'])
    notes = get_distillation_notes(distillation_id)
    reviews = get_distillation_reviews(distillation_id)
    
    return {
        'rule': rule,
        'sample': sample,
        'notes': notes,
        'reviews': reviews
    }


def calculate_metrics(model_version: str) -> Dict:
    rules = list_rule_distillations(model_version)
    if not rules:
        return {}
    
    total_rules = len(rules)
    with_missing_ref = sum(1 for r in rules if r['has_missing_reference'])
    avg_confidence = sum(r['confidence'] or 0 for r in rules) / total_rules if total_rules > 0 else 0
    
    import sqlite3
    from database import DB_PATH
    
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT review_result, COUNT(*) as cnt FROM reviews r
        JOIN rule_distillations rd ON r.distillation_id = rd.distillation_id
        WHERE rd.model_version = ?
        GROUP BY review_result
    ''', (model_version,))
    
    review_stats = {}
    for row in cursor.fetchall():
        review_stats[row['review_result']] = row['cnt']
    
    conn.close()
    
    return {
        'total_rules': total_rules,
        'rules_with_missing_reference': with_missing_ref,
        'missing_reference_rate': with_missing_ref / total_rules if total_rules > 0 else 0,
        'avg_confidence': avg_confidence,
        'review_stats': review_stats
    }


def compare_versions(base_version: str, target_version: str) -> Dict:
    base_metrics = calculate_metrics(base_version)
    target_metrics = calculate_metrics(target_version)
    
    base_rules = {r['distillation_id']: r for r in list_rule_distillations(base_version)}
    target_rules = {r['distillation_id']: r for r in list_rule_distillations(target_version)}
    
    base_sample_ids = {r['sample_id'] for r in base_rules.values()}
    target_sample_ids = {r['sample_id'] for r in target_rules.values()}
    
    new_samples = target_sample_ids - base_sample_ids
    removed_samples = base_sample_ids - target_sample_ids
    common_samples = base_sample_ids & target_sample_ids
    
    sample_changes = {
        'new_samples': list(new_samples),
        'removed_samples': list(removed_samples),
        'common_samples': list(common_samples)
    }
    
    metric_changes = {}
    for key in ['total_rules', 'rules_with_missing_reference', 'missing_reference_rate', 'avg_confidence']:
        base_val = base_metrics.get(key, 0)
        target_val = target_metrics.get(key, 0)
        if isinstance(base_val, (int, float)) and isinstance(target_val, (int, float)) and base_val != 0:
            change_pct = (target_val - base_val) / base_val * 100
        else:
            change_pct = None
        metric_changes[key] = {
            'base': base_val,
            'target': target_val,
            'change_pct': change_pct
        }
    
    comparison_id = generate_id("comp")
    
    result = {
        'comparison_id': comparison_id,
        'base_version': base_version,
        'target_version': target_version,
        'base_metrics': base_metrics,
        'target_metrics': target_metrics,
        'metric_changes': metric_changes,
        'sample_changes': sample_changes,
        'compared_at': datetime.now().isoformat()
    }
    
    insert_comparison(
        comparison_id=comparison_id,
        base_version=base_version,
        target_version=target_version,
        comparison_result=result,
        metric_changes=metric_changes,
        sample_changes=sample_changes
    )
    
    return result


def generate_report(model_version: str, report_name: str = None, 
                    created_by: str = 'system') -> str:
    report_id = generate_id("report")
    
    if not report_name:
        report_name = f"规则蒸馏报告_{model_version}_{datetime.now().strftime('%Y%m%d')}"
    
    metrics = calculate_metrics(model_version)
    rules = list_rule_distillations(model_version)
    thresholds = get_thresholds(model_version)
    
    report_content = {
        'report_id': report_id,
        'report_name': report_name,
        'model_version': model_version,
        'generated_at': datetime.now().isoformat(),
        'metrics': metrics,
        'thresholds': thresholds,
        'rules': rules
    }
    
    insert_report(
        report_id=report_id,
        report_name=report_name,
        model_version=model_version,
        report_content=json.dumps(report_content, ensure_ascii=False, indent=2),
        created_by=created_by
    )
    
    return report_id


def export_report(report_id: str, output_path: str):
    report = get_report(report_id)
    if not report:
        raise FileNotFoundError(f"Report not found: {report_id}")
    
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(report['report_content'], encoding='utf-8')


def export_distillation(distillation_id: str, output_path: str):
    trace = get_distillation_trace(distillation_id)
    
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(trace, ensure_ascii=False, indent=2), encoding='utf-8')


def get_all_versions() -> List[str]:
    return get_model_versions()


def get_all_reports() -> List[Dict]:
    return list_reports()


def get_all_distillations(model_version: str = None) -> List[Dict]:
    return list_rule_distillations(model_version)


def get_all_thresholds(model_version: str = None) -> List[Dict]:
    return get_thresholds(model_version)
