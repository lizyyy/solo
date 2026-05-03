from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class ParseResult:
    success: bool
    data: Any = None
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    metadata: Dict = field(default_factory=dict)
    _evidence_catalog: Any = None
    _references: List[Any] = field(default_factory=list)
    _objections: List[Any] = field(default_factory=list)
    _raw_content: Optional[str] = None

    @property
    def evidence_catalog(self) -> Any:
        return self._evidence_catalog

    @evidence_catalog.setter
    def evidence_catalog(self, value: Any) -> None:
        self._evidence_catalog = value

    @property
    def references(self) -> List[Any]:
        return self._references

    @references.setter
    def references(self, value: List[Any]) -> None:
        self._references = value

    @property
    def objections(self) -> List[Any]:
        return self._objections

    @objections.setter
    def objections(self, value: List[Any]) -> None:
        self._objections = value

    @property
    def raw_content(self) -> Optional[str]:
        return self._raw_content

    @raw_content.setter
    def raw_content(self, value: Optional[str]) -> None:
        self._raw_content = value


class BaseParser(ABC):
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []

    @abstractmethod
    def parse(self, file_path: Path) -> ParseResult:
        pass

    def parse_string(self, content: str) -> ParseResult:
        raise NotImplementedError(f"{self.__class__.__name__} does not support parse_string")

    def add_error(self, error: str) -> None:
        self.errors.append(error)

    def add_warning(self, warning: str) -> None:
        self.warnings.append(warning)

    def _validate_file(self, file_path: Path) -> bool:
        if not file_path.exists():
            self.add_error(f"File not found: {file_path}")
            return False
        if not file_path.is_file():
            self.add_error(f"Not a file: {file_path}")
            return False
        return True

    def _read_file(self, file_path: Path, encoding: str = "utf-8") -> Optional[str]:
        try:
            with open(file_path, "r", encoding=encoding) as f:
                return f.read()
        except UnicodeDecodeError:
            try:
                with open(file_path, "r", encoding="gbk") as f:
                    return f.read()
            except Exception as e:
                self.add_error(f"Failed to read file with UTF-8 or GBK encoding: {e}")
                return None
        except Exception as e:
            self.add_error(f"Failed to read file: {e}")
            return None
