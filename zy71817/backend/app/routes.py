from flask import Blueprint, request, jsonify, send_file
from datetime import datetime
import pandas as pd
import io
from . import db
from .models import Transaction, TransactionStatusLog, AnomalyRecord, AllocationResult, ReconciliationSummary
from .anomaly_detector import AnomalyDetector

api_bp = Blueprint('api', __name__)


@api_bp.route('/transactions', methods=['GET'])
def get_transactions():
    period = request.args.get('period', '2024-01')
    status = request.args.get('status')
    anomaly_type = request.args.get('anomaly_type')

    query = Transaction.query.filter_by(current_period=period)

    if status:
        query = query.filter_by(status=status)

    transactions = query.order_by(Transaction.transaction_date.desc()).all()

    result = []
    for tx in transactions:
        tx_data = transaction_to_dict(tx)

        if anomaly_type:
            tx_anomalies = [a for a in tx.anomalies if a.anomaly_type == anomaly_type and not a.is_resolved]
            if not tx_anomalies:
                continue
            tx_data['current_anomaly'] = anomaly_to_dict(tx_anomalies[0])
        else:
            unresolved = [a for a in tx.anomalies if not a.is_resolved]
            if unresolved:
                tx_data['current_anomaly'] = anomaly_to_dict(unresolved[0])

        result.append(tx_data)

    return jsonify(result)


@api_bp.route('/transactions/<int:tx_id>', methods=['GET'])
def get_transaction_detail(tx_id):
    tx = Transaction.query.get_or_404(tx_id)
    result = transaction_to_dict(tx)
    result['status_logs'] = [status_log_to_dict(log) for log in tx.status_logs]
    result['anomalies'] = [anomaly_to_dict(a) for a in tx.anomalies]
    result['allocations'] = [allocation_to_dict(a) for a in tx.allocations]
    return jsonify(result)


@api_bp.route('/transactions/import', methods=['POST'])
def import_transactions():
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400

    file = request.files['file']
    period = request.form.get('period', '2024-01')

    try:
        df = pd.read_excel(file)
    except Exception as e:
        return jsonify({'error': f'文件读取失败: {str(e)}'}), 400

    imported_count = 0
    errors = []

    for idx, row in df.iterrows():
        try:
            tx_date = parse_date(row.get('交易日期') or row.get('transaction_date'))
            attachment_date = parse_date(row.get('附件日期') or row.get('attachment_date'))

            tx = Transaction(
                transaction_no=str(row.get('流水号') or row.get('transaction_no') or f'TEMP{idx}'),
                transaction_date=tx_date,
                amount=float(row.get('金额') or row.get('amount') or 0),
                fee=float(row.get('手续费') or row.get('fee') or 0),
                type=str(row.get('类型') or row.get('type') or ''),
                channel=str(row.get('渠道') or row.get('channel') or ''),
                order_no=str(row.get('订单号') or row.get('order_no') or ''),
                payer=str(row.get('付款方') or row.get('payer') or ''),
                remark=str(row.get('备注') or row.get('remark') or ''),
                attachment_date=attachment_date,
                is_manual_correction=bool(row.get('人工更正') or row.get('is_manual_correction')),
                correction_ref=str(row.get('更正参考') or row.get('correction_ref') or ''),
                source='import',
                status='pending',
                current_period=period
            )
            db.session.add(tx)
            imported_count += 1
        except Exception as e:
            errors.append(f'第{idx+2}行: {str(e)}')

    db.session.commit()
    run_anomaly_detection(period)

    return jsonify({
        'imported': imported_count,
        'errors': errors,
        'total': imported_count + len(errors)
    })


@api_bp.route('/transactions/<int:tx_id>/status', methods=['PUT'])
def update_transaction_status(tx_id):
    tx = Transaction.query.get_or_404(tx_id)
    data = request.json

    old_status = tx.status
    new_status = data.get('status')
    reason = data.get('reason', '')
    operator = data.get('operator', 'system')

    tx.status = new_status

    log = TransactionStatusLog(
        transaction_id=tx_id,
        from_status=old_status,
        to_status=new_status,
        operator=operator,
        reason=reason
    )
    db.session.add(log)

    if new_status == 'confirmed':
        for anomaly in tx.anomalies:
            if not anomaly.is_resolved:
                anomaly.is_resolved = True
                anomaly.resolved_by = operator
                anomaly.resolved_at = datetime.utcnow()
                anomaly.resolution_note = reason

    db.session.commit()

    return jsonify({'success': True})


