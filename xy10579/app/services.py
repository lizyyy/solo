from app import db
from app.models import (
    Meter, MeterReading, ReadingHistory, AbnormalRecord, AbnormalHistory,
    Bill, CorrectionRecord, BillHistory, SystemConfig,
    MeterType, MeterStatus, ReadingType, ReadingStatus, 
    AbnormalType, AbnormalStatus, BillStatus, CorrectionType
)
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from sqlalchemy import and_

DEFAULT_WATER_PRICE = 5.0
DEFAULT_ELECTRIC_PRICE = 0.6
HIGH_USAGE_THRESHOLD = 3.0
LOW_USAGE_THRESHOLD = 0.1

def get_or_create_config(key, default_value, description=''):
    config = SystemConfig.query.filter_by(key=key).first()
    if not config:
        config = SystemConfig(key=key, value=str(default_value), description=description)
        db.session.add(config)
        db.session.commit()
    return config

def get_price(meter_type):
    if meter_type == MeterType.WATER.value:
        config = get_or_create_config('water_price', DEFAULT_WATER_PRICE, '水费单价')
        return float(config.value)
    else:
        config = get_or_create_config('electric_price', DEFAULT_ELECTRIC_PRICE, '电费单价')
        return float(config.value)

def get_last_reading(meter_id):
    return MeterReading.query.filter_by(
        meter_id=meter_id,
        status=ReadingStatus.CONFIRMED.value
    ).order_by(MeterReading.reading_time.desc()).first()

def get_reading_by_period(meter_id, billing_period):
    return MeterReading.query.filter_by(
        meter_id=meter_id,
        billing_period=billing_period
    ).order_by(MeterReading.created_at.desc()).first()

def calculate_estimated_reading(meter, previous_reading):
    readings = MeterReading.query.filter_by(
        meter_id=meter.id,
        status=ReadingStatus.CONFIRMED.value,
        reading_type=ReadingType.ACTUAL.value
    ).order_by(MeterReading.reading_time.desc()).limit(3).all()
    
    total_usage = 0
    count = 0
    
    for r in readings:
        if r.usage and r.usage > 0:
            total_usage += r.usage
            count += 1
    
    if count == 0:
        estimated_usage = 100 if meter.type == MeterType.ELECTRIC.value else 10
    else:
        estimated_usage = total_usage / count
    
    return previous_reading.reading_value + estimated_usage

def detect_abnormal(meter_id, reading_value, previous_reading, usage):
    abnormals = []
    
    if previous_reading and reading_value < previous_reading.reading_value:
        abnormals.append({
            'type': AbnormalType.BACKWARD_READING.value,
            'description': f'读数倒退: 本期{reading_value} < 上期{previous_reading.reading_value}',
            'detected_value': reading_value,
            'expected_min': previous_reading.reading_value,
            'expected_max': previous_reading.reading_value * 10
        })
    
    if usage < 0:
        abnormals.append({
            'type': AbnormalType.NEGATIVE_USAGE.value,
            'description': f'负数用量: {usage}',
            'detected_value': usage,
            'expected_min': 0,
            'expected_max': None
        })
    
    readings = MeterReading.query.filter_by(
        meter_id=meter_id,
        status=ReadingStatus.CONFIRMED.value,
        reading_type=ReadingType.ACTUAL.value
    ).order_by(MeterReading.reading_time.desc()).limit(3).all()
    
    if readings and usage > 0:
        avg_usage = sum(r.usage for r in readings if r.usage and r.usage > 0) / len(readings)
        if avg_usage > 0:
            if usage > avg_usage * HIGH_USAGE_THRESHOLD:
                abnormals.append({
                    'type': AbnormalType.HIGH_USAGE.value,
                    'description': f'异常高用量: {usage} > {avg_usage} * {HIGH_USAGE_THRESHOLD}',
                    'detected_value': usage,
                    'expected_min': 0,
                    'expected_max': avg_usage * HIGH_USAGE_THRESHOLD
                })
            elif usage < avg_usage * LOW_USAGE_THRESHOLD:
                abnormals.append({
                    'type': AbnormalType.LOW_USAGE.value,
                    'description': f'异常低用量: {usage} < {avg_usage} * {LOW_USAGE_THRESHOLD}',
                    'detected_value': usage,
                    'expected_min': avg_usage * LOW_USAGE_THRESHOLD,
                    'expected_max': avg_usage * HIGH_USAGE_THRESHOLD
                })
    
    return abnormals

