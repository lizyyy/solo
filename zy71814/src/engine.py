"""
核对引擎模块
实现预付卡沉淀核对的核心逻辑
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from collections import defaultdict

from .models import (
    PrepaidCardTransaction,
    SettlementRecord,
    DepositSummary,
    RecordStatus,
    ReconciliationStatus,
    generate_id
)


class ReconciliationEngine:
    def __init__(self):
        self.transactions: Dict[str, PrepaidCardTransaction] = {}
        self.settlements: Dict[str, SettlementRecord] = {}
        self.summaries: List[DepositSummary] = []

    def load_transactions_from_excel(self, file_path: str, sheet_name: str = None) -> List[PrepaidCardTransaction]:
        df = pd.read_excel(file_path, sheet_name=sheet_name)
        if isinstance(df, dict):
            df = list(df.values())[0]
        transactions = []

        required_columns = [
            '交易流水号', '交易日期', '卡号', '卡类型',
            '交易金额', '手续费', '结算金额',
            '商户号', '商户名称', '终端号', '订单号'
        ]

        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            raise ValueError(f"缺少必要列: {', '.join(missing_cols)}")

        for _, row in df.iterrows():
            txn = PrepaidCardTransaction(
                transaction_id=str(row.get('交易流水号', generate_id())),
                transaction_date=pd.to_datetime(row['交易日期']),
                card_number=str(row['卡号']),
                card_type=str(row['卡类型']),
                transaction_amount=float(row['交易金额']),
                fee_amount=float(row['手续费']),
                settlement_amount=float(row['结算金额']),
                merchant_id=str(row['商户号']),
                merchant_name=str(row['商户名称']),
                terminal_id=str(row['终端号']),
                order_no=str(row['订单号']),
                source_file=file_path.split('/')[-1]
            )
            transactions.append(txn)
            self.transactions[txn.transaction_id] = txn

        self._detect_duplicates()
        self._detect_fee_cross_period()

        return transactions

    def load_settlements_from_excel(self, file_path: str, sheet_name: str = None) -> List[SettlementRecord]:
        df = pd.read_excel(file_path, sheet_name=sheet_name)
        if isinstance(df, dict):
            df = list(df.values())[0]
        settlements = []

        for _, row in df.iterrows():
            settlement = SettlementRecord(
                settlement_id=str(row.get('结算流水号', generate_id())),
                settlement_date=pd.to_datetime(row.get('结算日期', datetime.now())),
                batch_no=str(row.get('批次号', '')),
                total_amount=float(row.get('交易总金额', 0)),
                total_fee=float(row.get('手续费总额', 0)),
                net_settlement=float(row.get('实际结算金额', 0)),
                transaction_count=int(row.get('交易笔数', 0)),
                bank_account=str(row.get('结算账户', '')),
                source_file=file_path.split('/')[-1]
            )
            settlements.append(settlement)
            self.settlements[settlement.settlement_id] = settlement

        return settlements

    def _detect_duplicates(self) -> None:
        txn_list = list(self.transactions.values())
        for i, txn1 in enumerate(txn_list):
            duplicates = []
            for j, txn2 in enumerate(txn_list):
                if i != j:
                    if (txn1.transaction_date.date() == txn2.transaction_date.date() and
                        abs(txn1.transaction_amount - txn2.transaction_amount) < 0.01 and
                        txn1.merchant_id == txn2.merchant_id and
                        txn1.order_no == txn2.order_no):
                        duplicates.append(txn2.transaction_id)
            if duplicates:
                txn1.is_duplicate = True
                txn1.duplicate_with = duplicates

    def _detect_fee_cross_period(self, fee_period_day: int = 25) -> None:
        for txn in self.transactions.values():
            if txn.transaction_date.day > fee_period_day:
                txn.fee_period_crossed = True

    def reconcile(self) -> Tuple[Dict, List[SettlementRecord]]:
        results = {
            'total_transactions': len(self.transactions),
            'total_settlements': len(self.settlements),
            'matched_count': 0,
            'unmatched_count': 0,
            'duplicate_count': sum(1 for t in self.transactions.values() if t.is_duplicate),
            'fee_crossed_count': sum(1 for t in self.transactions.values() if t.fee_period_crossed)
        }

        daily_transactions = defaultdict(list)
        for txn in self.transactions.values():
            day = txn.transaction_date.date()
            daily_transactions[day].append(txn)

        for settlement in self.settlements.values():
            day = settlement.settlement_date.date()
            day_txns = daily_transactions.get(day, [])

            total_amount = sum(t.transaction_amount for t in day_txns)
            total_fee = sum(t.fee_amount for t in day_txns)

            amount_diff = abs(total_amount - settlement.total_amount)
            fee_diff = abs(total_fee - settlement.total_fee)

            if amount_diff < 0.01 and fee_diff < 0.01:
                settlement.status = ReconciliationStatus.MATCHED
                settlement.matched_transactions = [t.transaction_id for t in day_txns]
                results['matched_count'] += 1
            elif amount_diff < 0.01 or fee_diff < 0.01:
                settlement.status = ReconciliationStatus.PARTIAL
                settlement.unmatched_amount = max(amount_diff, fee_diff)
                settlement.matched_transactions = [t.transaction_id for t in day_txns]
            else:
                settlement.status = ReconciliationStatus.UNMATCHED
                settlement.unmatched_amount = amount_diff
                results['unmatched_count'] += 1

        return results, list(self.settlements.values())

    def generate_deposit_summary(self, period_start: datetime, period_end: datetime) -> DepositSummary:
        period_txns = [
            t for t in self.transactions.values()
            if period_start.date() <= t.transaction_date.date() <= period_end.date()
        ]

        total_deposit = sum(t.transaction_amount for t in period_txns)
        total_fee = sum(t.fee_amount for t in period_txns)
        total_settlement = sum(t.settlement_amount for t in period_txns)

        confirmed_count = sum(1 for t in period_txns if t.status == RecordStatus.CONFIRMED)
        pending_count = sum(1 for t in period_txns if t.status == RecordStatus.PENDING)
        manual_modified_count = sum(1 for t in period_txns if t.status == RecordStatus.MANUAL_MODIFIED)
        duplicate_count = sum(1 for t in period_txns if t.is_duplicate)
        fee_crossed_count = sum(1 for t in period_txns if t.fee_period_crossed)

        summary = DepositSummary(
            summary_id=generate_id(),
            period_start=period_start,
            period_end=period_end,
            opening_balance=0.0,
            total_deposit=total_deposit,
            total_settlement=total_settlement,
            total_fee=total_fee,
            closing_balance=total_deposit - total_settlement - total_fee,
            confirmed_count=confirmed_count,
            pending_count=pending_count,
            manual_modified_count=manual_modified_count,
            duplicate_count=duplicate_count,
            fee_crossed_count=fee_crossed_count
        )

        self.summaries.append(summary)
        return summary

    def update_transaction_status(self, transaction_id: str, status: RecordStatus, remark: str = "") -> bool:
        if transaction_id in self.transactions:
            self.transactions[transaction_id].status = status
            if remark:
                self.transactions[transaction_id].manual_remark = remark
            return True
        return False

    def get_transactions_dataframe(self) -> pd.DataFrame:
        data = []
        for txn in self.transactions.values():
            data.append({
                '交易流水号': txn.transaction_id,
                '交易日期': txn.transaction_date.strftime('%Y-%m-%d'),
                '卡号': txn.card_number,
                '卡类型': txn.card_type,
                '交易金额': txn.transaction_amount,
                '手续费': txn.fee_amount,
                '结算金额': txn.settlement_amount,
                '商户号': txn.merchant_id,
                '商户名称': txn.merchant_name,
                '终端号': txn.terminal_id,
                '订单号': txn.order_no,
                '来源文件': txn.source_file,
                '状态': txn.status.value,
                '是否重复': '是' if txn.is_duplicate else '否',
                '重复流水号': ','.join(txn.duplicate_with) if txn.duplicate_with else '',
                '手续费跨期': '是' if txn.fee_period_crossed else '否',
                '人工备注': txn.manual_remark
            })
        return pd.DataFrame(data)

    def get_duplicate_transactions(self) -> List[PrepaidCardTransaction]:
        return [t for t in self.transactions.values() if t.is_duplicate]
