from flask import Flask, request, jsonify, make_response
from datetime import datetime, date
import json
import csv
import io
from models import (
    init_db, SessionLocal, Department, Employee, Loan, OffsetVoucher,
    ExceptionRecord, PendingTask, OverdueReminder, ApprovalHistory,
    LoanStatus, OffsetStatus
)
from services import PettyCashService

app = Flask(__name__)


def db_session():
    return SessionLocal()


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "service": "备用金借还结清 API"})


@app.route('/api/departments', methods=['POST'])
def create_department():
    data = request.json
    db = db_session()
    try:
        result = PettyCashService.create_department(
            db,
            name=data.get('name'),
            initial_balance=float(data.get('initial_balance', 0))
        )
        return jsonify(result)
    finally:
        db.close()


@app.route('/api/departments', methods=['GET'])
def list_departments():
    db = db_session()
    try:
        departments = db.query(Department).all()
        return jsonify({
            "success": True,
            "data": [{
                "id": d.id,
                "name": d.name,
                "initial_balance": d.initial_balance,
                "current_balance": d.current_balance,
                "frozen_amount": d.frozen_amount,
                "available_balance": d.available_balance()
            } for d in departments]
        })
    finally:
        db.close()


@app.route('/api/employees', methods=['POST'])
def create_employee():
    data = request.json
    db = db_session()
    try:
        result = PettyCashService.create_employee(
            db,
            name=data.get('name'),
            employee_no=data.get('employee_no'),
            department_id=int(data.get('department_id'))
        )
        return jsonify(result)
    finally:
        db.close()


@app.route('/api/employees', methods=['GET'])
def list_employees():
    db = db_session()
    try:
        employees = db.query(Employee).all()
        return jsonify({
            "success": True,
            "data": [{
                "id": e.id,
                "name": e.name,
                "employee_no": e.employee_no,
                "department_id": e.department_id,
                "is_active": e.is_active
            } for e in employees]
        })
    finally:
        db.close()


@app.route('/api/loans', methods=['POST'])
def create_loan():
    data = request.json
    db = db_session()
    try:
        result = PettyCashService.create_loan(
            db,
            employee_id=int(data.get('employee_id')),
            amount=float(data.get('amount')),
            purpose=data.get('purpose'),
            expected_return_date=datetime.strptime(
                data.get('expected_return_date'), '%Y-%m-%d'
            ).date()
        )
        return jsonify(result)
    except ValueError as e:
        if 'does not match format' in str(e):
            return jsonify({
                "success": False,
                "error": "预计归还日期格式错误，请使用 YYYY-MM-DD 格式"
            })
        raise
    finally:
        db.close()


@app.route('/api/loans', methods=['GET'])
def list_loans():
    db = db_session()
    try:
        status = request.args.get('status')
        employee_id = request.args.get('employee_id')
        department_id = request.args.get('department_id')
        
        query = db.query(Loan)
        if status:
            query = query.filter(Loan.status == status)
        if employee_id:
            query = query.filter(Loan.employee_id == int(employee_id))
        if department_id:
            query = query.filter(Loan.department_id == int(department_id))
        
        loans = query.order_by(Loan.created_at.desc()).all()
        
        return jsonify({
            "success": True,
            "data": [{
                "id": l.id,
                "loan_no": l.loan_no,
                "employee_id": l.employee_id,
                "department_id": l.department_id,
                "amount": l.amount,
                "purpose": l.purpose,
                "expected_return_date": l.expected_return_date.isoformat(),
                "status": l.status,
                "actual_settled_amount": l.actual_settled_amount,
                "remaining_amount": l.remaining_amount
            } for l in loans]
        })
    finally:
        db.close()


@app.route('/api/loans/<int:loan_id>', methods=['GET'])
def get_loan(loan_id):
    db = db_session()
    try:
        result = PettyCashService.get_loan_details(db, loan_id)
        return jsonify(result)
    finally:
        db.close()


