from flask import Flask, request, jsonify, render_template, send_file
from flask_cors import CORS
from models import Spec, Review, Change, Approval, Timeline, get_stats
from diff_detector import detect_diffs, get_change_summary
import json
from datetime import datetime
import io

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/review/<int:review_id>')
def review_detail(review_id):
    return render_template('detail.html', review_id=review_id)

@app.route('/api/specs', methods=['GET'])
def get_specs():
    specs = Spec.get_all()
    return jsonify(specs)

@app.route('/api/specs/<int:spec_id>', methods=['GET'])
def get_spec(spec_id):
    spec = Spec.get(spec_id)
    if not spec:
        return jsonify({'error': 'Spec not found'}), 404
    return jsonify(spec)

@app.route('/api/specs', methods=['POST'])
def create_spec():
    data = request.json
    if not data or 'version' not in data or 'spec' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
    
    spec_id = Spec.create(data['version'], data['spec'])
    return jsonify({'id': spec_id, 'version': data['version']}), 201

@app.route('/api/reviews', methods=['GET'])
def get_reviews():
    reviews = Review.get_all()
    result = []
    for review in reviews:
        old_spec = Spec.get(review['old_spec_id'])
        new_spec = Spec.get(review['new_spec_id'])
        changes = Change.get_by_review(review['id'])
        
        result.append({
            'id': review['id'],
            'old_version': old_spec['version'] if old_spec else 'Unknown',
            'new_version': new_spec['version'] if new_spec else 'Unknown',
            'status': review['status'],
            'created_at': review['created_at'],
            'updated_at': review['updated_at'],
            'changes_count': len(changes),
            'breaking_count': sum(1 for c in changes if c['is_breaking'])
        })
    return jsonify(result)

@app.route('/api/reviews/<int:review_id>', methods=['GET'])
def get_review(review_id):
    review = Review.get(review_id)
    if not review:
        return jsonify({'error': 'Review not found'}), 404
    
    old_spec = Spec.get(review['old_spec_id'])
    new_spec = Spec.get(review['new_spec_id'])
    changes = Change.get_by_review(review_id)
    approvals = Approval.get_by_review(review_id)
    timeline = Timeline.get_by_review(review_id)
    
    return jsonify({
        'id': review['id'],
        'old_spec': old_spec,
        'new_spec': new_spec,
        'status': review['status'],
        'created_at': review['created_at'],
        'updated_at': review['updated_at'],
        'changes': changes,
        'approvals': approvals,
        'timeline': timeline,
        'summary': get_change_summary(changes)
    })

@app.route('/api/reviews', methods=['POST'])
def create_review():
    data = request.json
    if not data or 'old_spec_id' not in data or 'new_version' not in data or 'new_spec' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
    
    old_spec = Spec.get(data['old_spec_id'])
    if not old_spec:
        return jsonify({'error': 'Old spec not found'}), 404
    
    new_spec_id = Spec.create(data['new_version'], data['new_spec'])
    
    changes, has_breaking = detect_diffs(old_spec['spec'], data['new_spec'])
    
    status = 'BLOCKED' if has_breaking else 'PENDING'
    review_id = Review.create(data['old_spec_id'], new_spec_id, status)
    
    for change in changes:
        Change.create(
            review_id,
            change['change_type'],
            change['path'],
            change['method'],
            change['field'],
            change['description'],
            change['is_breaking'],
            change['severity']
        )
    
    Timeline.create(
        review_id,
        'CREATED',
        f"创建审查任务，对比 v{old_spec['version']} 与 v{data['new_version']}",
        'system'
    )
    
    breaking_count = sum(1 for c in changes if c['is_breaking'])
    Timeline.create(
        review_id,
        'DETECTED',
        f"检测到 {breaking_count} 个破坏性变更，共 {len(changes)} 个变更",
        'system',
        {'breaking_changes': breaking_count, 'total_changes': len(changes)}
    )
    
    if has_breaking:
        Timeline.create(
            review_id,
            'STATUS_CHANGE',
            '审查状态更新为 BLOCKED',
            'system'
        )
    
    return jsonify({
        'id': review_id,
        'status': status,
        'changes_count': len(changes),
        'breaking_count': breaking_count
    }), 201

