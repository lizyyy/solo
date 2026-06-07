from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime


@dataclass
class GrayRecord:
    session_id: str
    knowledge_id: str
    original_question: str
    current_answer: str
    status: str = "pending"
    raw_text: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))


@dataclass
class GrayBatch:
    batch_id: str
    name: str
    records: List[GrayRecord] = field(default_factory=list)
    created_by: str = "system"
    created_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    processed: bool = False

    def add_record(self, record: GrayRecord):
        self.records.append(record)
