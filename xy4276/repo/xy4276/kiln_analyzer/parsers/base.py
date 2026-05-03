from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Generic, TypeVar

T = TypeVar("T")


class BaseParser(ABC, Generic[T]):
    @abstractmethod
    def parse(self, file_path: Path) -> T:
        pass

    @abstractmethod
    def validate(self, data: Any) -> bool:
        pass
