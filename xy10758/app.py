from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime, timedelta
import pandas as pd
import json
import os
from io import BytesIO

app = Flask(__name__)
CORS(app)

DATABASE_URL = 'sqlite:///subscription.db'
engine = create_engine(DATABASE_URL, connect_args={'check_same_thread': False})
Base = declarative_base()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class SubscriptionPlan(Base):
    __tablename__ = 'subscription_plans'
    
    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(String, unique=True, index=True)
    name = Column(String)
    price = Column(Float)
    billing_cycle = Column(String)
    grace_period_days = Column(Integer, default=7)
    created_at = Column(DateTime, default=datetime.utcnow)


class ChargeEvent(Base):
    __tablename__ = 'charge_events'
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String, unique=True, index=True)
    subscription_id = Column(String, index=True)
    user_id = Column(String)
    user_name = Column(String)
    owner = Column(String)
    plan_id = Column(String)
    amount = Column(Float)
    currency = Column(String, default='CNY')
    status = Column(String)
    failure_reason = Column(Text)
    attempt_count = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    retry_strategy = Column(String, default='standard')
    grace_period_end = Column(DateTime)
    charge_time = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RetryStrategy(Base):
    __tablename__ = 'retry_strategies'
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    description = Column(String)
    intervals = Column(String)
    is_active = Column(Boolean, default=True)


class DowngradeAction(Base):
    __tablename__ = 'downgrade_actions'
    
    id = Column(Integer, primary_key=True, index=True)
    action_id = Column(String, unique=True, index=True)
    charge_event_id = Column(String)
    subscription_id = Column(String)
    user_id = Column(String)
    action_type = Column(String)
    action_details = Column(Text)
    executed_by = Column(String)
    executed_at = Column(DateTime, default=datetime.utcnow)
    revenue_impact = Column(Float, default=0)
    notes = Column(Text)


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_strategies():
    db = next(get_db())
    if db.query(RetryStrategy).count() == 0:
        strategies = [
            RetryStrategy(name='standard', description='标准重试：1小时、6小时、24小时后重试', intervals=json.dumps([1, 6, 24])),
            RetryStrategy(name='aggressive', description='激进重试：30分钟、2小时、8小时后重试', intervals=json.dumps([0.5, 2, 8])),
            RetryStrategy(name='conservative', description='保守重试：24小时、48小时、72小时后重试', intervals=json.dumps([24, 48, 72]))
        ]
        db.add_all(strategies)
        db.commit()


def init_sample_plans():
    db = next(get_db())
    if db.query(SubscriptionPlan).count() == 0:
        plans = [
            SubscriptionPlan(plan_id='PRO_MONTHLY', name='专业版月付', price=99.0, billing_cycle='monthly', grace_period_days=7),
            SubscriptionPlan(plan_id='PRO_YEARLY', name='专业版年付', price=999.0, billing_cycle='yearly', grace_period_days=14),
            SubscriptionPlan(plan_id='ENTERPRISE', name='企业版', price=2999.0, billing_cycle='yearly', grace_period_days=30)
        ]
        db.add_all(plans)
        db.commit()


init_strategies()
init_sample_plans()


def validate_charge_event(charge_data, db):
    errors = []
    warnings = []
    
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_id == charge_data.get('plan_id')).first()
    if not plan:
        errors.append(f"无效的订阅计划: {charge_data.get('plan_id')}")
        return {'valid': False, 'errors': errors, 'warnings': warnings}
    
    if charge_data.get('amount') != plan.price:
        warnings.append(f"金额不匹配: 计划价格 {plan.price}, 扣款金额 {charge_data.get('amount')}")
    
    grace_end = datetime.utcnow() + timedelta(days=plan.grace_period_days)
    charge_data['grace_period_end'] = grace_end
    
    if charge_data.get('status') == 'failed':
        if charge_data.get('attempt_count', 0) >= charge_data.get('max_attempts', 3):
            now = datetime.utcnow()
            if now > grace_end:
                warnings.append(f"已超出宽限期，需要执行降级动作 (宽限期截止: {grace_end.strftime('%Y-%m-%d %H:%M')})")
            else:
                remaining = (grace_end - now).days
                warnings.append(f"重试次数已用尽，但仍在宽限期内 (剩余 {remaining} 天)")
    
    return {'valid': len(errors) == 0, 'errors': errors, 'warnings': warnings}


