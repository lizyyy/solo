"""
客服回访录音质检工具
用于批量处理客服回访录音的文字稿，进行质检分析并生成报告。
"""

__version__ = "1.0.0"
__author__ = "Quality Inspector Team"

from quality_inspector.models import Conversation, Message
from quality_inspector.validators import validate_conversation, ValidationError
from quality_inspector.rules import (
    detect_broken_promises,
    detect_emotion_escalation,
    detect_sensitive_words,
    detect_timeout_responses,
    QualityRule,
)
from quality_inspector.exporters import (
    export_terminal_summary,
    export_markdown_report,
    export_csv_exceptions,
)

__all__ = [
    "Conversation",
    "Message",
    "validate_conversation",
    "ValidationError",
    "detect_broken_promises",
    "detect_emotion_escalation",
    "detect_sensitive_words",
    "detect_timeout_responses",
    "QualityRule",
    "export_terminal_summary",
    "export_markdown_report",
    "export_csv_exceptions",
]
