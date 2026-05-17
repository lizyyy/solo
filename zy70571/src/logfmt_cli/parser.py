import re
import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime

LOGFMT_PATTERN = re.compile(r'([a-zA-Z_][a-zA-Z0-9_]*)=([^\s]+)')

@dataclass
class ParsedLine:
    line_number: int
    raw: str
    fields: Dict[str, Any] = field(default_factory=dict)