@app.route('/api/plans', methods=['GET'])
def get_plans():
    db = next(get_db())
    plans = db.query(SubscriptionPlan).all()
    return jsonify([{
        'plan_id': p.plan_id,
        'name': p.name,
        'price': p.price,
        'billing_cycle': p.billing_cycle,
        'grace_period_days': p.grace_period_days
    } for p in plans])


@app.route('/api/charge-events', methods=['GET'])
def get_charge_events():
    db = next(get_db())
    search = request.args.get('search', '')
    status = request.args.get('status', '')
    
    query = db.query(ChargeEvent)
    if search:
        query = query.filter(
            (ChargeEvent.subscription_id.contains(search)) |
            (ChargeEvent.user_name.contains(search)) |
            (ChargeEvent.owner.contains(search))
        )
    if status:
        query = query.filter(ChargeEvent.status == status)
    
    events = query.order_by(ChargeEvent.created_at.desc()).all()
    
    return jsonify([{
        'event_id': e.event_id,
        'subscription_id': e.subscription_id,
        'user_id': e.user_id,
        'user_name': e.user_name,
        'owner': e.owner,
        'plan_id': e.plan_id,
        'amount': e.amount,
        'status': e.status,
        'failure_reason': e.failure_reason,
        'attempt_count': e.attempt_count,
        'max_attempts': e.max_attempts,
        'retry_strategy': e.retry_strategy,
        'grace_period_end': e.grace_period_end.isoformat() if e.grace_period_end else None,
        'charge_time': e.charge_time.isoformat() if e.charge_time else None,
        'created_at': e.created_at.isoformat()
    } for e in events])


@app.route('/api/charge-events', methods=['POST'])
def create_charge_event():
    db = next(get_db())
    data = request.json
    
    validation = validate_charge_event(data, db)
    
    if data.get('validate_only'):
        return jsonify(validation)
    
    if not validation['valid']:
        return jsonify({'errors': validation['errors']}), 400
    
    try:
        event = ChargeEvent(
            event_id=data['event_id'],
            subscription_id=data['subscription_id'],
            user_id=data['user_id'],
            user_name=data.get('user_name', ''),
            owner=data.get('owner', ''),
            plan_id=data['plan_id'],
            amount=data['amount'],
            status=data['status'],
            failure_reason=data.get('failure_reason', ''),
            attempt_count=data.get('attempt_count', 0),
            max_attempts=data.get('max_attempts', 3),
            retry_strategy=data.get('retry_strategy', 'standard'),
            grace_period_end=data.get('grace_period_end'),
            charge_time=datetime.fromisoformat(data['charge_time'].replace('Z', '+00:00')) if data.get('charge_time') else datetime.utcnow()
        )
        db.add(event)
        db.commit()
        return jsonify({'success': True, 'warnings': validation['warnings']})
    except Exception as e:
        db.rollback()
        return jsonify({'errors': [str(e)]}), 400


@app.route('/api/charge-events/batch', methods=['POST'])
def batch_import():
    db = next(get_db())
    data_list = request.json
    results = []
    
    for item in data_list:
        validation = validate_charge_event(item, db)
        if not validation['valid']:
            results.append({
                'item': item,
                'success': False,
                'errors': validation['errors']
            })
            continue
        
        try:
            item['grace_period_end'] = validation.get('grace_period_end', datetime.utcnow() + timedelta(days=7))
            event = ChargeEvent(
                event_id=item['event_id'],
                subscription_id=item['subscription_id'],
                user_id=item['user_id'],
                user_name=item.get('user_name', ''),
                owner=item.get('owner', ''),
                plan_id=item['plan_id'],
                amount=item['amount'],
                status=item['status'],
                failure_reason=item.get('failure_reason', ''),
                attempt_count=item.get('attempt_count', 0),
                max_attempts=item.get('max_attempts', 3),
                retry_strategy=item.get('retry_strategy', 'standard'),
                grace_period_end=item['grace_period_end'],
                charge_time=datetime.fromisoformat(item['charge_time'].replace('Z', '+00:00')) if item.get('charge_time') else datetime.utcnow()
            )
            db.add(event)
            results.append({
                'item': item,
                'success': True,
                'warnings': validation['warnings']
            })
        except Exception as e:
            results.append({
                'item': item,
                'success': False,
                'errors': [str(e)]
            })
    
    db.commit()
    return jsonify(results)


