#!/usr/bin/env python3
from flask import Flask, render_template, request, jsonify, send_file, abort
import os
import io
from datetime import datetime

from models import ReviewStatus, SourceType, EvidenceType
from service import RiskReviewService

app = Flask(__name__)
service = RiskReviewService()

STATUS_LABELS = {
    ReviewStatus.PENDING_APPROVAL_SCREENSHOT: ("等待审批截图", "secondary"),
    ReviewStatus.PENDING_SUPPLEMENT_EMAIL: ("等待补充邮件", "warning"),
    ReviewStatus.PENDING_MANUAL_CONFIRM: ("等待人工确认", "info"),
    ReviewStatus.PENDING_RISK_REVIEW: ("等待风控复核", "primary"),
    ReviewStatus.APPROVED: ("已通过", "success"),
    ReviewStatus.REJECTED: ("已驳回", "danger"),
    ReviewStatus.WITHDRAWN: ("已撤回", "dark"),
    ReviewStatus.NEEDS_CORRECTION: ("需要修正", "warning"),
}

EVIDENCE_LABELS = {
    EvidenceType.APPROVAL_SCREENSHOT: "审批截图",
    EvidenceType.SUPPLEMENT_EMAIL: "补充邮件",
    EvidenceType.MANUAL_CONFIRMATION: "人工确认",
    EvidenceType.REVIEW_CHECKLIST: "复核清单",
    EvidenceType.OTHER: "其他",
}

ACTION_LABELS = {
    "import": "导入",
    "update_status": "状态变更",
    "add_evidence": "添加证据",
    "withdraw": "撤回",
    "correct": "修正",
    "approve": "通过",
    "reject": "驳回",
    "export": "导出",
}


def _get_evidence_status(record):
    return {
        'screenshot': record.get_evidence_by_type(EvidenceType.APPROVAL_SCREENSHOT) is not None,
        'email': record.get_evidence_by_type(EvidenceType.SUPPLEMENT_EMAIL) is not None,
        'confirm': record.get_evidence_by_type(EvidenceType.MANUAL_CONFIRMATION) is not None,
        'checklist': record.get_evidence_by_type(EvidenceType.REVIEW_CHECKLIST) is not None,
    }


def _record_to_dict_light(record):
    return {
        'id': record.id,
        'customer_id': record.customer_id,
        'customer_name': record.customer_name,
        'questionnaire_id': record.questionnaire_id,
        'questionnaire_version': record.questionnaire_version,
        'source_type': record.source_type.value,
        'source_batch_id': record.source_batch_id,
        'current_status': record.current_status.value,
        'is_duplicate': record.is_duplicate,
        'pending_reason': record.pending_reason,
        'created_by': record.created_by,
        'assigned_to': record.assigned_to,
        'created_at': record.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        'updated_at': record.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
        'evidence_status': _get_evidence_status(record),
        'correction_note': record.correction_note,
        'evidences': record.evidences,
        'audit_logs': record.audit_logs,
    }


@app.route('/')
def index():
    stats = service.get_statistics()

    status_filters = request.args.getlist('status')
    source_type = request.args.get('source_type', '')
    batch_id = request.args.get('batch_id', '')
    customer_id = request.args.get('customer_id', '')
    duplicate_filter = request.args.get('duplicate', '')
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 20))

    filters = {}
    if status_filters:
        filters['status'] = [ReviewStatus(s) for s in status_filters]
    if source_type:
        filters['source_type'] = SourceType(source_type)
    if batch_id:
        filters['source_batch_id'] = batch_id
    if customer_id:
        filters['customer_id'] = customer_id
    if duplicate_filter == 'only':
        filters['is_duplicate'] = True
    elif duplicate_filter == 'exclude':
        filters['is_duplicate'] = False

    records, total, total_pages = service.filter_records(
        filters=filters, page=page, page_size=page_size
    )

    records = [_record_to_dict_light(r) for r in records]

    query_params = []
    for s in status_filters:
        query_params.append(f"status={s}")
    if source_type:
        query_params.append(f"source_type={source_type}")
    if batch_id:
        query_params.append(f"batch_id={batch_id}")
    if customer_id:
        query_params.append(f"customer_id={customer_id}")
    if duplicate_filter:
        query_params.append(f"duplicate={duplicate_filter}")
    query_string = "&".join(query_params)

    status_labels = {k.value: v for k, v in STATUS_LABELS.items()}
    status_options = {k.value: v[0] for k, v in STATUS_LABELS.items()}
    source_options = {s.value: s.value for s in SourceType}

    return render_template('index.html',
        records=records,
        stats=stats,
        total=total,
        page=page,
        total_pages=total_pages,
        status_filters=status_filters,
        source_type=source_type,
        batch_id=batch_id,
        customer_id=customer_id,
        duplicate_filter=duplicate_filter,
        status_labels=status_labels,
        status_options=status_options,
        source_options=source_options,
        query_string=query_string
    )


