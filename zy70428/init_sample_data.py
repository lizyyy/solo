from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import models
import json


def init_sample_data(db: Session):
    invoice_count = db.query(models.InvoiceReversalRecord).count()
    if invoice_count > 0:
        return

    departments = ["销售一部", "销售二部", "财务科", "综合管理部"]
    operators = ["张三", "李四", "王五", "赵六"]
    reasons = ["发票信息填写错误", "退货", "折扣调整", "客户信息变更"]

    peak_invoices = [
        {"no": "031002100011", "code": "3100210011", "buyer": "上海汽车集团股份有限公司", "tax_no": "913100001322123456"},
        {"no": "031002100012", "code": "3100210012", "buyer": "宝钢股份有限公司", "tax_no": "913100001322789012"},
        {"no": "031002100013", "code": "3100210013", "buyer": "中国石化上海石油分公司", "tax_no": "913100001322345678"},
        {"no": "031002100014", "code": "3100210014", "buyer": "上海电气集团股份有限公司", "tax_no": "913100001322901234"},
        {"no": "031002100015", "code": "3100210015", "buyer": "交通银行股份有限公司", "tax_no": "913100001322567890"},
    ]

    base_date = datetime.now() - timedelta(days=30)

    for i, inv in enumerate(peak_invoices):
        invoice = models.InvoiceReversalRecord(
            invoice_no=inv["no"],
            invoice_code=inv["code"],
            buyer_name=inv["buyer"],
            buyer_tax_no=inv["tax_no"],
            seller_name="上海XX科技有限公司",
            seller_tax_no="91310000MA12345678",
            total_amount=10000.0 + i * 5000,
            total_tax=1300.0 + i * 650,
            reversal_date=base_date + timedelta(days=i),
            original_invoice_no=f"ORIG{inv['no'][-4:]}",
            reversal_reason=reasons[i % len(reasons)],
            department=departments[i % len(departments)],
            operator=operators[i % len(operators)],
            is_peak_period=True
        )
        db.add(invoice)

    non_peak_invoices = [
        {"no": "031002100021", "code": "3100210021", "buyer": "上海小型贸易公司A", "tax_no": "913100001234567890"},
        {"no": "031002100022", "code": "3100210022", "buyer": "上海小型贸易公司B", "tax_no": "913100000987654321"},
        {"no": "031002100023", "code": "3100210023", "buyer": "个体工商户陈某", "tax_no": "923100001122334455"},
    ]

    for i, inv in enumerate(non_peak_invoices):
        invoice = models.InvoiceReversalRecord(
            invoice_no=inv["no"],
            invoice_code=inv["code"],
            buyer_name=inv["buyer"],
            buyer_tax_no=inv["tax_no"],
            seller_name="上海XX科技有限公司",
            seller_tax_no="91310000MA12345678",
            total_amount=1000.0 + i * 500,
            total_tax=130.0 + i * 65,
            reversal_date=base_date - timedelta(days=60 + i),
            original_invoice_no=f"ORIG{inv['no'][-4:]}",
            reversal_reason="超过申报期",
            department=departments[i],
            operator=operators[i],
            is_peak_period=False
        )
        db.add(invoice)

    sms_records = [
        {"batch": "SMS202401001", "phone": "13800138001", "content": "【税务提醒】您的发票红冲申请已受理", "status": "成功"},
        {"batch": "SMS202401001", "phone": "13800138002", "content": "【税务提醒】您的发票红冲申请已受理", "status": "成功"},
        {"batch": "SMS202401002", "phone": "13800138003", "content": "【税务提醒】您的发票红冲申请已受理", "status": "成功"},
        {"batch": "SMS202401002", "phone": "13800138004", "content": "【税务提醒】您的发票红冲申请已受理", "status": "失败"},
        {"batch": "SMS202401003", "phone": "13800138005", "content": "【税务提醒】您的发票红冲申请已受理", "status": "成功"},
    ]

    for i, sms in enumerate(sms_records):
        sms_record = models.SMSSendRecord(
            batch_no=sms["batch"],
            phone_number=sms["phone"],
            sms_content=sms["content"],
            send_time=base_date + timedelta(hours=i),
            send_status=sms["status"],
            department=departments[i % len(departments)],
            operator=operators[i % len(operators)],
            invoice_related=peak_invoices[i % len(peak_invoices)]["no"]
        )
        db.add(sms_record)

    db.commit()

    print("样例数据初始化完成！")
    print(f"- 高峰发票红冲记录: 5条")
    print(f"- 非高峰发票红冲记录: 3条")
    print(f"- 短信发送记录: 5条")
