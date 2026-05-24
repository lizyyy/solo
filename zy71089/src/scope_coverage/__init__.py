__version__ = "0.1.0"

from .analyzer import CoverageAnalyzer, ScopeResolver
from .models import (
    APIEndpoint,
    AnalysisResult,
    CallLogEntry,
    CoverageGap,
    DeprecatedScopeUsage,
    DocFragment,
    ExitCode,
    ParseIssue,
    ReportConfig,
    SDKExample,
    Scope,
    ScopeMapping,
    Severity,
    SourceLocation,
)
from .reporter import ConsoleReporter, FileReporter, determine_exit_code

__all__ = [
    "CoverageAnalyzer",
    "ScopeResolver",
    "APIEndpoint",
    "AnalysisResult",
    "CallLogEntry",
    "CoverageGap",
    "DeprecatedScopeUsage",
    "DocFragment",
    "ExitCode",
    "ParseIssue",
    "ReportConfig",
    "SDKExample",
    "Scope",
    "ScopeMapping",
    "Severity",
    "SourceLocation",
    "ConsoleReporter",
    "FileReporter",
    "determine_exit_code",
]
