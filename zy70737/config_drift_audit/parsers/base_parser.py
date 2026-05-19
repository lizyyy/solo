from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Generic, TypeVar
from pathlib import Path

from ..models import ConfigItem, ExemptionRecord, SourceTracker

T = TypeVar('T')


@dataclass
class ParseResult(Generic[T]):
    items: List[T] = field(default_factory=list)
    source_tracker: SourceTracker = field(default_factory=SourceTracker)
    file_path: str = ""

    def sort_items(self) -> None:
        if hasattr(self.items[0], 'row_hash'):
            self.items.sort(key=lambda x: x.row_hash)
        elif hasattr(self.items[0], 'exemption_id'):
            self.items.sort(key=lambda x: x.exemption_id)


class BaseParser(ABC):
    @abstractmethod
    def parse_config_items(self, file_path: str) -> ParseResult[ConfigItem]:
        pass

    @abstractmethod
    def parse_exemptions(self, file_path: str) -> ParseResult[ExemptionRecord]:
        pass

    def _validate_file(self, file_path: str) -> Path:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        if not path.is_file():
            raise ValueError(f"Not a file: {file_path}")
        return path
