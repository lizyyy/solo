from flask import request, jsonify
from app.routes import api
from app import db
from app.models import StampLoan, Stamp
from datetime import datetime
import json

@api.route('/loans', methods=['GET'])
def get_loans():
    """获取外借记录列表，支持筛选"""
    loan_number = request.args.get('loan_number')
    stamp_code = request.args.get('stamp_code')
    borrower_id = request.args.get('borrower_id')
    borrower_name = request.args.get('borrower_name')
    borrower_department = request.args.get('borrower_department')
    status = request.args.get('status')
    is_overdue = request.args.get('is_overdue')
    
    query = StampLoan.query
    
    if loan_number:
        query = query.filter(StampLoan.loan_number.contains(loan_number))
    if stamp_code:
        query = query.filter(StampLoan.stamp_code == stamp_code)
    if borrower_id:
        query = query.filter(StampLoan.borrower_id == borrower_id)
    if borrower_name:
        query = query.filter(StampLoan.borrower_name.contains(borrower_name))
    if borrower_department:
        query = query.filter(StampLoan.borrower_department == borrower_department)
    if status:
        query = query.filter(StampLoan.status == status)
    if is_overdue is not None:
        query = query.filter(StampLoan.is_overdue == (is_overdue.lower() == 'true'))
    
    sort_by = request.args.get('sort_by', 'loan_date')
    sort_order = request.args.get('sort_order', 'desc')
    
    if sort_order == 'desc':
        query = query.order_by(getattr(StampLoan, sort_by).desc())
    else:
        query = query.order_by(getattr(StampLoan, sort_by))
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'loans': [loan.to_dict() for loan in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page
    })

@api.route('/loans/<int:loan_id>', methods=['GET'])
def get_loan(loan_id):
    """获取单个外借记录详情"""
    loan = StampLoan.query.get_or_404(loan_id)
    return jsonify(loan.to_dict())

@api.route('/loans', methods=['POST'])
def create_loan():
    """创建新的外借记录"""
    data = request.get_json()
    
    required_fields = ['loan_number', 'stamp_code', 'borrower_id', 'borrower_name', 
                      'loan_date', 'expected_return_date']
    
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    existing_loan = StampLoan.query.filter_by(
        loan_number=data['loan_number']
    ).first()
    
    if existing_loan:
        return jsonify({'error': 'Loan number already exists'}), 400
    
    loan_date = datetime.strptime(data['loan_date'], '%Y-%m-%d')
    expected_return_date = datetime.strptime(data['expected_return_date'], '%Y-%m-%d')
    
    actual_return_date = None
    if 'actual_return_date' in data and data['actual_return_date']:
        actual_return_date = datetime.strptime(data['actual_return_date'], '%Y-%m-%d')
    
    new_loan = StampLoan(
        loan_number=data['loan_number'],
        stamp_code=data['stamp_code'],
        borrower_id=data['borrower_id'],
        borrower_name=data['borrower_name'],
        borrower_department=data.get('borrower_department'),
        loan_reason=data.get('loan_reason'),
        loan_date=loan_date,
        expected_return_date=expected_return_date,
        actual_return_date=actual_return_date,
        status=data.get('status', 'on_loan'),
        is_overdue=data.get('is_overdue', False)
    )
    
    db.session.add(new_loan)
    db.session.commit()
    
    return jsonify(new_loan.to_dict()), 201

@api.route('/loans/<int:loan_id>', methods=['PUT'])
def update_loan(loan_id):
    """更新外借记录信息"""
    loan = StampLoan.query.get_or_404(loan_id)
    data = request.get_json()
    
    if 'stamp_code' in data:
        loan.stamp_code = data['stamp_code']
    if 'borrower_id' in data:
        loan.borrower_id = data['borrower_id']
    if 'borrower_name' in data:
        loan.borrower_name = data['borrower_name']
    if 'borrower_department' in data:
        loan.borrower_department = data['borrower_department']
    if 'loan_reason' in data:
        loan.loan_reason = data['loan_reason']
    if 'loan_date' in data:
        loan.loan_date = datetime.strptime(data['loan_date'], '%Y-%m-%d')
    if 'expected_return_date' in data:
        loan.expected_return_date = datetime.strptime(data['expected_return_date'], '%Y-%m-%d')
    if 'actual_return_date' in data:
        loan.actual_return_date = datetime.strptime(data['actual_return_date'], '%Y-%m-%d') if data['actual_return_date'] else None
    if 'status' in data:
        loan.status = data['status']
    if 'is_overdue' in data:
        loan.is_overdue = data['is_overdue']
    
    db.session.commit()
    
    return jsonify(loan.to_dict())

@api.route('/loans/<int:loan_id>/return', methods=['POST'])
def return_loan(loan_id):
    """归还印章"""
    loan = StampLoan.query.get_or_404(loan_id)
    data = request.get_json()
    
    return_date = datetime.utcnow()
    if data and 'return_date' in data:
        return_date = datetime.strptime(data['return_date'], '%Y-%m-%d')
    
    loan.actual_return_date = return_date
    loan.status = 'returned'
    loan.is_overdue = False
    
    db.session.commit()
    
    return jsonify({
        'message': 'Stamp returned successfully',
        'loan': loan.to_dict()
    })

@api.route('/loans/check-overdue', methods=['POST'])
def check_overdue_loans():
    """检查逾期外借记录"""
    today = datetime.utcnow().date()
    
    overdue_loans = StampLoan.query.filter(
        StampLoan.status == 'on_loan',
        StampLoan.expected_return_date < today
    ).all()
    
    updated_count = 0
    for loan in overdue_loans:
        if not loan.is_overdue:
            loan.is_overdue = True
            updated_count += 1
    
    db.session.commit()
    
    return jsonify({
        'message': 'Overdue check completed',
        'total_overdue': len(overdue_loans),
        'updated_count': updated_count,
        'overdue_loans': [loan.to_dict() for loan in overdue_loans]
    })
