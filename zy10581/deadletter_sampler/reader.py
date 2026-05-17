import json
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from pathlib import Path


@dataclass
class DeadLetterMessage:
    line_number: int
    raw_content: str
    parsed: Optional[Dict[str, Any]] = None
    parse_error: Optional[str] = None
    error_reason: Optional[str] = None
    business_key: Optional[str] = None


@dataclass
class ReadResult:
    messages: List[DeadLetterMessage] = field(default_factory=list)
    total_lines: int = 0
    valid_count: int = 0
    invalid_count: int = 0


class JSONLReader:
    def __init__(self, error_reason_field: str = "error_reason", business_key_field: str = "business_key"):
        self.error_reason_field = error_reason_field
        self.business_key_field = business_key_field

    def read(self, file_path: str) -> ReadResult:
        result = ReadResult()
        path = Path(file_path)

        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        with open(path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                result.total_lines += 1
                line = line.rstrip("\n")

                if not line.strip():
                    result.invalid_count += 1
                    msg = DeadLetterMessage(
                        line_number=line_num,
                        raw_content=line,
                        parse_error="Empty line"
                    )
                    result.messages.append(msg)
                    continue

                try:
                    parsed = json.loads(line)
                    msg = DeadLetterMessage(
                        line_number=line_num,
                        raw_content=line,
                        parsed=parsed,
                        error_reason=self._extract_reason(parsed),
                        business_key=self._extract_business_key(parsed)
                    )
                    result.valid_count += 1
                    result.messages.append(msg)
                except json.JSONDecodeError as e:
                    result.invalid_count += 1
                    msg = DeadLetterMessage(
                        line_number=line_num,
                        raw_content=line,
                        parse_error=f"JSON decode error: {str(e)}"
                    )
                    result.messages.append(msg)

        return result

    def _extract_reason(self, parsed: Dict[str, Any]) -> Optional[str]:
        if self.error_reason_field in parsed:
            return str(parsed[self.error_reason_field])
        return parsed.get("reason") or parsed.get("error") or parsed.get("exception")

    def _extract_business_key(self, parsed: Dict[str, Any]) -> Optional[str]:
        if self.business_key_field in parsed:
            return str(parsed[self.business_key_field])
        for key in ["order_id", "user_id", "transaction_id", "biz_id", "key"]:
            if key in parsed:
                return str(parsed[key])
        return None
