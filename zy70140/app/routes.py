from flask import Blueprint, request, jsonify
from datetime import datetime
import csv
import io
from app import db
from app.services import (
    create_audit_task, process_callback, manual_review,
    get_task_detail, get_tasks_by_status, get_statistics, export_for_review
)
from app.constants import AuditStatus

main_bp = Blueprint('main', __name__)

def make_response(success: bool, data=None, message: str = None, code: str = None, http_code: int = 200):
    response = {
        'success': success,
        'message': message,
        'code': code,
        'data': data,
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    return jsonify(response), http_code

@main_bp.route('/api/health', methods=['GET'])
def health_check():
    return make_response(True, {'status': 'ok'}, '服务运行正常')

@main_bp.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.get_json() or {}
    
    required_fields = ['business_id', 'image_url']
    for field in required_fields:
        if field not in data:
            return make_response(False, None, f'缺少必填参数：{field}', 'MISSING_PARAM', 400)
    
    task = create_audit_task(
        business_id=data['business_id'],
        image_url=data['image_url'],
        image_source=data.get('image_source'),
        remark=data.get('remark')
    )
    
    return make_response(
        True,
        task.to_dict(),
        f'审核任务创建成功，任务ID：{task.task_id}，当前状态：待审核',
        'CREATE_SUCCESS'
    )

@main_bp.route('/api/callback', methods=['POST'])
def callback():
    data = request.get_json() or {}
    
    required_fields = ['task_id', 'callback_id', 'callback_sequence', 'review_result']
    for field in required_fields:
        if field not in data:
            return make_response(False, None, f'缺少必填参数：{field}', 'MISSING_PARAM', 400)
    
    valid_results = [
        AuditStatus.PROCESSING,
        AuditStatus.APPROVED,
        AuditStatus.REJECTED,
        AuditStatus.NEED_MANUAL_REVIEW
    ]
    if data['review_result'] not in valid_results:
        valid_descs = [AuditStatus.get_desc(r) for r in valid_results]
        return make_response(
            False, None,
            f'review_result参数值无效，必须是：{", ".join(valid_descs)}',
            'INVALID_REVIEW_RESULT', 400
        )
    
    try:
        sequence = int(data['callback_sequence'])
        if sequence <= 0:
            raise ValueError()
    except:
        return make_response(False, None, 'callback_sequence必须是正整数', 'INVALID_SEQUENCE', 400)
    
    result = process_callback(
        task_id=data['task_id'],
        callback_id=data['callback_id'],
        callback_sequence=sequence,
        review_result=data['review_result'],
        review_score=data.get('review_score'),
        risk_category=data.get('risk_category'),
        risk_detail=data.get('risk_detail'),
        raw_payload=data
    )
    
    http_code = 200 if result.success else 200
    return make_response(
        result.success,
        result.task.to_dict() if result.task else None,
        result.reason,
        result.code,
        http_code
    )

@main_bp.route('/api/tasks/<task_id>', methods=['GET'])
def get_task(task_id):
    detail = get_task_detail(task_id)
    if not detail:
        return make_response(False, None, f'任务不存在，task_id={task_id}', 'TASK_NOT_FOUND', 404)
    
    return make_response(True, detail, '查询成功')

@main_bp.route('/api/tasks', methods=['GET'])
def list_tasks():
    status = request.args.get('status')
    try:
        page = int(request.args.get('page', 1))
        page_size = min(int(request.args.get('page_size', 20)), 100)
    except:
        return make_response(False, None, '分页参数无效', 'INVALID_PAGE_PARAM', 400)
    
    data = get_tasks_by_status(status, page, page_size)
    msg = f'查询成功，共 {data["total"]} 条记录'
    if status:
        msg += f'，状态：{AuditStatus.get_desc(status)}'
    return make_response(True, data, msg)

@main_bp.route('/api/tasks/<task_id>/manual-review', methods=['POST'])
def do_manual_review(task_id):
    data = request.get_json() or {}
    
    required_fields = ['reviewer', 'decision']
    for field in required_fields:
        if field not in data:
            return make_response(False, None, f'缺少必填参数：{field}', 'MISSING_PARAM', 400)
    
    decision_map = {
        'approve': AuditStatus.MANUALLY_APPROVED,
        'approved': AuditStatus.MANUALLY_APPROVED,
        'MANUALLY_APPROVED': AuditStatus.MANUALLY_APPROVED,
        'reject': AuditStatus.MANUALLY_REJECTED,
        'rejected': AuditStatus.MANUALLY_REJECTED,
        'MANUALLY_REJECTED': AuditStatus.MANUALLY_REJECTED
    }
    
    decision_key = str(data['decision']).lower().strip()
    if data['decision'] in decision_map:
        decision = decision_map[data['decision']]
    elif decision_key in decision_map:
        decision = decision_map[decision_key]
    else:
        return make_response(
            False, None,
            'decision参数无效，请使用：approve/reject 或 MANUALLY_APPROVED/MANUALLY_REJECTED',
            'INVALID_DECISION', 400
        )
    
    result = manual_review(
        task_id=task_id,
        reviewer=data['reviewer'],
        decision=decision,
        comment=data.get('comment'),
        evidence_paths=data.get('evidence_paths')
    )
    
    http_code = 200 if result.success else 200
    return make_response(
        result.success,
        result.task.to_dict() if result.task else None,
        result.reason,
        result.code,
        http_code
    )

@main_bp.route('/api/statistics', methods=['GET'])
def statistics():
    data = get_statistics()
    return make_response(True, data, '统计数据获取成功')

@main_bp.route('/api/export', methods=['GET'])
def export():
    status = request.args.get('status')
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    
    start_date = None
    end_date = None
    
    try:
        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
    except Exception as e:
        return make_response(False, None, '日期格式错误，请使用 YYYY-MM-DD 格式', 'INVALID_DATE', 400)
    
    export_data = export_for_review(start_date, end_date, status)
    
    if not export_data:
        return make_response(False, None, '没有找到符合条件的导出数据', 'NO_DATA', 404)
    
    output = io.StringIO()
    fieldnames = export_data[0].keys()
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(export_data)
    
    csv_content = output.getvalue()
    
    filename = f'audit_review_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    
    response = make_response(
        True,
        {
            'filename': filename,
            'record_count': len(export_data),
            'csv_content': csv_content,
            'preview': export_data[:10]
        },
        f'导出成功，共 {len(export_data)} 条记录，文件名：{filename}'
    )
    
    return response

@main_bp.route('/api/status-info', methods=['GET'])
def status_info():
    status_list = []
    for status in [
        AuditStatus.PENDING,
        AuditStatus.PROCESSING,
        AuditStatus.APPROVED,
        AuditStatus.REJECTED,
        AuditStatus.NEED_MANUAL_REVIEW,
        AuditStatus.MANUALLY_APPROVED,
        AuditStatus.MANUALLY_REJECTED
    ]:
        status_list.append({
            'code': status,
            'name': AuditStatus.get_desc(status),
            'is_final': AuditStatus.is_final_status(status),
            'is_manual': AuditStatus.is_manual_final_status(status)
        })
    
    return make_response(True, {'status_list': status_list}, '状态列表获取成功')
