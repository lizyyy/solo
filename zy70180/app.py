from flask import Flask, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os
import csv
from io import StringIO, BytesIO
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///reimbursement.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)


class Budget(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    department = db.Column(db.String(100), unique=True, nullable=False)
    total_amount = db.Column(db.Float, default=0)
    used_amount = db.Column(db.Float, default=0)
    frozen_amount = db.Column(db.Float, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def available_amount(self):
        return self.total_amount - self.used_amount - self.frozen_amount


class Reimbursement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    department = db.Column(db.String(100), nullable=False)
    applicant = db.Column(db.String(100), nullable=False)
    reason = db.Column(db.String(500), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default='draft')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    remark = db.Column(db.String(500))


class BudgetFreeze(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    reimbursement_id = db.Column(db.Integer, db.ForeignKey('reimbursement.id'), nullable=False)
    budget_id = db.Column(db.Integer, db.ForeignKey('budget.id'), nullable=False)
    department = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default='active')
    freeze_type = db.Column(db.String(20), default='submission')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    released_at = db.Column(db.DateTime)
    reimbursement = db.relationship('Reimbursement', backref=db.backref('freezes', lazy=True))


class Invoice(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    invoice_no = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    invoice_date = db.Column(db.Date, nullable=False)
    reimbursement_id = db.Column(db.Integer, db.ForeignKey('reimbursement.id'))
    bound_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class PaymentReceipt(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    reimbursement_id = db.Column(db.Integer, db.ForeignKey('reimbursement.id'), nullable=False)
    payment_amount = db.Column(db.Float, nullable=False)
    payment_method = db.Column(db.String(50), default='bank')
    payment_time = db.Column(db.DateTime, default=datetime.utcnow)
    operator = db.Column(db.String(100), nullable=False)
    remark = db.Column(db.String(500))
    reimbursement = db.relationship('Reimbursement', backref=db.backref('receipts', lazy=True))


class FailedOperation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    operation_type = db.Column(db.String(50), nullable=False)
    reimbursement_id = db.Column(db.Integer, db.ForeignKey('reimbursement.id'))
    error_message = db.Column(db.String(1000), nullable=False)
    retry_count = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_attempt_at = db.Column(db.DateTime)
    resolved_at = db.Column(db.DateTime)


def init_db():
    with app.app_context():
        db.create_all()
        if Budget.query.count() == 0:
            initial_budgets = [
                Budget(department='市场部', total_amount=100000),
                Budget(department='技术部', total_amount=150000),
                Budget(department='人事部', total_amount=50000),
                Budget(department='财务部', total_amount=30000),
            ]
            db.session.add_all(initial_budgets)
            db.session.commit()


@app.route('/api/budgets', methods=['GET'])
def list_budgets():
    budgets = Budget.query.all()
    return jsonify({
        'success': True,
        'data': [{
            'id': b.id,
            'department': b.department,
            'total_amount': b.total_amount,
            'used_amount': b.used_amount,
            'frozen_amount': b.frozen_amount,
            'available_amount': b.available_amount
        } for b in budgets]
    })


@app.route('/api/budgets', methods=['POST'])
def create_budget():
    data = request.json
    existing = Budget.query.filter_by(department=data['department']).first()
    if existing:
        return jsonify({'success': False, 'message': '该部门预算已存在'}), 400
    
    budget = Budget(
        department=data['department'],
        total_amount=data.get('total_amount', 0)
    )
    db.session.add(budget)
    db.session.commit()
    return jsonify({'success': True, 'message': '预算创建成功', 'data': {'id': budget.id}})


@app.route('/api/reimbursements', methods=['POST'])
def create_reimbursement():
    data = request.json
    reimbursement = Reimbursement(
        department=data['department'],
        applicant=data['applicant'],
        reason=data['reason'],
        amount=data['amount'],
        status='draft'
    )
    db.session.add(reimbursement)
    db.session.commit()
    return jsonify({
        'success': True, 
        'message': '报销单创建成功', 
        'data': {'id': reimbursement.id, 'status': reimbursement.status}
    })


@app.route('/api/reimbursements/<int:rid>/submit', methods=['POST'])
def submit_reimbursement(rid):
    reimbursement = Reimbursement.query.get(rid)
    if not reimbursement:
        return jsonify({'success': False, 'message': '报销单不存在'}), 404
    
    if reimbursement.status != 'draft':
        return jsonify({'success': False, 'message': f'当前状态为{reimbursement.status}，无法提交'}), 400
    
    try:
        budget = Budget.query.filter_by(department=reimbursement.department).first()
        if not budget:
            raise Exception(f'部门{reimbursement.department}没有设置预算')
        
        if budget.available_amount < reimbursement.amount:
            raise Exception(f'预算不足，可用金额{budget.available_amount}元，申请金额{reimbursement.amount}元')
        
        budget.frozen_amount += reimbursement.amount
        
        freeze = BudgetFreeze(
            reimbursement_id=reimbursement.id,
            budget_id=budget.id,
            department=reimbursement.department,
            amount=reimbursement.amount,
            freeze_type='submission'
        )
        db.session.add(freeze)
        
        reimbursement.status = 'pending'
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': '提交成功，预算已冻结',
            'data': {
                'reimbursement_id': reimbursement.id,
                'status': reimbursement.status,
                'frozen_amount': reimbursement.amount,
                'remaining_available': budget.available_amount
            }
        })
    except Exception as e:
        db.session.rollback()
        failed_op = FailedOperation(
            operation_type='submit_reimbursement',
            reimbursement_id=rid,
            error_message=str(e)
        )
        db.session.add(failed_op)
        db.session.commit()
        return jsonify({'success': False, 'message': str(e), 'failed_operation_id': failed_op.id}), 500


@app.route('/api/reimbursements/<int:rid>/reject', methods=['POST'])
def reject_reimbursement(rid):
    data = request.json
    reimbursement = Reimbursement.query.get(rid)
    if not reimbursement:
        return jsonify({'success': False, 'message': '报销单不存在'}), 404
    
    if reimbursement.status != 'pending':
        return jsonify({'success': False, 'message': f'当前状态为{reimbursement.status}，无法驳回'}), 400
    
    try:
        freezes = BudgetFreeze.query.filter_by(
            reimbursement_id=rid, 
            status='active'
        ).all()
        
        for freeze in freezes:
            budget = Budget.query.get(freeze.budget_id)
            if budget:
                budget.frozen_amount -= freeze.amount
                freeze.status = 'released'
                freeze.released_at = datetime.utcnow()
        
        reimbursement.status = 'rejected'
        reimbursement.remark = data.get('reason', '')
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': '驳回成功，冻结预算已释放',
            'data': {
                'reimbursement_id': reimbursement.id,
                'status': reimbursement.status,
                'released_amount': sum(f.amount for f in freezes)
            }
        })
    except Exception as e:
        db.session.rollback()
        failed_op = FailedOperation(
            operation_type='reject_reimbursement',
            reimbursement_id=rid,
            error_message=str(e)
        )
        db.session.add(failed_op)
        db.session.commit()
        return jsonify({'success': False, 'message': str(e), 'failed_operation_id': failed_op.id}), 500


