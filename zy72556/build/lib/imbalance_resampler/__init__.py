from .models import (
    RecordStatus,
    AuditAction,
    FeatureSnapshot,
    AuditLogEntry,
    ResampleRecord,
    ResampleSession,
)
from .resampler import ImbalanceResampler
from .data_store import DataStore
from .workflow import WorkflowEngine
from .explanation import ExplanationGenerator

__version__ = "0.1.0"

__all__ = [
    "RecordStatus",
    "AuditAction",
    "FeatureSnapshot",
    "AuditLogEntry",
    "ResampleRecord",
    "ResampleSession",
    "ImbalanceResampler",
    "DataStore",
    "WorkflowEngine",
    "ExplanationGenerator",
    "create_app",
    "run_server",
]


def __getattr__(name):
    if name in ("create_app", "run_server"):
        from .webapp import create_app, run_server
        return create_app if name == "create_app" else run_server
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