@app.route('/api/loans/<int:loan_id>/approve', methods=['POST'])
def approve_loan(loan_id):
    data = request.json
    db = db_session()
    try:
        result = PettyCashService.approve_loan(
            db,
            loan_id=loan_id,
            approver_name=data.get('approver_name'),
            approve=bool(data.get('approve', True)),
            comment=data.get('comment')
        )
        return jsonify(result)
    finally:
        db.close()


@app.route('/api/offsets', methods=['POST'])
def create_offset():
    data = request.json
    db = db_session()
    try:
        result = PettyCashService.create_offset(
            db,
            loan_id=int(data.get('loan_id')),
            offset_amount=float(data.get('offset_amount')),
            expense_amount=float(data.get('expense_amount', 0)),
            cash_return_amount=float(data.get('cash_return_amount', 0)),
            description=data.get('description')
        )
        return jsonify(result)
    finally:
        db.close()


@app.route('/api/offsets', methods=['GET'])
def list_offsets():
    db = db_session()
    try:
        status = request.args.get('status')
        loan_id = request.args.get('loan_id')
        
        query = db.query(OffsetVoucher)
        if status:
            query = query.filter(OffsetVoucher.status == status)
        if loan_id:
            query = query.filter(OffsetVoucher.loan_id == int(loan_id))
        
        offsets = query.order_by(OffsetVoucher.created_at.desc()).all()
        
        return jsonify({
            "success": True,
            "data": [{
                "id": o.id,
                "voucher_no": o.voucher_no,
                "loan_id": o.loan_id,
                "offset_amount": o.offset_amount,
                "expense_amount": o.expense_amount,
                "cash_return_amount": o.cash_return_amount,
                "status": o.status
            } for o in offsets]
        })
    finally:
        db.close()


@app.route('/api/offsets/<int:offset_id>/approve', methods=['POST'])
def approve_offset(offset_id):
    data = request.json
    db = db_session()
    try:
        result = PettyCashService.approve_offset(
            db,
            offset_id=offset_id,
            approver_name=data.get('approver_name'),
            approve=bool(data.get('approve', True)),
            comment=data.get('comment')
        )
        return jsonify(result)
    finally:
        db.close()


@app.route('/api/overdue/check', methods=['POST'])
def check_overdue():
    db = db_session()
    try:
        result = PettyCashService.check_overdue(db)
        return jsonify(result)
    finally:
        db.close()


@app.route('/api/overdue/reminders', methods=['GET'])
def list_overdue_reminders():
    db = db_session()
    try:
        is_read = request.args.get('is_read')
        
        query = db.query(OverdueReminder)
        if is_read is not None:
            query = query.filter(OverdueReminder.is_read == (is_read.lower() == 'true'))
        
        reminders = query.order_by(OverdueReminder.created_at.desc()).all()
        
        return jsonify({
            "success": True,
            "data": [{
                "id": r.id,
                "loan_id": r.loan_id,
                "reminder_date": r.reminder_date.isoformat(),
                "reminder_content": r.reminder_content,
                "is_read": r.is_read
            } for r in reminders]
        })
    finally:
        db.close()


@app.route('/api/reports/departments', methods=['GET'])
def department_report():
    db = db_session()
    try:
        dept_id = request.args.get('department_id')
        department_id = int(dept_id) if dept_id else None
        result = PettyCashService.get_department_report(db, department_id)
        return jsonify(result)
    finally:
        db.close()


