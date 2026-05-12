from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from dateutil.relativedelta import relativedelta
from models import db, Team, Service, Quota, UsageRecord, RiskRecord, FrozenRecord, BorrowRequest, ExpansionRequest, Reconciliation

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///quota.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)


def get_current_month():
    return datetime.utcnow().strftime('%Y-%m')


def get_next_month():
    return (datetime.utcnow() + relativedelta(months=1)).strftime('%Y-%m')


def get_team_available_quota(team_id, service_id, month=None, check_time=None):
    if month is None:
        month = get_current_month()
    if check_time is None:
        check_time = datetime.utcnow()
    
    base_quota = Quota.query.filter_by(
        team_id=team_id, service_id=service_id, month=month
    ).first()
    base_amount = base_quota.monthly_quota if base_quota else 0
    
    base_used = db.session.query(db.func.sum(UsageRecord.amount)).filter(
        UsageRecord.team_id == team_id,
        UsageRecord.service_id == service_id,
        UsageRecord.month == month,
        UsageRecord.source == 'base',
        UsageRecord.status.in_(['normal', 'risk'])
    ).scalar() or 0
    
    base_remaining = max(0, base_amount - base_used)
    
    active_expansions = ExpansionRequest.query.filter(
        ExpansionRequest.team_id == team_id,
        ExpansionRequest.service_id == service_id,
        ExpansionRequest.status == 'approved',
        ExpansionRequest.start_date <= check_time,
        ExpansionRequest.end_date >= check_time
    ).all()
    
    expansion_total = sum(e.amount - e.used_amount for e in active_expansions)
    
    approved_borrows = BorrowRequest.query.filter(
        BorrowRequest.borrower_id == team_id,
        BorrowRequest.service_id == service_id,
        BorrowRequest.month == month,
        BorrowRequest.status == 'approved'
    ).all()
    
    borrowed_total = sum(b.amount - b.used_amount for b in approved_borrows)
    
    approved_lends = BorrowRequest.query.filter(
        BorrowRequest.lender_id == team_id,
        BorrowRequest.service_id == service_id,
        BorrowRequest.month == month,
        BorrowRequest.status == 'approved'
    ).all()
    
    lent_total = sum(l.used_amount for l in approved_lends)
    
    return {
        'base': {
            'total': base_amount,
            'used': base_used,
            'remaining': base_remaining
        },
        'expansion': {
            'total': sum(e.amount for e in active_expansions),
            'used': sum(e.used_amount for e in active_expansions),
            'remaining': expansion_total
        },
        'borrowed': {
            'total': sum(b.amount for b in approved_borrows),
            'used': sum(b.used_amount for b in approved_borrows),
            'remaining': borrowed_total
        },
        'lent': {
            'total': sum(l.amount for l in approved_lends),
            'used': lent_total,
            'remaining': sum(l.amount - l.used_amount for l in approved_lends)
        },
        'total_available': base_remaining + expansion_total + borrowed_total,
        'total_used': base_used + sum(e.used_amount for e in active_expansions) + sum(b.used_amount for b in approved_borrows)
    }


@app.route('/api/teams', methods=['POST'])
def create_team():
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': 'Team name is required'}), 400
    
    existing = Team.query.filter_by(name=data['name']).first()
    if existing:
        return jsonify({'error': 'Team already exists', 'team_id': existing.id}), 409
    
    team = Team(
        name=data['name'],
        description=data.get('description', '')
    )
    db.session.add(team)
    db.session.commit()
    
    return jsonify({
        'id': team.id,
        'name': team.name,
        'description': team.description,
        'created_at': team.created_at.isoformat()
    }), 201


@app.route('/api/teams', methods=['GET'])
def list_teams():
    teams = Team.query.all()
    return jsonify([{
        'id': t.id,
        'name': t.name,
        'description': t.description,
        'created_at': t.created_at.isoformat()
    } for t in teams]), 200


