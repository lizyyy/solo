import json
from datetime import datetime, timedelta
from typing import List

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import MessageMetadata
from ..utils import generate_message_id, generate_idempotency_key


class SeedService:
    def __init__(self, db: Session = None):
        self.db = db or SessionLocal()

    def close(self):
        if self.db:
            self.db.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def create_sample_messages(self, count: int = 20) -> List[str]:
        now = datetime.utcnow()
        message_ids = []

        sample_data = [
            {
                "topic": "order.events",
                "business_type": "order",
                "message_body_template": '{{"order_id": "ORD-{idx}", "user_id": "USER-{idx}", "amount": {amount}, "status": "paid"}}',
                "amount_range": (100.0, 5000.0),
                "quantity_range": (1, 10),
            },
            {
                "topic": "payment.events",
                "business_type": "payment",
                "message_body_template": '{{"payment_id": "PAY-{idx}", "order_id": "ORD-{idx}", "amount": {amount}, "method": "alipay"}}',
                "amount_range": (50.0, 2000.0),
                "quantity_range": None,
            },
            {
                "topic": "inventory.events",
                "business_type": "inventory",
                "message_body_template": '{{"sku_id": "SKU-{idx}", "warehouse_id": "WH-01", "quantity": {quantity}, "operation": "deduct"}}',
                "amount_range": None,
                "quantity_range": (1, 100),
            },
            {
                "topic": "coupon.events",
                "business_type": "coupon",
                "message_body_template": '{{"coupon_id": "CPN-{idx}", "user_id": "USER-{idx}", "quota": {quota}, "discount": 20}}',
                "amount_range": None,
                "quantity_range": None,
                "quota_range": (1, 5),
            },
        ]

        for i in range(count):
            sample = sample_data[i % len(sample_data)]
            idx = i + 1
            message_id = generate_message_id()
            message_ids.append(message_id)

            amount = None
            if sample["amount_range"]:
                amount = round(
                    sample["amount_range"][0]
                    + (sample["amount_range"][1] - sample["amount_range"][0]) * (i / count),
                    2,
                )

            quantity = None
            if sample["quantity_range"]:
                quantity = sample["quantity_range"][0] + (i % (sample["quantity_range"][1] - sample["quantity_range"][0]))

            quota = None
            if sample.get("quota_range"):
                quota = sample["quota_range"][0] + (i % (sample["quota_range"][1] - sample["quota_range"][0]))

            business_id = f"BUS-{idx:06d}"
            business_key = f"{sample['business_type']}:{business_id}"

            message_body = sample["message_body_template"].format(
                idx=f"{idx:06d}",
                amount=amount or 0,
                quantity=quantity or 0,
                quota=quota or 0,
            )

            idempotency_key = generate_idempotency_key(
                sample["business_type"],
                business_id,
                message_id,
            )

            message = MessageMetadata(
                message_id=message_id,
                topic=sample["topic"],
                partition=i % 3,
                offset=i * 100,
                message_body=message_body,
                headers={
                    "source": "demo",
                    "generated_at": now.isoformat(),
                },
                business_key=business_key,
                idempotency_key=idempotency_key,
                business_type=sample["business_type"],
                business_id=business_id,
                amount=amount,
                quantity=quantity,
                quota=quota,
                source_timestamp=now - timedelta(hours=count - i),
            )
            self.db.add(message)

        self.db.commit()
        return message_ids
