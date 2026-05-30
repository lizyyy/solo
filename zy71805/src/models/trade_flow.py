from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
import uuid


@dataclass
class TradeFlow:
    trade_id: str
    counterparty: str
    trade_date: str
    product_type: str
    notional_amount: float
    underlying: str
    option_type: str
    strike_price: float
    trade_status: str
    trader: str
    created_at: datetime = field(default_factory=datetime.now)
    remarks: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "TradeFlow":
        return cls(
            trade_id=data.get("trade_id", str(uuid.uuid4())),
            counterparty=data["counterparty"],
            trade_date=data["trade_date"],
            product_type=data.get("product_type", "OTC_Option"),
            notional_amount=float(data["notional_amount"]),
            underlying=data["underlying"],
            option_type=data["option_type"],
            strike_price=float(data["strike_price"]),
            trade_status=data.get("trade_status", "confirmed"),
            trader=data["trader"],
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
            remarks=data.get("remarks")
        )

    def to_dict(self) -> dict:
        return {
            "trade_id": self.trade_id,
            "counterparty": self.counterparty,
            "trade_date": self.trade_date,
            "product_type": self.product_type,
            "notional_amount": self.notional_amount,
            "underlying": self.underlying,
            "option_type": self.option_type,
            "strike_price": self.strike_price,
            "trade_status": self.trade_status,
            "trader": self.trader,
            "created_at": self.created_at.isoformat(),
            "remarks": self.remarks
        }