@app.route('/api/downgrade-actions', methods=['GET'])
def get_downgrade_actions():
    db = next(get_db())
    actions = db.query(DowngradeAction).order_by(DowngradeAction.executed_at.desc()).all()
    return jsonify([{
        'action_id': a.action_id,
        'charge_event_id': a.charge_event_id,
        'subscription_id': a.subscription_id,
        'user_id': a.user_id,
        'action_type': a.action_type,
        'action_details': a.action_details,
        'executed_by': a.executed_by,
        'executed_at': a.executed_at.isoformat(),
        'revenue_impact': a.revenue_impact,
        'notes': a.notes
    } for a in actions])


@app.route('/api/downgrade-actions', methods=['POST'])
def create_downgrade_action():
    db = next(get_db())
    data = request.json
    
    try:
        action = DowngradeAction(
            action_id=data['action_id'],
            charge_event_id=data['charge_event_id'],
            subscription_id=data['subscription_id'],
            user_id=data['user_id'],
            action_type=data['action_type'],
            action_details=data.get('action_details', ''),
            executed_by=data.get('executed_by', 'system'),
            revenue_impact=data.get('revenue_impact', 0),
            notes=data.get('notes', '')
        )
        db.add(action)
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.rollback()
        return jsonify({'errors': [str(e)]}), 400


@app.route('/api/retry-strategies', methods=['GET'])
def get_retry_strategies():
    db = next(get_db())
    strategies = db.query(RetryStrategy).all()
    return jsonify([{
        'name': s.name,
        'description': s.description,
        'intervals': json.loads(s.intervals),
        'is_active': s.is_active
    } for s in strategies])


@app.route('/api/report/export', methods=['GET'])
def export_report():
    db = next(get_db())
    
    events = db.query(ChargeEvent).all()
    actions = db.query(DowngradeAction).all()
    
    event_data = []
    for e in events:
        event_data.append({
            '事件ID': e.event_id,
            '订阅ID': e.subscription_id,
            '用户ID': e.user_id,
            '用户名': e.user_name,
            '负责人': e.owner,
            '计划ID': e.plan_id,
            '金额': e.amount,
            '状态': e.status,
            '失败原因': e.failure_reason,
            '重试次数': e.attempt_count,
            '最大重试次数': e.max_attempts,
            '重试策略': e.retry_strategy,
            '宽限期截止': e.grace_period_end.strftime('%Y-%m-%d') if e.grace_period_end else '',
            '扣款时间': e.charge_time.strftime('%Y-%m-%d %H:%M') if e.charge_time else ''
        })
    
    action_data = []
    for a in actions:
        action_data.append({
            '动作ID': a.action_id,
            '事件ID': a.charge_event_id,
            '订阅ID': a.subscription_id,
            '动作类型': a.action_type,
            '动作详情': a.action_details,
            '执行人': a.executed_by,
            '执行时间': a.executed_at.strftime('%Y-%m-%d %H:%M'),
            '收入影响': a.revenue_impact,
            '备注': a.notes
        })
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df_events = pd.DataFrame(event_data)
        if not df_events.empty:
            grouped = df_events.groupby(['负责人', '重试策略', '状态']).agg({
                '金额': ['sum', 'count'],
                '事件ID': 'count'
            }).round(2)
            grouped.columns = ['总金额', '交易数', '事件数']
            grouped.reset_index(inplace=True)
            grouped.to_excel(writer, sheet_name='汇总报告', index=False)
        
        pd.DataFrame(event_data).to_excel(writer, sheet_name='扣款事件明细', index=False)
        pd.DataFrame(action_data).to_excel(writer, sheet_name='降级动作明细', index=False)
    
    output.seek(0)
    
    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=f'订阅续费报告_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
    )


@app.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    db = next(get_db())
    
    total_events = db.query(ChargeEvent).count()
    failed_events = db.query(ChargeEvent).filter(ChargeEvent.status == 'failed').count()
    success_events = db.query(ChargeEvent).filter(ChargeEvent.status == 'success').count()
    pending_events = db.query(ChargeEvent).filter(ChargeEvent.status == 'pending').count()
    
    total_downgrades = db.query(DowngradeAction).count()
    revenue_lost = db.query(func.sum(DowngradeAction.revenue_impact)).scalar() or 0
    
    return jsonify({
        'total_events': total_events,
        'failed_events': failed_events,
        'success_events': success_events,
        'pending_events': pending_events,
        'total_downgrades': total_downgrades,
        'revenue_lost': float(revenue_lost)
    })


@app.route('/')
def index():
    return send_file('index.html')


if __name__ == '__main__':
    app.run(debug=True, port=5000)
