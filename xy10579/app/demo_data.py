from app import db
from app.models import (
    Meter, MeterReading, ReadingHistory, AbnormalRecord, AbnormalHistory,
    Bill, CorrectionRecord, BillHistory, SystemConfig,
    MeterType, MeterStatus, ReadingType, ReadingStatus,
    AbnormalType, AbnormalStatus, BillStatus, CorrectionType
)
from datetime import datetime, date
from dateutil.relativedelta import relativedelta

DEFAULT_WATER_PRICE = 5.0
DEFAULT_ELECTRIC_PRICE = 0.6

def create_demo_data():
    from app.services import (
        create_meter, submit_reading, submit_estimated_reading,
        generate_bill, issue_bill, pay_bill, review_abnormal,
        update_estimated_to_actual, reissue_bill, correct_bill
    )
    
    today = date.today()
    current_period = f'{today.year}-{today.month:02d}'
    prev_period = f'{(today - relativedelta(months=1)).year}-{(today - relativedelta(months=1)).month:02d}'
    prev2_period = f'{(today - relativedelta(months=2)).year}-{(today - relativedelta(months=2)).month:02d}'
    
    print('创建示例数据...')
    
    SystemConfig.query.delete()
    CorrectionRecord.query.delete()
    BillHistory.query.delete()
    Bill.query.delete()
    AbnormalHistory.query.delete()
    AbnormalRecord.query.delete()
    ReadingHistory.query.delete()
    MeterReading.query.delete()
    Meter.query.delete()
    db.session.commit()
    
    configs = [
        SystemConfig(key='water_price', value=str(DEFAULT_WATER_PRICE), description='水费单价'),
        SystemConfig(key='electric_price', value=str(DEFAULT_ELECTRIC_PRICE), description='电费单价'),
        SystemConfig(key='high_usage_threshold', value='3.0', description='高用量阈值倍数'),
        SystemConfig(key='low_usage_threshold', value='0.1', description='低用量阈值倍数')
    ]
    for c in configs:
        db.session.add(c)
    db.session.commit()
    
    meter1 = create_meter({
        'meter_no': 'W001',
        'type': MeterType.WATER.value,
        'location': 'A栋1单元101室',
        'customer_id': 'C001',
        'customer_name': '张三',
        'initial_reading': 100.0
    })
    
    meter2 = create_meter({
        'meter_no': 'E001',
        'type': MeterType.ELECTRIC.value,
        'location': 'A栋1单元101室',
        'customer_id': 'C001',
        'customer_name': '张三',
        'initial_reading': 5000.0
    })
    
    meter3 = create_meter({
        'meter_no': 'W002',
        'type': MeterType.WATER.value,
        'location': 'A栋1单元201室',
        'customer_id': 'C002',
        'customer_name': '李四',
        'initial_reading': 200.0
    })
    
    meter4 = create_meter({
        'meter_no': 'W003',
        'type': MeterType.WATER.value,
        'location': 'B栋1单元101室',
        'customer_id': 'C003',
        'customer_name': '王五',
        'initial_reading': 150.0
    })
    
    meter5 = create_meter({
        'meter_no': 'E002',
        'type': MeterType.ELECTRIC.value,
        'location': 'B栋1单元201室',
        'customer_id': 'C004',
        'customer_name': '赵六',
        'initial_reading': 3000.0
    })
    
    print('场景1: 正常出账流程 (W001)')
    
    r1_prev2 = MeterReading(
        meter_id=meter1.id,
        reading_value=108.0,
        previous_reading=100.0,
        usage=8.0,
        reading_type=ReadingType.ACTUAL.value,
        reading_time=datetime.now() - relativedelta(months=2),
        billing_period=prev2_period,
        status=ReadingStatus.CONFIRMED.value,
        reader='抄表员A',
        is_estimated=False
    )
    db.session.add(r1_prev2)
    
    b1_prev2 = Bill(
        bill_no=f'BILL{prev2_period.replace("-", "")}0001',
        meter_id=meter1.id,
        billing_period=prev2_period,
        reading_id=r1_prev2.id,
        previous_reading=100.0,
        current_reading=108.0,
        usage=8.0,
        unit_price=DEFAULT_WATER_PRICE,
        amount=40.0,
        status=BillStatus.PAID.value,
        issued_at=datetime.now() - relativedelta(months=2),
        paid_at=datetime.now() - relativedelta(months=2),
        is_estimated=False
    )
    db.session.add(b1_prev2)
    
    r1_prev = MeterReading(
        meter_id=meter1.id,
        reading_value=120.0,
        previous_reading=108.0,
        usage=12.0,
        reading_type=ReadingType.ACTUAL.value,
        reading_time=datetime.now() - relativedelta(months=1),
        billing_period=prev_period,
        status=ReadingStatus.CONFIRMED.value,
        reader='抄表员A',
        is_estimated=False
    )
    db.session.add(r1_prev)
    
    b1_prev = Bill(
        bill_no=f'BILL{prev_period.replace("-", "")}0001',
        meter_id=meter1.id,
        billing_period=prev_period,
        reading_id=r1_prev.id,
        previous_reading=108.0,
        current_reading=120.0,
        usage=12.0,
        unit_price=DEFAULT_WATER_PRICE,
        amount=60.0,
        status=BillStatus.ISSUED.value,
        issued_at=datetime.now() - relativedelta(months=1),
        is_estimated=False
    )
    db.session.add(b1_prev)
    
    result1 = submit_reading(meter1.id, {
        'reading_value': 135.0,
        'billing_period': current_period,
        'reader': '抄表员A',
        'remarks': '正常抄表'
    })
    
    result1_bill = generate_bill(meter1.id, current_period)
    issue_bill(result1_bill['bill']['id'])
    
    meter1.current_reading = 135.0
    db.session.commit()
    
    print('场景2: 漏抄估读 + 补录重算 (W002)')
    
    r2_prev2 = MeterReading(
        meter_id=meter3.id,
        reading_value=205.0,
        previous_reading=200.0,
        usage=5.0,
        reading_type=ReadingType.ACTUAL.value,
        reading_time=datetime.now() - relativedelta(months=2),
        billing_period=prev2_period,
        status=ReadingStatus.CONFIRMED.value,
        reader='抄表员B',
        is_estimated=False
    )
    db.session.add(r2_prev2)
    
    b2_prev2 = Bill(
        bill_no=f'BILL{prev2_period.replace("-", "")}0002',
        meter_id=meter3.id,
        billing_period=prev2_period,
        reading_id=r2_prev2.id,
        previous_reading=200.0,
        current_reading=205.0,
        usage=5.0,
        unit_price=DEFAULT_WATER_PRICE,
        amount=25.0,
        status=BillStatus.PAID.value,
        issued_at=datetime.now() - relativedelta(months=2),
        paid_at=datetime.now() - relativedelta(months=2),
        is_estimated=False
    )
    db.session.add(b2_prev2)
    
    r2_prev = MeterReading(
        meter_id=meter3.id,
        reading_value=210.0,
        previous_reading=205.0,
        usage=5.0,
        reading_type=ReadingType.ACTUAL.value,
        reading_time=datetime.now() - relativedelta(months=1),
        billing_period=prev_period,
        status=ReadingStatus.CONFIRMED.value,
        reader='抄表员B',
        is_estimated=False
    )
    db.session.add(r2_prev)
    
    b2_prev = Bill(
        bill_no=f'BILL{prev_period.replace("-", "")}0002',
        meter_id=meter3.id,
        billing_period=prev_period,
        reading_id=r2_prev.id,
        previous_reading=205.0,
        current_reading=210.0,
        usage=5.0,
        unit_price=DEFAULT_WATER_PRICE,
        amount=25.0,
        status=BillStatus.ISSUED.value,
        issued_at=datetime.now() - relativedelta(months=1),
        is_estimated=True
    )
    db.session.add(b2_prev)
    
    result2 = submit_estimated_reading(meter3.id, {
        'billing_period': current_period,
        'reader': 'system',
        'remarks': '住户不在家，漏抄估读'
    })
    
    result2_bill = generate_bill(meter3.id, current_period)
    issue_bill(result2_bill['bill']['id'])
    
    db.session.commit()
    
    result2_update = update_estimated_to_actual(meter3.id, current_period, {
        'reading_value': 220.0,
        'operator': '班长小王',
        'reason': '补录真实读数，原估读不准确',
        'reader': '抄表员B'
    })
    
    meter3.current_reading = 220.0
    db.session.commit()
    
    print('场景3: 异常高用量复核 (E001)')
    
    re_prev2 = MeterReading(
        meter_id=meter2.id,
        reading_value=5100.0,
        previous_reading=5000.0,
        usage=100.0,
        reading_type=ReadingType.ACTUAL.value,
        reading_time=datetime.now() - relativedelta(months=2),
        billing_period=prev2_period,
        status=ReadingStatus.CONFIRMED.value,
        reader='抄表员A',
        is_estimated=False
    )
    db.session.add(re_prev2)
    
    be_prev2 = Bill(
        bill_no=f'BILL{prev2_period.replace("-", "")}0003',
        meter_id=meter2.id,
        billing_period=prev2_period,
        reading_id=re_prev2.id,
        previous_reading=5000.0,
        current_reading=5100.0,
        usage=100.0,
        unit_price=DEFAULT_ELECTRIC_PRICE,
        amount=60.0,
        status=BillStatus.PAID.value,
        issued_at=datetime.now() - relativedelta(months=2),
        paid_at=datetime.now() - relativedelta(months=2),
        is_estimated=False
    )
    db.session.add(be_prev2)
    
    re_prev = MeterReading(
        meter_id=meter2.id,
        reading_value=5220.0,
        previous_reading=5100.0,
        usage=120.0,
        reading_type=ReadingType.ACTUAL.value,
        reading_time=datetime.now() - relativedelta(months=1),
        billing_period=prev_period,
        status=ReadingStatus.CONFIRMED.value,
        reader='抄表员A',
        is_estimated=False
    )
    db.session.add(re_prev)
    
    be_prev = Bill(
        bill_no=f'BILL{prev_period.replace("-", "")}0003',
        meter_id=meter2.id,
        billing_period=prev_period,
        reading_id=re_prev.id,
        previous_reading=5100.0,
        current_reading=5220.0,
        usage=120.0,
        unit_price=DEFAULT_ELECTRIC_PRICE,
        amount=72.0,
        status=BillStatus.PAID.value,
        issued_at=datetime.now() - relativedelta(months=1),
        paid_at=datetime.now() - relativedelta(months=1),
        is_estimated=False
    )
    db.session.add(be_prev)
    db.session.commit()
    
    result3 = submit_reading(meter2.id, {
        'reading_value': 6000.0,
        'billing_period': current_period,
        'reader': '抄表员A',
        'remarks': '抄表读数'
    })
    
    abnormal_id = result3['abnormals'][0]['id'] if result3.get('abnormals') else None
    if abnormal_id:
        result3_review = review_abnormal(abnormal_id, {
            'action': 'resolve',
            'correct_reading': 5350.0,
            'operator': '主管老李',
            'remark': '抄表时看错了，实际读数5350，原6000是错的'
        })
    
    meter2.current_reading = 5350.0
    db.session.commit()
    
    result3_bill = generate_bill(meter2.id, current_period)
    issue_bill(result3_bill['bill']['id'])
    
    print('场景4: 已缴费账单拦截 + 重新出账 (W003)')
    
    r4_prev2 = MeterReading(
        meter_id=meter4.id,
        reading_value=158.0,
        previous_reading=150.0,
        usage=8.0,
        reading_type=ReadingType.ACTUAL.value,
        reading_time=datetime.now() - relativedelta(months=2),
        billing_period=prev2_period,
        status=ReadingStatus.CONFIRMED.value,
        reader='抄表员C',
        is_estimated=False
    )
    db.session.add(r4_prev2)
    
    b4_prev2 = Bill(
        bill_no=f'BILL{prev2_period.replace("-", "")}0004',
        meter_id=meter4.id,
        billing_period=prev2_period,
        reading_id=r4_prev2.id,
        previous_reading=150.0,
        current_reading=158.0,
        usage=8.0,
        unit_price=DEFAULT_WATER_PRICE,
        amount=40.0,
        status=BillStatus.PAID.value,
        issued_at=datetime.now() - relativedelta(months=2),
        paid_at=datetime.now() - relativedelta(months=2),
        is_estimated=False
    )
    db.session.add(b4_prev2)
    
    r4_prev = MeterReading(
        meter_id=meter4.id,
        reading_value=168.0,
        previous_reading=158.0,
        usage=10.0,
        reading_type=ReadingType.ACTUAL.value,
        reading_time=datetime.now() - relativedelta(months=1),
        billing_period=prev_period,
        status=ReadingStatus.CONFIRMED.value,
        reader='抄表员C',
        is_estimated=False
    )
    db.session.add(r4_prev)
    
    b4_prev = Bill(
        bill_no=f'BILL{prev_period.replace("-", "")}0004',
        meter_id=meter4.id,
        billing_period=prev_period,
        reading_id=r4_prev.id,
        previous_reading=158.0,
        current_reading=168.0,
        usage=10.0,
        unit_price=DEFAULT_WATER_PRICE,
        amount=50.0,
        status=BillStatus.PAID.value,
        issued_at=datetime.now() - relativedelta(months=1),
        paid_at=datetime.now() - relativedelta(months=1),
        is_estimated=False
    )
    db.session.add(b4_prev)
    db.session.commit()
    
    result4 = submit_reading(meter4.id, {
        'reading_value': 175.0,
        'billing_period': current_period,
        'reader': '抄表员C',
        'remarks': '正常抄表'
    })
    
    result4_bill = generate_bill(meter4.id, current_period)
    issue_bill(result4_bill['bill']['id'])
    pay_bill(result4_bill['bill']['id'])
    
    meter4.current_reading = 175.0
    db.session.commit()
    
    try_correct = correct_bill(result4_bill['bill']['id'], {
        'new_reading': 180.0,
        'operator': '财务小张',
        'reason': '发现抄表有误，实际读数180'
    })
    
    result4_reissue = reissue_bill(result4_bill['bill']['id'], {
        'new_reading': 180.0,
        'operator': '财务小张',
        'reason': '发现抄表有误，实际读数180，补收5吨水费',
        'correction_type': CorrectionType.READING_ERROR.value
    })
    
    print('场景5: 读数倒退异常 (E002)')
    
    re2_prev2 = MeterReading(
        meter_id=meter5.id,
        reading_value=3100.0,
        previous_reading=3000.0,
        usage=100.0,
        reading_type=ReadingType.ACTUAL.value,
        reading_time=datetime.now() - relativedelta(months=2),
        billing_period=prev2_period,
        status=ReadingStatus.CONFIRMED.value,
        reader='抄表员D',
        is_estimated=False
    )
    db.session.add(re2_prev2)
    
    be2_prev2 = Bill(
        bill_no=f'BILL{prev2_period.replace("-", "")}0005',
        meter_id=meter5.id,
        billing_period=prev2_period,
        reading_id=re2_prev2.id,
        previous_reading=3000.0,
        current_reading=3100.0,
        usage=100.0,
        unit_price=DEFAULT_ELECTRIC_PRICE,
        amount=60.0,
        status=BillStatus.PAID.value,
        issued_at=datetime.now() - relativedelta(months=2),
        paid_at=datetime.now() - relativedelta(months=2),
        is_estimated=False
    )
    db.session.add(be2_prev2)
    
    re2_prev = MeterReading(
        meter_id=meter5.id,
        reading_value=3220.0,
        previous_reading=3100.0,
        usage=120.0,
        reading_type=ReadingType.ACTUAL.value,
        reading_time=datetime.now() - relativedelta(months=1),
        billing_period=prev_period,
        status=ReadingStatus.CONFIRMED.value,
        reader='抄表员D',
        is_estimated=False
    )
    db.session.add(re2_prev)
    
    be2_prev = Bill(
        bill_no=f'BILL{prev_period.replace("-", "")}0005',
        meter_id=meter5.id,
        billing_period=prev_period,
        reading_id=re2_prev.id,
        previous_reading=3100.0,
        current_reading=3220.0,
        usage=120.0,
        unit_price=DEFAULT_ELECTRIC_PRICE,
        amount=72.0,
        status=BillStatus.ISSUED.value,
        issued_at=datetime.now() - relativedelta(months=1),
        is_estimated=False
    )
    db.session.add(be2_prev)
    db.session.commit()
    
    result5 = submit_reading(meter5.id, {
        'reading_value': 3150.0,
        'billing_period': current_period,
        'reader': '抄表员D',
        'remarks': '抄表读数'
    })
    
    print('示例数据创建完成！')
    print(f'当前计费周期: {current_period}')
    print('')
    print('演示场景说明:')
    print('1. W001(张三) - 正常出账流程: 历史2期 + 本期正常抄表出账')
    print('2. W002(李四) - 漏抄估读补录: 估读生成账单后补录真实读数，自动修正账单')
    print('3. E001(张三) - 异常高用量复核: 6000读数被检测为异常，复核修正为5350')
    print('4. W003(王五) - 已缴费账单拦截 + 重新出账: 已缴费账单无法直接纠错，需重新出账')
    print('5. E002(赵六) - 读数倒退异常待处理: 3150 < 上期3220，待复核')
    
    return current_period