@app.route('/api/services', methods=['POST'])
def create_service():
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': 'Service name is required'}), 400
    
    existing = Service.query.filter_by(name=data['name']).first()
    if existing:
        return jsonify({'error': 'Service already exists', 'service_id': existing.id}), 409
    
    service = Service(
        name=data['name'],
        description=data.get('description', '')
    )
    db.session.add(service)
    db.session.commit()
    
    return jsonify({
        'id': service.id,
        'name': service.name,
        'description': service.description,
        'created_at': service.created_at.isoformat()
    }), 201


@app.route('/api/quotas', methods=['POST'])
def set_quota():
    data = request.get_json()
    if not data or not all(k in data for k in ['team_id', 'service_id', 'monthly_quota']):
        return jsonify({'error': 'team_id, service_id, and monthly_quota are required'}), 400
    
    team = Team.query.get(data['team_id'])
    if not team:
        return jsonify({'error': 'Team not found'}), 404
    
    service = Service.query.get(data['service_id'])
    if not service:
        return jsonify({'error': 'Service not found'}), 404
    
    month = data.get('month', get_current_month())
    
    existing = Quota.query.filter_by(
        team_id=data['team_id'],
        service_id=data['service_id'],
        month=month
    ).first()
    
    if existing:
        existing.monthly_quota = data['monthly_quota']
        quota = existing
    else:
        quota = Quota(
            team_id=data['team_id'],
            service_id=data['service_id'],
            monthly_quota=data['monthly_quota'],
            month=month
        )
        db.session.add(quota)
    
    db.session.commit()
    
    return jsonify({
        'id': quota.id,
        'team_id': quota.team_id,
        'service_id': quota.service_id,
        'monthly_quota': quota.monthly_quota,
        'month': quota.month
    }), 200