def create_meter(data):
    existing = Meter.query.filter_by(meter_no=data['meter_no']).first()
    if existing:
        raise Exception(f'表计编号 {data["meter_no"]} 已存在')
    
    meter = Meter(
        meter_no=data['meter_no'],
        type=data['type'],
        status=data.get('status', MeterStatus.ACTIVE.value),
        location=data.get('location'),
        customer_id=data.get('customer_id'),
        customer_name=data.get('customer_name'),
        initial_reading=data.get('initial_reading', 0.0),
        current_reading=data.get('initial_reading', 0.0)
    )
    db.session.add(meter)
    db.session.commit()
    return meter

def submit_reading(meter_id, data):
    meter = Meter.query.get(meter_id)
    if not meter:
        raise Exception('表计不存在')
    
    if meter.status != MeterStatus.ACTIVE.value:
        raise Exception(f'表计状态为{meter.status}，无法抄表')
    
    billing_period = data.get('billing_period', f'{datetime.now().year}-{datetime.now().month:02d}')
    
    existing = get_reading_by_period(meter_id, billing_period)
    if existing:
        return {
            'success': False,
            'message': f'该计费周期{billing_period}已存在抄表记录',
            'existing_reading': reading_to_dict(existing),
            'is_idempotent': True
        }
    
    previous_reading = get_last_reading(meter_id)
    reading_value = data['reading_value']
    
    if previous_reading:
        usage = reading_value - previous_reading.reading_value
        previous_value = previous_reading.reading_value
    else:
        usage = reading_value - meter.initial_reading
        previous_value = meter.initial_reading
    
    reading = MeterReading(
        meter_id=meter_id,
        reading_value=reading_value,
        previous_reading=previous_value,
        usage=usage,
        reading_type=ReadingType.ACTUAL.value,
        reading_time=data.get('reading_time', datetime.now()),
        billing_period=billing_period,
        status=ReadingStatus.PENDING.value,
        reader=data.get('reader'),
        remarks=data.get('remarks'),
        is_estimated=False
    )
    db.session.add(reading)
    db.session.flush()
    
    abnormals = detect_abnormal(meter_id, reading_value, previous_reading, usage)
    
    for abn in abnormals:
        abnormal = AbnormalRecord(
            meter_id=meter_id,
            reading_id=reading.id,
            abnormal_type=abn['type'],
            detected_value=abn['detected_value'],
            expected_min=abn.get('expected_min'),
            expected_max=abn.get('expected_max'),
            description=abn['description'],
            status=AbnormalStatus.DETECTED.value
        )
        db.session.add(abnormal)
    
    if not abnormals:
        reading.status = ReadingStatus.CONFIRMED.value
        meter.current_reading = reading_value
    
    db.session.commit()
    
    return {
        'success': True,
        'reading': reading_to_dict(reading),
        'abnormals': [abnormal_to_dict(a) for a in AbnormalRecord.query.filter_by(reading_id=reading.id).all()],
        'message': '抄表提交成功' if not abnormals else '抄表提交成功，但检测到异常数据'
    }

def submit_estimated_reading(meter_id, data):
    meter = Meter.query.get(meter_id)
    if not meter:
        raise Exception('表计不存在')
    
    billing_period = data.get('billing_period', f'{datetime.now().year}-{datetime.now().month:02d}')
    
    existing = get_reading_by_period(meter_id, billing_period)
    if existing:
        return {
            'success': False,
            'message': f'该计费周期{billing_period}已存在抄表记录',
            'existing_reading': reading_to_dict(existing),
            'is_idempotent': True
        }
    
    previous_reading = get_last_reading(meter_id)
    if not previous_reading:
        previous_value = meter.initial_reading
    else:
        previous_value = previous_reading.reading_value
    
    reading_value = calculate_estimated_reading(meter, MeterReading(
        reading_value=previous_value
    ) if not previous_reading else previous_reading)
    usage = reading_value - previous_value
    
    reading = MeterReading(
        meter_id=meter_id,
        reading_value=reading_value,
        previous_reading=previous_value,
        usage=usage,
        reading_type=ReadingType.ESTIMATED.value,
        reading_time=data.get('reading_time', datetime.now()),
        billing_period=billing_period,
        status=ReadingStatus.CONFIRMED.value,
        reader=data.get('reader', 'system'),
        remarks=data.get('remarks', '漏抄估读'),
        is_estimated=True
    )
    db.session.add(reading)
    meter.current_reading = reading_value
    
    db.session.commit()
    
    return {
        'success': True,
        'reading': reading_to_dict(reading),
        'message': '估读提交成功'
    }

