import json
import hashlib
import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from config import SETTLEMENT_LOG, RATE_DIR
from models import Transaction, RateRule, SettlementRecord, TransactionType


class DataIO:
    @staticmethod
    def read_transactions(file_path: Path) -> List[Transaction]:
        df = pd.read_excel(file_path)
        transactions = []
        
        for _, row in df.iterrows():
            txn_type = TransactionType(row.get("交易类型", "支付"))
            txn_time = pd.to_datetime(row.get("交易时间", datetime.now()))
            
            txn = Transaction(
                txn_id=str(row.get("交易ID", "")),
                order_id=str(row.get("订单号", "")),
                card_no=str(row.get("卡号", "")),
                txn_type=txn_type,
                amount=float(row.get("金额", 0)),
                txn_time=txn_time,
                channel=str(row.get("渠道", "")),
                merchant_id=str(row.get("商户ID", "")),
                status=str(row.get("状态", "SUCCESS")),
                original_txn_id=str(row.get("原交易ID", "")) if pd.notna(row.get("原交易ID")) else None
            )
            transactions.append(txn)
        
        return transactions

    @staticmethod
    def read_rate_table(file_path: Path) -> Tuple[List[RateRule], str]:
        df = pd.read_excel(file_path)
        rules = []
        
        version = str(df.iloc[0].get("版本", "v1")) if len(df) > 0 else "v1"
        
        for _, row in df.iterrows():
            effective_date = pd.to_datetime(row.get("生效日期", datetime.now()))
            expire_date = pd.to_datetime(row["失效日期"]) if pd.notna(row.get("失效日期")) else None
            
            rule = RateRule(
                merchant_id=str(row.get("商户ID", "")),
                card_type=str(row.get("卡类型", "")),
                rate=float(row.get("费率", 0)),
                fixed_fee=float(row.get("固定手续费", 0)),
                effective_date=effective_date,
                expire_date=expire_date,
                version=str(row.get("版本", "v1"))
            )
            rules.append(rule)
        
        return rules, version

    @staticmethod
    def save_settlement_records(records: List[SettlementRecord], batch_id: str) -> None:
        history = DataIO.load_settlement_history()
        
        for record in records:
            record.batch_id = batch_id
            key = record.txn_id
            if key not in history:
                history[key] = []
            history[key].append(DataIO._record_to_dict(record))
        
        with open(SETTLEMENT_LOG, "w", encoding="utf-8") as f:
            json.dump(history, f, ensure_ascii=False, indent=2, default=str)

    @staticmethod
    def load_settlement_history() -> Dict[str, List[Dict]]:
        if SETTLEMENT_LOG.exists():
            with open(SETTLEMENT_LOG, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}

    @staticmethod
    def is_transaction_processed(txn_id: str) -> bool:
        history = DataIO.load_settlement_history()
        if txn_id not in history:
            return False
        for record in history[txn_id]:
            if record.get("status") in ["已清算", "已匹配"]:
                return True
        return False

    @staticmethod
    def get_processed_txns() -> set:
        history = DataIO.load_settlement_history()
        processed = set()
        for txn_id, records in history.items():
            for record in records:
                if record.get("status") in ["已清算", "已匹配"] and not record.get("is_historical", False):
                    processed.add(txn_id)
        return processed

    @staticmethod
    def _record_to_dict(record: SettlementRecord) -> Dict:
        return {
            "settlement_id": record.settlement_id,
            "txn_id": record.txn_id,
            "order_id": record.order_id,
            "card_no": record.card_no,
            "original_amount": record.original_amount,
            "rate_applied": record.rate_applied,
            "fee_amount": record.fee_amount,
            "settlement_amount": record.settlement_amount,
            "status": record.status.value,
            "judgment_reason": record.judgment_reason.value,
            "judgment_detail": record.judgment_detail,
            "next_step": record.next_step,
            "rate_version": record.rate_version,
            "created_at": record.created_at.isoformat(),
            "batch_id": record.batch_id,
            "is_historical": record.is_historical
        }

    @staticmethod
    def generate_batch_id() -> str:
        now = datetime.now()
        return f"BATCH_{now.strftime('%Y%m%d_%H%M%S')}"

    @staticmethod
    def get_rate_versions() -> List[str]:
        versions = []
        for file in RATE_DIR.glob("rate_table_*.xlsx"):
            versions.append(file.stem.replace("rate_table_", ""))
        return sorted(versions)

    @staticmethod
    def archive_rate_table(version: str) -> None:
        source = RATE_DIR / "rate_table.xlsx"
        if source.exists():
            target = RATE_DIR / f"rate_table_{version}.xlsx"
            if not target.exists():
                import shutil
                shutil.copy2(source, target)
