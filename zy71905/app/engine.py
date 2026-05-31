import csv
import os
from datetime import datetime
from collections import defaultdict
from app.db import get_db

EXPORTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'exports')
os.makedirs(EXPORTS_DIR, exist_ok=True)


def generate_report(score_id=None, start_date='', end_date=''):
    conn = get_db()

    query = """
        SELECT c.*, s.title as score_title, s.pdf_path as score_pdf_path,
               s.voice_part as score_voice_part, s.pdf_hash
        FROM checkins c
        JOIN scores s ON c.score_id = s.id
        WHERE 1=1
    """
    params = []
    if score_id:
        query += " AND c.score_id = ?"
        params.append(score_id)
    if start_date:
        query += " AND c.checkin_date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND c.checkin_date <= ?"
        params.append(end_date)
    query += " ORDER BY s.title, c.voice_part, c.checkin_date"

    rows = conn.execute(query, params).fetchall()
    if not rows:
        conn.close()
        return {'overview': {}, 'by_score': [], 'anomalies': [], 'evidence_links': []}

    by_score = defaultdict(list)
    by_part = defaultdict(list)
    all_records = []

    for r in rows:
        d = dict(r)
        by_score[d['score_title']].append(d)
        by_part[d['voice_part']].append(d)
        all_records.append(d)

    total = len(all_records)
    confirmed = sum(1 for r in all_records if r['status'] == 'confirmed')
    pending = sum(1 for r in all_records if r['status'] == 'pending')
    missing_recording = sum(1 for r in all_records if not r['recording_exists'])
    no_pdf_change = len(set(r['pdf_hash'] for r in all_records))

    overview = {
        'total_records': total,
        'confirmed': confirmed,
        'pending': pending,
        'confirmation_rate': round(confirmed / total * 100, 1) if total else 0,
        'missing_recording_count': missing_recording,
        'recording_missing_rate': round(missing_recording / total * 100, 1) if total else 0,
        'unique_scores': len(by_score),
        'unique_pdf_versions': no_pdf_change,
        'date_range': {
            'earliest': min(r['checkin_date'] for r in all_records),
            'latest': max(r['checkin_date'] for r in all_records)
        }
    }

    score_reports = []
    evidence_links = []

    for title, records in by_score.items():
        score_id_val = records[0]['score_id']
        part_stats = {}
        for r in records:
            vp = r['voice_part']
            if vp not in part_stats:
                part_stats[vp] = {'total': 0, 'confirmed': 0, 'missing_recording': 0}
            part_stats[vp]['total'] += 1
            if r['status'] == 'confirmed':
                part_stats[vp]['confirmed'] += 1
            if not r['recording_exists']:
                part_stats[vp]['missing_recording'] += 1

        summaries = conn.execute(
            "SELECT id, summary_date, content, author FROM rehearsal_summaries WHERE score_id = ? ORDER BY summary_date DESC",
            (score_id_val,)
        ).fetchall()

        score_report = {
            'score_id': score_id_val,
            'score_title': title,
            'voice_part': records[0]['score_voice_part'],
            'total_checkins': len(records),
            'confirmed': sum(1 for r in records if r['status'] == 'confirmed'),
            'missing_recording': sum(1 for r in records if not r['recording_exists']),
            'part_stats': part_stats,
            'pdf_url': f"/api/scores/{score_id_val}/pdf",
            'records': [{
                'id': r['id'],
                'student_name': r['student_name'],
                'voice_part': r['voice_part'],
                'checkin_date': r['checkin_date'],
                'status': r['status'],
                'manual_confirmed': r['manual_confirmed'],
                'confirmed_by': r['confirmed_by'],
                'recording_exists': r['recording_exists'],
                'recording_url': f"/api/recordings/{r['recording_path']}" if r['recording_path'] and r['recording_exists'] else None,
                'evidence_url': f"/api/checkins/{r['id']}/evidence",
                'remark': r['remark']
            } for r in records],
            'rehearsal_summaries': [dict(s) for s in summaries]
        }
        score_reports.append(score_report)

        for r in records:
            link = {
                'checkin_id': r['id'],
                'student_name': r['student_name'],
                'voice_part': r['voice_part'],
                'checkin_date': r['checkin_date'],
                'score_pdf_url': f"/api/scores/{score_id_val}/pdf",
                'recording_url': f"/api/recordings/{r['recording_path']}" if r['recording_path'] and r['recording_exists'] else None,
                'recording_missing': bool(r['recording_path']) and not r['recording_exists'],
                'no_recording_at_all': not r['recording_path'],
                'has_confirmation': bool(r['manual_confirmed']),
                'confirmed_by': r['confirmed_by'],
                'evidence_url': f"/api/checkins/{r['id']}/evidence",
                'rehearsal_summaries_count': len(summaries)
            }
            evidence_links.append(link)

    anomalies = _detect_anomalies(all_records, conn)
    conn.close()

    return {
        'overview': overview,
        'by_score': score_reports,
        'anomalies': anomalies,
        'evidence_links': evidence_links
    }


