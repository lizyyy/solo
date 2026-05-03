from flask import Flask, jsonify, request, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime
import os
import csv
import json
import yaml
from io import StringIO, BytesIO
from dateutil.parser import parse

app = Flask(__name__)
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///antidoping.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)


class Batch(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    import_time = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='imported')
    sample_count = db.Column(db.Integer, default=0)
    issue_count = db.Column(db.Integer, default=0)


class Sample(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('batch.id'), nullable=False)
    sample_id = db.Column(db.String(50), nullable=False)
    sample_type = db.Column(db.String(20))
    athlete_id = db.Column(db.String(50))
    competition = db.Column(db.String(100))
    notes = db.Column(db.Text)
    review_status = db.Column(db.String(20), default='pending')
    review_comment = db.Column(db.Text)


class HandoffEvent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('batch.id'), nullable=False)
    sample_id = db.Column(db.String(50), nullable=False)
    event_type = db.Column(db.String(20), nullable=False)
    event_time = db.Column(db.DateTime, nullable=False)
    location = db.Column(db.String(100))
    operator = db.Column(db.String(100))
    storage_zone = db.Column(db.String(50))
    raw_data = db.Column(db.Text)


class Location(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('batch.id'), nullable=False)
    location_code = db.Column(db.String(50), nullable=False)
    zone = db.Column(db.String(50))
    description = db.Column(db.String(200))
    temperature = db.Column(db.String(50))


class Issue(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('batch.id'), nullable=False)
    sample_id = db.Column(db.String(50), nullable=False)
    issue_type = db.Column(db.String(50), nullable=False)
    severity = db.Column(db.String(20), default='warning')
    description = db.Column(db.Text)
    event_id = db.Column(db.Integer, db.ForeignKey('handoff_event.id'))
    resolved = db.Column(db.Boolean, default=False)
    resolution_note = db.Column(db.Text)


with app.app_context():
    db.create_all()


def parse_datetime(dt_str):
    if not dt_str:
        return None
    try:
        return parse(dt_str)
    except:
        return None


def get_sample_chain(sample_id, batch_id):
    events = HandoffEvent.query.filter_by(
        sample_id=sample_id, batch_id=batch_id
    ).order_by(HandoffEvent.event_time).all()
    return events


def check_duplicate_scans(sample_id, batch_id):
    events = get_sample_chain(sample_id, batch_id)
    event_types = {}
    duplicates = []
    
    for event in events:
        if event.event_type in event_types:
            duplicates.append({
                'sample_id': sample_id,
                'event_type': event.event_type,
                'event_time': event.event_time,
                'previous_time': event_types[event.event_type]
            })
        event_types[event.event_type] = event.event_time
    
    return duplicates


def check_time_gaps(sample_id, batch_id):
    events = get_sample_chain(sample_id, batch_id)
    if len(events) < 2:
        return []
    
    gaps = []
    ordered_events = sorted(events, key=lambda x: x.event_time)
    
    expected_flow = ['sampling', 'aliquoting', 'storage', 'transport', 'receipt']
    
    current_flow_index = 0
    for i, event in enumerate(ordered_events):
        while current_flow_index < len(expected_flow):
            if expected_flow[current_flow_index] == event.event_type:
                current_flow_index += 1
                break
            else:
                gaps.append({
                    'sample_id': sample_id,
                    'missing_event': expected_flow[current_flow_index],
                    'after_event': ordered_events[i-1].event_type if i > 0 else None,
                    'before_event': event.event_type
                })
                current_flow_index += 1
    
    return gaps


def check_transport_across_midnight(sample_id, batch_id):
    events = get_sample_chain(sample_id, batch_id)
    transport_events = [e for e in events if e.event_type == 'transport']
    
    issues = []
    for event in transport_events:
        if event.event_time:
            hour = event.event_time.hour
            if 0 <= hour < 6:
                issues.append({
                    'sample_id': sample_id,
                    'event_time': event.event_time,
                    'hour': hour,
                    'description': f'转运操作发生在凌晨 {hour} 点，可能跨午夜'
                })
    
    return issues