@app.route('/api/usage', methods=['POST'])
def record_usage():
    data = request.get_json()
    if not data or not all(k in data for k in ['team_id', 'service_id', 'request_id', 'amount']):
        return jsonify({'error': 'team_id, service_id, request_id, and amount are required'}), 400
    
    team = Team.query.get(data['team_id'])
    if not team:
        return jsonify({'error': 'Team not found'}), 404
    
    service = Service.query.get(data['service_id'])
    if not service:
        return jsonify({'error': 'Service not found'}), 404
    
    existing = UsageRecord.query.filter_by(request_id=data['request_id']).first()
    if existing:
        return jsonify({
            'message': 'Duplicate request, returning existing record',
            'is_duplicate': True,
            'record': {
                'id': existing.id,
                'team_id': existing.team_id,
                'service_id': existing.service_id,
                'request_id': existing.request_id,
                'amount': existing.amount,
                'priority': existing.priority,
                'status': existing.status,
                'source': existing.source,
                'created_at': existing.created_at.isoformat()
            }
        }), 200
    
    priority = data.get('priority', 'normal')
    month = get_current_month()
    check_time = datetime.utcnow()
    amount = int(data['amount'])
    
    available = get_team_available_quota(data['team_id'], data['service_id'], month, check_time)
    
    remaining = available['total_available']
    source = 'base'
    borrow_request_id = None
    expansion_request_id = None
    status = 'normal'
    reason = None
    
    if remaining >= amount:
        remaining_after = remaining - amount
        temp_amount = amount
        
        if available['base']['remaining'] >= temp_amount:
            source = 'base'
        else:
            temp_amount -= available['base']['remaining']
            
            active_expansions = ExpansionRequest.query.filter(
                ExpansionRequest.team_id == data['team_id'],
                ExpansionRequest.service_id == data['service_id'],
                ExpansionRequest.status == 'approved',
                ExpansionRequest.start_date <= check_time,
                ExpansionRequest.end_date >= check_time
            ).all()
            
            for exp in active_expansions:
                exp_remaining = exp.amount - exp.used_amount
                if temp_amount <= exp_remaining:
                    exp.used_amount += temp_amount
                    expansion_request_id = exp.id
                    source = 'expansion'
                    temp_amount = 0
                    break
                else:
                    temp_amount -= exp_remaining
                    exp.used_amount += exp_remaining
            
            if temp_amount > 0:
                approved_borrows = BorrowRequest.query.filter(
                    BorrowRequest.borrower_id == data['team_id'],
                    BorrowRequest.service_id == data['service_id'],
                    BorrowRequest.month == month,
                    BorrowRequest.status == 'approved'
                ).all()
                
                for borrow in approved_borrows:
                    borrow_remaining = borrow.amount - borrow.used_amount
                    if temp_amount <= borrow_remaining:
                        borrow.used_amount += temp_amount
                        borrow_request_id = borrow.id
                        source = 'borrowed'
                        temp_amount = 0
                        break
                    else:
                        temp_amount -= borrow_remaining
                        borrow.used_amount += borrow_remaining
    else:
        if priority == 'high':
            status = 'risk'
            reason = f'High priority call exceeded quota by {amount - remaining} units'
        else:
            frozen = FrozenRecord(
                team_id=data['team_id'],
                service_id=data['service_id'],
                request_id=data['request_id'],
                amount=amount,
                reason=f'Quota exceeded. Available: {remaining}, Requested: {amount}',
                month=month
            )
            db.session.add(frozen)
            db.session.commit()
            return jsonify({
                'status': 'frozen',
                'message': 'Call frozen: quota exceeded',
                'available': remaining,
                'requested': amount,
                'frozen_record_id': frozen.id
            }), 403
    
    record = UsageRecord(
        team_id=data['team_id'],
        service_id=data['service_id'],
        request_id=data['request_id'],
        amount=amount,
        priority=priority,
        status=status,
        source=source,
        month=month,
        borrow_request_id=borrow_request_id,
        expansion_request_id=expansion_request_id
    )
    db.session.add(record)
    
    if status == 'risk':
        risk = RiskRecord(
            usage_record_id=record.id,
            description=reason or 'High priority call exceeded quota'
        )
        db.session.add(risk)
    
    db.session.commit()
    
    return jsonify({
        'id': record.id,
        'team_id': record.team_id,
        'service_id': record.service_id,
        'request_id': record.request_id,
        'amount': record.amount,
        'priority': record.priority,
        'status': record.status,
        'source': record.source,
        'month': record.month,
        'created_at': record.created_at.isoformat()
    }), 201


@app.route('/api/expansions', methods=['POST'])
def create_expansion():
    data = request.get_json()
    if not data or not all(k in data for k in ['team_id', 'service_id', 'amount', 'start_date', 'end_date']):
        return jsonify({'error': 'team_id, service_id, amount, start_date, end_date are required'}), 400
    
    team = Team.query.get(data['team_id'])
    if not team:
        return jsonify({'error': 'Team not found'}), 404
    
    service = Service.query.get(data['service_id'])
    if not service:
        return jsonify({'error': 'Service not found'}), 404
    
    try:
        start_date = datetime.fromisoformat(data['start_date'])
        end_date = datetime.fromisoformat(data['end_date'])
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)'}), 400
    
    if end_date <= start_date:
        return jsonify({'error': 'end_date must be after start_date'}), 400
    
    expansion = ExpansionRequest(
        team_id=data['team_id'],
        service_id=data['service_id'],
        amount=data['amount'],
        reason=data.get('reason', ''),
        start_date=start_date,
        end_date=end_date,
        status='pending'
    )
    db.session.add(expansion)
    db.session.commit()
    
    return jsonify({
        'id': expansion.id,
        'team_id': expansion.team_id,
        'service_id': expansion.service_id,
        'amount': expansion.amount,
        'reason': expansion.reason,
        'start_date': expansion.start_date.isoformat(),
        'end_date': expansion.end_date.isoformat(),
        'status': expansion.status
    }), 201