def update_estimated_to_actual(meter_id, billing_period, data):
    existing = get_reading_by_period(meter_id, billing_period)
    if not existing:
        raise Exception('该计费周期不存在抄表记录')
    
    if existing.reading_type != ReadingType.ESTIMATED.value:
        return {
            'success': False,
            'message': '该读数不是估读数，无法补录真实读数'
        }
    
    old_value = existing.reading_value
    old_type = existing.reading_type
    old_status = existing.status
    
    previous_reading = get_last_reading(meter_id)
    if previous_reading:
        previous_value = previous_reading.reading_value
    else:
        previous_value = existing.meter.initial_reading
    
    new_reading_value = data['reading_value']
    new_usage = new_reading_value - previous_value
    
    history = ReadingHistory(
        reading_id=existing.id,
        old_value=old_value,
        new_value=new_reading_value,
        old_type=old_type,
        new_type=ReadingType.CORRECTED.value,
        old_status=old_status,
        new_status=ReadingStatus.CONFIRMED.value,
        operator=data.get('operator', 'system'),
        reason=data.get('reason', '补录真实读数')
    )
    db.session.add(history)
    
    existing.reading_value = new_reading_value
    existing.previous_reading = previous_value
    existing.usage = new_usage
    existing.reading_type = ReadingType.CORRECTED.value
    existing.status = ReadingStatus.CONFIRMED.value
    existing.is_estimated = False
    existing.reader = data.get('reader', existing.reader)
    existing.remarks = data.get('remarks', '补录真实读数')
    
    meter = existing.meter
    meter.current_reading = new_reading_value
    
    db.session.commit()
    
    bills = Bill.query.filter_by(
        meter_id=meter_id,
        billing_period=billing_period
    ).all()
    
    bill_updates = []
    for bill in bills:
        if bill.status in [BillStatus.ISSUED.value, BillStatus.OVERDUE.value]:
            unit_price = bill.unit_price
            new_amount = new_usage * unit_price
            diff_amount = new_amount - bill.amount
            
            correction = CorrectionRecord(
                bill_id=bill.id,
                correction_type=CorrectionType.ESTIMATE_ERROR.value,
                old_previous_reading=bill.previous_reading,
                old_current_reading=bill.current_reading,
                old_usage=bill.usage,
                old_amount=bill.amount,
                new_previous_reading=previous_value,
                new_current_reading=new_reading_value,
                new_usage=new_usage,
                new_amount=new_amount,
                difference_amount=diff_amount,
                operator=data.get('operator', 'system'),
                reason=f'补录真实读数，原估读{old_value}，实际{new_reading_value}'
            )
            db.session.add(correction)
            
            bill_history = BillHistory(
                bill_id=bill.id,
                old_status=bill.status,
                new_status=BillStatus.CORRECTED.value,
                old_amount=bill.amount,
                new_amount=new_amount,
                operator=data.get('operator', 'system'),
                reason=f'补录真实读数，修正账单金额'
            )
            db.session.add(bill_history)
            
            bill.usage = new_usage
            bill.current_reading = new_reading_value
            bill.amount = new_amount
            bill.is_estimated = False
            
            bill_updates.append({
                'bill_no': bill.bill_no,
                'old_amount': bill.amount - diff_amount,
                'new_amount': new_amount,
                'difference': diff_amount,
                'status': 'corrected'
            })
    
    db.session.commit()
    
    return {
        'success': True,
        'reading': reading_to_dict(existing),
        'bill_updates': bill_updates,
        'message': '已补录真实读数并更新相关账单'
    }