@app.route('/record/<int:record_id>')
def record_detail(record_id):
    detail = service.get_record_detail(record_id)
    if not detail:
        abort(404)

    status_labels = {k.value: v for k, v in STATUS_LABELS.items()}
    evidence_labels = {k.value: v for k, v in EVIDENCE_LABELS.items()}
    action_labels = ACTION_LABELS

    record_dict = detail['record']
    current_status = record_dict['current_status']
    status_order = [
        ('pending_approval_screenshot', '等待审批截图'),
        ('pending_supplement_email', '等待补充邮件'),
        ('pending_manual_confirm', '等待人工确认'),
        ('pending_risk_review', '等待风控复核'),
        ('approved', '已通过'),
    ]
    status_values = [s[0] for s in status_order]
    current_idx = status_values.index(current_status) if current_status in status_values else -1

    transition_labels = []
    for s in detail['can_transition_to']:
        label_info = STATUS_LABELS.get(ReviewStatus(s), (s, "secondary"))
        transition_labels.append({
            'value': s,
            'label': label_info[0],
            'class': label_info[1]
        })

    return render_template('record.html',
        detail=detail,
        record=record_dict,
        status_labels=status_labels,
        evidence_labels=evidence_labels,
        action_labels=action_labels,
        status_order=status_order,
        current_idx=current_idx,
        transition_labels=transition_labels
    )


@app.route('/api/export')
def api_export():
    status_filters = request.args.getlist('status')
    source_type = request.args.get('source_type', '')
    batch_id = request.args.get('batch_id', '')
    fmt = request.args.get('format', 'csv')
    include_audit = request.args.get('with_audit', '0') == '1'

    filters = {}
    if status_filters:
        filters['status'] = [ReviewStatus(s) for s in status_filters]
    if source_type:
        filters['source_type'] = SourceType(source_type)
    if batch_id:
        filters['source_batch_id'] = batch_id

    data = service.export_records(
        filters=filters,
        format=fmt,
        include_evidence=True,
        include_audit=include_audit
    )

    filename = f"risk_review_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{fmt}"
    mimetype = 'text/csv' if fmt == 'csv' else 'application/json'

    return send_file(
        io.BytesIO(data),
        mimetype=mimetype,
        as_attachment=True,
        download_name=filename
    )


@app.route('/api/stats')
def api_stats():
    return jsonify(service.get_statistics())


@app.template_filter('datetime')
def format_datetime(value):
    if isinstance(value, str):
        return value
    return value.strftime('%Y-%m-%d %H:%M:%S')


@app.template_filter('status_label')
def status_label(status):
    if isinstance(status, str):
        status = ReviewStatus(status)
    return STATUS_LABELS.get(status, (status.value, "secondary"))


@app.template_filter('evidence_label')
def evidence_label(ev_type):
    if isinstance(ev_type, str):
        ev_type = EvidenceType(ev_type)
    return EVIDENCE_LABELS.get(ev_type, ev_type.value)


@app.template_filter('action_label')
def action_label(action):
    return ACTION_LABELS.get(action, action)


if __name__ == '__main__':
    os.makedirs('templates', exist_ok=True)
    app.run(debug=True, host='0.0.0.0', port=5100)