def check_zone_mismatch(sample_id, batch_id):
    events = get_sample_chain(sample_id, batch_id)
    sample = Sample.query.filter_by(sample_id=sample_id, batch_id=batch_id).first()
    
    issues = []
    
    storage_events = [e for e in events if e.event_type == 'storage']
    for event in storage_events:
        if event.location:
            location = Location.query.filter_by(
                location_code=event.location, batch_id=batch_id
            ).first()
            
            if location:
                sample_type = sample.sample_type if sample else None
                if sample_type == 'blood' and location.zone != 'frozen':
                    issues.append({
                        'sample_id': sample_id,
                        'location': event.location,
                        'sample_type': sample_type,
                        'expected_zone': 'frozen',
                        'actual_zone': location.zone,
                        'description': f'血液样本存放在非冷冻区 {location.zone}'
                    })
                elif sample_type == 'urine' and location.zone != 'refrigerated':
                    issues.append({
                        'sample_id': sample_id,
                        'location': event.location,
                        'sample_type': sample_type,
                        'expected_zone': 'refrigerated',
                        'actual_zone': location.zone,
                        'description': f'尿液样本存放在非冷藏区 {location.zone}'
                    })
    
    return issues


def validate_batch(batch_id):
    samples = Sample.query.filter_by(batch_id=batch_id).all()
    all_issues = []
    
    for sample in samples:
        sample_id = sample.sample_id
        
        duplicates = check_duplicate_scans(sample_id, batch_id)
        for dup in duplicates:
            all_issues.append(Issue(
                batch_id=batch_id,
                sample_id=sample_id,
                issue_type='duplicate_scan',
                severity='error',
                description=f'重复扫码: {dup["event_type"]} 在 {dup["event_time"]}，之前已在 {dup["previous_time"]} 扫码'
            ))
        
        gaps = check_time_gaps(sample_id, batch_id)
        for gap in gaps:
            all_issues.append(Issue(
                batch_id=batch_id,
                sample_id=sample_id,
                issue_type='chain_break',
                severity='critical',
                description=f'交接链断点: 缺少 {gap["missing_event"]} 环节'
            ))
        
        midnight_issues = check_transport_across_midnight(sample_id, batch_id)
        for m in midnight_issues:
            all_issues.append(Issue(
                batch_id=batch_id,
                sample_id=sample_id,
                issue_type='midnight_transport',
                severity='warning',
                description=m['description']
            ))
        
        zone_issues = check_zone_mismatch(sample_id, batch_id)
        for z in zone_issues:
            all_issues.append(Issue(
                batch_id=batch_id,
                sample_id=sample_id,
                issue_type='zone_mismatch',
                severity='error',
                description=z['description']
            ))
    
    for issue in all_issues:
        db.session.add(issue)
    db.session.commit()
    
    batch = Batch.query.get(batch_id)
    batch.issue_count = len(all_issues)
    batch.status = 'validated'
    db.session.commit()
    
    return all_issues


@app.route('/api/batches', methods=['GET'])
def get_batches():
    batches = Batch.query.order_by(Batch.import_time.desc()).all()
    result = [{
        'id': b.id,
        'name': b.name,
        'import_time': b.import_time.isoformat() if b.import_time else None,
        'status': b.status,
        'sample_count': b.sample_count,
        'issue_count': b.issue_count
    } for b in batches]
    return jsonify(result)


