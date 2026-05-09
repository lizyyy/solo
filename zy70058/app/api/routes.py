from flask import Blueprint, request, jsonify, send_file
from datetime import datetime, date
import os
import json
from decimal import Decimal
from app import db
from app.models import Account, InstallmentPlan, BillRecord
from app.services.installment_service import InstallmentService
from app.services.revocation_service import RevocationService
from app.services.validation_service import ValidationService
from app.services.exception_service import ExceptionService
from config import Config

api_bp = Blueprint('api', __name__)


def json_response(data, status=200):
    return jsonify({
        'success': status >= 200 and status < 400,
        'data': data,
        'timestamp': datetime.now().isoformat()
    }), status


def error_response(message, status=400, details=None):
    return jsonify({
        'success': False,
        'error': {
            'message': message,
            'details': details
        },
        'timestamp': datetime.now().isoformat()
    }), status


@api_bp.route('/health', methods=['GET'])
def health_check():
    return json_response({'status': 'healthy', 'service': 'creditcard_installment_api'})


@api_bp.route('/accounts', methods=['POST'])
def create_account():
    try:
        data = request.json
        required = ['account_number', 'card_number', 'customer_name', 'credit_limit']
        for field in required:
            if field not in data:
                return error_response(f'Missing required field: {field}')
        
        credit_limit = Decimal(str(data['credit_limit']))
        available_credit = credit_limit - Decimal(str(data.get('used_credit', 0)))
        
        account = Account(
            account_number=data['account_number'],
            card_number=data['card_number'],
            customer_name=data['customer_name'],
            credit_limit=credit_limit,
            available_credit=available_credit,
            used_credit=Decimal(str(data.get('used_credit', 0)))
        )
        db.session.add(account)
        db.session.commit()
        return json_response(account.to_dict(), 201)
    except Exception as e:
        return error_response(str(e), 500)


@api_bp.route('/accounts/<int:account_id>', methods=['GET'])
def get_account(account_id):
    account = Account.query.get(account_id)
    if not account:
        return error_response(f'Account {account_id} not found', 404)
    return json_response(account.to_dict())


@api_bp.route('/installments', methods=['POST'])
def create_installment():
    try:
        data = request.json
        required = ['account_id', 'original_transaction_id', 'original_amount', 'installment_months']
        for field in required:
            if field not in data:
                return error_response(f'Missing required field: {field}')
        
        plan = InstallmentService.create_installment_plan(
            account_id=data['account_id'],
            original_transaction_id=data['original_transaction_id'],
            original_amount=data['original_amount'],
            installment_months=data['installment_months'],
            fee_rate=data.get('fee_rate'),
            start_date=datetime.strptime(data['start_date'], '%Y-%m-%d').date() if data.get('start_date') else None
        )
        return json_response(plan.to_dict(include_amortizations=True), 201)
    except ValueError as e:
        return error_response(str(e), 400)
    except Exception as e:
        return error_response(str(e), 500)


@api_bp.route('/installments/<int:plan_id>', methods=['GET'])
def get_installment(plan_id):
    include_amortizations = request.args.get('include_amortizations', 'false').lower() == 'true'
    plan_data = InstallmentService.get_installment_plan(plan_id, include_amortizations=include_amortizations)
    if not plan_data:
        return error_response(f'Installment plan {plan_id} not found', 404)
    return json_response(plan_data)


@api_bp.route('/accounts/<int:account_id>/installments', methods=['GET'])
def get_account_installments(account_id):
    status = request.args.get('status')
    plans = InstallmentService.get_account_installments(account_id, status=status)
    return json_response({'account_id': account_id, 'installments': plans})


@api_bp.route('/installments/<int:plan_id>/revoke', methods=['POST'])
def revoke_installment(plan_id):
    try:
        data = request.json or {}
        revocation = RevocationService.revoke_installment_plan(
            plan_id=plan_id,
            reason=data.get('reason'),
            transaction_id=data.get('transaction_id')
        )
        return json_response(revocation.to_dict(), 201)
    except ValueError as e:
        return error_response(str(e), 400)
    except Exception as e:
        return error_response(str(e), 500)


