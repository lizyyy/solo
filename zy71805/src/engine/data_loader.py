import pandas as pd
import json
from pathlib import Path
from typing import List, Dict, Any
import uuid

from src.config import INPUT_DIR
from src.models.credit_ledger import CreditLedger
from src.models.trade_flow import TradeFlow


class DataLoader:
    def __init__(self, input_dir: Path = INPUT_DIR):
        self.input_dir = input_dir

    def load_credit_ledger(self, filename: str = "credit_ledger.xlsx") -> List[CreditLedger]:
        file_path = self.input_dir / filename
        if not file_path.exists():
            return []

        df = pd.read_excel(file_path)
        ledgers = []
        for _, row in df.iterrows():
            data = row.to_dict()
            if "ledger_id" not in data or pd.isna(data["ledger_id"]):
                data["ledger_id"] = str(uuid.uuid4())
            ledgers.append(CreditLedger.from_dict(data))
        return ledgers

    def load_trade_flows(self, filename: str = "trade_flows.xlsx") -> List[TradeFlow]:
        file_path = self.input_dir / filename
        if not file_path.exists():
            return []

        df = pd.read_excel(file_path)
        trades = []
        for _, row in df.iterrows():
            data = row.to_dict()
            if "trade_id" not in data or pd.isna(data["trade_id"]):
                data["trade_id"] = str(uuid.uuid4())
            trades.append(TradeFlow.from_dict(data))
        return trades

    def load_actual_margin(self, filename: str = "actual_margin.xlsx") -> Dict[str, float]:
        file_path = self.input_dir / filename
        if not file_path.exists():
            return {}

        df = pd.read_excel(file_path)
        margin_map = {}
        for _, row in df.iterrows():
            counterparty = str(row.get("counterparty", "")).strip()
            actual = float(row.get("actual_margin", 0))
            if counterparty:
                margin_map[counterparty] = actual
        return margin_map

    def load_json(self, filename: str) -> Dict[str, Any]:
        file_path = self.input_dir / filename
        if not file_path.exists():
            return {}
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def save_to_excel(self, data: List[Dict[str, Any]], filename: str, sheet_name: str = "Sheet1"):
        df = pd.DataFrame(data)
        output_path = self.input_dir / filename
        df.to_excel(output_path, index=False, sheet_name=sheet_name)
        return output_path