@app.route('/api/reports/departments/export', methods=['GET'])
def export_department_report():
    db = db_session()
    try:
        dept_id = request.args.get('department_id')
        department_id = int(dept_id) if dept_id else None
        result = PettyCashService.get_department_report(db, department_id)
        
        if not result['success']:
            return jsonify(result), 400
        
        departments = result['data']
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow(['备用金部门对账报表'])
        writer.writerow(['生成时间', result['generated_at']])
        writer.writerow([])
        
        writer.writerow([
            '部门ID', '部门名称', '初始余额', '当前余额', '冻结金额', '可用余额',
            '借款单总数', '已审批借款', '待审批借款', '逾期借款', '已结清借款',
            '累计借款金额', '累计结清金额', '未结清余额',
            '冲账凭证数', '累计冲账金额', '累计费用报销', '累计现金归还'
        ])
        
        for d in departments:
            ls = d['loan_stats']
            os = d['offset_stats']
            writer.writerow([
                d['department_id'], d['department_name'],
                d['initial_balance'], d['current_balance'], d['frozen_amount'], d['available_balance'],
                ls['total_loans'], ls['approved_loans'], ls['pending_approval_loans'],
                ls['overdue_loans'], ls['full_settled_loans'],
                ls['total_borrowed'], ls['total_settled'], ls['total_remaining'],
                os['total_offsets'], os['total_offset_amount'],
                os['total_expense'], os['total_cash_return']
            ])
        
        response = make_response(output.getvalue())
        response.headers['Content-Type'] = 'text/csv; charset=utf-8-sig'
        response.headers['Content-Disposition'] = (
            f'attachment; filename=department_report_{date.today()}.csv'
        )
        return response
    finally:
        db.close()


@app.route('/api/reports/loan-details/export', methods=['GET'])
def export_loan_details():
    db = db_session()
    try:
        loan_id = request.args.get('loan_id')
        if not loan_id:
            return jsonify({"success": False, "error": "请提供 loan_id 参数"}), 400
        
        result = PettyCashService.get_loan_details(db, int(loan_id))
        if not result['success']:
            return jsonify(result), 400
        
        loan = result['data']
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow(['借款单详情报表'])
        writer.writerow([])
        
        writer.writerow(['借款单号', loan['loan_no']])
        writer.writerow(['员工', loan['employee_name']])
        writer.writerow(['员工号', loan['employee_no']])
        writer.writerow(['部门', loan['department_name']])
        writer.writerow(['借款金额', loan['amount']])
        writer.writerow(['借款用途', loan['purpose']])
        writer.writerow(['预计归还日期', loan['expected_return_date']])
        writer.writerow(['当前状态', loan['status']])
        writer.writerow(['已结清金额', loan['actual_settled_amount']])
        writer.writerow(['剩余金额', loan['remaining_amount']])
        writer.writerow(['创建时间', loan['created_at']])
        writer.writerow([])
        
        writer.writerow(['冲账记录'])
        writer.writerow(['凭证号', '冲账金额', '费用报销', '现金归还', '状态', '创建时间'])
        for o in loan['offsets']:
            writer.writerow([
                o['voucher_no'], o['offset_amount'], o['expense_amount'],
                o['cash_return_amount'], o['status'], o['created_at']
            ])
        writer.writerow([])
        
        writer.writerow(['审批历史'])
        writer.writerow(['审批人', '操作', '备注', '时间'])
        for a in loan['approval_history']:
            writer.writerow([a['approver'], a['action'], a['comment'], a['time']])
        writer.writerow([])
        
        writer.writerow(['逾期提醒记录'])
        writer.writerow(['提醒日期', '提醒内容', '已读'])
        for r in loan['overdue_reminders']:
            writer.writerow([r['date'], r['content'], '是' if r['is_read'] else '否'])
        
        response = make_response(output.getvalue())
        response.headers['Content-Type'] = 'text/csv; charset=utf-8-sig'
        response.headers['Content-Disposition'] = (
            f'attachment; filename=loan_{loan["loan_no"]}_details.csv'
        )
        return response
    finally:
        db.close()