@app.route('/api/expansions/<int:expansion_id>/approve', methods=['POST'])
def approve_expansion(expansion_id):
    expansion = ExpansionRequest.query.get(expansion_id)
    if not expansion:
        return jsonify({'error': 'Expansion request not found'}), 404
    
    if expansion.status != 'pending':
        return jsonify({'error': f'Cannot approve request with status: {expansion.status}'}), 400
    
    data = request.get_json() or {}
    expansion.status = 'approved'
    expansion.approval_note = data.get('approval_note', '')
    expansion.approved_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({
        'id': expansion.id,
        'status': expansion.status,
        'approved_at': expansion.approved_at.isoformat()
    }), 200


@app.route('/api/expansions/<int:expansion_id>/reject', methods=['POST'])
def reject_expansion(expansion_id):
    expansion = ExpansionRequest.query.get(expansion_id)
    if not expansion:
        return jsonify({'error': 'Expansion request not found'}), 404
    
    if expansion.status != 'pending':
        return jsonify({'error': f'Cannot reject request with status: {expansion.status}'}), 400
    
    data = request.get_json() or {}
    expansion.status = 'rejected'
    expansion.approval_note = data.get('rejection_note', '')
    expansion.rejected_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({
        'id': expansion.id,
        'status': expansion.status,
        'rejected_at': expansion.rejected_at.isoformat()
    }), 200


@app.route('/api/borrows', methods=['POST'])
def create_borrow():
    data = request.get_json()
    if not data or not all(k in data for k in ['borrower_id', 'lender_id', 'service_id', 'amount']):
        return jsonify({'error': 'borrower_id, lender_id, service_id, amount are required'}), 400
    
    if data['borrower_id'] == data['lender_id']:
        return jsonify({'error': 'Cannot borrow from self'}), 400
    
    borrower = Team.query.get(data['borrower_id'])
    if not borrower:
        return jsonify({'error': 'Borrower team not found'}), 404
    
    lender = Team.query.get(data['lender_id'])
    if not lender:
        return jsonify({'error': 'Lender team not found'}), 404
    
    service = Service.query.get(data['service_id'])
    if not service:
        return jsonify({'error': 'Service not found'}), 404
    
    month = data.get('month', get_current_month())
    
    existing = BorrowRequest.query.filter_by(
        borrower_id=data['borrower_id'],
        lender_id=data['lender_id'],
        service_id=data['service_id'],
        month=month
    ).first()
    
    if existing:
        return jsonify({
            'error': 'Borrow request already exists for this month',
            'request_id': existing.id,
            'status': existing.status
        }), 409
    
    lender_quota = Quota.query.filter_by(
        team_id=data['lender_id'],
        service_id=data['service_id'],
        month=month
    ).first()
    
    lender_available = get_team_available_quota(data['lender_id'], data['service_id'], month)
    
    if lender_available['base']['remaining'] < data['amount']:
        return jsonify({
            'error': 'Lender does not have enough available quota',
            'lender_available': lender_available['base']['remaining'],
            'requested': data['amount']
        }), 400
    
    borrow = BorrowRequest(
        borrower_id=data['borrower_id'],
        lender_id=data['lender_id'],
        service_id=data['service_id'],
        amount=data['amount'],
        month=month,
        reason=data.get('reason', ''),
        status='pending'
    )
    db.session.add(borrow)
    db.session.commit()
    
    return jsonify({
        'id': borrow.id,
        'borrower_id': borrow.borrower_id,
        'lender_id': borrow.lender_id,
        'service_id': borrow.service_id,
        'amount': borrow.amount,
        'month': borrow.month,
        'reason': borrow.reason,
        'status': borrow.status
    }), 201


