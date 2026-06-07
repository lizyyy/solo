from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any


@dataclass
class YamlSourceLine:
    """YAML原始行记录

    保留参数YAML的每一行原始信息，包括：
    - 原始行号（从1开始，对应文件里的行数）
    - 原始内容（导进来的时候是什么样就是什么样）
    - 人工改动记录（谁改了、改了什么、什么时候改的）

    推荐负责人追问的时候，能直接回到原始证据，不用重新翻文件
    """

    line_number: int
    raw_content: str
    parsed_key: Optional[str] = None
    parsed_value: Optional[Any] = None
    is_modified: bool = False
    modified_by: Optional[str] = None
    modified_at: Optional[datetime] = None
    original_content: Optional[str] = None
    modification_note: Optional[str] = None

    def apply_modification(
        self,
        new_content: str,
        modified_by: str,
        note: str = "",
        new_value: Optional[Any] = None,
    ) -> None:
        """记录一次人工改动"""
        if not self.is_modified:
            self.original_content = self.raw_content
        self.raw_content = new_content
        self.parsed_value = new_value
        self.is_modified = True
        self.modified_by = modified_by
        self.modified_at = datetime.now()
        self.modification_note = note

    def to_dict(self) -> Dict[str, Any]:
        return {
            "line_number": self.line_number,
            "raw_content": self.raw_content,
            "parsed_key": self.parsed_key,
            "parsed_value": self.parsed_value,
            "is_modified": self.is_modified,
            "modified_by": self.modified_by,
            "modified_at": self.modified_at.isoformat() if self.modified_at else None,
            "original_content": self.original_content,
            "modification_note": self.modification_note,
        }