@app.route('/api/reimbursements/<int:rid>/approve', methods=['POST'])
def approve_reimbursement(rid):
    reimbursement = Reimbursement.query.get(rid)
    if not reimbursement:
        return jsonify({'success': False, 'message': '报销单不存在'}), 404
    
    if reimbursement.status != 'pending':
        return jsonify({'success': False, 'message': f'当前状态为{reimbursement.status}，无法审批通过'}), 400
    
    try:
        freezes = BudgetFreeze.query.filter_by(
            reimbursement_id=rid, 
            status='active'
        ).all()
        
        for freeze in freezes:
            budget = Budget.query.get(freeze.budget_id)
            if budget:
                budget.frozen_amount -= freeze.amount
                budget.used_amount += freeze.amount
                freeze.status = 'consumed'
                freeze.released_at = datetime.utcnow()
        
        reimbursement.status = 'approved'
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': '审批通过，预算已占用',
            'data': {
                'reimbursement_id': reimbursement.id,
                'status': reimbursement.status,
                'consumed_amount': sum(f.amount for f in freezes)
            }
        })
    except Exception as e:
        db.session.rollback()
        failed_op = FailedOperation(
            operation_type='approve_reimbursement',
            reimbursement_id=rid,
            error_message=str(e)
        )
        db.session.add(failed_op)
        db.session.commit()
        return jsonify({'success': False, 'message': str(e), 'failed_operation_id': failed_op.id}), 500