def review_abnormal(abnormal_id, data):
    abnormal = AbnormalRecord.query.get(abnormal_id)
    if not abnormal:
        raise Exception('异常记录不存在')
    
    old_status = abnormal.status
    action = data['action']
    operator = data.get('operator', 'system')
    remark = data.get('remark', '')
    
    history = AbnormalHistory(
        abnormal_id=abnormal.id,
        old_status=old_status,
        new_status=AbnormalStatus.REVIEWING.value,
        operator=operator,
        remark=f'开始复核: {remark}'
    )
    db.session.add(history)
    
    abnormal.status = AbnormalStatus.REVIEWING.value
    db.session.flush()
    
    reading = MeterReading.query.get(abnormal.reading_id)
    result = {}
    
    if action == 'resolve':
        if reading and data.get('correct_reading'):
            new_reading = data['correct_reading']
            previous_reading = get_last_reading(abnormal.meter_id)
            
            if previous_reading:
                previous_value = previous_reading.reading_value
            else:
                previous_value = reading.meter.initial_reading
            
            new_usage = new_reading - previous_value
            
            reading_history = ReadingHistory(
                reading_id=reading.id,
                old_value=reading.reading_value,
                new_value=new_reading,
                old_type=reading.reading_type,
                new_type=ReadingType.CORRECTED.value,
                old_status=reading.status,
                new_status=ReadingStatus.CONFIRMED.value,
                operator=operator,
                reason=f'异常修正: {abnormal.description}'
            )
            db.session.add(reading_history)
            
            reading.reading_value = new_reading
            reading.usage = new_usage
            reading.status = ReadingStatus.CONFIRMED.value
            reading.reading_type = ReadingType.CORRECTED.value
            reading.remarks = remark
            
            meter = reading.meter
            meter.current_reading = new_reading
            
            bill = Bill.query.filter_by(reading_id=reading.id).first()
            if bill:
                if bill.status == BillStatus.PAID.value:
                    result['bill_warning'] = '账单已缴费，无法直接修改，请通过纠错流程处理'
                else:
                    unit_price = bill.unit_price
                    new_amount = new_usage * unit_price
                    diff_amount = new_amount - bill.amount
                    
                    correction = CorrectionRecord(
                        bill_id=bill.id,
                        correction_type=CorrectionType.READING_ERROR.value,
                        old_previous_reading=bill.previous_reading,
                        old_current_reading=bill.current_reading,
                        old_usage=bill.usage,
                        old_amount=bill.amount,
                        new_previous_reading=previous_value,
                        new_current_reading=new_reading,
                        new_usage=new_usage,
                        new_amount=new_amount,
                        difference_amount=diff_amount,
                        operator=operator,
                        reason=f'异常修正: {abnormal.description}'
                    )
                    db.session.add(correction)
                    
                    bill.usage = new_usage
                    bill.current_reading = new_reading
                    bill.amount = new_amount
                    
                    result['bill_updated'] = {
                        'bill_no': bill.bill_no,
                        'old_amount': bill.amount - diff_amount,
                        'new_amount': new_amount,
                        'difference': diff_amount
                    }
        
        abnormal.status = AbnormalStatus.RESOLVED.value
        abnormal.reviewer = operator
        abnormal.review_remark = remark
        abnormal.reviewed_at = datetime.now()
        
    elif action == 'dismiss':
        abnormal.status = AbnormalStatus.DISMISSED.value
        abnormal.reviewer = operator
        abnormal.review_remark = remark
        abnormal.reviewed_at = datetime.now()
        
        if reading:
            reading.status = ReadingStatus.CONFIRMED.value
    
    history2 = AbnormalHistory(
        abnormal_id=abnormal.id,
        old_status=AbnormalStatus.REVIEWING.value,
        new_status=abnormal.status,
        operator=operator,
        remark=f'复核完成: {remark}'
    )
    db.session.add(history2)
    
    db.session.commit()
    
    return {
        'success': True,
        'abnormal': abnormal_to_dict(abnormal),
        'result': result,
        'message': '异常复核完成'
    }

def generate_bill_no():
    today = date.today()
    prefix = f'BILL{today.year}{today.month:02d}{today.day:02d}'
    count = Bill.query.filter(Bill.bill_no.like(f'{prefix}%')).count() + 1
    return f'{prefix}{count:04d}'