@app.route('/api/borrows/<int:borrow_id>/approve', methods=['POST'])
def approve_borrow(borrow_id):
    borrow = BorrowRequest.query.get(borrow_id)
    if not borrow:
        return jsonify({'error': 'Borrow request not found'}), 404
    
    if borrow.status != 'pending':
        return jsonify({'error': f'Cannot approve request with status: {borrow.status}'}), 400
    
    lender_available = get_team_available_quota(borrow.lender_id, borrow.service_id, borrow.month)
    if lender_available['base']['remaining'] < borrow.amount:
        return jsonify({
            'error': 'Lender no longer has enough available quota',
            'lender_available': lender_available['base']['remaining'],
            'requested': borrow.amount
        }), 400
    
    data = request.get_json() or {}
    borrow.status = 'approved'
    borrow.approval_note = data.get('approval_note', '')
    borrow.approved_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({
        'id': borrow.id,
        'status': borrow.status,
        'approved_at': borrow.approved_at.isoformat()
    }), 200


@app.route('/api/borrows/<int:borrow_id>/reject', methods=['POST'])
def reject_borrow(borrow_id):
    borrow = BorrowRequest.query.get(borrow_id)
    if not borrow:
        return jsonify({'error': 'Borrow request not found'}), 404
    
    if borrow.status != 'pending':
        return jsonify({'error': f'Cannot reject request with status: {borrow.status}'}), 400
    
    data = request.get_json() or {}
    borrow.status = 'rejected'
    borrow.approval_note = data.get('rejection_note', '')
    borrow.rejected_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({
        'id': borrow.id,
        'status': borrow.status,
        'rejected_at': borrow.rejected_at.isoformat()
    }), 200


@app.route('/api/teams/<int:team_id>/quotas', methods=['GET'])
def get_team_quotas(team_id):
    team = Team.query.get(team_id)
    if not team:
        return jsonify({'error': 'Team not found'}), 404
    
    month = request.args.get('month', get_current_month())
    
    services = Service.query.all()
    result = []
    
    for service in services:
        quota_info = get_team_available_quota(team_id, service.id, month)
        frozen = FrozenRecord.query.filter_by(
            team_id=team_id,
            service_id=service.id,
            month=month
        ).all()
        
        result.append({
            'service_id': service.id,
            'service_name': service.name,
            'month': month,
            'quota': quota_info,
            'frozen_calls': [{
                'id': f.id,
                'request_id': f.request_id,
                'amount': f.amount,
                'reason': f.reason,
                'created_at': f.created_at.isoformat()
            } for f in frozen]
        })
    
    return jsonify(result), 200


@app.route('/api/teams/<int:team_id>/borrows', methods=['GET'])
def get_team_borrows(team_id):
    team = Team.query.get(team_id)
    if not team:
        return jsonify({'error': 'Team not found'}), 404
    
    month = request.args.get('month')
    
    query = BorrowRequest.query.filter(
        (BorrowRequest.borrower_id == team_id) | (BorrowRequest.lender_id == team_id)
    )
    
    if month:
        query = query.filter_by(month=month)
    
    borrows = query.all()
    
    result = {
        'borrowed': [],
        'lent': []
    }
    
    for b in borrows:
        other_team_id = b.lender_id if b.borrower_id == team_id else b.borrower_id
        other_team = Team.query.get(other_team_id)
        service = Service.query.get(b.service_id)
        
        item = {
            'id': b.id,
            'other_team_id': other_team_id,
            'other_team_name': other_team.name if other_team else 'Unknown',
            'service_id': b.service_id,
            'service_name': service.name if service else 'Unknown',
            'amount': b.amount,
            'used_amount': b.used_amount,
            'remaining': b.amount - b.used_amount,
            'month': b.month,
            'status': b.status,
            'reason': b.reason,
            'approval_note': b.approval_note,
            'created_at': b.created_at.isoformat()
        }
        if b.approved_at:
            item['approved_at'] = b.approved_at.isoformat()
        
        if b.borrower_id == team_id:
            result['borrowed'].append(item)
        else:
            result['lent'].append(item)
    
    return jsonify(result), 200


