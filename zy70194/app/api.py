from flask import Blueprint, request, jsonify

from app.services import (
    InquiryService, QuoteService, ComparisonService,
    BackgroundJobService, OperationLogService,
    ExportService, ExpiryService
)

api_bp = Blueprint('api', __name__)

def _get_request_data():
    if request.is_json:
        return request.get_json(force=True, silent=True) or {}
    return request.form.to_dict()

def _json_response(result, status_code=200):
    response = jsonify(result)
    response.status_code = status_code
    return response

@api_bp.route('/inquiries', methods=['POST'])
def create_inquiry():
    data = _get_request_data()
    result = InquiryService.create_inquiry(data)
    
    if result['success']:
        return _json_response(result, 201)
    else:
        return _json_response(result, 400)

@api_bp.route('/inquiries', methods=['GET'])
def list_inquiries():
    filters = {
        'status': request.args.get('status'),
        'created_by': request.args.get('created_by'),
        'department': request.args.get('department'),
        'project': request.args.get('project')
    }
    filters = {k: v for k, v in filters.items() if v}
    
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    
    result = InquiryService.list_inquiries(filters, page, per_page)
    return _json_response(result)

@api_bp.route('/inquiries/<int:inquiry_id>', methods=['GET'])
def get_inquiry(inquiry_id):
    result = InquiryService.get_inquiry(inquiry_id)
    if result['success']:
        return _json_response(result)
    else:
        return _json_response(result, 404)

@api_bp.route('/inquiries/<int:inquiry_id>', methods=['PUT'])
def update_inquiry(inquiry_id):
    data = _get_request_data()
    operation_by = data.get('operation_by', 'anonymous')
    
    result = InquiryService.update_inquiry(inquiry_id, data, operation_by)
    
    if result['success']:
        return _json_response(result)
    else:
        return _json_response(result, 400)

@api_bp.route('/inquiries/<int:inquiry_id>/publish', methods=['POST'])
def publish_inquiry(inquiry_id):
    data = _get_request_data()
    operation_by = data.get('operation_by', 'anonymous')
    
    result = InquiryService.publish_inquiry(inquiry_id, operation_by)
    
    if result['success']:
        return _json_response(result)
    else:
        return _json_response(result, 400)

@api_bp.route('/inquiries/<int:inquiry_id>/cancel', methods=['POST'])
def cancel_inquiry(inquiry_id):
    data = _get_request_data()
    operation_by = data.get('operation_by', 'anonymous')
    reason = data.get('reason')
    
    result = InquiryService.cancel_inquiry(inquiry_id, operation_by, reason)
    
    if result['success']:
        return _json_response(result)
    else:
        return _json_response(result, 400)

@api_bp.route('/inquiries/<int:inquiry_id>/check-expiry', methods=['POST'])
def check_inquiry_expiry(inquiry_id):
    result = InquiryService.check_deadline_expired(inquiry_id)
    return _json_response(result)

@api_bp.route('/inquiries/<int:inquiry_id>/logs', methods=['GET'])
def get_inquiry_logs(inquiry_id):
    logs = OperationLogService.get_inquiry_logs(inquiry_id)
    return _json_response({'success': True, 'data': logs})

@api_bp.route('/quotes', methods=['POST'])
def create_quote():
    data = _get_request_data()
    result = QuoteService.create_quote(data)
    
    if result['success']:
        return _json_response(result, 201)
    else:
        return _json_response(result, 400)

@api_bp.route('/quotes', methods=['GET'])
def list_quotes():
    inquiry_id = request.args.get('inquiry_id', type=int)
    vendor_id = request.args.get('vendor_id')
    status = request.args.get('status')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    
    result = QuoteService.list_quotes(inquiry_id, vendor_id, status, page, per_page)
    return _json_response(result)

@api_bp.route('/quotes/<int:quote_id>', methods=['GET'])
def get_quote(quote_id):
    result = QuoteService.get_quote(quote_id)
    if result['success']:
        return _json_response(result)
    else:
        return _json_response(result, 404)

@api_bp.route('/quotes/<int:quote_id>', methods=['PUT'])
def revise_quote(quote_id):
    data = _get_request_data()
    operation_by = data.get('operation_by', 'anonymous')
    change_reason = data.get('change_reason')
    
    result = QuoteService.revise_quote(quote_id, data, operation_by, change_reason)
    
    if result['success']:
        return _json_response(result)
    else:
        return _json_response(result, 400)

@api_bp.route('/quotes/<int:quote_id>/submit', methods=['POST'])
def submit_quote(quote_id):
    data = _get_request_data()
    operation_by = data.get('operation_by', 'anonymous')
    
    result = QuoteService.submit_quote(quote_id, operation_by)
    
    if result['success']:
        return _json_response(result)
    else:
        return _json_response(result, 400)

@api_bp.route('/quotes/<int:quote_id>/versions', methods=['GET'])
def get_quote_versions(quote_id):
    result = QuoteService.get_quote_versions(quote_id)
    return _json_response(result)

@api_bp.route('/quotes/<int:quote_id>/check-validity', methods=['POST'])
def check_quote_validity(quote_id):
    result = QuoteService.check_validity(quote_id)
    return _json_response(result)

