# 数据模型模块
from .models import (
    WorkOrder,
    Photo,
    InspectionPoint,
    QualityIssue,
    IssueType,
    IssueSeverity,
    QualityReport,
    PhotoArchive
)

__all__ = [
    'WorkOrder',
    'Photo',
    'InspectionPoint',
    'QualityIssue',
    'IssueType',
    'IssueSeverity',
    'QualityReport',
    'PhotoArchive'
]