@app.route('/api/reimbursements/<int:rid>/withdraw', methods=['POST'])
def withdraw_reimbursement(rid):
    reimbursement = Reimbursement.query.get(rid)
    if not reimbursement:
        return jsonify({'success': False, 'message': '报销单不存在'}), 404
    
    if reimbursement.status not in ['pending', 'approved']:
        return jsonify({'success': False, 'message': f'当前状态为{reimbursement.status}，无法撤回'}), 400
    
    try:
        if reimbursement.status == 'pending':
            freezes = BudgetFreeze.query.filter_by(
                reimbursement_id=rid, 
                status='active'
            ).all()
            
            for freeze in freezes:
                budget = Budget.query.get(freeze.budget_id)
                if budget:
                    budget.frozen_amount -= freeze.amount
                    freeze.status = 'released'
                    freeze.released_at = datetime.utcnow()
                    
        elif reimbursement.status == 'approved':
            freezes = BudgetFreeze.query.filter_by(
                reimbursement_id=rid, 
                status='consumed'
            ).all()
            
            for freeze in freezes:
                budget = Budget.query.get(freeze.budget_id)
                if budget:
                    budget.used_amount -= freeze.amount
                    freeze.status = 'released'
                    freeze.released_at = datetime.utcnow()
        
        reimbursement.status = 'withdrawn'
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': '撤回成功，预算已释放',
            'data': {
                'reimbursement_id': reimbursement.id,
                'status': reimbursement.status,
                'released_amount': sum(f.amount for f in freezes)
            }
        })
    except Exception as e:
        db.session.rollback()
        failed_op = FailedOperation(
            operation_type='withdraw_reimbursement',
            reimbursement_id=rid,
            error_message=str(e)
        )
        db.session.add(failed_op)
        db.session.commit()
        return jsonify({'success': False, 'message': str(e), 'failed_operation_id': failed_op.id}), 500


@app.route('/api/reimbursements/<int:rid>/invoices', methods=['POST'])
def bind_invoice(rid):
    data = request.json
    reimbursement = Reimbursement.query.get(rid)
    if not reimbursement:
        return jsonify({'success': False, 'message': '报销单不存在'}), 404
    
    invoice = Invoice(
        invoice_no=data['invoice_no'],
        amount=data['amount'],
        invoice_date=datetime.strptime(data['invoice_date'], '%Y-%m-%d').date(),
        reimbursement_id=rid,
        bound_at=datetime.utcnow()
    )
    db.session.add(invoice)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': '发票绑定成功',
        'data': {'invoice_id': invoice.id}
    })


@app.route('/api/reimbursements/<int:rid>/invoices', methods=['GET'])
def list_invoices(rid):
    invoices = Invoice.query.filter_by(reimbursement_id=rid).all()
    return jsonify({
        'success': True,
        'data': [{
            'id': i.id,
            'invoice_no': i.invoice_no,
            'amount': i.amount,
            'invoice_date': i.invoice_date.strftime('%Y-%m-%d'),
            'bound_at': i.bound_at.strftime('%Y-%m-%d %H:%M:%S') if i.bound_at else None
        } for i in invoices]
    })


@app.route('/api/reimbursements/<int:rid>/payment', methods=['POST'])
def create_payment(rid):
    data = request.json
    reimbursement = Reimbursement.query.get(rid)
    if not reimbursement:
        return jsonify({'success': False, 'message': '报销单不存在'}), 404
    
    if reimbursement.status != 'approved':
        return jsonify({'success': False, 'message': f'当前状态为{reimbursement.status}，无法付款'}), 400
    
    receipt = PaymentReceipt(
        reimbursement_id=rid,
        payment_amount=data['payment_amount'],
        payment_method=data.get('payment_method', 'bank'),
        operator=data['operator'],
        remark=data.get('remark', '')
    )
    db.session.add(receipt)
    reimbursement.status = 'paid'
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': '付款完成',
        'data': {
            'receipt_id': receipt.id,
            'status': reimbursement.status
        }
    })


