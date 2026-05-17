import json
import os
from datetime import datetime
from typing import List
from models import ProcessingResult, ShortageLevel


class HistoryStorage:
    DEFAULT_FILE = ".linen_history.json"

    @staticmethod
    def save_history(results: List[ProcessingResult], filepath: str = None):
        if filepath is None:
            filepath = HistoryStorage.DEFAULT_FILE

        data = []
        for r in results:
            data.append({
                "hotel_name": r.hotel_name,
                "linen_type": r.linen_type,
                "inbound_quantity": r.inbound_quantity,
                "total_damage": r.total_damage,
                "total_rewash": r.total_rewash,
                "outbound_quantity": r.outbound_quantity,
                "shortage": r.shortage,
                "shortage_rate": r.shortage_rate,
                "shortage_level": r.shortage_level.value,
                "processed_at": r.processed_at.isoformat(),
            })

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    @staticmethod
    def load_history(filepath: str = None) -> List[ProcessingResult]:
        if filepath is None:
            filepath = HistoryStorage.DEFAULT_FILE

        if not os.path.exists(filepath):
            return []

        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        results = []
        for item in data:
            shortage_level = None
            for level in ShortageLevel:
                if level.value == item["shortage_level"]:
                    shortage_level = level
                    break

            processed_at = datetime.fromisoformat(item["processed_at"])

            result = ProcessingResult(
                hotel_name=item["hotel_name"],
                linen_type=item["linen_type"],
                inbound_quantity=item["inbound_quantity"],
                total_damage=item["total_damage"],
                total_rewash=item["total_rewash"],
                outbound_quantity=item["outbound_quantity"],
                shortage=item["shortage"],
                shortage_rate=item["shortage_rate"],
                shortage_level=shortage_level,
                processed_at=processed_at,
            )
            results.append(result)

        return results

    @staticmethod
    def clear_history(filepath: str = None):
        if filepath is None:
            filepath = HistoryStorage.DEFAULT_FILE

        if os.path.exists(filepath):
            os.remove(filepath)
