from typing import List, Dict, Tuple
from datetime import datetime
import uuid

from src.config import MARGIN_RATE
from src.models.credit_ledger import CreditLedger
from src.models.trade_flow import TradeFlow
from src.models.margin_record import MarginRecord


class MarginCalculator:
    def __init__(self, margin_rate: float = MARGIN_RATE):
        self.margin_rate = margin_rate

    def calculate_required_margin(self, trades: List[TradeFlow]) -> float:
        total_notional = sum(trade.notional_amount for trade in trades)
        return total_notional * self.margin_rate

    def calculate_margin_for_counterparty(
        self,
        counterparty: str,
        trades: List[TradeFlow],
        actual_margin: float,
        calculation_date: str = None
    ) -> MarginRecord:
        if calculation_date is None:
            calculation_date = datetime.now().strftime("%Y-%m-%d")

        required_margin = self.calculate_required_margin(trades)
        margin_shortfall = max(0, required_margin - actual_margin)
        margin_excess = max(0, actual_margin - required_margin)

        if margin_shortfall > 0:
            review_status = "PENDING"
        else:
            review_status = "CONFIRMED"

        record = MarginRecord(
            margin_id=str(uuid.uuid4()),
            counterparty=counterparty,
            calculation_date=calculation_date,
            required_margin=required_margin,
            actual_margin=actual_margin,
            margin_shortfall=margin_shortfall,
            margin_excess=margin_excess,
            review_status=review_status
        )

        for trade in trades:
            record.add_source_reference(
                source_type="TRADE_FLOW",
                source_id=trade.trade_id,
                source_field="notional_amount"
            )

        return record

    def calculate_all_margins(
        self,
        trades: List[TradeFlow],
        actual_margins: Dict[str, float],
        ledgers: List[CreditLedger] = None,
        calculation_date: str = None
    ) -> List[MarginRecord]:
        if calculation_date is None:
            calculation_date = datetime.now().strftime("%Y-%m-%d")

        trades_by_counterparty: Dict[str, List[TradeFlow]] = {}
        for trade in trades:
            if trade.counterparty not in trades_by_counterparty:
                trades_by_counterparty[trade.counterparty] = []
            trades_by_counterparty[trade.counterparty].append(trade)

        ledger_map: Dict[str, CreditLedger] = {}
        if ledgers:
            for ledger in ledgers:
                ledger_map[ledger.counterparty] = ledger

        margin_records = []
        for counterparty, party_trades in trades_by_counterparty.items():
            actual = actual_margins.get(counterparty, 0)
            record = self.calculate_margin_for_counterparty(
                counterparty=counterparty,
                trades=party_trades,
                actual_margin=actual,
                calculation_date=calculation_date
            )

            if counterparty in ledger_map:
                ledger = ledger_map[counterparty]
                record.add_source_reference(
                    source_type="CREDIT_LEDGER",
                    source_id=ledger.ledger_id,
                    source_field="credit_limit"
                )

                if ledger.available_credit < record.required_margin:
                    if record.review_status == "CONFIRMED":
                        record.review_status = "PENDING"
                    if not record.remarks:
                        record.remarks = f"授信额度不足: 可用{ledger.available_credit:.2f} < 需缴{record.required_margin:.2f}"

            margin_records.append(record)

        return margin_records