@app.route('/api/reviews/<int:review_id>/approve', methods=['POST'])
def approve_review(review_id):
    data = request.json
    if not data or 'approved' not in data or 'approver' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
    
    review = Review.get(review_id)
    if not review:
        return jsonify({'error': 'Review not found'}), 404
    
    Approval.create(
        review_id,
        data['approver'],
        data['approved'],
        data.get('reason', '')
    )
    
    new_status = 'APPROVED' if data['approved'] else 'REJECTED'
    Review.update_status(review_id, new_status)
    
    action = '通过' if data['approved'] else '驳回'
    Timeline.create(
        review_id,
        'APPROVAL',
        f"审批人{data['approver']}{action}了变更",
        data['approver'],
        {'approved': data['approved'], 'reason': data.get('reason', '')}
    )
    
    return jsonify({'status': new_status, 'message': 'Review updated successfully'})

@app.route('/api/reviews/<int:review_id>/report', methods=['GET'])
def generate_report(review_id):
    review = Review.get(review_id)
    if not review:
        return jsonify({'error': 'Review not found'}), 404
    
    old_spec = Spec.get(review['old_spec_id'])
    new_spec = Spec.get(review['new_spec_id'])
    changes = Change.get_by_review(review_id)
    approvals = Approval.get_by_review(review_id)
    
    report_lines = []
    report_lines.append("=" * 60)
    report_lines.append("OpenAPI 兼容性审查报告")
    report_lines.append("=" * 60)
    report_lines.append(f"报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report_lines.append(f"审查 ID: {review_id}")
    report_lines.append(f"旧版本: {old_spec['version'] if old_spec else 'Unknown'}")
    report_lines.append(f"新版本: {new_spec['version'] if new_spec else 'Unknown'}")
    report_lines.append(f"审查状态: {review['status']}")
    report_lines.append("")
    
    breaking = [c for c in changes if c['is_breaking']]
    non_breaking = [c for c in changes if not c['is_breaking']]
    
    report_lines.append("-" * 60)
    report_lines.append(f"变更摘要")
    report_lines.append("-" * 60)
    report_lines.append(f"总变更数: {len(changes)}")
    report_lines.append(f"破坏性变更: {len(breaking)}")
    report_lines.append(f"非破坏性变更: {len(non_breaking)}")
    report_lines.append("")
    
    if breaking:
        report_lines.append("-" * 60)
        report_lines.append(f"破坏性变更 ({len(breaking)})")
        report_lines.append("-" * 60)
        for i, change in enumerate(breaking, 1):
            report_lines.append(f"{i}. [{change['severity'].upper()}] {change['description']}")
            report_lines.append(f"   路径: {change['path']} {change['method'] or ''}")
            report_lines.append("")
    
    if non_breaking:
        report_lines.append("-" * 60)
        report_lines.append(f"非破坏性变更 ({len(non_breaking)})")
        report_lines.append("-" * 60)
        for i, change in enumerate(non_breaking, 1):
            report_lines.append(f"{i}. [{change['severity'].upper()}] {change['description']}")
            report_lines.append(f"   路径: {change['path']} {change['method'] or ''}")
            report_lines.append("")
    
    if approvals:
        report_lines.append("-" * 60)
        report_lines.append("审批记录")
        report_lines.append("-" * 60)
        for approval in approvals:
            result = "通过" if approval['approved'] else "驳回"
            report_lines.append(f"审批人: {approval['approver']}")
            report_lines.append(f"结果: {result}")
            report_lines.append(f"理由: {approval['reason']}")
            report_lines.append(f"时间: {approval['created_at']}")
            report_lines.append("")
    
    report_lines.append("=" * 60)
    report_lines.append("报告结束")
    report_lines.append("=" * 60)
    
    report_content = "\n".join(report_lines)
    
    output = io.BytesIO()
    output.write(report_content.encode('utf-8'))
    output.seek(0)
    
    return send_file(
        output,
        mimetype='text/plain',
        as_attachment=True,
        download_name=f'review_{review_id}_report.txt'
    )

@app.route('/api/stats', methods=['GET'])
def get_statistics():
    return jsonify(get_stats())

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8080)