@app.route('/api/reconciliation', methods=['POST'])
def generate_reconciliation():
    data = request.get_json() or {}
    month = data.get('month', get_current_month())
    
    teams = Team.query.all()
    services = Service.query.all()
    results = []
    
    for team in teams:
        for service in services:
            quota_info = get_team_available_quota(team.id, service.id, month)
            
            base_quota_obj = Quota.query.filter_by(
                team_id=team.id, service_id=service.id, month=month
            ).first()
            base_quota = base_quota_obj.monthly_quota if base_quota_obj else 0
            
            active_expansions = ExpansionRequest.query.filter(
                ExpansionRequest.team_id == team.id,
                ExpansionRequest.service_id == service.id,
                ExpansionRequest.status == 'approved'
            ).all()
            
            expansion_total = sum(e.amount for e in active_expansions)
            expansion_used = sum(e.used_amount for e in active_expansions)
            expansion_remaining = expansion_total - expansion_used
            
            borrowed_requests = BorrowRequest.query.filter_by(
                borrower_id=team.id,
                service_id=service.id,
                month=month,
                status='approved'
            ).all()
            borrowed_total = sum(b.amount for b in borrowed_requests)
            borrowed_used = sum(b.used_amount for b in borrowed_requests)
            borrowed_remaining = borrowed_total - borrowed_used
            
            lent_requests = BorrowRequest.query.filter_by(
                lender_id=team.id,
                service_id=service.id,
                month=month,
                status='approved'
            ).all()
            lent_total = sum(l.amount for l in lent_requests)
            lent_used = sum(l.used_amount for l in lent_requests)
            lent_remaining = lent_total - lent_used
            
            frozen_records = FrozenRecord.query.filter_by(
                team_id=team.id,
                service_id=service.id,
                month=month
            ).all()
            frozen_amount = sum(f.amount for f in frozen_records)
            frozen_count = len(frozen_records)
            
            risk_records = RiskRecord.query.join(UsageRecord).filter(
                UsageRecord.team_id == team.id,
                UsageRecord.service_id == service.id,
                UsageRecord.month == month
            ).all()
            overage_amount = sum(rr.usage_record.amount for rr in risk_records)
            risk_count = len(risk_records)
            
            base_used = quota_info['base']['used']
            base_remaining = quota_info['base']['remaining']
            
            total_available = base_quota + expansion_total + borrowed_total
            total_used = base_used + expansion_used + borrowed_used
            total_remaining = base_remaining + expansion_remaining + borrowed_remaining
            
            record_usages = UsageRecord.query.filter_by(
                team_id=team.id,
                service_id=service.id,
                month=month,
                status='normal'
            ).all()
            recorded_total = sum(u.amount for u in record_usages)
            discrepancy = recorded_total - (base_used + expansion_used + borrowed_used)
            
            existing = Reconciliation.query.filter_by(
                team_id=team.id,
                service_id=service.id,
                month=month
            ).first()
            
            if existing:
                existing.base_quota = base_quota
                existing.base_used = base_used
                existing.base_remaining = base_remaining
                existing.expansion_total = expansion_total
                existing.expansion_used = expansion_used
                existing.expansion_remaining = expansion_remaining
                existing.borrowed_total = borrowed_total
                existing.borrowed_used = borrowed_used
                existing.borrowed_remaining = borrowed_remaining
                existing.lent_total = lent_total
                existing.lent_used = lent_used
                existing.lent_remaining = lent_remaining
                existing.frozen_amount = frozen_amount
                existing.frozen_count = frozen_count
                existing.overage_amount = overage_amount
                existing.risk_count = risk_count
                existing.total_available = total_available
                existing.total_used = total_used
                existing.total_remaining = total_remaining
                existing.discrepancy = discrepancy
                existing.generated_at = datetime.utcnow()
                recon = existing
            else:
                now = datetime.utcnow()
                recon = Reconciliation(
                    team_id=team.id,
                    service_id=service.id,
                    month=month,
                    base_quota=base_quota,
                    base_used=base_used,
                    base_remaining=base_remaining,
                    expansion_total=expansion_total,
                    expansion_used=expansion_used,
                    expansion_remaining=expansion_remaining,
                    borrowed_total=borrowed_total,
                    borrowed_used=borrowed_used,
                    borrowed_remaining=borrowed_remaining,
                    lent_total=lent_total,
                    lent_used=lent_used,
                    lent_remaining=lent_remaining,
                    frozen_amount=frozen_amount,
                    frozen_count=frozen_count,
                    overage_amount=overage_amount,
                    risk_count=risk_count,
                    total_available=total_available,
                    total_used=total_used,
                    total_remaining=total_remaining,
                    discrepancy=discrepancy,
                    generated_at=now
                )
                db.session.add(recon)
            
            results.append({
                'team_id': team.id,
                'team_name': team.name,
                'service_id': service.id,
                'service_name': service.name,
                'month': month,
                'base': {
                    'quota': base_quota,
                    'used': base_used,
                    'remaining': base_remaining
                },
                'expansion': {
                    'total': expansion_total,
                    'used': expansion_used,
                    'remaining': expansion_remaining
                },
                'borrowed': {
                    'total': borrowed_total,
                    'used': borrowed_used,
                    'remaining': borrowed_remaining
                },
                'lent': {
                    'total': lent_total,
                    'used': lent_used,
                    'remaining': lent_remaining
                },
                'frozen': {
                    'amount': frozen_amount,
                    'count': frozen_count
                },
                'overage': {
                    'amount': overage_amount,
                    'risk_count': risk_count
                },
                'total': {
                    'available': total_available,
                    'used': total_used,
                    'remaining': total_remaining
                },
                'discrepancy': discrepancy,
                'generated_at': recon.generated_at.isoformat()
            })
    
    db.session.commit()
    
    return jsonify({
        'month': month,
        'generated_at': datetime.utcnow().isoformat(),
        'reconciliations': results
    }), 200


