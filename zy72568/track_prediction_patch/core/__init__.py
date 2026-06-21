"""
核心业务逻辑层
"""

from .conflict_detector import ConflictDetector, ConflictEvidence, ConflictType
from .self_check import SelfChecker, CheckItem, CheckResult
from .reviewer import Reviewer, ReviewDecision

try:
    from .workflow import PatchWorkflow, WorkflowStep
except ImportError:
    import sys
    print("DEBUG: Failed to import PatchWorkflow", file=sys.stderr)
    import traceback
    traceback.print_exc()
    PatchWorkflow = None
    WorkflowStep = None

__all__ = [
    "ConflictDetector",
    "ConflictEvidence",
    "ConflictType",
    "SelfChecker",
    "CheckItem",
    "CheckResult",
    "PatchWorkflow",
    "WorkflowStep",
    "Reviewer",
    "ReviewDecision",
]