@api_bp.route('/anomalies/<int:anomaly_id>/resolve', methods=['PUT'])
def resolve_anomaly(anomaly_id):
    anomaly = AnomalyRecord.query.get_or_404(anomaly_id)
    data = request.json

    anomaly.is_resolved = True
    anomaly.resolved_by = data.get('operator', 'system')
    anomaly.resolved_at = datetime.utcnow()
    anomaly.resolution_note = data.get('resolution_note', '')

    tx = Transaction.query.get(anomaly.transaction_id)
    has_unresolved = any(a for a in tx.anomalies if not a.is_resolved)
    if not has_unresolved and tx.status == 'pending_confirm':
        tx.status = 'confirmed'

    db.session.commit()

    return jsonify({'success': True})


@api_bp.route('/anomalies/detect', methods=['POST'])
def trigger_detection():
    data = request.json
    period = data.get('period', '2024-01')
    run_anomaly_detection(period)
    return jsonify({'success': True})


@api_bp.route('/reconciliation/<period>', methods=['GET'])
def get_reconciliation(period):
    summary = ReconciliationSummary.query.filter_by(period=period).first()

    transactions = Transaction.query.filter_by(current_period=period).all()
    anomalies = AnomalyRecord.query.join(Transaction).filter(
        Transaction.current_period == period
    ).all()

    stats = calculate_statistics(transactions, anomalies)

    return jsonify({
        'summary': summary_to_dict(summary) if summary else None,
        'statistics': stats
    })


@api_bp.route('/export/<period>', methods=['GET'])
def export_data(period):
    export_type = request.args.get('type', 'all')

    transactions = Transaction.query.filter_by(current_period=period).all()

    if export_type == 'anomalies':
        data = prepare_anomaly_export(transactions)
        filename = f'异常记录_{period}.xlsx'
    elif export_type == 'reconciliation':
        data = prepare_reconciliation_export(transactions)
        filename = f'对账说明_{period}.xlsx'
    else:
        data = prepare_full_export(transactions)
        filename = f'完整数据_{period}.xlsx'

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        for sheet_name, df in data.items():
            df.to_excel(writer, sheet_name=sheet_name, index=False)

    output.seek(0)

    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=filename
    )


@api_bp.route('/sample-data', methods=['POST'])
def generate_sample_data():
    period = request.json.get('period', '2024-01')
    sample_data = create_sample_transactions(period)

    for tx in sample_data:
        db.session.add(tx)
    db.session.commit()

    run_anomaly_detection(period)

    return jsonify({'count': len(sample_data)})


def run_anomaly_detection(period):
    transactions = Transaction.query.filter_by(current_period=period).all()
    detector = AnomalyDetector(period)
    anomalies = detector.detect_all(transactions)

    for anomaly in anomalies:
        existing = AnomalyRecord.query.filter_by(
            transaction_id=anomaly.transaction_id,
            anomaly_type=anomaly.anomaly_type,
            is_resolved=False
        ).first()

        if not existing:
            db.session.add(anomaly)

    db.session.commit()
    update_reconciliation_summary(period)


def update_reconciliation_summary(period):
    transactions = Transaction.query.filter_by(current_period=period).all()
    anomalies = AnomalyRecord.query.join(Transaction).filter(
        Transaction.current_period == period
    ).all()

    stats = calculate_statistics(transactions, anomalies)

    summary = ReconciliationSummary.query.filter_by(period=period).first()
    if not summary:
        summary = ReconciliationSummary(period=period)
        db.session.add(summary)

    summary.total_transactions = stats['total_count']
    summary.total_amount = stats['total_amount']
    summary.confirmed_amount = stats['confirmed_amount']
    summary.pending_amount = stats['pending_amount']
    summary.anomaly_count = stats['anomaly_count']
    summary.duplicate_count = stats['duplicate_count']
    summary.cross_period_fee_count = stats['cross_period_fee_count']
    summary.suspense_count = stats['suspense_count']

    db.session.commit()


def calculate_statistics(transactions, anomalies):
    total_amount = sum(tx.amount for tx in transactions)
    confirmed = [tx for tx in transactions if tx.status == 'confirmed']
    pending = [tx for tx in transactions if tx.status in ['pending', 'pending_confirm']]

    return {
        'total_count': len(transactions),
        'total_amount': total_amount,
        'confirmed_count': len(confirmed),
        'confirmed_amount': sum(tx.amount for tx in confirmed),
        'pending_count': len(pending),
        'pending_amount': sum(tx.amount for tx in pending),
        'anomaly_count': len([a for a in anomalies if not a.is_resolved]),
        'duplicate_count': len([a for a in anomalies if a.anomaly_type == 'duplicate' and not a.is_resolved]),
        'cross_period_fee_count': len([a for a in anomalies if a.anomaly_type == 'cross_period_fee' and not a.is_resolved]),
        'suspense_count': len([a for a in anomalies if a.anomaly_type == 'suspense_refund' and not a.is_resolved])
    }


