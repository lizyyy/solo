from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class AnnotationMessage:
    annotation_id: str
    session_id: str
    knowledge_id: str
    annotator: str
    on_site_statement: str
    old_answer: Optional[str] = None
    remark: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