@app.route('/api/reimbursements/<int:rid>/payment', methods=['GET'])
def get_payment(rid):
    receipts = PaymentReceipt.query.filter_by(reimbursement_id=rid).all()
    return jsonify({
        'success': True,
        'data': [{
            'id': r.id,
            'payment_amount': r.payment_amount,
            'payment_method': r.payment_method,
            'payment_time': r.payment_time.strftime('%Y-%m-%d %H:%M:%S'),
            'operator': r.operator,
            'remark': r.remark
        } for r in receipts]
    })


@app.route('/api/failed-operations', methods=['GET'])
def list_failed_operations():
    ops = FailedOperation.query.filter_by(status='pending').order_by(FailedOperation.created_at.desc()).all()
    return jsonify({
        'success': True,
        'data': [{
            'id': o.id,
            'operation_type': o.operation_type,
            'reimbursement_id': o.reimbursement_id,
            'error_message': o.error_message,
            'retry_count': o.retry_count,
            'created_at': o.created_at.strftime('%Y-%m-%d %H:%M:%S')
        } for o in ops]
    })


@app.route('/api/failed-operations/<int:oid>/retry', methods=['POST'])
def retry_operation(oid):
    failed_op = FailedOperation.query.get(oid)
    if not failed_op:
        return jsonify({'success': False, 'message': '失败记录不存在'}), 404
    
    if failed_op.status != 'pending':
        return jsonify({'success': False, 'message': '该操作已处理'}), 400
    
    failed_op.retry_count += 1
    failed_op.last_attempt_at = datetime.utcnow()
    
    try:
        if failed_op.operation_type == 'submit_reimbursement':
            result = submit_reimbursement(failed_op.reimbursement_id)
        elif failed_op.operation_type == 'reject_reimbursement':
            result = reject_reimbursement(failed_op.reimbursement_id)
        elif failed_op.operation_type == 'approve_reimbursement':
            result = approve_reimbursement(failed_op.reimbursement_id)
        elif failed_op.operation_type == 'withdraw_reimbursement':
            result = withdraw_reimbursement(failed_op.reimbursement_id)
        else:
            raise Exception(f'未知操作类型: {failed_op.operation_type}')
        
        failed_op.status = 'resolved'
        failed_op.resolved_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '重试成功',
            'original_result': result.get_json()
        })
    except Exception as e:
        db.session.commit()
        return jsonify({
            'success': False,
            'message': f'重试失败: {str(e)}',
            'retry_count': failed_op.retry_count
        }), 500


@app.route('/api/reports/department', methods=['GET'])
def department_report():
    department = request.args.get('department')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    query = Reimbursement.query
    if department:
        query = query.filter_by(department=department)
    if start_date:
        query = query.filter(Reimbursement.created_at >= datetime.strptime(start_date, '%Y-%m-%d'))
    if end_date:
        query = query.filter(Reimbursement.created_at <= datetime.strptime(end_date, '%Y-%m-%d'))
    
    reimbursements = query.all()
    
    report_data = {}
    for r in reimbursements:
        if r.department not in report_data:
            report_data[r.department] = {
                'department': r.department,
                'total_count': 0,
                'total_amount': 0,
                'pending_count': 0,
                'pending_amount': 0,
                'approved_count': 0,
                'approved_amount': 0,
                'paid_count': 0,
                'paid_amount': 0,
                'rejected_count': 0,
                'rejected_amount': 0,
                'withdrawn_count': 0,
                'withdrawn_amount': 0,
            }
        
        dep = report_data[r.department]
        dep['total_count'] += 1
        dep['total_amount'] += r.amount
        
        if r.status == 'pending':
            dep['pending_count'] += 1
            dep['pending_amount'] += r.amount
        elif r.status == 'approved':
            dep['approved_count'] += 1
            dep['approved_amount'] += r.amount
        elif r.status == 'paid':
            dep['paid_count'] += 1
            dep['paid_amount'] += r.amount
        elif r.status == 'rejected':
            dep['rejected_count'] += 1
            dep['rejected_amount'] += r.amount
        elif r.status == 'withdrawn':
            dep['withdrawn_count'] += 1
            dep['withdrawn_amount'] += r.amount
    
    budget_map = {b.department: b for b in Budget.query.all()}
    for dep in report_data.values():
        budget = budget_map.get(dep['department'])
        if budget:
            dep['budget_total'] = budget.total_amount
            dep['budget_used'] = budget.used_amount
            dep['budget_frozen'] = budget.frozen_amount
            dep['budget_available'] = budget.available_amount
    
    return jsonify({
        'success': True,
        'data': list(report_data.values())
    })