def parse_date(date_val):
    if pd.isna(date_val) or not date_val:
        return None
    if isinstance(date_val, datetime):
        return date_val.date()
    try:
        return datetime.strptime(str(date_val)[:10], '%Y-%m-%d').date()
    except:
        return None


def transaction_to_dict(tx):
    return {
        'id': tx.id,
        'transaction_no': tx.transaction_no,
        'transaction_date': tx.transaction_date.isoformat() if tx.transaction_date else None,
        'amount': tx.amount,
        'fee': tx.fee,
        'type': tx.type,
        'channel': tx.channel,
        'order_no': tx.order_no,
        'payer': tx.payer,
        'remark': tx.remark,
        'is_manual_correction': tx.is_manual_correction,
        'status': tx.status,
        'created_at': tx.created_at.isoformat()
    }


def anomaly_to_dict(a):
    return {
        'id': a.id,
        'anomaly_type': a.anomaly_type,
        'severity': a.severity,
        'description': a.description,
        'evidence': a.evidence,
        'related_transaction_ids': a.related_transaction_ids,
        'is_resolved': a.is_resolved,
        'resolution_note': a.resolution_note,
        'created_at': a.created_at.isoformat()
    }


def status_log_to_dict(log):
    return {
        'id': log.id,
        'from_status': log.from_status,
        'to_status': log.to_status,
        'operator': log.operator,
        'reason': log.reason,
        'created_at': log.created_at.isoformat()
    }


def allocation_to_dict(a):
    return {
        'id': a.id,
        'compensation_no': a.compensation_no,
        'after_sale_order': a.after_sale_order,
        'principal_amount': a.principal_amount,
        'compensation_amount': a.compensation_amount,
        'bearer_party': a.bearer_party,
        'is_confirmed': a.is_confirmed
    }


def summary_to_dict(s):
    return {
        'period': s.period,
        'total_transactions': s.total_transactions,
        'total_amount': s.total_amount,
        'confirmed_amount': s.confirmed_amount,
        'pending_amount': s.pending_amount,
        'anomaly_count': s.anomaly_count,
        'duplicate_count': s.duplicate_count,
        'cross_period_fee_count': s.cross_period_fee_count,
        'suspense_count': s.suspense_count,
        'generated_at': s.generated_at.isoformat()
    }


def prepare_full_export(transactions):
    tx_data = []
    anomaly_data = []
    log_data = []

    for tx in transactions:
        tx_data.append({
            '流水号': tx.transaction_no,
            '交易日期': tx.transaction_date,
            '金额': tx.amount,
            '手续费': tx.fee,
            '类型': tx.type,
            '渠道': tx.channel,
            '订单号': tx.order_no,
            '付款方': tx.payer,
            '备注': tx.remark,
            '状态': tx.status,
            '人工更正': '是' if tx.is_manual_correction else '否'
        })

        for a in tx.anomalies:
            anomaly_data.append({
                '流水号': tx.transaction_no,
                '异常类型': a.anomaly_type,
                '严重程度': a.severity,
                '异常描述': a.description,
                '检测依据': a.evidence,
                '是否已解决': '是' if a.is_resolved else '否',
                '解决说明': a.resolution_note or ''
            })

        for log in tx.status_logs:
            log_data.append({
                '流水号': tx.transaction_no,
                '原状态': log.from_status or '初始',
                '新状态': log.to_status,
                '操作人': log.operator,
                '变更原因': log.reason or '',
                '变更时间': log.created_at
            })

    return {
        '流水明细': pd.DataFrame(tx_data),
        '异常记录': pd.DataFrame(anomaly_data),
        '状态变更日志': pd.DataFrame(log_data)
    }


def prepare_anomaly_export(transactions):
    data = []
    for tx in transactions:
        for a in tx.anomalies:
            if not a.is_resolved:
                data.append({
                    '流水号': tx.transaction_no,
                    '交易日期': tx.transaction_date,
                    '金额': tx.amount,
                    '异常类型': a.anomaly_type,
                    '严重程度': a.severity,
                    '异常描述': a.description,
                    '检测依据': a.evidence,
                    '关联流水ID': a.related_transaction_ids or ''
                })
    return {'待处理异常': pd.DataFrame(data)}