def generate_bill(meter_id, billing_period, data=None):
    meter = Meter.query.get(meter_id)
    if not meter:
        raise Exception('表计不存在')
    
    reading = get_reading_by_period(meter_id, billing_period)
    if not reading:
        raise Exception(f'计费周期{billing_period}无抄表记录')
    
    if reading.status != ReadingStatus.CONFIRMED.value:
        raise Exception('抄表记录未确认，无法生成账单')
    
    existing_bill = Bill.query.filter_by(
        meter_id=meter_id,
        billing_period=billing_period
    ).first()
    
    if existing_bill:
        return {
            'success': False,
            'message': f'该计费周期{billing_period}已存在账单',
            'bill': bill_to_dict(existing_bill),
            'is_idempotent': True
        }
    
    unit_price = get_price(meter.type)
    amount = reading.usage * unit_price
    
    bill = Bill(
        bill_no=generate_bill_no(),
        meter_id=meter_id,
        billing_period=billing_period,
        reading_id=reading.id,
        previous_reading=reading.previous_reading,
        current_reading=reading.reading_value,
        usage=reading.usage,
        unit_price=unit_price,
        amount=amount,
        status=BillStatus.DRAFT.value,
        is_estimated=reading.is_estimated
    )
    db.session.add(bill)
    db.session.commit()
    
    return {
        'success': True,
        'bill': bill_to_dict(bill),
        'message': '账单生成成功'
    }

def issue_bill(bill_id, data=None):
    bill = Bill.query.get(bill_id)
    if not bill:
        raise Exception('账单不存在')
    
    if bill.status != BillStatus.DRAFT.value:
        return {
            'success': False,
            'message': f'账单状态为{bill.status}，无法出账',
            'bill': bill_to_dict(bill),
            'is_idempotent': bill.status == BillStatus.ISSUED.value
        }
    
    history = BillHistory(
        bill_id=bill.id,
        old_status=BillStatus.DRAFT.value,
        new_status=BillStatus.ISSUED.value,
        old_amount=bill.amount,
        new_amount=bill.amount,
        operator=data.get('operator', 'system') if data else 'system',
        reason='出账'
    )
    db.session.add(history)
    
    bill.status = BillStatus.ISSUED.value
    bill.issued_at = datetime.now()
    db.session.commit()
    
    return {
        'success': True,
        'bill': bill_to_dict(bill),
        'message': '账单已出账'
    }

def pay_bill(bill_id, data=None):
    bill = Bill.query.get(bill_id)
    if not bill:
        raise Exception('账单不存在')
    
    if bill.status == BillStatus.PAID.value:
        return {
            'success': False,
            'message': '账单已缴费',
            'bill': bill_to_dict(bill),
            'is_idempotent': True
        }
    
    if bill.status not in [BillStatus.ISSUED.value, BillStatus.OVERDUE.value]:
        return {
            'success': False,
            'message': f'账单状态为{bill.status}，无法缴费',
            'bill': bill_to_dict(bill)
        }
    
    history = BillHistory(
        bill_id=bill.id,
        old_status=bill.status,
        new_status=BillStatus.PAID.value,
        old_amount=bill.amount,
        new_amount=bill.amount,
        operator=data.get('operator', 'system') if data else 'system',
        reason='缴费'
    )
    db.session.add(history)
    
    bill.status = BillStatus.PAID.value
    bill.paid_at = datetime.now()
    db.session.commit()
    
    return {
        'success': True,
        'bill': bill_to_dict(bill),
        'message': '账单已缴费'
    }