@app.route('/api/export/department', methods=['GET'])
def export_department_report():
    department = request.args.get('department')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    query = Reimbursement.query
    if department:
        query = query.filter_by(department=department)
    if start_date:
        query = query.filter(Reimbursement.created_at >= datetime.strptime(start_date, '%Y-%m-%d'))
    if end_date:
        query = query.filter(Reimbursement.created_at <= datetime.strptime(end_date, '%Y-%m-%d'))
    
    reimbursements = query.all()
    budget_map = {b.department: b for b in Budget.query.all()}
    
    wb = Workbook()
    ws = wb.active
    ws.title = '部门费用汇总'
    
    headers = ['部门', '预算总额', '已使用', '冻结中', '可用余额',
               '报销单数', '申请总金额', '待审批数', '待审批金额',
               '已通过数', '已通过金额', '已付款数', '已付款金额',
               '已驳回数', '已驳回金额', '已撤回数', '已撤回金额']
    
    header_fill = PatternFill(start_color='4472C4', end_color='4472C4', fill_type='solid')
    header_font = Font(bold=True, color='FFFFFF')
    
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal='center')
    
    report_data = {}
    for r in reimbursements:
        if r.department not in report_data:
            report_data[r.department] = {
                'total_count': 0, 'total_amount': 0,
                'pending_count': 0, 'pending_amount': 0,
                'approved_count': 0, 'approved_amount': 0,
                'paid_count': 0, 'paid_amount': 0,
                'rejected_count': 0, 'rejected_amount': 0,
                'withdrawn_count': 0, 'withdrawn_amount': 0,
            }
        dep = report_data[r.department]
        dep['total_count'] += 1
        dep['total_amount'] += r.amount
        if r.status == 'pending':
            dep['pending_count'] += 1
            dep['pending_amount'] += r.amount
        elif r.status == 'approved':
            dep['approved_count'] += 1
            dep['approved_amount'] += r.amount
        elif r.status == 'paid':
            dep['paid_count'] += 1
            dep['paid_amount'] += r.amount
        elif r.status == 'rejected':
            dep['rejected_count'] += 1
            dep['rejected_amount'] += r.amount
        elif r.status == 'withdrawn':
            dep['withdrawn_count'] += 1
            dep['withdrawn_amount'] += r.amount
    
    row = 2
    for dep_name, dep in report_data.items():
        budget = budget_map.get(dep_name)
        ws.cell(row=row, column=1, value=dep_name)
        ws.cell(row=row, column=2, value=budget.total_amount if budget else 0)
        ws.cell(row=row, column=3, value=budget.used_amount if budget else 0)
        ws.cell(row=row, column=4, value=budget.frozen_amount if budget else 0)
        ws.cell(row=row, column=5, value=budget.available_amount if budget else 0)
        ws.cell(row=row, column=6, value=dep['total_count'])
        ws.cell(row=row, column=7, value=dep['total_amount'])
        ws.cell(row=row, column=8, value=dep['pending_count'])
        ws.cell(row=row, column=9, value=dep['pending_amount'])
        ws.cell(row=row, column=10, value=dep['approved_count'])
        ws.cell(row=row, column=11, value=dep['approved_amount'])
        ws.cell(row=row, column=12, value=dep['paid_count'])
        ws.cell(row=row, column=13, value=dep['paid_amount'])
        ws.cell(row=row, column=14, value=dep['rejected_count'])
        ws.cell(row=row, column=15, value=dep['rejected_amount'])
        ws.cell(row=row, column=16, value=dep['withdrawn_count'])
        ws.cell(row=row, column=17, value=dep['withdrawn_amount'])
        row += 1
    
    for col in range(1, 18):
        ws.column_dimensions[ws.cell(row=1, column=col).column_letter].width = 14
    
    ws_detail = wb.create_sheet('报销单明细')
    detail_headers = ['报销单ID', '部门', '申请人', '事由', '金额', '状态', '创建时间', '备注']
    for col, header in enumerate(detail_headers, 1):
        cell = ws_detail.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal='center')
    
    for i, r in enumerate(reimbursements, 2):
        ws_detail.cell(row=i, column=1, value=r.id)
        ws_detail.cell(row=i, column=2, value=r.department)
        ws_detail.cell(row=i, column=3, value=r.applicant)
        ws_detail.cell(row=i, column=4, value=r.reason)
        ws_detail.cell(row=i, column=5, value=r.amount)
        ws_detail.cell(row=i, column=6, value=r.status)
        ws_detail.cell(row=i, column=7, value=r.created_at.strftime('%Y-%m-%d %H:%M:%S'))
        ws_detail.cell(row=i, column=8, value=r.remark or '')
    
    for col in range(1, 9):
        ws_detail.column_dimensions[ws_detail.cell(row=1, column=col).column_letter].width = 15
    
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    
    filename = f'部门费用报表_{datetime.now().strftime("%Y%m%d")}.xlsx'
    return send_file(
        buf,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=filename
    )