@app.route('/api/exceptions', methods=['GET'])
def list_exceptions():
    db = db_session()
    try:
        is_resolved = request.args.get('is_resolved')
        source_type = request.args.get('source_type')
        
        query = db.query(ExceptionRecord)
        if is_resolved is not None:
            query = query.filter(ExceptionRecord.is_resolved == (is_resolved.lower() == 'true'))
        if source_type:
            query = query.filter(ExceptionRecord.source_type == source_type)
        
        exceptions = query.order_by(ExceptionRecord.created_at.desc()).all()
        
        return jsonify({
            "success": True,
            "data": [{
                "id": e.id,
                "source_type": e.source_type,
                "source_id": e.source_id,
                "error_code": e.error_code,
                "error_message": e.error_message,
                "data_snapshot": json.loads(e.data_snapshot) if e.data_snapshot else None,
                "is_resolved": e.is_resolved,
                "resolution_note": e.resolution_note,
                "created_at": e.created_at.isoformat()
            } for e in exceptions]
        })
    finally:
        db.close()


@app.route('/api/exceptions/<int:exc_id>/resolve', methods=['POST'])
def resolve_exception(exc_id):
    data = request.json
    db = db_session()
    try:
        exc = db.query(ExceptionRecord).filter(ExceptionRecord.id == exc_id).first()
        if not exc:
            return jsonify({"success": False, "error": "异常记录不存在"}), 404
        
        exc.is_resolved = True
        exc.resolution_note = data.get('resolution_note')
        exc.resolved_at = datetime.utcnow()
        db.commit()
        
        return jsonify({
            "success": True,
            "data": {"id": exc.id, "is_resolved": True}
        })
    finally:
        db.close()


@app.route('/api/pending-tasks', methods=['GET'])
def list_pending_tasks():
    db = db_session()
    try:
        is_completed = request.args.get('is_completed')
        task_type = request.args.get('task_type')
        priority = request.args.get('priority')
        
        query = db.query(PendingTask)
        if is_completed is not None:
            query = query.filter(PendingTask.is_completed == (is_completed.lower() == 'true'))
        if task_type:
            query = query.filter(PendingTask.task_type == task_type)
        if priority:
            query = query.filter(PendingTask.priority == priority)
        
        tasks = query.order_by(PendingTask.is_completed.asc(), PendingTask.created_at.desc()).all()
        
        return jsonify({
            "success": True,
            "data": [{
                "id": t.id,
                "task_type": t.task_type,
                "related_id": t.related_id,
                "description": t.description,
                "priority": t.priority,
                "is_completed": t.is_completed,
                "assigned_to": t.assigned_to,
                "created_at": t.created_at.isoformat()
            } for t in tasks]
        })
    finally:
        db.close()


@app.route('/api/pending-tasks/<int:task_id>/complete', methods=['POST'])
def complete_task(task_id):
    db = db_session()
    try:
        task = db.query(PendingTask).filter(PendingTask.id == task_id).first()
        if not task:
            return jsonify({"success": False, "error": "待处理任务不存在"}), 404
        
        task.is_completed = True
        task.completed_at = datetime.utcnow()
        db.commit()
        
        return jsonify({
            "success": True,
            "data": {"id": task.id, "is_completed": True}
        })
    finally:
        db.close()


@app.route('/api/approval-history/<string:source_type>/<int:source_id>', methods=['GET'])
def get_approval_history(source_type, source_id):
    db = db_session()
    try:
        query = db.query(ApprovalHistory)
        if source_type == 'loan':
            query = query.filter(ApprovalHistory.loan_id == source_id)
        elif source_type == 'offset':
            query = query.filter(ApprovalHistory.offset_id == source_id)
        else:
            return jsonify({"success": False, "error": "source_type 必须是 'loan' 或 'offset'"}), 400
        
        history = query.order_by(ApprovalHistory.created_at.desc()).all()
        
        return jsonify({
            "success": True,
            "data": [{
                "id": h.id,
                "approver_name": h.approver_name,
                "action": h.action,
                "comment": h.comment,
                "created_at": h.created_at.isoformat()
            } for h in history]
        })
    finally:
        db.close()


if __name__ == '__main__':
    init_db()
    print("备用金借还结清 API 服务已启动")
    print("服务地址: http://localhost:5000")
    print("健康检查: http://localhost:5000/health")
    app.run(host='0.0.0.0', port=5000, debug=False)