@api_bp.route('/installments/<int:plan_id>/early-settle', methods=['POST'])
def early_settle_installment(plan_id):
    try:
        data = request.json or {}
        revocation = RevocationService.early_settle_installment_plan(
            plan_id=plan_id,
            reason=data.get('reason'),
            transaction_id=data.get('transaction_id')
        )
        return json_response(revocation.to_dict(), 201)
    except ValueError as e:
        return error_response(str(e), 400)
    except Exception as e:
        return error_response(str(e), 500)


@api_bp.route('/installments/<int:plan_id>/revocations', methods=['GET'])
def get_plan_revocations(plan_id):
    records = RevocationService.get_revocation_records(plan_id=plan_id)
    return json_response({'plan_id': plan_id, 'revocations': records})


@api_bp.route('/accounts/<int:account_id>/revocations', methods=['GET'])
def get_account_revocations(account_id):
    records = RevocationService.get_revocation_records(account_id=account_id)
    return json_response({'account_id': account_id, 'revocations': records})


@api_bp.route('/accounts/<int:account_id>/bills', methods=['GET'])
def get_account_bills(account_id):
    query = BillRecord.query.filter_by(account_id=account_id)
    
    bill_cycle = request.args.get('bill_cycle')
    if bill_cycle:
        query = query.filter_by(bill_cycle=bill_cycle)
    
    transaction_type = request.args.get('transaction_type')
    if transaction_type:
        query = query.filter_by(transaction_type=transaction_type)
    
    bills = query.order_by(BillRecord.transaction_date.desc(), BillRecord.created_at.desc()).all()
    return json_response({'account_id': account_id, 'bills': [b.to_dict() for b in bills]})


@api_bp.route('/validation/installments/<int:plan_id>/amortization', methods=['GET'])
def validate_amortization(plan_id):
    try:
        result = ValidationService.validate_fee_amortization(plan_id)
        return json_response(result)
    except ValueError as e:
        return error_response(str(e), 404)


@api_bp.route('/validation/installments/<int:plan_id>/payment-chain', methods=['GET'])
def validate_payment_chain(plan_id):
    try:
        result = ValidationService.validate_payment_chain(plan_id)
        return json_response(result)
    except ValueError as e:
        return error_response(str(e), 404)


@api_bp.route('/validation/accounts/<int:account_id>/bills', methods=['GET'])
def validate_bills(account_id):
    try:
        result = ValidationService.validate_bill_consistency(account_id)
        return json_response(result)
    except ValueError as e:
        return error_response(str(e), 404)


@api_bp.route('/validation/installments/<int:plan_id>/comprehensive', methods=['GET'])
def validate_comprehensive(plan_id):
    try:
        result = ValidationService.run_comprehensive_validation(plan_id)
        return json_response(result)
    except ValueError as e:
        return error_response(str(e), 404)


