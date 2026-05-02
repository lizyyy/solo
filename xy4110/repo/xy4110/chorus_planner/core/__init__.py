"""核心逻辑层"""
from .constraint_validator import (
    ConstraintValidator,
    ValidationResult,
    ValidationIssue,
    IssueType,
    IssueSeverity,
)
from .seating_algorithm import SeatingAlgorithm, AlgorithmConfig, AutoSeatResult

__all__ = [
    'ConstraintValidator',
    'ValidationResult',
    'ValidationIssue',
    'IssueType',
    'IssueSeverity',
    'SeatingAlgorithm',
    'AlgorithmConfig',
    'AutoSeatResult',
]