@app.route('/api/batches/<int:batch_id>', methods=['GET'])
def get_batch_detail(batch_id):
    batch = Batch.query.get_or_404(batch_id)
    samples = Sample.query.filter_by(batch_id=batch_id).all()
    issues = Issue.query.filter_by(batch_id=batch_id).all()
    
    samples_with_issues = []
    for s in samples:
        sample_issues = [i for i in issues if i.sample_id == s.sample_id]
        samples_with_issues.append({
            'id': s.id,
            'sample_id': s.sample_id,
            'sample_type': s.sample_type,
            'athlete_id': s.athlete_id,
            'competition': s.competition,
            'review_status': s.review_status,
            'review_comment': s.review_comment,
            'issues_count': len(sample_issues)
        })
    
    return jsonify({
        'batch': {
            'id': batch.id,
            'name': batch.name,
            'import_time': batch.import_time.isoformat() if batch.import_time else None,
            'status': batch.status,
            'sample_count': batch.sample_count,
            'issue_count': batch.issue_count
        },
        'samples': samples_with_issues,
        'issues': [{
            'id': i.id,
            'sample_id': i.sample_id,
            'issue_type': i.issue_type,
            'severity': i.severity,
            'description': i.description,
            'resolved': i.resolved,
            'resolution_note': i.resolution_note
        } for i in issues]
    })


@app.route('/api/samples/<int:sample_id>', methods=['GET'])
def get_sample_detail(sample_id):
    sample = Sample.query.get_or_404(sample_id)
    events = HandoffEvent.query.filter_by(
        sample_id=sample.sample_id, batch_id=sample.batch_id
    ).order_by(HandoffEvent.event_time).all()
    issues = Issue.query.filter_by(
        sample_id=sample.sample_id, batch_id=sample.batch_id
    ).all()
    
    return jsonify({
        'sample': {
            'id': sample.id,
            'sample_id': sample.sample_id,
            'sample_type': sample.sample_type,
            'athlete_id': sample.athlete_id,
            'competition': sample.competition,
            'review_status': sample.review_status,
            'review_comment': sample.review_comment
        },
        'timeline': [{
            'id': e.id,
            'event_type': e.event_type,
            'event_time': e.event_time.isoformat() if e.event_time else None,
            'location': e.location,
            'operator': e.operator,
            'storage_zone': e.storage_zone
        } for e in events],
        'issues': [{
            'id': i.id,
            'issue_type': i.issue_type,
            'severity': i.severity,
            'description': i.description,
            'resolved': i.resolved,
            'resolution_note': i.resolution_note
        } for i in issues]
    })


