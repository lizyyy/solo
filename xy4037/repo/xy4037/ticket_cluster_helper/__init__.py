"""
投诉工单相似簇助手
客服质检专用的本地AI/ML命令行工具

用于分析客服工单，自动聚类相似问题，检测新问题和重复投诉。
"""

__version__ = "1.0.0"
__author__ = "Customer Service QA Team"

from .config import Config, load_config, init_config, is_project_initialized
from .csv_parser import ParsedTicket, TicketParser, load_all_tickets
from .validator import ValidationError, ValidationResult, TicketValidator, validate_tickets
from .text_features import TextFeatures, TextProcessor, compute_cosine_similarity, compute_similarity_matrix
from .clustering import Cluster, ClusteringResult, TicketClusterer, build_ticket_map, build_features_map
from .feedback_store import FeedbackType, Feedback, OverrideRule, FeedbackStore, get_feedback_store
from .detector import DetectionType, DetectionResult, DetectionReport, TicketDetector, run_detection
from .exporter import ExportResult, ReportExporter, run_export_all
from .history import ImportRecord, TrainingRecord, HistoryManager, get_history_manager

__all__ = [
    "Config", "load_config", "init_config", "is_project_initialized",
    "ParsedTicket", "TicketParser", "load_all_tickets",
    "ValidationError", "ValidationResult", "TicketValidator", "validate_tickets",
    "TextFeatures", "TextProcessor", "compute_cosine_similarity", "compute_similarity_matrix",
    "Cluster", "ClusteringResult", "TicketClusterer", "build_ticket_map", "build_features_map",
    "FeedbackType", "Feedback", "OverrideRule", "FeedbackStore", "get_feedback_store",
    "DetectionType", "DetectionResult", "DetectionReport", "TicketDetector", "run_detection",
    "ExportResult", "ReportExporter", "run_export_all",
    "ImportRecord", "TrainingRecord", "HistoryManager", "get_history_manager"
]