@app.route('/api/reimbursements', methods=['GET'])
def list_reimbursements():
    reimbursements = Reimbursement.query.order_by(Reimbursement.created_at.desc()).all()
    return jsonify({
        'success': True,
        'data': [{
            'id': r.id,
            'department': r.department,
            'applicant': r.applicant,
            'reason': r.reason,
            'amount': r.amount,
            'status': r.status,
            'created_at': r.created_at.strftime('%Y-%m-%d %H:%M:%S')
        } for r in reimbursements]
    })


@app.route('/')
def index():
    return '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>费用报销预算占用系统</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
            h1 { color: #333; border-bottom: 2px solid #4472C4; padding-bottom: 10px; }
            h2 { color: #4472C4; margin-top: 30px; }
            .section { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .code { background: #e9ecef; padding: 15px; border-radius: 4px; font-family: monospace; white-space: pre-wrap; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { border: 1px solid #dee2e6; padding: 10px; text-align: left; }
            th { background: #4472C4; color: white; }
            tr:nth-child(even) { background: #f8f9fa; }
            .status { padding: 3px 8px; border-radius: 4px; font-size: 12px; }
            .status-draft { background: #e2e3e5; }
            .status-pending { background: #fff3cd; }
            .status-approved { background: #d1e7dd; }
            .status-paid { background: #cff4fc; }
            .status-rejected { background: #f8d7da; }
            .status-withdrawn { background: #d6d8db; }
        </style>
    </head>
    <body>
        <h1>💰 费用报销预算占用系统</h1>
        
        <div class="section">
            <h2>📋 验证指南</h2>
            <p>请按以下步骤验证功能是否正常工作，每一步都有明确的验收现象：</p>
            
            <h3>第一步：查看初始预算</h3>
            <p>打开浏览器访问：<strong><a href="/api/budgets" target="_blank">/api/budgets</a></strong></p>
            <p><strong>验收现象：</strong>应看到4个部门的预算信息，每个部门都有预算总额、已使用、冻结中、可用余额4个数字，且可用余额 = 预算总额 - 已使用 - 冻结中</p>
            
            <h3>第二步：创建报销单</h3>
            <div class="code">curl -X POST http://localhost:5000/api/reimbursements \
  -H "Content-Type: application/json" \
  -d '{
    "department": "市场部",
    "applicant": "张三",
    "reason": "客户招待费",
    "amount": 5000
  }'</div>
            <p><strong>验收现象：</strong>返回 <code>success: true</code>，并返回报销单ID</p>
            
            <h3>第三步：提交报销单（预算冻结）</h3>
            <div class="code">curl -X POST http://localhost:5000/api/reimbursements/1/submit</div>
            <p><strong>验收现象：</strong></p>
            <ul>
                <li>返回 <code>success: true</code>，状态变为 <strong>pending</strong></li>
                <li>再次查看预算，市场部的 <strong>冻结中</strong> 金额应增加5000元</li>
                <li><strong>可用余额</strong> 相应减少5000元</li>
            </ul>
            
            <h3>第四步：审批通过（预算占用）</h3>
            <div class="code">curl -X POST http://localhost:5000/api/reimbursements/1/approve</div>
            <p><strong>验收现象：</strong></p>
            <ul>
                <li>返回 <code>success: true</code>，状态变为 <strong>approved</strong></li>
                <li>查看预算：<strong>冻结中</strong> 金额减少5000元，<strong>已使用</strong> 增加5000元</li>
                <li><strong>可用余额</strong> 保持不变（因为只是从冻结转为已使用）</li>
            </ul>
            
            <h3>第五步：绑定发票</h3>
            <div class="code">curl -X POST http://localhost:5000/api/reimbursements/1/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_no": "INV2024001",
    "amount": 5000,
    "invoice_date": "2024-01-15"
  }'</div>
            <p><strong>验收现象：</strong>返回 <code>success: true</code>，可通过 <code>/api/reimbursements/1/invoices</code> 查看绑定的发票</p>
            
            <h3>第六步：付款回执</h3>
            <div class="code">curl -X POST http://localhost:5000/api/reimbursements/1/payment \
  -H "Content-Type: application/json" \
  -d '{
    "payment_amount": 5000,
    "payment_method": "bank",
    "operator": "李会计"
  }'</div>
            <p><strong>验收现象：</strong></p>
            <ul>
                <li>返回 <code>success: true</code>，状态变为 <strong>paid</strong></li>
                <li>可通过 <code>/api/reimbursements/1/payment</code> 查看付款记录</li>
            </ul>
            
            <h3>驳回/撤回测试（另开一个报销单）</h3>
            <ol>
                <li>创建一个新的报销单（金额2000元）</li>
                <li>提交（冻结预算）</li>
                <li>查看预算：冻结中应增加2000元</li>
                <li>驳回：<code>curl -X POST http://localhost:5000/api/reimbursements/2/reject</code></li>
                <li><strong>验收现象：</strong>状态变为 <strong>rejected</strong>，冻结金额应<strong>释放</strong>（冻结中减少2000元）</li>
            </ol>
        </div>
        
        <div class="section">
            <h2>🔧 失败补偿验证</h2>
            <p>系统会自动记录失败的操作，可重试而无需清库：</p>
            <ol>
                <li>查看失败操作：<a href="/api/failed-operations" target="_blank">/api/failed-operations</a></li>
                <li>如有失败记录，可重试：<code>curl -X POST http://localhost:5000/api/failed-operations/{id}/retry</code></li>
            </ol>
            <p><strong>验收现象：</strong>重试成功后，失败记录状态变为已解决，无需删除数据库</p>
        </div>
        
        <div class="section">
            <h2>📊 部门报表</h2>
            <p>查看部门汇总：<a href="/api/reports/department" target="_blank">/api/reports/department</a></p>
            <p>导出Excel报表：<a href="/api/export/department" target="_blank">/api/export/department</a></p>
            <p><strong>验收现象：</strong></p>
            <ul>
                <li>JSON报表包含各部门的报销统计和预算使用情况</li>
                <li>Excel导出包含两个工作表：部门费用汇总、报销单明细</li>
                <li>可直接用于业务复核，包含所有关键业务数据</li>
            </ul>
        </div>
        
        <div class="section">
            <h2>🔍 实时数据查看</h2>
            <ul>
                <li><a href="/api/reimbursements" target="_blank">所有报销单列表</a></li>
                <li><a href="/api/budgets" target="_blank">所有预算状态</a></li>
                <li><a href="/api/failed-operations" target="_blank">待处理的失败操作</a></li>
            </ul>
        </div>
        
        <div class="section">
            <h2>📖 状态流转说明</h2>
            <table>
                <tr><th>状态</th><th>说明</th><th>预算影响</th></tr>
                <tr><td><span class="status status-draft">draft</span></td><td>草稿</td><td>无</td></tr>
                <tr><td><span class="status status-pending">pending</span></td><td>待审批</td><td>预算被冻结，可用余额减少</td></tr>
                <tr><td><span class="status status-approved">approved</span></td><td>已通过</td><td>冻结转已使用</td></tr>
                <tr><td><span class="status status-paid">paid</span></td><td>已付款</td><td>无变化</td></tr>
                <tr><td><span class="status status-rejected">rejected</span></td><td>已驳回</td><td>冻结释放，可用余额恢复</td></tr>
                <tr><td><span class="status status-withdrawn">withdrawn</span></td><td>已撤回</td><td>冻结/已使用释放，可用余额恢复</td></tr>
            </table>
        </div>
    </body>
    </html>
    '''


if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