@app.route('/api/import/csv', methods=['POST'])
def import_csv():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    batch_name = request.form.get('batch_name', f'Batch_{datetime.now().strftime("%Y%m%d_%H%M%S")}')
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    batch = Batch(name=batch_name)
    db.session.add(batch)
    db.session.commit()
    
    sample_count = 0
    
    try:
        stream = StringIO(file.read().decode('utf-8-sig'))
        reader = csv.DictReader(stream)
        
        for row in reader:
            sample_id = row.get('sample_id') or row.get('SampleID')
            if not sample_id:
                continue
            
            sample = Sample(
                batch_id=batch.id,
                sample_id=sample_id,
                sample_type=row.get('sample_type') or row.get('SampleType'),
                athlete_id=row.get('athlete_id') or row.get('AthleteID'),
                competition=row.get('competition') or row.get('Competition')
            )
            db.session.add(sample)
            
            sampling_time = parse_datetime(row.get('sampling_time') or row.get('SamplingTime'))
            if sampling_time:
                event = HandoffEvent(
                    batch_id=batch.id,
                    sample_id=sample_id,
                    event_type='sampling',
                    event_time=sampling_time,
                    location=row.get('sampling_location') or row.get('SamplingLocation'),
                    operator=row.get('sampling_operator') or row.get('SamplingOperator')
                )
                db.session.add(event)
            
            aliquoting_time = parse_datetime(row.get('aliquoting_time') or row.get('AliquotingTime'))
            if aliquoting_time:
                event = HandoffEvent(
                    batch_id=batch.id,
                    sample_id=sample_id,
                    event_type='aliquoting',
                    event_time=aliquoting_time,
                    location=row.get('aliquoting_location') or row.get('AliquotingLocation'),
                    operator=row.get('aliquoting_operator') or row.get('AliquotingOperator')
                )
                db.session.add(event)
            
            sample_count += 1
        
        batch.sample_count = sample_count
        db.session.commit()
        
        return jsonify({
            'success': True,
            'batch_id': batch.id,
            'batch_name': batch.name,
            'samples_imported': sample_count
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/import/yaml', methods=['POST'])
def import_yaml():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    batch_id = request.form.get('batch_id')
    
    if not batch_id:
        return jsonify({'error': 'No batch_id provided'}), 400
    
    batch = Batch.query.get(batch_id)
    if not batch:
        return jsonify({'error': 'Batch not found'}), 404
    
    try:
        data = yaml.safe_load(file.read())
        location_count = 0
        
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    loc = Location(
                        batch_id=batch.id,
                        location_code=item.get('code') or item.get('location_code'),
                        zone=item.get('zone'),
                        description=item.get('description'),
                        temperature=item.get('temperature')
                    )
                    db.session.add(loc)
                    location_count += 1
        
        elif isinstance(data, dict) and 'locations' in data:
            for item in data['locations']:
                if isinstance(item, dict):
                    loc = Location(
                        batch_id=batch.id,
                        location_code=item.get('code') or item.get('location_code'),
                        zone=item.get('zone'),
                        description=item.get('description'),
                        temperature=item.get('temperature')
                    )
                    db.session.add(loc)
                    location_count += 1
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'batch_id': batch.id,
            'locations_imported': location_count
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/import/jsonl', methods=['POST'])
def import_jsonl():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    batch_id = request.form.get('batch_id')
    
    if not batch_id:
        return jsonify({'error': 'No batch_id provided'}), 400
    
    batch = Batch.query.get(batch_id)
    if not batch:
        return jsonify({'error': 'Batch not found'}), 404
    
    try:
        lines = file.read().decode('utf-8').splitlines()
        event_count = 0
        
        for line in lines:
            if not line.strip():
                continue
            
            data = json.loads(line)
            sample_id = data.get('sample_id') or data.get('SampleID')
            event_type = data.get('event_type') or data.get('EventType')
            
            if not sample_id or not event_type:
                continue
            
            event_time = parse_datetime(data.get('event_time') or data.get('EventTime'))
            if not event_time:
                continue
            
            event = HandoffEvent(
                batch_id=batch.id,
                sample_id=sample_id,
                event_type=event_type.lower(),
                event_time=event_time,
                location=data.get('location') or data.get('Location'),
                operator=data.get('operator') or data.get('Operator'),
                storage_zone=data.get('storage_zone') or data.get('StorageZone'),
                raw_data=json.dumps(data)
            )
            db.session.add(event)
            event_count += 1
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'batch_id': batch.id,
            'events_imported': event_count
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/batches/<int:batch_id>/validate', methods=['POST'])
def validate_batch_endpoint(batch_id):
    try:
        issues = validate_batch(batch_id)
        return jsonify({
            'success': True,
            'batch_id': batch_id,
            'issues_found': len(issues)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/samples/<int:sample_id>/review', methods=['PUT'])
def review_sample(sample_id):
    sample = Sample.query.get_or_404(sample_id)
    data = request.json
    
    if 'review_status' in data:
        sample.review_status = data['review_status']
    if 'review_comment' in data:
        sample.review_comment = data['review_comment']
    
    db.session.commit()
    
    return jsonify({'success': True, 'sample_id': sample.id})


@app.route('/api/issues/<int:issue_id>/resolve', methods=['PUT'])
def resolve_issue(issue_id):
    issue = Issue.query.get_or_404(issue_id)
    data = request.json
    
    issue.resolved = data.get('resolved', True)
    if 'resolution_note' in data:
        issue.resolution_note = data['resolution_note']
    
    db.session.commit()
    
    return jsonify({'success': True, 'issue_id': issue.id})


@app.route('/api/export/<int:batch_id>/issues.csv', methods=['GET'])
def export_issues_csv(batch_id):
    issues = Issue.query.filter_by(batch_id=batch_id).all()
    
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(['SampleID', 'IssueType', 'Severity', 'Description', 'Resolved', 'ResolutionNote'])
    
    for issue in issues:
        writer.writerow([
            issue.sample_id,
            issue.issue_type,
            issue.severity,
            issue.description,
            'Yes' if issue.resolved else 'No',
            issue.resolution_note or ''
        ])
    
    output.seek(0)
    
    return send_file(
        BytesIO(output.getvalue().encode('utf-8')),
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'issues_batch_{batch_id}.csv'
    )


@app.route('/api/export/<int:batch_id>/handoff_report.md', methods=['GET'])
def export_handoff_report(batch_id):
    batch = Batch.query.get_or_404(batch_id)
    samples = Sample.query.filter_by(batch_id=batch_id).all()
    issues = Issue.query.filter_by(batch_id=batch_id).all()
    
    report = f"""# 反兴奋剂样本交接链报告

## 批次信息
- **批次名称**: {batch.name}
- **导入时间**: {batch.import_time.strftime('%Y-%m-%d %H:%M:%S') if batch.import_time else 'N/A'}
- **状态**: {batch.status}
- **样本总数**: {batch.sample_count}
- **问题数量**: {batch.issue_count}

---

## 问题汇总
"""
    
    severity_count = {}
    for issue in issues:
        severity_count[issue.severity] = severity_count.get(issue.severity, 0) + 1
    
    for severity, count in severity_count.items():
        report += f"- **{severity.upper()}**: {count} 个\n"
    
    report += "\n---\n\n## 样本详情\n\n"
    
    for sample in samples:
        sample_issues = [i for i in issues if i.sample_id == sample.sample_id]
        events = HandoffEvent.query.filter_by(
            sample_id=sample.sample_id, batch_id=batch_id
        ).order_by(HandoffEvent.event_time).all()
        
        report += f"### 样本 {sample.sample_id}\n"
        report += f"- **类型**: {sample.sample_type or 'N/A'}\n"
        report += f"- **运动员**: {sample.athlete_id or 'N/A'}\n"
        report += f"- **赛事**: {sample.competition or 'N/A'}\n"
        report += f"- **复核状态**: {sample.review_status}\n"
        
        report += f"\n**交接时间线**:\n"
        for event in events:
            time_str = event.event_time.strftime('%Y-%m-%d %H:%M:%S') if event.event_time else 'N/A'
            report += f"- [{time_str}] {event.event_type.upper()}"
            if event.operator:
                report += f" - 操作人: {event.operator}"
            if event.location:
                report += f" - 位置: {event.location}"
            report += "\n"
        
        if sample_issues:
            report += f"\n**问题**:\n"
            for issue in sample_issues:
                status = "✓ 已解决" if issue.resolved else "✗ 待解决"
                report += f"- [{status}] [{issue.severity.upper()}] {issue.issue_type}: {issue.description}\n"
                if issue.resolution_note:
                    report += f"  解决说明: {issue.resolution_note}\n"
        
        report += "\n---\n\n"
    
    return send_file(
        BytesIO(report.encode('utf-8')),
        mimetype='text/markdown',
        as_attachment=True,
        download_name=f'handoff_report_batch_{batch_id}.md'
    )


@app.route('/api/batches/<int:batch_id>', methods=['DELETE'])
def delete_batch(batch_id):
    batch = Batch.query.get_or_404(batch_id)
    
    Issue.query.filter_by(batch_id=batch_id).delete()
    HandoffEvent.query.filter_by(batch_id=batch_id).delete()
    Location.query.filter_by(batch_id=batch_id).delete()
    Sample.query.filter_by(batch_id=batch_id).delete()
    
    db.session.delete(batch)
    db.session.commit()
    
    return jsonify({'success': True})


if __name__ == '__main__':
    app.run(debug=True, port=5000)
