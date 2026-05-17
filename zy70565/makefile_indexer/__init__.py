from .models import MakefileTarget, BadLine, ParseResult, IndexReport
from .parser import MakefileParser
from .cli import ReportGenerator, main

__version__ = "1.0.0"
__all__ = [
    "MakefileTarget",
    "BadLine",
    "ParseResult",
    "IndexReport",
    "MakefileParser",
    "ReportGenerator",
    "main"
]
# Makefile Indexer Package