def correct_bill(bill_id, data):
    bill = Bill.query.get(bill_id)
    if not bill:
        raise Exception('账单不存在')
    
    if bill.status == BillStatus.PAID.value:
        return {
            'success': False,
            'message': '已缴费账单不能直接修改，需通过重新出账流程处理',
            'bill': bill_to_dict(bill)
        }
    
    old_amount = bill.amount
    old_reading = bill.current_reading
    old_usage = bill.usage
    
    correction_type = data.get('correction_type', CorrectionType.READING_ERROR.value)
    operator = data.get('operator', 'system')
    reason = data.get('reason', '账单纠错')
    
    if data.get('new_reading') is not None:
        new_reading = data['new_reading']
        new_usage = new_reading - bill.previous_reading
        new_amount = new_usage * bill.unit_price
        difference = new_amount - old_amount
        
        correction = CorrectionRecord(
            bill_id=bill.id,
            correction_type=correction_type,
            old_previous_reading=bill.previous_reading,
            old_current_reading=old_reading,
            old_usage=old_usage,
            old_amount=old_amount,
            new_previous_reading=bill.previous_reading,
            new_current_reading=new_reading,
            new_usage=new_usage,
            new_amount=new_amount,
            difference_amount=difference,
            operator=operator,
            reason=reason
        )
        db.session.add(correction)
        
        bill_history = BillHistory(
            bill_id=bill.id,
            old_status=bill.status,
            new_status=BillStatus.CORRECTED.value,
            old_amount=old_amount,
            new_amount=new_amount,
            operator=operator,
            reason=reason
        )
        db.session.add(bill_history)
        
        bill.current_reading = new_reading
        bill.usage = new_usage
        bill.amount = new_amount
        bill.status = BillStatus.CORRECTED.value
        
        reading = MeterReading.query.get(bill.reading_id)
        if reading:
            reading_history = ReadingHistory(
                reading_id=reading.id,
                old_value=reading.reading_value,
                new_value=new_reading,
                old_type=reading.reading_type,
                new_type=ReadingType.CORRECTED.value,
                old_status=reading.status,
                new_status=ReadingStatus.CORRECTED.value,
                operator=operator,
                reason=reason
            )
            db.session.add(reading_history)
            
            reading.reading_value = new_reading
            reading.usage = new_usage
            reading.reading_type = ReadingType.CORRECTED.value
            reading.status = ReadingStatus.CORRECTED.value
            
            meter = reading.meter
            meter.current_reading = new_reading
    
    elif data.get('new_unit_price') is not None:
        new_unit_price = data['new_unit_price']
        new_amount = bill.usage * new_unit_price
        difference = new_amount - old_amount
        
        correction = CorrectionRecord(
            bill_id=bill.id,
            correction_type=CorrectionType.PRICE_ADJUSTMENT.value,
            old_previous_reading=bill.previous_reading,
            old_current_reading=bill.current_reading,
            old_usage=bill.usage,
            old_amount=old_amount,
            new_previous_reading=bill.previous_reading,
            new_current_reading=bill.current_reading,
            new_usage=bill.usage,
            new_amount=new_amount,
            difference_amount=difference,
            operator=operator,
            reason=reason
        )
        db.session.add(correction)
        
        bill_history = BillHistory(
            bill_id=bill.id,
            old_status=bill.status,
            new_status=BillStatus.CORRECTED.value,
            old_amount=old_amount,
            new_amount=new_amount,
            operator=operator,
            reason=reason
        )
        db.session.add(bill_history)
        
        bill.unit_price = new_unit_price
        bill.amount = new_amount
        bill.status = BillStatus.CORRECTED.value
    
    db.session.commit()
    
    return {
        'success': True,
        'bill': bill_to_dict(bill),
        'correction': {
            'old_amount': old_amount,
            'new_amount': bill.amount,
            'difference': bill.amount - old_amount,
            'reason': reason
        },
        'message': '账单纠错完成'
    }

def reissue_bill(bill_id, data):
    bill = Bill.query.get(bill_id)
    if not bill:
        raise Exception('账单不存在')
    
    if bill.status != BillStatus.PAID.value:
        return {
            'success': False,
            'message': '只有已缴费账单才能重新出账',
            'bill': bill_to_dict(bill)
        }
    
    operator = data.get('operator', 'system')
    reason = data.get('reason', '重新出账')
    new_reading = data.get('new_reading')
    
    if new_reading is None:
        raise Exception('重新出账必须提供新的读数')
    
    new_usage = new_reading - bill.previous_reading
    new_amount = new_usage * bill.unit_price
    difference = new_amount - bill.amount
    
    correction = CorrectionRecord(
        bill_id=bill.id,
        correction_type=data.get('correction_type', CorrectionType.READING_ERROR.value),
        old_previous_reading=bill.previous_reading,
        old_current_reading=bill.current_reading,
        old_usage=bill.usage,
        old_amount=bill.amount,
        new_previous_reading=bill.previous_reading,
        new_current_reading=new_reading,
        new_usage=new_usage,
        new_amount=new_amount,
        difference_amount=difference,
        operator=operator,
        reason=reason
    )
    db.session.add(correction)
    
    new_bill = Bill(
        bill_no=generate_bill_no(),
        meter_id=bill.meter_id,
        billing_period=bill.billing_period,
        reading_id=bill.reading_id,
        previous_reading=bill.previous_reading,
        current_reading=new_reading,
        usage=new_usage,
        unit_price=bill.unit_price,
        amount=difference,
        status=BillStatus.DRAFT.value,
        is_estimated=False,
        parent_bill_id=bill.id
    )
    db.session.add(new_bill)
    
    bill_history = BillHistory(
        bill_id=bill.id,
        old_status=BillStatus.PAID.value,
        new_status=BillStatus.CORRECTED.value,
        old_amount=bill.amount,
        new_amount=bill.amount,
        operator=operator,
        reason=f'已重新出账，新账单号: {new_bill.bill_no}'
    )
    db.session.add(bill_history)
    
    bill.status = BillStatus.CORRECTED.value
    
    reading = MeterReading.query.get(bill.reading_id)
    if reading:
        reading_history = ReadingHistory(
            reading_id=reading.id,
            old_value=reading.reading_value,
            new_value=new_reading,
            old_type=reading.reading_type,
            new_type=ReadingType.CORRECTED.value,
            old_status=reading.status,
            new_status=ReadingStatus.CORRECTED.value,
            operator=operator,
            reason=reason
        )
        db.session.add(reading_history)
        
        reading.reading_value = new_reading
        reading.usage = new_usage
        reading.reading_type = ReadingType.CORRECTED.value
        reading.status = ReadingStatus.CORRECTED.value
        
        meter = reading.meter
        meter.current_reading = new_reading
    
    db.session.commit()
    
    return {
        'success': True,
        'original_bill': bill_to_dict(bill),
        'new_bill': bill_to_dict(new_bill),
        'difference': {
            'old_reading': bill.current_reading,
            'new_reading': new_reading,
            'old_amount': bill.amount,
            'new_amount': new_amount,
            'diff_amount': difference
        },
        'message': '重新出账成功，已生成补收/退款账单'
    }