@api_bp.route('/quotes/<int:quote_id>/logs', methods=['GET'])
def get_quote_logs(quote_id):
    logs = OperationLogService.get_quote_logs(quote_id)
    return _json_response({'success': True, 'data': logs})

@api_bp.route('/quotes/<int:quote_id>/export', methods=['POST'])
def export_quote(quote_id):
    result = ExportService.export_quote_to_excel(quote_id)
    
    if result['success']:
        return _json_response(result)
    else:
        return _json_response(result, 400)

@api_bp.route('/comparisons', methods=['POST'])
def generate_comparison():
    data = _get_request_data()
    inquiry_id = data.get('inquiry_id')
    operation_by = data.get('operation_by', 'anonymous')
    
    if not inquiry_id:
        return _json_response({
            'success': False,
            'error': '缺少 inquiry_id',
            'error_code': 'missing_inquiry_id'
        }, 400)
    
    result = ComparisonService.generate_comparison(inquiry_id, operation_by)
    
    if result['success']:
        return _json_response(result, 201)
    else:
        return _json_response(result, 400)

@api_bp.route('/comparisons', methods=['GET'])
def list_comparisons():
    inquiry_id = request.args.get('inquiry_id', type=int)
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    
    result = ComparisonService.list_comparisons(inquiry_id, page, per_page)
    return _json_response(result)

@api_bp.route('/comparisons/<int:comparison_id>', methods=['GET'])
def get_comparison(comparison_id):
    result = ComparisonService.get_comparison(comparison_id)
    if result['success']:
        return _json_response(result)
    else:
        return _json_response(result, 404)

@api_bp.route('/comparisons/<int:comparison_id>/award', methods=['POST'])
def award_quote(comparison_id):
    data = _get_request_data()
    quote_id = data.get('quote_id')
    operation_by = data.get('operation_by', 'anonymous')
    reason = data.get('reason')
    
    if not quote_id:
        return _json_response({
            'success': False,
            'error': '缺少 quote_id',
            'error_code': 'missing_quote_id'
        }, 400)
    
    result = ComparisonService.award_quote(comparison_id, quote_id, operation_by, reason)
    
    if result['success']:
        return _json_response(result)
    else:
        return _json_response(result, 400)

@api_bp.route('/comparisons/inquiry/<int:inquiry_id>/export', methods=['POST'])
def export_comparison(inquiry_id):
    result = ExportService.export_comparison_to_excel(inquiry_id)
    
    if result['success']:
        return _json_response(result)
    else:
        return _json_response(result, 400)

@api_bp.route('/jobs', methods=['POST'])
def create_background_job():
    data = _get_request_data()
    job_type = data.get('job_type')
    operation_by = data.get('operation_by', 'anonymous')
    inquiry_id = data.get('inquiry_id')
    quote_id = data.get('quote_id')
    params = data.get('params', {})
    max_retries = data.get('max_retries', 3)
    
    if not job_type:
        return _json_response({
            'success': False,
            'error': '缺少 job_type',
            'error_code': 'missing_job_type'
        }, 400)
    
    job = BackgroundJobService.create_job(
        job_type, operation_by, inquiry_id, quote_id, params, max_retries)
    
    return _json_response({
        'success': True,
        'data': job.to_dict()
    }, 201)

@api_bp.route('/jobs', methods=['GET'])
def list_jobs():
    job_type = request.args.get('job_type')
    status = request.args.get('status')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    
    result = BackgroundJobService.list_jobs(job_type, status, page, per_page)
    return _json_response(result)

@api_bp.route('/jobs/failed', methods=['GET'])
def get_failed_jobs():
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    
    result = BackgroundJobService.get_failed_jobs(page, per_page)
    return _json_response(result)

@api_bp.route('/jobs/<job_id>', methods=['GET'])
def get_job(job_id):
    result = BackgroundJobService.get_job(job_id)
    if result['success']:
        return _json_response(result)
    else:
        return _json_response(result, 404)

@api_bp.route('/jobs/<job_id>/execute', methods=['POST'])
def execute_job(job_id):
    result = BackgroundJobService.execute_job(job_id)
    
    if result['success']:
        return _json_response(result)
    else:
        return _json_response(result, 400)

@api_bp.route('/jobs/<job_id>/retry', methods=['POST'])
def retry_job(job_id):
    result = BackgroundJobService.retry_job(job_id)
    
    if result['success']:
        return _json_response(result)
    else:
        return _json_response(result, 400)

@api_bp.route('/expiry/check-all', methods=['POST'])
def check_all_expiry():
    result = ExpiryService.check_all_expiry()
    return _json_response(result)

@api_bp.route('/expiry/expiring-soon', methods=['GET'])
def get_expiring_soon():
    days = int(request.args.get('days', 7))
    result = ExpiryService.get_expiring_soon(days)
    return _json_response(result)

@api_bp.route('/logs', methods=['GET'])
def list_logs():
    operation_by = request.args.get('operation_by')
    if operation_by:
        logs = OperationLogService.get_user_logs(operation_by)
        return _json_response({'success': True, 'data': logs})
    
    return _json_response({
        'success': False,
        'error': '需要指定 operation_by 参数',
        'error_code': 'missing_operation_by'
    }, 400)

@api_bp.route('/logs/failed', methods=['GET'])
def get_failed_operations():
    logs = OperationLogService.get_failed_operations()
    return _json_response({'success': True, 'data': logs})
