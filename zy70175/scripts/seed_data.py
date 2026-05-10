import sys
import os
from datetime import datetime, timedelta
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, Base, engine
from app.models import Contract, Invoice, Receipt, ReceiptStatus


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        contract1 = Contract(
            contract_no="CT-2026-001",
            contract_name="软件开发服务合同",
            customer_name="创新科技有限公司",
            total_amount=Decimal("100000.00"),
            signed_at=datetime.utcnow() - timedelta(days=30),
        )
        contract2 = Contract(
            contract_no="CT-2026-002",
            contract_name="系统维护年度服务",
            customer_name="创新科技有限公司",
            total_amount=Decimal("36000.00"),
            signed_at=datetime.utcnow() - timedelta(days=15),
        )
        contract3 = Contract(
            contract_no="CT-2026-003",
            contract_name="数据迁移实施合同",
            customer_name="智慧未来集团",
            total_amount=Decimal("50000.00"),
            signed_at=datetime.utcnow() - timedelta(days=10),
        )
        db.add_all([contract1, contract2, contract3])
        db.flush()

        invoice1 = Invoice(
            invoice_no="INV-2026-001",
            contract_id=contract1.id,
            amount=Decimal("100000.00"),
            issued_at=datetime.utcnow() - timedelta(days=25),
        )
        invoice2 = Invoice(
            invoice_no="INV-2026-002",
            contract_id=contract2.id,
            amount=Decimal("18000.00"),
            issued_at=datetime.utcnow() - timedelta(days=5),
        )
        invoice3 = Invoice(
            invoice_no="INV-2026-003",
            contract_id=contract3.id,
            amount=Decimal("50000.00"),
            issued_at=datetime.utcnow() - timedelta(days=3),
        )
        db.add_all([invoice1, invoice2, invoice3])
        db.flush()

        receipt1 = Receipt(
            receipt_no="RCP-2026-001",
            amount=Decimal("100000.00"),
            paid_at=datetime.utcnow() - timedelta(days=5),
            payer_name="创新科技有限公司",
            payer_account="6222021234567890",
            payer_bank="工商银行中关村支行",
            remark="CT-2026-001 软件开发合同款",
            status=ReceiptStatus.UNMATCHED,
            remaining_amount=Decimal("100000.00"),
        )
        receipt2 = Receipt(
            receipt_no="RCP-2026-002",
            amount=Decimal("36000.00"),
            paid_at=datetime.utcnow() - timedelta(days=2),
            payer_name="创新科技有限公司",
            payer_account="6222021234567890",
            payer_bank="工商银行中关村支行",
            remark="年度服务费",
            status=ReceiptStatus.UNMATCHED,
            remaining_amount=Decimal("36000.00"),
        )
        receipt3 = Receipt(
            receipt_no="RCP-2026-003",
            amount=Decimal("25000.00"),
            paid_at=datetime.utcnow() - timedelta(days=1),
            payer_name="智慧未来集团",
            payer_account="9558800987654321",
            payer_bank="招商银行北京分行",
            remark="项目尾款",
            status=ReceiptStatus.UNMATCHED,
            remaining_amount=Decimal("25000.00"),
        )
        db.add_all([receipt1, receipt2, receipt3])

        db.commit()
        print("已创建测试数据:")
        print(f"  合同: {contract1.contract_no}, {contract2.contract_no}, {contract3.contract_no}")
        print(f"  发票: {invoice1.invoice_no}, {invoice2.invoice_no}, {invoice3.invoice_no}")
        print(f"  收款流水: {receipt1.receipt_no}, {receipt2.receipt_no}, {receipt3.receipt_no}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
