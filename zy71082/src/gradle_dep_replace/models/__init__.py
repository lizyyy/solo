from .dependency import DependencyCoordinate, DependencyType
from .version_catalog import VersionCatalog, VersionEntry, LibraryEntry, PluginEntry, BundleEntry
from .replacement import ReplacementRule, ReplacementChain, ReplacementResult
from .conflict import Conflict, ConflictType, ConflictSeverity
from .report import Report, ExitCodeInfo

__all__ = [
    "DependencyCoordinate",
    "DependencyType",
    "VersionCatalog",
    "VersionEntry",
    "LibraryEntry",
    "PluginEntry",
    "BundleEntry",
    "ReplacementRule",
    "ReplacementChain",
    "ReplacementResult",
    "Conflict",
    "ConflictType",
    "ConflictSeverity",
    "Report",
    "ExitCodeInfo",
]