def get_meter_history(meter_id):
    meter = Meter.query.get(meter_id)
    if not meter:
        raise Exception('表计不存在')
    
    readings = MeterReading.query.filter_by(meter_id=meter_id).order_by(MeterReading.reading_time.desc()).all()
    bills = Bill.query.filter_by(meter_id=meter_id).order_by(Bill.created_at.desc()).all()
    abnormals = AbnormalRecord.query.filter_by(meter_id=meter_id).order_by(AbnormalRecord.created_at.desc()).all()
    
    return {
        'meter': meter_to_dict(meter),
        'readings': [reading_to_dict(r) for r in readings],
        'bills': [bill_to_dict(b) for b in bills],
        'abnormals': [abnormal_to_dict(a) for a in abnormals]
    }

def get_bill_history(bill_id):
    bill = Bill.query.get(bill_id)
    if not bill:
        raise Exception('账单不存在')
    
    history = BillHistory.query.filter_by(bill_id=bill_id).order_by(BillHistory.created_at.desc()).all()
    corrections = CorrectionRecord.query.filter_by(bill_id=bill_id).order_by(CorrectionRecord.created_at.desc()).all()
    
    return {
        'bill': bill_to_dict(bill),
        'history': [h.__dict__ for h in history],
        'corrections': [c.__dict__ for c in corrections]
    }

def generate_report(billing_period=None):
    query = Bill.query
    if billing_period:
        query = query.filter_by(billing_period=billing_period)
    
    bills = query.order_by(Bill.created_at.desc()).all()
    
    total_amount = sum(b.amount for b in bills)
    paid_amount = sum(b.amount for b in bills if b.status == BillStatus.PAID.value)
    unpaid_amount = sum(b.amount for b in bills if b.status in [BillStatus.ISSUED.value, BillStatus.OVERDUE.value])
    
    abnormals = AbnormalRecord.query.order_by(AbnormalRecord.created_at.desc()).all()
    pending_abnormals = [a for a in abnormals if a.status in [AbnormalStatus.DETECTED.value, AbnormalStatus.REVIEWING.value]]
    
    estimated_bills = [b for b in bills if b.is_estimated]
    corrected_bills = [b for b in bills if b.status == BillStatus.CORRECTED.value]
    
    corrections = CorrectionRecord.query.order_by(CorrectionRecord.created_at.desc()).all()
    total_diff = sum(c.difference_amount for c in corrections) if corrections else 0
    
    return {
        'billing_period': billing_period or '全部',
        'summary': {
            'total_bills': len(bills),
            'total_amount': round(total_amount, 2),
            'paid_amount': round(paid_amount, 2),
            'unpaid_amount': round(unpaid_amount, 2),
            'paid_count': len([b for b in bills if b.status == BillStatus.PAID.value]),
            'unpaid_count': len([b for b in bills if b.status in [BillStatus.ISSUED.value, BillStatus.OVERDUE.value]]),
            'estimated_bills_count': len(estimated_bills),
            'corrected_bills_count': len(corrected_bills),
            'pending_abnormals_count': len(pending_abnormals)
        },
        'bill_details': [bill_to_dict(b) for b in bills],
        'correction_summary': {
            'total_corrections': len(corrections),
            'total_difference': round(total_diff, 2),
            'details': [{
                'bill_no': c.bill.bill_no,
                'type': c.correction_type,
                'old_amount': c.old_amount,
                'new_amount': c.new_amount,
                'diff': c.difference_amount,
                'reason': c.reason,
                'operator': c.operator,
                'time': c.created_at.isoformat() if c.created_at else None
            } for c in corrections]
        },
        'abnormal_details': [abnormal_to_dict(a) for a in abnormals]
    }