def _detect_anomalies(records, conn):
    anomalies = []

    seen_keys = {}
    for r in records:
        key = (r['score_id'], r['student_name'], r['voice_part'], r['checkin_date'])
        if key in seen_keys:
            anomalies.append({
                'type': 'DUPLICATE_CHECKIN',
                'severity': 'warning',
                'message': f"学生 {r['student_name']} 在 {r['checkin_date']} 对同一曲谱({r['score_title']})同一声部({r['voice_part']})有重复打卡(ID:{seen_keys[key]} 和 ID:{r['id']})",
                'checkin_ids': [seen_keys[key], r['id']],
                'evidence_url': f"/api/checkins/{r['id']}/evidence"
            })
        else:
            seen_keys[key] = r['id']

    for r in records:
        if r['recording_path'] and not r['recording_exists']:
            anomalies.append({
                'type': 'RECORDING_MISSING',
                'severity': 'error',
                'message': f"学生 {r['student_name']} 的排练录音文件 '{r['recording_path']}' 已登记但文件丢失",
                'checkin_id': r['id'],
                'evidence_url': f"/api/checkins/{r['id']}/evidence"
            })

    for r in records:
        if not r['recording_path'] and r['status'] == 'confirmed':
            anomalies.append({
                'type': 'CONFIRMED_WITHOUT_RECORDING',
                'severity': 'warning',
                'message': f"学生 {r['student_name']} 在 {r['checkin_date']} 无排练录音但已确认为完成",
                'checkin_id': r['id'],
                'evidence_url': f"/api/checkins/{r['id']}/evidence"
            })

    for r in records:
        if r['remark'] and len(r['remark']) > 200:
            anomalies.append({
                'type': 'LONG_REMARK',
                'severity': 'info',
                'message': f"学生 {r['student_name']} 的备注过长({len(r['remark'])}字符)，可能包含排练详情而非简要备注",
                'checkin_id': r['id'],
                'evidence_url': f"/api/checkins/{r['id']}/evidence"
            })

    part_counts = defaultdict(int)
    for r in records:
        part_counts[r['voice_part']] += 1
    if len(part_counts) > 1:
        counts = list(part_counts.values())
        if max(counts) > 2 * min(counts):
            anomalies.append({
                'type': 'UNBALANCED_VOICE_PARTS',
                'severity': 'info',
                'message': f"声部人数不均衡: {', '.join(f'{k}={v}人' for k, v in part_counts.items())}",
                'evidence_url': None
            })

    return anomalies


def export_csv(score_id=None, start_date='', end_date=''):
    report = generate_report(score_id=score_id, start_date=start_date, end_date=end_date)
    if not report['evidence_links']:
        return None

    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"sight_singing_report_{ts}.csv"
    filepath = os.path.join(EXPORTS_DIR, filename)

    with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow([
            '打卡ID', '学生姓名', '声部', '打卡日期',
            '曲谱PDF链接', '录音链接', '录音状态',
            '人工确认', '确认人', '排练小结数', '证据链链接'
        ])
        for link in report['evidence_links']:
            recording_status = '有录音'
            if link.get('recording_missing'):
                recording_status = '录音文件丢失'
            elif link.get('no_recording_at_all'):
                recording_status = '无录音'
            writer.writerow([
                link['checkin_id'],
                link['student_name'],
                link['voice_part'],
                link['checkin_date'],
                link['score_pdf_url'],
                link.get('recording_url', ''),
                recording_status,
                '是' if link['has_confirmation'] else '否',
                link.get('confirmed_by', ''),
                link.get('rehearsal_summaries_count', 0),
                link['evidence_url']
            ])

    return filepath
