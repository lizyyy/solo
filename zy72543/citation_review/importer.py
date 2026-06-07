"""数据导入工具"""
import json
import csv
from datetime import datetime
from pathlib import Path
from typing import List

from .models import FeedbackTicket, DesensitizationNote
from .storage import JsonStorage
from .engine import generate_id


class TicketImporter:
    """工单导入器"""

    def __init__(self, storage: JsonStorage):
        self.storage = storage

    def from_json(self, file_path: str) -> List[FeedbackTicket]:
        """从 JSON 文件导入工单"""
        path = Path(file_path)
        data = json.loads(path.read_text(encoding="utf-8"))

        tickets = []
        for item in data:
            ticket = FeedbackTicket(
                ticket_id=item.get("ticket_id") or generate_id("tk"),
                user_id=str(item["user_id"]),
                user_feedback=item["user_feedback"],
                submit_time=datetime.fromisoformat(item["submit_time"])
                if isinstance(item.get("submit_time"), str)
                else datetime.now(),
                source_channel=item.get("source_channel", "app"),
                model_version=item.get("model_version"),
                raw_payload=item.get("raw_payload")
            )
            self.storage.save_ticket(ticket)
            tickets.append(ticket)

        return tickets

    def from_csv(self, file_path: str) -> List[FeedbackTicket]:
        """从 CSV 文件导入工单"""
        tickets = []
        path = Path(file_path)
        with open(path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ticket = FeedbackTicket(
                    ticket_id=row.get("ticket_id") or generate_id("tk"),
                    user_id=str(row["user_id"]),
                    user_feedback=row["user_feedback"],
                    submit_time=datetime.fromisoformat(row["submit_time"])
                    if row.get("submit_time") else datetime.now(),
                    source_channel=row.get("source_channel", "app"),
                    model_version=row.get("model_version")
                )
                self.storage.save_ticket(ticket)
                tickets.append(ticket)
        return tickets

    def add_desensitization_note(self, ticket_id: str, rule: str,
                                  context: str = None) -> DesensitizationNote:
        """AI 产品经理阿宁补录脱敏规则备注"""
        note = DesensitizationNote(
            note_id=generate_id("note"),
            ticket_id=ticket_id,
            noted_by="ai_product_manager_ning",
            desensitization_rule=rule,
            additional_context=context,
            updated_at=datetime.now()
        )
        self.storage.save_note(note)
        return note