def meter_to_dict(m):
    return {
        'id': m.id,
        'meter_no': m.meter_no,
        'type': m.type,
        'status': m.status,
        'location': m.location,
        'customer_id': m.customer_id,
        'customer_name': m.customer_name,
        'initial_reading': m.initial_reading,
        'current_reading': m.current_reading,
        'created_at': m.created_at.isoformat() if m.created_at else None
    }

def reading_to_dict(r):
    return {
        'id': r.id,
        'meter_id': r.meter_id,
        'meter_no': r.meter.meter_no,
        'reading_value': r.reading_value,
        'previous_reading': r.previous_reading,
        'usage': r.usage,
        'reading_type': r.reading_type,
        'reading_time': r.reading_time.isoformat() if r.reading_time else None,
        'billing_period': r.billing_period,
        'status': r.status,
        'reader': r.reader,
        'remarks': r.remarks,
        'is_estimated': r.is_estimated,
        'history': [{
            'old_value': h.old_value,
            'new_value': h.new_value,
            'old_type': h.old_type,
            'new_type': h.new_type,
            'old_status': h.old_status,
            'new_status': h.new_status,
            'operator': h.operator,
            'reason': h.reason,
            'time': h.created_at.isoformat() if h.created_at else None
        } for h in r.history]
    }

def abnormal_to_dict(a):
    return {
        'id': a.id,
        'meter_id': a.meter_id,
        'meter_no': a.meter.meter_no,
        'reading_id': a.reading_id,
        'abnormal_type': a.abnormal_type,
        'detected_value': a.detected_value,
        'expected_min': a.expected_min,
        'expected_max': a.expected_max,
        'description': a.description,
        'status': a.status,
        'reviewer': a.reviewer,
        'review_remark': a.review_remark,
        'reviewed_at': a.reviewed_at.isoformat() if a.reviewed_at else None,
        'created_at': a.created_at.isoformat() if a.created_at else None,
        'history': [{
            'old_status': h.old_status,
            'new_status': h.new_status,
            'operator': h.operator,
            'remark': h.remark,
            'time': h.created_at.isoformat() if h.created_at else None
        } for h in a.history]
    }

def bill_to_dict(b):
    return {
        'id': b.id,
        'bill_no': b.bill_no,
        'meter_id': b.meter_id,
        'meter_no': b.meter.meter_no,
        'customer_name': b.meter.customer_name,
        'billing_period': b.billing_period,
        'reading_id': b.reading_id,
        'previous_reading': b.previous_reading,
        'current_reading': b.current_reading,
        'usage': b.usage,
        'unit_price': b.unit_price,
        'amount': b.amount,
        'status': b.status,
        'issued_at': b.issued_at.isoformat() if b.issued_at else None,
        'paid_at': b.paid_at.isoformat() if b.paid_at else None,
        'is_estimated': b.is_estimated,
        'parent_bill_id': b.parent_bill_id,
        'created_at': b.created_at.isoformat() if b.created_at else None,
        'corrections': [{
            'type': c.correction_type,
            'old_amount': c.old_amount,
            'new_amount': c.new_amount,
            'diff': c.difference_amount,
            'reason': c.reason,
            'operator': c.operator,
            'time': c.created_at.isoformat() if c.created_at else None
        } for c in b.corrections],
        'history': [{
            'old_status': h.old_status,
            'new_status': h.new_status,
            'old_amount': h.old_amount,
            'new_amount': h.new_amount,
            'operator': h.operator,
            'reason': h.reason,
            'time': h.created_at.isoformat() if h.created_at else None
        } for h in b.history]
    }