def prepare_reconciliation_export(transactions):
    confirmed = [tx for tx in transactions if tx.status == 'confirmed']
    pending = [tx for tx in transactions if tx.status in ['pending', 'pending_confirm']]
    anomalies = [a for tx in transactions for a in tx.anomalies if not a.is_resolved]

    summary_data = [{
        '项目': ['确认交易笔数', '确认金额', '待确认笔数', '待确认金额', '待处理异常数'],
        '数值': [
            len(confirmed),
            sum(tx.amount for tx in confirmed),
            len(pending),
            sum(tx.amount for tx in pending),
            len(anomalies)
        ]
    }]

    anomaly_summary = []
    anomaly_types = {}
    for a in anomalies:
        anomaly_types[a.anomaly_type] = anomaly_types.get(a.anomaly_type, 0) + 1

    for atype, count in anomaly_types.items():
        anomaly_summary.append({
            '异常类型': atype,
            '数量': count,
            '说明': get_anomaly_description(atype)
        })

    return {
        '对账汇总': pd.DataFrame(summary_data),
        '异常汇总': pd.DataFrame(anomaly_summary),
        '确认流水': pd.DataFrame([{
            '流水号': tx.transaction_no,
            '交易日期': tx.transaction_date,
            '金额': tx.amount,
            '类型': tx.type,
            '备注': tx.remark
        } for tx in confirmed])
    }


def get_anomaly_description(atype):
    descriptions = {
        'duplicate': '疑似同一流水重复入账，需核实后确认或标记作废',
        'cross_period_fee': '手续费归属期与对账期不符，需核实',
        'suspense_refund': '退款未明确赔付归属，需补充分摊信息或备注说明',
        'late_attachment': '附件晚到，请注意核对完整性'
    }
    return descriptions.get(atype, '')


def create_sample_transactions(period):
    year, month = map(int, period.split('-'))
    base_date = datetime(year, month, 15)

    transactions = []

    for i in range(1, 8):
        tx_date = base_date.replace(day=i)
        transactions.append(Transaction(
            transaction_no=f'PAY{year}{month:02d}{i:03d}',
            transaction_date=tx_date.date(),
            amount=1000 + i * 50,
            fee=5 + i,
            type='payment',
            channel='alipay',
            order_no=f'ORD{year}{month:02d}{i:05d}',
            payer=f'客户{i:03d}',
            remark=f'正常交易-{i}',
            source='sample',
            status='pending',
            current_period=period
        ))

    transactions.append(Transaction(
        transaction_no=f'DUP{year}{month:02d}001',
        transaction_date=base_date.replace(day=10).date(),
        amount=2500.00,
        fee=15,
        type='payment',
        channel='wechat',
        order_no=f'ORD{year}{month:02d}00088',
        payer='客户008',
        remark='微信支付-订单88',
        source='sample',
        status='pending',
        current_period=period
    ))
    transactions.append(Transaction(
        transaction_no=f'DUP{year}{month:02d}001',
        transaction_date=base_date.replace(day=10).date(),
        amount=2500.00,
        fee=15,
        type='payment',
        channel='wechat',
        order_no=f'ORD{year}{month:02d}00088',
        payer='客户008',
        remark='微信支付-重复录入',
        source='sample',
        status='pending',
        current_period=period
    ))

    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1
    transactions.append(Transaction(
        transaction_no=f'FEE{year}{month:02d}099',
        transaction_date=datetime(prev_year, prev_month, 25).date(),
        amount=0,
        fee=-50.00,
        type='fee',
        channel='alipay',
        order_no='',
        payer='支付宝',
        remark='上月手续费结算',
        source='sample',
        status='pending',
        current_period=period
    ))

    transactions.append(Transaction(
        transaction_no=f'REF{year}{month:02d}100',
        transaction_date=base_date.replace(day=20).date(),
        amount=-800.00,
        fee=0,
        type='refund',
        channel='alipay',
        order_no=f'ORD{year}{month:02d}00099',
        payer='客户099',
        remark='',
        source='sample',
        status='pending',
        current_period=period
    ))

    transactions.append(Transaction(
        transaction_no=f'LAT{year}{month:02d}101',
        transaction_date=base_date.replace(day=5).date(),
        amount=3500.00,
        fee=20,
        type='payment',
        channel='bank',
        order_no=f'ORD{year}{month:02d}00101',
        payer='客户101',
        remark='大额转账（回单晚到）',
        attachment_date=base_date.replace(day=18).date(),
        source='sample',
        status='pending',
        current_period=period
    ))

    transactions.append(Transaction(
        transaction_no=f'MAN{year}{month:02d}102',
        transaction_date=base_date.replace(day=22).date(),
        amount=1200.00,
        fee=8,
        type='payment',
        channel='manual',
        order_no=f'ORD{year}{month:02d}00102',
        payer='客户102',
        remark='人工补录-系统漏单',
        is_manual_correction=True,
        correction_ref=f'MANUAL{year}{month:02d}001',
        source='sample',
        status='pending',
        current_period=period
    ))

    return transactions