@app.route('/api/reconciliation', methods=['GET'])
def get_reconciliation():
    team_id = request.args.get('team_id', type=int)
    service_id = request.args.get('service_id', type=int)
    month = request.args.get('month', get_current_month())
    
    query = Reconciliation.query.filter_by(month=month)
    
    if team_id:
        query = query.filter_by(team_id=team_id)
    
    if service_id:
        query = query.filter_by(service_id=service_id)
    
    reconciliations = query.all()
    
    return jsonify([{
        'team_id': r.team_id,
        'team_name': r.team.name,
        'service_id': r.service_id,
        'service_name': r.service.name,
        'month': r.month,
        'base': {
            'quota': r.base_quota,
            'used': r.base_used,
            'remaining': r.base_remaining
        },
        'expansion': {
            'total': r.expansion_total,
            'used': r.expansion_used,
            'remaining': r.expansion_remaining
        },
        'borrowed': {
            'total': r.borrowed_total,
            'used': r.borrowed_used,
            'remaining': r.borrowed_remaining
        },
        'lent': {
            'total': r.lent_total,
            'used': r.lent_used,
            'remaining': r.lent_remaining
        },
        'frozen': {
            'amount': r.frozen_amount,
            'count': r.frozen_count
        },
        'overage': {
            'amount': r.overage_amount,
            'risk_count': r.risk_count
        },
        'total': {
            'available': r.total_available,
            'used': r.total_used,
            'remaining': r.total_remaining
        },
        'discrepancy': r.discrepancy,
        'generated_at': r.generated_at.isoformat()
    } for r in reconciliations]), 200


@app.route('/api/services', methods=['GET'])
def list_services():
    services = Service.query.all()
    return jsonify([{
        'id': s.id,
        'name': s.name,
        'description': s.description,
        'created_at': s.created_at.isoformat()
    } for s in services]), 200


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)