@api_bp.route('/exceptions', methods=['GET'])
def list_exceptions():
    account_id = request.args.get('account_id', type=int)
    plan_id = request.args.get('plan_id', type=int)
    severity = request.args.get('severity')
    status = request.args.get('status')
    exception_type = request.args.get('exception_type')
    limit = request.args.get('limit', 100, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    result = ExceptionService.get_exceptions(
        account_id=account_id,
        plan_id=plan_id,
        severity=severity,
        status=status,
        exception_type=exception_type,
        limit=limit,
        offset=offset
    )
    return json_response(result)


@api_bp.route('/exceptions/<int:exception_id>', methods=['PUT'])
def update_exception(exception_id):
    try:
        data = request.json
        result = ExceptionService.update_exception_status(
            exception_id=exception_id,
            status=data.get('status'),
            notes=data.get('notes'),
            investigation_notes=data.get('investigation_notes')
        )
        return json_response(result)
    except ValueError as e:
        return error_response(str(e), 400)


@api_bp.route('/exceptions/stats', methods=['GET'])
def get_exception_stats():
    stats = ExceptionService.get_exception_statistics()
    return json_response(stats)


@api_bp.route('/pending-tasks', methods=['GET'])
def list_pending_tasks():
    account_id = request.args.get('account_id', type=int)
    plan_id = request.args.get('plan_id', type=int)
    task_type = request.args.get('task_type')
    status = request.args.get('status')
    limit = request.args.get('limit', 100, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    result = ExceptionService.get_pending_tasks(
        account_id=account_id,
        plan_id=plan_id,
        task_type=task_type,
        status=status,
        limit=limit,
        offset=offset
    )
    return json_response(result)


@api_bp.route('/pending-tasks/<int:task_id>', methods=['PUT'])
def update_pending_task(task_id):
    try:
        data = request.json
        result = ExceptionService.update_task_status(
            task_id=task_id,
            status=data.get('status'),
            error_message=data.get('error_message')
        )
        return json_response(result)
    except ValueError as e:
        return error_response(str(e), 400)


@api_bp.route('/pending-tasks/stats', methods=['GET'])
def get_pending_task_stats():
    stats = ExceptionService.get_pending_task_statistics()
    return json_response(stats)


@api_bp.route('/pending-tasks/retry', methods=['POST'])
def retry_failed_tasks():
    data = request.json or {}
    result = ExceptionService.retry_failed_tasks(task_type=data.get('task_type'))
    return json_response(result)


@api_bp.route('/reports/revocation-summary', methods=['GET'])
def get_revocation_summary():
    from app.models import RevocationRecord
    
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    
    query = RevocationRecord.query
    if start_date_str:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        query = query.filter(RevocationRecord.created_at >= start_date)
    if end_date_str:
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        query = query.filter(RevocationRecord.created_at <= end_date)
    
    records = query.all()
    
    summary = {
        'total_revocations': len(records),
        'by_type': {},
        'total_refund': 0,
        'total_penalty': 0,
        'total_to_collect': 0,
        'total_credit_restored': 0,
        'records': [r.to_dict() for r in records]
    }
    
    for record in records:
        summary['by_type'][record.revocation_type] = summary['by_type'].get(record.revocation_type, 0) + 1
        summary['total_refund'] += float(record.total_refund)
        summary['total_penalty'] += float(record.penalty_fee)
        summary['total_to_collect'] += float(record.amount_to_collect)
        summary['total_credit_restored'] += float(record.credit_restored)
    
    return json_response(summary)


@api_bp.route('/exports/revocation-report', methods=['GET'])
def export_revocation_report():
    from app.services.export_service import ExportService
    
    try:
        file_path = ExportService.export_revocation_report(
            start_date=request.args.get('start_date'),
            end_date=request.args.get('end_date')
        )
        return send_file(file_path, as_attachment=True, download_name=os.path.basename(file_path))
    except Exception as e:
        return error_response(str(e), 500)


@api_bp.route('/exports/exception-report', methods=['GET'])
def export_exception_report():
    from app.services.export_service import ExportService
    
    try:
        file_path = ExportService.export_exception_report(
            severity=request.args.get('severity'),
            status=request.args.get('status')
        )
        return send_file(file_path, as_attachment=True, download_name=os.path.basename(file_path))
    except Exception as e:
        return error_response(str(e), 500)


@api_bp.route('/exports/pending-tasks-report', methods=['GET'])
def export_pending_tasks_report():
    from app.services.export_service import ExportService
    
    try:
        file_path = ExportService.export_pending_tasks_report(
            task_type=request.args.get('task_type'),
            status=request.args.get('status')
        )
        return send_file(file_path, as_attachment=True, download_name=os.path.basename(file_path))
    except Exception as e:
        return error_response(str(e), 500)
